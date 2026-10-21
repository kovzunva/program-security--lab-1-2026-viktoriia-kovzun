const crypto = require('crypto');

console.log("=== ЧАСТИНА 1. КЛАСИЧНА КРИПТОГРАФІЯ ===\n");

// Пункт 2: Формування початкового рядка
const originalText = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:06_";
console.log(`Початковий відкритий текст (P1): "${originalText}"`);

// Пункт 3: Шифр Цезаря для українського алфавіту та латини/цифр (зсув +3)
function caesarCipher(text, shift = 3) {
    const ukrAlphabetLower = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя";
    const ukrAlphabetUpper = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ";
    const enLower = "abcdefghijklmnopqrstuvwxyz";
    const enUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";

    return text.split('').map(char => {
        if (ukrAlphabetLower.includes(char)) {
            const idx = ukrAlphabetLower.indexOf(char);
            return ukrAlphabetLower[(idx + shift) % ukrAlphabetLower.length];
        } else if (ukrAlphabetUpper.includes(char)) {
            const idx = ukrAlphabetUpper.indexOf(char);
            return ukrAlphabetUpper[(idx + shift) % ukrAlphabetUpper.length];
        } else if (enLower.includes(char)) {
            const idx = enLower.indexOf(char);
            return enLower[(idx + shift) % enLower.length];
        } else if (enUpper.includes(char)) {
            const idx = enUpper.indexOf(char);
            return enUpper[(idx + shift) % enUpper.length];
        } else if (digits.includes(char)) {
            const idx = digits.indexOf(char);
            return digits[(idx + shift) % digits.length];
        }
        return char; // розділові знаки залишаються
    }).join('');
}

const caesarEncrypted = caesarCipher(originalText, 3);
console.log(`\nШифротекст (Шифр Цезаря, зсув +3): "${caesarEncrypted}"`);

// Пункт 4: Шифр перестановки (стовпчикова перестановка з фіксованим ключем розміром 4)
function columnarTransposition(text, numCols = 4) {
    const chars = Array.from(text);
    let result = '';
    for (let col = 0; col < numCols; col++) {
        for (let i = col; i < chars.length; i += numCols) {
            result += chars[i];
        }
    }
    return result;
}

const transpositionEncrypted = columnarTransposition(originalText, 4);
console.log(`Шифротекст (Шифр перестановки, 4 стовпці): "${transpositionEncrypted}"`);


console.log("\n\n=== ЧАСТИНА 2. АТАКА НА РЕЖИМ AES-CTR (пункти 6-8) ===\n");

// Пункт 6: Генерація випадкового ключа та вектора ініціалізації (IV / Nonce)
const key = crypto.randomBytes(16); // 128-бітний ключ (Ключ №1)
const iv = crypto.randomBytes(16);  // 128-бітний IV (Вектор №1)

console.log(`Ключ №1 (HEX):   ${key.toString('hex')}`);
console.log(`Вектор №1 (HEX): ${iv.toString('hex')}`);

// Допоміжна функція шифрування AES-128-CTR
function encryptAES_CTR(plainTextBuffer, k, initialVector) {
    const cipher = crypto.createCipheriv('aes-128-ctr', k, initialVector);
    return Buffer.concat([cipher.update(plainTextBuffer), cipher.final()]);
}

// Допоміжна функція розшифрування AES-128-CTR
function decryptAES_CTR(cipherTextBuffer, k, initialVector) {
    const decipher = crypto.createDecipheriv('aes-128-ctr', k, initialVector);
    return Buffer.concat([decipher.update(cipherTextBuffer), decipher.final()]);
}

// Початковий буфер у кодуванні UTF-8
const p1Buffer = Buffer.from(originalText, 'utf8');

// Отримуємо Шифротекст №1
const c1Buffer = encryptAES_CTR(p1Buffer, key, iv);
console.log(`\nШифротекст №1 (HEX): ${c1Buffer.toString('hex')}`);

// Пункт 7: Імітація атаки відомого відкритого тексту
console.log("\n--- ІМІТАЦІЯ АТАКИ ЗЛОВМИСНИКА (без знання Ключа №1) ---");

// 7.2. Знаходження Гами: Гама = C1 XOR P1
function xorBuffers(bufA, bufB) {
    const length = Math.min(bufA.length, bufB.length);
    const result = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
        result[i] = bufA[i] ^ bufB[i];
    }
    return result;
}

const recoveredKeystream = xorBuffers(c1Buffer, p1Buffer);
console.log(`Гама №1 (відновлена через C1 XOR P1) (HEX): ${recoveredKeystream.toString('hex')}`);

// 7.3. Формування альтернативного тексту із заміною варіанту на "99"
const alternativeText = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:99_";
const p2Buffer = Buffer.from(alternativeText, 'utf8');
console.log(`\nАльтернативний відкритий текст (P2): "${alternativeText}"`);

// 7.4. Створення підробленого Шифротексту №2: C2 = P2 XOR Гама №1
const c2Buffer = xorBuffers(p2Buffer, recoveredKeystream);
console.log(`Шифротекст №2 (підроблений) (HEX):         ${c2Buffer.toString('hex')}`);

// Пункт 8: Перевірка легітимним розшифруванням жертви
console.log("\n--- ПЕРЕВІРКА: РОЗШИФРУВАННЯ ЖЕРТВОЮ ЛЕГІТИМНИМ КЛЮЧЕМ №1 ТА ВЕКТОРОМ №1 ---");
const decryptedBuffer = decryptAES_CTR(c2Buffer, key, iv);
const decryptedText = decryptedBuffer.toString('utf8');

console.log(`Результат розшифрування Шифротексту №2: "${decryptedText}"`);

if (decryptedText === alternativeText) {
    console.log("\n[УСПІХ АТАКИ]: Отримано сфальсифікований текст без помилок та без знання Ключа №1!");
} else {
    console.log("\n[ПОМИЛКА]: Тексти не співпали.");
}