import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export function StatBadge({ label, value }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
});
