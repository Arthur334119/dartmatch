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

---

# Face-Validation für Profilbilder

Profilbilder werden ausschließlich live mit der Kamera aufgenommen (kein Galerie-Upload mehr) und serverseitig via Google Cloud Vision auf ein Gesicht geprüft. Edge Function: `supabase/functions/validate-face`.

## 1. Cloud Vision API aktivieren

1. https://console.cloud.google.com/ → selbes Projekt wie Places
2. APIs & Services → Library → **Cloud Vision API** aktivieren
3. Optionen für den API-Key:
   - **A — denselben Key wie Places verwenden**: Falls du die Key-Restriction auf „Places API (New)" beschränkt hast, dort zusätzlich „Cloud Vision API" erlauben.
   - **B — separater Key**: APIs & Services → Credentials → neuer Key, restricted auf „Cloud Vision API". Sauberer für Audit/Quota.

## 2. Edge Function deployen

```bash
# Variante A: gleicher Key wie Places — kein neues Secret nötig,
#   die Function fällt auf GOOGLE_PLACES_API_KEY zurück.
# Variante B: eigener Vision-Key
supabase secrets set GOOGLE_VISION_API_KEY=AIza...

# Function deployen — JWT-Verifikation an, weil nur eingeloggte User
# Profilbilder hochladen
supabase functions deploy validate-face
```

## 3. Verifizieren

- Profilbild aufnehmen → Edge-Function-Aufruf in den Supabase-Function-Logs sichtbar
- Bei Selfie ohne Gesicht (z. B. Decke fotografiert) erscheint im Client „Kein Gesicht erkannt"
- Bei zwei Personen erscheint „Mehrere Gesichter erkannt"

## Kosten

Cloud Vision Face Detection: ~$1,50 / 1000 Calls. Erste 1000 Calls / Monat sind frei.
Bei einer einmaligen Verifikation pro User → praktisch immer im Free-Tier.

## Warum nicht on-device?

- `expo-face-detector` ist seit Expo SDK 50 deprecated.
- `react-native-vision-camera` mit Face-Detector-Plugin funktioniert nicht in Expo Go (würde Dev-Builds erfordern) und gar nicht im Web.
- Server-Check ist nicht client-seitig manipulierbar — wer Verifikation will, kriegt sie auch.

---

# Kosten-Caps einrichten (Pflicht vor Production)

Google Cloud hat **kein hartes Spending Cap** wie AWS — wenn ein böswilliger User oder ein Bug einen Endlos-Loop produziert, läuft die Rechnung sonst ungebremst hoch. Folgende drei Layer setzen einen sicheren Deckel.

## Layer 1 — Budget-Alerts (nur Mail, stoppt nichts)

**Wo:** https://console.cloud.google.com/billing/budgets

1. Projekt auswählen oben links
2. **„Create budget"**
3. **Scope:** „All projects" (oder nur das Kneipenfinder-Projekt)
4. **Amount:** Type = „Specified amount", Target = **$10/Monat**
5. **Actions / Thresholds:**
   - Bei **50 %** → E-Mail
   - Bei **90 %** → E-Mail
   - Bei **100 %** → E-Mail
   - „Email alerts to billing admins" anhaken
6. Speichern

→ Du kriegst eine Mail, sobald du `$5/$9/$10` verbrauchst. Die API läuft trotzdem weiter — das ist nur ein Frühwarnsystem.

## Layer 2 — API-Quotas (DAS ist der harte Cap)

**Wo:** https://console.cloud.google.com/apis/dashboard → API anklicken → Tab **„Quotas & System Limits"**

Bei **erreichen des Limits** gibt Google `429 Too Many Requests` zurück, **rechnet also nichts mehr ab**. Die App zeigt dann „nicht erreichbar" — kein Risiko einer Rechnungs-Explosion.

### Cloud Vision API

Direktlink: https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas

Suchen nach **„Requests per day"** → Bleistift-Symbol → setzen auf:

| Quota | Wert | Begründung |
|---|---|---|
| Requests per day | **200** | Ein User braucht 1 Vision-Call (Profilbild). 200/Tag = 200 neue User/Tag — mehr als genug fürs Erste. |
| Requests per minute | (default lassen) | |

### Places API (New)

Direktlink: https://console.cloud.google.com/apis/api/places.googleapis.com/quotas

In der „Quotas"-Tabelle nach SKU-Namen filtern:

| Quota-Name | Wert | Begründung |
|---|---|---|
| **Place Details Essentials** — Requests per day | **1000** | Mit Edge-Cache (`s-maxage=1800`) deckt das ~500 aktive User/Tag |
| **Place Photo** — Requests per day | **2000** | 4 Photos pro Bar × Cache-Misses |
| **Text Search** — Requests per day | **50** | Nur Backfill-Skript braucht das. Beim Backfill kurz auf 200 hochsetzen, danach zurück auf 50. |

### Wie du eine Quota änderst

1. Quota-Zeile anklicken
2. Bleistift-Symbol oben rechts („Edit Quotas")
3. Checkbox bei der Quota
4. Neuen Wert eingeben → **„Submit Request"**

Quota-Reductions sind **sofort aktiv**. Quota-Increases ab einer gewissen Höhe brauchen Approval, aber wir gehen ja runter, nicht hoch.

## Layer 3 — Auto-Shutdown bei Budget-Überschreitung (optional, paranoid)

Google bietet einen offiziellen Workaround: eine **Cloud Function**, die bei Budget-Alert via Pub/Sub die Billing-Verknüpfung des Projekts deaktiviert. Damit fallen alle APIs sofort aus.

Anleitung: https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications

**Mein Rat:** Layer 1 + 2 reichen für den Anfang. Layer 3 ist nur sinnvoll, wenn du die App ohne Aufsicht laufen lässt und „lieber Ausfall als Rechnung" akzeptierst. Wenn du noch nicht 100 € im Monat verlieren würdest, ist es Overkill.

## Sanity-Check nach dem Setup

```bash
# Im Browser: Vision-API mit dem gesetzten Limit überprüfen
# Console → Vision API → Quotas → erwarteter Wert: 200 / day
```

Wenn du Layer 1 + 2 gemacht hast, kann maximal passieren:
- **Best case:** alles im Free-Tier → 0 €
- **Worst case:** Quota-Limit erreicht → API gibt 429 → keine weitere Abrechnung
- **Maximum-Schaden:** ein Tag voll Quota durchgepumpt = ~$3-5 (nicht $1000)

Nicht vergessen, **Billing trotzdem zu aktivieren** — ohne hinterlegte Karte verweigert Google den Service auch im Free-Tier.
