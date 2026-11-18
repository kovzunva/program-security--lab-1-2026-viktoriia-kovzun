#!/usr/bin/env node
/**
 * Writer Editor — резервне копіювання та аварійне відновлення (ЛР №7-8). Без зовнішніх залежностей.
 *
 *   node scripts/backupManager.js backup                 повна копія => backups/backup_<timestamp>/
 *   node scripts/backupManager.js restore <шлях_бекапу>  верифікація SHA-256 => відновлення => перевірка
 *   node scripts/backupManager.js prune <N>              залишити N найновіших копій
 *
 * Структура копії:  backup_<ts>/manifest.json, manifest.sha256, files/<відносний шлях>
 * manifest.json:    { formatVersion, createdAt, algorithm:"SHA-256", files:[{path,size,sha256}] }
 *
 * Принципи: нічого не відновлюється, доки ВСІ файли не пройшли перевірку SHA-256 (fail-closed);
 * шляхи з маніфесту не можуть виходити за межі кореня (path traversal); запис атомарний (tmp + rename);
 * пошкоджені робочі файли перед перезаписом зберігаються в backups/pre_restore_<ts>/ (докази інциденту).
 *
 * Змінні середовища: WE_ROOT (корінь проєкту), WE_BACKUP_DIR (каталог копій), LOG_DIR.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../server/logger.js');

const FORMAT_VERSION = 1;
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'latin1');

/** Критичні дані: сховище даних (SQLite + серверне сховище), конфігурація, метадані, журнал безпеки. */
const BACKUP_SOURCES = [
  { path: 'data', type: 'dir', kind: 'data' }, // writer-editor.db, server-store.json, ...
  { path: 'app.json', type: 'file', kind: 'config' },
  { path: 'package.json', type: 'file', kind: 'config' },
  { path: 'package-lock.json', type: 'file', kind: 'config' },
  { path: 'logs/security.log', type: 'file', kind: 'audit' },
];

class BackupError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const toPosix = (p) => p.split(path.sep).join('/');
const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('.', '');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function defaults(opts = {}) {
  const root = path.resolve(opts.root || process.env.WE_ROOT || path.join(__dirname, '..'));
  const backupsDir = path.resolve(opts.backupsDir || process.env.WE_BACKUP_DIR || path.join(root, 'backups'));
  const logger = opts.logger || createLogger({ logDir: opts.logDir || process.env.LOG_DIR || path.join(root, 'logs'), console: false });
  return { root, backupsDir, logger };
}

const audit = (logger, level, action, outcome, resource, context) =>
  logger.log(level, { component: 'BackupManager', actor: { id: 'cli', ip: null }, action, resource, outcome, context });

/** Захист від path traversal: відносний шлях має лишатися всередині base. */
function safeJoin(base, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.includes('\0')) throw new BackupError('BAD_PATH', `Недопустимий шлях у маніфесті: ${rel}`);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) throw new BackupError('BAD_PATH', `Шлях виходить за межі каталогу: ${rel}`);
  return full;
}

