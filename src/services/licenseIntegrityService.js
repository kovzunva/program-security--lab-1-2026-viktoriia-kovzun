import forge from 'node-forge';
import { cryptoService } from './cryptoService.js';

/**
 * LicenseIntegrityService — контроль цілісності даних (MDC SHA-256), ліцензування Freemium
 * (Free / Pro) та верифікація цифрового підпису ліцензії за допомогою ПУБЛІЧНОГО ключа розробника.
 *
 * Принципи:
 * - Приватний ключ розробника НЕ зберігається в клієнтському коді (див. tools/sign_demo_license.js);
 *   клієнт містить лише публічний ключ і може лише ПЕРЕВІРЯТИ підпис, але не створювати його.
 * - Підпис: RSASSA-PKCS1-v1_5 + SHA-256, RSA-2048.
 * - Підписаний канонічний рядок: "LICv1|<userId>|<tier>|<expiresAt>".
 * - Відсутня/недійсна/прострочена ліцензія => безпечний відкат до тарифу FREE (fail-safe).
 */

export const TIERS = Object.freeze({ FREE: 'FREE', PRO: 'PRO' });

export const FEATURES = Object.freeze({
  EDIT_BOOKS: 'EDIT_BOOKS',
  EXPORT_TXT: 'EXPORT_TXT',
  EXPORT_DOCX: 'EXPORT_DOCX',
  DETAILED_STATS: 'DETAILED_STATS',
  CHAPTER_ENCRYPTION: 'CHAPTER_ENCRYPTION',
});

/** Матриця прав доступу за тарифами (Freemium). */
export const TIER_FEATURES = Object.freeze({
  FREE: Object.freeze([FEATURES.EDIT_BOOKS, FEATURES.EXPORT_TXT]),
  PRO: Object.freeze([
    FEATURES.EDIT_BOOKS,
    FEATURES.EXPORT_TXT,
    FEATURES.EXPORT_DOCX,
    FEATURES.DETAILED_STATS,
    FEATURES.CHAPTER_ENCRYPTION,
  ]),
});

