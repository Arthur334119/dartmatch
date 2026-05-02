-- Event-Reminder-Push: 1h vor posts.event_at an alle "going"-RSVPs pushen.
-- pg_cron-Job triggert minütlich public.dispatch_event_reminders(), die
-- Posts im 59–61-Minuten-Fenster ausfindig macht, send-push Edge Function
-- aufruft und reminder_sent_at setzt (Idempotenz).
--
-- Voraussetzungen (analog zu 20260503_push_notifications.sql):
--   - pg_net (kommt mit Supabase)
--   - Service-Role-Key in Vault (`select vault.create_secret(...)`)
--   - send-push Edge Function deployed
--
-- Ohne Vault-Secret läuft die Function still durch (kein Crash), damit
-- lokale DBs / Branches weiterlaufen können.

-- 1) reminder_sent_at-Spalte: markiert verschickte Reminders → idempotent
alter table public.posts
  add column if not exists reminder_sent_at timestamptz;

create index if not exists posts_event_reminder_idx
  on public.posts(event_at)
  where event_at is not null and reminder_sent_at is null;

-- 2) Dispatcher: wird minütlich von pg_cron aufgerufen
create or replace function public.dispatch_event_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  service_key text;
  rec record;
  going_users uuid[];
  bar_name_v text;
  poster_username_v text;
  count_sent integer := 0;
  request_id bigint;
begin
  -- Service-Key aus Vault holen; fehlt er, no-op (kein Crash).
  begin
    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;
  exception when others then
    service_key := null;
  end;

  if service_key is null or length(service_key) = 0 then
    return 0;
  end if;

  -- Posts, deren event_at zwischen now+59min und now+61min liegt und für
  -- die noch kein Reminder geschickt wurde. Das 2-Minuten-Fenster fängt
  -- ab, wenn der Cron-Tick mal eine Sekunde später kommt.
  for rec in
    select p.id, p.bar_id, p.user_id, p.event_at, p.content
    from public.posts p
    where p.event_at is not null
      and p.event_at between now() + interval '59 minutes'
                         and now() + interval '61 minutes'
      and p.reminder_sent_at is null
  loop
    select array_agg(user_id) into going_users
    from public.post_rsvps
    where post_id = rec.id and status = 'going';

    -- Kein going-RSVP → nichts pushen, aber als verschickt markieren,
    -- damit wir nicht in der nächsten Minute wieder gucken.
    if going_users is null or array_length(going_users, 1) = 0 then
      update public.posts set reminder_sent_at = now() where id = rec.id;
      continue;
    end if;

    select name into bar_name_v from public.bars where id = rec.bar_id;
    select username into poster_username_v from public.profiles where id = rec.user_id;

    perform net.http_post(
      url := 'https://lecyqxfmfmyoipbuhsrc.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'user_ids', to_jsonb(going_users),
        'title', 'Event in 1 Stunde' ||
                 coalesce(' — ' || bar_name_v, ''),
        'body', coalesce(poster_username_v, 'Jemand') ||
                ': ' || coalesce(rec.content, 'Event geht gleich los'),
        'data', jsonb_build_object(
          'kind', 'event_reminder',
          'post_id', rec.id,
          'bar_id', rec.bar_id,
          'event_at', rec.event_at
        )
      )
    );

    update public.posts set reminder_sent_at = now() where id = rec.id;
    count_sent := count_sent + 1;
  end loop;

  return count_sent;
end;
$$;

-- 3) pg_cron-Job: minütlich
create extension if not exists pg_cron with schema extensions;

-- Doppelte Job-Registrierung vermeiden (cron.schedule würfe bei
-- bestehendem Namen nicht — Supabase-Variante ist permissiv —, aber
-- wir wollen idempotente Migration).
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'dispatch-event-reminders'
  ) then
    perform cron.unschedule('dispatch-event-reminders');
  end if;
end $$;

select cron.schedule(
  'dispatch-event-reminders',
  '* * * * *',
  $cron$select public.dispatch_event_reminders();$cron$
);
