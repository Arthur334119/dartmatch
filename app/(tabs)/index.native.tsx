import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Keyboard,
  useColorScheme,
} from 'react-native';
import MapView, { Marker, UrlTile, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
} from '@/lib/colors';
import {
  BAR_GAME_LABELS,
  BAR_FEATURE_LABELS,
  BERLIN_LAT,
  BERLIN_LNG,
  DEFAULT_ZOOM_DELTA,
} from '@/lib/constants';
import { Bar } from '@/lib/types';
import { getAllBars, attachDistances } from '@/lib/data';
import { City, getMyCity } from '@/lib/cities';
import { BarCard } from '@/components/BarCard';
import { haptic } from '@/lib/haptics';
import { PressableButton } from '@/components/PressableButton';
import { BarCardSkeleton } from '@/components/Skeleton';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;
const COMPACT_VISIBLE = 300;
const COMPACT_TY = SHEET_HEIGHT - COMPACT_VISIBLE;
const EXPANDED_TY = 0;

export default function MapScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [maxBeerPrice, setMaxBeerPrice] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
  const [sortMode, setSortMode] = useState<'distance' | 'rating'>('distance');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const sheetTY = useSharedValue(COMPACT_TY);
  const sheetStartTY = useSharedValue(0);

  function snapTo(target: number, expanded: boolean) {
    sheetTY.value = withSpring(target, { damping: 22, stiffness: 200, mass: 0.6 });
    setSheetExpanded(expanded);
  }

  const sheetGesture = Gesture.Pan()
    .onStart(() => {
      sheetStartTY.value = sheetTY.value;
    })
    .onUpdate((e) => {
      const next = sheetStartTY.value + e.translationY;
      sheetTY.value = Math.max(EXPANDED_TY, Math.min(COMPACT_TY, next));
    })
    .onEnd((e) => {
      const mid = (EXPANDED_TY + COMPACT_TY) / 2;
      const shouldExpand =
        e.velocityY < -500 ||
        (e.velocityY < 500 && sheetTY.value < mid);
      const target = shouldExpand ? EXPANDED_TY : COMPACT_TY;
      sheetTY.value = withSpring(target, {
        damping: 22,
        stiffness: 200,
        mass: 0.6,
      });
      runOnJS(setSheetExpanded)(shouldExpand);
      runOnJS(haptic.light)();
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetTY.value,
      [EXPANDED_TY, COMPACT_TY],
      [0.4, 0],
      Extrapolation.CLAMP,
    ),
  }));

  useEffect(() => {
    (async () => {
      // Stadt zuerst, damit wir auch ohne Geolocation zentriert starten
      const myCity = await getMyCity();
      setCity(myCity);

      const perm = await Location.requestForegroundPermissionsAsync();
      let lat: number | null = null;
      let lng: number | null = null;
      if (perm.granted) {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          setUserLat(lat);
          setUserLng(lng);
        } catch {}
      }

      const all = await getAllBars();
      const enriched = lat != null && lng != null ? attachDistances(all, lat, lng) : all;
      setBars(enriched);
      setLoading(false);

      if (lat != null && lng != null) {
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: DEFAULT_ZOOM_DELTA,
            longitudeDelta: DEFAULT_ZOOM_DELTA,
          },
          500,
        );
      } else if (myCity) {
        mapRef.current?.animateToRegion(
          {
            latitude: myCity.centerLat,
            longitude: myCity.centerLng,
            latitudeDelta: myCity.zoomDelta,
            longitudeDelta: myCity.zoomDelta,
          },
          500,
        );
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = bars.filter((b) => {
      const matchGames =
        selectedGames.size === 0 || [...selectedGames].every((g) => b.games.includes(g));
      const matchFeatures =
        selectedFeatures.size === 0 || [...selectedFeatures].every((f) => b.features.includes(f));
      const matchPrice =
        maxBeerPrice == null || (b.beerPrice != null && b.beerPrice <= maxBeerPrice);
      const matchSearch =
        !q || b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q);
      return matchGames && matchFeatures && matchPrice && matchSearch;
    });

    if (sortMode === 'rating') {
      return [...result].sort((a, b) => b.rating - a.rating);
    }
    if (userLat != null && userLng != null) {
      return [...result].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return result;
  }, [bars, search, selectedGames, selectedFeatures, maxBeerPrice, sortMode, userLat, userLng]);

  const activeFilterCount =
    selectedGames.size + selectedFeatures.size + (maxBeerPrice != null ? 1 : 0);

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    haptic.selection();
    const copy = new Set(set);
    if (copy.has(key)) copy.delete(key);
    else copy.add(key);
    setter(copy);
  }

  function focusBar(bar: Bar) {
    haptic.light();
    setSelectedBar(bar);
    if (sheetExpanded) {
      sheetTY.value = withSpring(COMPACT_TY, {
        damping: 22,
        stiffness: 200,
        mass: 0.6,
      });
      setSheetExpanded(false);
    }
    mapRef.current?.animateToRegion(
      {
        latitude: bar.latitude - 0.003,
        longitude: bar.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }

  function recenterUser() {
    if (userLat == null || userLng == null) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLat,
        longitude: userLng,
        latitudeDelta: DEFAULT_ZOOM_DELTA,
        longitudeDelta: DEFAULT_ZOOM_DELTA,
      },
      400,
    );
  }

  const initialRegion: Region = {
    latitude: userLat ?? city?.centerLat ?? BERLIN_LAT,
    longitude: userLng ?? city?.centerLng ?? BERLIN_LNG,
    latitudeDelta: city?.zoomDelta ?? DEFAULT_ZOOM_DELTA,
    longitudeDelta: city?.zoomDelta ?? DEFAULT_ZOOM_DELTA,
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        onPress={() => setSelectedBar(null)}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
        />
        {filtered.map((bar) => {
          const active = selectedBar?.id === bar.id;
          return (
            <Marker
              key={bar.id}
              coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
              onPress={(e) => {
                e.stopPropagation();
                focusBar(bar);
              }}
            >
              <View
                style={[
                  styles.markerDot,
                  active ? styles.markerDotActive : styles.markerDotIdle,
                ]}
              >
                <Ionicons name="beer" size={active ? 20 : 16} color="#fff" />
              </View>
              {active && <View style={styles.markerTail} />}
            </Marker>
          );
        })}
      </MapView>

      <Animated.View
        pointerEvents={sheetExpanded ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFillObject, styles.dim, dimStyle]}
        onTouchStart={() => snapTo(COMPACT_TY, false)}
      />


      {/* Top controls */}
      <View
        style={[
          styles.topRow,
          { top: insets.top + spacing.md },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: p.surface }, shadows.md]}>
          <Ionicons
            name="search"
            size={18}
            color={searchFocused ? colors.primary : p.textMuted}
          />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: p.text }]}
            placeholder="Kneipe suchen…"
            placeholderTextColor={p.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={p.textMuted} />
            </TouchableOpacity>
          ) : userLat != null ? (
            <TouchableOpacity onPress={recenterUser} hitSlop={8}>
              <Ionicons name="locate" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {searchFocused ? (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              searchRef.current?.blur();
              setSearch('');
            }}
            style={styles.cancelSearch}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
              Abbrechen
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: p.surface }, shadows.md]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="options" size={20} color={p.text} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom sheet (drag-resizable) */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: p.bg, height: SHEET_HEIGHT },
          shadows.lg,
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={sheetGesture}>
          <View style={styles.sheetHeader}>
            <View style={[styles.handle, { backgroundColor: p.textMuted + '4D' }]} />

            {selectedBar ? (
              <View style={styles.selectedBox}>
                <View style={styles.selectedHeader}>
                  <View style={styles.selectedLabelRow}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.selectedLabel, { color: p.textMuted }]}>
                      Ausgewählt
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBar(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={p.textMuted} />
                  </TouchableOpacity>
                </View>
                <BarCard
                  bar={selectedBar}
                  compact
                  onPress={() => router.push(`/bar/${selectedBar.id}`)}
                />
              </View>
            ) : search.trim().length > 0 || activeFilterCount > 0 ? (
              <View style={styles.sheetTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: p.text }]}>
                    {search.trim().length > 0 ? 'Suchergebnisse' : 'Gefilterte Kneipen'}
                  </Text>
                  <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
                    {filtered.length === 1
                      ? '1 Kneipe gefunden'
                      : `${filtered.length} Kneipen gefunden`}
                  </Text>
                </View>
                {activeFilterCount > 0 && (
                  <View style={[styles.activePill, { backgroundColor: p.primarySoft }]}>
                    <Text style={{ color: colors.primaryDeep, fontWeight: '700', fontSize: 12 }}>
                      {activeFilterCount} Filter
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.sortRow}>
                {(
                  [
                    { key: 'distance' as const, label: 'In der Nähe', icon: 'navigate' as const },
                    { key: 'rating' as const, label: 'Top bewertet', icon: 'star' as const },
                  ]
                ).map((opt) => {
                  const active = sortMode === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.sortPill,
                        {
                          backgroundColor: active ? colors.primary : p.surfaceMuted,
                        },
                      ]}
                      onPress={() => {
                        if (sortMode !== opt.key) haptic.selection();
                        setSortMode(opt.key);
                      }}
                      activeOpacity={0.85}
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
                <TouchableOpacity
                  style={[styles.expandBtn, { backgroundColor: p.surfaceMuted }]}
                  onPress={() =>
                    snapTo(
                      sheetExpanded ? COMPACT_TY : EXPANDED_TY,
                      !sheetExpanded,
                    )
                  }
                >
                  <Ionicons
                    name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={p.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GestureDetector>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          scrollEnabled={sheetExpanded}
        >
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <View key={i} style={{ marginBottom: spacing.sm }}>
                  <BarCardSkeleton compact />
                </View>
              ))
            : filtered.map((bar) => (
                <View key={bar.id} style={{ marginBottom: spacing.sm }}>
                  <BarCard
                    bar={bar}
                    compact
                    onPress={() => router.push(`/bar/${bar.id}`)}
                  />
                </View>
              ))}
          {filtered.length === 0 && !loading && (
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
              <Text
                style={{
                  color: p.textMuted,
                  fontSize: 13,
                  marginTop: 2,
                  textAlign: 'center',
                }}
              >
                Versuch andere Filter oder einen anderen Suchbegriff.
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        selectedGames={selectedGames}
        selectedFeatures={selectedFeatures}
        maxBeerPrice={maxBeerPrice}
        onToggleGame={(g) => toggle(selectedGames, g, setSelectedGames)}
        onToggleFeature={(f) => toggle(selectedFeatures, f, setSelectedFeatures)}
        onChangePrice={setMaxBeerPrice}
        onReset={() => {
          setSelectedGames(new Set());
          setSelectedFeatures(new Set());
          setMaxBeerPrice(null);
        }}
        resultCount={filtered.length}
      />
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  selectedGames,
  selectedFeatures,
  maxBeerPrice,
  onToggleGame,
  onToggleFeature,
  onChangePrice,
  onReset,
  resultCount,
}: {
  visible: boolean;
  onClose: () => void;
  selectedGames: Set<string>;
  selectedFeatures: Set<string>;
  maxBeerPrice: number | null;
  onToggleGame: (g: string) => void;
  onToggleFeature: (f: string) => void;
  onChangePrice: (v: number | null) => void;
  onReset: () => void;
  resultCount: number;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const activeCount =
    selectedGames.size + selectedFeatures.size + (maxBeerPrice != null ? 1 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: alpha('#000', 0.5) }]}>
        <SafeAreaView style={[styles.modalSheet, { backgroundColor: p.bg }]}>
          <View style={[styles.handle, { backgroundColor: p.textMuted + '4D' }]} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: p.text, fontSize: 22 }]}>
                Filter
              </Text>
              <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
                {activeCount === 0
                  ? 'Verfeinere deine Suche'
                  : `${activeCount} aktiv`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={p.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
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
                    onPress={() => onToggleGame(key)}
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
                    onPress={() => onToggleFeature(key)}
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
                  const active = maxBeerPrice === v || (v === null && maxBeerPrice == null);
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
                      onPress={() => onChangePrice(v)}
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
              {
                backgroundColor: p.bg,
                borderTopColor: p.divider,
              },
            ]}
          >
            <PressableButton
              p={p}
              variant="secondary"
              label="Zurücksetzen"
              onPress={onReset}
              disabled={activeCount === 0}
            />
            <PressableButton
              p={p}
              label={`${resultCount} ${resultCount === 1 ? 'Ergebnis' : 'Ergebnisse'} anzeigen`}
              onPress={onClose}
              fullWidth
              style={{ flex: 1 }}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: '#000' },
  markerDot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  markerDotIdle: {
    backgroundColor: colors.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerDotActive: {
    backgroundColor: colors.primary,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    alignSelf: 'center',
    marginTop: -3,
  },
  topRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    height: 50,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSearch: {
    height: 50,
    paddingHorizontal: 4,
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingTop: spacing.sm,
  },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  selectedBox: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  selectedLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
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
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  activePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
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
