
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ResourceScreen from "@/components/ResourceScreen";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";
import { CLIENT_TYPE_OPTIONS, clientTypeLabel } from "@/lib/clientTypes";

// ── Trip bulk import ─────────────────────────────────────────────────────────
const TRIP_IMPORT_HEADERS = [
  "event_id", "origin", "destination",
  "scheduled_date", "scheduled_time",
  "vehicle_type", "passenger_count",
  "trip_type", "client_type", "notes",
] as const;

type TripImportRow = Record<typeof TRIP_IMPORT_HEADERS[number], string>;

const normalizeImportHeader = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "_");

const excelEpochMs = Date.UTC(1899, 11, 30);
const pad2 = (n: number) => String(n).padStart(2, "0");

const excelSerialToIso = (serial: unknown): string | null => {
  const n = typeof serial === "number" ? serial : Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(excelEpochMs + Math.floor(n) * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

const toIsoDate = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? (Number(slash[3]) >= 70 ? 1900 + Number(slash[3]) : 2000 + Number(slash[3])) : Number(slash[3]);
    return `${year}-${pad2(Number(slash[2]))}-${pad2(Number(slash[1]))}`;
  }
  return excelSerialToIso(v);
};

const toIsoDateTime = (dateVal: unknown, timeVal: unknown): string | null => {
  const dateOnly = toIsoDate(dateVal);
  if (!dateOnly) return null;
  const t = String(timeVal ?? "").trim();
  if (!t) return `${dateOnly}T00:00:00.000Z`;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return new Date(`${dateOnly}T${pad2(Number(m[1]))}:${pad2(Number(m[2]))}:00`).toISOString();
  // Excel time serial
  const n = typeof timeVal === "number" ? timeVal : Number(timeVal);
  if (Number.isFinite(n)) {
    const mins = Math.round((n >= 1 ? n - Math.floor(n) : n) * 1440);
    return new Date(`${dateOnly}T${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}:00`).toISOString();
  }
  return `${dateOnly}T00:00:00.000Z`;
};

const parseTripSheet = (file: File): Promise<TripImportRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: "array", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
        const rows = rawRows.map((raw) => {
          const norm: Record<string, string> = {};
          Object.entries(raw).forEach(([k, v]) => { norm[normalizeImportHeader(k)] = String(v ?? "").trim(); });
          return norm as TripImportRow;
        });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const downloadTripTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([[...TRIP_IMPORT_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");
  XLSX.writeFile(wb, "plantilla_viajes.xlsx");
};

type Trip = {
  id: string;
  eventId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  vehiclePlate?: string | null;
  requesterAthleteId?: string | null;
  destinationVenueId?: string | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  notes?: string | null;
  requestedAt?: string | null;
  origin?: string | null;
  destination?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  updatedAt?: string | null;
  isRoundTrip?: boolean;
  parentTripId?: string | null;
  legType?: string | null;
  childTrips?: Trip[];
  metadata?: Record<string, unknown> | null;
};

type EventItem = { id: string; name?: string | null };
type AthleteItem = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
  eventId?: string | null;
};
type DelegationItem = {
  id: string;
  countryCode?: string | null;
  name?: string | null;
  eventId?: string | null;
};
type DriverItem = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  vehicleId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** true = conductor de la Flota propia (VIP/T1); se descarta en Viajes. */
  isFleet?: boolean;
};

type ParticipantItem = {
  id: string;
  fullName?: string | null;
  full_name?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
};
type VehicleItem = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};
type VenueItem = {
  id: string;
  name?: string | null;
  address?: string | null;
  commune?: string | null;
  region?: string | null;
};

type StatusTone = {
  label: string;
  chip: string;
  panel: string;
};

