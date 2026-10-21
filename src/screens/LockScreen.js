import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { authService } from '../services/authService';
import { useAppTheme } from '../theme';

const PIN_LENGTH = 4;

export function LockScreen({
  onSuccess,
  onCancel,
  title = 'Захищений доступ',
  subtitle = 'Введіть 4-значний PIN-код для продовження',
  allowCancel = false,
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  // Check initial lockout state and biometrics
  const checkInitialState = useCallback(async () => {
    const remaining = await authService.getLockoutRemainingSeconds();
    if (remaining > 0) {
      setLockoutSeconds(remaining);
      setErrorMessage(`Забагато спроб. Заблоковано на ${remaining} сек.`);
    }

    const bioEnabled = await authService.isBiometricsEnabled();
    const bioSupported = await authService.hasBiometricsHardware();
    const canUseBio = bioEnabled && bioSupported;
    setBiometricsAvailable(canUseBio);

    // Auto-trigger biometrics on load if available and not locked out
    if (canUseBio && remaining === 0) {
      handleBiometrics(promptText => promptText);
    }
  }, []);

  useEffect(() => {
    checkInitialState();
  }, [checkInitialState]);

  // Lockout timer countdown effect
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage('');
          return 0;
        }
        setErrorMessage(`Забагато спроб. Заблоковано на ${prev - 1} сек.`);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Handle digit press
  const handleDigitPress = async (digit) => {
    if (lockoutSeconds > 0) {
      return;
    }

    if (pin.length >= PIN_LENGTH) {
      return;
    }

    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === PIN_LENGTH) {
      // Validate PIN
      const result = await authService.validatePin(nextPin);
      if (result.success) {
        setPin('');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        Vibration.vibrate(200);
        setPin('');
        if (result.isLocked) {
          setLockoutSeconds(result.remainingSeconds);
          setErrorMessage(`Забагато спроб. Заблоковано на ${result.remainingSeconds} сек.`);
        } else {
          setErrorMessage(
            result.message || `Невірний PIN-код (${result.remainingAttempts} спроб залишилось)`
          );
        }
      }
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    if (lockoutSeconds > 0) {
      return;
    }
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  // Handle Biometrics trigger
  const handleBiometrics = async () => {
    if (lockoutSeconds > 0) {
      return;
    }
    const result = await authService.authenticateBiometrics('Підтвердження особи у Writer Editor');
    if (result.success) {
      if (onSuccess) {
        onSuccess();
      }
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: colors.accentMuted }]}>
          <Text style={styles.lockEmoji}>🔒</Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>

      {/* PIN Dots Indicator */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: PIN_LENGTH }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  borderColor: colors.accent,
                  backgroundColor: isFilled ? colors.accent : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>

      {/* Error / Warning Message */}
      <View style={styles.errorContainer}>
        {Boolean(errorMessage) && (
          <Text style={[styles.errorText, { color: lockoutSeconds > 0 ? '#E53935' : colors.accent }]}>
            {errorMessage}
          </Text>
        )}
      </View>

      {/* Keypad */}
      <View style={[styles.keypad, isNarrow && styles.keypadNarrow]}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((digit) => (
              <Pressable
                key={digit}
                disabled={lockoutSeconds > 0}
                style={({ pressed }) => [
                  styles.keyButton,
                  {
                    backgroundColor: pressed ? colors.border : colors.surface,
                    borderColor: colors.border,
                    opacity: lockoutSeconds > 0 ? 0.4 : 1,
                  },
                ]}
                onPress={() => handleDigitPress(digit)}
              >
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>{digit}</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Bottom Keypad Row: Biometrics, 0, Backspace */}
        <View style={styles.keypadRow}>
          {biometricsAvailable ? (
            <Pressable
              disabled={lockoutSeconds > 0}
              style={({ pressed }) => [
                styles.keyButton,
                styles.keyButtonSpecial,
                {
                  backgroundColor: pressed ? colors.border : colors.surface,
                  borderColor: colors.border,
                  opacity: lockoutSeconds > 0 ? 0.4 : 1,
                },
              ]}
              onPress={handleBiometrics}
            >
              <Text style={styles.specialKeyText}>🖐</Text>
            </Pressable>
          ) : (
            <View style={styles.keyButtonPlaceholder} />
          )}

          <Pressable
            disabled={lockoutSeconds > 0}
            style={({ pressed }) => [
              styles.keyButton,
              {
                backgroundColor: pressed ? colors.border : colors.surface,
                borderColor: colors.border,
                opacity: lockoutSeconds > 0 ? 0.4 : 1,
              },
            ]}
            onPress={() => handleDigitPress('0')}
          >
            <Text style={[styles.keyText, { color: colors.textPrimary }]}>0</Text>
          </Pressable>

          <Pressable
            disabled={lockoutSeconds > 0}
            style={({ pressed }) => [
              styles.keyButton,
              styles.keyButtonSpecial,
              {
                backgroundColor: pressed ? colors.border : colors.surface,
                borderColor: colors.border,
                opacity: lockoutSeconds > 0 ? 0.4 : 1,
              },
            ]}
            onPress={handleBackspace}
          >
            <Text style={[styles.specialKeyText, { color: colors.textPrimary }]}>⌫</Text>
          </Pressable>
        </View>
      </View>

      {/* Cancel button if inside a modal */}
      {allowCancel && onCancel && (
        <Pressable
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Скасувати</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    marginBottom: 12,
    width: 60,
  },
  lockEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  dotsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginVertical: 18,
  },
  dot: {
    borderRadius: 10,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  errorContainer: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  keypad: {
    gap: 12,
    marginTop: 8,
    maxWidth: 320,
    width: '100%',
  },
  keypadNarrow: {
    maxWidth: 280,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  keyButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    height: 64,
    justifyContent: 'center',
  },
  keyButtonSpecial: {
    borderWidth: 1,
  },
  keyButtonPlaceholder: {
    flex: 1,
    height: 64,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  specialKeyText: {
    fontSize: 22,
  },
  cancelButton: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
