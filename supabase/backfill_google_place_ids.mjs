// Einmalig: findet für jede Bar in der DB die Google Place-ID und
// schreibt sie in bars.google_place_id zurück.
//
// Voraussetzung: Migration 20260501_bar_google_place.sql ist eingespielt.
//
// Aufruf:
//   GOOGLE_PLACES_API_KEY=AIza... \
//   DB_URL="postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
//   node backfill_google_place_ids.mjs
//
// Optionen via ENV:
//   DRY_RUN=1   → nichts schreiben, nur loggen
//   LIMIT=10    → nur N Bars verarbeiten (zum Testen)
//
// Wichtig: Wir matchen über Name + Adresse + Location-Bias auf 500 m.
// Das gibt sehr zuverlässige Treffer für Berliner Kneipen. Bars, für die
// kein eindeutiger Treffer kommt, bleiben mit google_place_id = NULL und
// fallen im Client auf das Unsplash-Bild zurück.
import pg from 'pg';

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const dbUrl = process.env.DB_URL;
const dryRun = !!process.env.DRY_RUN;
const limit = process.env.LIMIT ? Number(process.env.LIMIT) : null;

if (!apiKey) {
  console.error('GOOGLE_PLACES_API_KEY fehlt');
  process.exit(1);
}
if (!dbUrl) {
  console.error('DB_URL fehlt');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function findPlaceId(name, address, lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textQuery: `${name} ${address}`,
      languageCode: 'de',
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 500,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.places?.[0] ?? null;
}

await client.connect();
console.log('Verbunden mit DB');

const sql = `
  SELECT id, name, address, latitude, longitude
  FROM public.bars
  WHERE google_place_id IS NULL
  ORDER BY name
  ${limit ? `LIMIT ${limit}` : ''}
`;
const { rows } = await client.query(sql);
console.log(`${rows.length} Bars ohne Place-ID`);

let matched = 0;
let skipped = 0;
for (const bar of rows) {
  try {
    const hit = await findPlaceId(bar.name, bar.address, bar.latitude, bar.longitude);
    if (!hit) {
      console.log(`✗ kein Treffer: ${bar.name}`);
      skipped++;
      continue;
    }
    console.log(`✓ ${bar.name} → ${hit.id} (${hit.formattedAddress})`);
    matched++;
    if (!dryRun) {
      await client.query(
        'UPDATE public.bars SET google_place_id = $1, last_places_sync_at = now() WHERE id = $2',
        [hit.id, bar.id],
      );
    }
    // Rate-Limit-freundlich: 50ms Pause. Free-Tier verträgt deutlich mehr,
    // aber Pause schützt uns vor Burst-Issues.
    await new Promise((r) => setTimeout(r, 50));
  } catch (e) {
    console.error(`! Fehler bei ${bar.name}:`, e.message);
    skipped++;
  }
}

console.log(`\nFertig: ${matched} gematcht, ${skipped} übersprungen.`);
if (dryRun) console.log('(DRY_RUN — nichts geschrieben)');
await client.end();
