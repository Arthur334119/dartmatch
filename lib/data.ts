import { supabase, TABLES, BUCKETS } from './supabase';
import {
  Bar,
  GooglePlaceDetails,
  Post,
  PostRsvp,
  Review,
  RsvpStatus,
  UserProfile,
  barFromRow,
  postFromRow,
  profileFromRow,
  reviewFromRow,
  rsvpFromRow,
  isPostExpired,
} from './types';
import { ensureCurrentUserProfile, getCurrentUser } from './auth';
import { haversineKm } from './distance';

// ── BARS ──────────────────────────────────────────────────────────────

export async function getAllBars(): Promise<Bar[]> {
  const { data, error } = await supabase
    .from(TABLES.bars)
    .select('*')
    .order('name');
  if (error) return [];
  return (data ?? []).map(barFromRow);
}

export function attachDistances(
  bars: Bar[],
  userLat: number,
  userLng: number,
): Bar[] {
  return bars
    .map((b) => ({
      ...b,
      distanceKm: haversineKm(userLat, userLng, b.latitude, b.longitude),
    }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export async function getBar(barId: string): Promise<Bar | null> {
  const { data, error } = await supabase
    .from(TABLES.bars)
    .select('*')
    .eq('id', barId)
    .maybeSingle();
  if (error || !data) return null;
  return barFromRow(data);
}

/**
 * Lädt Fotos + Reviews einer Bar via Google Places (Edge Function).
 * Liefert null, wenn die Bar keine google_place_id hat oder die Function
 * fehlschlägt — Aufrufer fallen dann auf die statischen Daten zurück.
 */
export async function getGooglePlaceDetails(
  placeId: string,
  maxPhotos = 4,
): Promise<GooglePlaceDetails | null> {
  try {
    const { data, error } = await supabase.functions.invoke<GooglePlaceDetails>(
      'google-places',
      {
        body: { action: 'details', place_id: placeId, max_photos: maxPhotos },
      },
    );
    if (error) {
      console.warn('[google-places] details error', error);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.warn('[google-places] details exception', e);
    return null;
  }
}

// ── PROFILE ───────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return profileFromRow(data);
}

export async function updateProfile(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // Update statt Upsert: Aufrufer (z. B. uploadAvatar) müssen vorher
  // ensureCurrentUserProfile() aufrufen, sonst würde ein Upsert ohne
  // username am NOT-NULL-Constraint scheitern.
  const { error } = await supabase
    .from(TABLES.profiles)
    .update(patch)
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Prüft via Edge Function (Google Cloud Vision), ob auf dem Bild genau
 * ein Gesicht erkennbar ist. Wirft mit klarer Nachricht, wenn nicht.
 *
 * `base64` ist die rohe Base64-Repräsentation des Bildes (ohne data:-Prefix).
 * Aus expo-image-picker bekommt man sie via `{ base64: true }`.
 */
export async function validateFace(base64: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    face_count: number;
    confidence?: number;
    reason?: string;
  }>('validate-face', {
    body: { image_base64: base64 },
  });
  if (error) {
    // FunctionsHttpError lässt sich oft nur über response.text() auslesen
    // — wir geben eine generische Meldung, der Server-Log hat Details.
    console.warn('[validate-face] invoke error', error);
    throw new Error(
      'Gesichtserkennung nicht erreichbar. Bitte erneut versuchen.',
    );
  }
  if (!data) {
    throw new Error('Gesichtserkennung lieferte keine Antwort.');
  }
  if (!data.ok) {
    throw new Error(data.reason ?? 'Kein Gesicht erkannt.');
  }
}

/**
 * Lädt ein Profilbild zu Supabase Storage hoch und setzt avatar_url im Profil.
 * Pfad: avatars/{userId}/avatar_{timestamp}.{ext}
 *
 * Erwartet eine lokale URI (file:// auf iOS, content:// auf Android), die
 * über fetch() in einen ArrayBuffer geladen wird.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');

  // Profil muss existieren, bevor `avatar_url` gesetzt wird – sonst
  // versucht der upsert einen INSERT ohne username (NOT NULL).
  await ensureCurrentUserProfile();

  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
  const path = `${user.id}/avatar_${Date.now()}.${ext}`;

  const res = await fetch(localUri);
  const blob = await res.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.avatars)
    .upload(path, blob, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKETS.avatars).getPublicUrl(path);

  await updateProfile(user.id, { avatar_url: publicUrl });
  return publicUrl;
}

// ── REVIEWS ───────────────────────────────────────────────────────────

export async function getBarReviews(barId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from(TABLES.reviews)
    .select('*, profiles(username, avatar_url)')
    .eq('bar_id', barId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(reviewFromRow);
}

export async function addReview(input: {
  barId: string;
  rating: number;
  content: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');

  const { error } = await supabase.from(TABLES.reviews).insert({
    user_id: user.id,
    bar_id: input.barId,
    rating: input.rating,
    content: input.content,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  // bars.rating + review_count werden via Postgres-Trigger
  // (recalc_bar_rating) automatisch aktualisiert.
}

// ── POSTS ─────────────────────────────────────────────────────────────

export async function getPosts(filter?: {
  type?: string;
  barId?: string;
}): Promise<Post[]> {
  const { data, error } = await supabase
    .from(TABLES.posts)
    .select('*, profiles(username, avatar_url), bars(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  let posts = (data ?? []).map(postFromRow);
  if (filter?.type) posts = posts.filter((p) => p.type === filter.type);
  if (filter?.barId) posts = posts.filter((p) => p.barId === filter.barId);
  return posts.filter((p) => !isPostExpired(p));
}

export async function createPost(input: {
  type: string;
  gameType: string | null;
  barId: string | null;
  content: string;
  playerCount: number | null;
  durationHours: number | null;
  eventAt?: string | null;
  maxAttendees?: number | null;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');

  const expiresAt = input.durationHours
    ? new Date(Date.now() + input.durationHours * 3600_000).toISOString()
    : null;

  const { error } = await supabase.from(TABLES.posts).insert({
    user_id: user.id,
    bar_id: input.barId,
    type: input.type,
    game_type: input.gameType,
    content: input.content,
    player_count: input.playerCount,
    expires_at: expiresAt,
    event_at: input.eventAt ?? null,
    max_attendees: input.maxAttendees ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  await supabase.from(TABLES.posts).delete().eq('id', postId);
}

// ── EVENT RSVPs ───────────────────────────────────────────────────────

export async function getPostRsvps(postId: string): Promise<PostRsvp[]> {
  const { data, error } = await supabase
    .from('post_rsvps')
    .select('*, profiles(username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(rsvpFromRow);
}

export async function getMyRsvp(postId: string): Promise<RsvpStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('post_rsvps')
    .select('status')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();
  return (data as { status?: RsvpStatus } | null)?.status ?? null;
}

export async function setRsvp(
  postId: string,
  status: RsvpStatus,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');
  const { error } = await supabase
    .from('post_rsvps')
    .upsert(
      {
        post_id: postId,
        user_id: user.id,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'post_id,user_id' },
    );
  if (error) throw error;
}

export async function clearRsvp(postId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from('post_rsvps')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', user.id);
}

/**
 * Liefert eine Map { postId → { going, maybe, cant } } für eine Liste von
 * Posts. Genutzt vom Feed, um die RSVP-Counts in einem Round-Trip zu holen.
 */
export async function getRsvpCounts(
  postIds: string[],
): Promise<Record<string, { going: number; maybe: number; cant: number }>> {
  if (postIds.length === 0) return {};
  const { data } = await supabase
    .from('post_rsvps')
    .select('post_id, status')
    .in('post_id', postIds);

  const out: Record<string, { going: number; maybe: number; cant: number }> = {};
  for (const id of postIds) out[id] = { going: 0, maybe: 0, cant: 0 };
  for (const row of data ?? []) {
    const r = row as { post_id: string; status: RsvpStatus };
    if (out[r.post_id]) out[r.post_id][r.status] += 1;
  }
  return out;
}

// ── PRESENCE ──────────────────────────────────────────────────────────

export async function checkIn(barId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');

  const now = new Date();
  const expires = new Date(now.getTime() + 4 * 3600_000);

  const { error } = await supabase.from(TABLES.presence).upsert({
    user_id: user.id,
    bar_id: barId,
    checked_in_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
  if (error) throw error;
}

export async function checkOut(barId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from(TABLES.presence)
    .delete()
    .eq('user_id', user.id)
    .eq('bar_id', barId);
}

export async function isCheckedIn(barId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const now = new Date().toISOString();
  const { data } = await supabase
    .from(TABLES.presence)
    .select('user_id')
    .eq('user_id', user.id)
    .eq('bar_id', barId)
    .gt('expires_at', now)
    .maybeSingle();
  return !!data;
}

export async function getPresenceCount(barId: string): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLES.presence)
    .select('user_id')
    .eq('bar_id', barId)
    .gt('expires_at', now);
  if (error) return 0;
  return data?.length ?? 0;
}
