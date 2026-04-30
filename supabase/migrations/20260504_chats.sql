-- Direkt-Nachrichten zwischen zwei Usern. 1:1-Chats, kein Gruppen-Chat.
--
-- Design-Entscheidung: Wir speichern user_a/user_b deterministisch sortiert
-- (user_a < user_b), damit ein UNIQUE-Constraint reicht, um Duplikate
-- (X→Y vs Y→X) zu verhindern. Eine RPC-Function `get_or_create_chat()`
-- normalisiert die Reihenfolge für Aufrufer.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz default now(),
  last_message_at timestamptz default now(),
  constraint chats_users_ordered check (user_a < user_b),
  constraint chats_users_distinct check (user_a <> user_b),
  unique (user_a, user_b)
);

create index if not exists chats_user_a_idx on public.chats(user_a, last_message_at desc);
create index if not exists chats_user_b_idx on public.chats(user_b, last_message_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists chat_messages_chat_idx
  on public.chat_messages(chat_id, created_at desc);
create index if not exists chat_messages_unread_idx
  on public.chat_messages(chat_id, sender_id) where read_at is null;

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Chat participants can read" on public.chats;
create policy "Chat participants can read" on public.chats
  for select using (auth.uid() in (user_a, user_b));

drop policy if exists "Verified users can create chats" on public.chats;
create policy "Verified users can create chats" on public.chats
  for insert with check (
    auth.uid() in (user_a, user_b)
    and public.is_user_verified(auth.uid())
  );

drop policy if exists "Chat participants read messages" on public.chat_messages;
create policy "Chat participants read messages" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  );

drop policy if exists "Sender writes own messages" on public.chat_messages;
create policy "Sender writes own messages" on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_user_verified(auth.uid())
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  );

drop policy if exists "Recipient marks message read" on public.chat_messages;
create policy "Recipient marks message read" on public.chat_messages
  for update using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  ) with check (
    sender_id <> auth.uid()
  );

-- ── RPC: get_or_create_chat ───────────────────────────────────────────
-- Normalisiert die Reihenfolge der beiden User-IDs und legt einen Chat an
-- oder gibt den bestehenden zurück. So muss der Client nicht selbst
-- entscheiden, wer user_a/user_b ist.
create or replace function public.get_or_create_chat(
  other_user uuid,
  source_post uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ua uuid;
  ub uuid;
  cid uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_user = me then
    raise exception 'cannot chat with yourself';
  end if;

  if me < other_user then
    ua := me; ub := other_user;
  else
    ua := other_user; ub := me;
  end if;

  select id into cid from public.chats
  where user_a = ua and user_b = ub;

  if cid is not null then
    return cid;
  end if;

  insert into public.chats (user_a, user_b, post_id)
  values (ua, ub, source_post)
  returning id into cid;
  return cid;
end;
$$;

grant execute on function public.get_or_create_chat(uuid, uuid) to authenticated;

-- ── Trigger: last_message_at + Push-Notification ──────────────────────
create or replace function public.on_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  service_key text;
  recipient_id uuid;
  sender_username_v text;
begin
  -- last_message_at aktualisieren, damit die Chat-Liste sortierbar ist
  update public.chats
  set last_message_at = new.created_at
  where id = new.chat_id;

  -- Empfänger ermitteln
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into recipient_id
  from public.chats c
  where c.id = new.chat_id;

  if recipient_id is null then
    return new;
  end if;

  select username into sender_username_v
  from public.profiles where id = new.sender_id;

  -- Service-Key aus Vault (still scheitern, wenn nicht gesetzt)
  begin
    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;
  exception when others then
    service_key := null;
  end;

  if service_key is null or length(service_key) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://lecyqxfmfmyoipbuhsrc.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(recipient_id),
      'title', coalesce(sender_username_v, 'Neue Nachricht'),
      'body', new.content,
      'data', jsonb_build_object(
        'kind', 'chat_message',
        'chat_id', new.chat_id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists chat_message_after_insert on public.chat_messages;
create trigger chat_message_after_insert
  after insert on public.chat_messages
  for each row execute function public.on_chat_message_insert();

-- ── Realtime ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;
end $$;
