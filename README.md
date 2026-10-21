# Writer Editor — мобільний застосунок для письменників

**Writer Editor** — це автономний мобільний застосунок для письменників/письменниць та авторів/авторок текстів, розроблений на базі React Native та Expo. Застосунок призначений для зручного створення книги, редагування розділів у форматованому вигляді (Rich Text), підрахунку статистики слів і символів та експорту готових матеріалів у формати `.docx` і `.txt`.

---

## Технологічний стек

- **Фреймворк:** React Native (Expo SDK)
- **Мова:** JavaScript
- **Автентифікація та криптографія:**
  - **AEAD-шифрування розділів (Data-at-Rest):** AES-256-GCM (Galois/Counter Mode) з контролем цілісності через 128-бітний Auth Tag (`cryptoService.js`, `node-forge`)
  - **Генерація випадкових векторів:** 96-бітний унікальний Nonce/IV на кожну операцію збереження (CSPRNG, усунення вразливості Nonce Reuse)
  - **Управління ключами:** генерація 256-бітного симетричного ключа або деривація через PBKDF2 (HMAC-SHA256, 10 000+ ітерацій) на базі випадкової солі та PIN
  - **Хешування PIN:** `bcryptjs` (cost factor 10, захист від брутфорсу з тайм-аутом)
  - **Біометрія:** `expo-local-authentication` (Touch ID / Face ID)
- **База даних:** Expo SQLite (локальне збереження даних, прозоре шифрування, auth_settings, offline-first)
- **Файлові сервіси:** Expo FileSystem, Expo Sharing, JSZip
- **Навігація:** React Navigation (Native Stack)
- **Редактор тексту:** react-native-pell-rich-editor

---

## Структура проєкту та документація

У папці `docs/` розміщено комплект документації, підготовлений для проєкту:

- **[docs/requirements-spec-29148.md](docs/requirements-spec-29148.md)** — Специфікація вимог до програмного забезпечення за стандартом ISO/IEC/IEEE 29148:2018 (вимоги автентифікації, ABAC, Data-at-Rest Encryption та заборона Nonce Reuse).
- **[docs/architecture-spec-42010.md](docs/architecture-spec-42010.md)** — Архітектурний опис системи за стандартом ISO/IEC/IEEE 42010:2022 (Cryptographic Strategy, потік Presentation -> DAL -> cryptoService -> SQLite, формат `ENC:v1:AES-256-GCM:<IV>:<CT>:<TAG>` та життєвий цикл ключів).
- **[docs/business_logic.md](docs/business_logic.md)** — Опис бізнес-логіки, сутностей та сценаріїв використання.
- **[docs/security-policy.md](docs/security-policy.md)** — Політика безпеки (Security Policy) та технічні заходи захисту даних.
- **[docs/privacy-policy.md](docs/privacy-policy.md)** — Політика конфіденційності (Privacy Policy).
- **[docs/project-policy.md](docs/project-policy.md)** — Загальна політика проєкту та правила безпечної розробки (заборона ECB/неавтентифікованого CTR, виключення hardcoded ключів, ротація ключів).
- **[docs/threat-model.md](docs/threat-model.md)** — Модель загроз безпеки за методологією STRIDE (згідно з методологією та DFD-таблицями).

```
.
├── App.js                  # Головний файл додатку (керування авторизованим станом)
├── app.json                # Конфігурація Expo
├── package.json            # Залежності проєкту
├── lab3_crypto_test.js     # Дослідження ліміту bcrypt та стійкості проти SHA-256 (ЛР №3)
├── lab4_crypto_test.js     # Дослідження класичних шифрів та атака на AES-CTR при Nonce Reuse (ЛР №4)
├── test_crypto_service.js  # Верифікаційні тести модуля AEAD AES-256-GCM та контролю цілісності
├── docs/                   # Проєктна документація
│   ├── architecture-spec-42010.md
│   ├── business_logic.md
│   ├── privacy-policy.md
│   ├── project-policy.md
│   ├── requirements-spec-29148.md
│   ├── security-policy.md
│   └── threat-model.md
└── src/                    # Вихідний код
    ├── components/         # UI-компоненти
    ├── constants/          # Маршрути та константи
    ├── database/           # Модуль роботи з SQLite (client.js — прозоре AEAD-шифрування)
    ├── hooks/              # Хуки React
    ├── localization/       # Локалізація (uk, en, de)
    ├── navigation/         # Навігація (AppNavigator.js)
    ├── screens/            # Екрани додатку (EditorScreen.js, SettingsScreen.js...)
    ├── services/           # Сервіси (cryptoService.js, authService.js, bookExport.js)
    └── theme/              # Теми та стилі
```

---

## Інструкція із запуску

### Передумови
На комп'ютері має бути встановлено Node.js (версія 18+).

### Кроки запуску:

1. Клонувати репозиторій та перейти в папку проєкту:
   ```bash
   git clone git@github.com:kovzunva/program-security--lab-1-2026-viktoriia-kovzun.git
   cd lr
   ```

2. Встановити залежності:
   ```bash
   npm install
   ```

3. Запустити криптографічні тести:
   ```bash
   node lab4_crypto_test.js
   node test_crypto_service.js
   ```

4. Запустити мобільний застосунок через Expo:
   ```bash
   npx expo start
   ```

5. Відкрити додаток:
   - `a` — в Android-емуляторі
   - `w` — у веб-браузері
   - або відсканувати QR-код у додатку Expo Go на смартфоні

