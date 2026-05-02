-- Backfill bars.city_id über Haversine-Distanz zur nächstgelegenen Stadt
-- aus public.cities. Nur Bars mit lat/lng werden zugeordnet, und nur, wenn
-- die nächste Stadt im Umkreis von 80 km liegt (Spiegelung der Logik in
-- lib/cities.ts:findNearestCity). Bars in nicht unterstützten Städten
-- bleiben mit city_id = NULL.

-- 1) Reusable function: liefert die nächste city_id zu einem Lat/Lng,
--    oder NULL wenn keine Stadt innerhalb von 80 km liegt.
create or replace function public.nearest_city_id(
  p_lat double precision,
  p_lng double precision,
  p_max_km double precision default 80
)
returns text
language sql
stable
as $$
  with d as (
    select
      c.id,
      -- Haversine in km, R = 6371
      2 * 6371 * asin(sqrt(
        sin(radians((c.center_lat - p_lat) / 2)) ^ 2 +
        cos(radians(p_lat)) * cos(radians(c.center_lat)) *
        sin(radians((c.center_lng - p_lng) / 2)) ^ 2
      )) as dist_km
    from public.cities c
  )
  select id from d
  where dist_km <= p_max_km
  order by dist_km
  limit 1
$$;

-- 2) Backfill: nur Bars ohne city_id und mit gültigen Koordinaten.
update public.bars b
set city_id = public.nearest_city_id(b.latitude, b.longitude)
where b.city_id is null
  and b.latitude is not null
  and b.longitude is not null;

-- 3) Trigger: bei INSERT/UPDATE einer Bar (Koordinaten-Änderung) die
--    city_id automatisch nachziehen, sofern sie nicht explizit gesetzt
--    wurde. Verhindert, dass künftige Bars wieder ohne city_id reinkommen.
create or replace function public.set_bar_city_id()
returns trigger
language plpgsql
as $$
begin
  if new.city_id is null
     and new.latitude is not null
     and new.longitude is not null then
    new.city_id := public.nearest_city_id(new.latitude, new.longitude);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bars_set_city_id on public.bars;
create trigger trg_bars_set_city_id
  before insert or update of latitude, longitude, city_id
  on public.bars
  for each row
  execute function public.set_bar_city_id();
