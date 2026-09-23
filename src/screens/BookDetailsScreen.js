import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { ExportFormatModal } from '../components/ExportFormatModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { t } from '../localization';
import { ROUTES } from '../constants/routes';
import { useAppTheme } from '../theme';
import { deleteBook, deleteBookCover, getBookById, listChaptersByBookId } from '../database/client';
import { exportBook } from '../services/bookExport';

export function BookDetailsScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [book, setBook] = useState(null);
  const [chaptersCount, setChaptersCount] = useState(0);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isExportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const bookId = route?.params?.bookId;
  const isWideLayout = width >= 760;
  const coverWidth = isWideLayout ? 140 : 120;
  const coverHeight = Math.round(coverWidth * 1.42);

  const refreshData = useCallback(async () => {
    if (!bookId) {
      setBook(null);
      setChaptersCount(0);
      return;
    }

    const [bookData, chapters] = await Promise.all([
      getBookById(bookId),
      listChaptersByBookId(bookId),
    ]);

    setBook(bookData || null);
    setChaptersCount(chapters.length);
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      refreshData().catch(() => {
        setBook(null);
        setChaptersCount(0);
      });
    }, [refreshData]),
  );

  const handleConfirmDeleteBook = useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      await deleteBook(bookId);
      setDeleteModalVisible(false);
      navigation.navigate(ROUTES.LIBRARY);
    } catch {
      Alert.alert(t('toast.error'));
    }
  }, [bookId, navigation]);

  const handleRemoveCover = useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      await deleteBookCover(bookId);
      await refreshData();
    } catch {
      Alert.alert(t('toast.error'));
    }
  }, [bookId, refreshData]);

  const handleExport = useCallback(async (format) => {
    if (!bookId || !book) {
      return;
    }

    try {
      setIsExporting(true);
      const chapters = await listChaptersByBookId(bookId);
      await exportBook(book, chapters, format);
      setExportModalVisible(false);
    } catch (error) {
      console.error('[BookDetailsScreen] export failed', {
        format,
        bookId,
        bookTitle: book?.title,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorCode: error?.code,
        rawError: String(error),
      });
      Alert.alert(t('bookStats.exportError'));
    } finally {
      setIsExporting(false);
    }
  }, [book, bookId]);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('bookDetails.heading')}</Text>

        <View style={styles.contentRow}>
          <View style={styles.coverColumn}>
            {book?.cover_uri ? (
              <Image
                source={{ uri: book.cover_uri }}
                style={[styles.coverImage, { borderColor: colors.border, width: coverWidth, height: coverHeight }]}
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border, width: coverWidth, height: coverHeight }]}>
                <MaterialCommunityIcons name="image-off" size={32} color={colors.textSecondary} />
                <Text style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                  {t('bookDetails.noCover')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.detailsColumn}>
            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('bookMeta.titleLabel')}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{book?.title || t('common.untitled')}</Text>

              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('bookMeta.descriptionLabel')}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {book?.description || t('bookDetails.noDescription')}
              </Text>

              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('bookMeta.genreLabel')}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {book?.genre || t('bookDetails.noGenre')}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.statsButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate(ROUTES.STATS, { bookId })}
        >
          <Text style={[styles.statsButtonText, { color: colors.textPrimary }]}>{t('bookDetails.openStats')}</Text>
        </Pressable>

        <Pressable
          disabled={isExporting}
          style={[styles.statsButton, { backgroundColor: colors.surface, borderColor: colors.border }, isExporting && styles.disabled]}
          onPress={() => setExportModalVisible(true)}
        >
          <Text style={[styles.statsButtonText, { color: colors.textPrimary }]}>{t('bookStats.export')}</Text>
        </Pressable>

        <Pressable
          style={[styles.chaptersButton, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate(ROUTES.BOOK_CHAPTERS, { bookId })}
        >
          <Text style={styles.chaptersButtonText}>
            {`${t('bookDetails.openChapters')} (${chaptersCount})`}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottomActionsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate(ROUTES.BOOK_META_FORM, { mode: 'edit', bookId })}
        >
          <Text numberOfLines={1} style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('bookDetails.editBook')}</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.danger }]}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text numberOfLines={1} style={styles.deleteButtonText}>{t('common.delete')}</Text>
        </Pressable>
      </View>

      <ConfirmActionModal
        visible={isDeleteModalVisible}
        title={t('library.deleteBookConfirm')}
        message={t('library.deleteBookMessage')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleConfirmDeleteBook}
        onClose={() => setDeleteModalVisible(false)}
      />

      <ExportFormatModal
        visible={isExportModalVisible}
        onSelectFormat={handleExport}
        onClose={() => setExportModalVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  coverColumn: {
    flex: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverImage: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  coverPlaceholder: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coverPlaceholderText: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  removeCoverButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeCoverButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  detailsColumn: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  metaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statsButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  statsButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chaptersButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 16,
  },
  chaptersButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  disabled: {
    opacity: 0.6,
  },
});
