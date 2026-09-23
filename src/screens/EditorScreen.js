import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RichEditor } from 'react-native-pell-rich-editor';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatBadge } from '../components/StatBadge';
import { t } from '../localization';
import { useAppTheme } from '../theme';
import { useEditorOrientation } from '../hooks/useScreenOrientation';
import { ensureEditorChapter, getChapterById, updateChapterContent } from '../database/client';

function countWords(text) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

function stripHtml(html) {
  if (!html) {
    return '';
  }

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeChapterHtml(value) {
  if (!value) {
    return '<p></p>';
  }

  if (/<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }

  return `<p>${escapeHtml(value).replace(/\n/g, '<br/>')}</p>`;
}

export function EditorScreen({ route }) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const editorRef = useRef(null);
  const shouldSyncEditorContentRef = useRef(false);
  const [contentHtml, setContentHtml] = useState('<p></p>');
  const [plainText, setPlainText] = useState('');
  const [chapterTitle, setChapterTitle] = useState(t('editor.heading'));
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [saveState, setSaveState] = useState('saved');

  const saveTimeoutRef = useRef(null);
  const chapterIdRef = useRef(null);
  const skipSaveRef = useRef(false);
  useEditorOrientation(true);
  const isLandscape = width > height;

  const words = useMemo(() => countWords(plainText), [plainText]);
  const chars = plainText.length;

  const applyRichCommand = useCallback((commandName, fallbackCommand) => {
    editorRef.current?.focusContentEditor?.();

    const directMethod = editorRef.current?.[commandName];
    if (typeof directMethod === 'function') {
      directMethod.call(editorRef.current);
      return;
    }

    editorRef.current?.commandDOM?.(`document.execCommand('${fallbackCommand}', false, null);`);
  }, []);

  const persistContent = useCallback(async (html) => {
    const chapterId = chapterIdRef.current;
    if (!chapterId) {
      return;
    }

    try {
      setSaveState('saving');
      const plain = stripHtml(html);
      await updateChapterContent(chapterId, html, countWords(plain), plain.length);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const loadChapter = useCallback(async () => {
    const routeChapterId = route?.params?.chapterId;
    const chapterId = routeChapterId ?? (await ensureEditorChapter());
    chapterIdRef.current = chapterId;

    const chapter = chapterId ? await getChapterById(chapterId) : null;

    skipSaveRef.current = true;
    shouldSyncEditorContentRef.current = true;
    setIsEditorReady(false);

    const initialHtml = normalizeChapterHtml(chapter?.body || '');
    setChapterTitle(chapter?.title || t('editor.heading'));
    setContentHtml(initialHtml);
    setPlainText(stripHtml(initialHtml));
    setIsLoaded(true);
    setSaveState('saved');
  }, [route?.params?.chapterId]);

  useEffect(() => {
    let isActive = true;

    loadChapter().catch(() => {
      if (!isActive) {
        return;
      }

      setIsLoaded(true);
      setSaveState('error');
    });

    return () => {
      isActive = false;
    };
  }, [loadChapter]);

  useFocusEffect(
    useCallback(() => {
      loadChapter().catch(() => {
        setSaveState('error');
      });

      return undefined;
    }, [loadChapter]),
  );

  useEffect(() => {
    if (!isLoaded || !isEditorReady || !shouldSyncEditorContentRef.current) {
      return;
    }

    const setContent = editorRef.current?.setContentHTML;
    if (typeof setContent !== 'function') {
      return;
    }

    setContent.call(editorRef.current, contentHtml);
    shouldSyncEditorContentRef.current = false;
  }, [isLoaded, isEditorReady, contentHtml]);

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return undefined;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      persistContent(contentHtml).catch(() => {
        setSaveState('error');
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [contentHtml, isLoaded, persistContent]);

  const handleBlur = useCallback(() => {
    persistContent(contentHtml).catch(() => {
      setSaveState('error');
    });
  }, [contentHtml, persistContent]);

  const saveStateText =
    saveState === 'saving'
      ? t('editor.autosaveSaving')
      : saveState === 'error'
        ? t('editor.autosaveError')
        : t('editor.autosaveSaved');

  const statsContent = (
    <>
      <StatBadge label={t('common.words')} value={words} />
      <StatBadge label={t('common.chars')} value={chars} />
      <Text style={[styles.autosaveText, { color: colors.textSecondary }]}>{saveStateText}</Text>
    </>
  );

  return (
    <ScreenContainer>
      {isLandscape ? (
        <View style={styles.headerLandscapeRow}>
          <Text numberOfLines={1} style={[styles.heading, styles.headingLandscape, { color: colors.textPrimary }]}>
            {chapterTitle}
          </Text>

          <View style={[styles.statsRow, styles.statsRowLandscape]}>{statsContent}</View>
        </View>
      ) : (
        <>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>{chapterTitle}</Text>
          <View style={styles.statsRow}>{statsContent}</View>
        </>
      )}

      <View
        style={[
          styles.editor,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <RichEditor
          ref={editorRef}
          disabled={!isLoaded}
          initialContentHTML="<p></p>"
          editorInitializedCallback={() => setIsEditorReady(true)}
          placeholder={t('editor.placeholder')}
          style={styles.richEditor}
          editorStyle={{
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            placeholderColor: colors.textSecondary,
            cssText: 'font-size: 16px; line-height: 1.55;',
          }}
          onChange={(html) => {
            setContentHtml(html || '<p></p>');
            setPlainText(stripHtml(html || ''));
          }}
          onBlur={handleBlur}
        />
      </View>

      <View
        style={[
          styles.toolbar,
          { backgroundColor: colors.surface },
        ]}
      >
        <Pressable style={styles.toolButton} onPress={() => applyRichCommand('setBold', 'bold')}>
          <MaterialCommunityIcons name="format-bold" size={20} color={colors.textPrimary} />
          <Text style={[styles.toolLabel, { color: colors.textPrimary }]}>{t('editor.formatting.bold')}</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => applyRichCommand('setItalic', 'italic')}>
          <MaterialCommunityIcons name="format-italic" size={20} color={colors.textPrimary} />
          <Text style={[styles.toolLabel, { color: colors.textPrimary }]}>{t('editor.formatting.italic')}</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => applyRichCommand('setStrikethrough', 'strikeThrough')}>
          <MaterialCommunityIcons name="format-strikethrough-variant" size={20} color={colors.textPrimary} />
          <Text style={[styles.toolLabel, { color: colors.textPrimary }]}>{t('editor.formatting.strike')}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerLandscapeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  headingLandscape: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statsRowLandscape: {
    flex: 1,
    marginBottom: 0,
  },
  autosaveText: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  editor: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  richEditor: {
    flex: 1,
  },
  toolbar: {
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  toolButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
