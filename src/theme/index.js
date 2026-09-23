import { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const initialMode = systemScheme === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState(initialMode);

  const value = useMemo(() => ({
    mode,
    colors: colors[mode],
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    return {
      mode: 'dark',
      colors: colors.dark,
      setMode: () => {},
      toggleMode: () => {},
    };
  }

  return context;
}