// ---------- BACKUP ----------
function backup(opts = {}) {
  const { root, backupsDir, logger } = defaults(opts);
  const created = new Date();
  const dir = path.join(backupsDir, `backup_${stamp(created)}`);
  const filesDir = path.join(dir, 'files');
  const entries = [];
  const skipped = [];

  for (const src of BACKUP_SOURCES) {
    const abs = path.join(root, src.path);
    if (!fs.existsSync(abs)) {
      skipped.push(src.path);
      continue;
    }
    const list = src.type === 'dir' ? walk(abs) : [abs];
    for (const file of list) entries.push({ abs: file, rel: toPosix(path.relative(root, file)), kind: src.kind });
  }
  if (entries.length === 0) {
    audit(logger, 'ERROR', 'backup.create', 'ERROR', dir, { reason: 'no source files', root });
    throw new BackupError('NOTHING_TO_BACKUP', 'Не знайдено жодного файлу для резервного копіювання');
  }

  fs.mkdirSync(filesDir, { recursive: true });
  const files = entries.map(({ abs, rel, kind }) => {
    const target = path.join(filesDir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(abs, target);
    const sha256 = sha256File(target);
    // копія має збігатися з джерелом (джерело могло змінитися під час копіювання)
    if (sha256 !== sha256File(abs)) throw new BackupError('SOURCE_CHANGED', `Файл змінився під час копіювання: ${rel}`);
    return { path: rel, kind, size: fs.statSync(target).size, sha256 };
  });

  const manifest = {
    formatVersion: FORMAT_VERSION,
    createdAt: created.toISOString(),
    algorithm: 'SHA-256',
    tool: 'scripts/backupManager.js',
    nodeVersion: process.version,
    type: 'full',
    files,
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifestJson);
  // хеш самого маніфесту: виявляє випадкове/неузгоджене пошкодження маніфесту
  fs.writeFileSync(path.join(dir, 'manifest.sha256'), `${crypto.createHash('sha256').update(manifestJson).digest('hex')}  manifest.json\n`);

  audit(logger, 'INFO', 'backup.create', 'SUCCESS', dir, {
    files: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
    skipped,
  });
  return { dir, manifest, skipped };
}

// ---------- VERIFY ----------
/** Перевіряє цілісність копії. Повертає { ok, manifest, errors[] } і нічого не змінює. */
function verifyBackup(backupPath) {
  const dir = path.resolve(backupPath);
  const errors = [];
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { ok: false, manifest: null, errors: ['manifest.json відсутній'] };

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const sumPath = path.join(dir, 'manifest.sha256');
  if (fs.existsSync(sumPath)) {
    const expected = fs.readFileSync(sumPath, 'utf8').trim().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(raw).digest('hex');
    if (expected !== actual) errors.push('manifest.json: SHA-256 маніфесту не збігається з manifest.sha256');
  } else {
    errors.push('manifest.sha256 відсутній');
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return { ok: false, manifest: null, errors: [...errors, 'manifest.json: некоректний JSON'] };
  }
  if (!manifest || manifest.formatVersion !== FORMAT_VERSION || manifest.algorithm !== 'SHA-256' || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    return { ok: false, manifest: null, errors: [...errors, 'manifest.json: непідтримуваний формат'] };
  }

  const filesDir = path.join(dir, 'files');
  const listed = new Set();
  for (const f of manifest.files) {
    let full;
    try {
      full = safeJoin(filesDir, f.path);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    listed.add(path.resolve(full));
    if (!fs.existsSync(full)) {
      errors.push(`${f.path}: файл відсутній у копії`);
      continue;
    }
    const size = fs.statSync(full).size;
    if (size !== f.size) errors.push(`${f.path}: розмір ${size} != ${f.size}`);
    const actual = sha256File(full);
    if (!/^[0-9a-f]{64}$/.test(f.sha256 || '') || actual !== f.sha256) {
      errors.push(`${f.path}: SHA-256 не збігається (очікувано ${String(f.sha256).slice(0, 12)}…, фактично ${actual.slice(0, 12)}…)`);
    }
  }
  if (fs.existsSync(filesDir)) {
    for (const f of walk(filesDir)) if (!listed.has(path.resolve(f))) errors.push(`${toPosix(path.relative(filesDir, f))}: файл відсутній у маніфесті (стороннє додавання)`);
  }
  return { ok: errors.length === 0, manifest, errors };
}

/** Структурна перевірка відновленого файлу (на додачу до SHA-256). */
function validateRestored(file, rel) {
  if (rel.endsWith('.db') || rel.endsWith('.sqlite')) {
    const fd = fs.openSync(file, 'r');
    try {
      const head = Buffer.alloc(SQLITE_MAGIC.length);
      fs.readSync(fd, head, 0, head.length, 0);
      if (!head.equals(SQLITE_MAGIC)) return 'відсутній заголовок "SQLite format 3"';
    } finally {
      fs.closeSync(fd);
    }
  } else if (rel.endsWith('.json')) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return 'некоректний JSON';
    }
  }
  return null;
}

