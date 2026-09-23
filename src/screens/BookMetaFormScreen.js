import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { t } from '../localization';
import { ROUTES } from '../constants/routes';
import { useAppTheme } from '../theme';
import { createBook, getBookById, updateBook } from '../database/client';

export function BookMetaFormScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const mode = route?.params?.mode === 'edit' ? 'edit' : 'create';
  const bookId = route?.params?.bookId;
  const isWideLayout = width >= 760;
  const coverWidth = isWideLayout ? 180 : 140;
  const coverHeight = Math.round(coverWidth * 1.43);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [coverUri, setCoverUri] = useState(null);
  const [titleError, setTitleError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isDeleteCoverModalVisible, setDeleteCoverModalVisible] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !bookId) {
      return;
    }

    getBookById(bookId)
      .then((book) => {
        setTitle(book?.title || '');
        setDescription(book?.description || '');
        setGenre(book?.genre || '');
        setCoverUri(book?.cover_uri || null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [bookId, mode]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setTitleError(t('bookMeta.validationTitleRequired'));
      return;
    }

    setTitleError('');

    try {
      setIsSaving(true);

      if (mode === 'edit' && bookId) {
        await updateBook(bookId, title.trim(), description.trim(), genre.trim(), coverUri);
        navigation.navigate(ROUTES.BOOK_DETAILS, { bookId });
        return;
      }

      const createdBookId = await createBook(title.trim(), description.trim(), genre.trim(), coverUri);
      navigation.replace(ROUTES.BOOK_DETAILS, { bookId: createdBookId });
    } catch {
      Alert.alert(t('bookMeta.saveError'));
    } finally {
      setIsSaving(false);
    }
  }, [bookId, coverUri, description, genre, mode, navigation, title]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('toast.error'));
    }
  }, []);

  const handleRemoveCover = useCallback(() => {
    setDeleteCoverModalVisible(true);
  }, []);

  const handleConfirmRemoveCover = useCallback(() => {
    setCoverUri(null);
    setDeleteCoverModalVisible(false);
  }, []);

  const heading = mode === 'edit' ? t('bookMeta.editHeading') : t('bookMeta.createHeading');

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, isWideLayout && styles.contentWide]}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{heading}</Text>

        <View style={styles.coverSection}>
          {coverUri ? (
            <>
              <Image
                source={{ uri: coverUri }}
                style={[styles.coverImage, { borderColor: colors.border, width: coverWidth, height: coverHeight }]}
              />
              <Pressable
                style={[styles.removeCoverButton, { backgroundColor: colors.danger }]}
                onPress={handleRemoveCover}
              >
                <MaterialCommunityIcons name="trash-can" size={18} color="#FFFFFF" />
                <Text style={styles.removeCoverButtonText}>{t('common.delete')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[
                styles.coverPlaceholder,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  width: coverWidth,
                  height: coverHeight,
                },
              ]}
              onPress={handlePickImage}
            >
              <MaterialCommunityIcons name="image-plus" size={40} color={colors.textSecondary} />
              <Text style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                {t('bookMeta.pickCover')}
              </Text>
            </Pressable>
          )}
        </View>

        {coverUri && (
          <Pressable
            style={[styles.changeCoverButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handlePickImage}
          >
            <MaterialCommunityIcons name="pencil" size={16} color={colors.textPrimary} />
            <Text style={[styles.changeCoverButtonText, { color: colors.textPrimary }]}>{t('bookMeta.changeCover')}</Text>
          </Pressable>
        )}

        <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('bookMeta.titleLabel')} *</Text>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            if (titleError) {
              setTitleError('');
            }
          }}
          placeholder={t('bookMeta.titlePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          editable={!isLoading && !isSaving}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: titleError ? colors.danger : colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        {titleError ? <Text style={[styles.errorText, { color: colors.danger }]}>{titleError}</Text> : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('bookMeta.descriptionLabel')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('bookMeta.descriptionPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={!isLoading && !isSaving}
          style={[
            styles.textArea,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          textAlignVertical="top"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('bookMeta.genreLabel')}</Text>
        <TextInput
          value={genre}
          onChangeText={setGenre}
          placeholder={t('bookMeta.genrePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          editable={!isLoading && !isSaving}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />

        <Pressable
          disabled={isSaving || isLoading}
          style={[styles.saveButton, { backgroundColor: colors.accent }, (isSaving || isLoading) && styles.disabled]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>{isSaving ? t('common.loading') : t('common.save')}</Text>
        </Pressable>
        </View>
        </View>
      </ScrollView>

      <ConfirmActionModal
        visible={isDeleteCoverModalVisible}
        title={t('bookMeta.deleteCoverTitle')}
        message={t('bookMeta.deleteCoverMessage')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleConfirmRemoveCover}
        onClose={() => setDeleteCoverModalVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 10,
  },
  content: {
    width: '100%',
  },
  contentWide: {
    alignSelf: 'center',
    maxWidth: 760,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  coverSection: {
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  coverImage: {
    borderRadius: 8,
    borderWidth: 1,
  },
  coverPlaceholder: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  removeCoverButton: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeCoverButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  changeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    marginBottom: 14,
  },
  changeCoverButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 12,
    marginTop: -4,
  },
});