const STATUS_TONES: Record<string, StatusTone> = {
  REQUESTED: { label: "Solicitado", chip: "", panel: "" },
  SCHEDULED: { label: "Programado", chip: "", panel: "" },
  ASSIGNED: { label: "Asignado", chip: "", panel: "" },
  EN_ROUTE: { label: "En ruta al punto de encuentro", chip: "", panel: "" },
  PICKED_UP: { label: "En curso", chip: "", panel: "" },
  DROPPED_OFF: { label: "Dejado en hotel", chip: "", panel: "" },
  COMPLETED: { label: "Completado", chip: "", panel: "" },
  CANCELLED: { label: "Cancelado", chip: "", panel: "" },
};

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string; pulse: boolean }> = {
  REQUESTED:  { accent: "#f59e0b", chipBg: "rgba(245,158,11,0.12)",  chipBorder: "rgba(245,158,11,0.3)",  pulse: false },
  SCHEDULED:  { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)",  pulse: false },
  ASSIGNED:   { accent: "#eab308", chipBg: "rgba(234,179,8,0.12)",   chipBorder: "rgba(234,179,8,0.3)",   pulse: false },
  EN_ROUTE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  PICKED_UP:  { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  DROPPED_OFF:{ accent: "#14b8a6", chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)",  pulse: false },
  COMPLETED:  { accent: "#64748b", chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)", pulse: false },
  CANCELLED:  { accent: "#ef4444", chipBg: "rgba(239,68,68,0.1)",    chipBorder: "rgba(239,68,68,0.25)",  pulse: false },
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  SEDAN: "Sedán",
  AUTO: "Sedán",
  SUV: "SUV",
  VAN_10: "Van 10",
  VAN_15: "Van 15-17",
  VAN_19: "Van 19",
  VAN: "Van",
  MINIBUS: "Minibus",
  MINI_BUS: "Minibus",
  BUS: "Bus",
};

const PORTAL_CLIENT_TYPES = new Set(["VIP", "T1"]);

/**
 * Clasifica el origen de un viaje en uno de 3 buckets de operación:
 *  - PORTAL: solicitudes desde el portal de clientes (VIP/T1)
 *  - DAILY:  cargados desde la operatividad diaria (Excel/CSV) — traen fleetAcronym
 *  - MANUAL: creados a mano por un operador del comité
 */
type TripSource = "PORTAL" | "DAILY" | "MANUAL";
const classifyTripSource = (t: {
  tripType?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}): TripSource => {
  if (t.tripType === "PORTAL_REQUEST") return "PORTAL";
  // El portal VIP crea viajes como VIAJE_IDA / VIAJE_IDA_REGRESO pero siempre
  // marca la nota con el prefijo "[Portal]".
  if ((t.notes || "").startsWith("[Portal]")) return "PORTAL";
  const fleet = (t.metadata as any)?.fleet_acronym ?? (t as any).fleetAcronym;
  if (fleet) return "DAILY";
  return "MANUAL";
};

/** Solicitudes VIP/T1 hechas desde el portal: viven en su propia pestaña. */
const isPortalVipTrip = (t: {
  tripType?: string | null;
  notes?: string | null;
  clientType?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean =>
  classifyTripSource(t) === "PORTAL" && PORTAL_CLIENT_TYPES.has(t.clientType || "");

const SOURCE_META: Record<TripSource | "", { label: string; color: string; bg: string; border: string; icon: string }> = {
  "": { label: "Todos", color: "#0f172a", bg: "#fff", border: "#e2e8f0", icon: "✦" },
  PORTAL: { label: "VIP / T1", color: "#7c3aed", bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.35)", icon: "♕" },
  DAILY: { label: "Operatividad Diaria", color: "#0ea5c8", bg: "rgba(14,165,200,0.10)", border: "rgba(14,165,200,0.35)", icon: "📋" },
  MANUAL: { label: "Gestión Manual", color: "#21D0B3", bg: "rgba(33,208,179,0.10)", border: "rgba(33,208,179,0.35)", icon: "✋" },
};

const STATUS_FLOW = ["REQUESTED", "SCHEDULED", "ASSIGNED", "EN_ROUTE", "PICKED_UP", "COMPLETED"] as const;

// Estados en los que un viaje sigue "vivo" y por tanto puede cancelarse.
const CANCELLABLE_STATUSES = new Set(["REQUESTED", "SCHEDULED", "ASSIGNED", "EN_ROUTE", "PICKED_UP"]);

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "-";

const formatClock = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";

const safeText = (value?: string | null, fallback = "-") => {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
};

const buildVenueAddress = (venue?: VenueItem | null) => {
  if (!venue) return "-";
  return [venue.address, venue.commune, venue.region].filter(Boolean).join(" · ") || venue.name || "-";
};

const relativeMinutes = (value?: string | null) => {
  if (!value) return null;
  return Math.round((new Date(value).getTime() - Date.now()) / 60000);
};

export default function TripsPage() {
  const { t } = useI18n();

  const pal = {
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(15,23,42,0.06)",
    textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
    kpi: ["#f59e0b", "#3b82f6", "#6366f1", "#10b981", "#94a3b8"],
    filterBg: "#ffffff", filterBorder: "#e2e8f0",
    btnBorder: "#e2e8f0", btnColor: "#475569",
  };

  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedClientType, setSelectedClientType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshRequestIds, setFreshRequestIds] = useState<string[]>([]);
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<"dispatch" | "active" | "history" | "portal" | "editor" | "import">("dispatch");
  // Filtro primario por ORIGEN — el principal eje de organización
  const [tripSource, setTripSource] = useState<"" | "PORTAL" | "DAILY" | "MANUAL">("");
  // Filtro por conductor (solicitado)
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // Si el usuario aterriza en una tab obsoleta (portal/editor) la mando a dispatch
  useEffect(() => {
    if (activeTab === "portal") {
      setActiveTab("dispatch");
      setTripSource("PORTAL");
    } else if (activeTab === "editor") {
      setActiveTab("dispatch");
      setTripSource("MANUAL");
      setShowAdminEditor(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bulk import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<TripImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File | null) => {
    setImportResult(null);
    setImportErrors([]);
    if (!file) { setImportFile(null); setImportRows([]); return; }
    setImportFile(file);
    try {
      const rows = await parseTripSheet(file);
      setImportRows(rows);
    } catch {
      setImportErrors(["No se pudo leer el archivo. Asegúrate de que sea un Excel válido."]);
      setImportRows([]);
    }
  };

  const runImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportErrors([]);
    setImportResult(null);
    let ok = 0;
    const errs: string[] = [];
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const eventId = row.event_id || (eventOptions[0]?.id ?? "");
      if (!eventId) { errs.push(`Fila ${i + 2}: falta event_id`); continue; }
      const scheduledAt = toIsoDateTime(row.scheduled_date, row.scheduled_time);
      const body: Record<string, unknown> = {
        eventId,
        origin: row.origin || undefined,
        destination: row.destination || undefined,
        requestedVehicleType: row.vehicle_type || undefined,
        passengerCount: row.passenger_count ? Number(row.passenger_count) : undefined,
        tripType: row.trip_type || undefined,
        clientType: row.client_type || undefined,
        notes: row.notes || undefined,
        scheduledAt: scheduledAt ?? undefined,
        status: "SCHEDULED",
      };
      try {
        await apiFetch("/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        ok++;
      } catch (e) {
        errs.push(`Fila ${i + 2}: ${e instanceof Error ? e.message : "Error al crear"}`);
      }
    }
    setImportResult(`${ok} viaje(s) creado(s)${errs.length ? `, ${errs.length} error(es)` : ""}.`);
    setImportErrors(errs);
    setImporting(false);
    if (ok > 0) { setImportFile(null); setImportRows([]); await loadData(true); }
  };
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [logTrip, setLogTrip] = useState<Trip | null>(null);
  // Popup de solo lectura al pinchar una tarjeta del timeline operativo
  // (la edición queda como acción explícita dentro del popup).
  const [infoTrip, setInfoTrip] = useState<Trip | null>(null);
  const [pendingAction, setPendingAction] = useState<{ trip: Trip; kind: "cancel" | "delete" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const knownRequestedIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, athleteData, delegationData, driverData, vehicleData, venueData, participantData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<VenueItem[]>("/venues"),
          apiFetch<ParticipantItem[]>("/provider-participants").catch(() => [] as ParticipantItem[])
        ]);

      const nextTrips = tripData || [];
      const nextRequestedIds = new Set(
        nextTrips.filter((trip) => trip.status === "REQUESTED").map((trip) => trip.id)
      );

      if (knownRequestedIdsRef.current.size > 0) {
        const newIds = Array.from(nextRequestedIds).filter((id) => !knownRequestedIdsRef.current.has(id));
        setFreshRequestIds(newIds);
      }
      knownRequestedIdsRef.current = nextRequestedIds;

      setTrips(nextTrips);
      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setAthletes(
        (filterValidatedAthletes(athleteData || [])).reduce<Record<string, AthleteItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setDelegations(
        (delegationData || []).reduce<Record<string, DelegationItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      // La tabla `drivers` es la Flota propia (VIP/T1): se mantiene en el mapa
      // solo para resolver nombres de viajes históricos, pero se descarta del
      // selector de conductor. Los choferes operativos de Viajes son los
      // participantes de proveedor marcados como conductores.
      const driversMap = (driverData || []).reduce<Record<string, DriverItem>>((acc, item) => {
        const fleetDriver = { ...item, isFleet: true };
        acc[item.id] = fleetDriver;
        if (item.userId) acc[item.userId] = fleetDriver;
        return acc;
      }, {});
      (participantData || []).forEach((p) => {
        const meta = (p.metadata ?? {}) as Record<string, unknown>;
        if (meta.isDriver !== true && meta.isDriver !== "true") return;
        driversMap[p.id] = {
          id: p.id,
          fullName: p.fullName ?? p.full_name ?? null,
          phone: p.phone ?? null,
          metadata: p.metadata ?? null,
          isFleet: false,
        };
      });
      setDrivers(driversMap);
      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setVenues(
        (venueData || []).reduce<Record<string, VenueItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );

      if (!selectedEventId && eventData && eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Cancela (status → CANCELLED, queda en bitácora) o elimina definitivamente el
  // viaje seleccionado. Al eliminar un viaje de ida y vuelta se borra primero el
  // tramo de regreso para no dejar registros huérfanos.
  const runPendingAction = async () => {
    if (!pendingAction || actionBusy) return;
    const { trip, kind } = pendingAction;
    setActionBusy(true);
    setError(null);
    try {
      if (kind === "cancel") {
        await apiFetch(`/trips/${trip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "CANCELLED",
            metadata: {
              log: [{ action: "CANCELLED", by: "Operador", at: new Date().toISOString() }],
            },
          }),
        });
      } else {
        for (const child of trip.childTrips ?? []) {
          await apiFetch(`/trips/${child.id}`, { method: "DELETE" });
        }
        await apiFetch(`/trips/${trip.id}`, { method: "DELETE" });
      }
      setPendingAction(null);
      await loadData(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : kind === "cancel"
            ? "No se pudo cancelar el viaje."
            : "No se pudo eliminar el viaje.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      await loadData(true);
      if (!mounted) return;
      pollTimerRef.current = setTimeout(poll, 8000);
    };

    loadData();
    pollTimerRef.current = setTimeout(poll, 8000);

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (freshRequestIds.length === 0) return;
    const timer = setTimeout(() => setFreshRequestIds([]), 20000);
    return () => clearTimeout(timer);
  }, [freshRequestIds]);

  const eventOptions = useMemo(() => Object.values(events), [events]);

  const filteredTrips = useMemo(() => {
    const term = search.trim().toLowerCase();
    return trips
      .filter((trip) => !selectedEventId || trip.eventId === selectedEventId)
      .filter((trip) => !selectedClientType || trip.clientType === selectedClientType)
      .filter((trip) => !tripSource || classifyTripSource(trip) === tripSource)
      .filter((trip) => !selectedDriverId || trip.driverId === selectedDriverId)
      .filter((trip) => {
        if (!term) return true;
        const requester = trip.requesterAthleteId ? athletes[trip.requesterAthleteId]?.fullName : "";
        const delegation = trip.requesterAthleteId
          ? delegations[athletes[trip.requesterAthleteId]?.delegationId || ""]?.countryCode
          : "";
        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId]?.name : "";
        const driver = trip.driverId ? drivers[trip.driverId]?.fullName : "";
        const vehicle = trip.vehicleId ? vehicles[trip.vehicleId]?.plate : "";
        return [
          trip.id,
          trip.origin,
          trip.destination,
          trip.notes,
          requester,
          delegation,
          venue,
          driver,
          vehicle
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const aTime = new Date(a.requestedAt || a.updatedAt || a.scheduledAt || 0).getTime();
        const bTime = new Date(b.requestedAt || b.updatedAt || b.scheduledAt || 0).getTime();
        return bTime - aTime;
      });
  }, [athletes, delegations, drivers, search, selectedClientType, selectedEventId, trips, vehicles, venues, tripSource, selectedDriverId]);

  // Las solicitudes VIP/T1 del portal se gestionan sólo en su pestaña dedicada;
  // fuera de ella contaminaban el despacho y el historial general.
  const generalTrips = useMemo(
    () => filteredTrips.filter((trip) => !isPortalVipTrip(trip)),
    [filteredTrips]
  );

  const incomingRequests = useMemo(
    () => generalTrips.filter((trip) => trip.status === "REQUESTED"),
    [generalTrips]
  );

  const scheduledQueue = useMemo(
    // ASSIGNED = con conductor asignado (auto-asignación de Operatividad Diaria);
    // sin él, esos viajes no caían en ningún grupo y desaparecían de la vista.
    () => generalTrips.filter((trip) => trip.status === "SCHEDULED" || trip.status === "ASSIGNED"),
    [generalTrips]
  );

  // ── Despacho: la vista se organiza por lo operativo (¿tiene chofer?) y no
  //    por el estado interno. Un viaje "Programado" sin conductor sigue siendo
  //    trabajo pendiente; uno con conductor está cubierto y listo para salir.
  const pendingAssignment = useMemo(
    () =>
      generalTrips
        .filter((trip) => ["REQUESTED", "SCHEDULED", "ASSIGNED"].includes(trip.status || "") && !trip.driverId)
        .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()),
    [generalTrips]
  );

  const readyToGo = useMemo(
    () =>
      generalTrips
        .filter((trip) => ["SCHEDULED", "ASSIGNED"].includes(trip.status || "") && !!trip.driverId)
        .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()),
    [generalTrips]
  );

  const activeTrips = useMemo(
    () => generalTrips.filter((trip) => trip.status === "EN_ROUTE" || trip.status === "PICKED_UP"),
    [generalTrips]
  );

  const completedTrips = useMemo(
    () =>
      generalTrips
        .filter((trip) => trip.status === "DROPPED_OFF" || trip.status === "COMPLETED" || trip.status === "CANCELLED"),
    [generalTrips]
  );
  const portalVipTrips = useMemo(
    () => filteredTrips.filter(isPortalVipTrip),
    [filteredTrips]
  );

  // Conteos por origen (sobre el universo SIN filtro de origen, para mostrar siempre el total real)
  const sourceCounts = useMemo(() => {
    const base = trips
      .filter((trip) => !selectedEventId || trip.eventId === selectedEventId)
      .filter((trip) => !selectedClientType || trip.clientType === selectedClientType)
      .filter((trip) => !selectedDriverId || trip.driverId === selectedDriverId);
    return {
      ALL: base.length,
      PORTAL: base.filter((t) => classifyTripSource(t) === "PORTAL").length,
      DAILY: base.filter((t) => classifyTripSource(t) === "DAILY").length,
      MANUAL: base.filter((t) => classifyTripSource(t) === "MANUAL").length,
    };
  }, [trips, selectedEventId, selectedClientType, selectedDriverId]);

  const driverOptions = useMemo(
    () => {
      // En Viajes se descartan los conductores de Flota (exclusivos VIP/T1).
      const unique = new Map<string, DriverItem>();
      Object.values(drivers).forEach((d) => {
        if (d.isFleet) return;
        unique.set(d.id, d);
      });
      return Array.from(unique.values()).sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    },
    [drivers],
  );

  const kpis = useMemo(() => {
    const totalPassengers = filteredTrips.reduce((acc, trip) => acc + (trip.passengerCount || 0), 0);
    const portalTrips = filteredTrips.filter((trip) => trip.tripType === "PORTAL_REQUEST").length;
    return {
      requested: incomingRequests.length,
      scheduled: scheduledQueue.length,
      active: activeTrips.length,
      completed: completedTrips.length,
      passengers: totalPassengers,
      portalTrips
    };
  }, [activeTrips.length, completedTrips.length, filteredTrips, incomingRequests.length, scheduledQueue.length]);

  const resolveRequester = (trip: Trip) => {
    const athlete = trip.requesterAthleteId ? athletes[trip.requesterAthleteId] : null;
    if (athlete?.fullName) return athlete.fullName;
    if (trip.athleteNames && trip.athleteNames[0]) return trip.athleteNames[0];
    // Viajes de planilla o manuales sin solicitante individual: se identifican
    // por el tipo de cliente en vez de un genérico "Sin solicitante".
    if (trip.clientType) return t(clientTypeLabel(trip.clientType));
    return t("Sin solicitante");
  };

  const resolveDelegation = (trip: Trip) => {
    const athlete = trip.requesterAthleteId ? athletes[trip.requesterAthleteId] : null;
    if (athlete?.delegationId) {
      const delegation = delegations[athlete.delegationId];
      return delegation?.countryCode || delegation?.name || athlete.delegationId;
    }

    const athleteDelegations = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(athleteDelegations)).map((delegationId) => {
      const delegation = delegations[delegationId];
      return delegation?.countryCode || delegation?.name || delegationId;
    });

    return unique.length > 0 ? unique.join(", ") : "-";
  };

  const resolveVehicle = (trip: Trip) => {
    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
    if (vehicle) {
      return [vehicle.plate, [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.type]
        .filter(Boolean)
        .join(" · ");
    }
    if (trip.vehiclePlate) return trip.vehiclePlate;
    // Try to get vehicle info from driver
    const driver = trip.driverId ? drivers[trip.driverId] : null;
    if (driver?.vehicleId) {
      const v = vehicles[driver.vehicleId];
      if (v) return [v.plate, [v.brand, v.model].filter(Boolean).join(" ") || v.type].filter(Boolean).join(" · ");
    }
    const meta = driver?.metadata as Record<string, unknown> | undefined;
    if (meta?.vehiclePatente) return String(meta.vehiclePatente);
    return t("Por asignar");
  };

  const resolveDriver = (trip: Trip) => {
    const driver = trip.driverId ? drivers[trip.driverId] : null;
    return driver?.fullName || t("Pendiente asignación");
  };

  // Bitácora: vuelve legibles los detalles que traen códigos crudos — UUIDs de
  // conductor/vehículo se resuelven a nombre/patente y los códigos internos de
  // estado y tipo de vehículo se traducen a su etiqueta.
  const humanizeLogDetail = (detail: string) => {
    const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
    let out = detail.replace(UUID_RE, (id) => {
      const driver = drivers[id];
      if (driver?.fullName) return driver.fullName;
      const vehicle = vehicles[id];
      if (vehicle?.plate) return vehicle.plate;
      return `registro #${id.slice(0, 6)}`;
    });
    Object.entries(STATUS_TONES).forEach(([code, tone]) => {
      out = out.replace(new RegExp(`\\b${code}\\b`, "g"), tone.label);
    });
    Object.entries(VEHICLE_TYPE_LABELS).forEach(([code, label]) => {
      out = out.replace(new RegExp(`\\b${code}\\b`, "g"), label);
    });
    return out;
  };

  const resolveRequestedVehicleType = (trip: Trip) =>
    VEHICLE_TYPE_LABELS[trip.requestedVehicleType || ""] || trip.requestedVehicleType || "-";

  const statusTone = (status?: string | null) => STATUS_TONES[status || ""] || STATUS_TONES.SCHEDULED;

  const summaryCards = [
    { label: t("Solicitudes en cola"), value: kpis.requested },
    { label: t("Programados"), value: kpis.scheduled },
    { label: t("Viajes activos"), value: kpis.active },
    { label: t("Personas movilizadas"), value: kpis.passengers },
    { label: t("Portal de solicitudes"), value: kpis.portalTrips }
  ];

  // Tabs simplificadas: solo el estado del viaje. El "origen" se controla con el selector superior.
  const tabs = [
    { key: "dispatch" as const, label: t("Despacho"), count: pendingAssignment.length },
    { key: "active" as const, label: t("Activos"), count: activeTrips.length },
    { key: "history" as const, label: t("Historial"), count: completedTrips.length },
    { key: "import" as const, label: t("Importación masiva"), count: 0 },
  ];

  const renderTripCard = (trip: Trip, emphasis: "request" | "dispatch" | "active") => {
    const tone = statusTone(trip.status);
    const sc = STATUS_COLORS[trip.status ?? "SCHEDULED"] ?? STATUS_COLORS.SCHEDULED;
    const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
    const etaMinutes = relativeMinutes(trip.scheduledAt);
    const isFresh = freshRequestIds.includes(trip.id);

    const chipStyle = {
      background: sc.chipBg,
      border: `1px solid ${sc.chipBorder}`,
      borderRadius: "99px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 700,
      color: sc.accent,
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
    };
    const infoChipStyle = {
      background: pal.cardBg,
      border: `1px solid ${pal.cardBorder}`,
      borderRadius: "14px",
      padding: "12px 14px",
    };

    const hasDriver = !!trip.driverId;

    return (
      <article
        key={trip.id}
        style={{
          background: hasDriver ? pal.cardBg : "#fffbeb",
          border: `1px solid ${hasDriver ? pal.cardBorder : "#fde68a"}`,
          borderLeft: `4px solid ${sc.accent}`,
          borderRadius: "20px",
          padding: "18px 20px",
          boxShadow: pal.shadow,
          outline: isFresh ? `2px solid #10b981` : "none",
          outlineOffset: "2px",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={chipStyle}>
                {sc.pulse && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: sc.accent, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                {t(tone.label)}
              </span>
              {trip.clientType && (
                <span style={{
                  background: PORTAL_CLIENT_TYPES.has(trip.clientType) ? "rgba(168,85,247,0.12)" : "rgba(100,116,139,0.1)",
                  border: `1px solid ${PORTAL_CLIENT_TYPES.has(trip.clientType) ? "rgba(168,85,247,0.3)" : "rgba(100,116,139,0.25)"}`,
                  borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700,
                  color: PORTAL_CLIENT_TYPES.has(trip.clientType) ? "#a855f7" : "#94a3b8",
                  display: "inline-flex", alignItems: "center",
                }}>
                  {t(clientTypeLabel(trip.clientType))}
                </span>
              )}
              {trip.tripType === "PORTAL_REQUEST" && (
                <span style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#60a5fa", display: "inline-flex", alignItems: "center" }}>
                  Portal
                </span>
              )}
              {trip.isRoundTrip && (
                <span style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#14b8a6", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Ida y vuelta
                </span>
              )}
              {isFresh && (
                <span style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#10b981", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                  Nueva entrada
                </span>
              )}
            </div>
            <h3 style={{ marginTop: "10px", fontWeight: 800, fontSize: "18px", color: pal.textPrimary }}>
              {venue?.name || trip.destination || "Solicitud sin destino"}
            </h3>
            <p style={{ marginTop: "3px", fontSize: "13px", color: pal.textMuted }}>
              {resolveRequestedVehicleType(trip)} · {resolveRequester(trip)} · {resolveDelegation(trip)}
            </p>
          </div>
          <div style={{ ...infoChipStyle, textAlign: "right", borderTop: `2px solid ${sc.accent}` }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>{t("Programación")}</p>
            <p style={{ marginTop: "4px", fontSize: "17px", fontWeight: 700, color: sc.accent }}>{formatClock(trip.scheduledAt)}</p>
            <p style={{ fontSize: "11px", color: pal.textMuted }}>{formatDateTime(trip.scheduledAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Origen", value: safeText(trip.origin), sub: null, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
            { label: "Sede destino", value: venue?.name || safeText(trip.destination), sub: venue ? buildVenueAddress(venue) : null, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
            { label: "Conductor / Vehículo", value: resolveDriver(trip), sub: resolveVehicle(trip), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { label: "Servicio", value: `${trip.passengerCount || 0} persona(s)`, sub: `Solicitado ${formatDateTime(trip.requestedAt)}${etaMinutes !== null ? ` · ${etaMinutes >= 0 ? `en ${etaMinutes} min` : `${Math.abs(etaMinutes)} min atrasado`}` : ""}`, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map((chip) => (
            <div key={chip.label} style={infoChipStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                {chip.icon}
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>{chip.label}</p>
              </div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{chip.value}</p>
              {chip.sub && <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "2px" }}>{chip.sub}</p>}
            </div>
          ))}
        </div>

        {trip.isRoundTrip && trip.childTrips && trip.childTrips.length > 0 && (
          <div className="mt-4" style={{ borderRadius: "16px", border: "1px solid rgba(20,184,166,0.25)", background: "rgba(20,184,166,0.04)", padding: "14px 16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "10px" }}>Tramo de regreso</p>
            {trip.childTrips.map((child) => {
              const childSc = STATUS_COLORS[child.status ?? "REQUESTED"] ?? STATUS_COLORS.REQUESTED;
              const childTone = statusTone(child.status);
              const childVenue = child.destinationVenueId ? venues[child.destinationVenueId] : null;
              return (
                <div key={child.id} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Estado regreso", value: t(childTone.label), icon: <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: childSc.accent, display: "inline-block" }} /> },
                    { label: "Programación regreso", value: formatDateTime(child.scheduledAt), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
                    { label: "Origen regreso", value: safeText(child.origin), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
                    { label: "Destino regreso", value: childVenue ? buildVenueAddress(childVenue) : safeText(child.destination), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
                    { label: "Conductor regreso", value: child.driverId ? (drivers[child.driverId]?.fullName || "Asignado") : t("Por asignar"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                    { label: "Vehículo regreso", value: child.vehicleId ? resolveVehicle(child) : t("Por asignar"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
                  ].map((chip) => (
                    <div key={chip.label} style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "14px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                        {chip.icon}
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>{chip.label}</p>
                      </div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{chip.value}</p>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="mt-2 flex gap-2">
              {trip.childTrips.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setShowAdminEditor(true);
                    setActiveTab("editor");
                    setSelectedTripId(child.id);
                  }}
                  style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#14b8a6", cursor: "pointer" }}
                >
                  Gestionar regreso
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          {trip.notes ? (
            <p
              style={{
                fontSize: "13px",
                color: "#78350f",
                maxWidth: "600px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderLeft: "4px solid #f59e0b",
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: 600,
              }}
            >
              <span style={{ fontWeight: 800, color: "#b45309" }}>⚠ Observación:</span>{" "}
              {safeText(trip.notes.replace(/^\[Portal\]\s*/, ""), "Sin observaciones operativas.")}
            </p>
          ) : (
            <p style={{ fontSize: "13px", color: pal.textMuted, maxWidth: "600px" }}>
              <span style={{ fontWeight: 700, color: pal.textPrimary }}>Observaciones:</span>{" "}
              Sin observaciones operativas.
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {(emphasis === "request" || emphasis === "dispatch") && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminEditor(true);
                  setActiveTab("editor");
                  setSelectedTripId(trip.id);
                  setTimeout(() => {
                    document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 120);
                }}
                style={{
                  background: hasDriver ? sc.chipBg : "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: hasDriver ? `1px solid ${sc.chipBorder}` : "none",
                  borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 700,
                  color: hasDriver ? sc.accent : "#fff",
                  boxShadow: hasDriver ? "none" : "0 2px 8px rgba(245,158,11,0.35)",
                  cursor: "pointer",
                }}
              >
                {hasDriver ? "Gestionar servicio" : "Asignar conductor"}
              </button>
            )}
            <button type="button" onClick={() => setLogTrip(trip)}
              style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: pal.textMuted, cursor: "pointer" }}>
              Ver bitácora
            </button>
            {CANCELLABLE_STATUSES.has(trip.status || "") && (
              <button type="button" onClick={() => setPendingAction({ trip, kind: "cancel" })}
                style={{ background: "#fff", border: "1px solid rgba(245,158,11,0.5)", borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#d97706", cursor: "pointer" }}>
                Cancelar
              </button>
            )}
            <button type="button" onClick={() => setPendingAction({ trip, kind: "delete" })}
              style={{ background: "#fff", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>
              Eliminar
            </button>
          </div>
        </div>
      </article>
    );
  };

  const confirmTrip = pendingAction?.trip ?? null;
  const confirmIsCancel = pendingAction?.kind === "cancel";
  const confirmMessage = !confirmTrip
    ? ""
    : confirmIsCancel
      ? `Se cancelará el viaje de ${resolveRequester(confirmTrip)}${confirmTrip.destination ? ` → ${confirmTrip.destination}` : ""}. El viaje queda registrado como cancelado en la bitácora y, si tiene conductor asignado, se le notificará. ¿Continuar?`
      : `Se eliminará definitivamente el viaje de ${resolveRequester(confirmTrip)}${(confirmTrip.childTrips?.length ?? 0) > 0 ? ", incluido su tramo de regreso," : ""} y no se podrá recuperar. ¿Eliminar?`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones"
        description="Gestión de viajes."
        action={
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#475569", background: "#ffffff", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Actualizando..." : "Refrescar ahora"}
          </button>
        }
      />


      {freshRequestIds.length > 0 && (
        <section style={{ borderRadius: "20px", border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.07)", padding: "16px 20px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ display: "inline-flex", width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#065f46" }}>
                  Entraron {freshRequestIds.length} solicitud(es) nuevas desde el portal.
                </p>
                <p style={{ fontSize: "13px", color: "#047857" }}>
                  La cola de despacho ya se actualizó y queda lista para asignación.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFreshRequestIds([])}
              style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: "1px solid rgba(16,185,129,0.35)", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#10b981", background: "#ffffff", cursor: "pointer" }}
            >
              Marcar visto
            </button>
          </div>
        </section>
      )}
      {/* ── KPIs: una sola fila horizontal (sin layout mixto) */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((card, i) => (
          <article key={card.label} style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: `3px solid ${pal.kpi[i]}`,
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
          }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b", lineHeight: 1.2 }}>
                {card.label}
              </span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pal.kpi[i], boxShadow: `0 0 5px ${pal.kpi[i]}88`, flexShrink: 0 }} />
            </div>
            <p style={{ fontSize: "1.85rem", fontWeight: 800, color: pal.kpi[i], lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : card.value}
            </p>
          </article>
        ))}
      </section>

      {/* ── Filtros: una sola card con grid horizontal */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm block">
            <span className="block mb-1">{t("Evento")}</span>
            <select className="input" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
              <option value="">{t("Todos los eventos")}</option>
              {eventOptions.map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>{eventItem.name || eventItem.id}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">{t("Tipo de cliente")}</span>
            <select className="input" value={selectedClientType} onChange={(event) => setSelectedClientType(event.target.value)}>
              <option value="">{t("Todos los clientes")}</option>
              {CLIENT_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{t(label)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">{t("Conductor")}</span>
            <select className="input" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
              <option value="">{t("Todos los conductores")}</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.fullName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">{t("Buscar")}</span>
            <input className="input" placeholder={t("Solicitante, sede, patente…")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── NAVEGACIÓN PRIMARIA: ORIGEN DEL VIAJE ──
          Segmented control en estilo light, consistente con el resto del admin. */}
      <section
        className="surface rounded-2xl p-3"
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        <p style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "#64748b",
          padding: "0 6px 8px",
        }}>
          Origen del viaje
        </p>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {(["", "PORTAL", "DAILY", "MANUAL"] as const).map((src) => {
            const meta = SOURCE_META[src];
            const count = src === ""
              ? sourceCounts.ALL
              : src === "PORTAL" ? sourceCounts.PORTAL
              : src === "DAILY" ? sourceCounts.DAILY
              : sourceCounts.MANUAL;
            const active = tripSource === src;
            return (
              <button
                key={src || "ALL"}
                type="button"
                onClick={() => setTripSource(src)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: active ? meta.bg : "#fff",
                  color: active ? meta.color : "#475569",
                  border: active
                    ? `1.5px solid ${meta.color}`
                    : "1px solid #e2e8f0",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: active ? `0 4px 12px ${meta.color}30` : "none",
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                <span style={{
                  fontSize: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32, height: 32,
                  borderRadius: 8,
                  background: active ? meta.color : meta.bg,
                  color: active ? "#fff" : meta.color,
                  flexShrink: 0,
                }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: active ? meta.color : "#0f172a" }}>
                    {meta.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    marginTop: 2,
                  }}>
                    {src === "" ? "Todos los viajes" : src === "PORTAL" ? "Desde portal" : src === "DAILY" ? "Excel diario" : "Creados a mano"}
                  </div>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 99,
                  background: active ? meta.color : "#f1f5f9",
                  color: active ? "#fff" : "#475569",
                  minWidth: 28,
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Timeline operativa: estado general de viajes (siempre visible, respeta los filtros) ── */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Timeline operativa")}</p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>{t("Estado general de viajes")}</h3>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted, background: "#f8fafc", border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "4px 12px" }}>
            {filteredTrips.length} viajes con los filtros actuales
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STATUS_FLOW.map((status) => {
            const sc = STATUS_COLORS[status] ?? STATUS_COLORS.SCHEDULED;
            const items = filteredTrips.filter((trip) => trip.status === status);
            const hasItems = items.length > 0;
            return (
              <div key={status} style={{
                background: pal.cardBg,
                border: `1px solid ${pal.cardBorder}`,
                borderTop: `3px solid ${sc.accent}`,
                borderRadius: "16px",
                padding: "12px",
                boxShadow: pal.shadow,
              }}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: sc.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {t(statusTone(status).label)}
                  </span>
                  <span style={{
                    minWidth: "22px", height: "22px", borderRadius: "99px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 800,
                    background: hasItems ? sc.chipBg : "#f1f5f9",
                    color: hasItems ? sc.accent : pal.textMuted,
                    border: hasItems ? `1px solid ${sc.chipBorder}` : `1px solid ${pal.cardBorder}`,
                  }}>
                    {items.length}
                  </span>
                </div>
                {/* Mini trip cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {items.slice(0, 3).map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setInfoTrip(trip)}
                      style={{
                        background: "#f8fafc",
                        border: `1px solid ${pal.cardBorder}`,
                        borderLeft: `3px solid ${sc.accent}`,
                        borderRadius: "10px",
                        padding: "8px 10px",
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                      }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: pal.textPrimary }}>{resolveRequester(trip)}</p>
                      <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "2px" }}>{trip.origin || t("Origen pendiente")}</p>
                      <p style={{ fontSize: "11px", color: pal.labelColor }}>
                        {trip.destinationVenueId ? venues[trip.destinationVenueId]?.name : trip.destination || t("Destino pendiente")}
                      </p>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p style={{ fontSize: "12px", color: pal.labelColor, textAlign: "center", padding: "12px 0" }}>{t("Sin viajes.")}</p>
                  )}
                  {items.length > 3 && (
                    <p style={{ fontSize: "11px", color: sc.accent, textAlign: "center", fontWeight: 600 }}>+{items.length - 3} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        {/* Banda compacta: chips de status + acciones */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setShowAdminEditor(false);
                    setSelectedTripId(null);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold rounded-full transition-all"
                  style={{
                    padding: "7px 14px",
                    background: selected ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "#f1f5f9",
                    color: selected ? "#fff" : "#475569",
                    boxShadow: selected ? "0 2px 8px rgba(33,208,179,0.35)" : "none",
                  }}>
                  {t(tab.label)}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "1px 7px",
                    borderRadius: 99,
                    background: selected ? "rgba(255,255,255,0.25)" : "#fff",
                    color: selected ? "#fff" : "#64748b",
                    minWidth: 20,
                    textAlign: "center",
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab("editor");
                setShowAdminEditor(true);
                setSelectedTripId(null);
                setTripSource("MANUAL");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold rounded-lg"
              style={{
                padding: "7px 14px",
                background: "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)",
                color: "#fff", border: "none", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(33,208,179,0.35)",
              }}
            >
              + Nuevo manual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              className="inline-flex items-center gap-1 text-xs font-bold rounded-lg"
              style={{
                padding: "7px 14px",
                background: "#fff", color: "#475569",
                border: "1px solid #cbd5e1", cursor: "pointer",
              }}
            >
              ⬆ Importar
            </button>
          </div>
        </div>

        {/* Dummy div para mantener compatibilidad con el .map() de tabs (ya no lo usamos así) */}
        <div style={{ display: "none" }}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setShowAdminEditor(false);
                  setSelectedTripId(null);
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  borderRadius: "12px", padding: "10px 14px", textAlign: "left", cursor: "pointer",
                  background: selected ? "#21D0B3" : "transparent",
                  border: selected ? "none" : `1px solid transparent`,
                  transition: "all 150ms",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: selected ? "rgba(255,255,255,0.7)" : pal.labelColor }}>{t("Vista")}</p>
                  <p style={{ marginTop: "3px", fontSize: "13px", fontWeight: 700, color: selected ? "#ffffff" : pal.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(tab.label)}</p>
                </div>
                <span style={{
                  minWidth: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.2)" : pal.cardBg,
                  color: selected ? "#ffffff" : pal.textMuted,
                  border: selected ? "none" : `1px solid ${pal.cardBorder}`,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {activeTab === "dispatch" && (
          <div className="mt-6 space-y-5">
            {/* ── Resumen del despacho: qué falta y qué está cubierto ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div style={{
                borderRadius: "16px", padding: "14px 18px",
                background: pendingAssignment.length > 0 ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : "#f0fdf4",
                border: `1px solid ${pendingAssignment.length > 0 ? "#fcd34d" : "#86efac"}`,
              }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: pendingAssignment.length > 0 ? "#b45309" : "#166534" }}>
                  Asignación pendiente
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: pendingAssignment.length > 0 ? "#d97706" : "#16a34a" }}>
                  {pendingAssignment.length}
                </p>
                <p style={{ fontSize: "11px", color: pendingAssignment.length > 0 ? "#92400e" : "#166534", marginTop: 2 }}>
                  {pendingAssignment.length > 0 ? "servicios a la espera de conductor" : "programación completamente cubierta"}
                </p>
              </div>
              <div style={{ borderRadius: "16px", padding: "14px 18px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#166534" }}>
                  Servicios confirmados
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: "#16a34a" }}>
                  {readyToGo.length}
                </p>
                <p style={{ fontSize: "11px", color: "#166534", marginTop: 2 }}>con conductor · pasan a Activos al iniciar</p>
              </div>
              <div style={{ borderRadius: "16px", padding: "14px 18px", background: "#fff", border: `1px solid ${pal.cardBorder}` }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>
                  Próxima salida por cubrir
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: pal.textPrimary }}>
                  {pendingAssignment[0] ? formatClock(pendingAssignment[0].scheduledAt) : "—"}
                </p>
                <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: 2 }}>
                  {pendingAssignment[0]
                    ? `${formatDateTime(pendingAssignment[0].scheduledAt)} · ${pendingAssignment[0].destination || "sin destino"}`
                    : "sin salidas pendientes de cobertura"}
                </p>
              </div>
            </div>

            {/* ── Dos colas: pendientes de chofer vs cubiertos ── */}
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "#b45309" }}>Cola de asignación</p>
                    <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>Servicios por asignar</h3>
                    <p style={{ marginTop: "2px", fontSize: "12px", color: pal.textMuted }}>
                      Solicitudes del portal, planilla operativa y registros manuales sin conductor, ordenados por hora de salida.
                    </p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 700, color: "#d97706" }}>
                    {pendingAssignment.length} pendiente{pendingAssignment.length === 1 ? "" : "s"}
                  </span>
                </div>
                {pendingAssignment.length === 0 ? (
                  <div style={{ borderRadius: "20px", border: "1px dashed #86efac", background: "#f0fdf4", padding: "48px 24px", textAlign: "center" as const, fontSize: "14px", color: "#166534" }}>
                    ✓ No hay servicios pendientes de asignación. Las nuevas solicitudes aparecerán aquí automáticamente.
                  </div>
                ) : (
                  <div className="space-y-4" style={{ maxHeight: 1000, overflowY: "auto", paddingRight: 4 }}>
                    {pendingAssignment.map((trip) => renderTripCard(trip, "request"))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "#166534" }}>Programación confirmada</p>
                    <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>Servicios confirmados</h3>
                    <p style={{ marginTop: "2px", fontSize: "12px", color: pal.textMuted }}>
                      Con conductor y vehículo definidos, a la espera del inicio del servicio.
                    </p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 700, color: "#059669" }}>
                    {readyToGo.length} confirmado{readyToGo.length === 1 ? "" : "s"}
                  </span>
                </div>
                {readyToGo.length === 0 ? (
                  <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                    Aún no hay servicios con conductor confirmado. Asigne desde la cola de la izquierda o ejecute la auto-asignación en Operatividad Diaria.
                  </div>
                ) : (
                  <div className="space-y-4" style={{ maxHeight: 1000, overflowY: "auto", paddingRight: 4 }}>
                    {readyToGo.map((trip) => renderTripCard(trip, "dispatch"))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === "active" && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Viajes activos")}</p>
                <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>{t("Seguimiento de servicio en curso")}</h3>
              </div>
              <Link
                href="/operations/vehicle-positions"
                style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: "1px solid #e2e8f0", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#475569", textDecoration: "none", background: "#ffffff" }}
              >
                Abrir tracking completo
              </Link>
            </div>
            {activeTrips.length === 0 ? (
              <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                No hay viajes activos en este momento.
              </div>
            ) : (
              activeTrips.map((trip) => renderTripCard(trip, "active"))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="mt-6 space-y-6">
            {/* ── Últimos cierres */}
            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Bitácora reciente")}</p>
                  <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>{t("Últimos cierres")}</h3>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted, background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "4px 12px" }}>
                  {completedTrips.length} viajes
                </span>
              </div>
              {completedTrips.length === 0 ? (
                <div style={{ borderRadius: "16px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "40px 24px", textAlign: "center", color: pal.textMuted, fontSize: "14px" }}>
                  Sin viajes completados recientes.
                </div>
              ) : (
                <div style={{ borderRadius: "16px", border: `1px solid ${pal.cardBorder}`, overflow: "hidden", boxShadow: pal.shadow }}>
                  {completedTrips.map((trip, i) => {
                    const sc = STATUS_COLORS[trip.status ?? "COMPLETED"] ?? STATUS_COLORS.COMPLETED;
                    const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                    return (
                      <div key={trip.id} style={{
                        display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr auto",
                        gap: "12px", alignItems: "center",
                        padding: "12px 16px",
                        background: i % 2 === 0 ? pal.cardBg : "#fafafa",
                        borderBottom: i < completedTrips.length - 1 ? `1px solid ${pal.cardBorder}` : "none",
                      }}>
                        <span style={{ background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: sc.accent, display: "inline-flex", alignItems: "center", gap: "4px", width: "fit-content" }}>
                          {sc.accent === "#10b981" && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.accent, display: "inline-block" }} />}
                          {t(statusTone(trip.status).label)}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{resolveRequester(trip)}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{venue?.name || trip.destination || "-"}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{resolveDriver(trip)}</span>
                        <span style={{ fontSize: "12px", color: pal.labelColor, fontVariantNumeric: "tabular-nums" }}>{formatDateTime(trip.completedAt || trip.updatedAt)}</span>
                        <button type="button" onClick={() => setLogTrip(trip)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          Ver bitácora
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        )}
      </section>

      {activeTab === "portal" && (
        <section className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Solicitudes desde portal")}</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>Viajes VIP / T1</h3>
              <p className="mt-1 text-sm" style={{ color: pal.textMuted }}>Solicitudes ingresadas por clientes VIP o T1 desde el portal de solicitud de viajes.</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {["VIP", "T1"].map((type) => {
                const count = portalVipTrips.filter((trip) => trip.clientType === type).length;
                return (
                  <span key={type} style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#a855f7" }}>
                    {type}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          {portalVipTrips.length === 0 ? (
            <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
              No hay solicitudes de portal de clientes VIP o T1 en este momento.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {["REQUESTED", "SCHEDULED", "ASSIGNED", "EN_ROUTE", "PICKED_UP"].map((status) => {
                const items = portalVipTrips.filter((trip) => trip.status === status);
                if (items.length === 0) return null;
                const sc = STATUS_COLORS[status] ?? STATUS_COLORS.SCHEDULED;
                return (
                  <div key={status}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: sc.accent, marginBottom: "10px" }}>
                      {t(STATUS_TONES[status]?.label ?? "")} ({items.length})
                    </p>
                    <div className="space-y-4">
                      {items.map((trip) => renderTripCard(trip, status === "REQUESTED" ? "request" : "dispatch"))}
                    </div>
                  </div>
                );
              })}
              {portalVipTrips.filter((trip) => ["DROPPED_OFF", "COMPLETED", "CANCELLED"].includes(trip.status || "")).length > 0 && (
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: pal.labelColor, marginBottom: "10px" }}>
                    {t("Cerrados")} ({portalVipTrips.filter((trip) => ["DROPPED_OFF", "COMPLETED", "CANCELLED"].includes(trip.status || "")).length})
                  </p>
                  <div className="space-y-4">
                    {portalVipTrips
                      .filter((trip) => ["DROPPED_OFF", "COMPLETED", "CANCELLED"].includes(trip.status || ""))
                      .slice(0, 5)
                      .map((trip) => renderTripCard(trip, "active"))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "import" && (
        <section className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: pal.labelColor }}>Carga masiva</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: pal.textPrimary }}>Importación masiva de viajes</h3>
              <p style={{ marginTop: "4px", fontSize: "13px", color: pal.textMuted }}>Carga un Excel con los viajes a programar. Descarga la plantilla para ver el formato esperado.</p>
            </div>
            <button
              type="button"
              onClick={downloadTripTemplate}
              style={{ border: `1px solid ${pal.btnBorder}`, borderRadius: "99px", padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: pal.btnColor, background: pal.cardBg, cursor: "pointer" }}
            >
              Descargar plantilla
            </button>
          </div>

          {/* File picker */}
          <div
            style={{ border: `2px dashed ${pal.cardBorder}`, borderRadius: "20px", padding: "32px", textAlign: "center", background: pal.cardBg, cursor: "pointer" }}
            onClick={() => importInputRef.current?.click()}
          >
            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { handleImportFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: pal.textPrimary }}>
              {importFile ? importFile.name : "Haz clic para seleccionar un archivo Excel"}
            </p>
            <p style={{ marginTop: "4px", fontSize: "12px", color: pal.textMuted }}>.xlsx · .xls · .csv</p>
          </div>

          {/* Preview table */}
          {importRows.length > 0 && (
            <div style={{ border: `1px solid ${pal.cardBorder}`, borderRadius: "16px", overflow: "hidden", boxShadow: pal.shadow }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${pal.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: pal.textPrimary }}>{importRows.length} fila(s) detectadas</p>
                <button type="button" onClick={runImport} disabled={importing}
                  style={{ background: "#21D0B3", border: "none", borderRadius: "99px", padding: "8px 22px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.7 : 1 }}>
                  {importing ? "Importando…" : "Importar viajes"}
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {TRIP_IMPORT_HEADERS.map(h => (
                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: pal.labelColor, borderBottom: `1px solid ${pal.cardBorder}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${pal.cardBorder}`, background: i % 2 === 0 ? pal.cardBg : "#fafafa" }}>
                        {TRIP_IMPORT_HEADERS.map(h => (
                          <td key={h} style={{ padding: "8px 14px", color: pal.textPrimary, whiteSpace: "nowrap" }}>{row[h] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                    {importRows.length > 20 && (
                      <tr><td colSpan={TRIP_IMPORT_HEADERS.length} style={{ padding: "10px 14px", textAlign: "center", color: pal.textMuted, fontSize: "12px" }}>… y {importRows.length - 20} filas más</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result / errors */}
          {importResult && (
            <p style={{ fontSize: "13px", fontWeight: 600, color: importErrors.length ? "#f59e0b" : "#10b981" }}>{importResult}</p>
          )}
          {importErrors.length > 0 && (
            <ul style={{ fontSize: "12px", color: "#ef4444", paddingLeft: "16px", lineHeight: 1.8 }}>
              {importErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </section>
      )}

      {showAdminEditor && activeTab === "editor" && (
        <section id="trip-editor-section" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Gestion manual")}</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>{t("Gestión manual de viajes")}</h3>
              <p style={{ marginTop: "6px", maxWidth: "600px", fontSize: "13px", color: "#64748b" }}>
                Mantiene el CRUD completo para reasignar chofer, vehículo, estados y datos del viaje sin ensuciar la vista principal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAdminEditor(false); setSelectedTripId(null); setActiveTab("dispatch"); }}
              style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: "1px solid #e2e8f0", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#475569", background: "#ffffff", cursor: "pointer" }}
            >
              Cerrar editor
            </button>
          </div>
          <ResourceScreen config={resources.trips} externalEditingId={selectedTripId} />
        </section>
      )}
      {/* ── Modal Bitácora ── */}
      {infoTrip && (() => {
        const isc = STATUS_COLORS[infoTrip.status ?? ""] ?? STATUS_COLORS.SCHEDULED;
        const itone = statusTone(infoTrip.status);
        const ivenue = infoTrip.destinationVenueId ? venues[infoTrip.destinationVenueId] : null;
        const fields: { label: string; value: string }[] = [
          { label: "Programación", value: formatDateTime(infoTrip.scheduledAt) },
          ...(infoTrip.startedAt ? [{ label: "Inicio real", value: formatDateTime(infoTrip.startedAt) }] : []),
          ...(infoTrip.completedAt ? [{ label: "Término", value: formatDateTime(infoTrip.completedAt) }] : []),
          { label: "Origen", value: safeText(infoTrip.origin, "Origen pendiente") },
          { label: "Destino", value: ivenue ? buildVenueAddress(ivenue) : safeText(infoTrip.destination, "Destino pendiente") },
          { label: "Conductor", value: infoTrip.driverId ? (drivers[infoTrip.driverId]?.fullName || "Asignado") : "Por asignar" },
          { label: "Vehículo", value: infoTrip.vehicleId || infoTrip.vehiclePlate ? resolveVehicle(infoTrip) : "Por asignar" },
          ...(infoTrip.passengerCount ? [{ label: "Pasajeros", value: String(infoTrip.passengerCount) }] : []),
          ...(infoTrip.clientType ? [{ label: "Tipo de cliente", value: infoTrip.clientType }] : []),
          ...(infoTrip.athleteNames?.length ? [{ label: "Participantes", value: infoTrip.athleteNames.join(", ") }] : []),
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setInfoTrip(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "520px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 4px" }}>Detalle del viaje</p>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>{resolveRequester(infoTrip)}</p>
                </div>
                <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: isc.accent, background: isc.chipBg, border: `1px solid ${isc.chipBorder}`, borderRadius: "99px", padding: "5px 12px" }}>
                  {t(itone.label)}
                </span>
              </div>
              {/* Datos */}
              <div style={{ padding: "16px 24px", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {fields.map((f) => (
                    <div key={f.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "9px 12px", gridColumn: f.label === "Destino" || f.label === "Origen" || f.label === "Participantes" ? "1 / -1" : undefined }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 3px" }}>{f.label}</p>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", margin: 0 }}>{f.value}</p>
                    </div>
                  ))}
                </div>
                {infoTrip.notes && (
                  <p style={{ marginTop: "12px", fontSize: "12.5px", color: "#78350f", background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 10, padding: "8px 12px", fontWeight: 600 }}>
                    <span style={{ fontWeight: 800, color: "#b45309" }}>⚠ Observación:</span>{" "}
                    {safeText(infoTrip.notes.replace(/^\[Portal\]\s*/, ""))}
                  </p>
                )}
              </div>
              {/* Acciones */}
              <div style={{ padding: "14px 24px 18px", borderTop: "1px solid #f1f5f9", flexShrink: 0, display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setInfoTrip(null)}
                  style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                  Cerrar
                </button>
                <button type="button" onClick={() => { setLogTrip(infoTrip); setInfoTrip(null); }}
                  style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  Ver bitácora
                </button>
                <button type="button" onClick={() => {
                    const target = infoTrip;
                    setInfoTrip(null);
                    setShowAdminEditor(true);
                    setActiveTab("editor");
                    setSelectedTripId(target.id);
                    setTimeout(() => {
                      document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 120);
                  }}
                  style={{ background: "linear-gradient(135deg, #21D0B3, #14b8a6)", border: "none", borderRadius: "99px", padding: "8px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(20,184,166,0.35)" }}>
                  Editar viaje
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {logTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setLogTrip(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 4px" }}>Bitácora del viaje</p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: 0 }}>{resolveRequester(logTrip)} → {logTrip.destination || "Sin destino"}</p>
            </div>
            {/* Log entries */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {(() => {
                const log = Array.isArray((logTrip.metadata as any)?.log) ? (logTrip.metadata as any).log as { action: string; by: string; at: string; detail?: string }[] : [];
                const ACTION_LABELS: Record<string, { label: string; color: string }> = {
                  CREATED: { label: "Solicitud creada", color: "#3b82f6" },
                  MODIFIED: { label: "Modificado por usuario", color: "#f59e0b" },
                  CANCELLED: { label: "Cancelado por usuario", color: "#ef4444" },
                  DRIVER_ASSIGNED: { label: "Conductor asignado", color: "#10b981" },
                  VEHICLE_ASSIGNED: { label: "Vehículo asignado", color: "#10b981" },
                  STATUS_CHANGED: { label: "Estado actualizado", color: "#8b5cf6" },
                  SCHEDULE_CHANGED: { label: "Horario modificado", color: "#0ea5e9" },
                  VEHICLE_TYPE_CHANGED: { label: "Tipo vehículo cambiado", color: "#f59e0b" },
                  PASSENGER_COUNT_CHANGED: { label: "Pasajeros modificados", color: "#f59e0b" },
                };
                if (log.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" style={{ margin: "0 auto 8px", display: "block" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <p style={{ fontSize: "13px", margin: 0 }}>Sin registros en la bitácora</p>
                    </div>
                  );
                }
                return (
                  <div style={{ position: "relative", paddingLeft: "20px" }}>
                    {/* Timeline line */}
                    <div style={{ position: "absolute", left: "5px", top: "4px", bottom: "4px", width: "2px", background: "#e2e8f0", borderRadius: "1px" }} />
                    {log.map((entry, i) => {
                      const info = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "#64748b" };
                      const date = new Date(entry.at);
                      const timeStr = !isNaN(date.getTime()) ? date.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                      return (
                        <div key={i} style={{ position: "relative", marginBottom: i < log.length - 1 ? "16px" : 0 }}>
                          {/* Dot */}
                          <div style={{ position: "absolute", left: "-20px", top: "2px", width: "12px", height: "12px", borderRadius: "50%", background: "#fff", border: `2px solid ${info.color}`, zIndex: 1 }} />
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: info.color, margin: "0 0 2px" }}>{info.label}</p>
                            {entry.detail && <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 2px", background: "#f1f5f9", borderRadius: "4px", padding: "2px 8px", display: "inline-block" }}>{humanizeLogDetail(entry.detail)}</p>}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{entry.by}</span>
                              <span style={{ fontSize: "10px", color: "#cbd5e1" }}>•</span>
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{timeStr}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Fotos de jornada del conductor tomadas en este viaje: la de
                  inicio se pide en el primer viaje del día y la de término en
                  el último (metadata jornada_<fecha>_<start|end> con tripId). */}
              {(() => {
                const driver = logTrip.driverId ? drivers[logTrip.driverId] : null;
                const meta = (driver?.metadata ?? {}) as Record<string, unknown>;
                const tripDay = (logTrip.startedAt || logTrip.scheduledAt || "").slice(0, 10);
                const photos = Object.entries(meta)
                  .map(([key, value]) => {
                    const m = key.match(/^jornada_(\d{4}-\d{2}-\d{2})_(start|end)$/);
                    if (!m || !value || typeof value !== "object") return null;
                    const v = value as { url?: string; tripId?: string | null; uploadedAt?: string | null };
                    if (!v.url) return null;
                    return { date: m[1], kind: m[2] as "start" | "end", url: v.url, tripId: v.tripId ?? null, uploadedAt: v.uploadedAt ?? null };
                  })
                  .filter((p): p is NonNullable<typeof p> => p !== null)
                  // Del viaje exacto que la gatilló; las fotos antiguas sin
                  // tripId se muestran si son del mismo día del viaje.
                  .filter((p) => p.tripId === logTrip.id || (!p.tripId && !!tripDay && p.date === tripDay))
                  .sort((a) => (a.kind === "start" ? -1 : 1));
                if (photos.length === 0) return null;
                return (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 10px" }}>
                      Fotos de jornada del conductor
                    </p>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {photos.map((p) => {
                        const uploaded = p.uploadedAt ? new Date(p.uploadedAt) : null;
                        const timeStr = uploaded && !isNaN(uploaded.getTime())
                          ? uploaded.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : p.date;
                        return (
                          <a key={`${p.date}-${p.kind}`} href={p.url} target="_blank" rel="noreferrer" title="Abrir foto en tamaño completo"
                            style={{ textDecoration: "none", width: "150px" }}>
                            <img src={p.url} alt={p.kind === "start" ? "Foto de inicio de jornada" : "Foto de término de jornada"}
                              style={{ width: "150px", height: "100px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0", display: "block" }} />
                            <p style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a", margin: "6px 0 0" }}>
                              {p.kind === "start" ? "Inicio de jornada" : "Término de jornada"}
                            </p>
                            <p style={{ fontSize: "10.5px", color: "#94a3b8", margin: "1px 0 0" }}>{timeStr}</p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 24px", borderTop: "1px solid #f1f5f9", flexShrink: 0, textAlign: "center" }}>
              <button type="button" onClick={() => setLogTrip(null)}
                style={{ padding: "10px 32px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.3)" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de cancelar / eliminar viaje ── */}
      <ConfirmDialog
        open={!!pendingAction}
        danger
        title={confirmIsCancel ? "Cancelar viaje" : "Eliminar viaje"}
        message={confirmMessage}
        confirmLabel={
          actionBusy ? "Procesando…" : confirmIsCancel ? "Cancelar viaje" : "Eliminar"
        }
        cancelLabel="Volver"
        onConfirm={runPendingAction}
        onCancel={() => { if (!actionBusy) setPendingAction(null); }}
      />
    </div>
  );
}
