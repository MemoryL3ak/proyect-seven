"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { VENTANA_CONECTADO_MS, VENTANA_SIN_SENAL_MS, useRelojServidor } from "@/lib/presencia";
import {
  RefreshIcon,
  ArrowRightIcon,
  StarIcon,
  TruckIcon,
  ClockIcon,
  CalendarIcon,
  CheckIcon,
  PinIcon,
  CheckCircleIcon,
  XIcon,
  SearchIcon,
  ChevronRightIcon,
  MaximizeIcon,
  ArrowLeftIcon,
} from "@/components/ui/Icons";
import StyledSelect from "@/components/StyledSelect";
import { filterValidatedAthletes } from "@/lib/athletes";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { BRAND, TRIP_STATUS_META, STATE, SURFACE, ACCENT } from "@/lib/design";
import { useIsMobile } from "@/lib/useIsMobile";
import type {
  DestinationPin,
  RoutePath,
  TrackingMarker,
  TrailPath,
} from "@/components/LiveTrackingMap";
import {
  geocodeAddress,
  getDirections,
  segmentKey,
  snapToRoads,
  splitTrail,
  trailKm,
  type LatLng,
  type TrailPoint,
} from "@/lib/google-maps";

const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), { ssr: false });
const TripRouteMap = dynamic(() => import("@/components/TripRouteMap"), { ssr: false });

type Trip = {
  id: string;
  eventId?: string | null;
  driverId: string;
  vehicleId: string;
  vehiclePlate?: string | null;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  // Los cuatro lugares del viaje. Vienen vacíos en la mayoría de los viajes
  // cargados: ahí el lugar está sólo como texto en origin/destination, y por
  // eso los filtros de sede y hotel miran también el nombre.
  originVenueId?: string | null;
  originHotelId?: string | null;
  destinationVenueId?: string | null;
  destinationHotelId?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  passengerCount?: number | null;
  athleteIds?: string[];
  athleteNames?: string[];
  tripCost?: number | null;
  driverRating?: number | null;
  ratingComment?: string | null;
  notes?: string | null;
};

type EventItem = { id: string; name?: string | null };

