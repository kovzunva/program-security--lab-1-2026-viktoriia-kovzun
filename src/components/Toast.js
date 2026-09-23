import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';

const toastQueue = [];
let currentToast = null;

export const Toast = {
  show: (message, icon = '✓', duration = 2000) => {
    toastQueue.push({ message, icon, duration });
    if (!currentToast) {
      Toast._showNext();
    }
  },

  _showNext: () => {
    if (toastQueue.length === 0) {
      currentToast = null;
      return;
    }
    const toast = toastQueue.shift();
    currentToast = toast;
    setTimeout(() => {
      Toast._showNext();
    }, toast.duration + 300);
  },
};

export function ToastContainer() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentToast && toastRef.current !== currentToast) {
        setToast(currentToast);
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(currentToast.duration),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (!currentToast && toastRef.current) {
        setToast(null);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [opacity]);

  if (!toast) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          bottom: Math.max(insets.bottom, 14) + 14,
          left: Math.max(insets.left, 20),
          right: Math.max(insets.right, 20),
        },
      ]}
    >
      <Text style={[styles.icon]}>{toast.icon}</Text>
      <Text style={[styles.message, { color: colors.textPrimary }]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    zIndex: 1000,
  },
  icon: {
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
