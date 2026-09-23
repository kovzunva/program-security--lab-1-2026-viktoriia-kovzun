import * as SQLite from 'expo-sqlite';

let dbPromise;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('writer-editor.db');
  }

  return dbPromise;
}

export async function initializeDatabase() {
  const db = await getDb();

  await db.execAsync(`
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
  `);
}

export async function listBooks(searchText = '') {
  const db = await getDb();
  const searchParam = `%${searchText.trim()}%`;

  return db.getAllAsync(
    `
      SELECT
        b.id,
        b.title,
        b.description,
        b.updated_at,
        COUNT(c.id) AS chapters_count,
        COALESCE(SUM(c.words_count), 0) AS words_count
      FROM books b
      LEFT JOIN chapters c ON c.book_id = b.id
      WHERE (? = '%%' OR LOWER(b.title) LIKE LOWER(?))
      GROUP BY b.id
      ORDER BY b.updated_at DESC
    `,
    searchParam,
    searchParam,
  );
}

export async function createBook(title, description = '', genre = '', coverUri = null) {
  const db = await getDb();
  const normalizedTitle = title.trim();
  const safeTitle = normalizedTitle || 'Нова книга';

  const result = await db.runAsync(
    `
      INSERT INTO books (title, description, genre, cover_uri, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    safeTitle,
    description,
    genre,
    coverUri || null,
  );

  return result.lastInsertRowId;
}

export async function listChaptersByBookId(bookId) {
  const db = await getDb();

  return db.getAllAsync(
    `
      SELECT
        id,
        book_id,
        title,
        body,
        words_count,
        chars_count,
        sort_order,
        updated_at
      FROM chapters
      WHERE book_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    bookId,
  );
}

export async function createChapter(bookId, title) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM chapters WHERE book_id = ?',
    bookId,
  );
  const nextSort = row?.next_sort ?? 0;

  const result = await db.runAsync(
    `
      INSERT INTO chapters (book_id, title, sort_order, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `,
    bookId,
    title,
    nextSort,
  );

  await db.runAsync('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', bookId);

  return result.lastInsertRowId;
}

export async function getChapterById(chapterId) {
  const db = await getDb();

  return db.getFirstAsync(
    `
      SELECT id, book_id, title, body, words_count, chars_count, updated_at
      FROM chapters
      WHERE id = ?
    `,
    chapterId,
  );
}

export async function updateChapterContent(chapterId, body, wordsCount, charsCount) {
  const db = await getDb();

  await db.runAsync(
    `
      UPDATE chapters
      SET body = ?, words_count = ?, chars_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    body,
    wordsCount,
    charsCount,
    chapterId,
  );

  await db.runAsync(
    `
      UPDATE books
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT book_id FROM chapters WHERE id = ?)
    `,
    chapterId,
  );
}

export async function ensureEditorChapter() {
  const db = await getDb();

  const existingChapter = await db.getFirstAsync('SELECT id FROM chapters ORDER BY updated_at DESC, id DESC LIMIT 1');
  if (existingChapter?.id) {
    return existingChapter.id;
  }

  const bookId = await createBook('Нова книга');
  const chapterId = await createChapter(bookId, 'Розділ 1');

  return chapterId ?? null;
}

export async function updateBook(bookId, title, description = '', genre = '', coverUri = null) {
  const db = await getDb();

  await db.runAsync(
    `
      UPDATE books
      SET title = ?, description = ?, genre = ?, cover_uri = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    title,
    description,
    genre,
    coverUri !== undefined ? coverUri : null,
    bookId,
  );
}

export async function deleteBook(bookId) {
  const db = await getDb();

  await db.runAsync('DELETE FROM books WHERE id = ?', bookId);
}

export async function getBookById(bookId) {
  const db = await getDb();

  return db.getFirstAsync(
    `
      SELECT
        id,
        title,
        description,
        genre,
        cover_uri,
        created_at,
        updated_at
      FROM books
      WHERE id = ?
    `,
    bookId,
  );
}

export async function updateChapterTitle(chapterId, title) {
  const db = await getDb();

  await db.runAsync(
    'UPDATE chapters SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    title,
    chapterId,
  );
}

export async function deleteChapter(chapterId) {
  const db = await getDb();

  const chapter = await db.getFirstAsync('SELECT book_id FROM chapters WHERE id = ?', chapterId);
  if (!chapter) {
    return;
  }

  await db.runAsync('DELETE FROM chapters WHERE id = ?', chapterId);
  await db.runAsync('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', chapter.book_id);
}

export async function getBookStats(bookId) {
  const db = await getDb();

  return db.getFirstAsync(
    `
      SELECT
        COUNT(id) AS chapters_count,
        COALESCE(SUM(words_count), 0) AS total_words,
        COALESCE(SUM(chars_count), 0) AS total_chars
      FROM chapters
      WHERE book_id = ?
    `,
    bookId,
  );
}

export async function deleteBookCover(bookId) {
  const db = await getDb();

  await db.runAsync(
    'UPDATE books SET cover_uri = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    bookId,
  );
}
