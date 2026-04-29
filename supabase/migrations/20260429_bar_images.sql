-- Lizenzfreie Bar-Bilder von Unsplash (Unsplash License: kostenlos für
-- kommerzielle Nutzung, keine Attribution erforderlich).
--
-- Strategie: Wir wählen das Bild deterministisch nach dem dominanten
-- Spielangebot der Bar. Hat eine Bar mehrere games, gewinnt das spezifischste
-- (dart > billard > kicker > bowling), sonst ein generisches Pub-Bild,
-- rotiert über md5(name) damit nicht alle Bars dasselbe Bild bekommen.
--
-- Quellen (alle "Free to use under the Unsplash License"):
--   bar1: https://unsplash.com/photos/1zGxaFuG7LY
--   bar2: https://unsplash.com/photos/QFJuhlfgHwc
--   bar3: https://unsplash.com/photos/5TUoO03z8tg
--   dart1: https://unsplash.com/photos/lVD6WBdY_5M
--   dart2: https://unsplash.com/photos/9P97yKT3Z4Y
--   billard: https://unsplash.com/photos/ynGFY68EUug
--   kicker1: https://unsplash.com/photos/ANpeikC7Up4
--   kicker2: https://unsplash.com/photos/IEzXUhCq8Zo
--   bowling: https://unsplash.com/photos/WxwKVkKea1E

UPDATE public.bars SET image_url =
  CASE
    -- Dart-Bars
    WHEN games::jsonb ? 'dart' THEN
      CASE (abs(hashtext(name)) % 2)
        WHEN 0 THEN 'https://images.unsplash.com/photo-1660211983492-9df0c82ba9ae?w=1200&q=80&auto=format&fit=crop'
        ELSE        'https://images.unsplash.com/photo-1559077722-5f542dd079e9?w=1200&q=80&auto=format&fit=crop'
      END
    -- Billard / Snooker / Pool
    WHEN games::jsonb ?| array['billard','snooker'] THEN
      'https://images.unsplash.com/photo-1737223450924-5e1a0d5ab85f?w=1200&q=80&auto=format&fit=crop'
    -- Kicker / Tischfußball
    WHEN games::jsonb ? 'kicker' THEN
      CASE (abs(hashtext(name)) % 2)
        WHEN 0 THEN 'https://images.unsplash.com/photo-1537870518440-87b194cab411?w=1200&q=80&auto=format&fit=crop'
        ELSE        'https://images.unsplash.com/photo-1650354080115-629453d1a1ac?w=1200&q=80&auto=format&fit=crop'
      END
    -- Bowling
    WHEN games::jsonb ? 'bowling' THEN
      'https://images.unsplash.com/photo-1708491221559-08fe19561b32?w=1200&q=80&auto=format&fit=crop'
    -- Generischer Pub-Look, gleichmäßig auf 3 Bilder verteilt
    ELSE
      CASE (abs(hashtext(name)) % 3)
        WHEN 0 THEN 'https://images.unsplash.com/photo-1756564800880-7a24d6c6cc15?w=1200&q=80&auto=format&fit=crop'
        WHEN 1 THEN 'https://images.unsplash.com/photo-1690944258735-c033b1c64f87?w=1200&q=80&auto=format&fit=crop'
        ELSE        'https://images.unsplash.com/photo-1642232173018-5cd3884ef9c2?w=1200&q=80&auto=format&fit=crop'
      END
  END
WHERE image_url IS NULL OR image_url = '';