// ---------- RESTORE ----------
function restore(backupPath, opts = {}) {
  const { root, backupsDir, logger } = defaults(opts);
  const dir = path.resolve(backupPath);

  const v = verifyBackup(dir);
  if (!v.ok) {
    audit(logger, 'CRITICAL', 'backup.verify', 'DENIED', dir, { errors: v.errors });
    throw new BackupError('INTEGRITY_FAILED', 'ВІДНОВЛЕННЯ ПЕРЕРВАНО: копія не пройшла перевірку цілісності SHA-256', v.errors);
  }
  audit(logger, 'INFO', 'backup.verify', 'SUCCESS', dir, { files: v.manifest.files.length });

  const filesDir = path.join(dir, 'files');
  const preDir = path.join(backupsDir, `pre_restore_${stamp()}`);
  const restored = [];
  const preserved = [];

  for (const f of v.manifest.files) {
    const src = safeJoin(filesDir, f.path);
    const dst = safeJoin(root, f.path);
    const existed = fs.existsSync(dst);
    if (existed) {
      if (sha256File(dst) === f.sha256) {
        restored.push({ path: f.path, action: 'unchanged' });
        continue;
      }
      const keep = safeJoin(preDir, f.path); // зберігаємо пошкоджену версію для розслідування
      fs.mkdirSync(path.dirname(keep), { recursive: true });
      fs.copyFileSync(dst, keep);
      preserved.push(f.path);
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const tmp = `${dst}.restore-${process.pid}.tmp`;
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dst); // атомарна заміна
    restored.push({ path: f.path, action: existed ? 'replaced' : 'created' });
  }

  // Post-restore: повторний SHA-256 + структурна валідність
  const problems = [];
  for (const f of v.manifest.files) {
    const dst = safeJoin(root, f.path);
    if (!fs.existsSync(dst) || sha256File(dst) !== f.sha256) problems.push(`${f.path}: SHA-256 після відновлення не збігається`);
    else {
      const bad = validateRestored(dst, f.path);
      if (bad) problems.push(`${f.path}: ${bad}`);
    }
  }
  if (problems.length) {
    audit(logger, 'CRITICAL', 'backup.restore', 'ERROR', dir, { problems });
    throw new BackupError('POST_RESTORE_FAILED', 'Відновлення завершено, але перевірка валідності не пройдена', problems);
  }
  audit(logger, 'WARNING', 'backup.restore', 'SUCCESS', dir, { files: restored.length, replaced: preserved, preRestoreDir: preserved.length ? preDir : null });
  return { dir, restored, preserved, preRestoreDir: preserved.length ? preDir : null, manifest: v.manifest };
}

// ---------- PRUNE (політика зберігання) ----------
function prune(keep, opts = {}) {
  const { backupsDir, logger } = defaults(opts);
  if (!Number.isInteger(keep) || keep < 1) throw new BackupError('BAD_ARGS', 'prune: кількість копій має бути цілим числом >= 1');
  if (!fs.existsSync(backupsDir)) return [];
  const all = fs.readdirSync(backupsDir).filter((n) => /^backup_\d{8}T\d+Z$/.test(n)).sort();
  const remove = all.slice(0, Math.max(0, all.length - keep));
  for (const n of remove) fs.rmSync(path.join(backupsDir, n), { recursive: true, force: true });
  audit(logger, 'INFO', 'backup.prune', 'SUCCESS', backupsDir, { removed: remove, kept: all.length - remove.length });
  return remove;
}

// ---------- CLI ----------
function main(argv) {
  const [cmd, arg] = argv;
  try {
    if (cmd === 'backup') {
      const r = backup();
      console.log(`[OK] Резервну копію створено: ${r.dir}`);
      for (const f of r.manifest.files) console.log(`     ${f.sha256}  ${f.path} (${f.size} B)`);
      if (r.skipped.length) console.log(`[WARN] Відсутні джерела (пропущено): ${r.skipped.join(', ')}`);
      console.log(`BACKUP_PATH=${r.dir}`);
      return 0;
    }
    if (cmd === 'restore' && arg) {
      console.log(`[1/3] Верифікація цілісності SHA-256: ${arg}`);
      const r = restore(arg);
      console.log(`[2/3] Усі файли (${r.manifest.files.length}) пройшли перевірку SHA-256`);
      for (const f of r.restored) console.log(`     ${f.action.padEnd(9)} ${f.path}`);
      if (r.preRestoreDir) console.log(`     Пошкоджені версії збережено: ${r.preRestoreDir}`);
      console.log('[3/3] Відновлені файли перевірено (SHA-256 + структурна валідність)');
      console.log('[OK] Відновлення завершено успішно');
      return 0;
    }
    if (cmd === 'prune' && arg) {
      const removed = prune(Number(arg));
      console.log(`[OK] Видалено копій: ${removed.length}`);
      return 0;
    }
    console.error('Використання:\n  node scripts/backupManager.js backup\n  node scripts/backupManager.js restore <шлях_до_бекапу>\n  node scripts/backupManager.js prune <N>');
    return 64;
  } catch (e) {
    if (e instanceof BackupError) {
      console.error(`[CRITICAL] ${e.message}`);
      for (const d of e.details || []) console.error(`     - ${d}`);
      return e.code === 'INTEGRITY_FAILED' ? 2 : 1;
    }
    console.error(`[ERROR] ${e.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { backup, restore, verifyBackup, prune, BackupError, BACKUP_SOURCES };
