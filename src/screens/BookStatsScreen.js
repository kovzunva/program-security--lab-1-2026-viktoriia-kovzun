import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatBadge } from '../components/StatBadge';
import { t } from '../localization';
import { useAppTheme } from '../theme';
import { getBookById, getBookStats, listChaptersByBookId } from '../database/client';

export function BookStatsScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [book, setBook] = useState(null);
  const [stats, setStats] = useState(null);
  const [chapters, setChapters] = useState([]);
  const bookId = route?.params?.bookId;
  const isWideLayout = width >= 760;

  const loadData = useCallback(async () => {
    if (!bookId) return;

    const bookData = await getBookById(bookId);
    setBook(bookData);

    const statsData = await getBookStats(bookId);
    setStats(statsData);

    const chaptersData = await listChaptersByBookId(bookId);
    setChapters(chaptersData);
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {
        setBook(null);
        setStats(null);
        setChapters([]);
      });
    }, [loadData]),
  );

  if (!book || !stats) {
    return <ScreenContainer><Text>{t('common.loading')}</Text></ScreenContainer>;
  }

  const avgWordsPerChapter = stats.chapters_count > 0 ? Math.round(stats.total_words / stats.chapters_count) : 0;

  return (
    <ScreenContainer>
      <ScrollView>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{book.title}</Text>
        {book.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{book.description}</Text>
        )}

        <View style={styles.statsGrid}>
          <View style={[styles.statItem, isWideLayout && styles.statItemWide]}>
            <StatBadge label={t('bookStats.totalWords')} value={stats.total_words} />
          </View>
          <View style={[styles.statItem, isWideLayout && styles.statItemWide]}>
            <StatBadge label={t('bookStats.totalChars')} value={stats.total_chars} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statItem, isWideLayout && styles.statItemWide]}>
            <StatBadge label={t('bookStats.chaptersCount')} value={stats.chapters_count} />
          </View>
          <View style={[styles.statItem, isWideLayout && styles.statItemWide]}>
            <StatBadge label={t('bookStats.wordsPerChapter')} value={avgWordsPerChapter} />
          </View>
        </View>

        <Text style={[styles.subheading, { color: colors.textPrimary }]}>{t('bookDetails.chaptersHeading')}</Text>
        {chapters.length === 0 ? (
          <Text style={[styles.emptyChaptersText, { color: colors.textSecondary }]}>{t('bookStats.noChapters')}</Text>
        ) : chapters.map((chapter) => (
          <View key={chapter.id} style={[styles.chapterRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chapterInfo}>
              <Text style={[styles.chapterName, { color: colors.textPrimary }]}>{chapter.title}</Text>
              <Text style={[styles.chapterMeta, { color: colors.textSecondary }]}>
                {chapter.words_count} {t('common.words')} • {chapter.chars_count} {t('common.chars')}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statItem: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  statItemWide: {
    flexBasis: '30%',
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  chapterRow: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  chapterMeta: {
    fontSize: 13,
  },
  emptyChaptersText: {
    fontSize: 14,
    marginBottom: 10,
  },
});
