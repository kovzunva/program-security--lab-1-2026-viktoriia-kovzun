import forge from 'node-forge';

/**
 * CryptoService — Автентифіковане шифрування (AEAD) та контроль цілісності
 * для авторських рукописів мобільного застосунку Writer Editor.
 *
 * Специфікація алгоритму:
 * - Алгоритм: AES-256-GCM (Galois/Counter Mode)
 * - Розмір симетричного ключа: 256 біт (32 байти)
 * - Початковий вектор (IV / Nonce): 96 біт (12 байт), криптографічно випадковий (CSPRNG) для КОЖНОЇ операції
 * - Мітка автентичності (Auth Tag): 128 біт (16 байт) для виявлення фальсифікації або підробки
 * - Деривація ключів: PBKDF2 (HMAC-SHA256, 10 000+ ітерацій, 16-байтна сіль) з локального PIN-коду
 * - Формат збереження: ENC:v1:AES-256-GCM:<iv_hex>:<ciphertext_hex>:<tag_hex>
 */

const CIPHER_PREFIX = 'ENC:v1:AES-256-GCM:';
const KEY_STORAGE_KEY = 'crypto_master_key';
const KEY_SALT_KEY = 'crypto_key_salt';
const ENCRYPTION_ENABLED_KEY = 'crypto_encryption_enabled';

const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH_BYTES = 32; // 256-bit key
const IV_LENGTH_BYTES = 12;  // 96-bit IV (NIST SP 800-38D recommended for GCM)
const TAG_LENGTH_BITS = 128; // 128-bit authentication tag

let cachedKeyHex = null;
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

/**
 * Безпечна генерація криптографічно стійких випадкових байтів (CSPRNG)
 */
export function generateRandomBytes(numBytes) {
  // 1. Спроба використати Web Crypto / window.crypto якщо доступний
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(numBytes);
    globalThis.crypto.getRandomValues(bytes);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return binary;
  }

  // 2. Використання node-forge CSPRNG (кросплатформений чистий JS)
  return forge.random.getBytesSync(numBytes);
}

/**
 * Конвертація бінарного рядка forge у HEX
 */
export function bytesToHex(bytes) {
  return forge.util.bytesToHex(bytes);
}

/**
 * Конвертація HEX у бінарний рядок forge
 */
export function hexToBytes(hex) {
  return forge.util.hexToBytes(hex);
}

/**
 * Генерація нового 256-бітного симетричного ключа за допомогою CSPRNG
 */
export function generateKey() {
  const rawBytes = generateRandomBytes(KEY_LENGTH_BYTES);
  return bytesToHex(rawBytes);
}

/**
 * Деривація 256-бітного ключа з PIN-коду та солі через PBKDF2 (HMAC-SHA256)
 */
export function deriveKeyFromPin(pin, saltHex) {
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN-код обов’язковий для деривації ключа');
  }

  const saltBytes = saltHex ? hexToBytes(saltHex) : generateRandomBytes(16);
  const derivedBytes = forge.pkcs5.pbkdf2(
    pin,
    saltBytes,
    PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
    forge.md.sha256.create(),
  );

  return {
    keyHex: bytesToHex(derivedBytes),
    saltHex: bytesToHex(saltBytes),
  };
}

/**
 * Отримання або ініціалізація активного майстер-ключа шифрування
 */
export async function getMasterKey(optionalPin = null) {
  if (cachedKeyHex) {
    return cachedKeyHex;
  }

  const db = getDbClient();
  let storedKey = null;
  let storedSalt = null;

  if (db && typeof db.getAuthSetting === 'function') {
    try {
      storedKey = await db.getAuthSetting(KEY_STORAGE_KEY);
      storedSalt = await db.getAuthSetting(KEY_SALT_KEY);
    } catch {
      // Ігноруємо помилки доступу до сховища при ініціалізації
    }
  }

  if (storedKey) {
    cachedKeyHex = storedKey;
    return storedKey;
  }

  // Якщо ключ ще не створений — створюємо новий
  let newKeyHex;
  if (optionalPin) {
    const derived = deriveKeyFromPin(optionalPin, storedSalt);
    newKeyHex = derived.keyHex;
    if (db && typeof db.setAuthSetting === 'function') {
      await db.setAuthSetting(KEY_SALT_KEY, derived.saltHex);
    }
  } else {
    newKeyHex = generateKey();
  }

  if (db && typeof db.setAuthSetting === 'function') {
    await db.setAuthSetting(KEY_STORAGE_KEY, newKeyHex);
  }

  cachedKeyHex = newKeyHex;
  return newKeyHex;
}

/**
 * Встановлення або зміна активного ключа (наприклад, при зміні PIN)
 */
export async function setMasterKey(newKeyHex, newSaltHex = null) {
  cachedKeyHex = newKeyHex;
  const db = getDbClient();
  if (db && typeof db.setAuthSetting === 'function') {
    await db.setAuthSetting(KEY_STORAGE_KEY, newKeyHex);
    if (newSaltHex) {
      await db.setAuthSetting(KEY_SALT_KEY, newSaltHex);
    }
  }
}

