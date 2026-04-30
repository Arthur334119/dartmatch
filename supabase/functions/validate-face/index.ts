// Supabase Edge Function: Face-Detection für Profilbilder.
//
// Warum als Edge Function?
//   - On-device-Lösungen (expo-face-detector, vision-camera) funktionieren
//     entweder gar nicht in Expo SDK 54 oder nicht im Web. Server-Check
//     deckt iOS, Android und Web ab und ist nicht client-seitig
//     manipulierbar.
//   - Google Cloud Vision API kostet ~$1.50 / 1000 Bilder, fällt also
//     bei einer einmaligen Profilbild-Verifikation nicht ins Gewicht.
//
// Aufruf vom Client (POST, JSON-Body):
//   supabase.functions.invoke('validate-face', {
//     body: { image_base64: '...' },
//   })
//
// Response:
//   200 → { ok: true, face_count: 1, confidence: 0.97 }
//   200 → { ok: false, face_count: 0, reason: 'Kein Gesicht erkannt' }
//   200 → { ok: false, face_count: 3, reason: 'Mehr als ein Gesicht erkannt' }
//   400/500 → { error: '...' }
//
// Setup:
//   1. In der Google Cloud Console „Cloud Vision API" aktivieren
//      (gleiche Konsole wie Places, derselbe Key kann verwendet werden,
//      wenn die Key-Restriction beide APIs erlaubt — sonst eigener Key).
//   2. supabase secrets set GOOGLE_VISION_API_KEY=<key>
//      (Fallback: GOOGLE_PLACES_API_KEY, wenn der Key beide Scopes hat.)
//   3. supabase functions deploy validate-face
//      (kein --no-verify-jwt: nur eingeloggte User dürfen Bilder hochladen)

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

type Likelihood =
  | 'UNKNOWN'
  | 'VERY_UNLIKELY'
  | 'UNLIKELY'
  | 'POSSIBLE'
  | 'LIKELY'
  | 'VERY_LIKELY';

type FaceAnnotation = {
  detectionConfidence?: number;
  // landmarkingConfidence ist niedrig bei Cartoons/Avataren/Memojis,
  // weil Vision die einzelnen Landmarks (Augen, Nase) nicht sauber findet.
  landmarkingConfidence?: number;
  // Likelihood-Felder helfen, „komische Gesichter" (z. B. Cartoons) auszufiltern.
  underExposedLikelihood?: Likelihood;
  blurredLikelihood?: Likelihood;
  // boundingPoly hilft, sehr kleine Gesichter (< 5 % der Bildfläche) abzuweisen
  // — typisch bei „Foto-vom-Bildschirm"-Spoofs.
  boundingPoly?: { vertices?: Array<{ x?: number; y?: number }> };
  fdBoundingPoly?: { vertices?: Array<{ x?: number; y?: number }> };
};

type ImagePropsResponse = {
  cropHintsAnnotation?: {
    cropHints?: Array<{
      boundingPoly?: { vertices?: Array<{ x?: number; y?: number }> };
    }>;
  };
};

function bboxArea(poly: FaceAnnotation['boundingPoly']): number {
  const v = poly?.vertices ?? [];
  if (v.length < 4) return 0;
  const xs = v.map((p) => p.x ?? 0);
  const ys = v.map((p) => p.y ?? 0);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return Math.max(0, w * h);
}

type LabelAnnotation = {
  description?: string;
  score?: number;
};

type VisionResponse = {
  responses?: Array<{
    faceAnnotations?: FaceAnnotation[];
    labelAnnotations?: LabelAnnotation[];
    error?: { code?: number; message?: string };
  }>;
};

// Labels, die auf ein nicht-echtes Foto hindeuten (Cartoon, Avatar, Memoji,
// gemaltes Bild, Screenshot vom Display). Wenn eines davon mit > 0.7 Score
// kommt, lehnen wir ab.
const FAKE_PHOTO_LABELS = [
  'cartoon',
  'animation',
  'animated cartoon',
  'illustration',
  'drawing',
  'painting',
  'sketch',
  'avatar',
  'caricature',
  'anime',
  'comics',
  'art',
  'fictional character',
  'animated character',
  'clip art',
  'graphic design',
];

function detectFakePhotoLabel(
  labels: LabelAnnotation[] | undefined,
): string | null {
  if (!labels) return null;
  for (const label of labels) {
    const desc = label.description?.toLowerCase() ?? '';
    const score = label.score ?? 0;
    if (score < 0.7) continue;
    if (FAKE_PHOTO_LABELS.includes(desc)) {
      return desc;
    }
  }
  return null;
}

