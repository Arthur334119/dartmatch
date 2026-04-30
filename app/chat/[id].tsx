import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  alpha,
  type Palette,
} from '@/lib/colors';
import {
  ChatMessage,
  getChatMessages,
  getChatPartner,
  markChatRead,
  sendChatMessage,
  subscribeChat,
} from '@/lib/chat';
import { getCurrentUser } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { showAlert } from '@/lib/alert';
import { formatTimeOfDay } from '@/lib/relative-time';

const MAX_MESSAGE = 2000;

export default function ChatDetailScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<{
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState('');

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (!chatId) return;
    let unsub: (() => void) | null = null;

    (async () => {
      const me = await getCurrentUser();
      setMyId(me?.id ?? '');

      const [msgs, prt] = await Promise.all([
        getChatMessages(chatId, 100),
        getChatPartner(chatId),
      ]);
      setMessages(msgs);
      setPartner(prt);
      setLoading(false);
      // Beim Öffnen: alle Nachrichten als gelesen markieren
      markChatRead(chatId).catch(() => {});

      unsub = subscribeChat(chatId, (m) => {
        setMessages((prev) => {
          if (prev.some((p) => p.id === m.id)) return prev;
          return [...prev, m];
        });
        // Wenn die Nachricht von der Gegenseite kommt, gleich markieren
        if (m.senderId !== me?.id) {
          markChatRead(chatId).catch(() => {});
        }
        scrollToEnd();
      });
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [chatId, scrollToEnd]);

  useEffect(() => {
    if (!loading) scrollToEnd();
  }, [loading, scrollToEnd]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    if (!chatId) return;
    setSending(true);
    try {
      const sent = await sendChatMessage(chatId, text);
      setInput('');
      // Optimistisches Append (Realtime löst zusätzlich aus, aber dedupliziert)
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      haptic.success();
      scrollToEnd();
    } catch (e: any) {
      console.error('[chat] send failed', e);
      showAlert(
        'Senden fehlgeschlagen',
        e?.message ?? 'Bitte erneut versuchen.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]} edges={['top']}>
      <View style={[styles.headerBar, { borderBottomColor: p.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={p.text} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: p.primarySoft }]}>
          {partner?.avatarUrl ? (
            <Image source={{ uri: partner.avatarUrl }} style={styles.headerAvatarImg} />
          ) : (
            <Text style={[styles.headerAvatarLetter, { color: colors.primaryDeep }]}>
              {(partner?.username ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <Text
          style={[styles.headerTitle, { color: p.text }]}
          numberOfLines={1}
        >
          {partner?.username ?? 'Chat'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={48}
              color={p.textMuted}
            />
            <Text style={{ color: p.textMuted, marginTop: spacing.md, textAlign: 'center' }}>
              Schreibe die erste Nachricht.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => {
              const prev = messages[index - 1];
              const showTime =
                !prev ||
                new Date(item.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() >
                  10 * 60 * 1000;
              return (
                <Bubble
                  msg={item}
                  mine={item.senderId === myId}
                  p={p}
                  showTime={showTime}
                />
              );
            }}
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: spacing.lg,
            }}
            onContentSizeChange={scrollToEnd}
          />
        )}

        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: p.divider,
              backgroundColor: p.bg,
              paddingBottom: insets.bottom + 6,
            },
          ]}
        >
          <View
            style={[
              styles.inputBox,
              { backgroundColor: p.surfaceMuted, borderColor: p.divider },
            ]}
          >
            <TextInput
              style={[styles.textInput, { color: p.text }]}
              placeholder="Nachricht schreiben…"
              placeholderTextColor={p.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={MAX_MESSAGE}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  !input.trim() || sending
                    ? alpha(colors.primary, 0.4)
                    : colors.primary,
              },
              shadows.brand,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  msg,
  mine,
  p,
  showTime,
}: {
  msg: ChatMessage;
  mine: boolean;
  p: Palette;
  showTime: boolean;
}) {
  return (
    <View style={{ marginBottom: 6 }}>
      {showTime && (
        <Text
          style={{
            color: p.textMuted,
            fontSize: 11,
            textAlign: 'center',
            marginVertical: spacing.sm,
          }}
        >
          {formatTimeOfDay(msg.createdAt)}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          mine
            ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
            : {
                alignSelf: 'flex-start',
                backgroundColor: p.surface,
                borderColor: p.divider,
                borderWidth: 1,
              },
        ]}
      >
        <Text
          style={{
            color: mine ? '#fff' : p.text,
            fontSize: 15,
            lineHeight: 20,
          }}
        >
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerAvatarLetter: { fontWeight: '800', fontSize: 14 },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  inputBox: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minHeight: 42,
    maxHeight: 120,
  },
  textInput: { fontSize: 15, lineHeight: 20, padding: 0 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