/**
 * Перевірка, чи рядок є зашифрованим шифротекстом
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(CIPHER_PREFIX);
}

/**
 * Перевірка статусу шифрування (за замовчуванням увімкнено)
 */
export async function isEncryptionEnabled() {
  const db = getDbClient();
  if (!db || typeof db.getAuthSetting !== 'function') {
    return true;
  }
  try {
    const val = await db.getAuthSetting(ENCRYPTION_ENABLED_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Увімкнення або вимкнення шифрування даних
 */
export async function setEncryptionEnabled(enabled) {
  const db = getDbClient();
  if (db && typeof db.setAuthSetting === 'function') {
    await db.setAuthSetting(ENCRYPTION_ENABLED_KEY, enabled ? 'true' : 'false');
  }
}

/**
 * Автентифіковане шифрування тексту розділу (AES-256-GCM)
 *
 * @param {string} plainText — Відкритий HTML/Rich Text контент
 * @param {string} [optionalKeyHex] — 256-бітний ключ у форматі HEX
 * @returns {Promise<string>} Зашифрований конверт у форматі ENC:v1:AES-256-GCM:<iv>:<ct>:<tag>
 */
export async function encryptChapterContent(plainText, optionalKeyHex = null) {
  if (plainText === null || plainText === undefined) {
    return plainText;
  }

  const enabled = await isEncryptionEnabled();
  if (!enabled) {
    return plainText;
  }

  const keyHex = optionalKeyHex || (await getMasterKey());
  const keyBytes = hexToBytes(keyHex);

  // ГЕНЕРАЦІЯ УНІКАЛЬНОГО 96-БІТНОГО IV ДЛЯ КОЖНОЇ ОПЕРАЦІЇ (Критично проти Nonce Reuse!)
  const ivBytes = generateRandomBytes(IV_LENGTH_BYTES);

  // Створення шифратора AES-256-GCM через node-forge
  const cipher = forge.cipher.createCipher('AES-GCM', keyBytes);
  cipher.start({
    iv: ivBytes,
    tagLength: TAG_LENGTH_BITS,
  });

  cipher.update(forge.util.createBuffer(plainText, 'utf8'));
  cipher.finish();

  const ciphertextBytes = cipher.output.getBytes();
  const tagBytes = cipher.mode.tag.getBytes();

  const ivHex = bytesToHex(ivBytes);
  const ciphertextHex = bytesToHex(ciphertextBytes);
  const tagHex = bytesToHex(tagBytes);

  return `${CIPHER_PREFIX}${ivHex}:${ciphertextHex}:${tagHex}`;
}

/**
 * Дешифрування вмісту розділу з обов'язковою верифікацією мітки автентичності
 *
 * @param {string} cipherString — Зашифрований або відкритий текст
 * @param {string} [optionalKeyHex] — 256-бітний ключ у форматі HEX
 * @returns {Promise<string>} Розшифрований відкритий HTML-текст
 * @throws {Error} "Integrity check failed: data tampered" при пошкодженні або підробці
 */
export async function decryptChapterContent(cipherString, optionalKeyHex = null) {
  if (!cipherString || typeof cipherString !== 'string') {
    return cipherString;
  }

  // Якщо текст не зашифрований (наприклад, створений до активації шифрування), повертаємо як є
  if (!isEncrypted(cipherString)) {
    return cipherString;
  }

  const rawPayload = cipherString.substring(CIPHER_PREFIX.length);
  const parts = rawPayload.split(':');

  if (parts.length !== 3) {
    throw new Error('Integrity check failed: data tampered');
  }

  const [ivHex, ciphertextHex, tagHex] = parts;

  if (!ivHex || !ciphertextHex || !tagHex) {
    throw new Error('Integrity check failed: data tampered');
  }

  const keyHex = optionalKeyHex || (await getMasterKey());
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);
  const tagBytes = hexToBytes(tagHex);

  const decipher = forge.cipher.createDecipher('AES-GCM', keyBytes);
  decipher.start({
    iv: ivBytes,
    tagLength: TAG_LENGTH_BITS,
    tag: forge.util.createBuffer(tagBytes),
  });

  decipher.update(forge.util.createBuffer(ciphertextBytes));
  const isValid = decipher.finish();

  // ОБОВ'ЯЗКОВА ПЕРЕВІРКА ЦІЛІСНОСТІ ТА АВТЕНТИЧНОСТІ МІТКИ (Auth Tag)
  if (!isValid) {
    throw new Error('Integrity check failed: data tampered');
  }

  return decipher.output.toString('utf8');
}

/**
 * Ротація ключа шифрування
 */
export async function rotateKey(newPin = null) {
  let newKeyHex;
  let newSaltHex = null;

  if (newPin) {
    const derived = deriveKeyFromPin(newPin);
    newKeyHex = derived.keyHex;
    newSaltHex = derived.saltHex;
  } else {
    newKeyHex = generateKey();
  }

  await setMasterKey(newKeyHex, newSaltHex);
  return newKeyHex;
}

export const cryptoService = {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  generateKey,
  deriveKeyFromPin,
  getMasterKey,
  setMasterKey,
  isEncrypted,
  isEncryptionEnabled,
  setEncryptionEnabled,
  encryptChapterContent,
  decryptChapterContent,
  rotateKey,
};
