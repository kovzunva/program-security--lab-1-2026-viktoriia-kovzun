/**
 * Верифікаційні тести ЛР №7-8: структурований журнал, санітизація, ротація, метрики та виявлення брутфорсу.
 * Запуск: node test_logging_monitoring.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/apiServer.js');
const { createLogger, sanitize, REDACTED } = require('./server/logger.js');

let failed = 0;
const check = (name, cond) => {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!cond) failed++;
};
const readLines = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'we-log-'));

  // --- Санітизація ---
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LWFsaWNlIn0.c2lnbmF0dXJlc2lnbmF0dXJl';
  const s = sanitize({
    password: 'alice-pass-1', pin: '1234', client_secret: 'cs-xyz', access_token: jwt, refresh_token: 'R'.repeat(43),
    nested: { newPassword: 'p2', authorization: `Bearer ${jwt}` }, msg: `fail Bearer ${jwt} password=hunter2`, ok: 'visible',
  });
  const dump = JSON.stringify(s);
  check('санітизація: password/pin/client_secret => ***REDACTED***', s.password === REDACTED && s.pin === REDACTED && s.client_secret === REDACTED);
  check('санітизація: access/refresh лишають лише 6 символів', s.access_token.startsWith('eyJhbG') && s.access_token.length < 30 && s.refresh_token === `RRRRRR${REDACTED}`);
  check('санітизація: вкладені ключі та вільний текст (Bearer, JWT, password=)', s.nested.newPassword === REDACTED && !dump.includes('hunter2') && !dump.includes('c2lnbmF0dXJl'));
  check('санітизація: звичайні поля не змінюються', s.ok === 'visible');

  // --- Формат запису ---
  const lg = createLogger({ logDir: dir, console: false });
  const e = lg.warning({ component: 'AuthService', actor: { id: 'u-1', ip: '10.0.0.1' }, action: 'auth.login', resource: '/api/auth/login', outcome: 'DENIED', context: { password: 'x' } });
  const line = readLines(lg.filePath)[0];
  check('формат: усі обов\'язкові поля', ['timestamp', 'level', 'requestId', 'component', 'actor', 'action', 'resource', 'outcome', 'context'].every((k) => k in line));
  check('формат: timestamp ISO 8601 UTC (new Date().toISOString())', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(line.timestamp) && new Date(line.timestamp).toISOString() === line.timestamp);
  check('формат: level/outcome з допустимого набору, секрет замасковано', line.level === 'WARNING' && line.outcome === 'DENIED' && line.context.password === REDACTED && e.actor.ip === '10.0.0.1');

  // --- Ротація ---
  const rdir = path.join(dir, 'rot');
  const rot = createLogger({ logDir: rdir, console: false, maxBytes: 2000, maxArchives: 2 });
  for (let i = 0; i < 60; i++) rot.info({ component: 'Test', action: 'fill', context: { i, pad: 'x'.repeat(80) } });
  const arch = rot.listArchives();
  check('ротація: поточний файл не перевищує ліміт', fs.statSync(rot.filePath).size <= 2000);
  check('ротація: архіви з міткою часу, не більше maxArchives', arch.length === 2 && arch.every((f) => /^security-\d{8}T\d+Z.*\.log$/.test(f)));

  // --- Сервер: requestId, метрики, брутфорс ---
  const slog = createLogger({ logDir: path.join(dir, 'srv'), console: false });
  const server = createServer({ secret: 'test-secret-test-secret-test-secret', logger: slog });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, { body, token, headers = {} } = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, rid: res.headers.get('x-request-id'), data: await res.json().catch(() => null) };
  };
  const login = (u, p) => call('POST', '/api/auth/login', { body: { username: u, password: p } });

  const ok = await login('alice', 'alice-pass-1');
  const forged = await call('GET', '/api/sync/books', { token: ok.data.access_token, headers: { 'X-Request-Id': 'forged-id' } });
  check('requestId: сервер видає UUID у X-Request-Id і ігнорує клієнтський', /^[0-9a-f-]{36}$/.test(forged.rid) && forged.rid !== 'forged-id');
  await call('POST', '/api/export/docx-cloud', { token: ok.data.access_token, body: { bookId: 'x' } }); // 403
  await call('GET', '/api/sync/books'); // 401
  const nonAdmin = await call('GET', '/api/admin/metrics', { token: ok.data.access_token });
  check('metrics: звичайний користувач => 403', nonAdmin.status === 403);

  // 6 невдалих входів з різними іменами (щоб не спрацював lockout за username) => детектор за IP
  for (let i = 0; i < 6; i++) await login(`ghost${i}`, 'wrong-password-123');
  const admin = (await login('admin', 'admin-pass-1')).data;
  const m = await call('GET', '/api/admin/metrics', { token: admin.access_token });
  check('metrics: ADMIN отримує 200', m.status === 200);
  check('metrics: лічильники 401/403 та failedLogins', m.data.requests.unauthorized401 >= 7 && m.data.requests.forbidden403 >= 2 && m.data.auth.failedLogins === 6 && m.data.requests.total >= 10);
  check('брутфорс: >= 5 спроб/хв => WARNING-алерт', m.data.recentAlerts.some((a) => a.level === 'WARNING' && a.rule === 'BRUTE_FORCE_LOGIN' && a.key.startsWith('ip:')));

  for (let i = 0; i < 5; i++) await login('alice', 'wrong'); // 5 на один акаунт + 429-спроби
  const m2 = (await call('GET', '/api/admin/metrics', { token: admin.access_token })).data;
  check('брутфорс: >= 10 спроб/хв з одного IP => CRITICAL', m2.recentAlerts.some((a) => a.level === 'CRITICAL'));

  await new Promise((r) => server.close(r));
  const lines = readLines(slog.filePath);
  const raw = fs.readFileSync(slog.filePath, 'utf8');
  check('журнал сервера: кожен рядок — валідний JSON з requestId', lines.length >= 15 && lines.every((x) => x.requestId && x.timestamp));
  check('кореляція: requestId із заголовка відповіді знайдено в журналі', lines.some((x) => x.requestId === forged.rid && x.action === 'GET /api/sync/books' && x.actor.id === 'u-alice'));
  check('журнал: події рівня WARNING (401/403) та CRITICAL (брутфорс)', lines.some((x) => x.level === 'WARNING' && x.outcome === 'DENIED') && lines.some((x) => x.level === 'CRITICAL' && x.action === 'anomaly.bruteforce_detected'));
  check('журнал: жодних паролів і повних токенів', !raw.includes('alice-pass-1') && !raw.includes('wrong-password-123') && !raw.includes(ok.data.access_token) && !raw.includes(ok.data.refresh_token) && !raw.includes(admin.access_token));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(failed ? `\nНевдалих перевірок: ${failed}` : '\nУсі тести пройдено');
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
