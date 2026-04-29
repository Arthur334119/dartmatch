-- Features (hund/raucher/outdoor/...) für Bars + Pflicht-Avatar für Verifizierung

ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS bars_features_gin ON public.bars USING GIN (features);
CREATE INDEX IF NOT EXISTS bars_games_gin ON public.bars USING GIN (games);
CREATE INDEX IF NOT EXISTS bars_beer_price_idx ON public.bars (beer_price);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.is_user_verified(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = uid
      AND u.email_confirmed_at IS NOT NULL
      AND p.avatar_url IS NOT NULL
      AND length(p.avatar_url) > 0
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Verified users can create posts" ON public.posts;
CREATE POLICY "Verified users can create posts" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_verified(auth.uid()));

DROP POLICY IF EXISTS "Users can check in" ON public.presence;
DROP POLICY IF EXISTS "Verified users can check in" ON public.presence;
CREATE POLICY "Verified users can check in" ON public.presence
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_user_verified(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own presence" ON public.presence;
CREATE POLICY "Users can delete own presence" ON public.presence
  FOR DELETE USING (auth.uid() = user_id);

-- ── STORAGE: avatars bucket ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
