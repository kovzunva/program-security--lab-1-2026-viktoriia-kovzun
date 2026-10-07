# Threat Model — Writer Editor

| | |
| --- | --- |
| Назва | Модель загроз — Writer Editor (Mobile App) |
| Версія | 0.1.0 |
| Статус | Active / Draft |
| Останнє оновлення | 2026-10-07 |
| Власник | Розробниця / Lead Developer |
| Пов'язані документи | `docs/architecture-spec-42010.md`, `docs/project-policy.md`, `docs/requirements-spec-29148.md`, `docs/privacy-policy.md` |

## Scope

Модель загроз охоплює клієнтський мобільний застосунок **Writer Editor** (React Native, Expo SDK), включаючи:
- Графічний інтерфейс користувача (UI-екрани `LibraryScreen`, `BookDetailsScreen`, `EditorScreen`, `BookStatsScreen`, `SettingsScreen`).
- Модуль візуального Rich Text редактора на базі WebView (`react-native-pell-rich-editor`).
- Сервіс доступу до даних (Data Access Layer — `src/database/client.js`).
- Локальну реляційну базу даних SQLite (`writer-editor.db`).
- Сервіси генерації та експорту документів (`bookExport.js`, збірка OpenXML через `JSZip`).
- Локальне кеш-сховище пристрою (`cacheDirectory`, `documentDirectory`).
- Взаємодію з нативними модулями ОС для поширення файлів (`Expo Sharing`) та вибору обкладинки (`Expo ImagePicker`).

**Поза межами моделі:**
- Фізична безпека мобільного пристрою та операційної системи (Android OS / iOS Security Kernel).
- Безпека та внутрішня реалізація зовнішніх застосунків (поштові клієнти, месенджери, хмарні диски), у які користувач відправляє експортовані файли через системний `Share Sheet`.
- Інфраструктура npm-реєстру (припускається використання перевіреного локального середовища з зафіксованим `package-lock.json`).

---

## System Overview

Застосунок **Writer Editor** є автономним оффлайн-редактором книг. Усі дані користувача обробляються та зберігаються локально.

Для побудови моделі загроз використовується діаграма потоків даних (Data Flow Diagram, DFD), яка описує рух інформації між компонентами системи, місця обробки й збереження даних та межі довіри.

У цій моделі використовуються наступні типи елементів DFD:
- **External Interactor** — зовнішній користувач або зовнішній застосунок;
- **Process** — програмний модуль, що виконує обробку даних;
- **Data Store** — локальне сховище даних;
- **Data Flow** — потік передавання даних між елементами;
- **Trust Boundary** — межа між областями з різним рівнем довіри.

### Елементи системи (DFD Elements)

| ID | DFD Type | Name |
| --- | --- | --- |
| E1 | External Interactor | User / Author |
| E2 | External Interactor | External Target App (Messenger, Email, Cloud Storage) |
| P1 | Process | React Native UI & Navigation (Screens & Components) |
| P2 | Process | Rich Text Editor / WebView (`react-native-pell-rich-editor`) |
| P3 | Process | Export Service (`bookExport.js` + `JSZip`) |
| P4 | Process | Data Access Layer (`src/database/client.js`) |
| D1 | Data Store | SQLite Database (`writer-editor.db`) |
| D2 | Data Store | Local App Sandbox Storage (`cacheDirectory` / `documentDirectory`) |
| F1 | Data Flow | User Input -> UI (`E1 -> P1`) |
| F2 | Data Flow | UI -> Rich Text Editor (`P1 -> P2`) |
| F3 | Data Flow | Rich Text Editor -> UI (`P2 -> P1`) |
| F4 | Data Flow | UI -> Data Access Layer (`P1 -> P4`) |
| F5 | Data Flow | Data Access Layer -> SQLite Database (`P4 -> D1`) |
| F6 | Data Flow | UI -> Export Service (`P1 -> P3`) |
| F7 | Data Flow | Export Service -> Local App Storage (`P3 -> D2`) |
| F8 | Data Flow | Local App Storage -> External Target App (`D2 -> E2`) |
| TB1 | Trust Boundary | Untrusted User Input Boundary |
| TB2 | Trust Boundary | WebView Sandbox Boundary |
| TB3 | Trust Boundary | App Sandbox Boundary |
| TB4 | Trust Boundary | External OS Share Boundary |

### Зв'язки між елементами системи

