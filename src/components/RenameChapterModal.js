import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '../localization';
import { useAppTheme } from '../theme';

export function RenameChapterModal({ visible, chapter, onClose, onSave, isSaving }) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || '');
    }
  }, [chapter, visible]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Помилка', 'Назва розділу не може бути порожною');
      return;
    }

    onSave(title.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('editor.renameChapter')}</Text>

          <TextInput
            placeholder="Назва розділу"
            value={title}
            onChangeText={setTitle}
            autoFocus
            style={[
              styles.input,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
            ]}
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.buttonRow}>
            <Pressable
              disabled={isSaving}
              style={[styles.button, { backgroundColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              disabled={isSaving}
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handleSave}
            >
              <Text style={styles.buttonText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  container: {
    borderRadius: 14,
    padding: 16,
    width: '100%',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
