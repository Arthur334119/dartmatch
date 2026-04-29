import { View, Text, StyleSheet, useColorScheme, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  palette,
  colors,
  spacing,
} from '@/lib/colors';

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionLabel({ label, icon, trailing, style }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={colors.primaryDeep}
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={[styles.label, { color: p.textMuted }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: spacing.sm,
  },
  accent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