- `E1 User` взаємодіє з `P1 React Native UI` через потік `F1 User Input -> UI` (перетинає `TB1 Untrusted User Input Boundary`).
- `P1 React Native UI` передає вхідний HTML/текст у `P2 Rich Text Editor` через `F2 UI -> Rich Text Editor`.
- `P2 Rich Text Editor` повертає відредагований HTML-вміст до `P1 React Native UI` через `F3 Rich Text Editor -> UI` (перетинає `TB2 WebView Sandbox Boundary`).
- `P1 React Native UI` викликає `P4 Data Access Layer` через `F4 UI -> Data Access Layer`.
- `P4 Data Access Layer` виконує параметризовані SQL-запити в `D1 SQLite Database` через `F5 Data Access Layer -> SQLite Database` (у межах `TB3 App Sandbox Boundary`).
- `P1 React Native UI` передає дані книги у `P3 Export Service` через `F6 UI -> Export Service`.
- `P3 Export Service` будує OpenXML `.docx` архів / `.txt` файл і записує в `D2 Local App Sandbox Storage` через `F7 Export Service -> Local App Storage`.
- `D2 Local App Sandbox Storage` передає файл до `E2 External Target App` через `F8 Local App Storage -> External Target App` (перетинає `TB4 External OS Share Boundary`).

---

## STRIDE Analysis

Канонічна відповідність STRIDE типам елементів DFD:

| DFD Element | S | T | R | I | D | E |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| External Interactor | ✓ |  | ✓ |  |  |  |
| Data Flow |  | ✓ |  | ✓ | ✓ |  |
| Data Store |  | ✓ |  | ✓ | ✓ |  |
| Process | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Позначення: **S** — Spoofing; **T** — Tampering; **R** — Repudiation; **I** — Information Disclosure; **D** — Denial of Service; **E** — Elevation of Privilege.

Для кожного елемента системи нижче заповнено релевантні категорії загроз з урахуванням специфіки мобільного оффлайн-застосунку Writer Editor.

### Аналіз загроз за елементами DFD

