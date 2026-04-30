-- Aktiviert Realtime-Streaming für Tabellen, auf die der Client
-- via supabase.channel().on('postgres_changes', …) hört. Ohne diese
-- Publication kommen keine Events durch — die Subscription scheint zu
-- funktionieren, schickt aber stillschweigend nichts.
--
-- Tabellen:
--   posts    → Community-Feed live halten
--   presence → "Vor Ort"-Counter live halten

-- Idempotent: nur hinzufügen, wenn die Tabelle noch nicht in der
-- Publication ist. Sonst kracht ein erneuter Lauf mit SQLSTATE 42710.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'presence'
  ) then
    alter publication supabase_realtime add table public.presence;
  end if;
end $$;
