import { Alert, Platform } from 'react-native';

/**
 * Cross-platform Alert.
 * react-native-web's Alert.alert ist ein No-Op — auf Web fallen wir auf
 * `window.alert` zurück, damit Fehler tatsächlich sichtbar sind.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    return;
  }
  Alert.alert(title, message);
}
