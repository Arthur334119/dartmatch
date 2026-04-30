-- Events / Turnier-Planung: Posts werden zu „mini events" mit
-- optionalem Datum, Maximum-Teilnehmer und RSVP-System.
--
-- Posts ohne event_at bleiben weiterhin „freie" Looking/Playing-Posts —
-- die Felder sind optional und bestehende Posts brechen nicht.

alter table public.posts
  add column if not exists event_at timestamptz,
  add column if not exists max_attendees integer
    check (max_attendees is null or max_attendees between 2 and 50);

create index if not exists posts_event_at_idx on public.posts(event_at)
  where event_at is not null;

-- ── RSVPs ─────────────────────────────────────────────────────────────
create table if not exists public.post_rsvps (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'cant')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (post_id, user_id)
);

create index if not exists post_rsvps_post_idx on public.post_rsvps(post_id);
create index if not exists post_rsvps_user_idx on public.post_rsvps(user_id);

alter table public.post_rsvps enable row level security;

drop policy if exists "Anyone reads rsvps" on public.post_rsvps;
create policy "Anyone reads rsvps" on public.post_rsvps
  for select using (true);

drop policy if exists "Verified users manage own rsvp" on public.post_rsvps;
create policy "Verified users manage own rsvp" on public.post_rsvps
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.is_user_verified(auth.uid())
  );

-- updated_at automatisch pflegen
create or replace function public.touch_post_rsvp_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_rsvps_touch_updated on public.post_rsvps;
create trigger post_rsvps_touch_updated
  before update on public.post_rsvps
  for each row execute function public.touch_post_rsvp_updated_at();

-- Realtime für RSVPs (RSVP-Counts live im Feed)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_rsvps'
  ) then
    alter publication supabase_realtime add table public.post_rsvps;
  end if;
end $$;
