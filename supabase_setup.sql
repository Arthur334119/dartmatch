-- ═══════════════════════════════════════════════════════════
-- DartMatch – Supabase Setup SQL
-- Führe dieses Skript im Supabase SQL Editor aus
-- ═══════════════════════════════════════════════════════════

-- ── TABLES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  phone TEXT,
  website TEXT,
  beer_price DOUBLE PRECISION,
  capacity INTEGER,
  games JSONB DEFAULT '[]',
  opening_hours JSONB DEFAULT '{}',
  image_url TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  osm_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  favorite_games JSONB DEFAULT '[]',
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bar_id UUID REFERENCES public.bars(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('playing', 'looking')),
  game_type TEXT,
  content TEXT NOT NULL,
  player_count INTEGER DEFAULT 2,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bar_id UUID REFERENCES public.bars(id) ON DELETE CASCADE NOT NULL,
  rating DOUBLE PRECISION NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bar_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bar_id UUID REFERENCES public.bars(id) ON DELETE CASCADE NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, bar_id)
);

-- ── RLS POLICIES ─────────────────────────────────────────

ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

-- Bars: public read
CREATE POLICY "Public bars are readable" ON public.bars FOR SELECT USING (true);

-- Profiles: public read, own write
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: public read, own write
CREATE POLICY "Public posts read" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Reviews: public read, own write
CREATE POLICY "Public reviews read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

-- Messages: users see own messages
CREATE POLICY "Users see own messages" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Authenticated users send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Presence: public read, own write
CREATE POLICY "Public presence read" ON public.presence FOR SELECT USING (true);
CREATE POLICY "Users manage own presence" ON public.presence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own presence" ON public.presence FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own presence" ON public.presence FOR DELETE USING (auth.uid() = user_id);

-- ── REALTIME ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;

-- ── TRIGGER: Auto-create profile on signup ────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 50 TEST BARS IN BERLIN ────────────────────────────────

INSERT INTO public.bars (name, description, address, latitude, longitude, phone, beer_price, capacity, games, opening_hours, rating, review_count) VALUES

-- KREUZBERG
('Dart & Doner', 'Gemütliche Dart-Kneipe mit türkischen Snacks', 'Oranienstr. 25, 10999 Berlin', 52.4990, 13.4186, '+49 30 6123456', 3.50, 60,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"17:00-03:00","saturday":"14:00-03:00","sunday":"14:00-00:00"}',
 4.5, 23),

('Bullseye Berlin', 'Berlins größte Dart-Bar mit 8 Boards', 'Bergmannstr. 102, 10961 Berlin', 52.4904, 13.3924, '+49 30 7654321', 4.20, 120,
 '["501", "301", "Cricket", "Shanghai", "Killer"]',
 '{"monday":"16:00-01:00","tuesday":"16:00-01:00","wednesday":"16:00-01:00","thursday":"16:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"13:00-00:00"}',
 4.8, 45),

('The Arrow Pub', 'Britische Pub-Atmosphäre mit 4 Dart-Scheiben', 'Gneisenaustr. 7, 10961 Berlin', 52.4876, 13.3910, '+49 30 5551234', 3.80, 80,
 '["501", "Cricket", "Halve-It"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-03:00","sunday":"15:00-00:00"}',
 4.2, 31),

('Pfeil & Pint', 'Kleines Craft-Beer-Lokal mit Dart-Ecke', 'Graefestr. 89, 10967 Berlin', 52.4918, 13.4154, null, 4.50, 45,
 '["501", "Cricket"]',
 '{"monday":"Geschlossen","tuesday":"19:00-01:00","wednesday":"19:00-01:00","thursday":"19:00-02:00","friday":"17:00-03:00","saturday":"14:00-03:00","sunday":"15:00-00:00"}',
 4.0, 18),

