# ====== Writer Editor BUSINESS LOGIC ======

> Цей документ описує концептуальний зміст, бізнес-логіку, сутності, інваріанти та основні сценарії використання (Use Cases) мобільного застосунку **Writer Editor**. Документ розроблено як технічну специфікацію для подальшої реалізації додатку на фреймворку React Native / Expo.

## Purpose

Мобільний застосунок `Writer Editor` призначений для автономної роботи письменника/письменниці або автора/авторки текстів на смартфоні чи планшеті.

`Writer Editor` відповідатиме за:
- **Управління книгами:** створення книг, редагування їх метаданих (назва, опис, жанр, обкладинка) та перегляд списку збережених творів.
- **Роботу з розділами:** створення розділів у межах книги, редагування форматованого тексту (Rich Text), автозбереження та перейменування.
- **Підрахунок статистики:** розрахунок кількості слів (words_count) та символів (chars_count) для кожного розділу та книги в цілому.
- **Експорт готових матеріалів:** формування та експорт книг у формати `.docx` (Microsoft Word) та `.txt` (Plain Text) з використанням системного меню поширення ОС.
- **Кастомізацію інтерфейсу:** підтримка декількох мов (українська, англійська) та тем оформлення (світла/темна).

**НЕ входить у скоуп:**
- Серверна синхронізація чи збереження даних у хмарі (додаток працює 100% оффлайн).
- Спільне онлайн-редагування кількома користувачами.

---

## Entities

Збереження даних планується в реляційній локальній базі даних SQLite (`writer-editor.db`). Основні сутності та їх інваріанти:

| Entity | Basic Fields | Description | Invariants |
|---|---|---|---|
| `Book` *(Aggregate Root)* | `id`, `title`, `description`, `genre`, `cover_uri`, `created_at`, `updated_at` | Книга або літературний твір, що містить метадані та списки розділів. | - `id` — унікальний автоінкрементний первинний ключ.<br>- `title` не може бути порожнім (якщо не вказано, підставляється "Нова книга").<br>- Видалення `Book` каскадно видаляє всі її розділи `Chapter`. |
| `Chapter` *(Internal Entity)* | `id`, `book_id`, `title`, `body`, `sort_order`, `words_count`, `chars_count`, `updated_at` | Окремий розділ/глава книги з текстом та статистикою. | - `book_id` обов'язково посилається на існуючу книгу.<br>- `sort_order` >= 0 і задає порядок розділів.<br>- `words_count` та `chars_count` >= 0 і оновлюються при збереженні тексту. |
| `WritingSession` *(Internal Entity)* | `id`, `chapter_id`, `words_per_minute`, `words_written`, `started_at`, `ended_at` | Сесія роботи над текстом для аналізу продуктивності автора. | - `chapter_id` посилається на розділ.<br>- `started_at` обов'язково містить час початку сесії. |

---

## Екранний процес та навігація (Screen Flow)

Навігація будується на базі стекового навігатора React Navigation:

1. **Головний екран бібліотеки (`LibraryScreen`):**
   - Відображає список книг із пошуком.
   - Переходи: натискання на книгу -> `BookDetailsScreen`, кнопка (+) -> `BookMetaFormScreen` (режим створення), меню (⋮) -> `SettingsScreen` або `InfoScreen`.
2. **Деталі книги (`BookDetailsScreen`):**
   - Відображає обкладинку та метадані книги.
   - Переходи: кнопка "Редагувати" -> `BookMetaFormScreen`, "Розділи" -> `BookChaptersScreen`, "Статистика" -> `BookStatsScreen`, "Експорт" -> модальне вікно вибору формату.
3. **Форма метаданих книги (`BookMetaFormScreen`):**
   - Введення/зміна назви, опису, жанру та вибір обкладинки з галереї.
4. **Список розділів (`BookChaptersScreen`):**
   - Перелік розділів книги з можливістю додавання нового або перейменування.
   - Перехід: вибір розділу -> `EditorScreen`.
5. **Редактор тексту (`EditorScreen`):**
   - Rich Text редактор з панеллю форматування (жирний, курсив, закреслений) та автозбереженням.

---

## Value Objects та допоміжні контракти

| Value Object / Contract | Description | Invariants |
|---|---|---|
| `sanitizeFileName(name)` | Формує safe-ім'я файлу для експорту. | Замінює символи `\ / : * ? " < > |` на `_`. |
| `escapeXml(value)` | Екранує спецсимволи для XML-структури `.docx`. | Перетворює `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`, `"` -> `&quot;`, `'` -> `&apos;`. |
| `richHtmlToPlainText(html)` | Очищає HTML-теги для підрахунку слів та експорту в `.txt`. | Видаляє теги, перетворює `<br>`/`</p>` на переноси рядка `\n`. |
| `countWords(text)` | Підраховує кількість слів у тексті. | Розбиває рядок за пробілами `/\s+/`. |

---

## Політики та валідація

1. **Валідація назви книги:** Назва не може бути порожнім рядком під час збереження у формі створення/редагування.
2. **Автозбереження тексту (Debounce 500ms):** Внесені зміни в редакторі зберігаються в базу через 500 мс після завершення введення або при втраті фокусу.
3. **Безпека експорту:** Текст екранується від XML-ін'єкцій, а назва файла санітизується від небезпечних символів ОС.

---

## Основні сценарії використання (Use Cases)

- **`listBooks(searchText)`** — отримання списку книг з можливістю фільтрації за назвою.
- **`createBook(...)` / `updateBook(...)` / `deleteBook(id)`** — створення, оновлення метаданих та каскадне видалення книги.
- **`listChaptersByBookId(bookId)` / `createChapter(...)`** — отримання та додавання нових розділів.
- **`updateChapterContent(...)`** — збереження тексту розділу з перерахунком кількості слів і символів.
- **`exportBook(book, chapters, format)`** — генерація та відкриття діалогу поширення для файлів `.docx` та `.txt`.

---

## Запланована схема БД SQLite

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  cover_uri TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  words_count INTEGER DEFAULT 0,
  chars_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS writing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  words_per_minute REAL DEFAULT 0,
  words_written INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
```
