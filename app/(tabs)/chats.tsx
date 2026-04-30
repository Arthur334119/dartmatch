import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  RefreshControl,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  type Palette,
} from '@/lib/colors';
import { ChatPreview, getChats, subscribeIncomingMessages } from '@/lib/chat';
import { getCurrentUser } from '@/lib/auth';
import { timeAgo } from '@/lib/relative-time';
import { EmptyState } from '@/components/EmptyState';
import { PressableCard } from '@/components/PressableCard';

export default function ChatsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');

  const load = useCallback(async () => {
    const fetched = await getChats();
    setChats(fetched);
    setLoading(false);
  }, []);

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id ?? ''));
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeIncomingMessages(userId, () => load());
    return () => unsub();
  }, [userId, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: p.text }]}>Chats</Text>
        <Text style={[styles.subtitle, { color: p.textMuted }]}>
          Direkt-Nachrichten mit Spielpartner:innen
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: p.textMuted }}>Lade Chats…</Text>
        </View>
      ) : chats.length === 0 ? (
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Noch keine Chats"
          message={'Schreibe jemanden über einen „Sucht Gegner"-Post an, dann erscheint der Chat hier.'}
        />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ChatRow item={item} p={p} myUserId={userId} />
          )}
          contentContainerStyle={{
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function ChatRow({
  item,
  p,
  myUserId,
}: {
  item: ChatPreview;
  p: Palette;
  myUserId: string;
}) {
  const lastFromMe = item.lastMessageSenderId === myUserId;
  const preview = item.lastMessageContent
    ? `${lastFromMe ? 'Du: ' : ''}${item.lastMessageContent}`
    : 'Noch keine Nachrichten';
  return (
    <PressableCard
      style={[
        styles.row,
        { backgroundColor: p.card, borderColor: p.divider },
        shadows.sm,
      ]}
      onPress={() => router.push(`/chat/${item.id}` as any)}
      scaleTo={0.99}
      hapticOnPress={false}
    >
      <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
        {item.otherAvatarUrl ? (
          <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatarImg} />
        ) : (
          <Text style={[styles.avatarLetter, { color: colors.primaryDeep }]}>
            {item.otherUsername.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={styles.topRow}>
          <Text
            style={{ color: p.text, fontWeight: '700', fontSize: 15, flex: 1 }}
            numberOfLines={1}
          >
            {item.otherUsername}
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 11 }}>
            {timeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={{
              color: item.unreadCount > 0 ? p.text : p.textMuted,
              fontWeight: item.unreadCount > 0 ? '700' : '500',
              fontSize: 13,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBubble}>
              <Text style={styles.unreadBubbleText}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: 5,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontWeight: '800', fontSize: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  unreadBubble: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBubbleText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
});
