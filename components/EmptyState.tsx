import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
} from '@/lib/colors';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  compact?: boolean;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  compact,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View
        style={[
          styles.iconBubble,
          compact ? styles.iconBubbleCompact : null,
          { backgroundColor: p.primarySoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={compact ? 28 : 36}
          color={colors.primaryDeep}
        />
      </View>
      <Text style={[styles.title, { color: p.text, fontSize: compact ? 16 : 18 }]}>
        {title}
      </Text>
      {message && (
        <Text style={[styles.message, { color: p.textMuted }]}>{message}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.action, shadows.brand]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          {actionIcon && (
            <Ionicons name={actionIcon} size={16} color="#fff" />
          )}
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  compact: { flex: 0, paddingVertical: spacing.xxl },
  iconBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleCompact: { width: 64, height: 64, borderRadius: 32 },
  title: {
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.pill,
    marginTop: spacing.xl,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
