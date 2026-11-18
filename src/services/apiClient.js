/**
 * ApiClient — мережевий модуль клієнт-серверної моделі довіри.
 *
 * Клієнт НЕДОВІРЕНИЙ: він лише передає Bearer-токен і показує результат. Рішення про права доступу
 * (RBAC, власність ресурсів) ухвалює сервер; клієнтська перевірка тарифу — лише UX-підказка.
 *
 * - Authorization: Bearer <access_token> додається автоматично.
 * - 401: одноразова спроба оновити токени (single-flight) і повтор запиту; невдача => вихід із сесії.
 * - 403: ніколи не повторюється й не "обходиться" на клієнті — кидається ApiError(FORBIDDEN).
 * - Токени зберігаються в SecureStore (Keychain/Keystore); у пам'яті — лише як запасний варіант для тестів.
 * - HTTPS обов'язковий, окрім явного dev-режиму для localhost / емулятора.
 */

const ACCESS_KEY = 'api_access_token';
const REFRESH_KEY = 'api_refresh_token';
const DEV_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2'];

export class ApiError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code; // UNAUTHORIZED | FORBIDDEN | NETWORK | HTTP_ERROR | INSECURE_TRANSPORT
    this.status = status;
  }
}

/** Абстракція над захищеним сховищем: expo-secure-store або (лише для тестів) пам'ять. */
export function createSecureTokenStorage(secureStore = null) {
  let store = secureStore;
  if (!store) {
    try {
      store = require('expo-secure-store');
    } catch (e) {
      store = null;
    }
  }
  if (!store) return createMemoryTokenStorage();
  return {
    get: (key) => store.getItemAsync(key),
    set: (key, value) => store.setItemAsync(key, value),
    remove: (key) => store.deleteItemAsync(key),
  };
}

export function createMemoryTokenStorage() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
}

function assertSecureTransport(baseUrl, allowInsecureDev) {
  const url = new URL(baseUrl);
  if (url.protocol === 'https:') return;
  const isDev = typeof __DEV__ === 'undefined' || __DEV__; // у production-збірці RN __DEV__ === false
  if (url.protocol === 'http:' && allowInsecureDev && isDev && DEV_HOSTS.includes(url.hostname)) return;
  throw new ApiError('INSECURE_TRANSPORT', 0, 'HTTPS is required for API communication');
}

/**
 * @param {object} cfg
 * @param {string} cfg.baseUrl            — у production лише https://
 * @param {boolean} [cfg.allowInsecureDev] — дозволити http для localhost/емулятора (лише dev-збірка)
 * @param {object} [cfg.storage]          — {get,set,remove}; за замовчуванням SecureStore
 * @param {Function} [cfg.fetchImpl]
 * @param {Function} [cfg.onSessionExpired]
 */
export function createApiClient({
  baseUrl,
  allowInsecureDev = false,
  storage = createSecureTokenStorage(),
  fetchImpl = (...a) => fetch(...a),
  onSessionExpired = () => {},
} = {}) {
  assertSecureTransport(baseUrl, allowInsecureDev);
  const root = baseUrl.replace(/\/+$/, '');
  let refreshing = null;

  async function raw(method, path, { body, token } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchImpl(`${root}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError('NETWORK', 0, 'Network request failed');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    return { status: res.status, data };
  }

  async function saveTokens(t) {
    await storage.set(ACCESS_KEY, t.access_token);
    await storage.set(REFRESH_KEY, t.refresh_token);
  }

  async function clearSession() {
    await storage.remove(ACCESS_KEY);
    await storage.remove(REFRESH_KEY);
  }

  /** Single-flight: паралельні 401 ділять один запит на оновлення (інакше ротація зробить replay). */
  function refreshTokens() {
    if (!refreshing) {
      refreshing = (async () => {
        const refresh = await storage.get(REFRESH_KEY);
        if (!refresh) return false;
        const { status, data } = await raw('POST', '/api/auth/refresh', { body: { refresh_token: refresh } });
        if (status !== 200 || !data || !data.access_token) return false;
        await saveTokens(data);
        return true;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function endSession() {
    await clearSession();
    onSessionExpired();
    return new ApiError('UNAUTHORIZED', 401, 'Session expired');
  }

  async function request(method, path, body) {
    let token = await storage.get(ACCESS_KEY);
    let { status, data } = await raw(method, path, { body, token });
    if (status === 401) {
      if (!(await refreshTokens())) throw await endSession();
      token = await storage.get(ACCESS_KEY);
      ({ status, data } = await raw(method, path, { body, token }));
      if (status === 401) throw await endSession();
    }
    if (status === 403) throw new ApiError('FORBIDDEN', 403, (data && data.error) || 'FORBIDDEN');
    if (status < 200 || status >= 300) throw new ApiError('HTTP_ERROR', status, (data && data.error) || 'HTTP_ERROR');
    return data;
  }

  return {
    async login(username, password) {
      const { status, data } = await raw('POST', '/api/auth/login', { body: { username, password } });
      if (status !== 200 || !data || !data.access_token) {
        throw new ApiError(status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR', status, (data && data.error) || 'LOGIN_FAILED');
      }
      await saveTokens(data);
      return true;
    },
    async logout() {
      await clearSession();
    },
    async isAuthenticated() {
      return Boolean(await storage.get(ACCESS_KEY));
    },
    getBackups: () => request('GET', '/api/sync/books').then((d) => d.books),
    /** envelope — вже зашифрований cryptoService (ENC:v1:AES-256-GCM:...); відкритий текст на сервер не передається. */
    pushBackup: (envelope, id) => request('POST', '/api/sync/books', id ? { id, envelope } : { envelope }),
    /** Права визначає сервер: для FREE буде ApiError(FORBIDDEN) незалежно від стану клієнта. */
    exportDocxCloud: (bookId) => request('POST', '/api/export/docx-cloud', { bookId }),
  };
}
