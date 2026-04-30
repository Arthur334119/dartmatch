export type Bar = {
  id: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  beerPrice: number | null;
  capacity: number | null;
  games: string[];
  features: string[];
  openingHours: Record<string, string>;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  osmId: string | null;
  googlePlaceId: string | null;
  distanceKm?: number;
};

export type GooglePlacePhoto = {
  url: string;
  attribution: string | null;
};

export type GooglePlaceReview = {
  id: string;
  rating: number;
  text: string;
  publishedAt: string | null;
  relativeTime: string | null;
  authorName: string;
  authorPhotoUrl: string | null;
};

export type GooglePlaceDetails = {
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  photos: GooglePlacePhoto[];
  reviews: GooglePlaceReview[];
};

export type UserProfile = {
  id: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  favoriteGames: string[];
  location: string | null;
  phone: string | null;
  createdAt: string;
};

export type Review = {
  id: string;
  userId: string;
  barId: string;
  rating: number;
  content: string;
  createdAt: string;
  username: string | null;
  avatarUrl: string | null;
};

export type Post = {
  id: string;
  userId: string;
  barId: string | null;
  type: 'playing' | 'looking' | string;
  gameType: string | null;
  content: string;
  playerCount: number | null;
  expiresAt: string | null;
  createdAt: string;
  username: string | null;
  avatarUrl: string | null;
  barName: string | null;
};

function parseStringArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const decoded = JSON.parse(raw);
      if (Array.isArray(decoded)) return decoded.map(String);
    } catch {}
  }
  return [];
}

function parseHours(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[String(k)] = String(v);
    }
    return out;
  }
  if (typeof raw === 'string') {
    try {
      const decoded = JSON.parse(raw);
      if (decoded && typeof decoded === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(decoded)) out[String(k)] = String(v);
        return out;
      }
    } catch {}
  }
  return {};
}

export function barFromRow(row: Record<string, any>): Bar {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    address: String(row.address ?? ''),
    latitude: Number(row.latitude ?? 52.52),
    longitude: Number(row.longitude ?? 13.405),
    phone: row.phone != null ? String(row.phone) : null,
    website: row.website != null ? String(row.website) : null,
    beerPrice: row.beer_price != null ? Number(row.beer_price) : null,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    games: parseStringArray(row.games),
    features: parseStringArray(row.features),
    openingHours: parseHours(row.opening_hours),
    imageUrl: row.image_url ?? null,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    osmId: row.osm_id != null ? String(row.osm_id) : null,
    googlePlaceId: row.google_place_id != null ? String(row.google_place_id) : null,
  };
}

export function profileFromRow(row: Record<string, any>): UserProfile {
  return {
    id: String(row.id ?? ''),
    username: String(row.username ?? 'Anonym'),
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    favoriteGames: parseStringArray(row.favorite_games),
    location: row.location ?? null,
    phone: row.phone ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function reviewFromRow(row: Record<string, any>): Review {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    barId: String(row.bar_id ?? ''),
    rating: Number(row.rating ?? 0),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    username: row.profiles?.username ?? row.username ?? null,
    avatarUrl: row.profiles?.avatar_url ?? row.avatar_url ?? null,
  };
}

export function postFromRow(row: Record<string, any>): Post {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    barId: row.bar_id != null ? String(row.bar_id) : null,
    type: String(row.type ?? 'looking'),
    gameType: row.game_type ?? null,
    content: String(row.content ?? ''),
    playerCount: row.player_count != null ? Number(row.player_count) : null,
    expiresAt: row.expires_at ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    username: row.profiles?.username ?? row.username ?? null,
    avatarUrl: row.profiles?.avatar_url ?? row.avatar_url ?? null,
    barName: row.bars?.name ?? row.bar_name ?? null,
  };
}

export function isPostExpired(post: Post): boolean {
  if (!post.expiresAt) return false;
  return new Date(post.expiresAt).getTime() < Date.now();
}
