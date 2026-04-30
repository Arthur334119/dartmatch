-- Aktiviert Realtime-Streaming für Tabellen, auf die der Client
-- via supabase.channel().on('postgres_changes', …) hört. Ohne diese
-- Publication kommen keine Events durch — die Subscription scheint zu
-- funktionieren, schickt aber stillschweigend nichts.
--
-- Tabellen:
--   posts    → Community-Feed live halten
--   presence → "Vor Ort"-Counter live halten

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.presence;
