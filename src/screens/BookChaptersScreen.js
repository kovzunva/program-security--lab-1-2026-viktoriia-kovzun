import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { RenameChapterModal } from '../components/RenameChapterModal';
import { t } from '../localization';
import { ROUTES } from '../constants/routes';
import { useAppTheme } from '../theme';
import {
  createChapter,
  deleteChapter,
  listChaptersByBookId,
  toggleChapterLock,
  updateChapterTitle,
} from '../database/client';
import { authService } from '../services/authService';
import { LockScreen } from './LockScreen';

export function BookChaptersScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [chapters, setChapters] = useState([]);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [renamingChapter, setRenamingChapter] = useState(null);
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState(null);

  // ABAC Chapter Protection state
  const [lockedChapterToOpen, setLockedChapterToOpen] = useState(null);

  const bookId = route?.params?.bookId;
  const isWideLayout = width >= 760;

  const refreshChapters = useCallback(async () => {
    if (!bookId) {
      setChapters([]);
      return;
    }

    const rows = await listChaptersByBookId(bookId);
    setChapters(rows);
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      refreshChapters().catch(() => {
        setChapters([]);
      });
    }, [refreshChapters]),
  );

  const handleCreateChapter = useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      setIsAddingChapter(true);
      const nextNumber = chapters.length + 1;
      const chapterId = await createChapter(bookId, `${t('bookDetails.chapterPrefix')} ${nextNumber}`);
      await refreshChapters();
      navigation.navigate(ROUTES.EDITOR, { chapterId });
    } catch {
      Alert.alert(t('bookDetails.addChapterError'));
    } finally {
      setIsAddingChapter(false);
    }
  }, [bookId, chapters.length, navigation, refreshChapters]);

  const handleRenameChapter = useCallback((chapter) => {
    setRenamingChapter(chapter);
  }, []);

  const handleSaveRename = useCallback(async (newTitle) => {
    if (!renamingChapter) return;

    try {
      setIsSavingRename(true);
      await updateChapterTitle(renamingChapter.id, newTitle);
      await refreshChapters();
      setRenamingChapter(null);
    } catch {
      Alert.alert('Помилка', 'Не вдалося перейменувати розділ.');
    } finally {
      setIsSavingRename(false);
    }
  }, [renamingChapter, refreshChapters]);

  const handleConfirmDeleteChapter = useCallback(async () => {
    if (!chapterToDelete) {
      return;
    }

    try {
      await deleteChapter(chapterToDelete.id);
      setChapterToDelete(null);
      await refreshChapters();
    } catch {
      Alert.alert('Помилка', 'Не вдалося видалити розділ.');
    }
  }, [chapterToDelete, refreshChapters]);

  // Toggle chapter lock (ABAC)
  const handleToggleLock = useCallback(async (chapter) => {
    try {
      const nextLockState = !chapter.is_locked;
      await toggleChapterLock(chapter.id, nextLockState);
      await refreshChapters();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося змінити статус захисту розділу');
    }
  }, [refreshChapters]);

  // Open Chapter with ABAC security check
  const handleOpenChapter = useCallback(async (chapter) => {
    if (chapter.is_locked) {
      const pinEnabled = await authService.isPinEnabled();
      if (pinEnabled) {
        setLockedChapterToOpen(chapter);
        return;
      }
    }
    navigation.navigate(ROUTES.EDITOR, { chapterId: chapter.id });
  }, [navigation]);

  const handleUnlockSuccess = useCallback(() => {
    if (lockedChapterToOpen) {
      const targetId = lockedChapterToOpen.id;
      setLockedChapterToOpen(null);
      navigation.navigate(ROUTES.EDITOR, { chapterId: targetId });
    }
  }, [lockedChapterToOpen, navigation]);

  const renderChapterItem = (chapter) => (
    <Pressable
      key={chapter.id}
      style={[
        styles.chapterItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        chapter.is_locked && styles.lockedChapterItem,
      ]}
      onPress={() => handleOpenChapter(chapter)}
      onLongPress={() => handleRenameChapter(chapter)}
    >
      <View style={[styles.chapterContent, isWideLayout && styles.chapterContentWide]}>
        <View style={styles.titleRow}>
          {chapter.is_locked === 1 && <Text style={styles.lockIcon}>🔒 </Text>}
          <Text style={[styles.chapterTitle, isWideLayout && styles.chapterTitleWide, { color: colors.textPrimary }]}>
            {chapter.title || t('common.untitled')}
          </Text>
        </View>
        <Text style={[styles.chapterMeta, isWideLayout && styles.chapterMetaWide, { color: colors.textSecondary }]}>
          {`${t('common.words')}: ${chapter.words_count}`}
          {chapter.is_locked === 1 ? ' • 🛡️ Захищено (ABAC)' : ''}
        </Text>
      </View>

      <View style={styles.chapterActions}>
        {/* Toggle Lock Action */}
        <Pressable
          style={[
            styles.actionIconButton,
            { backgroundColor: chapter.is_locked ? '#FFF3E0' : colors.surface },
          ]}
          onPress={() => handleToggleLock(chapter)}
        >
          <Text style={{ fontSize: 16 }}>{chapter.is_locked ? '🔒' : '🔓'}</Text>
        </Pressable>

        <Pressable
          style={[styles.actionIconButton, { backgroundColor: colors.accentMuted }]}
          onPress={() => handleRenameChapter(chapter)}
        >
          <Text style={{ color: colors.accent, fontWeight: '700' }}>✎</Text>
        </Pressable>
        <Pressable
          style={[styles.actionIconButton, { backgroundColor: colors.danger }]}
          onPress={() => setChapterToDelete(chapter)}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>×</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('bookDetails.chaptersHeading')}</Text>

      <ScrollView style={{ flex: 1 }}>
        {chapters.map(renderChapterItem)}

        {chapters.length === 0 && (
          <Text style={[styles.emptyState, { color: colors.textSecondary }]}>{t('bookDetails.chaptersEmpty')}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={isAddingChapter || !bookId}
          style={[styles.primaryButton, { backgroundColor: colors.accent }, (isAddingChapter || !bookId) && styles.disabled]}
          onPress={handleCreateChapter}
        >
          <Text style={styles.primaryButtonText}>{t('bookDetails.addChapter')}</Text>
        </Pressable>
      </View>

      <RenameChapterModal
        visible={!!renamingChapter}
        chapter={renamingChapter}
        onClose={() => setRenamingChapter(null)}
        onSave={handleSaveRename}
        isSaving={isSavingRename}
      />

      <ConfirmActionModal
        visible={!!chapterToDelete}
        title={t('bookDetails.deleteChapterConfirm')}
        message={t('alerts.deleteChapterMessage')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleConfirmDeleteChapter}
        onClose={() => setChapterToDelete(null)}
      />

      {/* Modal LockScreen for opening locked chapter */}
      <Modal
        visible={!!lockedChapterToOpen}
        animationType="slide"
        onRequestClose={() => setLockedChapterToOpen(null)}
      >
        <LockScreen
          title="Захищений розділ"
          subtitle={`Введіть PIN-код для відкриття "${lockedChapterToOpen?.title}"`}
          allowCancel={true}
          onCancel={() => setLockedChapterToOpen(null)}
          onSuccess={handleUnlockSuccess}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  chapterItem: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
    alignItems: 'center',
  },
  lockedChapterItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  chapterContent: {
    flex: 1,
  },
  chapterContentWide: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 14,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  chapterTitleWide: {
    marginBottom: 0,
    paddingRight: 10,
  },
  chapterMeta: {
    fontSize: 12,
  },
  chapterMetaWide: {
    marginLeft: 'auto',
    marginRight: 8,
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconButton: {
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    fontSize: 14,
    marginBottom: 18,
  },
  footer: {
    gap: 10,
    paddingTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
