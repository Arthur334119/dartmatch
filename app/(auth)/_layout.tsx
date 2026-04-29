import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" options={{ headerShown: true, headerTitle: 'Account erstellen' }} />
      <Stack.Screen name="verify" options={{ headerShown: true, headerTitle: 'Profil verifizieren' }} />
    </Stack>
  );
}