('Kreuzberger Wurfbude', 'Legendäre Stammkneipe mit täglichen Turnieren', 'Skalitzer Str. 134, 10999 Berlin', 52.5002, 13.4373, '+49 30 4321098', 3.20, 70,
 '["501", "301", "Cricket", "Killer", "Baseball"]',
 '{"monday":"17:00-02:00","tuesday":"17:00-02:00","wednesday":"17:00-02:00","thursday":"17:00-03:00","friday":"15:00-04:00","saturday":"13:00-04:00","sunday":"13:00-01:00"}',
 4.6, 67),

('SO36 Dart Lounge', 'Underground-Feeling, günstige Biere, tolle Vibes', 'Oranienstr. 190, 10999 Berlin', 52.4998, 13.4302, null, 2.80, 90,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"20:00-03:00","tuesday":"20:00-03:00","wednesday":"20:00-03:00","thursday":"20:00-04:00","friday":"18:00-05:00","saturday":"18:00-05:00","sunday":"18:00-02:00"}',
 4.1, 29),

-- FRIEDRICHSHAIN
('Darts & Dreams FHain', 'Hipster-Kneipe mit modernen Elektronik-Boards', 'Simon-Dach-Str. 12, 10245 Berlin', 52.5125, 13.4567, '+49 30 2987654', 4.00, 65,
 '["501", "Cricket", "Shanghai", "Halve-It"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-04:00","sunday":"14:00-00:00"}',
 4.4, 38),

('Revaler Bullseye', 'Bar im RAW-Gelände, rauer Charme', 'Revaler Str. 99, 10245 Berlin', 52.5107, 13.4598, null, 3.50, 100,
 '["501", "301", "Cricket", "Killer"]',
 '{"monday":"Geschlossen","tuesday":"Geschlossen","wednesday":"20:00-03:00","thursday":"20:00-03:00","friday":"18:00-05:00","saturday":"16:00-06:00","sunday":"16:00-02:00"}',
 4.3, 52),

('Friedrichshainer Dart Club', 'Vereinslokal mit wöchentlichen Ligen', 'Frankfurter Allee 73, 10247 Berlin', 52.5155, 13.4714, '+49 30 1234567', 3.60, 55,
 '["501", "Cricket", "Around the Clock", "Halve-It", "Shanghai"]',
 '{"monday":"18:00-00:00","tuesday":"18:00-00:00","wednesday":"18:00-00:00","thursday":"18:00-01:00","friday":"16:00-02:00","saturday":"14:00-02:00","sunday":"Geschlossen"}',
 4.7, 41),

('East Side Darts', 'Bar direkt an der Spree mit Blick aufs Wasser', 'Mühlenstr. 26, 10243 Berlin', 52.5048, 13.4522, null, 4.80, 80,
 '["501", "Cricket"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-04:00","sunday":"13:00-01:00"}',
 3.9, 27),

('Warschauer Wurfarm', 'Riesige Bar mit Darts und Kicker', 'Warschauer Str. 56, 10243 Berlin', 52.5081, 13.4502, '+49 30 8765432', 3.90, 150,
 '["501", "301", "Cricket", "Killer", "Baseball"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-04:00","saturday":"13:00-04:00","sunday":"14:00-01:00"}',
 4.5, 63),

('Boxhagener Dart Pub', 'Gemütliche Eckkneipe am belebten Boxi-Platz', 'Boxhagener Str. 25, 10245 Berlin', 52.5138, 13.4665, null, 3.30, 50,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 4.2, 34),

-- PRENZLAUER BERG
('Prenzl Dart & Bar', 'Schicker Laden mit gutem Weinangebot', 'Kastanienallee 7, 10435 Berlin', 52.5330, 13.4082, '+49 30 3456789', 5.20, 60,
 '["501", "Cricket", "Shanghai"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-03:00","sunday":"15:00-00:00"}',
 4.4, 29),

('Kollwitz Darts', 'Familienfreundlich bis 20 Uhr, Party danach', 'Kollwitzstr. 45, 10405 Berlin', 52.5378, 13.4207, null, 4.50, 55,
 '["501", "Cricket", "Halve-It"]',
 '{"monday":"16:00-00:00","tuesday":"16:00-00:00","wednesday":"16:00-00:00","thursday":"16:00-01:00","friday":"15:00-02:00","saturday":"14:00-02:00","sunday":"14:00-23:00"}',
 4.1, 22),

