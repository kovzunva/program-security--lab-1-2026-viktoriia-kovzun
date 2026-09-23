import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { Toast } from '../components/Toast';
import { t, useLocalization } from '../localization';
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

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('settings.heading')}</Text>

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  switchRowNarrow: {
    justifyContent: 'center',
  },
  switchLabel: {
    fontSize: 14,
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
});
