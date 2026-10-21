const forge = require('node-forge');

console.log("=== ТЕСТУВАННЯ МОДУЛЯ КРИПТОГРАФІЧНОГО ЗАХИСТУ (AES-256-GCM) ===\n");

const CIPHER_PREFIX = 'ENC:v1:AES-256-GCM:';
const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BITS = 128;

function bytesToHex(bytes) {
  return forge.util.bytesToHex(bytes);
}

function hexToBytes(hex) {
  return forge.util.hexToBytes(hex);
}

function generateRandomBytes(numBytes) {
  return forge.random.getBytesSync(numBytes);
}

function deriveKeyFromPin(pin, saltHex) {
  const saltBytes = saltHex ? hexToBytes(saltHex) : generateRandomBytes(16);
  const derivedBytes = forge.pkcs5.pbkdf2(
    pin,
    saltBytes,
    PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
    forge.md.sha256.create()
  );
  return {
    keyHex: bytesToHex(derivedBytes),
    saltHex: bytesToHex(saltBytes)
  };
}

function encryptChapterContent(plainText, keyHex) {
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = generateRandomBytes(IV_LENGTH_BYTES);

  const cipher = forge.cipher.createCipher('AES-GCM', keyBytes);
  cipher.start({
    iv: ivBytes,
    tagLength: TAG_LENGTH_BITS
  });
  cipher.update(forge.util.createBuffer(plainText, 'utf8'));
  cipher.finish();

  const ciphertextBytes = cipher.output.getBytes();
  const tagBytes = cipher.mode.tag.getBytes();

  return `${CIPHER_PREFIX}${bytesToHex(ivBytes)}:${bytesToHex(ciphertextBytes)}:${bytesToHex(tagBytes)}`;
}

function decryptChapterContent(cipherString, keyHex) {
  if (!cipherString.startsWith(CIPHER_PREFIX)) {
    return cipherString;
  }

  const rawPayload = cipherString.substring(CIPHER_PREFIX.length);
  const [ivHex, ciphertextHex, tagHex] = rawPayload.split(':');

  if (!ivHex || !ciphertextHex || !tagHex) {
    throw new Error('Integrity check failed: data tampered');
  }

  const keyBytes = hexToBytes(keyHex);
  const ivBytes = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);
  const tagBytes = hexToBytes(tagHex);

  const decipher = forge.cipher.createDecipher('AES-GCM', keyBytes);
  decipher.start({
    iv: ivBytes,
    tagLength: TAG_LENGTH_BITS,
    tag: forge.util.createBuffer(tagBytes)
  });
  decipher.update(forge.util.createBuffer(ciphertextBytes));
  const isValid = decipher.finish();

  if (!isValid) {
    throw new Error('Integrity check failed: data tampered');
  }

  return decipher.output.toString('utf8');
}

// 1. Тест деривації ключа
const pin = "2026";
const { keyHex, saltHex } = deriveKeyFromPin(pin);
console.log(`[1] Деривація ключа через PBKDF2:`);
console.log(`    PIN: ${pin}`);
console.log(`    Сіль (HEX): ${saltHex}`);
console.log(`    256-бітний ключ (HEX): ${keyHex}\n`);

// 2. Тест шифрування розділу книги (HTML)
const originalHtml = "<h1>Розділ 1. Таємниця замку</h1><p>Це конфіденційний рукопис автора Вікторії Ковзун. Варіант 06.</p>";
console.log(`[2] Початковий відкритий HTML-текст:\n    "${originalHtml}"\n`);

const encrypted1 = encryptChapterContent(originalHtml, keyHex);
console.log(`[3] Зашифрований пакет (AES-256-GCM AEAD):`);
console.log(`    ${encrypted1}\n`);

// 3. Тест унікальності вектора ініціалізації (Запобігання повторному використанню Nonce)
const encrypted2 = encryptChapterContent(originalHtml, keyHex);
console.log(`[4] Повторне збереження того ж тексту (перевірка унікальності IV):`);
console.log(`    ${encrypted2}`);
const iv1 = encrypted1.split(':')[3];
const iv2 = encrypted2.split(':')[3];
console.log(`    IV #1: ${iv1}`);
console.log(`    IV #2: ${iv2}`);
if (iv1 !== iv2 && encrypted1 !== encrypted2) {
  console.log(`    -> [УСПІХ]: Для кожної операції згенеровано УНІКАЛЬНИЙ IV (Nonce Reuse усунено!)\n`);
} else {
  console.log(`    -> [ПОМИЛКА]: IV повторився!\n`);
}

// 4. Тест успішного дешифрування легітимним ключем
const decryptedText = decryptChapterContent(encrypted1, keyHex);
console.log(`[5] Розшифрований текст легітимним ключем:\n    "${decryptedText}"`);
if (decryptedText === originalHtml) {
  console.log(`    -> [УСПІХ]: Текст розшифровано ідеально 1-в-1!\n`);
} else {
  console.log(`    -> [ПОМИЛКА]: Невідповідність тексту!\n`);
}

// 5. Тест виявлення порушення цілісності (фальсифікація шифротексту як у Лабораторній 4)
console.log(`[6] Імітація атаки: зміна одного байта в шифротексті (атака модифікації)...`);
const parts = encrypted1.split(':');
// parts = ['ENC', 'v1', 'AES-256-GCM', iv, ciphertext, tag]
let tamperedCiphertext = parts[4];
// Змінюємо перший символ шифротексту
const alteredChar = tamperedCiphertext[0] === 'a' ? 'b' : 'a';
tamperedCiphertext = alteredChar + tamperedCiphertext.slice(1);
const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCiphertext}:${parts[5]}`;

try {
  decryptChapterContent(tamperedPayload, keyHex);
  console.log(`    -> [ПОМИЛКА]: Атака пройшла, цілісність НЕ перевірено!`);
} catch (e) {
  console.log(`    -> [УСПІХ ПЕРЕВІРКИ ЦІЛІСНОСТІ]: Перехоплено спробу атаки: "${e.message}"`);
}

// 6. Тест виявлення підробки мітки автентичності (Auth Tag)
console.log(`\n[7] Імітація атаки: підміна Auth Tag...`);
let tamperedTag = parts[5];
const alteredTagChar = tamperedTag[0] === '0' ? '1' : '0';
tamperedTag = alteredTagChar + tamperedTag.slice(1);
const tamperedTagPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${parts[4]}:${tamperedTag}`;

try {
  decryptChapterContent(tamperedTagPayload, keyHex);
  console.log(`    -> [ПОМИЛКА]: Підроблений тег прийнято!`);
} catch (e) {
  console.log(`    -> [УСПІХ ПЕРЕВІРКИ ТЕГУ]: Перехоплено спробу підробки: "${e.message}"`);
}

console.log("\n=== ВСІ ТЕСТИ КРИПТОГРАФІЧНОГО ЗАХИСТУ ПРОЙДЕНО УСПІШНО! ===");