('Mauerpark Bullseye', 'Kneipe nahe dem Mauerpark, ideal nach dem Flohmarkt', 'Bernauer Str. 63, 13355 Berlin', 52.5413, 13.3974, '+49 30 9876543', 3.80, 75,
 '["501", "301", "Cricket", "Killer"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"12:00-04:00","sunday":"12:00-00:00"}',
 4.6, 47),

('Helmholtzplatz Darts', 'Entspannte Nachbarschaftskneipe', 'Lychener Str. 60, 10437 Berlin', 52.5398, 13.4102, null, 4.00, 45,
 '["501", "Cricket"]',
 '{"monday":"Geschlossen","tuesday":"19:00-01:00","wednesday":"19:00-01:00","thursday":"19:00-01:00","friday":"17:00-02:00","saturday":"15:00-02:00","sunday":"15:00-23:00"}',
 3.8, 15),

('Pappelallee Wurfbude', 'Trendiges Lokal im Kiez', 'Pappelallee 30, 10437 Berlin', 52.5355, 13.4128, null, 4.20, 50,
 '["501", "Cricket", "Around the Clock", "Shanghai"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 4.3, 33),

-- MITTE
('Berlin Darts Mitte', 'Zentralgelegene Top-Dart-Bar', 'Rosenthaler Str. 40, 10178 Berlin', 52.5259, 13.3996, '+49 30 2109876', 5.50, 80,
 '["501", "301", "Cricket", "Shanghai", "Killer", "Halve-It"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"14:00-00:00"}',
 4.9, 78),

('Hackescher Markt Pub', 'Internationale Atmosphäre, tägliches Dart', 'Neue Schönhauser Str. 3, 10178 Berlin', 52.5241, 13.4019, '+49 30 3210987', 5.00, 90,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"16:00-01:00","tuesday":"16:00-01:00","wednesday":"16:00-01:00","thursday":"16:00-02:00","friday":"14:00-03:00","saturday":"12:00-03:00","sunday":"13:00-00:00"}',
 4.3, 55),

('Alexanderplatz Arrows', 'Touristenbeschuss? Nein – Dart-Spaß!', 'Karl-Marx-Allee 3, 10178 Berlin', 52.5213, 13.4142, null, 4.50, 100,
 '["501", "Cricket", "Killer"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-04:00","sunday":"13:00-01:00"}',
 4.0, 44),

-- NEUKÖLLN
('Reuterkiez Darts', 'Schöner Mix aus Bar und Community-Raum', 'Reuterstr. 17, 12047 Berlin', 52.4851, 13.4218, null, 3.40, 60,
 '["501", "Cricket", "Around the Clock", "Baseball"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-03:00","sunday":"14:00-00:00"}',
 4.2, 28),

('Körnerkiez Bullseye', 'Ruhige Kneipe mit fanatischen Dart-Fans', 'Weisestr. 43, 12049 Berlin', 52.4783, 13.4284, null, 3.00, 40,
 '["501", "Cricket"]',
 '{"monday":"Geschlossen","tuesday":"Geschlossen","wednesday":"19:00-01:00","thursday":"19:00-01:00","friday":"17:00-02:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 3.9, 12),

('Neuköllner Nacht-Dartbar', 'Öffnet wenn andere schließen', 'Sonnenallee 90, 12045 Berlin', 52.4823, 13.4382, '+49 30 6543210', 3.20, 70,
 '["501", "301", "Cricket", "Killer"]',
 '{"monday":"22:00-06:00","tuesday":"22:00-06:00","wednesday":"22:00-06:00","thursday":"22:00-06:00","friday":"22:00-08:00","saturday":"22:00-08:00","sunday":"22:00-04:00"}',
 3.7, 19),

('Karl-Marx-Straße Darts', 'Einfache Berliner Kneipe ohne Schnickschnack', 'Karl-Marx-Str. 200, 12055 Berlin', 52.4789, 13.4421, null, 2.80, 55,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"15:00-00:00"}',
 4.0, 21),

