#!/bin/bash
set -e
cd "$(dirname "$0")"

cat > seed_bars.sql <<'HEADER'
-- Seed: 50+ Berliner Bars mit Geo, Spielen, Features, Bierpreis
-- Nach 20260429_features_and_verification.sql ausführen.

INSERT INTO public.bars (name, description, address, latitude, longitude, beer_price, games, features, opening_hours)
VALUES
HEADER

count=$(jq 'length' bars_geocoded.json)
for i in $(seq 0 $((count - 1))); do
  bar=$(jq ".[$i]" bars_geocoded.json)

  name=$(echo "$bar" | jq -r '.name' | sed "s/'/''/g")
  desc=$(echo "$bar" | jq -r '.description // ""' | sed "s/'/''/g")
  addr=$(echo "$bar" | jq -r '.address' | sed "s/'/''/g")
  lat=$(echo "$bar" | jq -r '.latitude')
  lng=$(echo "$bar" | jq -r '.longitude')
  price=$(echo "$bar" | jq -r '.beer_price // "NULL"')
  [ "$price" = "null" ] && price="NULL"
  games=$(echo "$bar" | jq -c '.games // []')
  features=$(echo "$bar" | jq -c '.features // []')

  comma=","
  [ "$i" -eq $((count - 1)) ] && comma=";"

  printf "  ('%s', '%s', '%s', %s, %s, %s, '%s'::jsonb, '%s'::jsonb, '{}'::jsonb)%s\n" \
    "$name" "$desc" "$addr" "$lat" "$lng" "$price" "$games" "$features" "$comma" >> seed_bars.sql
done

echo "" >> seed_bars.sql
echo "Seed-SQL erstellt: $(wc -l < seed_bars.sql) Zeilen"
