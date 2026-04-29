import { useEffect } from 'react';
import { StyleSheet, View, useColorScheme, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  palette,
  spacing,
  radii,
  alpha,
} from '@/lib/colors';

export function SkeletonBlock({
  width,
  height,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: alpha(p.textMuted, 0.18),
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function BarCardSkeleton({ compact }: { compact?: boolean }) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  if (compact) {
    return (
      <View
        style={[
          styles.compact,
          { backgroundColor: p.card, borderColor: p.divider },
        ]}
      >
        <SkeletonBlock width={76} height={76} radius={0} />
        <View style={styles.compactBody}>
          <SkeletonBlock width="70%" height={14} />
          <SkeletonBlock width="40%" height={12} style={{ marginTop: 6 }} />
          <SkeletonBlock width="90%" height={11} style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: p.card }]}>
      <SkeletonBlock width="100%" height={160} radius={0} />
      <View style={{ padding: spacing.lg }}>
        <SkeletonBlock width="70%" height={18} />
        <SkeletonBlock width="50%" height={12} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          <SkeletonBlock width={60} height={22} radius={radii.pill} />
          <SkeletonBlock width={70} height={22} radius={radii.pill} />
        </View>
      </View>
    </View>
  );
}

export function PostCardSkeleton() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  return (
    <View
      style={[
        styles.postCard,
        { backgroundColor: p.card, borderColor: p.divider },
      ]}
    >
      <View style={styles.accentStripe} />
      <View style={{ flex: 1, padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonBlock width={40} height={40} radius={20} />
          <View style={{ flex: 1, marginLeft: spacing.md, gap: 4 }}>
            <SkeletonBlock width="50%" height={14} />
            <SkeletonBlock width="30%" height={11} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <SkeletonBlock width={100} height={22} radius={radii.pill} />
          <SkeletonBlock width={70} height={22} radius={radii.pill} />
        </View>
        <SkeletonBlock width="100%" height={14} style={{ marginTop: spacing.md }} />
        <SkeletonBlock width="80%" height={14} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
  },
  compactBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  full: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  postCard: {
    marginHorizontal: spacing.lg,
    marginVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentStripe: {
    width: 4,
    backgroundColor: 'transparent',
  },
});
