-- Google-Places-Integration: pro Bar speichern wir die Place-ID, damit der
-- Client darüber dynamisch Fotos und Reviews nachladen kann.
--
-- Place-IDs sind stabil über die Zeit (laut Google docs), wir halten sie
-- in einer eigenen Spalte statt sie aus Name+Adresse zu rekonstruieren.
--
-- last_places_sync_at hilft uns später, Foto-URLs nicht öfter als nötig
-- aufzufrischen (Google ToS: max. 30 Tage Caching). Aktuell unbenutzt,
-- aber das Schema ist da, sobald wir serverseitig cachen wollen.

ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS last_places_sync_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS bars_google_place_id_idx
  ON public.bars (google_place_id)
  WHERE google_place_id IS NOT NULL;
