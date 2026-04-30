-- Push Notifications: Tabelle für Expo Push Tokens + Trigger, der bei jedem
-- neuen "looking"-Post in einer Bar einen Push an alle dort eingecheckten
-- User schickt (außer dem Poster selbst).
--
-- Voraussetzungen (User muss einmalig ausführen):
--   1. pg_net Extension ist auf Supabase per default aktiv (`net` schema).
--   2. Service-Role-Key in Vault speichern, damit der Trigger die Edge
--      Function authentifiziert aufrufen kann:
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--      Falls schon vorhanden:
--        update vault.secrets set secret = '<KEY>' where name = 'service_role_key';
--
-- Ohne Vault-Secret ist die Function ein No-Op (kein Crash), damit lokale
-- DBs / Branches ohne Push weiterlaufen können.

create extension if not exists pg_net with schema extensions;

-- ── push_tokens ────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users manage own push tokens" on public.push_tokens;
create policy "Users manage own push tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Trigger: Looking-Post → Push an eingecheckte User ─────────────────
create or replace function public.notify_looking_post()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  service_key text;
  bar_users uuid[];
  bar_name_v text;
  poster_username_v text;
  request_id bigint;
begin
  -- Nur looking-Posts mit Bar-Bezug
  if new.type <> 'looking' or new.bar_id is null then
    return new;
  end if;

  -- Aktiv eingecheckte User in der Bar (ohne Poster)
  select array_agg(distinct user_id) into bar_users
  from public.presence
  where bar_id = new.bar_id
    and user_id <> new.user_id
    and expires_at > now();

  if bar_users is null or array_length(bar_users, 1) = 0 then
    return new;
  end if;

  select name into bar_name_v from public.bars where id = new.bar_id;
  select username into poster_username_v from public.profiles where id = new.user_id;

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

  select net.http_post(
    url := 'https://lecyqxfmfmyoipbuhsrc.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(bar_users),
      'title', coalesce(poster_username_v, 'Jemand') ||
               ' sucht Mitspieler' ||
               coalesce(' in ' || bar_name_v, ''),
      'body', new.content,
      'data', jsonb_build_object(
        'kind', 'looking_post',
        'post_id', new.id,
        'bar_id', new.bar_id
      )
    )
  ) into request_id;

  return new;
end;
$$;

drop trigger if exists posts_looking_notify on public.posts;
create trigger posts_looking_notify
  after insert on public.posts
  for each row execute function public.notify_looking_post();
