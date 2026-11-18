/**
 * Writer Editor — структурований журнал безпеки та базовий моніторинг (ЛР №7-8).
 * Без зовнішніх залежностей (лише fs/path/crypto).
 *
 * Формат: JSON Lines (один JSON-об'єкт на рядок) у logs/security.log та в консоль:
 *   { timestamp (ISO 8601 UTC), level, requestId, component, actor:{id,ip}, action, resource, outcome, context }
 *
 * Гарантії:
 * - Санітизація: паролі, PIN-коди, client_secret, повні access/refresh-токени, Bearer/JWT у вільному тексті
 *   НІКОЛИ не потрапляють у журнал (маска ***REDACTED***, для токенів лишаються лише перші 6 символів).
 * - Ротація: при перевищенні maxBytes поточний файл перейменовується з міткою часу, зберігається maxArchives архівів.
 * - Моніторинг: лічильники запитів/помилок та виявлення брутфорсу (>= 5 невдалих входів за 60 с => WARNING, >= 10 => CRITICAL).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const OUTCOMES = ['SUCCESS', 'DENIED', 'ERROR'];
const REDACTED = '***REDACTED***';
const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 МБ
const DEFAULT_MAX_ARCHIVES = 5;
const MAX_DEPTH = 6;
const MAX_STRING = 2000;

// ---------- Санітизація ----------
const SECRET_KEYS = new Set([
  'password', 'passwd', 'pwd', 'pin', 'pincode', 'secret', 'clientsecret', 'jwtsecret', 'privatekey', 'apikey',
  'passphrase', 'authorization', 'cookie', 'setcookie', 'masterkey', 'encryptionkey', 'signingkey',
]);
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const isSecretKey = (k) => {
  const n = normKey(k);
  return SECRET_KEYS.has(n) || n.endsWith('password') || n.endsWith('secret');
};
const isTokenKey = (k) => normKey(k).endsWith('token');

/** Токен: лишає перші 6 символів для ідентифікації; короткі значення маскуються повністю. */
function maskToken(value) {
  const s = String(value);
  return s.length >= 16 ? `${s.slice(0, 6)}${REDACTED}` : REDACTED;
}

