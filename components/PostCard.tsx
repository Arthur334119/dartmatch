import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post, isPostExpired } from '@/lib/types';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
  type Palette,
} from '@/lib/colors';
import { timeAgo, formatTimeOfDay } from '@/lib/relative-time';
import { PressableCard } from '@/components/PressableCard';

type Props = {
  post: Post;
  currentUserId: string;
  onDelete?: () => void;
  onBarPress?: () => void;
};

export function PostCard({ post, currentUserId, onDelete, onBarPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const isOwner = post.userId === currentUserId;
  const isPlaying = post.type === 'playing';
  const expired = isPostExpired(post);
  const accent = isPlaying ? colors.success : colors.primary;
  const accentSoft = isPlaying ? alpha(colors.success, 0.14) : p.primarySoft;

  function confirmDelete() {
    Alert.alert(
      'Post löschen?',
      'Dieser Schritt kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: onDelete },
      ],
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        shadows.sm,
        expired && { opacity: 0.65 },
      ]}
    >
      <View style={[styles.accentStripe, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View
            style={[styles.avatar, { backgroundColor: p.primarySoft }]}
          >
            {post.avatarUrl ? (
              <Image source={{ uri: post.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarLetter, { color: colors.primaryDeep }]}>
                {(post.username ?? 'A').slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={{ color: p.text, fontWeight: '700', fontSize: 15 }}
              numberOfLines={1}
            >
              {post.username ?? 'Anonym'}
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 1 }}>
              {timeAgo(post.createdAt)}
            </Text>
          </View>
          {isOwner && onDelete && (
            <TouchableOpacity onPress={confirmDelete} hitSlop={10}>
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={p.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headlineRow}>
          <View style={[styles.typeChip, { backgroundColor: accentSoft }]}>
            <Ionicons
              name={isPlaying ? 'flash' : 'search'}
              size={13}
              color={accent}
            />
            <Text style={[styles.typeChipText, { color: accent }]}>
              {isPlaying ? 'Spielt gerade' : 'Sucht Gegner'}
            </Text>
          </View>
          {post.gameType && (
            <View style={[styles.gameChip, { backgroundColor: p.surfaceMuted }]}>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 12 }}>
                {post.gameType}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.content, { color: p.text }]}>
          {post.content}
        </Text>

        {post.barName && (
          <PressableCard
            onPress={onBarPress}
            style={[styles.barRow, { backgroundColor: p.surfaceMuted }]}
            scaleTo={0.98}
            hapticOnPress={false}
          >
            <Ionicons name="beer" size={16} color={colors.primary} />
            <Text
              style={{
                color: p.text,
                fontWeight: '600',
                marginLeft: 8,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {post.barName}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
          </PressableCard>
        )}

        <View style={styles.footerRow}>
          {post.playerCount != null && (
            <Meta
              icon="people-outline"
              text={`${post.playerCount} Spieler`}
              p={p}
            />
          )}
          {post.expiresAt && (
            <Meta
              icon="time-outline"
              text={
                expired
                  ? 'Abgelaufen'
                  : `Bis ${formatTimeOfDay(post.expiresAt)}`
              }
              color={expired ? colors.error : undefined}
              p={p}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function Meta({
  icon,
  text,
  color,
  p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color?: string;
  p: Palette;
}) {
  const c = color ?? p.textMuted;
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={c} />
      <Text style={{ color: c, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentStripe: { width: 4 },
  body: { flex: 1, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontWeight: '800', fontSize: 16 },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 4,
  },
  typeChipText: { fontWeight: '700', fontSize: 12 },
  gameChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  content: { fontSize: 15, lineHeight: 21, marginTop: spacing.md },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
});
