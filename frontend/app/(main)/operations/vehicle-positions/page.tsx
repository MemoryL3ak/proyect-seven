"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type {
  DestinationPin,
  RoutePath,
  TrackingMarker,
  TrailPath,
} from "@/components/LiveTrackingMap";
import { geocodeAddress, getDirections, snapToRoads, type LatLng } from "@/lib/google-maps";

const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), { ssr: false });

type Trip = {
  id: string;
  eventId?: string | null;
  driverId: string;
  vehicleId: string;
  vehiclePlate?: string | null;
  origin?: string | null;
  destination?: string | null;
  destinationVenueId?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  passengerCount?: number | null;
  athleteIds?: string[];
  athleteNames?: string[];
};

type EventItem = { id: string; name?: string | null };

type DriverItem = { id: string; userId?: string | null; fullName?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type AthleteItem = { id: string; fullName?: string | null; delegationId?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

type VenueItem = { id: string; name?: string | null; address?: string | null; commune?: string | null };

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string }> = {
  EN_ROUTE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.14)",  chipBorder: "rgba(16,185,129,0.3)"  },
  PICKED_UP:  { accent: "#22d3ee", chipBg: "rgba(34,211,238,0.14)",  chipBorder: "rgba(34,211,238,0.3)"  },
  SCHEDULED:  { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)"  },
  COMPLETED:  { accent: "#64748b", chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)" },
  DROPPED_OFF:{ accent: "#14b8a6", chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)"  },
};

const STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "En ruta a recoger", PICKED_UP: "En curso", SCHEDULED: "Programado",
  COMPLETED: "Completado", DROPPED_OFF: "Dejado en hotel",
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

