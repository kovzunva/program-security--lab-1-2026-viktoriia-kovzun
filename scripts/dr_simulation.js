#!/usr/bin/env node
/**
 * Демонстрація Disaster Recovery (ЛР №7-8): backup -> інцидент -> restore з перевіркою SHA-256 -> підтвердження.
 * Запуск: node scripts/dr_simulation.js [--keep-sandbox]
 *
 * Працює в ізольованій пісочниці (тимчасовий каталог), реальні дані проєкту не зачіпаються.
 * Справжній CLI (scripts/backupManager.js) викликається як окремий процес із WE_ROOT=<пісочниця>.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, 'backupManager.js');
const PROJECT = path.join(__dirname, '..');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let failed = 0;
const step = (n, title) => console.log(`\n=== Крок ${n}: ${title} ===`);
const check = (name, cond) => {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!cond) failed += 1;
};

function runCli(env, ...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const indent = (t) => t.trim().split('\n').map((l) => `    | ${l}`).join('\n');

// ---------- Підготовка пісочниці з "робочими даними" ----------
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'we-dr-'));
const env = { WE_ROOT: sandbox, WE_BACKUP_DIR: path.join(sandbox, 'backups'), LOG_DIR: path.join(sandbox, 'logs') };
const rel = {
  db: 'data/writer-editor.db',
  store: 'data/server-store.json',
  app: 'app.json',
  pkg: 'package.json',
};
fs.mkdirSync(path.join(sandbox, 'data'), { recursive: true });
const envelope = (n) => `ENC:v1:AES-256-GCM:${crypto.randomBytes(12).toString('hex')}:${crypto.randomBytes(n).toString('hex')}:${crypto.randomBytes(16).toString('hex')}`;
// імітація файлу SQLite: коректний заголовок + шифровані розділи (дані в БД завжди у вигляді ENC:v1:...)
const dbBody = Buffer.concat([Buffer.from('SQLite format 3\0', 'latin1'), Buffer.alloc(84), Buffer.from(Array.from({ length: 40 }, (_, i) => `chapter-${i}|${envelope(64)}`).join('\n'))]);
fs.writeFileSync(path.join(sandbox, rel.db), dbBody);
fs.writeFileSync(path.join(sandbox, rel.store), JSON.stringify({ books: [{ id: 'b1', ownerId: 'u-bob', envelope: envelope(32), version: 3 }] }, null, 2));
for (const f of ['app.json', 'package.json']) fs.copyFileSync(path.join(PROJECT, f), path.join(sandbox, f));
const original = Object.fromEntries(Object.values(rel).map((r) => [r, sha(path.join(sandbox, r))]));

console.log('Writer Editor — симуляція аварійного відновлення (DR)');
console.log(`Пісочниця: ${sandbox}`);

const t0 = Date.now();

step(1, 'Повна резервна копія робочих даних');
const b = runCli(env, 'backup');
console.log(indent(b.out));
const backupPath = (/^BACKUP_PATH=(.+)$/m.exec(b.out) || [])[1];
check('backup завершився з кодом 0', b.code === 0 && Boolean(backupPath));
const manifest = JSON.parse(fs.readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
check('manifest.json містить SHA-256 для всіх файлів', manifest.files.length >= 4 && manifest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
check('хеші маніфесту збігаються з робочими файлами', manifest.files.every((f) => original[f.path] === undefined || original[f.path] === f.sha256));

step(2, 'Інцидент: пошкодження БД та видалення серверного сховища');
const dbPath = path.join(sandbox, rel.db);
const corrupted = Buffer.from(dbBody);
crypto.randomBytes(256).copy(corrupted, 0); // знищуємо заголовок і початок файлу
fs.writeFileSync(dbPath, corrupted);
fs.rmSync(path.join(sandbox, rel.store));
console.log(`    ${rel.db}: SHA-256 тепер ${sha(dbPath).slice(0, 16)}… (було ${original[rel.db].slice(0, 16)}…)`);
console.log(`    ${rel.store}: ВИДАЛЕНО`);
check('БД пошкоджена (хеш змінився)', sha(dbPath) !== original[rel.db]);
check('server-store.json відсутній', !fs.existsSync(path.join(sandbox, rel.store)));

step(3, 'Негативний тест: підроблена копія має бути відхилена');
const evil = path.join(sandbox, 'backups', 'evil_copy');
fs.cpSync(backupPath, evil, { recursive: true });
const victim = path.join(evil, 'files', ...rel.db.split('/'));
const buf = fs.readFileSync(victim);
buf[buf.length - 1] ^= 0x01; // зміна одного біта
fs.writeFileSync(victim, buf);
const dbBeforeBad = sha(dbPath);
const bad = runCli(env, 'restore', evil);
console.log(indent(bad.out));
check('restore підробленої копії перервано (код 2, CRITICAL)', bad.code === 2 && /CRITICAL/.test(bad.out));
check('робочі файли не змінено підробленою копією', sha(dbPath) === dbBeforeBad && !fs.existsSync(path.join(sandbox, rel.store)));
fs.rmSync(evil, { recursive: true, force: true });

step(4, 'Відновлення з перевіркою SHA-256');
const r = runCli(env, 'restore', backupPath);
console.log(indent(r.out));
check('restore завершився з кодом 0', r.code === 0);

step(5, 'Підтвердження повного відновлення');
for (const f of Object.values(rel)) check(`${f}: SHA-256 збігається з оригіналом`, sha(path.join(sandbox, f)) === original[f]);
check('SQLite-заголовок відновлено', fs.readFileSync(dbPath).subarray(0, 15).toString('latin1') === 'SQLite format 3');
check('server-store.json — валідний JSON', Boolean(JSON.parse(fs.readFileSync(path.join(sandbox, rel.store), 'utf8')).books));
const pre = path.join(sandbox, 'backups');
check('пошкоджену БД збережено для розслідування (pre_restore_*)', fs.readdirSync(pre).some((n) => n.startsWith('pre_restore_')));

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log('\n=== Журнал аудиту BackupManager (logs/security.log) ===');
const logFile = path.join(env.LOG_DIR, 'security.log');
for (const line of fs.readFileSync(logFile, 'utf8').trim().split('\n')) {
  const e = JSON.parse(line);
  console.log(`    ${e.timestamp} ${e.level.padEnd(8)} ${e.component}/${e.action} -> ${e.outcome}`);
}
console.log(`\nЧас сценарію (backup + інцидент + restore): ${elapsed} с (ціль RTO = 15 хв)`);

if (!process.argv.includes('--keep-sandbox')) fs.rmSync(sandbox, { recursive: true, force: true });
else console.log(`Пісочницю збережено: ${sandbox}`);

console.log(failed === 0 ? '\n[OK] DR-симуляція пройшла: дані повністю відновлено, цілісність підтверджено' : `\n[FAIL] Невдалих перевірок: ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
