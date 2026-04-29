import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import {
  DART_GAME_TYPES,
  POST_TYPE_LOOKING,
  POST_TYPE_PLAYING,
} from '@/lib/constants';
import { Bar } from '@/lib/types';
import { getAllBars, createPost } from '@/lib/data';
import { isFullyVerified } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { PressableButton } from '@/components/PressableButton';
import { PressableCard } from '@/components/PressableCard';
import { TextField } from '@/components/TextField';

const DURATIONS: { hours: number | null; label: string }[] = [
  { hours: null, label: 'Kein Ablauf' },
  { hours: 1, label: '1 Stunde' },
  { hours: 2, label: '2 Stunden' },
  { hours: 4, label: '4 Stunden' },
];

const MAX_CONTENT = 300;

export default function CreatePostScreen() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<string>(POST_TYPE_LOOKING);
  const [game, setGame] = useState<string | null>(null);
  const [bar, setBar] = useState<Bar | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [playerCount, setPlayerCount] = useState(2);
  const [duration, setDuration] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [barPickerOpen, setBarPickerOpen] = useState(false);

  useEffect(() => {
    getAllBars().then(setBars);
  }, []);

  async function handleSubmit() {
    if (loading) return;
    if (content.trim().length === 0) {
      Alert.alert('Bitte schreibe eine Nachricht.');
      return;
    }
    setLoading(true);
    try {
      try {
        await supabase.auth.refreshSession();
      } catch {}
      const verified = await isFullyVerified();
      if (!verified) {
        const goVerify = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Profil noch nicht verifiziert',
            'Du musst deine E-Mail bestätigen und ein Profilbild hochladen, bevor du Posts erstellen kannst.',
            [
              { text: 'Später', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Jetzt verifizieren', onPress: () => resolve(true) },
            ],
          );
        });
        if (goVerify) {
          router.replace('/(auth)/verify');
        }
        setLoading(false);
        return;
      }

      await createPost({
        type,
        gameType: game,
        barId: bar?.id ?? null,
        content: content.trim(),
        playerCount,
        durationHours: duration,
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      const msg =
        e?.code === '42501'
          ? 'Du bist noch nicht verifiziert. Bitte E-Mail bestätigen und ein Profilbild hochladen.'
          : e?.code === '23514'
            ? `Ungültiger Wert: ${e.message}`
            : e?.message ?? 'Post fehlgeschlagen.';
      Alert.alert('Fehler', msg);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = content.trim().length > 0;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: p.bg }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.headerBar, { borderBottomColor: p.divider }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={{ color: p.textMuted, fontWeight: '600', fontSize: 15 }}>
              Abbrechen
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: p.text }]}>Neuer Post</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section label="Was machst du?" p={p}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TypeButton
                p={p}
                label="Suche Gegner"
                hint="Such jemanden zum Spielen"
                icon="search"
                color={colors.primary}
                active={type === POST_TYPE_LOOKING}
                onPress={() => {
                  if (type !== POST_TYPE_LOOKING) haptic.selection();
                  setType(POST_TYPE_LOOKING);
                }}
              />
              <TypeButton
                p={p}
                label="Spiele gerade"
                hint="Lass andere wissen, dass du da bist"
                icon="flash"
                color={colors.success}
                active={type === POST_TYPE_PLAYING}
                onPress={() => {
                  if (type !== POST_TYPE_PLAYING) haptic.selection();
                  setType(POST_TYPE_PLAYING);
                }}
              />
            </View>
          </Section>

          <Section label="Spielmodus" p={p} optional>
            <View style={styles.chipsWrap}>
              {DART_GAME_TYPES.map((g) => {
                const active = game === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? p.primarySoft : p.surface,
                        borderColor: active ? colors.primary : p.divider,
                      },
                    ]}
                    onPress={() => setGame(active ? null : g)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={{
                        color: active ? colors.primaryDeep : p.text,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section label="Kneipe" p={p} optional>
            <TouchableOpacity
              style={[
                styles.barRow,
                { backgroundColor: p.card, borderColor: p.divider },
              ]}
              onPress={() => setBarPickerOpen(true)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.barIcon,
                  { backgroundColor: p.primarySoft },
                ]}
              >
                <Ionicons name="beer" size={20} color={colors.primaryDeep} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>
                  {bar?.name ?? 'Kneipe auswählen'}
                </Text>
                <Text
                  style={{ color: p.textMuted, fontSize: 13, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {bar?.address ?? 'Optional – wird im Post angezeigt'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
            </TouchableOpacity>
          </Section>

          <Section label="Spieleranzahl" p={p}>
            <View
              style={[
                styles.counterBox,
                { backgroundColor: p.card, borderColor: p.divider },
              ]}
            >
              <CounterBtn
                icon="remove"
                onPress={() => setPlayerCount((n) => Math.max(1, n - 1))}
                disabled={playerCount <= 1}
                p={p}
              />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.counterValue, { color: p.text }]}>
                  {playerCount}
                </Text>
                <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {playerCount === 1 ? 'Spieler' : 'Spieler'}
                </Text>
              </View>
              <CounterBtn
                icon="add"
                onPress={() => setPlayerCount((n) => Math.min(10, n + 1))}
                disabled={playerCount >= 10}
                p={p}
              />
            </View>
          </Section>

          <Section label="Gültigkeit" p={p}>
            <View style={styles.chipsWrap}>
              {DURATIONS.map((d) => {
                const active = duration === d.hours;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? p.primarySoft : p.surface,
                        borderColor: active ? colors.primary : p.divider,
                      },
                    ]}
                    onPress={() => setDuration(d.hours)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={{
                        color: active ? colors.primaryDeep : p.text,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section label="Nachricht" p={p}>
            <TextField
              placeholder='z.B. "Suche jemanden für 501 im Pub!"'
              multiline
              maxLength={MAX_CONTENT}
              value={content}
              onChangeText={setContent}
            />
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    content.length > MAX_CONTENT - 30
                      ? colors.warning
                      : p.textMuted,
                },
              ]}
            >
              {content.length} / {MAX_CONTENT}
            </Text>
          </Section>
        </ScrollView>

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
            label="Post veröffentlichen"
            icon="send"
            loading={loading}
            onPress={handleSubmit}
            disabled={!canSubmit}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>

      <BarPicker
        visible={barPickerOpen}
        bars={bars}
        selectedId={bar?.id}
        onClose={() => setBarPickerOpen(false)}
        onPick={(b) => {
          setBar(b);
          setBarPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function Section({
  label,
  p,
  children,
  optional,
}: {
  label: string;
  p: Palette;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color: p.textMuted }]}>{label}</Text>
        {optional && (
          <Text style={{ color: p.textMuted, fontSize: 11, fontWeight: '600' }}>
            optional
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function TypeButton({
  p,
  label,
  hint,
  icon,
  color,
  active,
  onPress,
}: {
  p: Palette;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.typeBtn,
        {
          borderColor: active ? color : p.divider,
          backgroundColor: active ? alpha(color, 0.12) : p.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.typeIcon,
          { backgroundColor: active ? color : alpha(color, 0.14) },
        ]}
      >
        <Ionicons name={icon} size={20} color={active ? '#fff' : color} />
      </View>
      <Text
        style={{
          color: active ? color : p.text,
          fontWeight: '800',
          marginTop: spacing.sm,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: p.textMuted,
          fontSize: 11,
          marginTop: 2,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

function CounterBtn({
  icon,
  onPress,
  disabled,
  p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled: boolean;
  p: Palette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.counterBtn,
        {
          backgroundColor: disabled ? p.surfaceMuted : p.primarySoft,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.primaryDeep} />
    </TouchableOpacity>
  );
}

function BarPicker({
  visible,
  bars,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  bars: Bar[];
  selectedId?: string;
  onClose: () => void;
  onPick: (b: Bar | null) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const [search, setSearch] = useState('');

  const filtered = bars.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q)
    );
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[styles.modalBackdrop, { backgroundColor: alpha('#000', 0.5) }]}
      >
        <SafeAreaView style={[styles.pickerSheet, { backgroundColor: p.bg }]}>
          <View style={styles.pickerGrabRow}>
            <View
              style={[styles.handle, { backgroundColor: p.textMuted + '4D' }]}
            />
          </View>
          <View style={[styles.modalHeader, { borderBottomColor: p.divider }]}>
            <Text style={[styles.headerTitle, { color: p.text, fontSize: 19 }]}>
              Kneipe auswählen
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={p.text} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <TextField
              icon="search"
              placeholder="Kneipe suchen…"
              value={search}
              onChangeText={setSearch}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
            <PressableCard
              style={[
                styles.barListItem,
                { borderBottomColor: p.divider },
                !selectedId && { backgroundColor: p.surfaceMuted },
              ]}
              onPress={() => onPick(null)}
              scaleTo={0.99}
              hapticOnPress={false}
            >
              <View
                style={[
                  styles.barIconSmall,
                  { backgroundColor: alpha(colors.error, 0.14) },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.error} />
              </View>
              <Text
                style={{
                  color: p.text,
                  fontWeight: '700',
                  marginLeft: spacing.md,
                }}
              >
                Keine Kneipe
              </Text>
            </PressableCard>
            {filtered.map((b) => {
              const sel = selectedId === b.id;
              return (
                <PressableCard
                  key={b.id}
                  style={[
                    styles.barListItem,
                    {
                      borderBottomColor: p.divider,
                      backgroundColor: sel ? p.primarySoft : 'transparent',
                    },
                  ]}
                  onPress={() => onPick(b)}
                  scaleTo={0.99}
                  hapticOnPress={false}
                >
                  <View
                    style={[
                      styles.barIconSmall,
                      { backgroundColor: p.primarySoft },
                    ]}
                  >
                    <Ionicons name="beer" size={18} color={colors.primaryDeep} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>
                      {b.name}
                    </Text>
                    <Text
                      style={{ color: p.textMuted, fontSize: 13, marginTop: 1 }}
                      numberOfLines={1}
                    >
                      {b.address}
                    </Text>
                  </View>
                  {sel && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </PressableCard>
              );
            })}
            {filtered.length === 0 && (
              <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                <Ionicons name="search-outline" size={32} color={p.textMuted} />
                <Text style={{ color: p.textMuted, marginTop: spacing.sm }}>
                  Keine Kneipe gefunden
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  barIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 6,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  pickerSheet: {
    height: '85%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  pickerGrabRow: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 44, height: 5, borderRadius: 3 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  barListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