/** Маскує секрети у вільному тексті (повідомлення помилок, URL, заголовки). */
function sanitizeString(s) {
  let out = s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`);
  out = out.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, (m) => maskToken(m));
  out = out.replace(
    /\b(password|passwd|pwd|pin|client_secret|secret|access_token|refresh_token|token)(["']?\s*[=:]\s*["']?)([^\s"'&,;}]+)/gi,
    (_m, k, sep) => `${k}${sep}${REDACTED}`
  );
  return out;
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return undefined; // function/symbol
  if (value instanceof Error) return { name: value.name, message: sanitizeString(value.message) };
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (depth >= MAX_DEPTH) return '[MaxDepth]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSecretKey(k)) out[k] = REDACTED;
    else if (isTokenKey(k)) out[k] = typeof v === 'string' ? maskToken(v) : REDACTED;
    else out[k] = sanitize(v, depth + 1, seen);
  }
  return out;
}

// ---------- Логер ----------
function tsForFile(d = new Date()) {
  return d.toISOString().replace(/[-:.]/g, ''); // 20261118T101530123Z
}

/**
 * @param {object} [opts]
 * @param {string} [opts.logDir='logs']
 * @param {string} [opts.fileName='security.log']
 * @param {number} [opts.maxBytes=1MiB]
 * @param {number} [opts.maxArchives=5]
 * @param {boolean} [opts.file=true]     писати у файл
 * @param {boolean} [opts.console=true]  дублювати в консоль
 * @param {string} [opts.minLevel='DEBUG']
 * @param {(line:string)=>void} [opts.sink] альтернативний вивід у консоль (для тестів)
 */
function createLogger(opts = {}) {
  const logDir = path.resolve(opts.logDir || process.env.LOG_DIR || 'logs');
  const fileName = opts.fileName || 'security.log';
  const filePath = path.join(logDir, fileName);
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  const maxArchives = opts.maxArchives ?? DEFAULT_MAX_ARCHIVES;
  const toFile = opts.file !== false;
  const toConsole = opts.console !== false;
  const minIdx = Math.max(0, LEVELS.indexOf(opts.minLevel || 'DEBUG'));
  const sink = opts.sink || ((line) => console.log(line));
  const base = fileName.replace(/\.log$/, '');

  if (toFile) fs.mkdirSync(logDir, { recursive: true });

  function listArchives() {
    return fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith(`${base}-`) && f.endsWith('.log'))
      .sort(); // мітка часу в імені => лексикографічно = хронологічно
  }

  function rotateIfNeeded(incomingBytes) {
    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch {
      return; // файлу ще немає
    }
    if (size === 0 || size + incomingBytes <= maxBytes) return;
    let target = path.join(logDir, `${base}-${tsForFile()}.log`);
    for (let i = 1; fs.existsSync(target); i += 1) target = path.join(logDir, `${base}-${tsForFile()}-${i}.log`);
    fs.renameSync(filePath, target);
    const archives = listArchives();
    for (const old of archives.slice(0, Math.max(0, archives.length - maxArchives))) {
      try {
        fs.unlinkSync(path.join(logDir, old));
      } catch {
        /* ігноруємо: журнал не має ламати застосунок */
      }
    }
  }

  function log(level, fields = {}) {
    const lvl = LEVELS.includes(level) ? level : 'INFO';
    if (LEVELS.indexOf(lvl) < minIdx) return null;
    const outcome = OUTCOMES.includes(fields.outcome) ? fields.outcome : 'SUCCESS';
    const actor = fields.actor || {};
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      requestId: fields.requestId || crypto.randomUUID(),
      component: fields.component || 'App',
      actor: { id: actor.id ?? 'system', ip: actor.ip ?? null },
      action: fields.action || 'unspecified',
      resource: fields.resource ?? null,
      outcome,
      context: sanitize(fields.context || {}),
    };
    const line = JSON.stringify(entry);
    if (toFile) {
      try {
        rotateIfNeeded(Buffer.byteLength(line) + 1);
        fs.appendFileSync(filePath, `${line}\n`, 'utf8');
      } catch (e) {
        process.stderr.write(`[logger] write failed: ${e.message}\n`);
      }
    }
    if (toConsole) sink(line);
    return entry;
  }

  const api = { log, filePath, logDir, listArchives };
  for (const l of LEVELS) api[l.toLowerCase()] = (fields) => log(l, fields);
  return api;
}

// ---------- Моніторинг ----------
/**
 * Лічильники та детектор брутфорсу. Невдалі входи рахуються у ковзному вікні окремо за IP та за username.
 */
function createMonitor(logger, opts = {}) {
  const now = opts.nowMs || (() => Date.now());
  const windowMs = opts.windowMs || 60 * 1000;
  const warnAt = opts.warnThreshold || 5;
  const critAt = opts.criticalThreshold || 10;
  const startedAt = now();

  const counters = { total: 0, byStatus: {}, status401: 0, status403: 0, status429: 0, status500: 0, failedLogins: 0 };
  const windows = new Map(); // "ip:1.2.3.4" | "user:alice" -> { times:[], level }
  const alerts = [];

  function bump(status) {
    counters.total += 1;
    counters.byStatus[status] = (counters.byStatus[status] || 0) + 1;
    if (status === 401) counters.status401 += 1;
    else if (status === 403) counters.status403 += 1;
    else if (status === 429) counters.status429 += 1;
    else if (status >= 500) counters.status500 += 1;
  }

  function recordFailedLogin({ ip, username, requestId }) {
    counters.failedLogins += 1;
    const t = now();
    const found = [];
    for (const key of [`ip:${ip || 'unknown'}`, `user:${username || 'unknown'}`]) {
      const w = windows.get(key) || { times: [], level: null };
      w.times = w.times.filter((x) => t - x < windowMs);
      w.times.push(t);
      const n = w.times.length;
      const level = n >= critAt ? 'CRITICAL' : n >= warnAt ? 'WARNING' : null;
      if (level && level !== w.level) {
        // подія генерується лише при зміні рівня, щоб не засмічувати журнал на кожну спробу
        w.level = level;
        const alert = {
          timestamp: new Date(t).toISOString(),
          level,
          rule: 'BRUTE_FORCE_LOGIN',
          key,
          attempts: n,
          windowSec: windowMs / 1000,
        };
        alerts.push(alert);
        if (alerts.length > 50) alerts.shift();
        found.push(alert);
        logger.log(level, {
          requestId,
          component: 'MonitoringService',
          actor: { id: username || 'unknown', ip: ip || null },
          action: 'anomaly.bruteforce_detected',
          resource: '/api/auth/login',
          outcome: 'DENIED',
          context: { rule: alert.rule, key, attempts: n, windowSec: alert.windowSec },
        });
      }
      windows.set(key, w);
    }
    // прибирання вікон, що вичерпались
    for (const [k, w] of windows) if (w.times.length && t - w.times[w.times.length - 1] >= windowMs) windows.delete(k);
    return found;
  }

  function recordSuccessfulLogin({ ip, username }) {
    windows.delete(`user:${username}`);
    void ip;
  }

  function snapshot() {
    const t = now();
    return {
      generatedAt: new Date(t).toISOString(),
      startedAt: new Date(startedAt).toISOString(),
      uptimeSec: Math.round((t - startedAt) / 1000),
      requests: {
        total: counters.total,
        byStatus: { ...counters.byStatus },
        unauthorized401: counters.status401,
        forbidden403: counters.status403,
        tooMany429: counters.status429,
        serverError500: counters.status500,
      },
      auth: {
        failedLogins: counters.failedLogins,
        failedLoginsLastWindow: [...windows.values()].reduce((m, w) => Math.max(m, w.times.filter((x) => t - x < windowMs).length), 0),
        windowSec: windowMs / 1000,
        warnThreshold: warnAt,
        criticalThreshold: critAt,
      },
      recentAlerts: alerts.slice(-20),
    };
  }

  return { bump, recordFailedLogin, recordSuccessfulLogin, snapshot };
}

module.exports = { createLogger, createMonitor, sanitize, sanitizeString, maskToken, LEVELS, OUTCOMES, REDACTED };
