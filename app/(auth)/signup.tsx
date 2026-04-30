import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
} from '@/lib/colors';
import { signup } from '@/lib/auth';
import { PressableButton } from '@/components/PressableButton';
import { TextField } from '@/components/TextField';

export default function SignupScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(params.email ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [obscure, setObscure] = useState(true);
  const [obscureConfirm, setObscureConfirm] = useState(true);
  const [loading, setLoading] = useState(false);

  // Akzeptiert deutsche Formate: +49…, 0049…, 0…, mit Leerzeichen/Bindestrich/(0).
  // Mindestens 7 reine Ziffern, sonst zu kurz für eine sinnvolle Nummer.
  function isValidPhone(raw: string): boolean {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length < 7) return false;
    return /^[+0\d][\d\s\-()/]{6,}$/.test(raw.trim());
  }

  async function handleSignup() {
    if (loading) return;
    if (username.trim().length < 3) {
      showAlert('Benutzername', 'Mindestens 3 Zeichen.');
      return;
    }
    if (!email.includes('@')) {
      showAlert('Ungültige E-Mail');
      return;
    }
    if (!isValidPhone(phone)) {
      showAlert('Telefonnummer', 'Bitte eine gültige Nummer eingeben (z. B. +49 170 1234567).');
      return;
    }
    if (password.length < 6) {
      showAlert('Passwort', 'Mindestens 6 Zeichen.');
      return;
    }
    if (password !== confirm) {
      showAlert('Passwörter stimmen nicht überein');
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, username.trim(), phone.trim());
      showAlert('Account erstellt', 'Bitte E-Mail bestätigen.');
      router.back();
    } catch (e: any) {
      showAlert(
        'Registrierung fehlgeschlagen',
        e?.message ?? 'Bitte erneut versuchen.',
      );
    } finally {
      setLoading(false);
    }
  }

  const passwordsMatch = password.length > 0 && password === confirm;
  const phoneValid = phone.length === 0 || isValidPhone(phone);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: p.surface, borderColor: p.divider },
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.logoMini,
              { backgroundColor: p.primarySoft },
            ]}
          >
            <Ionicons name="beer" size={28} color={colors.primaryDeep} />
          </View>

          <Text style={[styles.h1, { color: p.text }]}>
            Werde Teil der{'\n'}Berliner Kneipen-Community
          </Text>
          <Text style={[styles.subtitle, { color: p.textMuted }]}>
            Erstelle einen Account und finde Mitspieler in deiner Lieblings-Kneipe.
          </Text>

          <TextField
            icon="person-outline"
            placeholder="Benutzername"
            value={username}
            onChangeText={setUsername}
            hint={
              username.length > 0 && username.trim().length < 3
                ? 'Mindestens 3 Zeichen'
                : undefined
            }
            error={username.length > 0 && username.trim().length < 3}
          />
          <TextField
            icon="mail-outline"
            placeholder="E-Mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            icon="call-outline"
            placeholder="Telefonnummer (z. B. +49 170 1234567)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            error={!phoneValid}
            hint={!phoneValid ? 'Ungültige Nummer' : undefined}
          />
          <TextField
            icon="lock-closed-outline"
            placeholder="Passwort (min. 6 Zeichen)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={obscure}
            isSecure={obscure}
            onToggleSecure={() => setObscure((v) => !v)}
          />
          <TextField
            icon="lock-closed-outline"
            placeholder="Passwort bestätigen"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={obscureConfirm}
            isSecure={obscureConfirm}
            onToggleSecure={() => setObscureConfirm((v) => !v)}
            success={passwordsMatch}
            error={confirm.length > 0 && !passwordsMatch}
            hint={
              confirm.length > 0 && !passwordsMatch
                ? 'Passwörter stimmen nicht überein'
                : undefined
            }
          />

          <PressableButton
            p={p}
            label="Registrieren"
            loading={loading}
            onPress={handleSignup}
            fullWidth
            style={{ marginTop: spacing.xl }}
          />

          <View style={styles.loginRow}>
            <Text style={{ color: p.textMuted }}>Bereits registriert? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.linkText, { color: colors.primaryDeep }]}>
                Anmelden
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    padding: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  logoMini: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  h1: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4, lineHeight: 30 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: spacing.xxl, lineHeight: 20 },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  linkText: { fontWeight: '800' },
});
