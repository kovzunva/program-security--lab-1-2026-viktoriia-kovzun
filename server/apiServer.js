/**
 * Writer Editor — API-прототип клієнт-серверної моделі довіри.
 * Без зовнішніх залежностей (лише вбудовані http/https/crypto).
 *
 * Принципи:
 * - Клієнт НЕДОВІРЕНИЙ: роль (tier) береться виключно з підписаного токена, а токен видається на основі
 *   серверного сховища користувачів. Жодні поля тіла/заголовків запиту не впливають на права.
 * - Access-токен: JWT-подібний (HS256), короткоживучий (15 хв): { sub, tier, typ, iat, exp, jti }.
 * - Refresh-токен: непрозорий 256-бітний випадковий рядок; на сервері зберігається лише SHA-256 хеш.
 *   Ротація при кожному оновленні; повторне використання старого токена (replay) відкликає всю "сім'ю".
 * - IDOR: ownerId записується з token.sub, вибірка завжди фільтрується за ownerId === token.sub.
 * - Транспорт: у production — лише TLS 1.3 (TLS_KEY/TLS_CERT), HSTS.
 *
 * Запуск: node server/apiServer.js 
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 3600;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_LOGIN_FAILS = 5;
const LOGIN_LOCK_MS = 60 * 1000;
const ENVELOPE_RE = /^ENC:v1:AES-256-GCM:[0-9a-fA-F]+:[0-9a-fA-F]*:[0-9a-fA-F]{32}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// ---------- base64url / JWT (HS256) ----------
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signToken(payload, secret) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Повертає payload або кидає Error з кодом. Алгоритм фіксований (захист від alg=none / confusion). */
function verifyToken(token, secret, nowSec) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('MALFORMED');
  const [head, body, sig] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new Error('MALFORMED');
  }
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('BAD_ALG');
  const expected = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  if (!safeEqual(sig, expected)) throw new Error('BAD_SIGNATURE');
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSec) throw new Error('EXPIRED');
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') throw new Error('BAD_CLAIMS');
  if (payload.tier !== 'FREE' && payload.tier !== 'PRO') throw new Error('BAD_CLAIMS');
  return payload;
}

// ---------- Користувачі (демо-сховище; паролі — scrypt із сіллю) ----------
function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
function checkPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}
const DUMMY_HASH = hashPassword('dummy-password'); // вирівнює час відповіді для неіснуючих користувачів

function seedUsers() {
  return new Map([
    ['u-alice', { id: 'u-alice', username: 'alice', tier: 'FREE', passwordHash: hashPassword('alice-pass-1') }],
    ['u-bob', { id: 'u-bob', username: 'bob', tier: 'PRO', passwordHash: hashPassword('bob-pass-1') }],
  ]);
}

