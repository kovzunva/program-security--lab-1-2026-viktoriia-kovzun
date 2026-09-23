import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { t } from '../localization';
import { useAppTheme } from '../theme';

export function InfoScreen() {
  const { colors } = useAppTheme();

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          {t('info.heading')}
        </Text>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('info.authorSection')}
          </Text>
          <Text style={[styles.authorInfo, { color: colors.textPrimary }]}>
            {t('info.authorName')}
          </Text>
          <Text style={[styles.authorInfo, { color: colors.textSecondary }]}>
            {t('info.groupNumber')}
          </Text>
          <Text style={[styles.authorInfo, { color: colors.textSecondary }]}>
            {t('info.specialty')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('info.instructionSection')}
          </Text>
          <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
            {t('info.instruction1')}
          </Text>
          <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
            {t('info.instruction2')}
          </Text>
          <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
            {t('info.instruction3')}
          </Text>
          <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
            {t('info.instruction4')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('info.themeSection')}
          </Text>
          <Text style={[styles.justificationText, { color: colors.textSecondary }]}>
            {t('info.themeJustification')}
          </Text>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  authorInfo: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  justificationText: {
    fontSize: 13,
    lineHeight: 20,
  },
  spacer: {
    height: 20,
  },
});
