# Writer Editor — мобільний застосунок для письменників

**Writer Editor** — це автономний мобільний застосунок для письменників/письменниць та авторів/авторок текстів, розроблений на базі React Native та Expo. Застосунок призначений для зручного створення книги, редагування розділів у форматованому вигляді (Rich Text), підрахунку статистики слів і символів та експорту готових матеріалів у формати `.docx` і `.txt`.

---

## Технологічний стек

- **Фреймворк:** React Native (Expo SDK)
- **Мова:** JavaScript
- **База даних:** Expo SQLite (локальне збереження даних)
- **Файлові сервіси:** Expo FileSystem, Expo Sharing, JSZip
- **Навігація:** React Navigation (Native Stack)
- **Редактор тексту:** react-native-pell-rich-editor

---

## Структура проєкту та документація

У папці `docs/` розміщено комплект документації, підготовлений для проєкту:

- **[docs/requirements-spec-29148.md](docs/requirements-spec-29148.md)** — Специфікація вимог до програмного забезпечення за стандартом ISO/IEC/IEEE 29148:2018.
- **[docs/architecture-spec-42010.md](docs/architecture-spec-42010.md)** — Архітектурний опис системи за стандартом ISO/IEC/IEEE 42010:2022.
- **[docs/business_logic.md](docs/business_logic.md)** — Опис бізнес-логіки, сутностей та сценаріїв використання.
- **[docs/project-policy.md](docs/project-policy.md)** — Політика проєкту та правила безпечної розробки.
- **[docs/threat-model.md](docs/threat-model.md)** — Модель загроз безпеки за методологією STRIDE.

```
.
├── App.js                  # Головний файл додатку
├── app.json                # Конфігурація Expo
├── package.json            # Залежності проєкту
├── docs/                   # Документація
│   ├── architecture-spec-42010.md
│   ├── business_logic.md
│   ├── project-policy.md
│   ├── requirements-spec-29148.md
│   └── threat-model.md
└── src/                    # Вихідний код
    ├── components/         # UI-компоненти
    ├── constants/          # Маршрути та константи
    ├── database/           # Модуль роботи з SQLite (client.js)
    ├── hooks/              # Хуки React
    ├── localization/        # Локалізація (uk, en)
    ├── navigation/         # Навігація
    ├── screens/            # Екрани додатку
    ├── services/           # Сервіси експорту
    └── theme/              # Теми та стилі
```

---

## Інструкція із запуску

### Передумови
На комп'ютері має бути встановлено Node.js (версія 18+).

### Кроки запуску:

1. Клонувати репозиторій та перейти в папку проєкту:
   ```bash
   git clone <url-репозиторію>
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
