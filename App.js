import { useEffect } from 'react';
import { Platform, View } from 'react-native';
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

function AppContent() {
  const { mode, colors } = useAppTheme();

  useEffect(() => {
    initializeDatabase().catch((error) => {
      console.warn('DB init error:', error);
    });
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
