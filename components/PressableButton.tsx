import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  colors,
  radii,
  shadows,
  spacing,
  alpha,
  type Palette,
} from '@/lib/colors';
import { haptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  p: Palette;
  hapticOnPress?: boolean;
};

export function PressableButton({
  label,
  icon,
  loading,
  variant = 'primary',
  size = 'lg',
  fullWidth,
  style,
  labelStyle,
  p,
  hapticOnPress = true,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const palette = stylesFor(variant, p);
  const heightStyle = size === 'lg' ? styles.lg : styles.md;
  const labelSize = size === 'lg' ? styles.labelLg : styles.labelMd;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled || loading}
      onPressIn={(e) => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        opacity.value = withTiming(0.92, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 280 });
        opacity.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress && !disabled && !loading) haptic.light();
        onPress?.(e);
      }}
      style={[
        styles.base,
        heightStyle,
        palette.container,
        fullWidth && styles.fullWidth,
        disabled && { opacity: 0.45 },
        variant === 'primary' && shadows.brand,
        animated,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.spinner} />
      ) : (
        <View style={styles.row}>
          {icon && (
            <Ionicons name={icon} size={size === 'lg' ? 18 : 16} color={palette.iconColor} />
          )}
          <Text style={[labelSize, palette.label, labelStyle]}>{label}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function stylesFor(v: Variant, p: Palette) {
  switch (v) {
    case 'primary':
      return {
        container: { backgroundColor: colors.primary, borderColor: colors.primary },
        label: { color: '#fff' },
        iconColor: '#fff',
        spinner: '#fff',
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: p.surface,
          borderColor: p.divider,
          borderWidth: 1.5,
        },
        label: { color: p.text },
        iconColor: p.text,
        spinner: colors.primary,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderColor: 'transparent' },
        label: { color: colors.primary },
        iconColor: colors.primary,
        spinner: colors.primary,
      };
    case 'danger':
      return {
        container: { backgroundColor: alpha(colors.error, 0.12), borderColor: 'transparent' },
        label: { color: colors.error },
        iconColor: colors.error,
        spinner: colors.error,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  lg: { height: 54 },
  md: { height: 44 },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelLg: { fontWeight: '800', fontSize: 16 },
  labelMd: { fontWeight: '700', fontSize: 14 },
});
