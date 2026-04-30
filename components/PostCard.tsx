import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Post, RsvpStatus, isPostExpired } from '@/lib/types';
import { BAR_GAME_LABELS } from '@/lib/constants';
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
import { getOrCreateChat } from '@/lib/chat';
import { clearRsvp, getMyRsvp, setRsvp as upsertRsvp } from '@/lib/data';
import { showAlert } from '@/lib/alert';
import { haptic } from '@/lib/haptics';

type Props = {
  post: Post;
  currentUserId: string;
  rsvpCounts?: { going: number; maybe: number; cant: number };
  onDelete?: () => void;
  onBarPress?: () => void;
  onRsvpChange?: () => void;
};

function formatEvent(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diffDays = Math.round(
    (day.getTime() - today.getTime()) / (24 * 3600_000),
  );
  if (diffDays === 0) return `Heute ${time}`;
  if (diffDays === 1) return `Morgen ${time}`;
  if (diffDays > 1 && diffDays < 7) {
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return `${weekdays[d.getDay()]} ${time}`;
  }
  return `${d.getDate()}.${d.getMonth() + 1}. ${time}`;
}

export function PostCard({
  post,
  currentUserId,
  rsvpCounts,
  onDelete,
  onBarPress,
  onRsvpChange,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const isOwner = post.userId === currentUserId;
  const isPlaying = post.type === 'playing';
  const expired = isPostExpired(post);
  const accent = isPlaying ? colors.success : colors.primary;
  const accentSoft = isPlaying ? alpha(colors.success, 0.14) : p.primarySoft;
  const [openingChat, setOpeningChat] = useState(false);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const isEvent = !!post.eventAt;
  const eventDate = post.eventAt ? new Date(post.eventAt) : null;
  const eventPast = eventDate ? eventDate.getTime() < Date.now() : false;
  const goingCount = rsvpCounts?.going ?? 0;
  const eventFull =
    post.maxAttendees != null && goingCount >= post.maxAttendees;

  useEffect(() => {
    if (!isEvent || !currentUserId) return;
    let cancelled = false;
    getMyRsvp(post.id).then((r) => {
      if (!cancelled) setMyRsvp(r);
    });
    return () => {
      cancelled = true;
    };
  }, [post.id, isEvent, currentUserId]);

  async function handleRsvp(status: RsvpStatus) {
    if (rsvpBusy) return;
    setRsvpBusy(true);
    try {
      if (myRsvp === status) {
        await clearRsvp(post.id);
        setMyRsvp(null);
      } else {
        await upsertRsvp(post.id, status);
        setMyRsvp(status);
        haptic.selection();
      }
      onRsvpChange?.();
    } catch (e: any) {
      showAlert('RSVP fehlgeschlagen', e?.message ?? 'Bitte erneut versuchen.');
    } finally {
      setRsvpBusy(false);
    }
  }

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

  async function startChat() {
    if (!post.userId || isOwner || openingChat) return;
    setOpeningChat(true);
    try {
      const chatId = await getOrCreateChat(post.userId, post.id);
      haptic.selection();
      router.push(`/chat/${chatId}` as any);
    } catch (e: any) {
      console.error('[post] chat open failed', e);
      showAlert(
        'Chat konnte nicht geöffnet werden',
        e?.message ?? 'Bitte erneut versuchen.',
      );
    } finally {
      setOpeningChat(false);
    }
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
                {BAR_GAME_LABELS[post.gameType] ?? post.gameType}
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
          {isEvent && eventDate && (
            <Meta
              icon="calendar"
              text={formatEvent(eventDate)}
              color={eventPast ? colors.error : colors.primaryDeep}
              p={p}
            />
          )}
          {post.playerCount != null && (
            <Meta
              icon="people-outline"
              text={`${post.playerCount} Spieler`}
              p={p}
            />
          )}
          {!isEvent && post.expiresAt && (
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
          {isEvent && rsvpCounts && (
            <Meta
              icon="checkmark-circle"
              text={
                post.maxAttendees != null
                  ? `${goingCount}/${post.maxAttendees} dabei`
                  : `${goingCount} dabei`
              }
              p={p}
            />
          )}
        </View>

        {isEvent && !isOwner && !eventPast && (
          <View style={styles.rsvpRow}>
            <RsvpButton
              label="Dabei"
              icon="checkmark"
              active={myRsvp === 'going'}
              accent={colors.success}
              disabled={
                rsvpBusy || (eventFull && myRsvp !== 'going')
              }
              onPress={() => handleRsvp('going')}
              p={p}
            />
            <RsvpButton
              label="Vielleicht"
              icon="help"
              active={myRsvp === 'maybe'}
              accent={colors.warning}
              disabled={rsvpBusy}
              onPress={() => handleRsvp('maybe')}
              p={p}
            />
            <RsvpButton
              label="Nope"
              icon="close"
              active={myRsvp === 'cant'}
              accent={colors.error}
              disabled={rsvpBusy}
              onPress={() => handleRsvp('cant')}
              p={p}
            />
          </View>
        )}

        {!isOwner && !expired && (
          <TouchableOpacity
            style={[
              styles.dmButton,
              { borderColor: alpha(accent, 0.3), backgroundColor: accentSoft },
            ]}
            onPress={startChat}
            activeOpacity={0.85}
            disabled={openingChat}
          >
            {openingChat ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={15} color={accent} />
                <Text style={[styles.dmButtonText, { color: accent }]}>
                  Nachricht schreiben
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function RsvpButton({
  label,
  icon,
  active,
  accent,
  disabled,
  onPress,
  p,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  accent: string;
  disabled: boolean;
  onPress: () => void;
  p: Palette;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.rsvpBtn,
        {
          backgroundColor: active ? accent : p.surfaceMuted,
          borderColor: active ? accent : p.divider,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={14} color={active ? '#fff' : accent} />
      <Text
        style={{
          color: active ? '#fff' : p.text,
          fontWeight: '700',
          fontSize: 12,
          marginLeft: 4,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  dmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  dmButtonText: { fontWeight: '700', fontSize: 13 },
  rsvpRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
