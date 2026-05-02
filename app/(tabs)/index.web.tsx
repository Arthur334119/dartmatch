import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
} from '@/lib/colors';
import { BAR_GAME_LABELS, BAR_FEATURE_LABELS } from '@/lib/constants';
import { Bar } from '@/lib/types';
import { getAllBars } from '@/lib/data';
import { BarCard } from '@/components/BarCard';
import { BarCardSkeleton } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';
import { PressableButton } from '@/components/PressableButton';
import { City, getCities, getMyCity, setMyCity } from '@/lib/cities';

export default function MapScreenWeb() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [maxBeerPrice, setMaxBeerPrice] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'rating' | 'name'>('rating');
  const [cities, setCities] = useState<City[]>([]);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);

  useEffect(() => {
    getAllBars().then((all) => {
      setBars(all);
      setLoading(false);
    });
    Promise.all([getCities(), getMyCity()]).then(([all, mine]) => {
      setCities(all);
      setActiveCityId(mine.id);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = bars.filter((b) => {
      const matchCity = activeCityId == null || b.cityId === activeCityId;
      const matchGames =
        selectedGames.size === 0 || [...selectedGames].every((g) => b.games.includes(g));
      const matchFeatures =
        selectedFeatures.size === 0 ||
        [...selectedFeatures].every((f) => b.features.includes(f));
      const matchPrice =
        maxBeerPrice == null || (b.beerPrice != null && b.beerPrice <= maxBeerPrice);
      const matchSearch =
        !q || b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q);
      return matchCity && matchGames && matchFeatures && matchPrice && matchSearch;
    });

    if (sortMode === 'rating') {
      return [...result].sort((a, b) => b.rating - a.rating);
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [bars, search, selectedGames, selectedFeatures, maxBeerPrice, sortMode, activeCityId]);

  const activeFilterCount =
    selectedGames.size + selectedFeatures.size + (maxBeerPrice != null ? 1 : 0);

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    haptic.selection();
    const copy = new Set(set);
    if (copy.has(key)) copy.delete(key);
    else copy.add(key);
    setter(copy);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: p.text }]}>Kneipen</Text>
          <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>
            {filtered.length === 1
              ? '1 Kneipe gefunden'
              : `${filtered.length} Kneipen gefunden`}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: p.surface }, shadows.sm]}>
          <Ionicons name="search" size={18} color={p.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: p.text }]}
            placeholder="Kneipe suchen…"
            placeholderTextColor={p.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={p.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: p.surface }, shadows.sm]}
          onPress={() => setFilterOpen(true)}
        >
          <Ionicons name="options" size={20} color={p.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {cities.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityRow}
        >
          {cities.map((c) => {
            const active = activeCityId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.cityPill,
                  {
                    backgroundColor: active ? colors.primary : p.surfaceMuted,
                  },
                ]}
                onPress={() => {
                  if (active) return;
                  haptic.selection();
                  setActiveCityId(c.id);
                  setMyCity(c.id).catch(() => {});
                }}
              >
                <Ionicons
                  name="location"
                  size={13}
                  color={active ? '#fff' : p.textMuted}
                />
                <Text
                  style={{
                    color: active ? '#fff' : p.text,
                    fontWeight: active ? '800' : '600',
                    fontSize: 13,
                  }}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        {(
          [
            { key: 'rating' as const, label: 'Top bewertet', icon: 'star' as const },
            { key: 'name' as const, label: 'A–Z', icon: 'text' as const },
          ]
        ).map((opt) => {
          const active = sortMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortPill,
                { backgroundColor: active ? colors.primary : p.surfaceMuted },
              ]}
              onPress={() => {
                if (sortMode !== opt.key) haptic.selection();
                setSortMode(opt.key);
              }}
            >
              <Ionicons
                name={opt.icon}
                size={13}
                color={active ? '#fff' : p.textMuted}
              />
              <Text
                style={{
                  color: active ? '#fff' : p.text,
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

      <View style={[styles.webNotice, { backgroundColor: p.primarySoft }]}>
        <Ionicons name="information-circle" size={16} color={colors.primaryDeep} />
        <Text style={{ color: colors.primaryDeep, fontSize: 12, fontWeight: '600', flex: 1 }}>
          Karten-Ansicht nur in der Mobile-App verfügbar.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 100,
          gap: spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading
          ? [0, 1, 2, 3, 4].map((i) => <BarCardSkeleton key={i} compact />)
          : filtered.map((bar) => (
              <BarCard
                key={bar.id}
                bar={bar}
                compact
                onPress={() => router.push(`/bar/${bar.id}`)}
              />
            ))}
        {!loading && filtered.length === 0 && (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: p.card, borderColor: p.divider },
            ]}
          >
            <Ionicons name="search-outline" size={32} color={p.textMuted} />
            <Text style={{ color: p.text, fontWeight: '700', marginTop: 8 }}>
              Keine Kneipen gefunden
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: alpha('#000', 0.5) }]}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: p.bg }]}>
            <View style={[styles.handle, { backgroundColor: p.textMuted + '4D' }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: p.text }]}>Filter</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={p.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Spiele</Text>
              <View style={styles.chipsWrap}>
                {Object.entries(BAR_GAME_LABELS).map(([key, label]) => {
                  const sel = selectedGames.has(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: sel ? p.primarySoft : p.surface,
                          borderColor: sel ? colors.primary : p.divider,
                        },
                      ]}
                      onPress={() => toggle(selectedGames, key, setSelectedGames)}
                    >
                      <Text
                        style={{
                          color: sel ? colors.primaryDeep : p.text,
                          fontWeight: sel ? '700' : '500',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[styles.sectionLabel, { color: p.textMuted, marginTop: spacing.xxl }]}
              >
                Eigenschaften
              </Text>
              <View style={styles.chipsWrap}>
                {Object.entries(BAR_FEATURE_LABELS).map(([key, label]) => {
                  const sel = selectedFeatures.has(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: sel ? p.secondarySoft : p.surface,
                          borderColor: sel ? colors.secondary : p.divider,
                        },
                      ]}
                      onPress={() => toggle(selectedFeatures, key, setSelectedFeatures)}
                    >
                      <Text
                        style={{
                          color: sel ? colors.secondary : p.text,
                          fontWeight: sel ? '700' : '500',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: spacing.xxl }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={[styles.sectionLabel, { color: p.textMuted }]}>
                    Max. Bierpreis
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {maxBeerPrice == null ? 'Egal' : `≤ ${maxBeerPrice.toFixed(2)} €`}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  {[null, 3, 4, 5, 6].map((v, i) => {
                    const active =
                      maxBeerPrice === v || (v === null && maxBeerPrice == null);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.priceChip,
                          {
                            backgroundColor: active ? colors.primary : p.surface,
                            borderColor: active ? colors.primary : p.divider,
                          },
                        ]}
                        onPress={() => setMaxBeerPrice(v)}
                      >
                        <Text
                          style={{
                            color: active ? '#fff' : p.text,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {v == null ? 'Egal' : `≤ ${v} €`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                { backgroundColor: p.bg, borderTopColor: p.divider },
              ]}
            >
              <PressableButton
                p={p}
                variant="secondary"
                label="Zurücksetzen"
                onPress={() => {
                  setSelectedGames(new Set());
                  setSelectedFeatures(new Set());
                  setMaxBeerPrice(null);
                }}
                disabled={activeFilterCount === 0}
              />
              <PressableButton
                p={p}
                label={`${filtered.length} ${filtered.length === 1 ? 'Ergebnis' : 'Ergebnisse'}`}
                onPress={() => setFilterOpen(false)}
                fullWidth
                style={{ flex: 1 }}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  cityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    height: '85%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
  },
});
