import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  FlatList,
  Dimensions,
  useColorScheme,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
  type Palette,
} from '@/lib/colors';
import { Bar, GooglePlaceDetails, Review } from '@/lib/types';
import {
  getBar,
  getBarReviews,
  getGooglePlaceDetails,
  isCheckedIn as fetchIsCheckedIn,
  getPresenceCount,
  checkIn,
  checkOut,
  addReview,
} from '@/lib/data';
import { supabase, TABLES } from '@/lib/supabase';
import {
  BAR_GAME_LABELS,
  BAR_FEATURE_LABELS,
  DAY_KEYS,
  DAY_NAMES_DE,
} from '@/lib/constants';
import { StarRow } from '@/components/StarRow';
import { SkeletonBlock } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';
import { PressableButton } from '@/components/PressableButton';
import { ReviewItem } from '@/components/ReviewItem';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';

type Tab = 'info' | 'games' | 'reviews';

const HERO_HEIGHT = 280;
const STICKY_TRIGGER = 180;

export default function BarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [bar, setBar] = useState<Bar | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [presence, setPresence] = useState(0);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [places, setPlaces] = useState<GooglePlaceDetails | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  const scrollY = useSharedValue(0);
  const [statusBarLight, setStatusBarLight] = useState(true);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  useDerivedValue(() => {
    const shouldBeLight = scrollY.value < STICKY_TRIGGER - 20;
    runOnJS(setStatusBarLight)(shouldBeLight);
  }, [scrollY]);

  const stickyHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [STICKY_TRIGGER - 40, STICKY_TRIGGER],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [STICKY_TRIGGER - 40, STICKY_TRIGGER],
          [-8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-120, 0, HERO_HEIGHT],
          [-60, 0, HERO_HEIGHT * 0.4],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-120, 0],
          [1.3, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroOverlayContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, STICKY_TRIGGER - 40],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  // Realtime: Presence-Counter live aktualisieren, wenn jemand
  // ein-/auscheckt. Bei jedem Event aus der presence-Tabelle für
  // dieses Bar einfach refetchen — billiger als die Row selbst zu
  // mergen (expires_at-Filter ist im count drin).
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`presence-bar-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.presence,
          filter: `bar_id=eq.${id}`,
        },
        async () => {
          const c = await getPresenceCount(id);
          setPresence(c);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function load() {
    if (!id) return;
    const [b, r, c, pCount] = await Promise.all([
      getBar(id),
      getBarReviews(id),
      fetchIsCheckedIn(id),
      getPresenceCount(id),
    ]);
    setBar(b);
    setReviews(r);
    setChecked(c);
    setPresence(pCount);
    setLoading(false);

    // Google-Places lazy nachziehen — UI ist schon da, das macht den
    // Hero schöner sobald die Daten reinkommen, blockiert aber nichts.
    if (b?.googlePlaceId) {
      getGooglePlaceDetails(b.googlePlaceId).then(setPlaces);
    }
  }

  // Hero-Foto: wenn Google-Photos verfügbar, nimm das erste — sonst
  // das in der DB gespeicherte (Unsplash-Fallback aus 20260429-Migration).
  const photos = places?.photos ?? [];
  const heroImageUrl = photos[0]?.url ?? bar?.imageUrl ?? null;
  const hasGallery = photos.length > 1;

  function openGalleryAt(idx: number) {
    if (!hasGallery) return;
    haptic.light();
    setGalleryStartIndex(idx);
    setGalleryOpen(true);
  }

  async function toggleCheck() {
    if (!bar || checkingIn) return;
    setCheckingIn(true);
    try {
      if (checked) {
        await checkOut(bar.id);
        setChecked(false);
        setPresence((n) => Math.max(0, n - 1));
        haptic.light();
      } else {
        await checkIn(bar.id);
        setChecked(true);
        setPresence((n) => n + 1);
        haptic.success();
      }
    } catch (e: any) {
      const msg =
        e?.code === '42501'
          ? 'Bitte bestätige deine E-Mail und lade ein Profilbild hoch.'
          : e?.message ?? 'Fehler beim Check-in.';
      Alert.alert('Check-in fehlgeschlagen', msg);
    } finally {
      setCheckingIn(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: p.bg }]}>
        <SkeletonBlock width="100%" height={HERO_HEIGHT} radius={0} />
        <View
          style={[styles.topButtons, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.statsCard,
            { backgroundColor: p.card, borderColor: p.divider },
            shadows.md,
          ]}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.stat}>
              <SkeletonBlock width={32} height={32} radius={16} />
              <SkeletonBlock width={40} height={14} style={{ marginTop: 6 }} />
              <SkeletonBlock width={32} height={10} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
        <View style={[styles.tabBar, { marginTop: spacing.xl }]}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock
              key={i}
              height={42}
              radius={radii.pill}
              style={{ flex: 1, marginHorizontal: 4 }}
            />
          ))}
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <SkeletonBlock width="40%" height={18} />
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="90%" height={14} />
          <SkeletonBlock width="70%" height={14} />
        </View>
      </View>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.bg,
        }}
      >
        <Text style={{ color: p.text }}>Diese Kneipe existiert nicht mehr.</Text>
      </SafeAreaView>
    );
  }

  const todayIdx = (new Date().getDay() + 6) % 7; // Mo=0
  const todayKey = DAY_KEYS[todayIdx];
  const isOpenToday = !!bar.openingHours[todayKey];

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <StatusBar
        style={statusBarLight ? 'light' : scheme === 'dark' ? 'light' : 'dark'}
        animated
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero with parallax */}
        <View style={styles.heroWrap}>
          <Animated.View style={[StyleSheet.absoluteFill, heroParallaxStyle]}>
            {heroImageUrl ? (
              <TouchableOpacity
                activeOpacity={hasGallery ? 0.92 : 1}
                onPress={() => openGalleryAt(0)}
                disabled={!hasGallery}
                style={styles.hero}
              >
                <Image source={{ uri: heroImageUrl }} style={styles.hero} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.hero, styles.heroFallback]}>
                <Ionicons name="beer" size={88} color={alpha('#fff', 0.85)} />
              </View>
            )}
          </Animated.View>
          <View style={styles.heroOverlayTop} pointerEvents="none" />
          <View style={styles.heroOverlayBottom} pointerEvents="none" />

          <Animated.View
            style={[styles.heroContent, heroOverlayContentStyle]}
            pointerEvents="box-none"
          >
            <View style={styles.heroChips}>
              <View style={styles.heroRating}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.heroRatingText}>
                  {bar.rating.toFixed(1)}
                </Text>
                <Text style={styles.heroRatingMuted}>
                  ({bar.reviewCount})
                </Text>
              </View>
              {presence > 0 && (
                <View
                  style={[styles.presencePill, { backgroundColor: alpha(colors.success, 0.95) }]}
                >
                  <View
                    style={[
                      styles.openDot,
                      { backgroundColor: '#fff' },
                    ]}
                  />
                  <Text style={styles.presencePillText}>
                    {presence} vor Ort
                  </Text>
                </View>
              )}
              {hasGallery && (
                <TouchableOpacity
                  onPress={() => openGalleryAt(0)}
                  activeOpacity={0.85}
                  style={[styles.galleryPill, { backgroundColor: alpha('#000', 0.55) }]}
                >
                  <Ionicons name="images" size={12} color="#fff" />
                  <Text style={styles.presencePillText}>
                    1 / {photos.length}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {bar.name}
            </Text>
            <View style={styles.heroAddressRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={alpha('#fff', 0.85)}
              />
              <Text style={styles.heroAddress} numberOfLines={1}>
                {bar.address}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Floating stats card */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: p.card, borderColor: p.divider },
            shadows.md,
          ]}
        >
          <Stat
            icon="beer"
            iconColor={colors.primary}
            value={bar.beerPrice != null ? `${bar.beerPrice.toFixed(2)} €` : '–'}
            label="Bier"
            p={p}
          />
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <Stat
            icon="people"
            iconColor={presence > 0 ? colors.success : p.textMuted}
            value={String(presence)}
            label="Vor Ort"
            p={p}
          />
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <Stat
            icon="game-controller"
            iconColor={colors.secondary}
            value={String(bar.games.length)}
            label="Spiele"
            p={p}
          />
        </View>

        {/* Segmented control */}
        <View style={styles.tabBar}>
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'games', label: 'Spiele' },
              { value: 'reviews', label: 'Bewertungen' },
            ]}
          />
        </View>

        {/* Tab content */}
        <Animated.View
          key={tab}
          entering={FadeIn.duration(220)}
          style={{ padding: spacing.xl, paddingTop: spacing.md }}
        >
          {tab === 'info' && (
            <View>
              {bar.description ? (
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={[styles.sectionTitle, { color: p.text }]}>
                    Beschreibung
                  </Text>
                  <Text
                    style={{
                      color: p.text,
                      marginTop: 6,
                      lineHeight: 21,
                      fontSize: 15,
                    }}
                  >
                    {bar.description}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: p.card, borderColor: p.divider },
                ]}
              >
                <InfoRow
                  icon="location"
                  text={bar.address}
                  p={p}
                  onPress={() => openMaps(bar.latitude, bar.longitude, bar.name)}
                />
                {bar.phone && (
                  <>
                    <Sep p={p} />
                    <InfoRow
                      icon="call"
                      text={bar.phone}
                      p={p}
                      onPress={() => Linking.openURL(`tel:${bar.phone}`)}
                    />
                  </>
                )}
                {bar.website && (
                  <>
                    <Sep p={p} />
                    <InfoRow
                      icon="globe"
                      text={bar.website}
                      p={p}
                      onPress={() => openWebsite(bar.website!)}
                    />
                  </>
                )}
                {bar.beerPrice != null && (
                  <>
                    <Sep p={p} />
                    <InfoRow
                      icon="beer"
                      text={`Bier ab ${bar.beerPrice.toFixed(2)} €`}
                      p={p}
                    />
                  </>
                )}
                {bar.capacity != null && (
                  <>
                    <Sep p={p} />
                    <InfoRow
                      icon="people"
                      text={`Kapazität: ${bar.capacity} Personen`}
                      p={p}
                    />
                  </>
                )}
              </View>

              {Object.keys(bar.openingHours).length > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <Text style={[styles.sectionTitle, { color: p.text }]}>
                    Öffnungszeiten
                  </Text>
                  <View
                    style={[
                      styles.infoCard,
                      {
                        backgroundColor: p.card,
                        borderColor: p.divider,
                        marginTop: spacing.sm,
                      },
                    ]}
                  >
                    {DAY_KEYS.map((day, i) => {
                      const isToday = day === todayKey;
                      const value = bar.openingHours[day] ?? 'Geschlossen';
                      return (
                        <View key={day}>
                          {i > 0 && <Sep p={p} />}
                          <View
                            style={[
                              styles.hoursRow,
                              isToday && {
                                backgroundColor: p.primarySoft,
                                borderRadius: radii.sm,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                width: 110,
                                color: isToday ? colors.primaryDeep : p.text,
                                fontWeight: isToday ? '800' : '500',
                                fontSize: 14,
                              }}
                            >
                              {DAY_NAMES_DE[day]}
                              {isToday && ' (heute)'}
                            </Text>
                            <Text
                              style={{
                                color: isToday ? colors.primaryDeep : p.textMuted,
                                fontWeight: isToday ? '700' : '500',
                                fontSize: 14,
                              }}
                            >
                              {value}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {tab === 'games' && (
            <View>
              {bar.games.length === 0 && bar.features.length === 0 ? (
                <View style={styles.emptyTabState}>
                  <Ionicons
                    name="game-controller-outline"
                    size={36}
                    color={p.textMuted}
                  />
                  <Text style={{ color: p.textMuted, marginTop: 8 }}>
                    Keine Angaben.
                  </Text>
                </View>
              ) : (
                <>
                  {bar.games.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: p.text }]}>
                        Spiele
                      </Text>
                      <View style={{ marginTop: spacing.sm, gap: 8 }}>
                        {bar.games.map((g) => (
                          <ListEntry
                            key={g}
                            label={BAR_GAME_LABELS[g] ?? g}
                            color={colors.primary}
                            p={p}
                          />
                        ))}
                      </View>
                    </>
                  )}
                  {bar.features.length > 0 && (
                    <>
                      <Text
                        style={[
                          styles.sectionTitle,
                          { color: p.text, marginTop: spacing.xl },
                        ]}
                      >
                        Eigenschaften
                      </Text>
                      <View style={{ marginTop: spacing.sm, gap: 8 }}>
                        {bar.features.map((f) => (
                          <ListEntry
                            key={f}
                            label={BAR_FEATURE_LABELS[f] ?? f}
                            color={colors.secondary}
                            p={p}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {tab === 'reviews' && (
            <ReviewsTab
              reviews={reviews}
              googleReviews={places?.reviews ?? []}
              googleMapsUri={places?.googleMapsUri ?? null}
              barName={bar.name}
              p={p}
              onAddPress={() => setReviewOpen(true)}
            />
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Floating top buttons (always visible) */}
      <View
        style={[styles.topButtons, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View
          style={[
            styles.openBadge,
            {
              backgroundColor: alpha(
                isOpenToday ? colors.success : colors.error,
                0.95,
              ),
            },
          ]}
        >
          <View style={styles.openDot} />
          <Text style={styles.openBadgeText}>
            {isOpenToday ? 'Heute geöffnet' : 'Heute zu'}
          </Text>
        </View>
      </View>

      {/* Sticky title header (fades in on scroll) */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            paddingTop: insets.top,
            backgroundColor: p.bg,
            borderBottomColor: p.divider,
          },
          stickyHeaderStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.stickyHeaderRow}>
          <Text
            style={[styles.stickyTitle, { color: p.text }]}
            numberOfLines={1}
          >
            {bar.name}
          </Text>
        </View>
      </Animated.View>

      {/* Sticky bottom action */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: p.bg,
            borderTopColor: p.divider,
          },
          shadows.lg,
        ]}
      >
        <PressableButton
          p={p}
          label={
            checked ? 'Du bist da · Tippen zum Auschecken' : 'Hier einchecken'
          }
          icon={checked ? 'checkmark-circle' : 'location'}
          loading={checkingIn}
          onPress={toggleCheck}
          fullWidth
          style={
            checked && {
              backgroundColor: colors.success,
              borderColor: colors.success,
              shadowColor: colors.success,
            }
          }
        />
      </View>

      <PhotoGalleryModal
        visible={galleryOpen}
        photos={photos}
        startIndex={galleryStartIndex}
        onClose={() => setGalleryOpen(false)}
      />

      <AddReviewModal
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        barName={bar.name}
        onSubmit={async (rating, content) => {
          try {
            await addReview({ barId: bar.id, rating, content });
            setReviewOpen(false);
            await load();
          } catch (e: any) {
            const msg =
              e?.code === '23505'
                ? 'Du hast diese Kneipe schon bewertet.'
                : e?.code === '42501'
                  ? 'Bitte bestätige zuerst deine E-Mail und lade ein Profilbild hoch.'
                  : e?.message ?? 'Bewertung fehlgeschlagen.';
            Alert.alert('Fehler', msg);
          }
        }}
      />
    </View>
  );
}

function Stat({
  icon,
  iconColor,
  value,
  label,
  p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value: string;
  label: string;
  p: Palette;
}) {
  return (
    <View style={styles.stat}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: alpha(iconColor ?? p.textMuted, 0.14) },
        ]}
      >
        <Ionicons name={icon} size={16} color={iconColor ?? p.textMuted} />
      </View>
      <Text style={[styles.statValue, { color: p.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: p.textMuted }]}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  text,
  p,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  p: Palette;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={[styles.infoIcon, { backgroundColor: p.primarySoft }]}>
        <Ionicons name={icon} size={16} color={colors.primaryDeep} />
      </View>
      <Text style={{ flex: 1, color: p.text, fontSize: 15 }}>{text}</Text>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.infoRow}>{content}</View>;
}

function openMaps(lat: number, lng: number, label: string) {
  const enc = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps://?q=${enc}&ll=${lat},${lng}`,
    default: `geo:${lat},${lng}?q=${lat},${lng}(${enc})`,
  });
  if (url) Linking.openURL(url).catch(() => {});
}

