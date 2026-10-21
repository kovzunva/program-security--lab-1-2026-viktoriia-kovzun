const crypto = require('crypto');
const bcrypt = require('bcryptjs');

console.log("=== ЧАСТИНА 1. ДОСЛІДЖЕННЯ ЛІМІТУ BCRYPT (72 БАЙТИ) ===\n");

// 1. Формуємо базовий рядок за шаблоном: 2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:06_
const baseText = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:06_";
let baseBuffer = Buffer.from(baseText, 'utf-8');

console.log(`Початковий рядок: "${baseText}"`);
console.log(`Початковий розмір в UTF-8: ${baseBuffer.length} байт`);

// Доповнюємо символами '_' до рівно 72 байт
const paddingCount = 72 - baseBuffer.length;
const row1 = baseText + "_".repeat(Math.max(0, paddingCount));
const row1Buffer = Buffer.from(row1, 'utf-8');

console.log(`\nРядок 1 (доведений до 72 байт): "${row1}"`);
console.log(`Розмір Рядка 1: ${row1Buffer.length} байт`);

// Формуємо модифіковані рядки
const row2 = row1 + "1";                        // +1 символ (73 байти)
const row3 = row1 + "aB3$kL9#zQ";              // +10 символів (82 байти)
const row4 = row1.slice(0, -1);                 // -1 символ (71 байт)

console.log(`Розмір Рядка 2 (+1 симв.): ${Buffer.from(row2, 'utf-8').length} байт`);
console.log(`Розмір Рядка 3 (+10 симв.): ${Buffer.from(row3, 'utf-8').length} байт`);
console.log(`Розмір Рядка 4 (-1 симв.): ${Buffer.from(row4, 'utf-8').length} байт`);

// Генеруємо хеші bcrypt (rounds = 10)
const salt = bcrypt.genSaltSync(10);
const hash1 = bcrypt.hashSync(row1, salt);
const hash2 = bcrypt.hashSync(row2, salt);
const hash3 = bcrypt.hashSync(row3, salt);
const hash4 = bcrypt.hashSync(row4, salt);

console.log(`\nХеш №1 (з Рядка 1): ${hash1}`);
console.log(`Хеш №2 (з Рядка 2): ${hash2}`);
console.log(`Хеш №3 (з Рядка 3): ${hash3}`);
console.log(`Хеш №4 (з Рядка 4): ${hash4}`);

console.log("\n--- ПЕРЕВІРКА ПОРІВНЯННЯ bcrypt.compareSync (Рядки проти Хешу №1) ---");
console.log(`Хеш №1 vs Рядок 1 (72 байти): ${bcrypt.compareSync(row1, hash1)}`);
console.log(`Хеш №1 vs Рядок 2 (73 байти): ${bcrypt.compareSync(row2, hash1)}`);
console.log(`Хеш №1 vs Рядок 3 (82 байти): ${bcrypt.compareSync(row3, hash1)}`);
console.log(`Хеш №1 vs Рядок 4 (71 байт):  ${bcrypt.compareSync(row4, hash1)}`);


console.log("\n\n=== ЧАСТИНА 2. БРУТФОРС: SHA-256 ПРОТИ BCRYPT ===\n");

// Створюємо рядок формату: pass: [прізвище]
const targetPassword = "pass: Ковзун";
console.log(`Цільовий рядок: "${targetPassword}"`);

// Хеш №5: SHA-256
const hash5 = crypto.createHash('sha256').update(targetPassword, 'utf8').digest('hex');
console.log(`Хеш №5 (SHA-256): ${hash5}`);

// Хеш №6: bcrypt з 12 раундами
console.log("Генерація Хешу №6 (bcrypt 12 раундів)... зачекайте пару секунд...");
const salt12 = bcrypt.genSaltSync(12);
const hash6 = bcrypt.hashSync(targetPassword, salt12);
console.log(`Хеш №6 (bcrypt cost 12): ${hash6}`);

// Словник із 20 слів, де правильний пароль на останній 20-й позиції
const dictionary = [
    "pass: Shevchenko", "pass: Bondarenko", "pass: Boyko", "pass: Tkachenko",
    "pass: Kravchenko", "pass: Oliynyk", "pass: Shevchuk", "pass: Polishchuk",
    "pass: Lysenko", "pass: Melnyk", "pass: Moroz", "pass: Marchenko",
    "pass: Pavlenko", "pass: Savchenko", "pass: Rudenko", "pass: Petrenko",
    "pass: Sydorenko", "pass: Khomenko", "pass: Dmytruk", targetPassword
];

// --- Атака на SHA-256 ---
console.log("\nЗапуск атаки за словником на SHA-256 (Хеш №5)...");
const startSha = process.hrtime.bigint(); // Замір часу

let foundSha = null;
for (let i = 0; i < dictionary.length; i++) {
    const candidateHash = crypto.createHash('sha256').update(dictionary[i], 'utf8').digest('hex');
    if (candidateHash === hash5) {
        foundSha = dictionary[i];
        break;
    }
}
const endSha = process.hrtime.bigint();
const durationShaMicroseconds = Number(endSha - startSha) / 1000; // конвертуємо у мікросекунди

console.log(`Знайдено: "${foundSha}"`);
console.log(`Час виконання для SHA-256: ${durationShaMicroseconds.toFixed(2)} мкс (${(durationShaMicroseconds / 1000).toFixed(4)} мс)`);

// --- Атака на bcrypt ---
console.log("\nЗапуск атаки за словником на bcrypt (Хеш №6)...");
console.log("Це триватиме орієнтовно 4-8 секунд, перевіряються 20 кандидатів...");
const startBcrypt = process.hrtime.bigint();

let foundBcrypt = null;
for (let i = 0; i < dictionary.length; i++) {
    if (bcrypt.compareSync(dictionary[i], hash6)) {
        foundBcrypt = dictionary[i];
        break;
    }
}
const endBcrypt = process.hrtime.bigint();
const durationBcryptMicroseconds = Number(endBcrypt - startBcrypt) / 1000;

console.log(`Знайдено: "${foundBcrypt}"`);
console.log(`Час виконання для bcrypt: ${durationBcryptMicroseconds.toFixed(2)} мкс (${(durationBcryptMicroseconds / 1000000).toFixed(2)} с)`);

console.log("\n=== РОЗРАХУНОК СПІВВІДНОШЕННЯ ШВИДКОСТЕЙ ===");
const ratio = durationBcryptMicroseconds / durationShaMicroseconds;
console.log(`bcrypt виявився повільнішим за SHA-256 у ${ratio.toFixed(0)} разів!`);