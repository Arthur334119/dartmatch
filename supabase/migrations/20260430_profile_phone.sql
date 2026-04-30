-- Telefonnummer im Profil (optional in der DB, im Signup-UI als Pflicht).
-- Kein SMS-OTP — reines Profil-Feld. Wenn später Phone-Auth via Supabase
-- aktiviert wird, kann auth.users.phone separat gepflegt werden.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);
