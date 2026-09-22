// Thin wrapper around Google Maps JS APIs used by the live tracking page.
// Loads the script once, exposes geocoding + directions helpers with
// localStorage caches so we don't burn quota on every render tick.

const SCRIPT_ID = "google-maps-script";
const GEOCODE_CACHE_KEY = "seven.geocode-cache.v1";
const DIRECTIONS_CACHE_KEY = "seven.directions-cache.v1";

export type LatLng = { lat: number; lng: number };

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loadPromise;
}

// ---- Geocoding ----------------------------------------------------------

type GeocodeCache = Record<string, LatLng | null>;

function readGeocodeCache(): GeocodeCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache: GeocodeCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private mode — fall back to in-session memory.
  }
}

// Returns coords for a free-form address. Cached by `key`, so callers should
// pass a stable id (e.g. venueId). Resolves to null on failure so the caller
// can skip the row.
export async function geocodeAddress(
  key: string,
  query: string,
): Promise<LatLng | null> {
  if (!query.trim()) return null;
  const cache = readGeocodeCache();
  if (key in cache) return cache[key];

  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.Geocoder) return null;

  const geocoder = new google.maps.Geocoder();
  const result: LatLng | null = await new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results: any, status: string) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        resolve(null);
      }
    });
  });

  cache[key] = result;
  writeGeocodeCache(cache);
  return result;
}

// ---- Directions ---------------------------------------------------------

type DirectionsCacheEntry = {
  path: LatLng[];
  distanceMeters: number;
  durationSec: number;
  computedAt: number;
};
type DirectionsCache = Record<string, DirectionsCacheEntry>;

function readDirectionsCache(): DirectionsCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DIRECTIONS_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDirectionsCache(cache: DirectionsCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIRECTIONS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

// Distance between two points in meters using the haversine formula. Used to
// decide whether a cached route is still useful or we should recompute.
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---- Trails -------------------------------------------------------------

// One GPS breadcrumb. `ts` is the server clock (epoch ms) — never the device
// clock, which can be skewed (a field test had a phone 32 min behind) and
// would fake impossible speeds.
export type TrailPoint = LatLng & { ts: number };

// A sequence of fixes is only a real path while the fixes are consecutive.
// When one lands somewhere the car could not have reached, or the phone goes
// quiet long enough that it could have gone anywhere, we don't know the road
// taken in between: joining them draws (and measures) a trip that never
// happened — a straight line across Santiago, from a stale fix in San
// Bernardo to the first live one downtown.
//
// Below this, never cut: parked or barely moved, and a short straight line at
// worst cuts a corner. Keeps a car waiting at a light from fragmenting.
export const TRAIL_GAP_MIN_METERS = 300;
// Above this the jump is physically impossible: a bad fix, or the same driver
// open on two phones. Matches VehiclePositionsService.MAX_SPEED_KMH on the
// server — one definition of "impossible" for the whole system.
export const TRAIL_MAX_SPEED_KMH = 200;
// A silence this long can hide any route, so we stop guessing.
export const TRAIL_MAX_GAP_MS = 5 * 60 * 1000;

// True when two consecutive fixes cannot be joined by a straight line.
export function isTrailBreak(prev: TrailPoint, cur: TrailPoint): boolean {
  const meters = haversineMeters(prev, cur);
  if (meters <= TRAIL_GAP_MIN_METERS) return false;
  const dtMs = cur.ts - prev.ts;
  // Out-of-order or same-instant fixes: no usable speed, so distance decides.
  const speedKmh = dtMs > 0 ? (meters / (dtMs / 1000)) * 3.6 : Infinity;
  return dtMs > TRAIL_MAX_GAP_MS || speedKmh > TRAIL_MAX_SPEED_KMH;
}

// Splits raw breadcrumbs into the segments we can actually vouch for.
// Single-point segments are kept; callers drop them when they need a line.
export function splitTrail<T extends TrailPoint>(points: T[]): T[][] {
  if (points.length === 0) return [];
  const segments: T[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    if (isTrailBreak(points[i - 1], points[i])) segments.push([points[i]]);
    else segments[segments.length - 1].push(points[i]);
  }
  return segments;
}

// Distance actually travelled, in km. Only hops within a segment count, so a
// teleport adds nothing instead of adding its own length.
export function trailKm(points: TrailPoint[]): number {
  let meters = 0;
  for (const segment of splitTrail(points)) {
    for (let i = 1; i < segment.length; i++) {
      meters += haversineMeters(segment[i - 1], segment[i]);
    }
  }
  return meters / 1000;
}

// Stable id for a segment, used to key its snapped version. Anchored on the
// first fix's timestamp so it survives points being appended; if the head is
// trimmed the id changes and the segment simply re-snaps.
export function segmentKey(ownerId: string, segment: TrailPoint[]): string {
  return `${ownerId}@${segment[0]?.ts ?? 0}`;
}

// ---- Snap to Roads ------------------------------------------------------

// Snaps a sequence of GPS fixes onto the nearest road network. Used to
// clean up live tracking trails — raw GPS in cities has ±20-50m of jitter
// so the marker path "jumps between houses". This rewrites the path onto
// the actual streets the driver is following.
//
// `interpolate=true` asks Google to also fill in road segments between
// successive points, which gives a continuous line even when the GPS
// fixes are spaced several seconds apart.
//
// Roads API limit: max 100 points per request. We never send more.
// Cost: ~$10 per 1000 requests; caller should debounce.
export async function snapToRoads(points: LatLng[]): Promise<LatLng[] | null> {
  if (points.length === 0) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const trimmed = points.slice(-100);
  const path = trimmed.map((p) => `${p.lat},${p.lng}`).join("|");
  const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      snappedPoints?: Array<{ location: { latitude: number; longitude: number } }>;
    };
    if (!data.snappedPoints || data.snappedPoints.length === 0) return null;
    return data.snappedPoints.map((p) => ({
      lat: p.location.latitude,
      lng: p.location.longitude,
    }));
  } catch {
    return null;
  }
}

// ---- Directions ---------------------------------------------------------

// Returns route from origin to destination. Cached by `key` (e.g. tripId).
// If `origin` has drifted more than ~250m from the cached origin we drop the
// cache so the polyline keeps tracking the driver as they move.
export async function getDirections(
  key: string,
  origin: LatLng,
  destination: LatLng,
): Promise<DirectionsCacheEntry | null> {
  const cache = readDirectionsCache();
  const cached = cache[key];
  if (cached && cached.path.length > 0) {
    const cachedOrigin = cached.path[0];
    if (cachedOrigin && haversineMeters(cachedOrigin, origin) < 250) {
      return cached;
    }
  }

  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.DirectionsService) return null;

  const service = new google.maps.DirectionsService();
  const result: DirectionsCacheEntry | null = await new Promise((resolve) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response: any, status: string) => {
        if (status !== "OK" || !response?.routes?.[0]?.legs?.[0]) {
          resolve(null);
          return;
        }
        const route = response.routes[0];
        const path: LatLng[] = (route.overview_path || []).map((p: any) => ({
          lat: p.lat(),
          lng: p.lng(),
        }));
        const leg = route.legs[0];
        resolve({
          path,
          distanceMeters: leg.distance?.value ?? 0,
          durationSec: leg.duration?.value ?? 0,
          computedAt: Date.now(),
        });
      },
    );
  });

  if (result) {
    cache[key] = result;
    writeDirectionsCache(cache);
  }
  return result;
}
