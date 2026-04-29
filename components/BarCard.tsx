import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bar } from '@/lib/types';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
} from '@/lib/colors';
import { formatDistance } from '@/lib/distance';
import { BAR_GAME_LABELS } from '@/lib/constants';
import { PressableCard } from '@/components/PressableCard';

type Props = {
  bar: Bar;
  onPress: () => void;
  compact?: boolean;
};

export function BarCard({ bar, onPress, compact }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  if (compact) {
    return (
      <PressableCard
        style={[
          styles.compact,
          { backgroundColor: p.card, borderColor: p.divider },
          shadows.sm,
        ]}
        onPress={onPress}
      >
        {bar.imageUrl ? (
          <Image source={{ uri: bar.imageUrl }} style={styles.compactImg} />
        ) : (
          <View style={[styles.compactImg, styles.imgPlaceholder]}>
            <Ionicons name="beer" size={26} color={colors.primary} />
          </View>
        )}
        <View style={styles.compactBody}>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
            {bar.name}
          </Text>
          <View style={styles.compactMetaRow}>
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text style={[styles.metaStrong, { color: p.text }]}>
              {bar.rating.toFixed(1)}
            </Text>
            <Text style={[styles.metaMuted, { color: p.textMuted }]}>
              · {bar.reviewCount}
            </Text>
            {bar.distanceKm != null && (
              <>
                <View style={[styles.dot, { backgroundColor: p.divider }]} />
                <Text style={[styles.metaStrong, { color: p.primary }]}>
                  {formatDistance(bar.distanceKm)}
                </Text>
              </>
            )}
          </View>
          <Text
            style={[styles.compactAddress, { color: p.textMuted }]}
            numberOfLines={1}
          >
            {bar.address}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={p.textMuted}
          style={{ marginRight: spacing.sm }}
        />
      </PressableCard>
    );
  }

  return (
    <PressableCard
      style={[styles.full, { backgroundColor: p.card }, shadows.md]}
      onPress={onPress}
    >
      <View>
        {bar.imageUrl ? (
          <Image source={{ uri: bar.imageUrl }} style={styles.fullImg} />
        ) : (
          <View style={[styles.fullImg, styles.imgPlaceholder]}>
            <Ionicons name="beer" size={48} color={colors.primary} />
          </View>
        )}
        {bar.distanceKm != null && (
          <View style={[styles.distancePill, { backgroundColor: alpha('#000000', 0.55) }]}>
            <Ionicons name="navigate" size={12} color="#fff" />
            <Text style={styles.distancePillText}>
              {formatDistance(bar.distanceKm)}
            </Text>
          </View>
        )}
        <View style={[styles.ratingPill, { backgroundColor: p.surface }]}>
          <Ionicons name="star" size={12} color={colors.warning} />
          <Text style={[styles.ratingPillText, { color: p.text }]}>
            {bar.rating.toFixed(1)}
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 11, marginLeft: 2 }}>
            ({bar.reviewCount})
          </Text>
        </View>
      </View>

      <View style={styles.fullBody}>
        <Text style={[styles.titleLg, { color: p.text }]} numberOfLines={1}>
          {bar.name}
        </Text>

        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={p.textMuted} />
          <Text
            style={[styles.subtitle, { color: p.textMuted }]}
            numberOfLines={1}
          >
            {bar.address}
          </Text>
        </View>

        {bar.games.length > 0 && (
          <View style={styles.chipsRow}>
            {bar.games.slice(0, 3).map((g) => (
              <View
                key={g}
                style={[styles.chip, { backgroundColor: p.primarySoft }]}
              >
                <Text style={[styles.chipText, { color: colors.primaryDeep }]}>
                  {BAR_GAME_LABELS[g] ?? g}
                </Text>
              </View>
            ))}
            {bar.games.length > 3 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: p.surfaceMuted },
                ]}
              >
                <Text style={[styles.chipText, { color: p.textMuted }]}>
                  +{bar.games.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}

        {bar.beerPrice != null && (
          <View style={styles.priceRow}>
            <Ionicons name="beer-outline" size={14} color={p.textMuted} />
            <Text style={{ color: p.textMuted, fontSize: 12, marginLeft: 4 }}>
              Bier ab{' '}
              <Text style={{ color: p.text, fontWeight: '700' }}>
                {bar.beerPrice.toFixed(2)} €
              </Text>
            </Text>
          </View>
        )}
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
  },
  compactImg: { width: 76, height: 76 },
  compactBody: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  compactAddress: { fontSize: 12, marginTop: 2 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  full: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  fullImg: { width: '100%', height: 160 },
  fullBody: { padding: spacing.lg },
  imgPlaceholder: {
    backgroundColor: colors.primary + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distancePill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 4,
  },
  distancePillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ratingPill: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 3,
    ...shadows.sm,
  },
  ratingPillText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700' },
  titleLg: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, marginLeft: 4, flex: 1 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaStrong: { fontSize: 12, fontWeight: '700' },
  metaMuted: { fontSize: 12, fontWeight: '500' },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
