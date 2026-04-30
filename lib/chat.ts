import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export type ChatPreview = {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessageContent: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

function rowToMessage(row: Record<string, any>): ChatMessage {
  return {
    id: String(row.id ?? ''),
    chatId: String(row.chat_id ?? ''),
    senderId: String(row.sender_id ?? ''),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    readAt: row.read_at ?? null,
  };
}

/**
 * Holt alle Chats des aktuellen Users mit Profil-Daten des Gegenübers, der
 * letzten Nachricht und der Anzahl ungelesener Nachrichten.
 *
 * Lädt in 4 Queries (chats / profiles / last messages / unread counts), um
 * keine FK-Alias-Joins via Postgrest zu brauchen — chats.user_a und
 * profiles.id beziehen sich beide auf auth.users.id, und Postgrest erkennt
 * solche indirekten Beziehungen nicht zuverlässig.
 */
export async function getChats(): Promise<ChatPreview[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('chats')
    .select('id, user_a, user_b, last_message_at')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false });
  if (error || !data) return [];

  const otherIds = Array.from(
    new Set(
      data.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a)),
    ),
  );
  if (otherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', otherIds);

  const profileMap = new Map<string, any>(
    (profiles ?? []).map((p: any) => [p.id, p]),
  );

  const chatIds = data.map((c: any) => c.id);
  const lastMessages = await loadLastMessages(chatIds);
  const unread = await loadUnreadCounts(chatIds, user.id);

  return data.map((row: any) => {
    const otherId = row.user_a === user.id ? row.user_b : row.user_a;
    const profile = profileMap.get(otherId);
    return {
      id: String(row.id),
      otherUserId: String(otherId),
      otherUsername: profile?.username ?? 'Anonym',
      otherAvatarUrl: profile?.avatar_url ?? null,
      lastMessageAt: String(row.last_message_at ?? new Date().toISOString()),
      lastMessageContent: lastMessages[row.id]?.content ?? null,
      lastMessageSenderId: lastMessages[row.id]?.senderId ?? null,
      unreadCount: unread[row.id] ?? 0,
    };
  });
}

async function loadLastMessages(chatIds: string[]) {
  if (chatIds.length === 0) return {};
  const { data } = await supabase
    .from('chat_messages')
    .select('chat_id, content, sender_id, created_at')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false });

  const out: Record<string, { content: string; senderId: string }> = {};
  for (const m of data ?? []) {
    if (out[(m as any).chat_id]) continue;
    out[(m as any).chat_id] = {
      content: String((m as any).content),
      senderId: String((m as any).sender_id),
    };
  }
  return out;
}

async function loadUnreadCounts(chatIds: string[], userId: string) {
  if (chatIds.length === 0) return {};
  const { data } = await supabase
    .from('chat_messages')
    .select('chat_id, sender_id, read_at')
    .in('chat_id', chatIds)
    .neq('sender_id', userId)
    .is('read_at', null);

  const out: Record<string, number> = {};
  for (const m of data ?? []) {
    const cid = String((m as any).chat_id);
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}

export async function getOrCreateChat(
  otherUserId: string,
  postId?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_chat', {
    other_user: otherUserId,
    source_post: postId ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function getChatMessages(
  chatId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(rowToMessage);
}

export async function sendChatMessage(
  chatId: string,
  content: string,
): Promise<ChatMessage> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');
  const trimmed = content.trim();
  if (trimmed.length === 0) throw new Error('Nachricht ist leer');
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      chat_id: chatId,
      sender_id: user.id,
      content: trimmed,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMessage(data);
}

/**
 * Markiert alle ungelesenen Nachrichten in einem Chat als gelesen, in denen
 * der aktuelle User NICHT der Sender ist. Idempotent.
 */
export async function markChatRead(chatId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

export async function getChatPartner(
  chatId: string,
): Promise<{ id: string; username: string; avatarUrl: string | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: chat } = await supabase
    .from('chats')
    .select('user_a, user_b')
    .eq('id', chatId)
    .maybeSingle();
  if (!chat) return null;

  const otherId = (chat as any).user_a === user.id
    ? (chat as any).user_b
    : (chat as any).user_a;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', otherId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: String((profile as any).id),
    username: String((profile as any).username),
    avatarUrl: (profile as any).avatar_url ?? null,
  };
}

/**
 * Realtime-Subscription für neue Nachrichten in einem Chat. Liefert eine
 * Cleanup-Function. Eingehende Messages werden an den Callback gegeben.
 */
export function subscribeChat(
  chatId: string,
  onMessage: (m: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`chat:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        onMessage(rowToMessage(payload.new as Record<string, any>));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Globale Subscription auf eingehende Chat-Nachrichten an den User. Wird vom
 * Tab-Layout genutzt, um den Unread-Badge live zu halten.
 */
export function subscribeIncomingMessages(
  userId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`incoming-messages:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_messages' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chats' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
