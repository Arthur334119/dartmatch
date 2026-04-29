import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_KEY = 'auth_remember_me';
const EMAIL_KEY = 'auth_saved_email';
const PASSWORD_KEY = 'auth_saved_password_secure';

export type SavedCredentials = {
  remember: boolean;
  email: string;
  password: string;
};

export async function loadSavedCredentials(): Promise<SavedCredentials> {
  const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === 'true';
  if (!remember) return { remember: false, email: '', password: '' };
  const email = (await AsyncStorage.getItem(EMAIL_KEY)) ?? '';
  let password = '';
  try {
    password = (await SecureStore.getItemAsync(PASSWORD_KEY)) ?? '';
  } catch {
    // SecureStore-Lesen kann nach Restore fehlschlagen — ignorieren.
  }
  return { remember: true, email, password };
}

export async function saveCredentials(
  email: string,
  password: string,
): Promise<void> {
  await AsyncStorage.setItem(REMEMBER_KEY, 'true');
  await AsyncStorage.setItem(EMAIL_KEY, email);
  try {
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
  } catch {
    // SecureStore ist im Web nicht verfügbar — Passwort wird dann
    // nicht persistiert, aber die E-Mail bleibt vorausgefüllt.
  }
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(REMEMBER_KEY);
  await AsyncStorage.removeItem(EMAIL_KEY);
  try {
    await SecureStore.deleteItemAsync(PASSWORD_KEY);
  } catch {}
}
