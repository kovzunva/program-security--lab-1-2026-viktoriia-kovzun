import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import { t } from '../localization';
import { ROUTES } from '../constants/routes';
import { useAppTheme } from '../theme';
import { listBooks } from '../database/client';

export function LibraryScreen({ navigation }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [searchText, setSearchText] = useState('');
  const [books, setBooks] = useState([]);
  const isWideLayout = width >= 760;

  const refreshBooks = useCallback(async (query = '') => {
    const rows = await listBooks(query);
    setBooks(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshBooks(searchText).catch(() => {
        setBooks([]);
      });
    }, [refreshBooks, searchText]),
  );

  const handleSearch = useCallback((value) => {
    setSearchText(value);
    refreshBooks(value).catch(() => {
      setBooks([]);
    });
  }, [refreshBooks]);

  const handleCreateBook = useCallback(async () => {
    navigation.navigate(ROUTES.BOOK_META_FORM, { mode: 'create' });
  }, [navigation]);

  const renderBookCard = (book) => (
    <Pressable
      key={book.id}
      style={[styles.bookCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate(ROUTES.BOOK_DETAILS, { bookId: book.id })}
    >
      <Text style={[styles.bookTitle, { color: colors.textPrimary }]}>{book.title || t('common.untitled')}</Text>
      <Text style={[styles.bookMeta, { color: colors.textSecondary }]}>{`${t('library.chapters')}: ${book.chapters_count}`}</Text>
      <Text style={[styles.bookMeta, { color: colors.textSecondary }]}>{`${t('common.words')}: ${book.words_count}`}</Text>
    </Pressable>
  );

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('library.heading')}</Text>

        {isWideLayout && (
          <TextInput
            placeholder={t('library.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={handleSearch}
            style={[
              styles.searchInput,
              styles.searchInputInline,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        )}

        <Pressable
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={handleCreateBook}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {!isWideLayout && (
        <TextInput
          placeholder={t('library.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={handleSearch}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {books.map(renderBookCard)}

        {books.length === 0 && (
          <Text style={[styles.emptyState, { color: colors.textSecondary }]}>
            {searchText ? t('library.noSearchResults') : t('library.emptyState')}
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInputInline: {
    flex: 1,
    marginBottom: 0,
    marginHorizontal: 12,
  },
  list: {
    flex: 1,
  },
  bookCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 14,
    marginBottom: 2,
  },
  emptyState: {
    fontSize: 14,
  },
});