| Element | S | T | R | I | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| **E1 User** *(External Interactor)* | Зловмисник може отримати несанкціонований доступ до розблокованого пристрою та виконувати дії від імені автора книги. | - | Користувач може випадково видалити книгу або розділ та заперечувати власні дії за відсутності підтвердження операції. | - | - | - |
| **E2 External Target App** *(External Interactor)* | Шкідливий додаток на пристрої може підмінити собою цільовий застосунок у діалозі поширення ОС (`Expo Sharing`). | - | Зовнішній застосунок може не підтвердити факт успішного збереження або відправлення експортованого файлу. | - | - | - |
| **P1 React Native UI & Navigation** *(Process)* | Підміна стану екранів чи некоректний викликів навігатора через невалідні параметри маршруту. | Передача некоректних даних або спецсимволів через текстові поля назви книги, анотації чи розділу. | Відсутність підтвердження деструктивної дії (видалення) може дозволити заперечувати факт випадкового видалення. | Виведення системних стек-трейсів або чутливого текстового контенту у консоль журналу розробника. | Блокування UI-потоку (Main JS Thread) при синхронному підрахунку статистики слів у великих книгах. | Перехід до захищених чи непризначених екранів редагування у невідповідному стані об'єкта. |
| **P2 Rich Text Editor / WebView** *(Process)* | Ін'єкція сторонніх скриптів або вмісту через WebView контейнер. | XSS-впровадження шкідливого HTML/JS коду при вставці відформатованого тексту з зовнішніх джерел (буфера обміну). | Складність визначення моменту синхронізації тексту між WebView та локальним станом UI. | Витік контексту виконання JS WebView до ресурсів мобільного пристрою чи локальних файлів. | Виснаження оперативної пам'яті (OOM) або замирання WebView при завантаженні надвеликих HTML-документів. | Спроба виходу з обмеженого WebView у нативний шар додатка через незахищені мист-події. |
| **P3 Export Service (`bookExport.js`)** *(Process)* | Формування `.docx` або `.txt` файлу з підробленими метаданими чи авторством. | XML-ін'єкція у код OpenXML `.docx` через відсутність екранування спецсимволів (`<`, `>`, `&`, `"`, `'`), що призводить до пошкодження файлу Word. | Відсутність цифрового підпису чи перевірки цілісності згенерованого архіву `.docx`. | Витік тимчасових даних книги у незахищені загальнодоступні каталоги пристрою. | Переповнення пам'яті при збірці великих файлів `.docx` через `JSZip` для величезних книг. | Path Traversal атака: спроба впровадження символів `../` у назву книги для запису файла за межі каталогу `cacheDirectory`. |
| **P4 Data Access Layer (`client.js`)** *(Process)* | Виконання SQL-запитів від імені неналежного контексту бізнес-логіки. | SQL-ін'єкція при конкатенації текстових рядків у SQL-запитах замість використання параметризації. | Відсутність атомних транзакцій при масовому оновленні розділів чи каскадному видаленні. | Повернення з БД небажаних або пошкоджених даних при некоректній обробці null-значень. | Блокування бази даних SQLite через частоту викликів SQL `UPDATE` під час автозбереження без Debounce. | Виконання несанкціонованих системних команд SQLite через незахищені вхідні параметри. |
| **D1 SQLite Database (`writer-editor.db`)** *(Data Store)* | - | Несанкціонована модифікація або пошкодження структури файлу `.db` при збої системи або раптовому вимкненні. | - | Несанкціонований доступ сторонніх процесів до файлу БД (у разі компрометації рутованого/jailbroken пристрою). | Переповнення пам'яті диска або пошкодження WAL-журналу SQLite. | - |
| **D2 Local App Sandbox Storage (`cacheDirectory`)** *(Data Store)* | - | Модифікація тимчасового експортованого файлу сторонніми процесами до його відправлення через `Expo Sharing`. | - | Накопичення залишків конфіденційних `.docx`/`.txt` файлів у кеш-каталозі. | Переповнення виділеного обсягу кеш-пам'яті застарілими версіями експортованих файлів. | - |
| **F1 User Input -> UI** *(Data Flow)* | - | Введення спецсимволів та невалідних UTF-8 послідовностей у текстові поля. | - | Перехоплення вводу клавіатурою (сторонніми шкідливими клавіатурами на ОС). | Перевантаження подій вводу (Rapid Typing / Flood). | - |
| **F2 UI -> Rich Text Editor** *(Data Flow)* | - | Перекручення HTML-тегов при передачі тексту в WebView. | - | Витік вмісту через події місту WebView. | Переповнення каналу передачі даних між React Native та WebView. | - |
| **F3 Rich Text Editor -> UI** *(Data Flow)* | - | Повернення некоректно сформованого HTML-коду. | - | Перехоплення вмісту розділу в каналі зв'язку WebView. | Нескінченний цикл подій оновлення тексту. | - |
| **F4 UI -> Data Access Layer** *(Data Flow)* | - | Модифікація об'єкта книги чи розділу в пам'яті перед збереженням. | - | Витік даних при неконтрольованому виведенні в логи `console.log`. | Неконтрольований потік викликів збереження. | - |
| **F5 DAL -> SQLite Database** *(Data Flow)* | - | Спотворення даних при не збігу типів полів SQLite. | - | Перехоплення SQL-команд у журналі викликів. | Перевантаження дискових операцій I/O. | - |
| **F6 UI -> Export Service** *(Data Flow)* | - | Передача маніпульованої назви файлу з символами навігації файловою системою. | - | Витік даних книги в системний буфер або модальне вікно. | Передача гігантського обсягу даних для експорту. | - |
| **F7 Export Service -> Local Storage** *(Data Flow)* | - | Перезапис існуючих критичних системних файлів у разі помилки санітизації шляху. | - | Збереження тимчасового файла в доступній для інших додатків директорії. | Заповнення дискового простору. | - |
| **F8 Local Storage -> External App** *(Data Flow)* | - | Перехоплення та заміна файлу при передачі через системний Intent/Activity. | - | Витік конфіденційного документа неопублікованої книги неавторизованим застосункам. | Блокування діалогу поширення ОС. | - |

---

## Матриця контрзаходів (Mitigation Summary)

1. **Захист від SQL-ін'єкцій (T, E на P4, D1):** 
   Усі SQL-запити в `src/database/client.js` виконуються СТРОГО через параметризовані виклики з плейсхолдерами `?` (`db.runAsync(sql, [params])`).
2. **Захист від XML-ін'єкцій у DOCX (T на P3):** 
   Усі текстові значення (назва книги, текст розділів) перед вставкою у XML-шаблони OpenXML проганяються через функцію `escapeXml()`.
3. **Захист від Path Traversal (E, T на P3, F7):** 
   Назви файлів експорту санітизуються функцією `sanitizeFileName()`, яка видаляє спецсимволи ОС та елементи навігації `../`.
4. **Захист від DoS та перевантаження UI (D на P1, P4):** 
   Автозбереження тексту в редакторі реалізовано з затримкою Debounce (500 мс). Вмикається режим `PRAGMA journal_mode = WAL;` у SQLite.
5. **Захист від випадкового видалення (R на E1, P1):** 
   Усі деструктивні операції (видалення книги або розділу) вимагають підтвердження користувача у модальному вікні `ConfirmActionModal`.
6. **Захист конфіденційності даних (I на D2, F8):** 
   Тимчасові файли зберігаються в ізольованій пісочниці `cacheDirectory`, а виведення чутливих даних у виробничі логи заблоковане.