type DriverItem = { id: string; userId?: string | null; fullName?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type AthleteItem = { id: string; fullName?: string | null; delegationId?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

type VenueItem = { id: string; name?: string | null; address?: string | null; commune?: string | null };

type HotelItem = { id: string; name?: string | null };

/**
 * Ancho de los desplegables de filtro. StyledSelect ocupa el 100% de su
 * envoltorio, así que el ancho se fija acá y no en el disparador; el nombre
 * largo de un hotel se corta con puntos suspensivos en vez de estirar la fila.
 */
const anchoFiltro = (ancho: number): React.CSSProperties => ({ width: ancho, flexShrink: 0 });

/**
 * Nombre de lugar en forma comparable: sin mayúsculas, sin acentos y sin
 * puntuación. "Hotel LRH § Convention Center" y "hotel lrh convention center"
 * quedan iguales.
 */
const claveLugar = (texto: unknown) =>
  String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Opciones de un selector: las claves que aparecen en algún viaje, con cuántos
 * viajes tiene cada una, ordenadas por nombre.
 */
const opcionesDeFiltro = (
  trips: Trip[],
  clavesDelViaje: (trip: Trip) => Iterable<string>,
  etiquetar: (clave: string) => string,
) => {
  const cuenta = new Map<string, number>();
  trips.forEach((trip) => {
    for (const clave of clavesDelViaje(trip)) {
      if (clave) cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
  });
  return Array.from(cuenta.entries())
    .map(([id, count]) => ({ id, label: etiquetar(id), count }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
};

/**
 * El mismo conductor entra a los viajes a veces con su id de chofer y a veces
 * con su id de usuario —el mapa de conductores está indexado por los dos—, y
 * sin reducirlo saldría repetido en el selector.
 */
const claveConductor = (drivers: Record<string, DriverItem>, driverId?: string | null) =>
  driverId ? drivers[driverId]?.id || driverId : "";

// Acentos de estado derivados del catálogo canónico (TRIP_STATUS_META en
// lib/design): accent = color y chipBg = bg. `chipBorder` es una extensión
// local de esta pantalla (el catálogo canónico no define borde).
const statusColors = (status: string, chipBorder: string) => {
  const m = TRIP_STATUS_META[status];
  return { accent: m.color, chipBg: m.bg, chipBorder };
};
const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string }> = {
  REQUESTED:   statusColors("REQUESTED",   "rgba(146,64,14,0.3)"),
  SCHEDULED:   statusColors("SCHEDULED",   "rgba(33,208,179,0.3)"),
  EN_ROUTE:    statusColors("EN_ROUTE",    "rgba(59,130,246,0.3)"),
  PICKED_UP:   statusColors("PICKED_UP",   "rgba(139,92,246,0.3)"),
  DROPPED_OFF: statusColors("DROPPED_OFF", "rgba(100,116,139,0.25)"),
  COMPLETED:   statusColors("COMPLETED",   "rgba(100,116,139,0.25)"),
  CANCELLED:   statusColors("CANCELLED",   "rgba(239,68,68,0.28)"),
};

// Labels de estado: base canónica (lib/design) + fraseo operativo propio del
// tracking (EN_ROUTE y DROPPED_OFF conservan las frases de esta pantalla).
const STATUS_LABEL: Record<string, string> = {
  REQUESTED: TRIP_STATUS_META.REQUESTED.label,
  SCHEDULED: TRIP_STATUS_META.SCHEDULED.label,
  EN_ROUTE: "En ruta al punto de encuentro",
  PICKED_UP: TRIP_STATUS_META.PICKED_UP.label,
  DROPPED_OFF: TRIP_STATUS_META.DROPPED_OFF.label,
  COMPLETED: TRIP_STATUS_META.COMPLETED.label,
  CANCELLED: TRIP_STATUS_META.CANCELLED.label,
};

type PositionItem = {
  id: string;
  vehicleId?: string;
  driverId?: string;
  timestamp: string;
  // Server-side wall-clock time when the row was persisted. We prefer this
  // over `timestamp` for online/offline decisions because device clocks can
  // be skewed (Venezuela field test had a phone 32 min behind server time).
  createdAt?: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
};

type StoredPosition = {
  lat: number;
  lng: number;
  // Device clock — shown to the user as "GPS hh:mm".
  timestamp: string;
  // Server clock — drives the green/red online state.
  receivedAt: string;
};

const countryLabels: Record<string, string> = {
  ARG: "Argentina",
  BOL: "Bolivia",
  BRA: "Brasil",
  CHL: "Chile",
  COL: "Colombia",
  ECU: "Ecuador",
  PRY: "Paraguay",
  PER: "Perú",
  URY: "Uruguay",
  VEN: "Venezuela",
  MEX: "México",
  USA: "Estados Unidos",
  CAN: "Canadá",
  ESP: "España",
  FRA: "Francia",
  DEU: "Alemania",
  ITA: "Italia",
  PRT: "Portugal",
  GBR: "Reino Unido"
};

const tripTypeLabels: Record<string, string> = {
  TRANSFER_IN_OUT: "Transfer In Out",
  DISPOSICION_12H: "Disposición 12 horas",
  IDA_VUELTA: "Viaje Ida-Vuelta",
  COMEDOR: "Comedor"
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "-";

const formatTripType = (value?: string | null) => {
  if (!value) return "-";
  return tripTypeLabels[value] ?? value;
};

export default function VehiclePositionsPage() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [hotels, setHotels] = useState<Record<string, HotelItem>>({});
  const [positions, setPositions] = useState<Record<string, StoredPosition>>({});
  // Per-driver breadcrumb trail of where they've actually been since the
  // admin opened the page. Capped per driver so a long session doesn't
  // bloat memory; drivers that drop off the map get their trail cleared
  // alongside their position entry.
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  // Same path but rewritten by Google's Roads API so the line follows
  // streets instead of jumping between houses from GPS jitter. Keyed by
  // segment (see `segmentKey`), not by driver, so a trail that got cut
  // snaps each of its pieces on its own. Falls back to the raw points
  // when the snap call fails or the key isn't set.
  const [snappedTrails, setSnappedTrails] = useState<Record<string, LatLng[]>>({});
  const TRAIL_LIMIT = 200;
  // Minimum movement (in degrees, ~3m at the equator) to append a new
  // point to the trail. Filters out GPS jitter while parked so the line
  // doesn't look like a static blob.
  const TRAIL_MIN_DELTA = 0.00003;
  // Drives recomputation of the recency window (`connectedDrivers`, "Con GPS")
  // even when no fresh positions arrive — otherwise a driver that stops
  // pushing would stay on the live tab forever.
  // "Ahora" en el reloj del servidor, que es el mismo reloj de `receivedAt`.
  const ahoraServidor = useRelojServidor();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [completedAlerts, setCompletedAlerts] = useState<Array<{ tripId: string; driverName: string; destination: string; ts: Date }>>([]);
  const [activeView, setActiveView] = useState<"live" | "table">("live");
  const [destinationCoords, setDestinationCoords] = useState<Record<string, LatLng>>({});
  const [tripRoutes, setTripRoutes] = useState<Record<string, LatLng[]>>({});
  const [tripRouteMeta, setTripRouteMeta] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [detailPositions, setDetailPositions] = useState<TrailPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [routeExpanded, setRouteExpanded] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatus, setTableStatus] = useState("");
  const [tableClient, setTableClient] = useState("");
  const [tableDriver, setTableDriver] = useState("");
  const [tableVenue, setTableVenue] = useState("");
  const [tableHotel, setTableHotel] = useState("");
  const [loading, setLoading] = useState(false);
  // Only the very first load should blank the KPIs to "—". Subsequent
  // refreshes keep the previous values on screen to avoid flicker.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const knownActiveIdsRef = useRef<Set<string>>(new Set());
  const [mapPreview, setMapPreview] = useState<{
    lat: number;
    lng: number;
    title: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData, positionData, venueData, hotelData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<PositionItem[]>("/vehicle-positions"),
          apiFetch<VenueItem[]>("/venues"),
          apiFetch<HotelItem[]>("/accommodations"),
        ]);

      const nextTrips = tripData || [];

      // Track active → completed for alerts
      const nextActiveIds = new Set(
        nextTrips.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")).map((t) => t.id)
      );
      if (knownActiveIdsRef.current.size > 0) {
        const driverArr = driverData || [];
        const venueArr = venueData || [];
        const newlyCompleted = nextTrips.filter(
          (t) =>
            knownActiveIdsRef.current.has(t.id) &&
            !nextActiveIds.has(t.id) &&
            ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? "")
        );
        if (newlyCompleted.length > 0) {
          const newAlerts = newlyCompleted.map((t) => {
            const driver = driverArr.find((d) => d.id === t.driverId);
            const venue = venueArr.find((v) => v.id === (t as any).destinationVenueId);
            return {
              tripId: t.id,
              driverName: driver?.fullName || "Conductor",
              destination: venue?.name || (t as any).destination || "Destino",
              ts: new Date(),
            };
          });
          setCompletedAlerts((prev) => [...newAlerts, ...prev].slice(0, 8));
        }
      }
      knownActiveIdsRef.current = nextActiveIds;

      setVenues(
        (venueData || []).reduce<Record<string, VenueItem>>((acc, v) => { acc[v.id] = v; return acc; }, {})
      );

      setHotels(
        (hotelData || []).reduce<Record<string, HotelItem>>((acc, h) => { acc[h.id] = h; return acc; }, {})
      );

      setTrips(nextTrips);

      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
          return acc;
        }, {})
      );

      const driverMap = (driverData || []).reduce<Record<string, DriverItem>>((acc, driver) => {
        if (driver.userId) acc[driver.userId] = driver;
        acc[driver.id] = driver;
        return acc;
      }, {});
      // /drivers ya incluye a los choferes de proveedor.
      setDrivers(driverMap);

      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, vehicle) => {
          acc[vehicle.id] = vehicle;
          return acc;
        }, {})
      );

      setAthletes(
        (filterValidatedAthletes(athleteData || [])).reduce<Record<string, AthleteItem>>((acc, athlete) => {
          acc[athlete.id] = athlete;
          return acc;
        }, {})
      );

      setDelegations(
        (delegationData || []).reduce<Record<string, DelegationItem>>((acc, delegation) => {
          acc[delegation.id] = delegation;
          return acc;
        }, {})
      );

      const latestByDriver: Record<string, StoredPosition> = {};
      (positionData || []).forEach((pos) => {
        const key = pos.driverId || pos.vehicleId;
        if (!key) return;
        const coordinates = (pos.location as any)?.coordinates;
        const lat = coordinates ? coordinates[1] : (pos.location as any)?.lat;
        const lng = coordinates ? coordinates[0] : (pos.location as any)?.lng;
        if (lat === undefined || lng === undefined) return;
        const receivedAt = pos.createdAt || pos.timestamp;
        const current = latestByDriver[key];
        if (!current || new Date(receivedAt) > new Date(current.receivedAt)) {
          latestByDriver[key] = { lat, lng, timestamp: pos.timestamp, receivedAt };
        }
      });
      // Merge: realtime can deliver a fresh row in the gap between request
      // start and request end — replacing the whole map would lose it. Keep
      // any in-memory entry that is newer than what /vehicle-positions
      // returned for that driver. We compare server `receivedAt`, not device
      // `timestamp` — a phone with a skewed clock could otherwise overwrite
      // a fresh fix with an "older-looking" one that's actually newer.
      setPositions((prev) => {
        const next: typeof prev = { ...latestByDriver };
        for (const [key, fresh] of Object.entries(prev)) {
          const incoming = next[key];
          if (!incoming || new Date(fresh.receivedAt) > new Date(incoming.receivedAt)) {
            next[key] = fresh;
          }
        }
        return next;
      });

      setLastUpdated(new Date());
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime subscription — pushes every new GPS row instantly,
    // no polling of /vehicle-positions needed.
    const supabase = getSupabase();
    const channel = supabase
      .channel("vehicle-positions-admin")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "telemetry",
          table: "vehicle_positions",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            driver_id: string;
            vehicle_id: string | null;
            timestamp: string;
            created_at: string;
            // PostGIS columns arrive as WKB hex over realtime — we can't
            // decode them client-side. We extract coordinates from the JSON
            // representation if Supabase sends one, otherwise we wait for
            // the next polling cycle (which uses ST_AsGeoJSON server-side).
            location?: unknown;
            lat?: number | null;
            lng?: number | null;
          };
          // Accept either the dedicated lat/lng columns (older schema) or
          // a GeoJSON location payload (newer paths).
          let lat: number | null = row.lat ?? null;
          let lng: number | null = row.lng ?? null;
          if ((lat == null || lng == null) && row.location && typeof row.location === 'object') {
            const coords = (row.location as { coordinates?: [number, number] }).coordinates;
            if (coords && Array.isArray(coords)) {
              lng = coords[0];
              lat = coords[1];
            }
          }
          if (lat == null || lng == null) return;
          const key = row.driver_id || row.vehicle_id;
          if (!key) return;
          const receivedAt = row.created_at || row.timestamp;
          setPositions((prev) => {
            const current = prev[key];
            if (current && new Date(receivedAt) <= new Date(current.receivedAt)) {
              return prev;
            }
            return {
              ...prev,
              [key]: { lat: lat!, lng: lng!, timestamp: row.timestamp, receivedAt },
            };
          });
          setLastUpdated(new Date());
        },
      )
      .subscribe();

    // Low-frequency refresh for trip/driver/vehicle changes (these don't
    // come through Realtime yet). Kept as a safety net.
    const timer = setInterval(loadData, 30000);

    // Fast position-only refresh — backup for environments where Supabase
    // Realtime isn't connected, and a snappier feel in the demo. Cheap call:
    // /vehicle-positions returns small rows.
    const positionsTimer = setInterval(async () => {
      try {
        const data = await apiFetch<PositionItem[]>("/vehicle-positions");
        const latestByDriver: Record<string, StoredPosition> = {};
        (data || []).forEach((pos) => {
          const key = pos.driverId || pos.vehicleId;
          if (!key) return;
          const coordinates = (pos.location as any)?.coordinates;
          const lat = coordinates ? coordinates[1] : (pos.location as any)?.lat;
          const lng = coordinates ? coordinates[0] : (pos.location as any)?.lng;
          if (lat === undefined || lng === undefined) return;
          const receivedAt = pos.createdAt || pos.timestamp;
          const current = latestByDriver[key];
          if (!current || new Date(receivedAt) > new Date(current.receivedAt)) {
            latestByDriver[key] = { lat, lng, timestamp: pos.timestamp, receivedAt };
          }
        });
        setPositions((prev) => {
          // Merge: keep entries that haven't changed, replace those with newer
          // fixes. Comparison uses server `receivedAt` so a skewed device
          // clock can't make an actually-newer fix look "older".
          let changed = false;
          const next: typeof prev = { ...prev };
          for (const [key, fresh] of Object.entries(latestByDriver)) {
            const current = next[key];
            if (!current || new Date(fresh.receivedAt) > new Date(current.receivedAt)) {
              next[key] = fresh;
              changed = true;
            }
          }
          if (changed) setLastUpdated(new Date());
          return changed ? next : prev;
        });
      } catch {
        // ignore — next tick will retry.
      }
    }, 2000);

    // Heartbeat — re-evaluates the 15s recency window every second so a
    // driver who stops pushing flips to red within ~1s of crossing the
    // threshold. Cheap: only re-runs the trackedDrivers memo.
    const tickTimer = setInterval(() => setNowTick(ahoraServidor()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      clearInterval(positionsTimer);
      clearInterval(tickTimer);
    };
  }, []);

  // Append new positions to the per-driver trail. Runs whenever `positions`
  // changes; only writes when the new fix is noticeably different from the
  // last trail point to keep the line clean. Also drops trails for drivers
  // who no longer have a current position (their session ended).
  useEffect(() => {
    setTrails((prev) => {
      let changed = false;
      const next: Record<string, TrailPoint[]> = {};
      for (const [driverId, pos] of Object.entries(positions)) {
        const existing = prev[driverId] ?? [];
        const last = existing[existing.length - 1];
        const moved =
          !last ||
          Math.abs(last.lat - pos.lat) > TRAIL_MIN_DELTA ||
          Math.abs(last.lng - pos.lng) > TRAIL_MIN_DELTA;
        if (moved) {
          // Server clock, same source the online/offline state uses — a
          // skewed device clock would otherwise fake an impossible speed
          // and cut the trail on every fix.
          const ts = new Date(pos.receivedAt).getTime();
          const appended = [...existing, { lat: pos.lat, lng: pos.lng, ts: Number.isNaN(ts) ? Date.now() : ts }];
          next[driverId] = appended.length > TRAIL_LIMIT
            ? appended.slice(appended.length - TRAIL_LIMIT)
            : appended;
          changed = true;
        } else {
          next[driverId] = existing;
        }
      }
      // Drop trails for drivers that fell off the positions map (stale).
      for (const driverId of Object.keys(prev)) {
        if (!positions[driverId]) {
          changed = true;
          continue;
        }
        if (!next[driverId]) next[driverId] = prev[driverId];
      }
      return changed ? next : prev;
    });
  }, [positions]);

  // Periodically rewrite each driver's raw trail onto the real road
  // network. Runs every 8s — Roads API costs ~$0.01 per call so doing
  // it on every fix would be wasteful, and a few seconds of "raw" trail
  // tail is invisible alongside the marker animation. Skips drivers
  // whose raw trail hasn't grown since the last snap to avoid pointless
  // calls.
  const lastSnappedLengthRef = useRef<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    const snap = async () => {
      const liveKeys = new Set<string>();
      for (const [driverId, raw] of Object.entries(trails)) {
        // Snap each segment on its own: a window straddling a cut would
        // ask the Roads API to fill in a gap we deliberately left open.
        for (const segment of splitTrail(raw)) {
          if (cancelled) return;
          if (segment.length < 2) continue;
          const key = segmentKey(driverId, segment);
          liveKeys.add(key);
          const prevLen = lastSnappedLengthRef.current[key] ?? 0;
          if (segment.length === prevLen) continue;
          // Send the last 80 points (under the API's 100 cap) so we keep
          // the historical part stable but still extend the snapped line
          // as new fixes come in.
          const window = segment.slice(-80);
          const snapped = await snapToRoads(window);
          if (cancelled) return;
          if (snapped && snapped.length > 0) {
            setSnappedTrails((prev) => ({ ...prev, [key]: snapped }));
            lastSnappedLengthRef.current[key] = segment.length;
          }
        }
      }
      if (cancelled) return;
      // Forget segments that no longer exist (driver went stale, or the
      // trail head was trimmed) so neither map grows without bound.
      Object.keys(lastSnappedLengthRef.current).forEach((k) => {
        if (!liveKeys.has(k)) delete lastSnappedLengthRef.current[k];
      });
      setSnappedTrails((prev) => {
        const stale = Object.keys(prev).filter((k) => !liveKeys.has(k));
        if (stale.length === 0) return prev;
        const next = { ...prev };
        stale.forEach((k) => delete next[k]);
        return next;
      });
    };
    void snap();
    const timer = setInterval(snap, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [trails]);

  // ── Qué sede y qué hotel toca cada viaje ──
  // El viaje tiene cuatro columnas de id para los lugares (sede y hotel, de
  // origen y de destino), pero casi ningún viaje cargado las trae: el lugar
  // viene escrito a mano en Origen/Destino, con el mismo nombre que está en el
  // catálogo ("Polideportivo Viña del Mar", "Hotel Ankara"). Un filtro que
  // mirara sólo los ids devolvería una lista vacía y parecería roto, así que
  // se resuelve por id y, si no hay, por nombre.
  //
  // Lo que queda fuera —comedores, direcciones sueltas como "1 Norte 221"— no
  // es una sede ni un hotel del catálogo y no debería aparecer bajo ninguno.
  const lugaresPorViaje = useMemo(() => {
    const indexar = (catalogo: Record<string, { id: string; name?: string | null }>) => {
      const porNombre = new Map<string, string>();
      Object.values(catalogo).forEach((item) => {
        const clave = claveLugar(item.name);
        if (clave) porNombre.set(clave, item.id);
      });
      return porNombre;
    };
    const sedesPorNombre = indexar(venues);
    const hotelesPorNombre = indexar(hotels);

    const resolver = (
      idOrigen: string | null | undefined,
      idDestino: string | null | undefined,
      porNombre: Map<string, string>,
      textos: Array<string | null | undefined>,
    ) => {
      const ids = new Set<string>();
      if (idOrigen) ids.add(idOrigen);
      if (idDestino) ids.add(idDestino);
      textos.forEach((texto) => {
        const id = porNombre.get(claveLugar(texto));
        if (id) ids.add(id);
      });
      return ids;
    };

    const mapa = new Map<string, { sedes: Set<string>; hoteles: Set<string> }>();
    trips.forEach((trip) => {
      const textos = [trip.origin, trip.destination];
      mapa.set(trip.id, {
        sedes: resolver(trip.originVenueId, trip.destinationVenueId, sedesPorNombre, textos),
        hoteles: resolver(trip.originHotelId, trip.destinationHotelId, hotelesPorNombre, textos),
      });
    });
    return mapa;
  }, [trips, venues, hotels]);

  /**
   * Los viajes que quedan tras los filtros de conductor, sede y hotel.
   *
   * Recortan la pantalla entera y no sólo la tabla: el mapa, la lista de
   * conductores, los indicadores de arriba y los viajes de abajo salen todos de
   * aquí. Un filtro que cambiara la tabla y dejara el mapa mostrando los 221
   * viajes estaría contando dos historias distintas al mismo tiempo.
   *
   * Los de buscar, cliente y estado no entran acá: ésos afinan sólo la lista de
   * "Todos los viajes" y se aplican después.
   */
  const tripsFiltrados = useMemo(
    () =>
      trips.filter((trip) => {
        if (tableDriver && claveConductor(drivers, trip.driverId) !== tableDriver) return false;
        // Sede y hotel miran los dos extremos del viaje: ir al Fortín Prat y
        // volver del Fortín Prat son los dos viajes del Fortín Prat.
        if (tableVenue && !lugaresPorViaje.get(trip.id)?.sedes.has(tableVenue)) return false;
        if (tableHotel && !lugaresPorViaje.get(trip.id)?.hoteles.has(tableHotel)) return false;
        return true;
      }),
    [trips, tableDriver, tableVenue, tableHotel, lugaresPorViaje, drivers],
  );

  const activeTripsForRoutes = useMemo(
    () => tripsFiltrados.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")),
    [tripsFiltrados],
  );

  // Geocode destination venues lazily as active trips appear. Cached in
  // localStorage by venueId so we don't re-hit Google after a reload.
  useEffect(() => {
    activeTripsForRoutes.forEach((trip) => {
      const venueId = trip.destinationVenueId;
      if (!venueId) return;
      if (destinationCoords[venueId]) return;
      const venue = venues[venueId];
      if (!venue) return;
      const query = [venue.name, venue.address, venue.commune, "Chile"]
        .filter(Boolean)
        .join(", ");
      if (!query) return;
      geocodeAddress(venueId, query).then((coords) => {
        if (!coords) return;
        setDestinationCoords((prev) =>
          prev[venueId] ? prev : { ...prev, [venueId]: coords },
        );
      });
    });
  }, [activeTripsForRoutes, venues, destinationCoords]);

  // Compute driving directions per trip once we have both ends. Re-computes
  // automatically when the driver drifts (handled inside getDirections).
  useEffect(() => {
    activeTripsForRoutes.forEach((trip) => {
      const venueId = trip.destinationVenueId;
      if (!venueId) return;
      const dest = destinationCoords[venueId];
      if (!dest) return;
      const origin = positions[trip.driverId];
      if (!origin) return;
      getDirections(
        trip.id,
        { lat: origin.lat, lng: origin.lng },
        dest,
      ).then((res) => {
        if (!res) return;
        setTripRoutes((prev) => ({ ...prev, [trip.id]: res.path }));
        setTripRouteMeta((prev) => ({
          ...prev,
          [trip.id]: {
            distanceKm: res.distanceMeters / 1000,
            durationMin: Math.round(res.durationSec / 60),
          },
        }));
      });
    });
  }, [activeTripsForRoutes, destinationCoords, positions]);

  const tripWhen = (t: Trip) => {
    const d = t.completedAt || t.startedAt || t.scheduledAt;
    return d ? new Date(d).getTime() : 0;
  };
  const orderedTrips = useMemo(() => {
    return [...tripsFiltrados].sort((a, b) => tripWhen(b) - tripWhen(a));
  }, [tripsFiltrados]);

  // ── Filtros de la tabla "Todos los viajes" ──
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tripsFiltrados.forEach((t) => { const s = t.status || "SCHEDULED"; m[s] = (m[s] || 0) + 1; });
    return m;
  }, [tripsFiltrados]);
  const tableClientOptions = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => { if (t.clientType) set.add(t.clientType); });
    return Array.from(set).sort();
  }, [trips]);
  // Los selectores listan sólo conductores, sedes y hoteles que aparecen en
  // algún viaje: un desplegable con los 14 hoteles del evento cuando sólo
  // once tienen viajes obliga a probarlos uno por uno para dar con los vacíos.
  const tableDriverOptions = useMemo(
    () => opcionesDeFiltro(
      trips,
      (trip) => [claveConductor(drivers, trip.driverId)],
      (id) => drivers[id]?.fullName || "Conductor sin nombre",
    ),
    [trips, drivers],
  );
  const tableVenueOptions = useMemo(
    () => opcionesDeFiltro(
      trips,
      (trip) => lugaresPorViaje.get(trip.id)?.sedes ?? [],
      (id) => venues[id]?.name || "Sede",
    ),
    [trips, lugaresPorViaje, venues],
  );
  const tableHotelOptions = useMemo(
    () => opcionesDeFiltro(
      trips,
      (trip) => lugaresPorViaje.get(trip.id)?.hoteles ?? [],
      (id) => hotels[id]?.name || "Hotel",
    ),
    [trips, lugaresPorViaje, hotels],
  );

  /** Los tres que recortan la pantalla entera, no sólo la lista de abajo. */
  const hayFiltrosDeVista = Boolean(tableDriver || tableVenue || tableHotel);

  const visibleTrips = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return orderedTrips.filter((t) => {
      if (tableStatus && (t.status || "SCHEDULED") !== tableStatus) return false;
      if (tableClient && (t.clientType || "") !== tableClient) return false;
      // Conductor, sede y hotel ya vienen aplicados: orderedTrips sale de
      // tripsFiltrados. Acá sólo se afina lo propio de esta lista.
      if (q) {
        const driver = drivers[t.driverId]?.fullName || "";
        const vehicle = t.vehicleId ? (vehicles[t.vehicleId]?.plate || "") : "";
        const hay = [t.origin, t.destination, driver, vehicle, t.tripType, t.clientType]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orderedTrips, tableSearch, tableStatus, tableClient, drivers, vehicles]);

  const activeTrips = useMemo(
    () => tripsFiltrados.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")),
    [tripsFiltrados]
  );

  // Unified live data: every driver with a fresh GPS fix, augmented with
  // destination + route info when they are on an active trip.
  const liveDestinations = useMemo<DestinationPin[]>(() => {
    return activeTripsForRoutes
      .map((trip) => {
        const venueId = trip.destinationVenueId;
        if (!venueId) return null;
        const coords = destinationCoords[venueId];
        if (!coords) return null;
        const venue = venues[venueId];
        const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
        return {
          tripId: trip.id,
          lat: coords.lat,
          lng: coords.lng,
          label: venue?.name || trip.destination || "Destino",
          accent: sc.accent,
        } satisfies DestinationPin;
      })
      .filter((d): d is DestinationPin => d !== null);
  }, [activeTripsForRoutes, destinationCoords, venues]);

  const liveRoutes = useMemo<RoutePath[]>(() => {
    return activeTripsForRoutes
      .map((trip) => {
        const path = tripRoutes[trip.id];
        if (!path || path.length === 0) return null;
        const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
        return { tripId: trip.id, path, accent: sc.accent } satisfies RoutePath;
      })
      .filter((r): r is RoutePath => r !== null);
  }, [activeTripsForRoutes, tripRoutes]);

  // Drivers we track on the live map. We keep showing a driver for 5 minutes
  // after their last fix so a brief connection drop doesn't make the marker
  // disappear — only the color changes (green ↔ red). Anything older than
  // 5 min is treated as a session that ended and is removed from the map.
  const trackedDrivers = useMemo(() => {
    // Ventana única del panel (lib/presencia): más larga que la cadencia del
    // conductor (20 s quieto) más el refresco de posiciones (8 s). Con 15 s
    // cada conductor detenido quedaba verde 15 s y rojo 5, en cada ciclo.
    const onlineCutoff = nowTick - VENTANA_CONECTADO_MS;
    const staleCutoff = nowTick - VENTANA_SIN_SENAL_MS;
    return Object.entries(positions)
      .map(([driverId, pos]) => {
        const driver = drivers[driverId];
        if (!driver) return null;
        // Use server `receivedAt` for recency — device clocks can be skewed
        // (field test had a phone 32 min behind, which made every marker
        // look "old" and stuck red even while positions kept arriving).
        const ts = new Date(pos.receivedAt).getTime();
        if (Number.isNaN(ts) || ts < staleCutoff) return null;
        const ageMs = nowTick - ts;
        const online = ts >= onlineCutoff;
        return { driver, position: pos, ageMs, online };
      })
      .filter(
        (x): x is { driver: DriverItem; position: StoredPosition; ageMs: number; online: boolean } =>
          x !== null,
      )
      .sort((a, b) => (Number(b.online) - Number(a.online)) || a.ageMs - b.ageMs);
  }, [positions, drivers, nowTick]);

  /**
   * El mapa sigue a los conductores, no a los viajes, así que los filtros se
   * traducen: con un conductor elegido queda ése; con una sede o un hotel
   * elegidos quedan los que van en un viaje que toca ese lugar. Un conductor
   * conectado pero sin viaje no aparece bajo un filtro de lugar: no hay nada
   * que lo relacione con él.
   */
  const trackedDriversVisibles = useMemo(() => {
    if (!tableDriver && !tableVenue && !tableHotel) return trackedDrivers;
    return trackedDrivers.filter(({ driver }) => {
      if (tableDriver && claveConductor(drivers, driver.id) !== tableDriver) return false;
      // Con sede u hotel elegidos no basta con ser el conductor: tiene que ir
      // en un viaje que toque ese lugar. activeTrips ya viene recortado.
      if (tableVenue || tableHotel) {
        return activeTrips.some((trip) => claveConductor(drivers, trip.driverId) === driver.id);
      }
      return true;
    });
  }, [trackedDrivers, tableDriver, tableVenue, tableHotel, activeTrips, drivers]);

  // Only the online slice — used for "Con GPS" KPI and the live count chip.
  const connectedDrivers = useMemo(
    () => trackedDriversVisibles.filter((d) => d.online),
    [trackedDriversVisibles],
  );

  // Build the per-driver breadcrumb trails to render under the markers.
  // We use the active trip id when there is one (so the polyline keys
  // match the markers), otherwise the synthetic `driver-${id}` key.
  const liveTrails = useMemo<TrailPath[]>(() => {
    return trackedDriversVisibles.flatMap(({ driver, online }) => {
      const raw = trails[driver.id];
      if (!raw || raw.length < 2) return [];
      const trip = activeTrips.find((t) => t.driverId === driver.id);
      const baseId = trip?.id ?? `driver-${driver.id}`;
      // Trail color follows the marker so the visual story stays
      // consistent: green while connected, red while in the no-signal state.
      const accent = online ? STATE.success : STATE.danger;
      // One polyline per segment: the pieces we can vouch for are drawn,
      // and the gaps between them stay empty instead of being bridged by
      // a straight line the car never drove.
      return splitTrail(raw)
        .map((segment, i) => {
          // Prefer the snapped version when we have one — it follows the
          // actual streets. Fall back to the raw points until Roads API
          // catches up on the first cycle.
          const snapped = snappedTrails[segmentKey(driver.id, segment)];
          const path: LatLng[] = snapped && snapped.length >= 2 ? snapped : segment;
          if (path.length < 2) return null;
          return { tripId: `${baseId}#${i}`, path, accent } satisfies TrailPath;
        })
        .filter((t): t is TrailPath => t !== null);
    });
  }, [trackedDriversVisibles, trails, snappedTrails, activeTrips]);

  const trackedMarkers = useMemo<TrackingMarker[]>(() => {
    return trackedDriversVisibles.map(({ driver, position, online }) => {
      const trip = activeTrips.find((t) => t.driverId === driver.id);
      // Connection status drives the marker color: green when actively
      // receiving GPS, red when we haven't heard from the driver in >15s.
      // This wins over the trip status color so a disconnection is obvious.
      const accent = online ? STATE.success : STATE.danger;
      const vehicle = trip?.vehicleId ? vehicles[trip.vehicleId] : null;
      const venue = trip?.destinationVenueId ? venues[trip.destinationVenueId] : null;
      return {
        // The map keys markers by tripId — use the driver id as a stable key
        // when there is no trip so connected drivers without trips also render.
        tripId: trip?.id ?? `driver-${driver.id}`,
        lat: position.lat,
        lng: position.lng,
        driverName: driver.fullName || "Conductor",
        vehiclePlate: vehicle?.plate || trip?.vehiclePlate || "Sin vehículo",
        statusLabel: online
          ? (trip ? (STATUS_LABEL[trip.status ?? ""] || trip.status || "En línea") : "En línea")
          : "Sin señal",
        accent,
        origin: trip?.origin || "—",
        destination: venue?.name || trip?.destination || "—",
        elapsedMin: trip?.startedAt ? Math.floor((Date.now() - new Date(trip.startedAt).getTime()) / 60000) : null,
        gpsTime: new Date(position.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      } satisfies TrackingMarker;
    });
  }, [trackedDriversVisibles, activeTrips, vehicles, venues]);

  const tripStats = useMemo(() => {
    const active = tripsFiltrados.filter((tr) => ["EN_ROUTE", "PICKED_UP"].includes(tr.status ?? "")).length;
    const scheduled = tripsFiltrados.filter((tr) => tr.status === "SCHEDULED").length;
    const completed = tripsFiltrados.filter((tr) => ["COMPLETED", "DROPPED_OFF"].includes(tr.status ?? "")).length;
    // Only count drivers with a FRESH GPS fix (last 30 s) — historical rows
    // in vehicle_positions would otherwise mark every old driver as "Con GPS",
    // and a driver who disabled GPS mid-trip would still show as live.
    // "Con GPS" = any driver whose last fix is within the live recency
    // window, regardless of trip state. A driver can be transmitting
    // before/after a trip and still deserves to be counted.
    const withPosition = connectedDrivers.length;
    return { active, scheduled, completed, withPosition, total: tripsFiltrados.length };
  }, [tripsFiltrados, connectedDrivers]);

  const resolveDelegations = (trip: Trip) => {
    const ids = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return "-";
    const labels = unique
      .map((delegationId) => delegations[delegationId]?.countryCode ?? delegationId)
      .map((code) => countryLabels[code] ?? code);
    return labels.join(", ");
  };

  const resolveAthletes = (trip: Trip) => {
    if (trip.athleteNames && trip.athleteNames.length > 0) {
      return trip.athleteNames.join(", ");
    }
    const names = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.fullName)
      .filter((value): value is string => Boolean(value));
    return names.length > 0 ? names.join(", ") : "-";
  };

  const buildMapEmbed = (lat: number, lng: number) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
    }
    const delta = 0.01;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  const buildGoogleMapsLink = (lat: number, lng: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // ── Detalle de viaje: ruta realizada (breadcrumb GPS), km y valor ──
  const openTripDetail = async (trip: Trip) => {
    setDetailTrip(trip);
    setDetailPositions([]);
    setDetailLoading(true);
    try {
      const rows = await apiFetch<
        Array<{
          location?: { coordinates?: number[] } | null;
          createdAt?: string;
          timestamp?: string;
        }>
      >(`/vehicle-positions/by-trip/${trip.id}`);
      // Rows arrive ordered by time. `prevTs` carries the last usable clock
      // forward so a row with no timestamp is judged by distance alone
      // instead of looking like an instant jump.
      let prevTs = 0;
      const pts = (rows || [])
        .map((r) => {
          const c = r.location?.coordinates;
          if (!Array.isArray(c) || c.length < 2) return null;
          // Server clock first: `timestamp` is the device's, and a skewed
          // phone would make honest driving look like a teleport.
          const parsed = new Date(r.createdAt ?? r.timestamp ?? "").getTime();
          const ts = Number.isNaN(parsed) ? prevTs : parsed;
          prevTs = ts;
          return { lat: Number(c[1]), lng: Number(c[0]), ts };
        })
        .filter(
          (p): p is TrailPoint =>
            !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng),
        );
      setDetailPositions(pts);
    } catch {
      setDetailPositions([]);
    } finally {
      setDetailLoading(false);
    }
  };
  // Travelled km for the trip detail. Uses `trailKm` so an impossible jump
  // between two fixes doesn't add its own length to the total.
  const routeKmFromPts = (pts: TrailPoint[]) => trailKm(pts);
  // Fallback: mapa embebido de la ruta planificada origen→destino (siempre disponible con la embed key).
  const buildDirectionsEmbed = (origin?: string | null, destination?: string | null): string | null => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !origin || !destination) return null;
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`;
  };
  const formatDuration = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso || !endIso) return "—";
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Brand palette — matches app light design system
  const pal = {
    panelBg: SURFACE.card,
    panelBorder: `1px solid ${SURFACE.border}`,
    panelShadow: "0 1px 4px rgba(15,23,42,0.06)",
    orb1: "rgba(33,208,179,0.07)", orb2: "rgba(31,205,255,0.05)",
    accent: BRAND.teal,
    titleColor: SURFACE.text,
    subtitleColor: SURFACE.textMuted,
    chipBg: SURFACE.bg, chipBorder: SURFACE.border, chipLabel: SURFACE.textMuted,
    btnBg: SURFACE.card, btnBorder: SURFACE.border, btnColor: SURFACE.textSecondary,
    kpi: [BRAND.teal, STATE.success, STATE.warning, STATE.info, ACCENT.violetLight],
  };

  return (
    <div className="space-y-6">
      {/* ── Command Panel */}
      <section style={{
        background: pal.panelBg,
        border: pal.panelBorder,
        borderRadius: "20px",
        padding: isMobile ? "16px" : "24px 28px",
        boxShadow: pal.panelShadow,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", top: "-40px", right: "10%", width: "220px", height: "220px", borderRadius: "50%", background: pal.orb1, filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30px", left: "20%", width: "160px", height: "160px", borderRadius: "50%", background: pal.orb2, filter: "blur(40px)", pointerEvents: "none" }} />

        <div className="flex flex-wrap items-start justify-between gap-4" style={{ position: "relative" }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>
                Operaciones
              </p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: STATE.success, animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: STATE.success, letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, lineHeight: 1.2, marginBottom: "4px" }}>
              Tracking de viajes
            </h1>
            <p style={{ fontSize: "13px", color: pal.subtitleColor }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Monitoreo en tiempo real"}
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: pal.btnBg,
              border: `1px solid ${pal.btnBorder}`,
              borderRadius: "10px",
              padding: "9px 18px",
              color: loading ? pal.subtitleColor : pal.btnColor,
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 150ms",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <span style={{ display: "inline-flex" }}><RefreshIcon size={14} /></span>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>

        {/* KPI chips */}
        <div className="flex flex-wrap gap-3 mt-5" style={{ position: "relative" }}>
          {[
            { label: "Total viajes", value: tripStats.total, color: pal.kpi[0], icon: <TruckIcon size={14} strokeWidth={1.8} /> },
            { label: "En ruta", value: tripStats.active, color: pal.kpi[1], icon: <ClockIcon size={14} strokeWidth={1.8} /> },
            { label: "Programados", value: tripStats.scheduled, color: pal.kpi[2], icon: <CalendarIcon size={14} strokeWidth={1.8} /> },
            { label: "Completados", value: tripStats.completed, color: pal.kpi[3], icon: <CheckIcon size={14} strokeWidth={1.8} /> },
            { label: "Con GPS", value: tripStats.withPosition, color: pal.kpi[4], icon: <PinIcon size={14} strokeWidth={1.8} /> },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: pal.chipBg,
              border: `1px solid ${pal.chipBorder}`,
              borderTop: `2px solid ${stat.color}`,
              borderRadius: "12px",
              padding: "10px 16px",
              minWidth: "110px",
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: stat.color }}>{stat.icon}</span>
                <span style={{ fontSize: "10px", color: pal.chipLabel, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</span>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {hasLoadedOnce ? stat.value : "—"}
              </p>
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm" style={{ color: STATE.danger }}>{error}</p>}
      </section>

      {/* ── Filtros de la pantalla.
          Van sobre las pestañas y no dentro de una de ellas: recortan tanto el
          mapa en vivo como la lista de abajo, y puestos dentro de "Todos los
          viajes" no se veían desde el mapa, que es donde más se preguntan. */}
      {(tableDriverOptions.length > 0 || tableVenueOptions.length > 0 || tableHotelOptions.length > 0) && (
        <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "16px", padding: "14px 18px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: SURFACE.textFaint, marginRight: 2 }}>
              Filtrar
            </span>
            {tableDriverOptions.length > 0 && (
              <StyledSelect value={tableDriver} onChange={(e) => setTableDriver(e.target.value)} wrapperStyle={isMobile ? { width: "100%" } : anchoFiltro(230)}>
                <option value="">Todos los conductores</option>
                {tableDriverOptions.map((o) => <option key={o.id} value={o.id}>{`${o.label} (${o.count})`}</option>)}
              </StyledSelect>
            )}
            {tableVenueOptions.length > 0 && (
              <StyledSelect value={tableVenue} onChange={(e) => setTableVenue(e.target.value)} wrapperStyle={isMobile ? { width: "100%" } : anchoFiltro(240)}>
                <option value="">Todas las sedes</option>
                {tableVenueOptions.map((o) => <option key={o.id} value={o.id}>{`${o.label} (${o.count})`}</option>)}
              </StyledSelect>
            )}
            {tableHotelOptions.length > 0 && (
              <StyledSelect value={tableHotel} onChange={(e) => setTableHotel(e.target.value)} wrapperStyle={isMobile ? { width: "100%" } : anchoFiltro(240)}>
                <option value="">Todos los hoteles</option>
                {tableHotelOptions.map((o) => <option key={o.id} value={o.id}>{`${o.label} (${o.count})`}</option>)}
              </StyledSelect>
            )}
            {hayFiltrosDeVista && (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums" }}>
                  {tripsFiltrados.length} de {trips.length} viajes
                </span>
                <button type="button" onClick={() => { setTableDriver(""); setTableVenue(""); setTableHotel(""); }}
                  style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 10, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: STATE.danger, cursor: "pointer" }}>
                  Limpiar
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* ── View tabs */}
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "16px", padding: "6px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-2 grid-cols-2">
          {([
            { key: "live" as const, label: "Tracking en vivo", count: trackedDriversVisibles.length },
            { key: "table" as const, label: "Todos los viajes", count: orderedTrips.length },
          ]).map((tab) => {
            const selected = activeView === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  borderRadius: "12px", padding: "10px 16px", cursor: "pointer",
                  background: selected ? BRAND.teal : "transparent",
                  border: "none", transition: "all 150ms",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected ? SURFACE.card : SURFACE.text }}>{tab.label}</span>
                <span style={{
                  minWidth: "28px", borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.25)" : SURFACE.borderMuted,
                  color: selected ? SURFACE.card : SURFACE.textMuted,
                  border: selected ? "none" : `1px solid ${SURFACE.border}`,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Live tracking view (unified) */}
      {activeView === "live" && (
        <section className="space-y-4">
          {/* Completion alerts */}
          {completedAlerts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {completedAlerts.map((alert, i) => (
                <div key={`${alert.tripId}-${i}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)",
                  borderRadius: "14px", padding: "12px 18px", gap: "12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <span style={{ color: STATE.success, flexShrink: 0 }}>
                      <CheckCircleIcon size={20} strokeWidth={2} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: STATE.success }}>
                        Viaje completado — {alert.driverName}
                      </p>
                      <p style={{ fontSize: "12px", color: SURFACE.textMuted }}>
                        Llegó a {alert.destination} · {alert.ts.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompletedAlerts((prev) => prev.filter((_, j) => j !== i))}
                    style={{ color: SURFACE.textFaint, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
                  >
                    <XIcon size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mapa + lista: apilados en pantallas chicas, lado a lado desde lg.
              El grid vive solo en clases — el gridTemplateColumns inline le
              ganaba a las clases responsive y aplastaba el mapa en móvil. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">

            {/* Map — always rendered, even when no drivers are connected. */}
            <div style={{
              borderRadius: "20px",
              overflow: "hidden",
              border: `1px solid ${SURFACE.border}`,
              boxShadow: "0 1px 8px rgba(15,23,42,0.08)",
              position: "relative",
            }}>
              <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 1000 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: "rgba(0,0,0,0.6)", borderRadius: "99px", padding: "5px 12px",
                  backdropFilter: "blur(6px)",
                }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: connectedDrivers.length > 0 ? STATE.success : SURFACE.textFaint, animation: "pulse 1.5s infinite", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: SURFACE.card, letterSpacing: "0.1em" }}>
                    {connectedDrivers.length} en línea · {trackedDriversVisibles.length - connectedDrivers.length} sin señal · {liveRoutes.length} con ruta
                  </span>
                </span>
              </div>
              {trackedDriversVisibles.length === 0 && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  zIndex: 999, background: "rgba(255,255,255,0.94)",
                  border: `1px solid ${SURFACE.border}`, borderRadius: "14px",
                  padding: "18px 22px", textAlign: "center" as const, maxWidth: "min(320px, calc(100% - 24px))", width: "max-content",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                }}>
                  <p style={{ fontWeight: 800, fontSize: "14px", color: SURFACE.text }}>
                    {hayFiltrosDeVista ? "Ningún conductor coincide con los filtros" : "Sin conductores enviando GPS ahora"}
                  </p>
                  <p style={{ fontSize: "12px", marginTop: "4px", color: SURFACE.textMuted, lineHeight: 1.5 }}>
                    {hayFiltrosDeVista
                      ? "Hay conductores transmitiendo, pero ninguno va en un viaje que calce con lo filtrado."
                      : "Cuando un conductor entre y prenda el GPS, va a aparecer en el mapa."}
                  </p>
                </div>
              )}
              <LiveTrackingMap
                markers={trackedMarkers}
                destinations={liveDestinations}
                routes={liveRoutes}
                trails={liveTrails}
                height={isMobile ? 420 : 760}
                isDark={false}
                selectedTripId={selectedTripId}
              />
            </div>

            {/* Sidebar — one card per tracked driver (online + offline). */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", ...(isMobile ? {} : { maxHeight: "780px", overflowY: "auto" as const }), paddingRight: "2px" }}>
              {trackedDriversVisibles.length === 0 && (
                <div style={{
                  borderRadius: "14px", border: `1px dashed ${SURFACE.borderStrong}`, background: SURFACE.card,
                  padding: "20px 16px", textAlign: "center" as const,
                  fontSize: "12px", color: SURFACE.textMuted, lineHeight: 1.5,
                }}>
                  {hayFiltrosDeVista
                    ? "Ningún conductor coincide con los filtros."
                    : "Esperando conductores. Al activar el GPS desde la app aparecerán aquí."}
                </div>
              )}
              {trackedDriversVisibles.map(({ driver, position, ageMs, online }) => {
                const trip = activeTripsForRoutes.find((t) => t.driverId === driver.id);
                const accent = online ? STATE.success : STATE.danger;
                const chipBg = online ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.12)";
                const chipBorder = online ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)";
                const vehicle = trip?.vehicleId ? vehicles[trip.vehicleId] : null;
                const venue = trip?.destinationVenueId ? venues[trip.destinationVenueId] : null;
                const ageSec = Math.floor(ageMs / 1000);
                const ageLabel = ageSec < 60 ? `hace ${ageSec}s` : `hace ${Math.floor(ageSec / 60)}m`;
                const markerId = trip?.id ?? `driver-${driver.id}`;
                const routeMeta = trip ? tripRouteMeta[trip.id] : null;
                const elapsedMs = trip?.startedAt ? Date.now() - new Date(trip.startedAt).getTime() : null;
                const elapsedMin = elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null;

                return (
                  <div key={driver.id} style={{
                    background: selectedTripId === markerId ? "#f0fdfa" : SURFACE.card,
                    border: selectedTripId === markerId ? `2px solid ${BRAND.teal}` : `1px solid ${SURFACE.border}`,
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: "14px",
                    padding: "12px 14px",
                    boxShadow: selectedTripId === markerId ? "0 0 8px rgba(20,184,166,0.3)" : "0 1px 4px rgba(15,23,42,0.06)",
                    cursor: "pointer",
                    opacity: online ? 1 : 0.85,
                  }}
                    onClick={() => setSelectedTripId(selectedTripId === markerId ? null : markerId)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "8px" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: 800, color: SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {driver.fullName || "Conductor"}
                        </p>
                        <p style={{ fontSize: "11px", color: SURFACE.textMuted, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {trip
                            ? (vehicle ? [vehicle.plate, vehicle.type].filter(Boolean).join(" · ") : (trip.vehiclePlate || "Sin vehículo"))
                            : online ? "Conectado · sin viaje" : "Sin señal · esperando reconexión"}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          background: chipBg, border: `1px solid ${chipBorder}`,
                          borderRadius: "99px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: accent,
                        }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: accent, animation: online ? "pulse 1.5s infinite" : "none", display: "inline-block" }} />
                          {online
                            ? (trip ? (STATUS_LABEL[trip.status ?? ""] || trip.status || "En línea") : "En línea")
                            : "Sin señal"}
                        </span>
                        <span style={{ fontSize: "10px", color: SURFACE.textMuted }}>{ageLabel}</span>
                      </div>
                    </div>

                    {trip && (
                      <>
                        <div style={{ fontSize: "11px", color: SURFACE.textMuted, lineHeight: 1.5, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <PinIcon size={10} color={BRAND.teal} strokeWidth={2.2} />
                          <span>{trip.origin || "Origen"}</span>
                          <span style={{ color: SURFACE.borderStrong, display: "inline-flex" }}><ArrowRightIcon size={12} /></span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={SURFACE.textFaint} strokeWidth="2" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/></svg>
                          <span>{venue?.name || trip.destination || "Destino"}</span>
                        </div>
                        {routeMeta && (
                          <div style={{ marginTop: "6px", fontSize: "10px", color: BRAND.tealInk, fontWeight: 600 }}>
                            Ruta: {routeMeta.distanceKm.toFixed(1)} km · ~{routeMeta.durationMin} min
                            {elapsedMin !== null ? ` · iniciado hace ${elapsedMin}m` : ""}
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ marginTop: "6px", fontSize: "10px", color: SURFACE.textFaint }}>
                      {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · GPS {new Date(position.timestamp).toLocaleTimeString("es-CL")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Table view */}
      {activeView === "table" && (
        <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "16px", padding: isMobile ? "14px" : "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: SURFACE.text, margin: 0 }}>{t("Todos los viajes")}</h2>
            <span style={{ fontSize: 12, fontWeight: 600, color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums" }}>
              {visibleTrips.length === tripsFiltrados.length ? `${visibleTrips.length} viajes` : `${visibleTrips.length} de ${tripsFiltrados.length}`}
            </span>
          </div>

          {/* ── Filtros ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <SearchIcon size={15} color={SURFACE.textFaint} strokeWidth={2} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Buscar origen, destino, conductor, patente…"
                  style={{ width: "100%", padding: "9px 12px 9px 34px", fontSize: 13, borderRadius: 10, border: `1px solid ${SURFACE.border}`, outline: "none", background: SURFACE.bg, color: SURFACE.text, boxSizing: "border-box" }} />
              </div>
              <StyledSelect value={tableClient} onChange={(e) => setTableClient(e.target.value)} wrapperStyle={isMobile ? { width: "100%" } : anchoFiltro(190)}>
                <option value="">Todos los clientes</option>
                {tableClientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </StyledSelect>
              {(tableSearch || tableStatus || tableClient) && (
                <button type="button" onClick={() => { setTableSearch(""); setTableStatus(""); setTableClient(""); }}
                  style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 10, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: STATE.danger, cursor: "pointer" }}>
                  Limpiar
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[{ key: "", label: "Todos", accent: BRAND.teal, count: tripsFiltrados.length }].concat(
                Object.keys(statusCounts).map((s) => ({ key: s, label: STATUS_LABEL[s] || s, accent: (STATUS_COLORS[s] ?? STATUS_COLORS.SCHEDULED).accent, count: statusCounts[s] }))
              ).map((chip) => {
                const active = tableStatus === chip.key;
                return (
                  <button key={chip.key || "all"} type="button" onClick={() => setTableStatus(chip.key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: active ? chip.accent : SURFACE.borderMuted, color: active ? SURFACE.card : SURFACE.textSecondary, border: `1px solid ${active ? chip.accent : "#e2e8f0"}`, transition: "all .15s" }}>
                    {!active && <span style={{ width: 7, height: 7, borderRadius: "50%", background: chip.accent, display: "inline-block" }} />}
                    {chip.label}
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : SURFACE.card, color: active ? SURFACE.card : SURFACE.textMuted }}>{chip.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* "Sin viajes" sólo cuando de verdad no hay ninguno: si la lista quedó
              vacía por un filtro, cae al mensaje de abajo, que sí lo explica. */}
          {trips.length === 0 ? (
            <p style={{ fontSize: "14px", color: SURFACE.textMuted }}>{t("Sin viajes registrados.")}</p>
          ) : visibleTrips.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 20px", color: SURFACE.textFaint }}>
              <SearchIcon size={30} color={SURFACE.borderStrong} strokeWidth={1.6} style={{ margin: "0 auto 10px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>Ningún viaje coincide con los filtros.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {visibleTrips.map((trip) => {
                const driver = drivers[trip.driverId];
                const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                const sc = STATUS_COLORS[trip.status ?? "SCHEDULED"] ?? STATUS_COLORS.SCHEDULED;
                const originShort = trip.origin?.split(",")[0] || "—";
                const destShort = trip.destination?.split(",")[0] || "—";
                const when = trip.completedAt || trip.startedAt || trip.scheduledAt;
                const meta = [
                  driver?.fullName || "Sin conductor",
                  vehicle?.plate ? vehicle.plate.toUpperCase() : null,
                  formatTripType(trip.tripType),
                  trip.clientType || null,
                ].filter(Boolean).join("  ·  ");
                return (
                  <button key={trip.id} type="button" onClick={() => openTripDetail(trip)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "13px 16px", borderRadius: 14, border: `1px solid ${SURFACE.border}`, borderLeft: `4px solid ${sc.accent}`, background: SURFACE.card, cursor: "pointer", transition: "all .15s" }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = SURFACE.bg; el.style.borderColor = SURFACE.borderStrong; el.style.borderLeftColor = sc.accent; el.style.transform = "translateX(2px)"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = SURFACE.card; el.style.borderColor = SURFACE.border; el.style.borderLeftColor = sc.accent; el.style.transform = ""; }}>
                    <span style={{ flexShrink: 0, width: 10, height: 10, borderRadius: "50%", background: sc.accent, boxShadow: `0 0 0 4px ${sc.chipBg}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                          {originShort} <span style={{ color: SURFACE.textFaint, display: "inline-flex", verticalAlign: "middle" }}><ArrowRightIcon size={12} /></span> {destShort}
                        </span>
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, color: sc.accent }}>
                          {STATUS_LABEL[trip.status || "SCHEDULED"] || trip.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 14, flexShrink: 0 }}>
                      <div style={{ textAlign: "right", maxWidth: isMobile ? 96 : undefined }}>
                        <p style={{ fontSize: 11.5, color: SURFACE.textSecondary, margin: 0, fontVariantNumeric: "tabular-nums", whiteSpace: isMobile ? "normal" : "nowrap" }}>{formatDate(when)}</p>
                        {trip.tripCost != null && (
                          <p style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.tealInk, margin: "2px 0 0" }}>${Number(trip.tripCost).toLocaleString("es-CL")}</p>
                        )}
                      </div>
                      <ChevronRightIcon size={16} color={SURFACE.borderStrong} strokeWidth={2} style={{ flexShrink: 0 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Detalle de viaje realizado (ruta, km, valor) ── */}
      {detailTrip && (() => {
        const trip = detailTrip;
        const driver = drivers[trip.driverId];
        const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
        const event = trip.eventId ? events[trip.eventId] : null;
        const km = detailPositions.length >= 2 ? routeKmFromPts(detailPositions) : null;
        const hasGps = detailPositions.length >= 2;
        const pax = trip.athleteIds?.length || trip.passengerCount || 0;
        // Pasajero(s): el solicitante del portal (requester) y/o los participantes vinculados.
        const paxNames = Array.from(new Set([
          ...(trip.requesterAthleteId && athletes[trip.requesterAthleteId]?.fullName ? [athletes[trip.requesterAthleteId]!.fullName as string] : []),
          ...(trip.athleteNames && trip.athleteNames.length > 0
            ? trip.athleteNames
            : (trip.athleteIds || []).map((id) => athletes[id]?.fullName).filter((n): n is string => Boolean(n))),
        ]));
        const sc = STATUS_COLORS[trip.status ?? "COMPLETED"] ?? STATUS_COLORS.COMPLETED;
        const close = () => { setDetailTrip(null); setDetailPositions([]); setRouteExpanded(false); };
        const stat = (label: string, value: string, color = SURFACE.text) => (
          <div style={{ padding: "12px 8px", borderRadius: "14px", background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}`, textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: SURFACE.textFaint, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color, margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>{value}</p>
          </div>
        );
        const field = (label: string, value: string) => (
          <div style={{ padding: "8px 10px", borderRadius: "10px", background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}` }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: SURFACE.textFaint, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ fontSize: "12.5px", fontWeight: 600, color: SURFACE.text, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
          </div>
        );
        return (
          <div onClick={close}
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.5)", padding: "16px", backdropFilter: "blur(6px)" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: SURFACE.card, width: "100%", maxWidth: "960px", maxHeight: "calc(100dvh - 24px)", borderRadius: "22px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 72px rgba(15,23,42,0.28)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: isMobile ? "14px 16px 12px" : "18px 22px 14px", background: `linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`, color: SURFACE.card, flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: BRAND.tealLight, margin: 0 }}>Detalle del viaje</p>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(trip.origin?.split(",")[0] || "—")} → {(venue?.name || trip.destination?.split(",")[0] || "—")}
                  </h3>
                  <span style={{ display: "inline-block", marginTop: "6px", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, color: sc.accent }}>
                    {STATUS_LABEL[trip.status || "SCHEDULED"] || trip.status}
                  </span>
                </div>
                <button type="button" onClick={close}
                  style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: SURFACE.card, cursor: "pointer", fontSize: "20px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px 14px 18px" : "16px 18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Ruta realizada */}
                {(() => {
                  const dirEmbed = buildDirectionsEmbed(trip.origin, trip.destination);
                  return (
                    <div style={{ borderRadius: "14px", overflow: "hidden", border: `1px solid ${SURFACE.border}`, background: SURFACE.borderMuted, position: "relative" }}>
                      {hasGps ? (
                        <TripRouteMap points={detailPositions} height={isMobile ? 300 : 460} />
                      ) : dirEmbed ? (
                        <iframe title={`route-${trip.id}`} src={dirEmbed} style={{ width: "100%", height: isMobile ? 300 : 460, border: "none", display: "block" }} loading="lazy" />
                      ) : (
                        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: SURFACE.textFaint, fontSize: "13px", textAlign: "center", padding: "0 20px" }}>
                          {detailLoading ? (
                            <><div style={{ width: 26, height: 26, borderRadius: "50%", border: "3px solid rgba(33,208,179,0.25)", borderTopColor: BRAND.teal, animation: "vp-spin 0.8s linear infinite" }} /><span>Cargando recorrido…</span></>
                          ) : (
                            <><PinIcon size={26} color={SURFACE.borderStrong} strokeWidth={1.8} /><span>Sin recorrido GPS registrado para este viaje.</span></>
                          )}
                        </div>
                      )}
                      <span style={{ position: "absolute", top: 8, left: 8, fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.tealInk, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(33,208,179,0.3)", borderRadius: 8, padding: "3px 8px" }}>
                        {hasGps ? "Ruta realizada" : "Ruta estimada"}
                      </span>
                      {(hasGps || dirEmbed) && (
                        <button type="button" onClick={() => setRouteExpanded(true)}
                          style={{ position: "absolute", bottom: 8, right: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "none", background: "rgba(4,26,46,0.85)", color: BRAND.tealLight, fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                          <MaximizeIcon size={12} strokeWidth={2} />
                          Ver más grande
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "8px" }}>
                  {stat("Distancia", km != null ? `${km.toFixed(1)} km` : (detailLoading ? "…" : "—"))}
                  {stat("Valor", trip.tripCost != null ? `$${Number(trip.tripCost).toLocaleString("es-CL")}` : "—", BRAND.tealInk)}
                  {stat("Duración", formatDuration(trip.startedAt, trip.completedAt))}
                  {stat("Pasajeros", (paxNames.length || pax) ? String(paxNames.length || pax) : "—")}
                </div>

                {/* Origen / Destino */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px" }}>
                  {field("Origen", trip.origin || "—")}
                  {field("Destino", venue?.name || trip.destination || "—")}
                </div>

                {/* Conductor / vehículo / delegación / participantes */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px" }}>
                  {field("Conductor", driver?.fullName || trip.driverId || "—")}
                  {field("Vehículo", [vehicle?.plate, vehicle?.type].filter(Boolean).join(" · ") || trip.vehicleId || "—")}
                  {field("Delegación", resolveDelegations(trip) !== "-" ? resolveDelegations(trip) : "—")}
                  {field("Pasajero(s)", paxNames.length ? paxNames.join(", ") : "—")}
                </div>

                {/* Tiempos */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "8px" }}>
                  {field("Programación", formatDate(trip.scheduledAt))}
                  {field("Inicio", formatDate(trip.startedAt))}
                  {field("Cierre", formatDate(trip.completedAt))}
                </div>

                {/* Evento + rating */}
                {event?.name && field("Evento", event.name)}
                {trip.driverRating ? (
                  <div style={{ padding: "10px 12px", borderRadius: "12px", background: STATE.warningSoft, border: `1px solid ${STATE.warningBorder}`, display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "inline-flex", gap: 2, color: STATE.warning }}>{Array.from({ length: trip.driverRating }, (_, k) => <StarIcon key={k} size={16} fill={STATE.warning} />)}</span>
                    {trip.ratingComment && <span style={{ fontSize: "12px", color: STATE.warningText, fontStyle: "italic", flex: 1 }}>&ldquo;{trip.ratingComment}&rdquo;</span>}
                  </div>
                ) : null}
                {trip.notes && field("Notas", trip.notes)}
              </div>

              {/* Footer */}
              <div style={{ flexShrink: 0, padding: "12px 18px", borderTop: `1px solid ${SURFACE.borderMuted}`, display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "8px" }}>
                {detailPositions.length > 0 && (
                  <a href={buildGoogleMapsLink(detailPositions[detailPositions.length - 1].lat, detailPositions[detailPositions.length - 1].lng)}
                    target="_blank" rel="noreferrer"
                    style={{ padding: "9px 16px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.textSecondary, fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                    Ver en Google Maps
                  </a>
                )}
                <button type="button" onClick={close}
                  style={{ padding: "9px 20px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg,${BRAND.teal},#14AE98)`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  Cerrar
                </button>
              </div>
            </div>
            <style>{`@keyframes vp-spin{to{transform:rotate(360deg)}}`}</style>

            {/* Ruta a pantalla completa */}
            {routeExpanded && (() => {
              const dirEmbed = buildDirectionsEmbed(trip.origin, trip.destination);
              return (
                <div onClick={(e) => e.stopPropagation()}
                  style={{ position: "fixed", inset: 0, zIndex: 80, background: "#0d1a28", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: `linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`, flexShrink: 0 }}>
                    <button type="button" onClick={() => setRouteExpanded(false)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(52,243,198,0.4)", background: "rgba(33,208,179,0.15)", color: BRAND.tealLight, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      <ArrowLeftIcon size={14} strokeWidth={2.5} />
                      Volver
                    </button>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: SURFACE.card, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(trip.origin?.split(",")[0] || "—")} → {(venue?.name || trip.destination?.split(",")[0] || "—")}
                    </p>
                  </div>
                  {hasGps ? (
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <TripRouteMap points={detailPositions} height="100%" />
                    </div>
                  ) : dirEmbed ? (
                    <iframe title={`route-full-${trip.id}`} src={dirEmbed} style={{ flex: 1, width: "100%", border: "none" }} loading="lazy" />
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: SURFACE.textFaint, fontSize: 13 }}>
                      Sin recorrido disponible.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {mapPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", padding: "16px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: SURFACE.card, width: "100%", maxWidth: "900px", maxHeight: "calc(100dvh - 24px)", overflowY: "auto", borderRadius: "20px", padding: isMobile ? "14px" : "20px", boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: BRAND.teal }}>{t("Tracking de viajes")}</p>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: SURFACE.text }}>{mapPreview.title}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <a
                  href={buildGoogleMapsLink(mapPreview.lat, mapPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "8px 16px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.textSecondary, fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Ver en Google Maps")}
                </a>
                <button
                  type="button"
                  onClick={() => setMapPreview(null)}
                  style={{ padding: "8px 16px", borderRadius: "10px", border: "none", background: BRAND.teal, color: SURFACE.card, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
            <div style={{ aspectRatio: "16/9", width: "100%", overflow: "hidden", borderRadius: "12px", border: `1px solid ${SURFACE.border}` }}>
              <iframe title="map-preview" src={buildMapEmbed(mapPreview.lat, mapPreview.lng)} style={{ width: "100%", height: "100%" }} loading="lazy" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


