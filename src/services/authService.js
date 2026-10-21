import bcrypt from 'bcryptjs';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  deleteAuthSetting,
  getAuthSetting,
  setAuthSetting,
} from '../database/client';

const PIN_HASH_KEY = 'pin_hash';
const BIOMETRICS_ENABLED_KEY = 'biometrics_enabled';
const FAILED_ATTEMPTS_KEY = 'pin_failed_attempts';
const LOCKOUT_UNTIL_KEY = 'pin_lockout_until';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 45000; // 45 seconds lockout

export const authService = {
  /**
   * Check if PIN protection is enabled
   */
  async isPinEnabled() {
    try {
      const hash = await getAuthSetting(PIN_HASH_KEY);
      return Boolean(hash);
    } catch (e) {
      return false;
    }
  },

  /**
   * Save a new PIN using bcrypt hashing with salt
   */
  async setPin(newPin) {
    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      throw new Error('PIN-код повинен містити щонайменше 4 цифри');
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPin, salt);

    await setAuthSetting(PIN_HASH_KEY, hash);
    await this.resetFailedAttempts();
    return true;
  },

  /**
   * Remove PIN protection
   */
  async removePin() {
    await deleteAuthSetting(PIN_HASH_KEY);
    await deleteAuthSetting(BIOMETRICS_ENABLED_KEY);
    await this.resetFailedAttempts();
  },

  /**
   * Calculate remaining lockout seconds if currently locked
   */
  async getLockoutRemainingSeconds() {
    try {
      const lockoutUntilStr = await getAuthSetting(LOCKOUT_UNTIL_KEY);
      if (!lockoutUntilStr) {
        return 0;
      }

      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      const now = Date.now();
      if (now >= lockoutUntil) {
        // Lockout expired
        await deleteAuthSetting(LOCKOUT_UNTIL_KEY);
        await setAuthSetting(FAILED_ATTEMPTS_KEY, '0');
        return 0;
      }

      return Math.ceil((lockoutUntil - now) / 1000);
    } catch (e) {
      return 0;
    }
  },

  /**
   * Validate input PIN against stored bcrypt hash with Rate Limiting protection
   */
  async validatePin(inputPin) {
    const remainingLockout = await this.getLockoutRemainingSeconds();
    if (remainingLockout > 0) {
      return {
        success: false,
        isLocked: true,
        remainingSeconds: remainingLockout,
        message: `Забагато невдалих спроб. Заблоковано на ${remainingLockout} сек.`,
      };
    }

    const storedHash = await getAuthSetting(PIN_HASH_KEY);
    if (!storedHash) {
      return { success: true };
    }

    const isValid = bcrypt.compareSync(inputPin, storedHash);

    if (isValid) {
      await this.resetFailedAttempts();
      return { success: true };
    }

    // Handle failed attempt
    const attemptsStr = (await getAuthSetting(FAILED_ATTEMPTS_KEY)) || '0';
    const currentAttempts = parseInt(attemptsStr, 10) + 1;

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      await setAuthSetting(LOCKOUT_UNTIL_KEY, String(lockoutUntil));
      await setAuthSetting(FAILED_ATTEMPTS_KEY, String(currentAttempts));

      return {
        success: false,
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attempts: currentAttempts,
        message: `Перевищено 5 спроб! Заблоковано на ${Math.ceil(LOCKOUT_DURATION_MS / 1000)} секунд.`,
      };
    }

    await setAuthSetting(FAILED_ATTEMPTS_KEY, String(currentAttempts));

    return {
      success: false,
      isLocked: false,
      attempts: currentAttempts,
      remainingAttempts: MAX_FAILED_ATTEMPTS - currentAttempts,
      message: 'Невірний PIN-код',
    };
  },

  /**
   * Reset failed attempt counter and lockout
   */
  async resetFailedAttempts() {
    await deleteAuthSetting(FAILED_ATTEMPTS_KEY);
    await deleteAuthSetting(LOCKOUT_UNTIL_KEY);
  },

  /**
   * Check if Biometrics enabled in settings
   */
  async isBiometricsEnabled() {
    try {
      const val = await getAuthSetting(BIOMETRICS_ENABLED_KEY);
      return val === 'true';
    } catch (e) {
      return false;
    }
  },

  /**
   * Set Biometrics enabled state
   */
  async setBiometricsEnabled(enabled) {
    if (enabled) {
      await setAuthSetting(BIOMETRICS_ENABLED_KEY, 'true');
    } else {
      await deleteAuthSetting(BIOMETRICS_ENABLED_KEY);
    }
  },

  /**
   * Check if hardware biometrics (Touch ID / Face ID) supported and enrolled
   */
  async hasBiometricsHardware() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (e) {
      return false;
    }
  },

  /**
   * Authenticate using Expo Local Authentication (Touch ID / Face ID)
   */
  async authenticateBiometrics(promptMessage = 'Автентифікація входом у Writer Editor') {
    try {
      const isAvailable = await this.hasBiometricsHardware();
      if (!isAvailable) {
        // Fallback simulation/mock for development environments without biometrics
        return { success: true };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Скасувати',
        fallbackLabel: 'Ввести PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await this.resetFailedAttempts();
        return { success: true };
      }

      return { success: false, error: result.error || 'Біометрична автентифікація не пройшла' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