// ---------- Сервер ----------
function createApp(options = {}) {
  const secret = options.secret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  const accessTtl = options.accessTtlSec || ACCESS_TTL_SEC;
  const refreshTtl = options.refreshTtlSec || REFRESH_TTL_SEC;
  const nowSec = options.now || (() => Math.floor(Date.now() / 1000));
  const production = options.production ?? process.env.NODE_ENV === 'production';

  const users = options.users || seedUsers();
  const refreshTokens = new Map(); // sha256(token) -> { userId, familyId, exp, used }
  const revokedFamilies = new Set();
  const books = new Map(); // bookId -> { id, ownerId, envelope, version, updatedAt }
  const loginFails = new Map(); // username -> { count, lockedUntil }

  function issueTokens(user, familyId = crypto.randomUUID()) {
    const iat = nowSec();
    // tier читається із серверного сховища користувача на момент видачі
    const access = signToken(
      { sub: user.id, tier: user.tier, typ: 'access', iat, exp: iat + accessTtl, jti: crypto.randomUUID() },
      secret
    );
    const refresh = crypto.randomBytes(32).toString('base64url');
    refreshTokens.set(sha256Hex(refresh), { userId: user.id, familyId, exp: iat + refreshTtl, used: false });
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: accessTtl };
  }

  function send(res, status, body, extra = {}) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(data),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
      ...extra,
    });
    res.end(data);
  }
  const fail = (res, status, code, extra) => send(res, status, { error: code }, extra);

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          reject(Object.assign(new Error('TOO_LARGE'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        try {
          const obj = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error();
          resolve(obj);
        } catch {
          reject(Object.assign(new Error('BAD_JSON'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  /** Обов'язкова перевірка Bearer-токена на кожному захищеному ендпоінті. Повертає claims або null (відповідь уже надіслано). */
  function authenticate(req, res) {
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '');
    if (!m) {
      fail(res, 401, 'UNAUTHORIZED', { 'WWW-Authenticate': 'Bearer' });
      return null;
    }
    try {
      return verifyToken(m[1], secret, nowSec());
    } catch (e) {
      fail(res, 401, 'INVALID_TOKEN', { 'WWW-Authenticate': `Bearer error="invalid_token", error_description="${e.message}"` });
      return null;
    }
  }

  async function handleLogin(req, res) {
    const { username, password } = await readJson(req);
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 128) {
      return fail(res, 400, 'BAD_REQUEST');
    }
    const rec = loginFails.get(username) || { count: 0, lockedUntil: 0 };
    if (rec.lockedUntil > Date.now()) return fail(res, 429, 'TOO_MANY_ATTEMPTS', { 'Retry-After': '60' });

    const user = [...users.values()].find((u) => u.username === username);
    const ok = checkPassword(password, user ? user.passwordHash : DUMMY_HASH) && Boolean(user);
    if (!ok) {
      rec.count += 1;
      if (rec.count >= MAX_LOGIN_FAILS) {
        rec.count = 0;
        rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
      }
      loginFails.set(username, rec);
      return fail(res, 401, 'INVALID_CREDENTIALS'); // однакова відповідь: без user enumeration
    }
    loginFails.delete(username);
    return send(res, 200, issueTokens(user));
  }

  async function handleRefresh(req, res) {
    const { refresh_token: token } = await readJson(req);
    if (typeof token !== 'string') return fail(res, 400, 'BAD_REQUEST');
    const rec = refreshTokens.get(sha256Hex(token));
    if (!rec || rec.exp <= nowSec() || revokedFamilies.has(rec.familyId)) return fail(res, 401, 'INVALID_REFRESH_TOKEN');
    if (rec.used) {
      // Replay: уже використаний токен => імовірна крадіжка, відкликаємо всю сім'ю токенів
      revokedFamilies.add(rec.familyId);
      return fail(res, 401, 'REFRESH_TOKEN_REUSED');
    }
    const user = users.get(rec.userId);
    if (!user) return fail(res, 401, 'INVALID_REFRESH_TOKEN');
    rec.used = true;
    return send(res, 200, issueTokens(user, rec.familyId)); // tier перечитується з сервера
  }

  function handleGetBooks(req, res, claims) {
    const items = [...books.values()]
      .filter((b) => b.ownerId === claims.sub) // IDOR: лише власні записи
      .map(({ id, envelope, version, updatedAt }) => ({ id, envelope, version, updatedAt }));
    return send(res, 200, { books: items });
  }

  async function handlePostBook(req, res, claims) {
    const body = await readJson(req);
    const id = body.id === undefined ? crypto.randomUUID() : body.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) return fail(res, 400, 'BAD_ID');
    // Сервер зберігає лише шифротекст (E2E): відкритий текст відхиляється
    if (typeof body.envelope !== 'string' || body.envelope.length > MAX_BODY_BYTES || !ENVELOPE_RE.test(body.envelope)) {
      return fail(res, 400, 'INVALID_ENVELOPE');
    }
    const existing = books.get(id);
    if (existing && existing.ownerId !== claims.sub) return fail(res, 404, 'NOT_FOUND'); // не розкриваємо чужі id
    const record = {
      id,
      ownerId: claims.sub, // ніколи не з тіла запиту
      envelope: body.envelope,
      version: existing ? existing.version + 1 : 1,
      updatedAt: new Date(nowSec() * 1000).toISOString(),
    };
    books.set(id, record);
    return send(res, existing ? 200 : 201, { id, version: record.version, updatedAt: record.updatedAt });
  }

  async function handleDocxCloud(req, res, claims) {
    // RBAC: роль з підписаного токена; клієнтські прапорці ігноруються
    if (claims.tier !== 'PRO') return fail(res, 403, 'PRO_REQUIRED');
    const body = await readJson(req);
    const book = typeof body.bookId === 'string' ? books.get(body.bookId) : null;
    if (!book || book.ownerId !== claims.sub) return fail(res, 404, 'NOT_FOUND');
    return send(res, 202, { jobId: crypto.randomUUID(), bookId: book.id, format: 'docx', status: 'queued' });
  }

  async function route(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    const key = `${req.method} ${path}`;
    switch (key) {
      case 'POST /api/auth/login':
        return handleLogin(req, res);
      case 'POST /api/auth/refresh':
        return handleRefresh(req, res);
      case 'GET /api/sync/books':
      case 'POST /api/sync/books':
      case 'POST /api/export/docx-cloud': {
        const claims = authenticate(req, res);
        if (!claims) return undefined;
        if (key === 'GET /api/sync/books') return handleGetBooks(req, res, claims);
        if (key === 'POST /api/sync/books') return handlePostBook(req, res, claims);
        return handleDocxCloud(req, res, claims);
      }
      default:
        return fail(res, 404, 'NOT_FOUND');
    }
  }

  const handler = (req, res) => {
    route(req, res).catch((e) => {
      if (res.headersSent) return;
      if (e && e.status) return fail(res, e.status, e.message);
      return fail(res, 500, 'INTERNAL_ERROR');
    });
  };

  return { handler, secret, _state: { users, books, refreshTokens, revokedFamilies } };
}

function createServer(options = {}) {
  const app = createApp(options);
  const production = options.production ?? process.env.NODE_ENV === 'production';
  let server;
  if (production) {
    const key = options.tlsKey || process.env.TLS_KEY;
    const cert = options.tlsCert || process.env.TLS_CERT;
    if (!key || !cert) throw new Error('Production requires TLS_KEY and TLS_CERT (HTTPS only, TLS 1.3)');
    server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert), minVersion: 'TLSv1.3' }, app.handler);
  } else {
    server = http.createServer(app.handler);
  }
  server.app = app;
  return server;
}

if (require.main === module) {
  if (!process.env.JWT_SECRET) console.warn('[WARN] JWT_SECRET не задано: використано тимчасовий ключ (токени не переживуть перезапуск).');
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Writer Editor API listening on :${port}`));
}

module.exports = { createServer, createApp, signToken, verifyToken, ACCESS_TTL_SEC, REFRESH_TTL_SEC };
