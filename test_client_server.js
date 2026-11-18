/**
 * Верифікаційні тести ЛР №6: серверна авторизація, JWT, IDOR, RBAC, ротація refresh, клієнт.
 * Запуск: node test_client_server.js
 */
const { createServer, signToken } = require('./server/apiServer.js');
const { createApiClient, createMemoryTokenStorage, ApiError } = require('./src/services/apiClient.js');

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!cond) failed++;
}

const SECRET = 'test-secret-test-secret-test-secret';
const ENV = `ENC:v1:AES-256-GCM:${'ab'.repeat(12)}:${'cd'.repeat(8)}:${'ef'.repeat(16)}`;
let clock = 1_800_000_000;

async function main() {
  const server = createServer({ secret: SECRET, now: () => clock, accessTtlSec: 60 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { body, token, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const login = async (u, p) => (await call('POST', '/api/auth/login', { body: { username: u, password: p } }));

  // --- Автентифікація ---
  check('login: невірний пароль => 401', (await login('alice', 'wrong')).status === 401);
  check('login: невідомий користувач => 401 (та сама відповідь)', (await login('nobody', 'x')).data.error === 'INVALID_CREDENTIALS');
  const a = (await login('alice', 'alice-pass-1')).data;
  const b = (await login('bob', 'bob-pass-1')).data;
  check('login: видано access+refresh', a.access_token && a.refresh_token && a.token_type === 'Bearer');
  const claims = JSON.parse(Buffer.from(a.access_token.split('.')[1], 'base64url'));
  check('access: sub/tier/exp присутні', claims.sub === 'u-alice' && claims.tier === 'FREE' && claims.exp === clock + 60);

  // --- Перевірка токена ---
  check('без токена => 401', (await call('GET', '/api/sync/books')).status === 401);
  const tampered = a.access_token.split('.');
  tampered[1] = Buffer.from(JSON.stringify({ ...claims, tier: 'PRO' })).toString('base64url');
  check('підміна tier=PRO у payload => 401', (await call('GET', '/api/sync/books', { token: tampered.join('.') })).status === 401);
  const forged = signToken({ ...claims, tier: 'PRO' }, 'attacker-secret');
  check('токен, підписаний чужим ключем => 401', (await call('GET', '/api/sync/books', { token: forged })).status === 401);
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${tampered[1]}.`;
  check('alg=none => 401', (await call('GET', '/api/sync/books', { token: none })).status === 401);
  check('refresh-токен як Bearer => 401', (await call('GET', '/api/sync/books', { token: a.refresh_token })).status === 401);
  const expired = signToken({ ...claims, exp: clock - 1 }, SECRET);
  check('прострочений токен => 401', (await call('GET', '/api/sync/books', { token: expired })).status === 401);

  // --- IDOR ---
  const created = await call('POST', '/api/sync/books', { token: a.access_token, body: { id: 'book-a1', envelope: ENV, ownerId: 'u-bob' } });
  check('POST sync: 201, ownerId з тіла ігнорується', created.status === 201 && server.app._state.books.get('book-a1').ownerId === 'u-alice');
  check('POST sync: відкритий текст відхиляється', (await call('POST', '/api/sync/books', { token: a.access_token, body: { envelope: 'plain text' } })).status === 400);
  check('GET sync: власник бачить свій бекап', (await call('GET', '/api/sync/books', { token: a.access_token })).data.books.length === 1);
  check('GET sync: інший користувач не бачить чужих (IDOR)', (await call('GET', '/api/sync/books', { token: b.access_token })).data.books.length === 0);
  check('POST sync: перезапис чужого id => 404', (await call('POST', '/api/sync/books', { token: b.access_token, body: { id: 'book-a1', envelope: ENV } })).status === 404);
  check('чужий бекап не змінено', server.app._state.books.get('book-a1').version === 1);

  // --- RBAC ---
  const free = await call('POST', '/api/export/docx-cloud', {
    token: a.access_token,
    body: { bookId: 'book-a1', tier: 'PRO', isPro: true },
    headers: { 'X-Tier': 'PRO' },
  });
  check('docx-cloud: FREE => 403 (клієнтські прапорці ігноруються)', free.status === 403);
  await call('POST', '/api/sync/books', { token: b.access_token, body: { id: 'book-b1', envelope: ENV } });
  check('docx-cloud: PRO => 202', (await call('POST', '/api/export/docx-cloud', { token: b.access_token, body: { bookId: 'book-b1' } })).status === 202);
  check('docx-cloud: PRO, чужа книга => 404', (await call('POST', '/api/export/docx-cloud', { token: b.access_token, body: { bookId: 'book-a1' } })).status === 404);

  // --- Refresh: ротація та replay ---
  const r1 = (await call('POST', '/api/auth/refresh', { body: { refresh_token: a.refresh_token } })).data;
  check('refresh: нова пара токенів', r1.access_token && r1.refresh_token && r1.refresh_token !== a.refresh_token);
  const replay = await call('POST', '/api/auth/refresh', { body: { refresh_token: a.refresh_token } });
  check('refresh: повторне використання старого => 401 (replay)', replay.status === 401);
  check('refresh: після replay уся сім\'я відкликана', (await call('POST', '/api/auth/refresh', { body: { refresh_token: r1.refresh_token } })).status === 401);
  check('refresh: невідомий токен => 401', (await call('POST', '/api/auth/refresh', { body: { refresh_token: 'x' } })).status === 401);

  // --- Rate limit ---
  for (let i = 0; i < 5; i++) await login('carol', 'bad');
  check('login: блокування після 5 невдалих спроб => 429', (await login('carol', 'bad')).status === 429);

  // --- Клієнт ---
  let expiredCb = 0;
  const mk = (extra = {}) => createApiClient({ baseUrl: base, allowInsecureDev: true, storage: createMemoryTokenStorage(), onSessionExpired: () => expiredCb++, ...extra });
  let threw = null;
  try { createApiClient({ baseUrl: 'http://example.com' }); } catch (e) { threw = e; }
  check('клієнт: http до зовнішнього хоста заборонено', threw instanceof ApiError && threw.code === 'INSECURE_TRANSPORT');
  threw = null;
  try { createApiClient({ baseUrl: 'http://127.0.0.1:1', allowInsecureDev: false }); } catch (e) { threw = e; }
  check('клієнт: http без allowInsecureDev заборонено', threw && threw.code === 'INSECURE_TRANSPORT');

  const alice = mk();
  await alice.login('alice', 'alice-pass-1');
  check('клієнт: getBackups', (await alice.getBackups()).length === 1);
  threw = null;
  try { await alice.exportDocxCloud('book-a1'); } catch (e) { threw = e; }
  check('клієнт: FREE => ApiError FORBIDDEN', threw && threw.code === 'FORBIDDEN');

  clock += 120; // access (60 с) прострочено => автоматичний refresh
  check('клієнт: 401 => автоматичне оновлення токена й повтор', (await alice.getBackups()).length === 1);
  check('клієнт: сесія жива після refresh', await alice.isAuthenticated());

  clock += 120;
  server.app._state.refreshTokens.clear(); // сервер відкликав refresh
  threw = null;
  try { await alice.getBackups(); } catch (e) { threw = e; }
  check('клієнт: невдалий refresh => вихід із сесії', threw && threw.code === 'UNAUTHORIZED' && expiredCb === 1 && !(await alice.isAuthenticated()));

  server.close();
  console.log(failed ? `\n${failed} тест(ів) провалено` : '\nУсі тести пройдено');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
