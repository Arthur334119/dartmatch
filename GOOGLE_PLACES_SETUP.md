# Google Places Setup

Schritt-für-Schritt-Anleitung, um echte Bar-Fotos und -Bewertungen via Google Places API in Kneipenfinder einzubinden.

## 1. API-Key besorgen

1. https://console.cloud.google.com/ → neues Projekt (oder bestehendes)
2. APIs & Services → Library → **Places API (New)** aktivieren
3. APIs & Services → Credentials → **Create credentials → API key**
4. Empfehlung: API restrictions auf „Places API (New)" beschränken, Application restrictions vorerst „None" (Edge Function ruft serverseitig auf)
5. Billing aktivieren — Free-Tier ($200/Monat) reicht für ~10.000 Place-Detail-Calls

## 2. Migrationen einspielen

Im Supabase-Dashboard → SQL Editor → folgende Files nacheinander ausführen:

```sql
-- 1) supabase/migrations/20260430_profile_phone.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);

-- 2) supabase/migrations/20260501_bar_google_place.sql
ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS last_places_sync_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS bars_google_place_id_idx
  ON public.bars (google_place_id) WHERE google_place_id IS NOT NULL;
```

## 3. Edge Function deployen

```bash
# Einmalig: CLI-Login + Projekt linken
supabase login
supabase link --project-ref lecyqxfmfmyoipbuhsrc

# Secret setzen (bleibt serverseitig, kommt nicht in den App-Bundle)
supabase secrets set GOOGLE_PLACES_API_KEY=AIza...

# Function deployen — --no-verify-jwt, weil auch nicht-eingeloggte
# Nutzer den Bar-Detail-Screen sehen können
supabase functions deploy google-places --no-verify-jwt
```

## 4. Place-IDs zu den Bars matchen

```bash
cd supabase
npm install   # falls noch nicht passiert (pg ist drin)

GOOGLE_PLACES_API_KEY=AIza... \
DB_URL="postgres://postgres:<DB-PASSWORD>@db.lecyqxfmfmyoipbuhsrc.supabase.co:5432/postgres" \
node backfill_google_place_ids.mjs

# Erst mal mit DRY_RUN=1 LIMIT=5 ausprobieren, ob Treffer Sinn ergeben
```

DB-Passwort steht im Supabase Dashboard → Settings → Database.

## 5. Verifizieren

- `app/bar/[id].tsx` lädt nach dem Mount automatisch via `getGooglePlaceDetails(googlePlaceId)`
- Hero-Foto wird durch das erste Google-Photo ersetzt, sobald die Daten da sind
- Im Reviews-Tab erscheint unter den eigenen Bewertungen ein Block „Bewertungen von Google" inkl. Attribution

## Kosten im Blick behalten

Google Places API New (Stand 2026):

- `searchText` (Backfill): $32 / 1000 Calls → einmaliger Backfill für ~50 Bars: ~$1,60
- `Place Details` (pro Bar-Detail-Mount): $17 / 1000 Calls (Essentials SKU)
  - Edge-Cache (`s-maxage=1800`) deckelt das auf max. 2 Calls/Bar/Stunde
- Photos: pro abgerufenem Bild ~$7 / 1000

Das $200-Free-Tier deckt locker 50 Bars × 1.000 Detail-Mounts/Monat. Wenn die User-Zahlen wachsen, lohnt sich serverseitiges Caching der Photo-URLs in Supabase Storage (max. 30 Tage laut ToS).

## Branding

Pflicht laut Google ToS: „Powered by Google" sichtbar dort, wo Google-Daten gezeigt werden.
Das ist im Reviews-Tab schon eingebaut (`Bewertungen via Google Places. Powered by Google.`).
