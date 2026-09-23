import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme';

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'default',
  size = 'medium',
  disabled = false,
}) {
  const { colors } = useAppTheme();

  const sizeStyles = {
    small: styles.sizeSmall,
    medium: styles.sizeMedium,
    large: styles.sizeLarge,
  };

  const variantStyles = {
    default: { backgroundColor: colors.surface, borderColor: colors.border },
    accent: { backgroundColor: colors.accent, borderColor: colors.accent },
    destructive: { backgroundColor: '#FF4444', borderColor: '#FF4444' },
  };

  const textColor =
    variant === 'default' ? colors.textPrimary : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles[size],
        variantStyles[variant],
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, { fontSize: size === 'small' ? 16 : size === 'large' ? 24 : 20 }]}>
        {icon}
      </Text>
      {label && (
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: size === 'small' ? 11 : size === 'large' ? 14 : 12 },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 8,
  },
  sizeSmall: {
    height: 32,
    width: 32,
  },
  sizeMedium: {
    height: 44,
    width: 44,
  },
  sizeLarge: {
    height: 56,
    width: 56,
  },
  icon: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
