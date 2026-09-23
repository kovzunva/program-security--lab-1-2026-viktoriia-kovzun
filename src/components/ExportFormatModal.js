import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../localization';
import { useAppTheme } from '../theme';

export function ExportFormatModal({ visible, onSelectFormat, onClose }) {
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('alerts.exportFormat')}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{t('alerts.exportFormatMessage')}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={() => onSelectFormat('txt')}>
              <Text style={styles.confirmButtonText}>{t('alerts.exportTxt')}</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={() => onSelectFormat('docx')}>
              <Text style={styles.confirmButtonText}>{t('alerts.exportDocx')}</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.cancelButton, { backgroundColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
          </Pressable>
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
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 10,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 10,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