-- SCHÖNEBERG / TEMPELHOF
('Goltzstraße Darts', 'Lebendige Kneipe im Kiez', 'Goltzstr. 33, 10781 Berlin', 52.4958, 13.3534, '+49 30 7890123', 4.00, 55,
 '["501", "Cricket", "Shanghai"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 4.3, 26),

('Tempodrom Dart Lounge', 'Exklusivere Bar mit Cocktails und Dart', 'Möckernstr. 10, 10963 Berlin', 52.4982, 13.3796, null, 7.00, 70,
 '["501", "Cricket", "Halve-It"]',
 '{"monday":"19:00-02:00","tuesday":"19:00-02:00","wednesday":"19:00-02:00","thursday":"19:00-03:00","friday":"17:00-04:00","saturday":"15:00-04:00","sunday":"16:00-01:00"}',
 4.5, 37),

-- CHARLOTTENBURG
('Kurfürstendamm Darts', 'Stylische Westberliner Dart-Bar', 'Kurfürstendamm 215, 10719 Berlin', 52.5033, 13.3300, '+49 30 5432109', 5.50, 80,
 '["501", "Cricket", "Shanghai", "Around the Clock"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"14:00-03:00","sunday":"15:00-00:00"}',
 4.4, 49),

('Savignyplatz Arrows', 'Gediegene Bar mit Stammkunden', 'Grolmanstr. 51, 10623 Berlin', 52.5078, 13.3137, null, 6.00, 60,
 '["501", "Cricket"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-02:00","saturday":"15:00-02:00","sunday":"16:00-00:00"}',
 4.1, 23),

('Wilmersdorfer Wurfscheibe', 'Familiär, günstig, immer was los', 'Wilmersdorfer Str. 120, 10627 Berlin', 52.5055, 13.3062, null, 3.80, 50,
 '["501", "Cricket", "Around the Clock", "Killer"]',
 '{"monday":"17:00-00:00","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"16:00-02:00","saturday":"14:00-02:00","sunday":"15:00-23:00"}',
 4.0, 17),

-- PANKOW / WEISSENSEE
('Prenzlauer Promenade Darts', 'Entspannte Bar am Rand von P-Berg', 'Prenzlauer Promenade 34, 13089 Berlin', 52.5598, 13.4236, null, 3.50, 45,
 '["501", "Cricket"]',
 '{"monday":"18:00-00:00","tuesday":"18:00-00:00","wednesday":"18:00-00:00","thursday":"18:00-01:00","friday":"16:00-02:00","saturday":"14:00-02:00","sunday":"15:00-23:00"}',
 3.6, 9),

('Weißenseer Dartclub', 'Vereins-ähnlicher Club mit fester Dart-Liga', 'Berliner Allee 131, 13088 Berlin', 52.5558, 13.4650, '+49 30 9081726', 3.20, 60,
 '["501", "301", "Cricket", "Shanghai", "Halve-It"]',
 '{"monday":"Geschlossen","tuesday":"19:00-23:00","wednesday":"19:00-23:00","thursday":"19:00-23:00","friday":"18:00-01:00","saturday":"15:00-01:00","sunday":"Geschlossen"}',
 4.6, 31),

-- WEDDING / GESUNDBRUNNEN
('Wedding Bullseye', 'Bodenständige Kiez-Kneipe', 'Müllerstr. 148, 13353 Berlin', 52.5518, 13.3578, null, 2.90, 55,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"14:00-00:00"}',
 3.8, 14),

