import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
  shadows,
} from '@/lib/colors';
import { login } from '@/lib/auth';
import {
  loadSavedCredentials,
  saveCredentials,
  clearCredentials,
} from '@/lib/secure-credentials';
import { PressableButton } from '@/components/PressableButton';
import { TextField } from '@/components/TextField';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    loadSavedCredentials().then((c) => {
      setRemember(c.remember);
      if (c.email && !params.email) setEmail(c.email);
      if (c.password) setPassword(c.password);
    });
  }, [params.email]);

  async function handleLogin() {
    if (loading) return;
    if (!email.includes('@')) {
      showAlert('Ungültige E-Mail');
      return;
    }
    if (password.length < 6) {
      showAlert('Passwort zu kurz', 'Mindestens 6 Zeichen.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      showAlert('Login fehlgeschlagen', e?.message ?? 'Bitte erneut versuchen.');
      setLoading(false);
      return;
    }
    try {
      if (remember) {
        await saveCredentials(email.trim(), password);
      } else {
        await clearCredentials();
      }
    } catch {
      // Credentials-Speicherung darf den Login nicht blockieren
      // (z. B. SecureStore ist im Web nicht verfügbar).
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBox}>
            <View style={[styles.logo, shadows.brand]}>
              <Ionicons name="beer" size={48} color="#fff" />
            </View>
            <Text style={[styles.brand, { color: colors.primaryDeep }]}>
              Kneipenfinder
            </Text>
            <Text style={[styles.tagline, { color: p.textMuted }]}>
              Berlins Kneipen-Community
            </Text>
          </View>

          <Text style={[styles.h1, { color: p.text }]}>Willkommen zurück</Text>
          <Text style={[styles.subtitle, { color: p.textMuted }]}>
            Melde dich an und finde deine Kneipe.
          </Text>

          <TextField
            icon="mail-outline"
            placeholder="E-Mail"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <TextField
            ref={passwordRef}
            icon="lock-closed-outline"
            placeholder="Passwort"
            autoComplete="password"
            secureTextEntry={obscure}
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            isSecure={obscure}
            onToggleSecure={() => setObscure((v) => !v)}
          />

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember((v) => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: remember ? colors.primary : 'transparent',
                  borderColor: remember ? colors.primary : p.divider,
                },
              ]}
            >
              {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.rememberText, { color: p.text }]}>
              Anmeldedaten speichern
            </Text>
          </TouchableOpacity>

          <PressableButton
            p={p}
            label="Anmelden"
            loading={loading}
            onPress={handleLogin}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: p.divider }]} />
            <Text style={{ color: p.textMuted, fontSize: 12 }}>oder</Text>
            <View style={[styles.dividerLine, { backgroundColor: p.divider }]} />
          </View>

          <PressableButton
            p={p}
            variant="secondary"
            label="Account erstellen"
            onPress={() =>
              router.push({
                pathname: '/(auth)/signup',
                params: { email: email.trim() },
              })
            }
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xxl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.huge,
  },
  logoBox: { alignItems: 'center', marginBottom: spacing.xxxl },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.lg,
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  h1: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.xxl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: { fontSize: 14, fontWeight: '500' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xxl,
  },
  dividerLine: { flex: 1, height: 1 },
});
