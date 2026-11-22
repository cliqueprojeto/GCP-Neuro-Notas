/** Mapas livres: busca de endereços (Nominatim/OpenStreetMap) e rotas (OSRM do projeto OpenStreetMap). */
import type { GeoPoint } from './types';

const cache = new Map<string, GeoPoint[]>();
let last = 0;
const wait = async () => {
  // política do Nominatim: no máximo 1 pedido por segundo
  const d = Date.now() - last;
  if (d < 1100) await new Promise((r) => setTimeout(r, 1100 - d));
  last = Date.now();
};

export async function geocode(q: string, lang = 'pt'): Promise<GeoPoint[]> {
  const key = lang + '|' + q.trim().toLowerCase();
  if (!q.trim()) return [];
  if (cache.has(key)) return cache.get(key)!;
  // coordenadas digitadas ("-19.92, -43.94") não precisam de busca
  const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) return [{ label: q.trim(), lat: +m[1], lon: +m[2] }];
  await wait();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const out = data.map((d) => ({ label: d.display_name, lat: +d.lat, lon: +d.lon }));
  cache.set(key, out);
  return out;
}

export type RouteProfile = 'car' | 'bike' | 'foot';
export interface RouteResult { coords: [number, number][]; distance: number; duration: number }

export async function route(a: GeoPoint, b: GeoPoint, profile: RouteProfile = 'car'): Promise<RouteResult> {
  const base = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving`;
  const url = `${base}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (!r) throw new Error('sem rota');
  return { coords: r.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]), distance: r.distance, duration: r.duration };
}

export const fmtDistance = (m: number, locale?: string) => (m >= 1000 ? `${(m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);
export const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};
export const osmLink = (a: GeoPoint, b?: GeoPoint, profile: RouteProfile = 'car') =>
  b
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_${profile}&route=${a.lat}%2C${a.lon}%3B${b.lat}%2C${b.lon}`
    : `https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}#map=16/${a.lat}/${a.lon}`;
