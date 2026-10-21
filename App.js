import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ToastContainer } from './src/components/Toast';
import { initializeDatabase } from './src/database/client';
import { LocalizationProvider } from './src/localization';
import { ThemeProvider, useAppTheme } from './src/theme';
import { authService } from './src/services/authService';
import { LockScreen } from './src/screens/LockScreen';

function AppContent() {
  const { mode, colors } = useAppTheme();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const appState = useRef(AppState.currentState);

  const checkAuthStatus = useCallback(async () => {
    try {
      await initializeDatabase();
      const pinActive = await authService.isPinEnabled();
      setIsPinEnabled(pinActive);
      if (!pinActive) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.warn('Init error:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // AppState Listener for auto-locking on backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        const pinActive = await authService.isPinEnabled();
        if (pinActive) {
          setIsAuthenticated(false);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark').catch(() => {});
  }, [colors.background, mode]);

  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accent,
    },
  };

  // Show LockScreen if PIN is enabled and user is not authenticated
  if (!isCheckingAuth && isPinEnabled && !isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} translucent={false} />
        <LockScreen
          title="Writer Editor"
          subtitle="Введіть ваш PIN-код для входу"
          onSuccess={() => setIsAuthenticated(true)}
        />
        <ToastContainer />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} translucent={false} />
        <AppNavigator />
        <ToastContainer />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocalizationProvider>
          <AppContent />
        </LocalizationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
