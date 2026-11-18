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
├── test_license_integrity.js # Тести MDC SHA-256, підпису ліцензії та Freemium (ЛР №5)
├── lab5_obfuscation_test.js # Дослідження обфускації коду (ЛР №5)
├── test_client_server.js   # Тести серверної авторизації, JWT, IDOR, RBAC, ротації токенів та клієнта (ЛР №6)
├── test_logging_monitoring.js # Тести логування, санітизації, ротації, метрик і виявлення брутфорсу (ЛР №7-8)
├── server/                 # API-прототип (ЛР №6) та журналювання (ЛР №7-8)
│   ├── apiServer.js        # Node http-сервер: /api/auth/*, /api/sync/books, /api/export/docx-cloud, /api/admin/metrics
│   └── logger.js           # Структурований JSON-журнал (санітизація, ротація) та монітор аномалій
├── scripts/                # Резервне копіювання та аварійне відновлення (ЛР №7-8)
│   ├── backupManager.js    # CLI: backup / restore <шлях> / prune <N> (SHA-256 маніфест)
│   └── dr_simulation.js    # Демонстрація DR: backup → інцидент → restore → підтвердження
├── logs/                   # security.log (JSON Lines) та архіви ротації (створюється автоматично, у .gitignore)
├── backups/                # backup_<timestamp>/ (створюється автоматично, у .gitignore)
├── tools/                  # Dev-утиліти (sign_demo_license.js — видача демо-ліцензії без збереження приватного ключа)
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
    ├── services/           # Сервіси (cryptoService.js, authService.js, bookExport.js, licenseIntegrityService.js, apiClient.js — HTTP-клієнт з Bearer/refresh)
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
   node lab5_obfuscation_test.js
   node test_license_integrity.js
   node test_client_server.js
   node test_logging_monitoring.js
   ```

4. Логування, моніторинг та резервне копіювання (ЛР №7-8):
   ```bash
   # Тести логування, санітизації, ротації, метрик і детектора брутфорсу
   node test_logging_monitoring.js

   # Запуск API-сервера: журнал у logs/security.log (JSON Lines) і в консоль
   node server/apiServer.js
   # Метрики (лише роль ADMIN; демо-користувач admin / admin-pass-1):
   #   POST /api/auth/login -> access_token, далі
   #   GET  /api/admin/metrics   (Authorization: Bearer <access_token>)
   # Знайти всі записи одного запиту за ідентифікатором із заголовка X-Request-Id:
   #   grep <requestId> logs/security.log

   # Резервна копія (data/, app.json, package*.json, logs/security.log) -> backups/backup_<timestamp>/
   node scripts/backupManager.js backup
   # Відновлення: спершу перевірка SHA-256 за manifest.json; при невідповідності — аварійна зупинка (код 2)
   node scripts/backupManager.js restore backups/backup_<timestamp>
   # Залишити 14 найновіших копій
   node scripts/backupManager.js prune 14

   # Повна демонстрація аварійного відновлення в ізольованій пісочниці (реальні дані не зачіпаються)
   node scripts/dr_simulation.js
   ```
   Змінні середовища: `LOG_DIR` (каталог журналів), `WE_ROOT` (корінь проєкту для backupManager), `WE_BACKUP_DIR` (каталог копій).
   Робочу SQLite-базу (`writer-editor.db`) слід експортувати з пристрою у `data/writer-editor.db` перед копіюванням.

5. Запустити мобільний застосунок через Expo:
   ```bash
   npx expo start
   ```

6. Відкрити додаток:
   - `a` — в Android-емуляторі
   - `w` — у веб-браузері
   - або відсканувати QR-код у додатку Expo Go на смартфоні

