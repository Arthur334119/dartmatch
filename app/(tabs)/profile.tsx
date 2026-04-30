import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
} from '@/lib/colors';
import { UserProfile } from '@/lib/types';
import { getProfile, updateProfile, uploadAvatar } from '@/lib/data';
import { SkeletonBlock } from '@/components/Skeleton';
import { PressableCard } from '@/components/PressableCard';
import { TextField } from '@/components/TextField';
import { SectionLabel } from '@/components/SectionLabel';
import { logout, getCurrentUser } from '@/lib/auth';
import { DART_GAME_TYPES } from '@/lib/constants';
import { clearCredentials } from '@/lib/secure-credentials';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const u = await getCurrentUser();
    if (!u) return;
    setEmail(u.email ?? '');
    const prof = await getProfile(u.id);
    setProfile(prof);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotos-Zugriff erforderlich');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (!asset) return;

    setUploading(true);
    try {
      await uploadAvatar(asset.uri);
      await load();
    } catch (e: any) {
      Alert.alert('Upload fehlgeschlagen', e?.message ?? '');
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Abmelden', 'Wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: async () => {
          await clearCredentials();
          await logout();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: p.bg }]}>
        <SafeAreaView
          edges={['top']}
          style={{ backgroundColor: alpha(colors.primary, 0.1) }}
        >
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <SkeletonBlock width={120} height={28} radius={8} />
              <SkeletonBlock width={100} height={36} radius={18} />
            </View>
            <SkeletonBlock width={112} height={112} radius={56} />
            <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <SkeletonBlock width={160} height={26} radius={6} />
              <SkeletonBlock
                width={220}
                height={14}
                style={{ marginTop: 10 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <SkeletonBlock width={80} height={48} radius={radii.md} />
              <SkeletonBlock width={80} height={48} radius={radii.md} />
              <SkeletonBlock width={80} height={48} radius={radii.md} />
            </View>
          </View>
        </SafeAreaView>
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <SkeletonBlock width={100} height={11} radius={6} />
          <SkeletonBlock width="100%" height={64} radius={radii.lg} />
        </View>
      </View>
    );
  }

  const memberSince = profile
    ? new Date(profile.createdAt).toLocaleDateString('de-DE', {
        month: 'short',
        year: 'numeric',
      })
    : '–';

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero with primary tint */}
        <SafeAreaView
          edges={['top']}
          style={{ backgroundColor: alpha(colors.primary, 0.1) }}
        >
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <Text style={[styles.title, { color: p.text }]}>Profil</Text>
              {profile && (
                <PressableCard
                  style={[styles.editPill, { backgroundColor: p.surface }, shadows.sm]}
                  onPress={() => setEditOpen(true)}
                  scaleTo={0.95}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primaryDeep} />
                  <Text
                    style={{
                      color: colors.primaryDeep,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    Bearbeiten
                  </Text>
                </PressableCard>
              )}
            </View>

            <View style={styles.avatarBox}>
              <View
                style={[
                  styles.bigAvatar,
                  { backgroundColor: p.surface, borderColor: p.surface },
                  shadows.md,
                ]}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={styles.bigAvatarImg}
                  />
                ) : (
                  <Text
                    style={{
                      color: colors.primaryDeep,
                      fontSize: 44,
                      fontWeight: '800',
                    }}
                  >
                    {(profile?.username ?? 'A').slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <PressableCard
                style={[styles.avatarBadge, shadows.sm]}
                onPress={handleAvatar}
                disabled={uploading}
                scaleTo={0.9}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </PressableCard>
            </View>

            <Text style={[styles.username, { color: p.text }]}>
              {profile?.username ?? 'Unbekannt'}
            </Text>
            {profile?.bio ? (
              <Text style={[styles.bio, { color: p.textMuted }]}>
                {profile.bio}
              </Text>
            ) : (
              <Text style={[styles.bio, { color: p.textMuted, fontStyle: 'italic' }]}>
                Noch keine Bio
              </Text>
            )}

            <View style={[styles.statsRow, { backgroundColor: alpha(p.surface, 0.8) }]}>
              <Stat
                icon="calendar-outline"
                label="Dabei seit"
                value={memberSince}
                p={p}
              />
              <View style={[styles.statSep, { backgroundColor: p.divider }]} />
              <Stat
                icon="game-controller-outline"
                label="Spiele"
                value={String(profile?.favoriteGames.length ?? 0)}
                p={p}
              />
              {profile?.location && (
                <>
                  <View style={[styles.statSep, { backgroundColor: p.divider }]} />
                  <Stat
                    icon="location-outline"
                    label="Ort"
                    value={profile.location}
                    p={p}
                  />
                </>
              )}
            </View>
          </View>
        </SafeAreaView>

        {profile && profile.favoriteGames.length > 0 && (
          <Section title="Lieblingsspiele" p={p}>
            <View style={styles.chipsWrap}>
              {profile.favoriteGames.map((g) => (
                <View
                  key={g}
                  style={[styles.gameChip, { backgroundColor: p.primarySoft }]}
                >
                  <Ionicons
                    name="game-controller"
                    size={14}
                    color={colors.primaryDeep}
                  />
                  <Text style={{ color: colors.primaryDeep, fontWeight: '700' }}>
                    {g}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Konto" p={p}>
          <View style={[styles.cardBox, { backgroundColor: p.card, borderColor: p.divider }]}>
            <Row icon="mail-outline" label="E-Mail" value={email} p={p} />
            <View style={[styles.divider, { backgroundColor: p.divider }]} />
            <PressableCard
              style={styles.row}
              onPress={handleLogout}
              scaleTo={0.99}
              hapticOnPress={false}
            >
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: alpha(colors.error, 0.12) },
                ]}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
              </View>
              <Text style={{ color: colors.error, fontWeight: '700', flex: 1 }}>
                Abmelden
              </Text>
              <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
            </PressableCard>
          </View>
        </Section>
      </ScrollView>

      <EditProfileModal
        visible={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setEditOpen(false);
          await load();
        }}
      />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  p: ReturnType<typeof palette>;
}) {
  return (
    <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <SectionLabel label={title} />
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  p: ReturnType<typeof palette>;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={p.textMuted} />
      <Text style={[styles.statValue, { color: p.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: p.textMuted }]}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  p: ReturnType<typeof palette>;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: p.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primaryDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.textMuted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: p.text, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [games, setGames] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    setUsername(profile.username);
    setBio(profile.bio ?? '');
    setLocation(profile.location ?? '');
    setGames(new Set(profile.favoriteGames));
  }, [visible, profile]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        username: username.trim(),
        bio: bio.trim(),
        location: location.trim(),
        favorite_games: [...games],
      });
      onSaved();
    } catch (e: any) {
      Alert.alert('Speichern fehlgeschlagen', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  }

  function toggleGame(g: string) {
    const copy = new Set(games);
    if (copy.has(g)) copy.delete(g);
    else copy.add(g);
    setGames(copy);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalBackdrop, { backgroundColor: alpha('#000', 0.5) }]}
      >
        <SafeAreaView style={[styles.editSheet, { backgroundColor: p.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: p.divider }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: p.textMuted, fontWeight: '600', fontSize: 15 }}>
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: p.text }]}>Profil bearbeiten</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>
                  Speichern
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
            <Text style={[styles.fieldLabel, { color: p.textMuted }]}>Benutzername</Text>
            <TextField
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              containerStyle={{ marginTop: 6 }}
            />
            <Text
              style={[styles.fieldLabel, { color: p.textMuted, marginTop: spacing.lg }]}
            >
              Bio
            </Text>
            <TextField
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Erzähl was über dich…"
              containerStyle={{ marginTop: 6 }}
            />
            <Text
              style={[styles.fieldLabel, { color: p.textMuted, marginTop: spacing.lg }]}
            >
              Stadtteil / Ort
            </Text>
            <TextField
              icon="location-outline"
              value={location}
              onChangeText={setLocation}
              placeholder="z.B. Kreuzberg"
              containerStyle={{ marginTop: 6 }}
            />
            <Text
              style={[styles.fieldLabel, { color: p.textMuted, marginTop: spacing.lg }]}
            >
              Lieblingsspiele
            </Text>
            <View style={[styles.chipsWrap, { marginTop: spacing.sm }]}>
              {DART_GAME_TYPES.map((g) => {
                const sel = games.has(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.editChip,
                      {
                        backgroundColor: sel ? p.primarySoft : p.surface,
                        borderColor: sel ? colors.primary : p.divider,
                      },
                    ]}
                    onPress={() => toggleGame(g)}
                  >
                    <Text
                      style={{
                        color: sel ? colors.primaryDeep : p.text,
                        fontWeight: sel ? '700' : '500',
                      }}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xl,
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  avatarBox: { position: 'relative' },
  bigAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
  },
  bigAvatarImg: { width: '100%', height: '100%' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 24, fontWeight: '800', marginTop: spacing.lg },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statSep: { width: 1, height: 32 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  editChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  editSheet: {
    height: '90%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
