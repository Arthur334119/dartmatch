-- Macht die Push-Trigger absolut fehlertolerant: wenn IRGENDETWAS in der
-- Push-Logik scheitert (vault nicht installiert, pg_net nicht im
-- search_path, Edge Function offline …), darf das den eigentlichen
-- INSERT (Post bzw. Chat-Message) NICHT blockieren.
--
-- Einziger Unterschied zu 20260503/20260504: die ganze Push-Logik ist
-- in `begin/exception when others then null/end;` gewrappt.

-- ── Looking-Post-Trigger ──────────────────────────────────────────────
create or replace function public.notify_looking_post()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  service_key text;
  bar_users uuid[];
  bar_name_v text;
  poster_username_v text;
begin
  if new.type <> 'looking' or new.bar_id is null then
    return new;
  end if;

  begin
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

    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

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
    );
  exception when others then
    -- Push ist nice-to-have. Posten darf nie daran scheitern.
    null;
  end;

  return new;
end;
$$;

-- ── Chat-Message-Trigger ──────────────────────────────────────────────
create or replace function public.on_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  service_key text;
  recipient_id uuid;
  sender_username_v text;
begin
  -- last_message_at MUSS aktualisiert werden — das ist Kerngeschäft, nicht Push.
  update public.chats
  set last_message_at = new.created_at
  where id = new.chat_id;

  begin
    select case when c.user_a = new.sender_id then c.user_b else c.user_a end
      into recipient_id
    from public.chats c
    where c.id = new.chat_id;

    if recipient_id is null then
      return new;
    end if;

    select username into sender_username_v
    from public.profiles where id = new.sender_id;

    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

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
  exception when others then
    null;
  end;

  return new;
end;
$$;
