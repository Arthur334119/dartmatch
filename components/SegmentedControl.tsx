import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type LayoutChangeEvent,
  useColorScheme,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  palette,
  colors,
  radii,
  shadows,
} from '@/lib/colors';
import { haptic } from '@/lib/haptics';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: Props<T>) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const [width, setWidth] = useState(0);

  const segmentWidth = width === 0 ? 0 : (width - 8) / options.length;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const translateX = useSharedValue(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  useEffect(() => {
    if (segmentWidth <= 0) return;
    translateX.value = withSpring(activeIndex * segmentWidth, {
      damping: 22,
      stiffness: 240,
      mass: 0.5,
    });
  }, [activeIndex, segmentWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: p.surfaceMuted }]}
      onLayout={onLayout}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, indicatorStyle, shadows.sm]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.85}
            onPress={() => {
              if (opt.value !== value) {
                haptic.selection();
                onChange(opt.value);
              }
            }}
            style={styles.segment}
          >
            <Text
              style={{
                color: active ? colors.primaryDeep : p.textMuted,
                fontWeight: active ? '800' : '600',
                fontSize: 13,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    position: 'relative',
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    zIndex: 1,
  },
});
