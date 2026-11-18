// === 1. ПОЧАТКОВА (ЧИСТА) ВЕРСІЯ ===
function checkLicenseClean(inputKey) {
    const secretKey = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:06_";
    if (inputKey === secretKey) {
        return "[ACCESS GRANTED] Ліцензійний ключ підтверджено.";
    }
    return "[ACCESS DENIED] Невірний ключ активації.";
}

// === 2. ОБФУСКОВАНА ВЕРСІЯ ===
// Обфускація:
// 1. Маскування констант через зсув та побітове XOR (0x2A)
// 2. Перейменування ідентифікаторів (_0x3c7d, _0x4f9c, _0x2d01)
// 3. Згладжування потоку керування (Control Flow Flattening) + непрозорий предикат
const _0x3c7d = [
    24, 26, 24, 28, 117, 1068, 1077, 1085, 1131, 7, 24, 30, 7, 27, 117, 1072, 1044, 1048, 1053, 1129, 1047, 117, 1080, 1148, 1040, 1128, 1044, 1130, 1148, 1125, 117, 1048, 1050, 1130, 1148, 1050, 1047, 1128, 16, 26, 28, 117
];

function _0x4f9c(_0x8b12) {
    let _0x2d01 = 0;
    let _0x7e4a = false;
    let _0x511c = "";
    const _0x1f3a = 0x2A; // XOR-маска (42)

    // Машина станів (Control Flow Flattening)
    while (_0x2d01 !== 4) {
        switch (_0x2d01) {
            case 0:
                // Непрозорий предикат (7 * 7 - 49 === 0 завжди true)
                if ((7 * 7 - 49) === 0) {
                    _0x511c = _0x3c7d.map(_0x6a90 => String.fromCharCode(_0x6a90 ^ _0x1f3a)).join('');
                    _0x2d01 = 1;
                } else {
                    _0x2d01 = 3; // мертва гілка (Dead Code)
                }
                break;
            case 1:
                // Посимвольне XOR-порівняння замість прямого ===
                if (_0x8b12.length !== _0x511c.length) {
                    _0x7e4a = false;
                    _0x2d01 = 2;
                } else {
                    let _0xaa10 = 0;
                    for (let _0xbb20 = 0; _0xbb20 < _0x511c.length; _0xbb20++) {
                        _0xaa10 |= (_0x8b12.charCodeAt(_0xbb20) ^ _0x511c.charCodeAt(_0xbb20));
                    }
                    _0x7e4a = (_0xaa10 === 0);
                    _0x2d01 = 2;
                }
                break;
            case 2:
                _0x2d01 = 4;
                break;
            case 3:
                _0x511c = "FAKE_KEY_TRAP";
                _0x2d01 = 4;
                break;
        }
    }

    return _0x7e4a
        ? ["[ACCESS", "GRANTED]", "Ліцензійний", "ключ", "підтверджено."].join(" ")
        : ["[ACCESS", "DENIED]", "Невірний", "ключ", "активації."].join(" ");
}

// === 3. ТЕСТОВИЙ ЗАПУСК І ПЕРЕВІРКА ТОТОЖНОСТІ ===
const validInput = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:06_";
const invalidInput = "2026_ІПЗс-24-1_Ковзун_Вікторія_варіант:99_";

console.log("=== ПЕРЕВІРКА ЧИСТОЇ ВЕРСІЇ ===");
console.log("Ввід (вірний):  ", checkLicenseClean(validInput));
console.log("Ввід (невірний):", checkLicenseClean(invalidInput));

console.log("\n=== ПЕРЕВІРКА ОБФУСКОВАНОЇ ВЕРСІЇ ===");
console.log("Ввід (вірний):  ", _0x4f9c(validInput));
console.log("Ввід (невірний):", _0x4f9c(invalidInput));