import { createContext, useContext, useMemo, useState } from 'react';
import { uk } from './uk';
import { en } from './en';
import { de } from './de';

const dictionaries = {
  uk,
  en,
  de,
};

let currentLocale = 'uk';

const LocalizationContext = createContext(null);

export function LocalizationProvider({ children }) {
  const [locale, setLocale] = useState('uk');
  currentLocale = locale;

  const value = useMemo(() => ({
    locale,
    setLocale,
    availableLocales: ['uk', 'en', 'de'],
  }), [locale]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }

  return context;
}

export function t(path) {
  const segments = path.split('.');
  let current = dictionaries[currentLocale] || dictionaries.uk;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return path;
    }

    current = current[segment];
  }

  return typeof current === 'string' ? current : path;
}
