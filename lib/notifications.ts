import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { getCurrentUser } from './auth';

// Globaler Handler: was passiert, wenn ein Push hereinkommt während die App
// im Vordergrund läuft. Banner + Sound, kein Badge (der wäre nervig bei
// vielen Posts in einer aktiven Bar).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registered = false;

/**
 * Holt einen Expo Push Token und speichert ihn in `push_tokens`. Idempotent —
 * darf bei jedem App-Start aufgerufen werden. Auf Web + Simulator no-op,
 * weil dort keine echten Push-Tokens vergeben werden.
 *
 * Setzt eine Permission-Anfrage ab (auf iOS einmaliger Modal). Wenn der User
 * ablehnt, wird einfach `null` zurückgegeben — kein Crash.
 */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Allgemein',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#FF6B35',
      });
    }

    // EAS-projectId — in Expo Go reicht der Default, in Standalone-Builds
    // muss er explizit kommen. Wir versuchen es ohne und schreiben in den
    // Log, wenn der Token nicht zustande kommt.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } })
        .easConfig?.projectId;

    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenRes.data;
    if (!token) return null;

    const user = await getCurrentUser();
    if (!user) return token;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS as 'ios' | 'android' | 'web',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    if (error) console.warn('[push] token upsert failed', error);

    registered = true;
    return token;
  } catch (e) {
    console.warn('[push] register failed', e);
    return null;
  }
}

/**
 * Löscht den aktuellen Token aus `push_tokens` — beim Logout aufrufen, damit
 * der Server einem ausgeloggten User keine Pushs mehr schickt. Verträgt es,
 * wenn kein Token registriert ist.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!registered) return;
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    if (!token) return;
    const user = await getCurrentUser();
    if (!user) return;
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token);
  } catch {
    // ignore
  } finally {
    registered = false;
  }
}

type NotificationData = {
  kind?: string;
  post_id?: string;
  bar_id?: string;
  chat_id?: string;
};

/**
 * Routing für Push-Tap: schaut in die `data`-Payload und navigiert zur
 * passenden Screen. Wird vom Layout-Listener aufgerufen.
 */
export function handleNotificationTap(data: NotificationData) {
  if (!data) return;
  if (data.kind === 'looking_post' && data.bar_id) {
    router.push(`/bar/${data.bar_id}`);
    return;
  }
  if (data.kind === 'chat_message' && data.chat_id) {
    // Cast: /chat/[id] wird in Phase 2 (Chat-Feature) angelegt; vorher ist
    // das Route-Schema von expo-router noch nicht typisiert.
    router.push(`/chat/${data.chat_id}` as any);
    return;
  }
  if (data.bar_id) {
    router.push(`/bar/${data.bar_id}`);
  }
}
