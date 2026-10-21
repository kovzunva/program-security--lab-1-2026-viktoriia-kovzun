import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { Toast } from '../components/Toast';
import { t, useLocalization } from '../localization';
import { authService } from '../services/authService';
import { cryptoService } from '../services/cryptoService';
import { useAppTheme } from '../theme';

function LanguageRadio({ label, selected, onPress, colors }) {
  return (
    <Pressable style={styles.radioRow} onPress={onPress}>
      <View style={[styles.radioOuter, { borderColor: colors.border }]}>
        {selected ? <View style={[styles.radioInner, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const { locale, setLocale } = useLocalization();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;

  // Security States
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [isEncryptionActive, setIsEncryptionActive] = useState(true);

  // Modal States
  const [modalMode, setModalMode] = useState(null); // 'create' | 'disable' | 'change'
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [modalError, setModalError] = useState('');

  const loadSecurityState = useCallback(async () => {
    const pinActive = await authService.isPinEnabled();
    const bioActive = await authService.isBiometricsEnabled();
    const bioHardware = await authService.hasBiometricsHardware();
    const encActive = await cryptoService.isEncryptionEnabled();

    setIsPinEnabled(pinActive);
    setIsBiometricsEnabled(bioActive);
    setHasBiometricsHardware(bioHardware);
    setIsEncryptionActive(encActive);
  }, []);

  useEffect(() => {
    loadSecurityState();
  }, [loadSecurityState]);

  const handleThemeChange = (value) => {
    const nextMode = value ? 'dark' : 'light';
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    Toast.show(t('toast.themeSwitched'), '✅');
  };

  const handleLanguageChange = (nextLocale) => {
    if (nextLocale === locale) {
      return;
    }

    setLocale(nextLocale);
    Toast.show(t('toast.languageSwitched'), '✅');
  };

  // Toggle PIN switch
  const handlePinToggle = (value) => {
    setModalError('');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    if (value) {
      setModalMode('create');
    } else {
      setModalMode('disable');
    }
  };

  // Toggle Biometrics switch
  const handleBiometricsToggle = async (value) => {
    await authService.setBiometricsEnabled(value);
    setIsBiometricsEnabled(value);
    Toast.show(value ? 'Біометричний вхід увімкнено' : 'Біометричний вхід вимкнено', '🔒');
  };

  // Toggle Encryption switch
  const handleEncryptionToggle = async (value) => {
    await cryptoService.setEncryptionEnabled(value);
    setIsEncryptionActive(value);
    Toast.show(
      value ? 'AEAD-шифрування рукописів увімкнено' : 'Шифрування рукописів вимкнено',
      '🔐',
    );
  };

  // Open Change PIN modal
  const handleOpenChangePin = () => {
    setModalError('');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setModalMode('change');
  };

  // Save PIN (Create Mode)
  const handleSaveCreatePin = async () => {
    if (newPin.length < 4) {
      setModalError('PIN-код повинен містити не менше 4 цифр');
      return;
    }
    if (newPin !== confirmPin) {
      setModalError('PIN-коди не збігаються');
      return;
    }

    try {
      await authService.setPin(newPin);
      setIsPinEnabled(true);
      setModalMode(null);
      Toast.show('PIN-код успішно встановлено!', '🔐');
    } catch (e) {
      setModalError(e.message);
    }
  };

  // Disable PIN Mode
  const handleConfirmDisablePin = async () => {
    const result = await authService.validatePin(oldPin);
    if (!result.success) {
      setModalError(result.message || 'Невірний поточний PIN-код');
      return;
    }

    await authService.removePin();
    setIsPinEnabled(false);
    setIsBiometricsEnabled(false);
    setModalMode(null);
    Toast.show('Захист PIN-кодом вимкнено', '🔓');
  };

  // Change PIN Mode
  const handleSaveChangePin = async () => {
    const result = await authService.validatePin(oldPin);
    if (!result.success) {
      setModalError(result.message || 'Невірний поточний PIN-код');
      return;
    }

    if (newPin.length < 4) {
      setModalError('Новий PIN-код повинен містити не менше 4 цифр');
      return;
    }

    if (newPin !== confirmPin) {
      setModalError('Нові PIN-коди не збігаються');
      return;
    }

    try {
      await authService.setPin(newPin);
      setModalMode(null);
      Toast.show('PIN-код успішно змінено!', '🔑');
    } catch (e) {
      setModalError(e.message);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('settings.heading')}</Text>

        {/* Security Section */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🛡️ Безпека та Доступ</Text>
          </View>

          {/* Switch PIN Protection */}
          <View style={[styles.switchRow, isNarrow && styles.switchRowNarrow]}>
            <View style={styles.labelContainer}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Захист входу PIN-кодом</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Вимагати 4-значний PIN при запуску застосунку
              </Text>
            </View>
            <Switch
              value={isPinEnabled}
              onValueChange={handlePinToggle}
              thumbColor={isPinEnabled ? colors.accent : '#F4F3F4'}
              trackColor={{ false: '#CFCFCF', true: colors.accentMuted }}
            />
          </View>

          {/* Change PIN Button */}
          {isPinEnabled && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: pressed ? colors.border : colors.background,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleOpenChangePin}
            >
              <Text style={[styles.actionButtonText, { color: colors.accent }]}>🔑 Змінити PIN-код</Text>
            </Pressable>
          )}

          {/* Biometrics Switch */}
          {isPinEnabled && (
            <View style={[styles.switchRow, isNarrow && styles.switchRowNarrow, { marginTop: 12 }]}>
              <View style={styles.labelContainer}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Біометричний вхід (Face ID / Touch ID)
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Використовувати біометрію при наявності підтримки пристроєм
                </Text>
              </View>
              <Switch
                value={isBiometricsEnabled}
                onValueChange={handleBiometricsToggle}
                thumbColor={isBiometricsEnabled ? colors.accent : '#F4F3F4'}
                trackColor={{ false: '#CFCFCF', true: colors.accentMuted }}
              />
            </View>
          )}

          {/* Encryption Switch (AEAD AES-256-GCM) */}
          <View style={[styles.switchRow, isNarrow && styles.switchRowNarrow, { marginTop: 14 }]}>
            <View style={styles.labelContainer}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                Шифрування рукописів (AES-256-GCM)
              </Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Автентифіковане шифрування розділів із контролем цілісності (AEAD)
              </Text>
            </View>
            <Switch
              value={isEncryptionActive}
              onValueChange={handleEncryptionToggle}
              thumbColor={isEncryptionActive ? colors.accent : '#F4F3F4'}
              trackColor={{ false: '#CFCFCF', true: colors.accentMuted }}
            />
          </View>
        </View>

        {/* Theme Settings */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.themeLabel')}</Text>
          <View style={[styles.switchRow, isNarrow && styles.switchRowNarrow]}>
            <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>{t('settings.lightTheme')}</Text>
            <Switch
              value={mode === 'dark'}
              onValueChange={handleThemeChange}
              thumbColor={mode === 'dark' ? colors.accent : '#F4F3F4'}
              trackColor={{ false: '#CFCFCF', true: colors.accentMuted }}
            />
            <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>{t('settings.darkTheme')}</Text>
          </View>
        </View>

        {/* Language Settings */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.languageLabel')}</Text>
          <LanguageRadio
            label={t('settings.langUkrainian')}
            selected={locale === 'uk'}
            onPress={() => handleLanguageChange('uk')}
            colors={colors}
          />
          <LanguageRadio
            label={t('settings.langEnglish')}
            selected={locale === 'en'}
            onPress={() => handleLanguageChange('en')}
            colors={colors}
          />
          <LanguageRadio
            label={t('settings.langGerman')}
            selected={locale === 'de'}
            onPress={() => handleLanguageChange('de')}
            colors={colors}
          />
        </View>
      </ScrollView>

      {/* PIN Modals */}
      <Modal
        visible={modalMode !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {modalMode === 'create' && 'Встановлення PIN-коду'}
              {modalMode === 'disable' && 'Вимкнення PIN-коду'}
              {modalMode === 'change' && 'Зміна PIN-коду'}
            </Text>

            {Boolean(modalError) && <Text style={styles.modalError}>{modalError}</Text>}

            {(modalMode === 'disable' || modalMode === 'change') && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Поточний PIN-код:</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  value={oldPin}
                  onChangeText={setOldPin}
                  placeholder="Введіть старий PIN"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {(modalMode === 'create' || modalMode === 'change') && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Новий PIN-код (4-6 цифр):</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                    value={newPin}
                    onChangeText={setNewPin}
                    placeholder="Введіть новий PIN"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Підтвердіть новий PIN-код:</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    placeholder="Повторіть PIN"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </>
            )}

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setModalMode(null)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Скасувати</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.modalPrimaryButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  if (modalMode === 'create') handleSaveCreatePin();
                  if (modalMode === 'disable') handleConfirmDisablePin();
                  if (modalMode === 'change') handleSaveChangePin();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Зберегти</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelContainer: {
    flex: 1,
    paddingRight: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchRowNarrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  switchLabel: {
    fontSize: 14,
  },
  actionButton: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  radioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    marginRight: 10,
    width: 20,
  },
  radioInner: {
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalError: {
    color: '#E53935',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
