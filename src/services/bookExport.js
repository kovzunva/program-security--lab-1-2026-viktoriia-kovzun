import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import JSZip from 'jszip';

function serializeError(error) {
  if (!error) {
    return { message: 'Unknown error' };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
  };
}

function sanitizeFileName(name) {
  return (name || 'book').replace(/[\\/:*?"<>|]/g, '_').trim() || 'book';
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}

function richHtmlToPlainText(html) {
  if (!html) {
    return '';
  }

  return decodeHtmlEntities(
    String(html)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function buildBookText(book, chapters) {
  const sections = [book.title || ''];

  if (book.description) {
    sections.push(richHtmlToPlainText(book.description));
  }

  chapters.forEach((chapter) => {
    sections.push(`${chapter.title || ''}\n${richHtmlToPlainText(chapter.body || '')}`);
  });

  return sections.join('\n\n');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textToRunsXml(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines
    .map((line, index) => {
      const escaped = escapeXml(line);
      const breakTag = index < lines.length - 1 ? '<w:br/>' : '';
      return `<w:r><w:t xml:space="preserve">${escaped}</w:t>${breakTag}</w:r>`;
    })
    .join('');
}

function richHtmlToParagraphsXml(html) {
  const plainText = richHtmlToPlainText(html);
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>';
  }

  return paragraphs
    .map((paragraph) => `<w:p>${textToRunsXml(paragraph)}</w:p>`)
    .join('');
}

async function buildDocxBase64(book, chapters) {
  const title = escapeXml(book.title || '');
  const description = book.description ? richHtmlToParagraphsXml(book.description) : '';

  const chaptersXml = chapters
    .map((chapter) => {
      const chapterTitle = escapeXml(chapter.title || '');
      const chapterBodyParagraphs = richHtmlToParagraphsXml(chapter.body || '');

      return `
        <w:p><w:r><w:t xml:space="preserve">${chapterTitle}</w:t></w:r></w:p>
        ${chapterBodyParagraphs}
        <w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>
      `;
    })
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14"
>
  <w:body>
    <w:p><w:r><w:t xml:space="preserve">${title}</w:t></w:r></w:p>
    ${description}
    <w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>
    ${chaptersXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.folder('word')?.file('document.xml', documentXml);

  return zip.generateAsync({ type: 'base64' });
}

async function shareFile(fileUri) {
  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    try {
      await Sharing.shareAsync(fileUri);
      return;
    } catch (shareError) {
      console.warn('[exportBook] shareAsync failed for source uri', serializeError(shareError));
    }

    try {
      const fileName = fileUri.split('/').pop() || `export-${Date.now()}`;
      const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: fileUri, to: cacheUri });
      await Sharing.shareAsync(cacheUri);
      return;
    } catch (cacheShareError) {
      console.warn('[exportBook] shareAsync failed for cache uri', serializeError(cacheShareError));
    }
  }

  await Share.share({
    message: fileUri,
    url: fileUri,
  });
}

export async function exportBook(book, chapters, format) {
  const fileBaseName = sanitizeFileName(book.title);
  const extension = format === 'docx' ? 'docx' : 'txt';
  const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;

  if (!baseDirectory) {
    const error = new Error('FileSystem directories are unavailable in current environment');
    console.error('[exportBook] missing base directory', {
      documentDirectory: FileSystem.documentDirectory,
      cacheDirectory: FileSystem.cacheDirectory,
      error: serializeError(error),
    });
    throw error;
  }

  const fileUri = `${baseDirectory}${fileBaseName}.${extension}`;

  try {
    if (format === 'docx') {
      const base64 = await buildDocxBase64(book, chapters);
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      const text = buildBookText(book, chapters);
      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
    await shareFile(fileUri);
  } catch (error) {
    console.error('[exportBook] failed', {
      format,
      fileUri,
      bookId: book?.id,
      bookTitle: book?.title,
      chaptersCount: chapters?.length ?? 0,
      error: serializeError(error),
    });
    throw error;
  }
}
