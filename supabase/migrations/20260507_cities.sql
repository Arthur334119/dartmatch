-- Multi-Stadt-Support: städteübergreifend funktionieren, anstatt Berlin zu
-- hardcoden. `cities` enthält Stadtzentrum + Default-Zoom; profiles.city_id
-- referenziert die gewählte Stadt des Users (nullable → fällt auf Berlin
-- zurück).

create table if not exists public.cities (
  id text primary key,                -- slug, z. B. 'berlin'
  name text not null,
  country text not null default 'DE',
  center_lat double precision not null,
  center_lng double precision not null,
  zoom_delta double precision not null default 0.05,
  created_at timestamptz default now()
);

alter table public.cities enable row level security;

drop policy if exists "Anyone reads cities" on public.cities;
create policy "Anyone reads cities" on public.cities
  for select using (true);

insert into public.cities (id, name, center_lat, center_lng, zoom_delta) values
  ('berlin',     'Berlin',     52.5200, 13.4050, 0.05),
  ('hamburg',    'Hamburg',    53.5511, 9.9937,  0.05),
  ('muenchen',   'München',    48.1351, 11.5820, 0.05),
  ('koeln',      'Köln',       50.9375, 6.9603,  0.05),
  ('frankfurt',  'Frankfurt',  50.1109, 8.6821,  0.05),
  ('stuttgart',  'Stuttgart',  48.7758, 9.1829,  0.05),
  ('duesseldorf','Düsseldorf', 51.2277, 6.7735,  0.05),
  ('leipzig',    'Leipzig',    51.3397, 12.3731, 0.05),
  ('dresden',    'Dresden',    51.0504, 13.7373, 0.05),
  ('hannover',   'Hannover',   52.3759, 9.7320,  0.05)
on conflict (id) do update
  set name = excluded.name,
      center_lat = excluded.center_lat,
      center_lng = excluded.center_lng;

-- profiles.city_id: nullable, fällt auf Berlin zurück, wenn nicht gesetzt
alter table public.profiles
  add column if not exists city_id text references public.cities(id)
    on update cascade on delete set null;

create index if not exists profiles_city_idx on public.profiles(city_id);

-- bars.city_id: optional — kann später via Geocoding gefüllt werden, ist
-- aktuell aber kein Pflicht-Feld. Wenn nicht gesetzt, sind Bars in jeder
-- Stadt sichtbar (gefiltert wird über Distance).
alter table public.bars
  add column if not exists city_id text references public.cities(id)
    on update cascade on delete set null;

create index if not exists bars_city_idx on public.bars(city_id);
