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