('Gesundbrunnen Darts', 'Schnelle Runden, günstige Biere', 'Badstr. 21, 13357 Berlin', 52.5541, 13.3872, null, 2.70, 45,
 '["501", "Cricket"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 3.7, 11),

('Reinickendorfer Wurfarm', 'Freundschaftliches Ambiente, regelmäßige Turniere', 'Residenzstr. 90, 13409 Berlin', 52.5624, 13.3484, null, 3.20, 60,
 '["501", "Cricket", "Killer"]',
 '{"monday":"Geschlossen","tuesday":"Geschlossen","wednesday":"18:00-01:00","thursday":"18:00-01:00","friday":"17:00-02:00","saturday":"15:00-02:00","sunday":"15:00-23:00"}',
 4.0, 18),

-- SPANDAU / WEST
('Spandauer Bullseye', 'Rustikale Fachwerk-Kneipe mit Dart', 'Breite Str. 32, 13597 Berlin', 52.5351, 13.2022, '+49 30 3334455', 3.40, 70,
 '["501", "Cricket", "Around the Clock", "Halve-It"]',
 '{"monday":"17:00-00:00","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"15:00-02:00","saturday":"13:00-02:00","sunday":"14:00-23:00"}',
 4.1, 22),

-- TREPTOW / KÖPENICK
('Treptower Darts', 'Am Spreeufer mit Sommerterrasse', 'Alt-Treptow 14, 12435 Berlin', 52.4934, 13.4688, null, 3.60, 65,
 '["501", "Cricket"]',
 '{"monday":"16:00-00:00","tuesday":"16:00-00:00","wednesday":"16:00-00:00","thursday":"16:00-01:00","friday":"15:00-02:00","saturday":"13:00-03:00","sunday":"13:00-00:00"}',
 4.2, 19),

('Köpenicker Dart & Kneipe', 'Altberliner Flair in Köpenick', 'Alt-Köpenick 31, 12555 Berlin', 52.4520, 13.5794, '+49 30 6556677', 3.10, 50,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"17:00-00:00","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"15:00-02:00","saturday":"13:00-02:00","sunday":"14:00-23:00"}',
 4.0, 15),

-- LICHTENBERG
('Lichtenberger Bullseye', 'Ostberliner Charme mit modernen Boards', 'Frankfurter Allee 200, 10365 Berlin', 52.5153, 13.5019, null, 3.00, 65,
 '["501", "301", "Cricket", "Killer"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"14:00-01:00"}',
 4.1, 25),

-- STEGLITZ / ZEHLENDORF
('Steglitzer Dart Pub', 'Südwestberliner Flair, solide Dart-Kultur', 'Schloßstr. 75, 12165 Berlin', 52.4573, 13.3228, null, 4.20, 60,
 '["501", "Cricket", "Shanghai"]',
 '{"monday":"17:00-00:00","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"16:00-02:00","saturday":"14:00-02:00","sunday":"15:00-23:00"}',
 3.9, 16),

-- More KREUZBERG / MITTE
('Checkpoint Charlie Darts', 'Historisches Viertel, modernes Dart-Feeling', 'Friedrichstr. 43, 10969 Berlin', 52.5076, 13.3901, null, 5.00, 75,
 '["501", "Cricket", "Around the Clock", "Halve-It"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"15:00-03:00","saturday":"13:00-03:00","sunday":"14:00-00:00"}',
 4.4, 39),

('Landwehrkanal Darts', 'Kanalblick und Dart – was will man mehr?', 'Planufer 87, 10967 Berlin', 52.4930, 13.4072, null, 3.90, 55,
 '["501", "Cricket"]',
 '{"monday":"Geschlossen","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-03:00","sunday":"14:00-00:00"}',
 4.3, 27),

('Moritzplatz Darts & Beats', 'Elektronik-Musik und Dart in einer Bar', 'Prinzenstr. 84, 10969 Berlin', 52.4997, 13.4095, null, 4.00, 90,
 '["501", "Cricket", "Killer"]',
 '{"monday":"Geschlossen","tuesday":"Geschlossen","wednesday":"21:00-04:00","thursday":"21:00-04:00","friday":"20:00-06:00","saturday":"20:00-06:00","sunday":"Geschlossen"}',
 4.2, 35),

('Görlitzer Dart', 'Bar am Görli – entspannt, bunt, offen', 'Glogauer Str. 2, 10999 Berlin', 52.4960, 13.4254, null, 3.30, 50,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"16:00-03:00","saturday":"14:00-04:00","sunday":"14:00-01:00"}',
 4.0, 20),

