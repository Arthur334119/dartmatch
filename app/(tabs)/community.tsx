import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
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
} from '@/lib/colors';
import { Post } from '@/lib/types';
import { getPosts, deletePost } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { supabase, TABLES } from '@/lib/supabase';
import { POST_TYPE_LOOKING, POST_TYPE_PLAYING } from '@/lib/constants';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { PostCardSkeleton } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';

const TABS: { key: string; label: string; type: string | null; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Alle', type: null, icon: 'apps' },
  { key: 'playing', label: 'Spielt', type: POST_TYPE_PLAYING, icon: 'flash' },
  { key: 'looking', label: 'Sucht', type: POST_TYPE_LOOKING, icon: 'search' },
];

export default function CommunityScreen() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [userId, setUserId] = useState<string>('');

  const filterType = TABS.find((t) => t.key === activeTab)?.type ?? null;

  const load = useCallback(async () => {
    const fetched = await getPosts({ type: filterType ?? undefined });
    setPosts(fetched);
    setLoading(false);
  }, [filterType]);

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id ?? ''));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: Feed live halten. Bei INSERT/DELETE komplett refetchen,
  // weil INSERT-Payloads keine joins (profiles, bars) liefern und der
  // Filter (type) clientseitig sitzt — refetch ist hier robuster als
  // Row-Merging.
  useEffect(() => {
    const channel = supabase
      .channel('posts-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.posts },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDelete(id: string) {
    await deletePost(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: p.text }]}>Community</Text>
          <Text style={[styles.subtitle, { color: p.textMuted }]}>
            Wer spielt heute Abend?
          </Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : p.surface,
                  borderColor: active ? colors.primary : p.divider,
                },
              ]}
              onPress={() => {
                if (t.key !== activeTab) haptic.selection();
                setActiveTab(t.key);
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? '#fff' : p.textMuted}
              />
              <Text
                style={{
                  color: active ? '#fff' : p.text,
                  fontWeight: active ? '700' : '600',
                  fontSize: 13,
                }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ paddingTop: spacing.sm }}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : posts.length === 0 ? (
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Noch keine Posts"
          message={
            activeTab === 'all'
              ? 'Sei die erste Person und such dir einen Mitspieler.'
              : 'In dieser Kategorie ist gerade nichts los.'
          }
          actionLabel="Post erstellen"
          actionIcon="add"
          onAction={() => router.push('/post/create')}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={userId}
              onDelete={() => handleDelete(item.id)}
              onBarPress={
                item.barId ? () => router.push(`/bar/${item.barId}`) : undefined
              }
            />
          )}
          contentContainerStyle={{
            paddingVertical: spacing.sm,
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

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          shadows.brand,
        ]}
        onPress={() => router.push('/post/create')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>Post erstellen</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderRadius: radii.pill,
    gap: 8,
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