// Публічний ключ розробника (RSA-2048). Приватна частина відсутня в репозиторії.
export const DEVELOPER_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn0CqA9Io4lL+4bt9o76H
PdmEuCNlgpc/Xk+0vyNMwRP3koFCrZILvOcxDZwkzdoYPNiakLQJQDoptSnbgwWT
69HcDatvV6EATIUR0RXiBdeB8YqpZ6FZ9zTEaG7rhHIGe9ZOHo4oy2Evondx1GpH
WpkaokRoJnbZNqYzTloDCK+rOMmPvKyZy7ltyOwGq7YT89bBVGdPRZ2jUw5sVxnP
73PZs5/fmdPO7ke79rr0ntMuvSZWxApSjquKh34JlPHb5dwNBOvzUn+K7JkXCueO
13qGc4Q+8OJ6KZ0qaE5kG1zNgCAY+QReLRTwdmUJ/SbOwpkMHsWHBKEUXYSTz+u8
nQIDAQAB
-----END PUBLIC KEY-----`;

// Тестовий підписаний Pro-ключ (публічні дані: підпис не є секретом; userId=demo-user-001).
export const DEMO_PRO_LICENSE_TOKEN =
  'eyJ1c2VySWQiOiJkZW1vLXVzZXItMDAxIiwidGllciI6IlBSTyIsImV4cGlyZXNBdCI6IjIwMzAtMTItMzFUMjM6NTk6NTkuMDAwWiIsInNpZ25hdHVyZSI6ImxrNHhzL2JiUnVJT2VwVkluLzhvc2d6c0lyelNxYmFpeVF6Y3dvWFlwcGhwTDlNVUF1alFpSVYwd2s5R0V0ZmJDNlU0US9kUFpZbDN1clFWb2dONDE5TUNlbG5HWkl4YUJFQWt6L2VRYmNJQlRMemc0ZkZVWHhpUlhKQ0JYNWhLRmhDUWxOY0V2M29CUk83T1BMUjgvNklsSThyVU0zWXMvYjZGU0M5ckR1M1lvbjlUTDVkQnhRWkpLMHhpQVBGSDJTRWtWc2lHeEUvSlYvNEFjdWNJcXpMWE1MaXpSS24vRWV3WW93dFdlc3J4RFJHMzA2SFdZYjNhVXlGWk5qdERPalFTelQ2ZXVwNUxtS1Jac25VT2RKQmlGRWJoOFJ1Mmx6OWdSVUQxTTZTTmhpcDhCMFlBTmlMbGEyMVEyVWphUmJZY3hGb3B1b1U5UEVUMGp2NGUxdz09In0=';

const LICENSE_STORAGE_KEY = 'license_object';

let dbClientModule = null;

function getDbClient() {
  if (!dbClientModule) {
    try {
      dbClientModule = require('../database/client');
    } catch {
      dbClientModule = null;
    }
  }
  return dbClientModule;
}

/* ------------------------------------------------------------------ */
/* 1. MDC: контроль цілісності даних (SHA-256)                         */
/* ------------------------------------------------------------------ */

/** SHA-256 (hex) рядка UTF-8. Для бінарних даних передавайте base64-рядок як є. */
export function computeSha256Hex(data) {
  const md = forge.md.sha256.create();
  md.update(String(data ?? ''), 'utf8');
  return md.digest().toHex();
}

/** Порівняння постійного часу (запобігає timing-атакам на звірку хешів). */
function constantTimeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Звірка даних з очікуваним SHA-256 хешем (MDC). */
export function verifyDataIntegrity(data, expectedHashHex) {
  if (!expectedHashHex || typeof expectedHashHex !== 'string') {
    return false;
  }
  return constantTimeEqual(computeSha256Hex(data), expectedHashHex.trim().toLowerCase());
}

/** Формат sidecar-файлу `<file>.sha256`: "<hash>  <fileName>" (сумісний з sha256sum). */
export function buildHashManifest(data, fileName) {
  return `${computeSha256Hex(data)}  ${fileName}\n`;
}

export function parseHashManifest(manifestText) {
  const match = /^([0-9a-fA-F]{64})\s+(.+?)\s*$/m.exec(String(manifestText ?? ''));
  return match ? { hash: match[1].toLowerCase(), fileName: match[2] } : null;
}

/**
 * Перевірка цілісності сховища: кожен зашифрований розділ (chapters.body) читається з БД
 * напряму та проходить AEAD-верифікацію Auth Tag (cryptoService.decryptChapterContent).
 * @returns {Promise<{ok:boolean, checked:number, failed:Array<{chapterId:number,error:string}>}>}
 */
export async function verifyStorageIntegrity() {
  const db = getDbClient();
  if (!db || typeof db.getDb !== 'function') {
    return { ok: false, checked: 0, failed: [], error: 'Сховище недоступне' };
  }

  const rows = await (await db.getDb()).getAllAsync('SELECT id, body FROM chapters');
  const failed = [];
  let checked = 0;

  for (const row of rows) {
    if (!cryptoService.isEncrypted(row.body)) {
      continue; // відкритий текст (створений до активації шифрування) не має Auth Tag
    }
    checked += 1;
    try {
      await cryptoService.decryptChapterContent(row.body);
    } catch (error) {
      failed.push({ chapterId: row.id, error: error?.message || String(error) });
    }
  }

  return { ok: failed.length === 0, checked, failed };
}

/* ------------------------------------------------------------------ */
/* 2. Верифікація підпису ліцензії (публічний ключ)                    */
/* ------------------------------------------------------------------ */

function canonicalLicenseString(license) {
  return ['LICv1', license.userId, license.tier, license.expiresAt].join('|');
}

/**
 * Перевірка асиметричного підпису ліцензійного об'єкта {userId, tier, expiresAt, signature}.
 * @returns {{valid:boolean, reason?:string}}
 */
export function verifyLicenseSignature(license, publicKeyPem = DEVELOPER_PUBLIC_KEY_PEM) {
  if (!license || typeof license !== 'object') {
    return { valid: false, reason: 'MALFORMED' };
  }
  const { userId, tier, expiresAt, signature } = license;
  if (
    typeof userId !== 'string' || !userId
    || !Object.values(TIERS).includes(tier)
    || typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))
    || typeof signature !== 'string' || !signature
  ) {
    return { valid: false, reason: 'MALFORMED' };
  }

  try {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const md = forge.md.sha256.create();
    md.update(canonicalLicenseString(license), 'utf8');
    const ok = publicKey.verify(md.digest().bytes(), forge.util.decode64(signature));
    return ok ? { valid: true } : { valid: false, reason: 'BAD_SIGNATURE' };
  } catch {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }
}

/**
 * Повна валідація ліцензії: структура + підпис + термін дії.
 * @returns {{tier:string, valid:boolean, reason?:string, license?:object}}
 */
export function evaluateLicense(license, now = new Date(), publicKeyPem = DEVELOPER_PUBLIC_KEY_PEM) {
  if (!license) {
    return { tier: TIERS.FREE, valid: true, reason: 'NO_LICENSE' };
  }

  const sig = verifyLicenseSignature(license, publicKeyPem);
  if (!sig.valid) {
    return { tier: TIERS.FREE, valid: false, reason: sig.reason };
  }
  if (Date.parse(license.expiresAt) <= now.getTime()) {
    return { tier: TIERS.FREE, valid: false, reason: 'EXPIRED', license };
  }
  return { tier: license.tier, valid: true, license };
}

export function parseLicenseToken(token) {
  try {
    const json = forge.util.decodeUtf8(forge.util.decode64(String(token || '').trim()));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function getStoredLicense() {
  const db = getDbClient();
  if (!db || typeof db.getAuthSetting !== 'function') {
    return null;
  }
  try {
    const raw = await db.getAuthSetting(LICENSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Активація ліцензії: зберігається лише після успішної верифікації підпису та терміну. */
export async function activateLicenseToken(token) {
  const license = parseLicenseToken(token);
  const result = evaluateLicense(license);
  if (!result.valid || result.reason === 'NO_LICENSE') {
    return { success: false, reason: result.reason || 'MALFORMED' };
  }

  const db = getDbClient();
  if (db && typeof db.setAuthSetting === 'function') {
    await db.setAuthSetting(LICENSE_STORAGE_KEY, JSON.stringify(license));
  }
  return { success: true, tier: result.tier, license };
}

export async function deactivateLicense() {
  const db = getDbClient();
  if (db && typeof db.deleteAuthSetting === 'function') {
    await db.deleteAuthSetting(LICENSE_STORAGE_KEY);
  }
}

/** Поточний ефективний стан ліцензії (підпис перевіряється при КОЖНОМУ зверненні). */
export async function getLicenseStatus() {
  return evaluateLicense(await getStoredLicense());
}

export function tierHasFeature(tier, feature) {
  return (TIER_FEATURES[tier] || TIER_FEATURES.FREE).includes(feature);
}

export async function hasFeature(feature) {
  const status = await getLicenseStatus();
  return tierHasFeature(status.tier, feature);
}

export class LicenseRequiredError extends Error {
  constructor(feature) {
    super(`PRO license required for feature: ${feature}`);
    this.name = 'LicenseRequiredError';
    this.code = 'LICENSE_REQUIRED';
    this.feature = feature;
  }
}

/** Кидає LicenseRequiredError, якщо поточний тариф не надає функцію. */
export async function assertFeature(feature) {
  if (!(await hasFeature(feature))) {
    throw new LicenseRequiredError(feature);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Базовий захист від підміни середовища / конфігурації             */
/* ------------------------------------------------------------------ */

/** Відбиток публічного ключа (SHA-256 від PEM без пробілів). */
export function getPublicKeyFingerprint(pem = DEVELOPER_PUBLIC_KEY_PEM) {
  return computeSha256Hex(pem.replace(/\s+/g, ''));
}

function canonicalConfig() {
  return JSON.stringify({
    tiers: Object.keys(TIERS),
    free: TIER_FEATURES.FREE,
    pro: TIER_FEATURES.PRO,
    pubKey: getPublicKeyFingerprint(),
  });
}

export function getConfigDigest() {
  return computeSha256Hex(canonicalConfig());
}

// Еталонний дайджест конфігурації (оновлюється разом зі зміною матриці прав/ключа: node test_license_integrity.js --print-digest).
export const EXPECTED_CONFIG_DIGEST = '5453033ec0de501371425a5a757300549d832610c9e90852ad57152b74fd53b6';

/**
 * Перевірка цілісності конфігурації ліцензування: публічний ключ і матриця прав
 * не повинні відрізнятися від еталонних; об'єкти конфігурації мають бути заморожені.
 * Це базовий (best-effort) захист: JS-клієнт не може повністю довіряти власному середовищу,
 * тому остаточне рішення про цінні функції має підкріплюватись підписом ліцензії.
 */
export function verifyEnvironmentIntegrity() {
  const issues = [];

  if (!constantTimeEqual(getConfigDigest(), EXPECTED_CONFIG_DIGEST)) {
    issues.push('CONFIG_DIGEST_MISMATCH');
  }
  if (!Object.isFrozen(TIER_FEATURES) || !Object.isFrozen(TIER_FEATURES.FREE) || !Object.isFrozen(TIER_FEATURES.PRO)) {
    issues.push('CONFIG_NOT_FROZEN');
  }
  if (TIER_FEATURES.FREE.includes(FEATURES.EXPORT_DOCX)) {
    issues.push('FREE_TIER_ESCALATION');
  }
  // Попередження (не блокують роботу): збірка для розробки / підключений дебагер.
  const warnings = [];
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    warnings.push('DEV_BUILD');
  }

  return { ok: issues.length === 0, issues, warnings };
}

export const licenseIntegrityService = {
  TIERS,
  FEATURES,
  TIER_FEATURES,
  computeSha256Hex,
  verifyDataIntegrity,
  buildHashManifest,
  parseHashManifest,
  verifyStorageIntegrity,
  verifyLicenseSignature,
  evaluateLicense,
  parseLicenseToken,
  getStoredLicense,
  activateLicenseToken,
  deactivateLicense,
  getLicenseStatus,
  tierHasFeature,
  hasFeature,
  assertFeature,
  getPublicKeyFingerprint,
  getConfigDigest,
  verifyEnvironmentIntegrity,
};
