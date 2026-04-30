import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
} from '@/lib/colors';
import { useAuth, logout, resendVerification } from '@/lib/auth';
import { uploadAvatar, getProfile, validateFace } from '@/lib/data';
import { PressableButton } from '@/components/PressableButton';

export default function VerifyScreen() {
  const { user, refreshVerification } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (user) refresh(false);
  }, [user?.id]);

  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race<T>([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms),
      ),
    ]);
  }

  async function refresh(showErrors = true) {
    if (!user) return;
    setRefreshing(true);
    try {
      // E-Mail-Status kommt aus der lokalen Session — kein Netzwerk-Call.
      // Wenn der User gerade die Mail bestätigt hat, holt der manuelle
      // "Status erneut prüfen"-Button die Session vom Server frisch.
      setEmailConfirmed(!!user.email_confirmed_at);

      const profile = await withTimeout(
        getProfile(user.id),
        8000,
        'getProfile',
      );
      setAvatarUrl(profile?.avatarUrl ?? null);
    } catch (e: any) {
      console.error('[verify] refresh failed', e);
      if (showErrors) {
        showAlert('Status konnte nicht geladen werden', e?.message ?? '');
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleManualRefresh() {
    try {
      await withTimeout(refreshVerification(), 8000, 'refreshVerification');
    } catch (e: any) {
      console.error('[verify] manual refresh failed', e);
      showAlert('Aktualisierung fehlgeschlagen', e?.message ?? '');
      return;
    }
    await refresh(true);
  }

  async function handleResend() {
    if (!user?.email) return;
    try {
      await resendVerification(user.email);
      showAlert('Mail erneut gesendet');
    } catch (e: any) {
      showAlert('Fehler', e?.message ?? 'Senden fehlgeschlagen.');
    }
  }

  async function handlePickAvatar() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert(
        'Kamera-Zugriff erforderlich',
        'Bitte in den Einstellungen aktivieren — wir brauchen die Kamera, um dein Gesicht zu prüfen.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      // 0.7 reicht für ein 1:1-Avatar und hält den Base64-Body unter 4 MB.
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (!asset.base64) {
      showAlert(
        'Foto unvollständig',
        'Bitte erneut aufnehmen — die App konnte das Bild nicht lesen.',
      );
      return;
    }

    setUploading(true);
    try {
      // Erst Face-Check (server-seitig, ~1s), dann Upload. Wenn der Check
      // fehlschlägt, gar nicht erst hochladen — spart Storage-Mülleinträge.
      await Promise.race([
        validateFace(asset.base64),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout: Gesichtserkennung dauert zu lange')),
            15000,
          ),
        ),
      ]);

      const url = await Promise.race([
        uploadAvatar(asset.uri),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout: Upload dauert zu lange')),
            20000,
          ),
        ),
      ]);
      setAvatarUrl(url);
    } catch (e: any) {
      console.error('[verify] avatar pipeline failed', e);
      showAlert(
        'Foto nicht akzeptiert',
        e?.message ?? 'Unbekannter Fehler. Bitte erneut versuchen.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  async function handleContinue() {
    if (continuing) return;
    setContinuing(true);
    // Lokaler Zustand ist vollständig (sonst wäre der Button nicht sichtbar):
    // E-Mail ist in der Session bestätigt, avatar_url ist in der DB gesetzt.
    // Der AuthGate in app/index.tsx prüft beim Mount frisch via isFullyVerified()
    // — wir müssen hier nicht auf supabase.auth.refreshSession() warten, das auf
    // Web gelegentlich hängt. Refresh trotzdem im Hintergrund anstoßen.
    void refreshVerification().catch(() => {});
    router.replace('/');
  }

  const isComplete = emailConfirmed && !!avatarUrl;
  const completedSteps = (emailConfirmed ? 1 : 0) + (avatarUrl ? 1 : 0);
  const progress = completedSteps / 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.brand, { color: colors.primaryDeep }]}>
            Verifizierung
          </Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={{ color: p.textMuted, fontWeight: '600', fontSize: 13 }}>
              Abmelden
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.h1, { color: p.text }]}>
          Fast geschafft!
        </Text>
        <Text style={[styles.intro, { color: p.textMuted }]}>
          Damit du posten und einchecken kannst, brauchen wir zwei Dinge.
        </Text>

        <View style={[styles.progressBar, { backgroundColor: p.divider }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: p.textMuted }]}>
          {completedSteps} von 2 erledigt
        </Text>

        <StepCard
          p={p}
          done={emailConfirmed}
          number="1"
          title="E-Mail bestätigen"
          description={
            emailConfirmed
              ? `E-Mail bestätigt: ${user?.email ?? ''}`
              : `Wir haben dir einen Link an ${user?.email ?? ''} geschickt. Klick darauf und komm dann hierher zurück.`
          }
        >
          {!emailConfirmed && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.outlineBtn,
                  { borderColor: colors.primary },
                ]}
                onPress={handleResend}
              >
                <Ionicons name="send" size={14} color={colors.primary} />
                <Text style={[styles.outlineBtnText, { color: colors.primary }]}>
                  Mail erneut senden
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </StepCard>

        <StepCard
          p={p}
          done={!!avatarUrl}
          number="2"
          title="Profilbild aufnehmen"
          description="Mach ein Live-Selfie mit der Kamera. Wir prüfen automatisch, dass dein Gesicht gut erkennbar ist — kein Upload aus der Galerie."
        >
          <View style={styles.avatarRow}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={uploading}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: p.primarySoft },
                ]}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={32} color={colors.primaryDeep} />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                uploading && { opacity: 0.6 },
                shadows.brand,
              ]}
              onPress={handlePickAvatar}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {avatarUrl ? 'Neu aufnehmen' : 'Selfie aufnehmen'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </StepCard>

        {isComplete ? (
          <PressableButton
            p={p}
            label="Los geht's"
            icon="arrow-forward"
            loading={continuing}
            onPress={handleContinue}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <PressableButton
            p={p}
            variant="secondary"
            label="Status erneut prüfen"
            icon="refresh"
            loading={refreshing}
            onPress={handleManualRefresh}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepCard({
  p,
  done,
  number,
  title,
  description,
  children,
}: {
  p: ReturnType<typeof palette>;
  done: boolean;
  number: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: p.card,
          borderColor: done ? colors.success : p.divider,
        },
        done && shadows.sm,
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.numberCircle,
            {
              backgroundColor: done ? colors.success : p.primarySoft,
            },
          ]}
        >
          {done ? (
            <Ionicons name="checkmark" size={20} color="#fff" />
          ) : (
            <Text style={{ color: colors.primaryDeep, fontWeight: '900', fontSize: 16 }}>
              {number}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: p.text }]}>{title}</Text>
          {done && (
            <View style={styles.doneRow}>
              <View style={[styles.doneDot, { backgroundColor: colors.success }]} />
              <Text
                style={{ color: colors.success, fontWeight: '700', fontSize: 12 }}
              >
                Erledigt
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.cardDesc, { color: p.textMuted }]}>{description}</Text>
      {children && <View style={{ marginTop: spacing.md }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.huge },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  h1: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  intro: {
    fontSize: 15,
    marginTop: 6,
    lineHeight: 21,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  numberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardDesc: { fontSize: 14, lineHeight: 20 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  doneDot: { width: 5, height: 5, borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  outlineBtnText: { fontWeight: '700', fontSize: 13 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.pill,
    gap: 6,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  recheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    marginTop: spacing.lg,
  },
  bigBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
