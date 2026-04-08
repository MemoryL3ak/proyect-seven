
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ResourceScreen from "@/components/ResourceScreen";
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
  EN_ROUTE: { label: "En ruta a recoger", chip: "", panel: "" },
  PICKED_UP: { label: "En curso", chip: "", panel: "" },
  DROPPED_OFF: { label: "Dejado en hotel", chip: "", panel: "" },
  COMPLETED: { label: "Completado", chip: "", panel: "" },
  CANCELLED: { label: "Cancelado", chip: "", panel: "" },
};

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string; pulse: boolean }> = {
  REQUESTED:  { accent: "#f59e0b", chipBg: "rgba(245,158,11,0.12)",  chipBorder: "rgba(245,158,11,0.3)",  pulse: false },
  SCHEDULED:  { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)",  pulse: false },
  EN_ROUTE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  PICKED_UP:  { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  DROPPED_OFF:{ accent: "#14b8a6", chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)",  pulse: false },
  COMPLETED:  { accent: "#64748b", chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)", pulse: false },
  CANCELLED:  { accent: "#ef4444", chipBg: "rgba(239,68,68,0.1)",    chipBorder: "rgba(239,68,68,0.25)",  pulse: false },
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  AUTO: "Auto",
  SUV: "SUV",
  VAN_10: "Van 10",
  VAN_15: "Van 15-17",
  VAN_19: "Van 19",
  MINIBUS: "Minibus 20-33",
  BUS: "Bus 40-64",
  SEDAN: "Sedan / SUV",
  VAN: "Van",
  MINI_BUS: "Mini Bus",
};

const PORTAL_CLIENT_TYPES = new Set(["VIP", "T1"]);

const STATUS_FLOW = ["REQUESTED", "SCHEDULED", "EN_ROUTE", "PICKED_UP", "COMPLETED"] as const;

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
  const knownRequestedIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, athleteData, delegationData, driverData, vehicleData, venueData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<VenueItem[]>("/venues")
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
      setDrivers(
        (driverData || []).reduce<Record<string, DriverItem>>((acc, item) => {
          acc[item.id] = item;
          if (item.userId) acc[item.userId] = item;
          return acc;
        }, {})
      );
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
  }, [athletes, delegations, drivers, search, selectedClientType, selectedEventId, trips, vehicles, venues]);

  const incomingRequests = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "REQUESTED"),
    [filteredTrips]
  );

  const scheduledQueue = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "SCHEDULED"),
    [filteredTrips]
  );

  const activeTrips = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "EN_ROUTE" || trip.status === "PICKED_UP"),
    [filteredTrips]
  );

  const completedTrips = useMemo(
    () =>
      filteredTrips
        .filter((trip) => trip.status === "DROPPED_OFF" || trip.status === "COMPLETED")
        .slice(0, 8),
    [filteredTrips]
  );
  const portalVipTrips = useMemo(
    () =>
      filteredTrips.filter(
        (trip) =>
          trip.tripType === "PORTAL_REQUEST" &&
          PORTAL_CLIENT_TYPES.has(trip.clientType || "")
      ),
    [filteredTrips]
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
    return athlete?.fullName || (trip.athleteNames && trip.athleteNames[0]) || t("Sin solicitante");
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
    if (!vehicle) return t("Por asignar");
    return [vehicle.plate, [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.type]
      .filter(Boolean)
      .join(" · ");
  };

  const resolveDriver = (trip: Trip) => {
    const driver = trip.driverId ? drivers[trip.driverId] : null;
    return driver?.fullName || t("Pendiente de despacho");
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

  const tabs = [
    { key: "dispatch" as const, label: t("Por asignar"), count: incomingRequests.length + scheduledQueue.length },
    { key: "active" as const, label: t("Activos"), count: activeTrips.length },
    { key: "history" as const, label: t("Historial"), count: completedTrips.length },
    { key: "portal" as const, label: t("Solicitudes VIP / T1"), count: portalVipTrips.length },
    { key: "editor" as const, label: t("Gestión manual"), count: filteredTrips.length },
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

    return (
      <article
        key={trip.id}
        style={{
          background: pal.cardBg,
          border: `1px solid ${pal.cardBorder}`,
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
            { label: "Sede destino", value: buildVenueAddress(venue), sub: null, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
            { label: "Despacho", value: resolveDriver(trip), sub: resolveVehicle(trip), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
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
                    { label: "Programación regreso", value: formatDateTime(child.scheduledAt), icon: null },
                    { label: "Origen regreso", value: safeText(child.origin), icon: null },
                    { label: "Destino regreso", value: childVenue ? buildVenueAddress(childVenue) : safeText(child.destination), icon: null },
                    { label: "Conductor regreso", value: child.driverId ? (drivers[child.driverId]?.fullName || "Asignado") : t("Por asignar"), icon: null },
                    { label: "Vehículo regreso", value: child.vehicleId ? resolveVehicle(child) : t("Por asignar"), icon: null },
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
          <p style={{ fontSize: "13px", color: pal.textMuted, maxWidth: "600px" }}>
            <span style={{ fontWeight: 700, color: pal.textPrimary }}>Observaciones:</span>{" "}
            {safeText(trip.notes, "Sin observaciones operativas.")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {emphasis === "request" && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminEditor(true);
                  setActiveTab("editor");
                  setSelectedTripId(trip.id);
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                  }
                }}
                style={{ background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: sc.accent, cursor: "pointer" }}
              >
                Gestionar solicitud
              </button>
            )}
            <Link
              href="/portal/vehicle-request"
              style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: pal.textMuted, textDecoration: "none" }}
            >
              Abrir portal usuario
            </Link>
          </div>
        </div>
      </article>
    );
  };

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
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card, i) => (
            <article key={card.label} style={{
              background: pal.cardBg,
              border: `1px solid ${pal.cardBorder}`,
              borderTop: `3px solid ${pal.kpi[i]}`,
              borderRadius: "20px",
              padding: "18px 20px",
              boxShadow: pal.shadow,
            }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{card.label}</span>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: pal.kpi[i], boxShadow: `0 0 6px ${pal.kpi[i]}88`, display: "inline-block" }} />
              </div>
              <p style={{ fontSize: "2.4rem", fontWeight: 800, color: pal.kpi[i], lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : card.value}
              </p>
            </article>
          ))}
        </div>
        <article style={{ background: pal.filterBg, border: `1px solid ${pal.filterBorder}`, borderRadius: "20px", padding: "20px", boxShadow: pal.shadow }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>{t("Filtro operativo")}</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: pal.textPrimary }}>{t("Vista de asignación")}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAdminEditor((value) => !value);
                setActiveTab("editor");
              }}
              style={{ border: `1px solid ${pal.btnBorder}`, borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: pal.btnColor, background: "transparent", cursor: "pointer" }}
            >
              {showAdminEditor ? "Ocultar editor" : "Abrir editor manual"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{t("Evento")}</label>
              <select className="input h-12 w-full rounded-2xl" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                <option value="">{t("Todos los eventos")}</option>
                {eventOptions.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>{eventItem.name || eventItem.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{t("Tipo de cliente")}</label>
              <select className="input h-12 w-full rounded-2xl" value={selectedClientType} onChange={(event) => setSelectedClientType(event.target.value)}>
                <option value="">{t("Todos los clientes")}</option>
                {CLIENT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{t("Buscar")}</label>
              <input className="input h-12 w-full rounded-2xl" placeholder={t("Solicitante, delegacion, sede, conductor o patente")} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          {error && <p className="mt-4 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
        </article>
      </section>

      <section style={{ background: pal.filterBg, border: `1px solid ${pal.filterBorder}`, borderRadius: "24px", padding: "20px", boxShadow: pal.shadow }}>
        <div style={{ background: "#f8fafc", border: `1px solid ${pal.cardBorder}`, borderRadius: "16px", padding: "6px" }}>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== "editor") {
                    setShowAdminEditor(false);
                    setSelectedTripId(null);
                  }
                  if (tab.key === "editor") {
                    setShowAdminEditor(true);
                  }
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
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Ingresos desde portal")}</p>
                  <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>{t("Solicitudes por asignar")}</h3>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#d97706" }}>
                  {incomingRequests.length} en cola
                </span>
              </div>
              {incomingRequests.length === 0 ? (
                <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                  No hay solicitudes nuevas en espera. El panel seguira escuchando entradas del portal.
                </div>
              ) : (
                incomingRequests.map((trip) => renderTripCard(trip, "request"))
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Programacion")}</p>
                  <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>{t("Servicios asignados")}</h3>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#3b82f6" }}>
                  {scheduledQueue.length} viajes
                </span>
              </div>
              {scheduledQueue.length === 0 ? (
                <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                  No hay viajes programados pendientes de salida.
                </div>
              ) : (
                scheduledQueue.slice(0, 8).map((trip) => renderTripCard(trip, "dispatch"))
              )}
            </section>
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
                        display: "grid", gridTemplateColumns: "140px 1fr 1fr 1fr 1fr",
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
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Timeline kanban */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Timeline operativa")}</p>
                  <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>{t("Estado general de viajes")}</h3>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                      padding: "14px",
                      boxShadow: pal.shadow,
                    }}>
                      {/* Column header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
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
                        {items.slice(0, 4).map((trip) => (
                          <div key={trip.id} style={{
                            background: "#f8fafc",
                            border: `1px solid ${pal.cardBorder}`,
                            borderLeft: `3px solid ${sc.accent}`,
                            borderRadius: "10px",
                            padding: "10px 12px",
                          }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: pal.textPrimary }}>{resolveRequester(trip)}</p>
                            <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "2px" }}>{trip.origin || t("Origen pendiente")}</p>
                            <p style={{ fontSize: "11px", color: pal.labelColor }}>
                              {trip.destinationVenueId ? venues[trip.destinationVenueId]?.name : trip.destination || t("Destino pendiente")}
                            </p>
                          </div>
                        ))}
                        {items.length === 0 && (
                          <p style={{ fontSize: "12px", color: pal.labelColor, textAlign: "center", padding: "16px 0" }}>{t("Sin viajes.")}</p>
                        )}
                        {items.length > 4 && (
                          <p style={{ fontSize: "11px", color: sc.accent, textAlign: "center", fontWeight: 600 }}>+{items.length - 4} más</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              {["REQUESTED", "SCHEDULED", "EN_ROUTE", "PICKED_UP"].map((status) => {
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
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
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
              onClick={() => { setShowAdminEditor(false); setSelectedTripId(null); }}
              style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: "1px solid #e2e8f0", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: "#475569", background: "#ffffff", cursor: "pointer" }}
            >
              Cerrar editor
            </button>
          </div>
          <ResourceScreen config={resources.trips} externalEditingId={selectedTripId} />
        </section>
      )}
    </div>
  );
}