('Urbanhafen Darts', 'Wassernähe und Dart kombiniert', 'Urbanstr. 4, 10967 Berlin', 52.4912, 13.4047, null, 3.70, 45,
 '["501", "Cricket"]',
 '{"monday":"18:00-00:00","tuesday":"18:00-00:00","wednesday":"18:00-00:00","thursday":"18:00-01:00","friday":"17:00-02:00","saturday":"15:00-03:00","sunday":"15:00-23:00"}',
 3.8, 13),

('Markthalle IX Darts', 'Nach dem Streetfood kommt Dart', 'Eisenbahnstr. 42, 10997 Berlin', 52.4987, 13.4327, null, 4.50, 60,
 '["501", "Cricket", "Shanghai"]',
 '{"monday":"Geschlossen","tuesday":"Geschlossen","wednesday":"19:00-01:00","thursday":"19:00-01:00","friday":"17:00-02:00","saturday":"12:00-03:00","sunday":"12:00-00:00"}',
 4.5, 43),

-- FRIEDRICHSHAIN extra
('Ostkreuz Bullseye', 'Bar am Bahnhof für Pendler und Dart-Fans', 'Sonntagstr. 30, 10245 Berlin', 52.5034, 13.4695, null, 3.50, 55,
 '["501", "Cricket", "Halve-It"]',
 '{"monday":"16:00-00:00","tuesday":"16:00-00:00","wednesday":"16:00-00:00","thursday":"16:00-01:00","friday":"15:00-02:00","saturday":"13:00-03:00","sunday":"14:00-00:00"}',
 4.1, 24),

('Stralauer Dart House', 'Halbinsel-Feeling mit Dart und Grill', 'Stralauer Allee 1, 10245 Berlin', 52.5007, 13.4614, '+49 30 5544332', 3.80, 80,
 '["501", "301", "Cricket", "Killer", "Baseball"]',
 '{"monday":"17:00-00:00","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"15:00-03:00","saturday":"13:00-04:00","sunday":"13:00-01:00"}',
 4.6, 58),

-- PRENZLAUER BERG extra
('Danziger Str. Darts', 'Alteingesessene Stammpub-Kultur', 'Danziger Str. 52, 10435 Berlin', 52.5344, 13.4282, null, 3.60, 50,
 '["501", "Cricket", "Around the Clock"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 4.0, 18),

('Schönhauser Bullseye', 'Moderne Bar mit gutem Bierangebot', 'Schönhauser Allee 54, 10437 Berlin', 52.5371, 13.4145, null, 4.10, 65,
 '["501", "Cricket", "Shanghai", "Killer"]',
 '{"monday":"17:00-01:00","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"16:00-03:00","saturday":"14:00-03:00","sunday":"15:00-00:00"}',
 4.3, 32),

('Eberswalder Dart & Pub', 'Pub-Quiz und Dart – donnerstags immer voll', 'Eberswalder Str. 8, 10437 Berlin', 52.5402, 13.4090, null, 3.90, 60,
 '["501", "Cricket", "Around the Clock", "Halve-It"]',
 '{"monday":"18:00-01:00","tuesday":"18:00-01:00","wednesday":"18:00-01:00","thursday":"18:00-02:00","friday":"17:00-03:00","saturday":"15:00-03:00","sunday":"15:00-00:00"}',
 4.4, 41),

('Greifswalder Str. Darts', 'Ruhigere Dart-Oase im quirligen PBerg', 'Greifswalder Str. 209, 10405 Berlin', 52.5328, 13.4355, null, 3.70, 45,
 '["501", "Cricket"]',
 '{"monday":"Geschlossen","tuesday":"19:00-01:00","wednesday":"19:00-01:00","thursday":"19:00-01:00","friday":"17:00-02:00","saturday":"15:00-02:00","sunday":"15:00-23:00"}',
 3.9, 13);
