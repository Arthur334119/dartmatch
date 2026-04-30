import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import {
  registerPushToken,
  unregisterPushToken,
  handleNotificationTap,
} from '@/lib/notifications';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Beim App-Start einmalig versuchen — wenn noch kein User da ist, holt
    // der onAuthStateChange-Listener das nach.
    registerPushToken().catch(() => {});

    const tapSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (data) handleNotificationTap(data);
      },
    );

    const { data: authSub } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          registerPushToken().catch(() => {});
        } else if (event === 'SIGNED_OUT') {
          unregisterPushToken().catch(() => {});
        }
      },
    );

    return () => {
      tapSub.remove();
      authSub.subscription.unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="bar/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="post/create"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="chat/[id]"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