const statusLabel: Record<string, string> = {
  EN_ROUTE: "En ruta a recoger",
  SCHEDULED: "Programado",
  PICKED_UP: "Recogido",
  DROPPED_OFF: "Dejado en hotel",
  COMPLETED: "Completado"
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
  IDA_VUELTA: "Viaje Ida-Vuelta"
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "-";

const formatTripType = (value?: string | null) => {
  if (!value) return "-";
  return tripTypeLabels[value] ?? value;
};

export default function VehiclePositionsPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [positions, setPositions] = useState<Record<string, StoredPosition>>({});
  // Per-driver breadcrumb trail of where they've actually been since the
  // admin opened the page. Capped per driver so a long session doesn't
  // bloat memory; drivers that drop off the map get their trail cleared
  // alongside their position entry.
  const [trails, setTrails] = useState<Record<string, { lat: number; lng: number }[]>>({});
  // Same path but rewritten by Google's Roads API so the line follows
  // streets instead of jumping between houses from GPS jitter. Falls
  // back to the raw trail when the snap call fails or the key isn't set.
  const [snappedTrails, setSnappedTrails] = useState<Record<string, LatLng[]>>({});
  const TRAIL_LIMIT = 200;
  // Minimum movement (in degrees, ~3m at the equator) to append a new
  // point to the trail. Filters out GPS jitter while parked so the line
  // doesn't look like a static blob.
  const TRAIL_MIN_DELTA = 0.00003;
  // Drives recomputation of the recency window (`connectedDrivers`, "Con GPS")
  // even when no fresh positions arrive — otherwise a driver that stops
  // pushing would stay on the live tab forever.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [completedAlerts, setCompletedAlerts] = useState<Array<{ tripId: string; driverName: string; destination: string; ts: Date }>>([]);
  const [activeView, setActiveView] = useState<"live" | "table">("live");
  const [destinationCoords, setDestinationCoords] = useState<Record<string, LatLng>>({});
  const [tripRoutes, setTripRoutes] = useState<Record<string, LatLng[]>>({});
  const [tripRouteMeta, setTripRouteMeta] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
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
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData, positionData, venueData, participantData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<PositionItem[]>("/vehicle-positions"),
          apiFetch<VenueItem[]>("/venues"),
          apiFetch<Record<string, any>[]>("/provider-participants")
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
      (participantData || []).forEach((p) => {
        if (!driverMap[p.id]) {
          driverMap[p.id] = { id: p.id, fullName: p.fullName || p.id, userId: null, vehicleId: null } as any;
        }
      });
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
    const tickTimer = setInterval(() => setNowTick(Date.now()), 1000);

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
      const next: Record<string, { lat: number; lng: number }[]> = {};
      for (const [driverId, pos] of Object.entries(positions)) {
        const existing = prev[driverId] ?? [];
        const last = existing[existing.length - 1];
        const moved =
          !last ||
          Math.abs(last.lat - pos.lat) > TRAIL_MIN_DELTA ||
          Math.abs(last.lng - pos.lng) > TRAIL_MIN_DELTA;
        if (moved) {
          const appended = [...existing, { lat: pos.lat, lng: pos.lng }];
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
      for (const [driverId, raw] of Object.entries(trails)) {
        if (cancelled) return;
        if (raw.length < 2) continue;
        const prevLen = lastSnappedLengthRef.current[driverId] ?? 0;
        if (raw.length === prevLen) continue;
        // Send the last 80 points (under the API's 100 cap) so we keep
        // the historical part stable but still extend the snapped line
        // as new fixes come in.
        const window = raw.slice(-80);
        const snapped = await snapToRoads(window);
        if (cancelled) return;
        if (snapped && snapped.length > 0) {
          setSnappedTrails((prev) => ({ ...prev, [driverId]: snapped }));
          lastSnappedLengthRef.current[driverId] = raw.length;
        }
      }
    };
    void snap();
    const timer = setInterval(snap, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [trails]);

  const activeTripsForRoutes = useMemo(
    () => trips.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")),
    [trips],
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

  const orderedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [trips]);

  const activeTrips = useMemo(
    () => trips.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")),
    [trips]
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
    const onlineCutoff = nowTick - 15 * 1000;
    const staleCutoff = nowTick - 5 * 60 * 1000;
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

  // Only the online slice — used for "Con GPS" KPI and the live count chip.
  const connectedDrivers = useMemo(
    () => trackedDrivers.filter((d) => d.online),
    [trackedDrivers],
  );

  // Build the per-driver breadcrumb trails to render under the markers.
  // We use the active trip id when there is one (so the polyline keys
  // match the markers), otherwise the synthetic `driver-${id}` key.
  const liveTrails = useMemo<TrailPath[]>(() => {
    return trackedDrivers
      .map(({ driver, online }) => {
        // Prefer the snapped version when we have one — it follows the
        // actual streets. Fall back to the raw trail until Roads API
        // catches up on the first cycle.
        const snapped = snappedTrails[driver.id];
        const raw = trails[driver.id];
        const path = snapped && snapped.length >= 2 ? snapped : raw;
        if (!path || path.length < 2) return null;
        const trip = activeTrips.find((t) => t.driverId === driver.id);
        const tripId = trip?.id ?? `driver-${driver.id}`;
        // Trail color follows the marker so the visual story stays
        // consistent: green while connected, red while in the no-signal state.
        const accent = online ? "#10b981" : "#ef4444";
        return { tripId, path, accent } satisfies TrailPath;
      })
      .filter((t): t is TrailPath => t !== null);
  }, [trackedDrivers, trails, snappedTrails, activeTrips]);

  const trackedMarkers = useMemo<TrackingMarker[]>(() => {
    return trackedDrivers.map(({ driver, position, online }) => {
      const trip = activeTrips.find((t) => t.driverId === driver.id);
      // Connection status drives the marker color: green when actively
      // receiving GPS, red when we haven't heard from the driver in >15s.
      // This wins over the trip status color so a disconnection is obvious.
      const accent = online ? "#10b981" : "#ef4444";
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
  }, [trackedDrivers, activeTrips, vehicles, venues]);

  const tripStats = useMemo(() => {
    const active = trips.filter((tr) => ["EN_ROUTE", "PICKED_UP"].includes(tr.status ?? "")).length;
    const scheduled = trips.filter((tr) => tr.status === "SCHEDULED").length;
    const completed = trips.filter((tr) => ["COMPLETED", "DROPPED_OFF"].includes(tr.status ?? "")).length;
    // Only count drivers with a FRESH GPS fix (last 30 s) — historical rows
    // in vehicle_positions would otherwise mark every old driver as "Con GPS",
    // and a driver who disabled GPS mid-trip would still show as live.
    // "Con GPS" = any driver whose last fix is within the live recency
    // window, regardless of trip state. A driver can be transmitting
    // before/after a trip and still deserves to be counted.
    const withPosition = connectedDrivers.length;
    return { active, scheduled, completed, withPosition, total: trips.length };
  }, [trips, connectedDrivers]);

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

  // Brand palette — matches app light design system
  const pal = {
    panelBg: "#ffffff",
    panelBorder: "1px solid #e2e8f0",
    panelShadow: "0 1px 4px rgba(15,23,42,0.06)",
    orb1: "rgba(33,208,179,0.07)", orb2: "rgba(31,205,255,0.05)",
    accent: "#21D0B3",
    titleColor: "#0f172a",
    subtitleColor: "#64748b",
    chipBg: "#f8fafc", chipBorder: "#e2e8f0", chipLabel: "#64748b",
    btnBg: "#ffffff", btnBorder: "#e2e8f0", btnColor: "#475569",
    kpi: ["#21D0B3", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"],
  };

  return (
    <div className="space-y-6">
      {/* ── Command Panel */}
      <section style={{
        background: pal.panelBg,
        border: pal.panelBorder,
        borderRadius: "20px",
        padding: "24px 28px",
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
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
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
            <span style={{ fontSize: "14px" }}>↻</span>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>

        {/* KPI chips */}
        <div className="flex flex-wrap gap-3 mt-5" style={{ position: "relative" }}>
          {[
            { label: "Total viajes", value: tripStats.total, color: pal.kpi[0], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { label: "En ruta", value: tripStats.active, color: pal.kpi[1], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { label: "Programados", value: tripStats.scheduled, color: pal.kpi[2], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { label: "Completados", value: tripStats.completed, color: pal.kpi[3], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
            { label: "Con GPS", value: tripStats.withPosition, color: pal.kpi[4], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
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

        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── View tabs */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "6px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-2 grid-cols-2">
          {([
            { key: "live" as const, label: "Tracking en vivo", count: trackedDrivers.length },
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
                  background: selected ? "#21D0B3" : "transparent",
                  border: "none", transition: "all 150ms",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected ? "#ffffff" : "#0f172a" }}>{tab.label}</span>
                <span style={{
                  minWidth: "28px", borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  color: selected ? "#ffffff" : "#64748b",
                  border: selected ? "none" : "1px solid #e2e8f0",
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
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ color: "#10b981", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>
                        Viaje completado — {alert.driverName}
                      </p>
                      <p style={{ fontSize: "12px", color: "#64748b" }}>
                        Llegó a {alert.destination} · {alert.ts.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompletedAlerts((prev) => prev.filter((_, j) => j !== i))}
                    style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", alignItems: "start" }} className="xl:grid-cols-[1fr_340px] md:!grid-cols-1">

            {/* Map — always rendered, even when no drivers are connected. */}
            <div style={{
              borderRadius: "20px",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 8px rgba(15,23,42,0.08)",
              position: "relative",
            }}>
              <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 1000 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: "rgba(0,0,0,0.6)", borderRadius: "99px", padding: "5px 12px",
                  backdropFilter: "blur(6px)",
                }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: connectedDrivers.length > 0 ? "#10b981" : "#94a3b8", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em" }}>
                    {connectedDrivers.length} en línea · {trackedDrivers.length - connectedDrivers.length} sin señal · {liveRoutes.length} con ruta
                  </span>
                </span>
              </div>
              {trackedDrivers.length === 0 && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  zIndex: 999, background: "rgba(255,255,255,0.94)",
                  border: "1px solid #e2e8f0", borderRadius: "14px",
                  padding: "18px 22px", textAlign: "center" as const, maxWidth: "320px",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                }}>
                  <p style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>Sin conductores enviando GPS ahora</p>
                  <p style={{ fontSize: "12px", marginTop: "4px", color: "#64748b", lineHeight: 1.5 }}>
                    Cuando un conductor entre y prenda el GPS, va a aparecer en el mapa.
                  </p>
                </div>
              )}
              <LiveTrackingMap
                markers={trackedMarkers}
                destinations={liveDestinations}
                routes={liveRoutes}
                trails={liveTrails}
                height={560}
                isDark={false}
                selectedTripId={selectedTripId}
              />
            </div>

            {/* Sidebar — one card per tracked driver (online + offline). */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "580px", overflowY: "auto", paddingRight: "2px" }}>
              {trackedDrivers.length === 0 && (
                <div style={{
                  borderRadius: "14px", border: "1px dashed #cbd5e1", background: "#ffffff",
                  padding: "20px 16px", textAlign: "center" as const,
                  fontSize: "12px", color: "#64748b", lineHeight: 1.5,
                }}>
                  Esperando conductores. Al activar el GPS desde la app aparecerán aquí.
                </div>
              )}
              {trackedDrivers.map(({ driver, position, ageMs, online }) => {
                const trip = activeTripsForRoutes.find((t) => t.driverId === driver.id);
                const accent = online ? "#10b981" : "#ef4444";
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
                    background: selectedTripId === markerId ? "#f0fdfa" : "#ffffff",
                    border: selectedTripId === markerId ? "2px solid #14b8a6" : "1px solid #e2e8f0",
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
                        <p style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {driver.fullName || "Conductor"}
                        </p>
                        <p style={{ fontSize: "11px", color: "#64748b", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                        <span style={{ fontSize: "10px", color: "#64748b" }}>{ageLabel}</span>
                      </div>
                    </div>

                    {trip && (
                      <>
                        <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.2" strokeLinecap="round"><path d="M12 22s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z"/><circle cx="12" cy="11" r="2"/></svg>
                          <span>{trip.origin || "Origen"}</span>
                          <span style={{ color: "#cbd5e1" }}>→</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/></svg>
                          <span>{venue?.name || trip.destination || "Destino"}</span>
                        </div>
                        {routeMeta && (
                          <div style={{ marginTop: "6px", fontSize: "10px", color: "#0f766e", fontWeight: 600 }}>
                            Ruta: {routeMeta.distanceKm.toFixed(1)} km · ~{routeMeta.durationMin} min
                            {elapsedMin !== null ? ` · iniciado hace ${elapsedMin}m` : ""}
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ marginTop: "6px", fontSize: "10px", color: "#94a3b8" }}>
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
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>{t("Todos los viajes")}</h2>
          {orderedTrips.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#64748b" }}>{t("Sin viajes registrados.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Viaje")}</th>
                    <th>{t("Evento")}</th>
                    <th>{t("Conductor")}</th>
                    <th>{t("Vehículo")}</th>
                    <th>{t("Mapa")}</th>
                    <th>{t("Tipo")}</th>
                    <th>{t("Cliente")}</th>
                    <th>{t("Origen")}</th>
                    <th>{t("Destino")}</th>
                    <th>{t("Delegación")}</th>
                    <th>{t("Participantes")}</th>
                    <th>{t("Programación")}</th>
                    <th>{t("Inicio")}</th>
                    <th>{t("Cierre")}</th>
                    <th>{t("Estado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedTrips.map((trip) => {
                    const event = trip.eventId ? events[trip.eventId] : null;
                    const driver = drivers[trip.driverId];
                    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                    const position = positions[trip.driverId] || (trip.vehicleId ? positions[trip.vehicleId] : null);
                    return (
                      <tr key={trip.id}>
                        <td>{trip.id}</td>
                        <td>{event?.name || trip.eventId || "-"}</td>
                        <td>{driver?.fullName || trip.driverId}</td>
                        <td>
                          {vehicle?.plate || trip.vehicleId}
                          {vehicle?.type ? ` (${vehicle.type})` : ""}
                          {vehicle?.brand || vehicle?.model
                            ? ` · ${[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}`
                            : ""}
                        </td>
                        <td>
                          {position ? (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                className="w-56 h-36 rounded-2xl overflow-hidden transition"
                                style={{ border: "1px solid var(--border)" }}
                                onClick={() =>
                                  setMapPreview({ lat: position.lat, lng: position.lng, title: vehicle?.plate || trip.vehicleId })
                                }
                              >
                                <iframe
                                  title={`map-${trip.id}`}
                                  src={buildMapEmbed(position.lat, position.lng)}
                                  className="w-full h-full"
                                  loading="lazy"
                                />
                              </button>
                              <a
                                className="text-xs font-semibold hover:underline"
                                style={{ color: "var(--brand)" }}
                                href={buildGoogleMapsLink(position.lat, position.lng)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("Ver en Google Maps")}
                              </a>
                            </div>
                          ) : "-"}
                        </td>
                        <td>{formatTripType(trip.tripType)}</td>
                        <td>{trip.clientType || "-"}</td>
                        <td>{trip.origin || "-"}</td>
                        <td>{trip.destination || "-"}</td>
                        <td>{resolveDelegations(trip)}</td>
                        <td>{resolveAthletes(trip)}</td>
                        <td>{formatDate(trip.scheduledAt)}</td>
                        <td>{formatDate(trip.startedAt)}</td>
                        <td>{formatDate(trip.completedAt)}</td>
                        <td>{statusLabel[trip.status || "SCHEDULED"] || trip.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {mapPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", padding: "16px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#ffffff", width: "100%", maxWidth: "900px", borderRadius: "20px", padding: "20px", boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#21D0B3" }}>{t("Tracking de viajes")}</p>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>{mapPreview.title}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <a
                  href={buildGoogleMapsLink(mapPreview.lat, mapPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#475569", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Ver en Google Maps")}
                </a>
                <button
                  type="button"
                  onClick={() => setMapPreview(null)}
                  style={{ padding: "8px 16px", borderRadius: "10px", border: "none", background: "#21D0B3", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
            <div style={{ aspectRatio: "16/9", width: "100%", overflow: "hidden", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <iframe title="map-preview" src={buildMapEmbed(mapPreview.lat, mapPreview.lng)} style={{ width: "100%", height: "100%" }} loading="lazy" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


