import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, router, usePathname } from 'expo-router';
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
import { subscribeIncomingChatMessages } from '@/lib/chat';
import { haptic } from '@/lib/haptics';
import { ChatToast, type ChatToastData } from '@/components/ChatToast';

export default function RootLayout() {
  const scheme = useColorScheme();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [toast, setToast] = useState<ChatToastData | null>(null);

  const handleToastPress = useCallback((chatId: string) => {
    setToast(null);
    router.push(`/chat/${chatId}`);
  }, []);

  const handleToastDismiss = useCallback(() => {
    setToast(null);
  }, []);

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

    let unsubChat: (() => void) | null = null;
    const startChatSub = async () => {
      if (unsubChat) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      unsubChat = subscribeIncomingChatMessages(user.id, (e) => {
        // Wenn der User schon im offenen Chat-Detail ist, kein Toast.
        if (pathnameRef.current === `/chat/${e.message.chatId}`) return;
        haptic.light();
        setToast({
          chatId: e.message.chatId,
          username: e.senderUsername,
          avatarUrl: e.senderAvatarUrl,
          preview: e.message.content,
          key: e.message.id,
        });
      });
    };

    const stopChatSub = () => {
      if (unsubChat) {
        unsubChat();
        unsubChat = null;
      }
    };

    startChatSub().catch(() => {});

    const { data: authSub } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          registerPushToken().catch(() => {});
          startChatSub().catch(() => {});
        } else if (event === 'SIGNED_OUT') {
          unregisterPushToken().catch(() => {});
          stopChatSub();
          setToast(null);
        }
      },
    );

    return () => {
      tapSub.remove();
      authSub.subscription.unsubscribe();
      stopChatSub();
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
        <ChatToast
          data={toast}
          onPress={handleToastPress}
          onDismiss={handleToastDismiss}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
