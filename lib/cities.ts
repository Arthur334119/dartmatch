import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export type City = {
  id: string;
  name: string;
  country: string;
  centerLat: number;
  centerLng: number;
  zoomDelta: number;
};

const FALLBACK_CITIES: City[] = [
  { id: 'berlin', name: 'Berlin', country: 'DE', centerLat: 52.52, centerLng: 13.405, zoomDelta: 0.05 },
  { id: 'hamburg', name: 'Hamburg', country: 'DE', centerLat: 53.5511, centerLng: 9.9937, zoomDelta: 0.05 },
  { id: 'muenchen', name: 'München', country: 'DE', centerLat: 48.1351, centerLng: 11.582, zoomDelta: 0.05 },
  { id: 'koeln', name: 'Köln', country: 'DE', centerLat: 50.9375, centerLng: 6.9603, zoomDelta: 0.05 },
];

export const DEFAULT_CITY_ID = 'berlin';

function rowToCity(row: Record<string, any>): City {
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country ?? 'DE'),
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    zoomDelta: Number(row.zoom_delta ?? 0.05),
  };
}

let cachedCities: City[] | null = null;

export async function getCities(): Promise<City[]> {
  if (cachedCities) return cachedCities;
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('name');
  if (error || !data) {
    return FALLBACK_CITIES;
  }
  cachedCities = data.map(rowToCity);
  return cachedCities;
}

export async function getCityById(id: string | null | undefined): Promise<City | null> {
  if (!id) return null;
  const cities = await getCities();
  return cities.find((c) => c.id === id) ?? null;
}

/**
 * Liefert die Stadt des aktuellen Users; wenn nicht gesetzt, Berlin als
 * Default. Wird vom Map-Screen genutzt, um die Karte initial zu zentrieren,
 * solange noch keine Geolocation-Permission da ist.
 */
export async function getMyCity(): Promise<City> {
  const user = await getCurrentUser();
  if (!user) {
    return (await getCityById(DEFAULT_CITY_ID)) ?? FALLBACK_CITIES[0];
  }
  const { data } = await supabase
    .from('profiles')
    .select('city_id')
    .eq('id', user.id)
    .maybeSingle();
  const cityId = (data as { city_id?: string | null } | null)?.city_id ?? DEFAULT_CITY_ID;
  const city = await getCityById(cityId);
  return city ?? (await getCityById(DEFAULT_CITY_ID)) ?? FALLBACK_CITIES[0];
}

export async function setMyCity(cityId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Nicht angemeldet');
  const { error } = await supabase
    .from('profiles')
    .update({ city_id: cityId })
    .eq('id', user.id);
  if (error) throw error;
}

/**
 * Findet die nächstgelegene Stadt zu Lat/Lng — z. B. nach Geolocation, um
 * dem User automatisch die richtige Stadt vorzuschlagen. Liefert null,
 * wenn keine Stadt im Umkreis von 80 km liegt (User wahrscheinlich in
 * einer noch nicht unterstützten Stadt).
 */
export async function findNearestCity(
  lat: number,
  lng: number,
): Promise<City | null> {
  const cities = await getCities();
  let best: { city: City; dist: number } | null = null;
  for (const c of cities) {
    const d = haversine(lat, lng, c.centerLat, c.centerLng);
    if (!best || d < best.dist) best = { city: c, dist: d };
  }
  if (!best || best.dist > 80) return null;
  return best.city;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
