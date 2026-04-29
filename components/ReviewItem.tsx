import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
  useColorScheme,
} from 'react-native';
import {
  palette,
  colors,
  spacing,
  radii,
} from '@/lib/colors';
import { Review } from '@/lib/types';
import { timeAgo } from '@/lib/relative-time';
import { StarRow } from '@/components/StarRow';

const COLLAPSED_LINES = 4;

export function ReviewItem({ review }: { review: Review }) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [measured, setMeasured] = useState(false);

  function onTextLayout(e: LayoutChangeEvent) {
    if (measured) return;
    // Heuristic: if collapsed text reaches a height that suggests > N lines, show toggle.
    // RN's onTextLayout would be cleaner but we keep it simple via length.
    setMeasured(true);
    if (review.content.length > 180) setNeedsToggle(true);
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
          {review.avatarUrl ? (
            <Image source={{ uri: review.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.primaryDeep }]}>
              {(review.username ?? 'A').slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{ color: p.text, fontWeight: '700' }}>
            {review.username ?? 'Anonym'}
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 12 }}>
            {timeAgo(review.createdAt)}
          </Text>
        </View>
        <StarRow rating={review.rating} size={14} />
      </View>

      <Text
        onLayout={onTextLayout}
        style={[styles.content, { color: p.text }]}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
      >
        {review.content}
      </Text>

      {needsToggle && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          hitSlop={6}
        >
          <Text style={[styles.toggle, { color: colors.primaryDeep }]}>
            {expanded ? 'Weniger anzeigen' : 'Mehr lesen'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontWeight: '800', fontSize: 15 },
  content: { fontSize: 14, lineHeight: 20 },
  toggle: { marginTop: 6, fontWeight: '700', fontSize: 13 },
});
