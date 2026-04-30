// Supabase Edge Function: Proxy für die Google Places API (New).
//
// Warum als Edge Function statt direkt aus dem Client?
//   - API-Key bleibt serverseitig (würde im Mobile-Bundle leaken).
//   - Wir können den Response auf das Nötige reduzieren (Foto-URLs +
//     Reviews) und das Caching kontrollieren.
//
// Aufruf vom Client (POST, JSON-Body):
//   supabase.functions.invoke('google-places', {
//     body: { action: 'details', place_id: 'ChIJ...', max_photos: 4 },
//   })
//
// Actions:
//   { action: 'details', place_id, max_photos? }
//      → { photos: [{ url, attribution }], reviews: [...], rating, ... }
//   { action: 'findplace', q, lat?, lng? }
//      → { place_id, name, formatted_address }
//      Hilft beim einmaligen Backfill von bars.google_place_id.
//
// Setup:
//   1. supabase secrets set GOOGLE_PLACES_API_KEY=<key>
//   2. supabase functions deploy google-places --no-verify-jwt
//      (--no-verify-jwt: Bar-Detail soll auch für nicht-eingeloggte
//      Nutzer funktionieren. Auth ist hier nicht nötig.)

const GOOGLE_API_BASE = 'https://places.googleapis.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extra,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

type PlaceDetailsResponse = {
  photos?: Array<{ name: string; authorAttributions?: Array<{ displayName?: string }> }>;
  reviews?: Array<{
    name: string;
    rating: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
    };
  }>;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

async function placeDetails(apiKey: string, placeId: string, maxPhotos: number) {
  const fields = [
    'photos.name',
    'photos.authorAttributions',
    'reviews.name',
    'reviews.rating',
    'reviews.text',
    'reviews.originalText',
    'reviews.relativePublishTimeDescription',
    'reviews.publishTime',
    'reviews.authorAttribution',
    'rating',
    'userRatingCount',
    'googleMapsUri',
  ].join(',');

  const url = `${GOOGLE_API_BASE}/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fields,
      'Accept-Language': 'de',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places details failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as PlaceDetailsResponse;

  // Foto-URLs werden separat abgeholt: /v1/{photoName}/media liefert
  // entweder ein Bild (default) oder mit ?skipHttpRedirect=true ein
  // JSON mit photoUri (signierte URL, ~1h gültig).
  const photoNames = (json.photos ?? []).slice(0, Math.max(0, maxPhotos));
  const photos = await Promise.all(
    photoNames.map(async (p) => {
      const mediaUrl = `${GOOGLE_API_BASE}/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`;
      const r = await fetch(mediaUrl, { headers: { 'X-Goog-Api-Key': apiKey } });
      if (!r.ok) return null;
      const data = (await r.json()) as { photoUri?: string };
      if (!data.photoUri) return null;
      return {
        url: data.photoUri,
        attribution: p.authorAttributions?.[0]?.displayName ?? null,
      };
    }),
  );

  const reviews = (json.reviews ?? []).map((r) => ({
    id: r.name,
    rating: r.rating,
    text: r.originalText?.text ?? r.text?.text ?? '',
    publishedAt: r.publishTime ?? null,
    relativeTime: r.relativePublishTimeDescription ?? null,
    authorName: r.authorAttribution?.displayName ?? 'Google-Nutzer',
    authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
  }));

  return {
    rating: json.rating ?? null,
    userRatingCount: json.userRatingCount ?? null,
    googleMapsUri: json.googleMapsUri ?? null,
    photos: photos.filter((x): x is { url: string; attribution: string | null } => x != null),
    reviews,
  };
}

type FindPlaceResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
  }>;
};

async function findPlace(
  apiKey: string,
  query: string,
  lat: number | null,
  lng: number | null,
) {
  const url = `${GOOGLE_API_BASE}/places:searchText`;
  const body: Record<string, unknown> = { textQuery: query, languageCode: 'de' };
  if (lat != null && lng != null) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 500 },
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places searchText failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as FindPlaceResponse;
  const first = json.places?.[0];
  if (!first) return null;
  return {
    place_id: first.id,
    name: first.displayName?.text ?? '',
    formatted_address: first.formattedAddress ?? '',
  };
}

type RequestBody =
  | { action: 'details'; place_id: string; max_photos?: number }
  | { action: 'findplace'; q: string; lat?: number; lng?: number };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) {
    return errorResponse('Server misconfigured: GOOGLE_PLACES_API_KEY missing', 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  try {
    if (body.action === 'details') {
      if (!body.place_id) return errorResponse('place_id required');
      const maxPhotos = Math.min(10, Math.max(0, body.max_photos ?? 4));
      const data = await placeDetails(apiKey, body.place_id, maxPhotos);
      return jsonResponse(data, 200, {
        // Photo-URIs sind ~1h gültig, Reviews ändern sich selten —
        // 30 Min Edge-Cache hält Kosten klein.
        'Cache-Control': 'public, max-age=300, s-maxage=1800',
      });
    }

    if (body.action === 'findplace') {
      if (!body.q) return errorResponse('q required');
      const data = await findPlace(apiKey, body.q, body.lat ?? null, body.lng ?? null);
      return jsonResponse(data ?? { error: 'no match' }, data ? 200 : 404);
    }

    return errorResponse('unknown action');
  } catch (e) {
    console.error('[google-places]', e);
    const msg = e instanceof Error ? e.message : 'unknown error';
    return errorResponse(msg, 502);
  }
});
