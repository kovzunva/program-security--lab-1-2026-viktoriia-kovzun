# Writer Editor — мобільний застосунок для письменників

**Writer Editor** — це автономний мобільний застосунок для письменників/письменниць та авторів/авторок текстів, розроблений на базі React Native та Expo. Застосунок призначений для зручного створення книги, редагування розділів у форматованому вигляді (Rich Text), підрахунку статистики слів і символів та експорту готових матеріалів у формати `.docx` і `.txt`.

---

## Технологічний стек

- **Фреймворк:** React Native (Expo SDK)
- **Мова:** JavaScript
- **Автентифікація та криптографія:** bcryptjs (хешування PIN), expo-local-authentication (Touch ID / Face ID)
- **База даних:** Expo SQLite (локальне збереження даних, auth_settings, offline-first)
- **Файлові сервіси:** Expo FileSystem, Expo Sharing, JSZip
- **Навігація:** React Navigation (Native Stack)
- **Редактор тексту:** react-native-pell-rich-editor

---

## Структура проєкту та документація

У папці `docs/` розміщено комплект документації, підготовлений для проєкту:

- **[docs/requirements-spec-29148.md](docs/requirements-spec-29148.md)** — Специфікація вимог до програмного забезпечення за стандартом ISO/IEC/IEEE 29148:2018 (включаючи вимоги автентифікації та ABAC).
- **[docs/architecture-spec-42010.md](docs/architecture-spec-42010.md)** — Архітектурний опис системи за стандартом ISO/IEC/IEEE 42010:2022 (модель ролей RBAC/ABAC).
- **[docs/business_logic.md](docs/business_logic.md)** — Опис бізнес-логіки, сутностей та сценаріїв використання.
- **[docs/security-policy.md](docs/security-policy.md)** — Політика безпеки (Security Policy) та технічні заходи захисту даних.
- **[docs/privacy-policy.md](docs/privacy-policy.md)** — Політика конфіденційності (Privacy Policy).
- **[docs/project-policy.md](docs/project-policy.md)** — Загальна політика проєкту та правила безпечної розробки (правила хешування PIN).
- **[docs/threat-model.md](docs/threat-model.md)** — Модель загроз безпеки за методологією STRIDE (згідно з методологією та DFD-таблицями).

```
.
├── App.js                  # Головний файл додатку (керування авторизованим станом)
├── app.json                # Конфігурація Expo
├── package.json            # Залежності проєкту
├── docs/                   # Документація
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
    ├── database/           # Модуль роботи з SQLite (client.js, auth_settings, is_locked)
    ├── hooks/              # Хуки React
    ├── localization/        # Локалізація (uk, en, de)
    ├── navigation/         # Навігація (AppNavigator.js)
    ├── screens/            # Екрани додатку (LockScreen.js, SettingsScreen.js...)
    ├── services/           # Сервіси (authService.js, bookExport.js)
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

3. Запустити Expo:
   ```bash
   npx expo start
   ```

4. Запустити на пристрої чи емуляторі:
   - `a` — для запуску в Android-емуляторі
   - `w` — для запуску у веб-браузері
   - або відсканувати QR-код у додатку Expo Go на смартфоні