function likelihoodAtLeast(value: Likelihood | undefined, min: Likelihood) {
  const order: Likelihood[] = [
    'UNKNOWN',
    'VERY_UNLIKELY',
    'UNLIKELY',
    'POSSIBLE',
    'LIKELY',
    'VERY_LIKELY',
  ];
  if (!value) return false;
  return order.indexOf(value) >= order.indexOf(min);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const apiKey =
    Deno.env.get('GOOGLE_VISION_API_KEY') ??
    Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) {
    return errorResponse(
      'Server misconfigured: GOOGLE_VISION_API_KEY missing',
      500,
    );
  }

  let body: { image_base64?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const base64 = (body.image_base64 ?? '').replace(/^data:image\/[a-z]+;base64,/i, '');
  if (!base64) return errorResponse('image_base64 required');
  // Begrenzung: Vision API akzeptiert ~10MB, wir limitieren auf 6MB Base64
  // (~4.5MB Bytes), damit der Edge-Function-Body nicht explodiert.
  if (base64.length > 6 * 1024 * 1024) {
    return errorResponse('Bild zu groß (max ~4MB)', 413);
  }

  try {
    const visionRes = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: 'FACE_DETECTION', maxResults: 5 },
              // LABEL_DETECTION fängt Cartoons, Avatare, Zeichnungen,
              // Memojis und ähnliche Spoof-Versuche ab. Plus: ein Foto
              // vom Bildschirm bekommt oft das Label „display device".
              { type: 'LABEL_DETECTION', maxResults: 10 },
            ],
          },
        ],
      }),
    });

    if (!visionRes.ok) {
      const text = await visionRes.text();
      console.error('[validate-face] Vision API error', visionRes.status, text);
      return errorResponse(
        `Vision API failed (${visionRes.status})`,
        502,
      );
    }

    const json = (await visionRes.json()) as VisionResponse;
    const first = json.responses?.[0];
    if (first?.error?.message) {
      console.error('[validate-face] Vision response error', first.error);
      return errorResponse(first.error.message, 502);
    }

    const faces = first?.faceAnnotations ?? [];
    const labels = first?.labelAnnotations ?? [];
    const faceCount = faces.length;

    // 1) Cartoon/Avatar/Zeichnung — IMMER ablehnen, egal ob ein „Gesicht"
    //    erkannt wurde. Ein gemalter Avatar hat oft auch Face-Annotations,
    //    aber niedrige landmarkingConfidence + verdächtige Labels.
    const fakeLabel = detectFakePhotoLabel(labels);
    if (fakeLabel) {
      return jsonResponse({
        ok: false,
        face_count: faceCount,
        reason:
          'Bitte ein echtes Foto von dir verwenden — kein Cartoon, Avatar, Memoji oder gezeichnetes Bild.',
      });
    }

    if (faceCount === 0) {
      return jsonResponse({
        ok: false,
        face_count: 0,
        reason:
          'Kein Gesicht erkannt. Halte dein Gesicht gut sichtbar in die Kamera.',
      });
    }

    if (faceCount > 1) {
      return jsonResponse({
        ok: false,
        face_count: faceCount,
        reason:
          'Mehrere Gesichter erkannt. Bitte nur dein eigenes Gesicht ins Bild.',
      });
    }

    const face = faces[0];
    const confidence = face.detectionConfidence ?? 0;
    const landmarkConf = face.landmarkingConfidence ?? 0;

    // 2) Niedrige Detection-Confidence → unklares Gesicht
    if (confidence < 0.75) {
      return jsonResponse({
        ok: false,
        face_count: 1,
        confidence,
        reason:
          'Gesicht nicht klar erkennbar. Bitte mit besserer Beleuchtung und direkt in die Kamera.',
      });
    }

    // 3) Niedrige Landmark-Confidence → Augen/Nase/Mund nicht sauber
    //    erkennbar. Klassischer Cartoon/Avatar-Indikator, falls Label-
    //    Detection das nicht schon abgefangen hat.
    if (landmarkConf > 0 && landmarkConf < 0.5) {
      return jsonResponse({
        ok: false,
        face_count: 1,
        confidence,
        reason:
          'Bitte ein echtes Foto von dir verwenden — Augen, Nase und Mund müssen klar erkennbar sein.',
      });
    }

    // 4) Gesicht zu klein im Bild → typisch bei „Foto vom Foto"
    //    (Bildschirm abfotografiert, Foto-vom-Ausweis etc.). Wir schätzen
    //    die Gesichtsgröße via boundingPoly relativ zum größten Crop-Hint.
    const faceArea = bboxArea(face.fdBoundingPoly ?? face.boundingPoly);
    if (faceArea > 0) {
      // Heuristik: bei einem 720×720-Selfie sollte das Gesicht mindestens
      // ~150×150 px ausfüllen (~22.500 px²). Bei Screenshot-Spoofs ist das
      // Gesicht oft deutlich kleiner, weil der Screen-Rahmen drumrum sitzt.
      if (faceArea < 22500) {
        return jsonResponse({
          ok: false,
          face_count: 1,
          confidence,
          reason:
            'Dein Gesicht ist zu klein im Bild. Bitte näher an die Kamera halten — kein Foto-vom-Bildschirm.',
        });
      }
    }

    if (likelihoodAtLeast(face.blurredLikelihood, 'LIKELY')) {
      return jsonResponse({
        ok: false,
        face_count: 1,
        confidence,
        reason: 'Bild ist zu unscharf. Bitte erneut aufnehmen.',
      });
    }

    if (likelihoodAtLeast(face.underExposedLikelihood, 'LIKELY')) {
      return jsonResponse({
        ok: false,
        face_count: 1,
        confidence,
        reason: 'Bild ist zu dunkel. Bitte mit mehr Licht erneut aufnehmen.',
      });
    }

    return jsonResponse({
      ok: true,
      face_count: 1,
      confidence,
      landmark_confidence: landmarkConf,
    });
  } catch (e) {
    console.error('[validate-face]', e);
    const msg = e instanceof Error ? e.message : 'unknown error';
    return errorResponse(msg, 502);
  }
});
