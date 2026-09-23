import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../localization';
import { useAppTheme } from '../theme';

export function ConfirmActionModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}) {
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            {title || t('alerts.confirmation')}
          </Text>

          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, { backgroundColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
                {cancelLabel || t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: destructive ? colors.danger : colors.accent },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>{confirmLabel || t('common.confirm')}</Text>
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
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
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
