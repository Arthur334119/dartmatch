import { forwardRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  palette,
  colors,
  spacing,
  radii,
} from '@/lib/colors';

type Props = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
  success?: boolean;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  trailing?: React.ReactNode;
  onToggleSecure?: () => void;
  isSecure?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  {
    icon,
    hint,
    success,
    error,
    containerStyle,
    trailing,
    onToggleSecure,
    isSecure,
    onFocus,
    onBlur,
    style,
    ...rest
  },
  ref,
) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const [focused, setFocused] = useState(false);

  const focusProgress = useSharedValue(0);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, { duration: 160 });
  }, [focused, focusProgress]);

  const idleColor = error
    ? colors.error
    : success
      ? colors.success
      : p.divider;
  const focusColor = error
    ? colors.error
    : success
      ? colors.success
      : colors.primary;

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [idleColor, focusColor],
    ),
  }));

  const multiline = !!rest.multiline;

  return (
    <View style={[{ marginBottom: spacing.sm }, containerStyle]}>
      <Animated.View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: p.surface },
          animatedBorder,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? colors.primary : p.textMuted}
            style={multiline ? { marginTop: 2 } : undefined}
          />
        )}
        <TextInput
          ref={ref}
          {...rest}
          placeholderTextColor={p.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { color: p.text },
            style,
          ]}
        />
        {success && (
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        )}
        {onToggleSecure && (
          <TouchableOpacity onPress={onToggleSecure} hitSlop={8}>
            <Ionicons
              name={isSecure ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={p.textMuted}
            />
          </TouchableOpacity>
        )}
        {trailing}
      </Animated.View>
      {hint && (
        <Text
          style={[
            styles.hint,
            { color: error ? colors.error : p.textMuted },
          ]}
        >
          {hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 54,
    gap: spacing.sm,
  },
  fieldMultiline: {
    height: undefined,
    minHeight: 100,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'flex-start',
  },
  input: { flex: 1, fontSize: 16 },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 76,
    lineHeight: 21,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: spacing.sm,
  },
});