function openWebsite(raw: string) {
  const url = raw.startsWith('http') ? raw : `https://${raw}`;
  Linking.openURL(url).catch(() => {});
}

function Sep({ p }: { p: Palette }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: p.divider,
        marginVertical: 2,
      }}
    />
  );
}

function ListEntry({
  label,
  color,
  p,
}: {
  label: string;
  color: string;
  p: Palette;
}) {
  return (
    <View
      style={[
        styles.listEntry,
        { backgroundColor: p.card, borderColor: p.divider },
      ]}
    >
      <View
        style={[styles.listEntryIcon, { backgroundColor: alpha(color, 0.14) }]}
      >
        <Ionicons name="checkmark" size={18} color={color} />
      </View>
      <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>
        {label}
      </Text>
    </View>
  );
}

function ReviewsTab({
  reviews,
  googleReviews,
  googleMapsUri,
  barName,
  p,
  onAddPress,
}: {
  reviews: Review[];
  googleReviews: import('@/lib/types').GooglePlaceReview[];
  googleMapsUri: string | null;
  barName: string;
  p: Palette;
  onAddPress: () => void;
}) {
  const count = reviews.length;
  const avg = count === 0 ? 0 : reviews.reduce((a, r) => a + r.rating, 0) / count;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const b = Math.min(5, Math.max(1, Math.round(r.rating)));
    dist[b] = (dist[b] ?? 0) + 1;
  }
  const maxBucket = Math.max(...Object.values(dist), 1);

  return (
    <View>
      <View
        style={[
          styles.summary,
          { backgroundColor: p.card, borderColor: p.divider },
        ]}
      >
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryAvg, { color: p.text }]}>
            {count === 0 ? '–' : avg.toFixed(1)}
          </Text>
          <StarRow rating={avg} size={14} />
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 4 }}>
            {count === 1 ? '1 Bewertung' : `${count} Bewertungen`}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const n = dist[stars] ?? 0;
            const pct = n / maxBucket;
            return (
              <View key={stars} style={styles.barRow}>
                <Text style={{ width: 12, color: p.text, fontSize: 12, fontWeight: '600' }}>
                  {stars}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: p.divider }]}>
                  <View
                    style={{
                      width: `${pct * 100}%`,
                      height: '100%',
                      backgroundColor: colors.warning,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <Text
                  style={{
                    width: 22,
                    textAlign: 'right',
                    color: p.textMuted,
                    fontSize: 12,
                  }}
                >
                  {n}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.reviewHeader}>
        <Text style={[styles.sectionTitle, { color: p.text }]}>
          {count} {count === 1 ? 'Bewertung' : 'Bewertungen'}
        </Text>
        <TouchableOpacity
          onPress={onAddPress}
          style={[styles.writeBtn, { backgroundColor: p.primarySoft }]}
        >
          <Ionicons name="create" size={14} color={colors.primaryDeep} />
          <Text
            style={{ color: colors.primaryDeep, fontWeight: '700', fontSize: 13 }}
          >
            Bewerten
          </Text>
        </TouchableOpacity>
      </View>

      {count === 0 ? (
        <View style={styles.emptyTabState}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color={p.textMuted}
          />
          <Text
            style={{
              color: p.textMuted,
              marginTop: 8,
              textAlign: 'center',
              maxWidth: 240,
            }}
          >
            Sei die erste Person, die {barName} bewertet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </View>
      )}

      {googleReviews.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.googleHeader}>
            <Text style={[styles.sectionTitle, { color: p.text }]}>
              Bewertungen von Google
            </Text>
            {googleMapsUri && (
              <TouchableOpacity
                onPress={() => Linking.openURL(googleMapsUri).catch(() => {})}
                style={[styles.writeBtn, { backgroundColor: p.surfaceMuted }]}
              >
                <Ionicons name="open-outline" size={13} color={p.text} />
                <Text style={{ color: p.text, fontWeight: '700', fontSize: 12 }}>
                  In Maps öffnen
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {googleReviews.map((r) => (
              <GoogleReviewItem key={r.id} review={r} p={p} />
            ))}
          </View>
          <Text
            style={{
              color: p.textMuted,
              fontSize: 11,
              marginTop: spacing.md,
              textAlign: 'center',
            }}
          >
            Bewertungen via Google Places. Powered by Google.
          </Text>
        </View>
      )}
    </View>
  );
}

