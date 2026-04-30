# Supabase MCP Setup (für Claude Code)

Dieses Dokument erklärt, wie der andere Claude-Code-Chat auf das Kneipenfinder-Supabase-Projekt zugreifen kann — und welche Limits ich (der erste Chat) hatte.

## Wie ich auf Supabase zugegriffen habe

In meiner Session war der **claude.ai Supabase MCP-Server** verbunden. Das ist ein remote MCP, der über `claude.ai` läuft und folgende Tools bereitstellt:

- `list_projects` — alle Supabase-Projekte der verbundenen Org auflisten
- `list_tables`, `list_extensions`, `list_migrations`
- `apply_migration` (DDL) und `execute_sql` (DML)
- `deploy_edge_function`, `list_edge_functions`, `get_edge_function`
- `get_logs`, `get_advisors`
- `generate_typescript_types`

Authentifizierung läuft über die Org-Mitgliedschaft des Claude.ai-Accounts. Du musst dort als Mitglied der Supabase-Org eingeladen sein, sonst gibt's `MCP error -32600: You do not have permission to perform this action`.

## Mein konkretes Problem

Mein MCP war auf die Org **„Speakz Media GmbH"** gescoped (sichtbar in den `<system-reminder>`-Hinweisen am Anfang der Session). Das Kneipenfinder-Projekt hat aber die Project-Ref `lecyqxfmfmyoipbuhsrc` — und gehört zu einer **anderen Org**.

Konsequenz: Ich konnte das Projekt zwar mit der Ref direkt ansprechen, bekam aber Permission-Denied. Daher konnte ich:

- Migrationen NICHT applien (musste sie als SQL-Dateien schreiben)
- Edge Functions NICHT deployen (musste sie als Code-Dateien schreiben)

## Was der User tun muss, damit der andere Chat es kann

Es gibt **zwei Wege**:

### Weg 1: MCP-Server für die richtige Org verbinden (sauber)

1. Auf https://claude.ai/settings → Integrations → Supabase → Connect
2. Beim OAuth-Schritt die Org auswählen, die das Kneipenfinder-Projekt enthält
   (die mit Ref `lecyqxfmfmyoipbuhsrc`)
3. In Claude Code prüfen: `list_projects` muss „Kneipenfinder" oder ein Projekt mit der Ref `lecyqxfmfmyoipbuhsrc` zurückgeben

Wenn das geht, kann der andere Chat:
- Migrationen mit `apply_migration` einspielen
- Edge Functions mit `deploy_edge_function` deployen
- Direkt SQL ausführen

### Weg 2: Lokales Supabase CLI (kein MCP nötig)

Wenn der MCP-Weg nicht klappt, Claude Code kann auch das `supabase` CLI nutzen:

```bash
# Einmalig
supabase login                                       # Browser-Login als User
supabase link --project-ref lecyqxfmfmyoipbuhsrc     # Projekt verlinken

# Migrationen einspielen
supabase db push

# Edge Function deployen
supabase secrets set GOOGLE_PLACES_API_KEY=AIza...
supabase functions deploy google-places --no-verify-jwt
```

**Wichtig:** `supabase login` öffnet den Browser. In Claude Code geht das nur über `! supabase login` (das `!` führt das Kommando interaktiv im Terminal des Users aus, nicht im Sandbox-Bash). Der User muss das einmal manuell tun, danach kann Claude Code die anderen Befehle direkt ausführen.

Nach `link` legt das CLI ein `supabase/.temp/` und ein `.supabase/`-Verzeichnis an — daran erkennst du, dass das Projekt verlinkt ist.

## Was schon im Repo liegt (Stand 2026-04-30)

Pending Migrationen:
- `supabase/migrations/20260430_profile_phone.sql` — `profiles.phone TEXT`
- `supabase/migrations/20260501_bar_google_place.sql` — `bars.google_place_id` + `last_places_sync_at`

Edge Function:
- `supabase/functions/google-places/index.ts` — Google Places (New) Proxy

Backfill-Script (lokal ausführen, kein MCP nötig, nur DB-URL + API-Key):
- `supabase/backfill_google_place_ids.mjs`

Komplette Anleitung in `GOOGLE_PLACES_SETUP.md`.

## TL;DR für den anderen Chat

> Der User hat in einem anderen Claude-Code-Chat schon zwei Migrationen und eine Edge Function als Code geschrieben (siehe `supabase/migrations/20260430_*.sql`, `20260501_*.sql` und `supabase/functions/google-places/`). Diese müssen jetzt in Supabase eingespielt werden. Project-Ref: `lecyqxfmfmyoipbuhsrc`. Falls dein Supabase-MCP keinen Zugriff auf dieses Projekt hat (Permission denied bei `list_tables`), bitte den User einmalig `! supabase login` und `! supabase link --project-ref lecyqxfmfmyoipbuhsrc` auszuführen — danach kannst du `supabase db push` und `supabase functions deploy google-places --no-verify-jwt` aufrufen.

## Was du dem User mitgeben musst

- DB-Passwort (nur falls Backfill-Script per `DB_URL` läuft) — Supabase Dashboard → Settings → Database
- Google Places API-Key — Google Cloud Console → APIs & Services → Credentials
