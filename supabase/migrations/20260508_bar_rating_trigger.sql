-- Bar-Rating + review_count automatisch via Postgres-Trigger pflegen.
-- Bisher hat der Client (lib/data.ts::addReview) das Rating clientseitig neu
-- berechnet. Probleme damit:
--   1. Race condition: zwei gleichzeitige Reviews konkurrieren um den
--      UPDATE auf bars.rating.
--   2. Inkonsistenz: ein DELETE oder UPDATE einer Review aktualisierte das
--      Rating gar nicht.
--   3. RLS: der Client braucht UPDATE-Rechte auf bars, was er sonst nicht
--      bräuchte (Bar-Daten sind eigentlich read-only für User).
--
-- Trigger berechnet rating + review_count direkt aus der reviews-Tabelle
-- nach jedem INSERT/UPDATE/DELETE.

create or replace function public.recalc_bar_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bar uuid;
  agg record;
begin
  -- Bei UPDATE könnte sich bar_id geändert haben (unwahrscheinlich, aber
  -- defensiv): beide alten und neuen bar_id neu rechnen.
  if tg_op = 'DELETE' then
    target_bar := old.bar_id;
  else
    target_bar := new.bar_id;
  end if;

  if target_bar is not null then
    select
      coalesce(round(avg(rating)::numeric, 1), 0)::numeric as avg_rating,
      count(*)::int as cnt
    into agg
    from public.reviews
    where bar_id = target_bar;

    update public.bars
    set rating = agg.avg_rating,
        review_count = agg.cnt
    where id = target_bar;
  end if;

  -- Bei UPDATE mit bar_id-Wechsel auch die alte Bar neu rechnen
  if tg_op = 'UPDATE' and old.bar_id is not null and old.bar_id <> new.bar_id then
    select
      coalesce(round(avg(rating)::numeric, 1), 0)::numeric as avg_rating,
      count(*)::int as cnt
    into agg
    from public.reviews
    where bar_id = old.bar_id;

    update public.bars
    set rating = agg.avg_rating,
        review_count = agg.cnt
    where id = old.bar_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists reviews_recalc_rating on public.reviews;
create trigger reviews_recalc_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_bar_rating();

-- Bestehende Bars einmalig synchronisieren, falls Rating + review_count
-- nicht zur Wahrheit passt (z. B. weil clientseitige Berechnung wegen
-- race conditions abgewichen ist).
update public.bars b set
  rating = coalesce(sub.avg_rating, b.rating),
  review_count = coalesce(sub.cnt, b.review_count)
from (
  select bar_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int as cnt
  from public.reviews
  group by bar_id
) sub
where b.id = sub.bar_id;