function GoogleReviewItem({
  review,
  p,
}: {
  review: import('@/lib/types').GooglePlaceReview;
  p: Palette;
}) {
  return (
    <View
      style={[
        styles.googleReviewCard,
        { backgroundColor: p.card, borderColor: p.divider },
      ]}
    >
      <View style={styles.googleReviewHead}>
        {review.authorPhotoUrl ? (
          <Image
            source={{ uri: review.authorPhotoUrl }}
            style={styles.googleAvatar}
          />
        ) : (
          <View
            style={[
              styles.googleAvatar,
              { backgroundColor: p.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <Ionicons name="person" size={14} color={p.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
            {review.authorName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <StarRow rating={review.rating} size={11} />
            {review.relativeTime && (
              <Text style={{ color: p.textMuted, fontSize: 11 }}>
                {review.relativeTime}
              </Text>
            )}
          </View>
        </View>
      </View>
      {review.text ? (
        <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: spacing.sm }}>
          {review.text}
        </Text>
      ) : null}
    </View>
  );
}

function AddReviewModal({
  visible,
  onClose,
  barName,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  barName: string;
  onSubmit: (rating: number, content: string) => Promise<void>;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const [rating, setRating] = useState(4);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (content.trim().length === 0) {
      Alert.alert('Bitte schreibe einen Kommentar.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, content.trim());
      setContent('');
      setRating(4);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalBackdrop, { backgroundColor: alpha('#000', 0.5) }]}
      >
        <SafeAreaView
          style={[styles.reviewModal, { backgroundColor: p.bg }]}
          edges={['bottom']}
        >
          <View style={styles.modalGrabRow}>
            <View style={[styles.handle, { backgroundColor: p.textMuted + '4D' }]} />
          </View>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: p.text, fontSize: 20 }]}>
                Bewertung schreiben
              </Text>
              <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>
                {barName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={p.text} />
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
            <StarRow
              rating={rating}
              size={40}
              interactive
              onChange={(v) => {
                haptic.light();
                setRating(v);
              }}
            />
            <Text style={{ color: p.textMuted, marginTop: spacing.sm, fontSize: 13 }}>
              {ratingLabel(rating)}
            </Text>
          </View>
          <TextField
            placeholder="Wie war's? Erzähl was…"
            multiline
            value={content}
            onChangeText={setContent}
          />
          <PressableButton
            p={p}
            label="Bewertung absenden"
            icon="send"
            loading={submitting}
            onPress={handleSubmit}
            fullWidth
            style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PhotoGalleryModal({
  visible,
  photos,
  startIndex,
  onClose,
}: {
  visible: boolean;
  photos: import('@/lib/types').GooglePlacePhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Wenn Modal aufgeht, springe zum richtigen Foto.
  useEffect(() => {
    if (!visible) return;
    setActiveIndex(startIndex);
    // initialScrollIndex auf FlatList ist unzuverlässig wenn Items
    // gleich groß sind und schon gemounted — mit scrollToIndex robuster.
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: startIndex,
        animated: false,
      });
    });
  }, [visible, startIndex]);

  const activePhoto = photos[activeIndex];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.galleryRoot}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `gallery-${i}`}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setActiveIndex(idx);
          }}
          renderItem={({ item }) => (
            <View
              style={{
                width: screenWidth,
                height: screenHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{ width: screenWidth, height: '100%' }}
                resizeMode="contain"
              />
            </View>
          )}
        />

        <TouchableOpacity
          style={[styles.galleryClose, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.galleryCounter, { top: insets.top + 14 }]}>
          <Text style={styles.galleryCounterText}>
            {activeIndex + 1} / {photos.length}
          </Text>
        </View>

        {activePhoto?.attribution ? (
          <View
            style={[
              styles.galleryAttribution,
              { paddingBottom: insets.bottom + 12 },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.galleryAttributionText} numberOfLines={2}>
              {activePhoto.attribution}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function ratingLabel(r: number): string {
  if (r <= 1) return 'Eher meh';
  if (r === 2) return 'Geht so';
  if (r === 3) return 'Solide';
  if (r === 4) return 'Richtig gut';
  return 'Mein Stamm!';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroWrap: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  hero: { width: '100%', height: HERO_HEIGHT },
  heroFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: alpha('#000', 0.4),
  },
  heroOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: alpha('#000', 0.55),
  },
  topButtons: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: alpha('#000', 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  stickyHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 5,
  },
  stickyHeaderRow: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60,
  },
  stickyTitle: { fontSize: 16, fontWeight: '800' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  openBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  heroContent: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.xl,
    right: spacing.xl,
  },
  heroChips: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: alpha('#000', 0.55),
  },
  heroRatingText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  heroRatingMuted: { color: alpha('#fff', 0.75), fontSize: 11 },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  galleryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  presencePillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    textShadowColor: alpha('#000', 0.4),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  heroAddress: {
    color: alpha('#fff', 0.92),
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    marginTop: -spacing.lg,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, height: 36, alignSelf: 'center' },
  tabBar: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  infoCard: {
    borderRadius: radii.lg,
    padding: 4,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.md,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  emptyTabState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  listEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  listEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
  },
  summaryLeft: {
    alignItems: 'center',
    paddingRight: spacing.md,
    minWidth: 80,
  },
  summaryAvg: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
  },
  summaryRight: { flex: 1 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  barTrack: { flex: 1, height: 6, borderRadius: 4, overflow: 'hidden' },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radii.pill,
    gap: 8,
  },
  checkBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  reviewModal: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  modalGrabRow: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 44, height: 5, borderRadius: 3 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  googleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  googleReviewCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  googleReviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  googleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  galleryRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  galleryClose: {
    position: 'absolute',
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: alpha('#000', 0.55),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  galleryCounter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9,
  },
  galleryCounterText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: alpha('#000', 0.55),
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  galleryAttribution: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: alpha('#000', 0.6),
  },
  galleryAttributionText: {
    color: alpha('#fff', 0.8),
    fontSize: 11,
    textAlign: 'center',
  },
});
