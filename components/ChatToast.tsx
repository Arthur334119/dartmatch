import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, colors, spacing, radii, shadows } from '@/lib/colors';

export type ChatToastData = {
  chatId: string;
  username: string;
  avatarUrl: string | null;
  preview: string;
  // Eindeutiger Key, damit aufeinanderfolgende Nachrichten desselben Chats
  // den Toast neu anstoßen (Slide-Animation triggert per key-Wechsel).
  key: string;
};

const VISIBLE_MS = 3500;

export function ChatToast({
  data,
  onPress,
  onDismiss,
}: {
  data: ChatToastData | null;
  onPress: (chatId: string) => void;
  onDismiss: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, VISIBLE_MS);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [data?.key, translateY, opacity, onDismiss, data]);

  if (!data) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(data.chatId)}
        style={[
          styles.card,
          {
            backgroundColor: p.surface,
            borderColor: p.divider,
          },
          shadows.brand,
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
          {data.avatarUrl ? (
            <Image source={{ uri: data.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.primaryDeep }]}>
              {data.username.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
            {data.username}
          </Text>
          <Text
            style={[styles.preview, { color: p.textMuted }]}
            numberOfLines={1}
          >
            {data.preview}
          </Text>
        </View>
        <Ionicons name="chatbubble" size={18} color={colors.primary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    ...Platform.select({
      web: { pointerEvents: 'box-none' as any },
      default: {},
    }),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontWeight: '800', fontSize: 14 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700' },
  preview: { fontSize: 13, marginTop: 1 },
});
