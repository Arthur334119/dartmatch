#!/bin/bash
set -e
cd "$(dirname "$0")"

INPUT="bars_seed.json"
OUTPUT="bars_geocoded.json"
UA="DartMatch/1.0 (vincent.borko@gmail.com)"

count=$(jq 'length' "$INPUT")
echo "Geocoding $count bars via Nominatim..."

result="[]"
for i in $(seq 0 $((count - 1))); do
  bar=$(jq ".[$i]" "$INPUT")
  name=$(echo "$bar" | jq -r '.name')
  addr=$(echo "$bar" | jq -r '.address')

  query=$(printf '%s, Berlin, Germany' "$addr" | jq -sRr @uri)
  resp=$(curl -s -A "$UA" "https://nominatim.openstreetmap.org/search?q=$query&format=json&limit=1&countrycodes=de")

  lat=$(echo "$resp" | jq -r '.[0].lat // empty')
  lng=$(echo "$resp" | jq -r '.[0].lon // empty')

  if [ -z "$lat" ]; then
    # Fallback: search by name alone in Berlin
    name_query=$(printf '%s, Berlin' "$name" | jq -sRr @uri)
    resp=$(curl -s -A "$UA" "https://nominatim.openstreetmap.org/search?q=$name_query&format=json&limit=1&countrycodes=de")
    lat=$(echo "$resp" | jq -r '.[0].lat // empty')
    lng=$(echo "$resp" | jq -r '.[0].lon // empty')
  fi

  if [ -z "$lat" ]; then
    echo "  [$((i+1))/$count] ✗ $name -- not found"
    lat="null"; lng="null"
  else
    echo "  [$((i+1))/$count] ✓ $name -> $lat, $lng"
  fi

  enriched=$(echo "$bar" | jq --argjson lat "$lat" --argjson lng "$lng" '. + {latitude: $lat, longitude: $lng}')
  result=$(echo "$result" | jq --argjson bar "$enriched" '. + [$bar]')

  sleep 1.1
done

echo "$result" > "$OUTPUT"
echo "Done -> $OUTPUT"
