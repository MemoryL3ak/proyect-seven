
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ResourceScreen from "@/components/ResourceScreen";
import ConfirmDialog from "@/components/ConfirmDialog";
import StyledSelect from "@/components/StyledSelect";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import { filterValidatedAthletes } from "@/lib/athletes";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";
import { CLIENT_TYPE_OPTIONS, clientTypeLabel } from "@/lib/clientTypes";
import { delegationLabel } from "@/lib/delegations";
import { legTypeLabel, tripTypeLabel } from "@/lib/tripTypes";
import {
  CrownIcon,
  FileSpreadsheetIcon,
  LayoutGridIcon,
  PenLineIcon,
  AlertIcon,
  UploadIcon,
  PinIcon,
  TruckIcon,
  UsersIcon,
  ClockIcon,
  FileTextIcon,
  TrashIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from "@/components/ui/Icons";

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
  /** Deporte de la planilla de operatividad, para identificar el servicio. */
  discipline?: string | null;
  /**
   * Viaje de delegación: en los Juegos Escolares el traslado se asigna al
   * grupo (región + disciplina), no a un participante.
   */
  delegationId?: string | null;
  disciplineId?: string | null;
  /** Prueba o actividad concreta dentro de la disciplina. */
  activity?: string | null;
  /** Sigla de la flota que cubre el servicio, según la planilla. */
  fleetAcronym?: string | null;
  wheelchairCount?: number | null;
  travelTimeMinutes?: number | null;
  /** Hora de presentación del conductor, antes de la hora del pasajero. */
  presentationAt?: string | null;
  returnAt?: string | null;
  flightNumber?: string | null;
  tripCost?: number | null;
  committeeValidated?: boolean;
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
  /** 'fleet' | 'provider' — lo marca /drivers al unificar ambas fuentes. */
  source?: string | null;
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
/** Hotel del evento. Un viaje "toca" un hotel si sale o llega a él. */
type HotelItem = { id: string; name?: string | null; eventId?: string | null };

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
  DROPPED_OFF: { label: "Completado", chip: "", panel: "" },
  COMPLETED: { label: "Completado", chip: "", panel: "" },
  CANCELLED: { label: "Cancelado", chip: "", panel: "" },
};

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string; pulse: boolean }> = {
  REQUESTED:  { accent: STATE.warning, chipBg: "rgba(245,158,11,0.12)",  chipBorder: "rgba(245,158,11,0.3)",  pulse: false },
  SCHEDULED:  { accent: STATE.info, chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)",  pulse: false },
  ASSIGNED:   { accent: "#eab308", chipBg: "rgba(234,179,8,0.12)",   chipBorder: "rgba(234,179,8,0.3)",   pulse: false },
  EN_ROUTE:   { accent: STATE.success, chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  PICKED_UP:  { accent: STATE.success, chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  DROPPED_OFF:{ accent: BRAND.teal, chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)",  pulse: false },
  COMPLETED:  { accent: SURFACE.textMuted, chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)", pulse: false },
  CANCELLED:  { accent: STATE.danger, chipBg: "rgba(239,68,68,0.1)",    chipBorder: "rgba(239,68,68,0.25)",  pulse: false },
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

// Iconos de línea del kit, no emojis: el emoji lo dibuja el sistema operativo
// (distinto en Windows, Android e iOS) y no respeta el color de la tarjeta.
// Los SVG heredan `currentColor`, así que el contenedor de abajo los pinta
// del color del origen o en blanco cuando la tarjeta está activa.
const SOURCE_META: Record<TripSource | "", { label: string; color: string; bg: string; border: string; icon: ReactNode }> = {
  "": { label: "Todos", color: SURFACE.text, bg: SURFACE.card, border: SURFACE.border, icon: <LayoutGridIcon size={18} /> },
  PORTAL: { label: "VIP / T1", color: ACCENT.violet, bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.35)", icon: <CrownIcon size={18} /> },
  DAILY: { label: "Operatividad Diaria", color: "#0ea5c8", bg: "rgba(14,165,200,0.10)", border: "rgba(14,165,200,0.35)", icon: <FileSpreadsheetIcon size={18} /> },
  MANUAL: { label: "Gestión Manual", color: BRAND.teal, bg: "rgba(33,208,179,0.10)", border: "rgba(33,208,179,0.35)", icon: <PenLineIcon size={18} /> },
};

const STATUS_FLOW = ["REQUESTED", "SCHEDULED", "ASSIGNED", "EN_ROUTE", "PICKED_UP", "COMPLETED"] as const;
/** Viajes visibles por columna del tablero antes de desplegar el resto. */
const COLUMN_PREVIEW = 3;
/** Estados que sacan un viaje de la operación viva. */
const CLOSED_STATUSES = new Set(["DROPPED_OFF", "COMPLETED", "CANCELLED"]);
/** Rejilla de la lista "En curso": casilla, hora, estado, servicio, ruta, conductor, acciones. */
const ONGOING_PAGE_SIZE = 25;
const ongoingPaginaStyle = (deshabilitado: boolean) => ({
  borderRadius: "7px",
  border: `1px solid ${SURFACE.border}`,
  background: SURFACE.card,
  color: deshabilitado ? SURFACE.textFaint : SURFACE.textSecondary,
  padding: "5px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: deshabilitado ? "default" : "pointer",
  opacity: deshabilitado ? 0.55 : 1,
});
/** Botón de acción del final de cada fila. */
const ONGOING_ACTION_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  border: `1px solid ${SURFACE.border}`,
  background: SURFACE.card,
  color: SURFACE.textSecondary,
  cursor: "pointer",
  flexShrink: 0,
} as const;

/** "Alex Arevalo" → "AA", para el círculo del conductor. */
const inicialesDe = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0] ?? "")
    .join("")
    .toUpperCase();

/**
 * "2026-09-23" → "Miércoles 23 de septiembre". Sólo la inicial va en mayúscula:
 * `textTransform: capitalize` dejaba un "Miércoles 23 De Septiembre" que en
 * español está mal escrito.
 */
const formatDayLabel = (dayKey: string) => {
  const [a, m, d] = dayKey.split("-").map(Number);
  if (!a || !m || !d) return dayKey;
  const texto = new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Estados en los que un viaje sigue "vivo" y por tanto puede cancelarse.
const CANCELLABLE_STATUSES = new Set(["REQUESTED", "SCHEDULED", "ASSIGNED", "EN_ROUTE", "PICKED_UP"]);

/**
 * Nombre de lugar comparable: sin tildes, sin mayúsculas, sin dobles espacios.
 * Los viajes de planilla traen origen y destino escritos a mano, así que
 * "Comedor LRH (EX GALA)" y "comedor lrh  (ex gala)" tienen que calzar.
 */
const normalizarLugar = (valor?: string | null) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Día local de un instante: agrupar por UTC corría los viajes de la noche. */
const isoDayKeyLocal = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "sin-fecha";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/**
 * Mapa de la ruta planificada origen→destino. Mismo recurso que usa el
 * seguimiento de vehículos; sin la key configurada simplemente no se muestra.
 */
const buildDirectionsEmbed = (origin?: string | null, destination?: string | null): string | null => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !origin || !destination) return null;
  return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`;
};

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

const formatCLP = (value?: number | null) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
      }).format(value);

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
    cardBg: SURFACE.card, cardBorder: SURFACE.border, shadow: "0 1px 4px rgba(15,23,42,0.06)",
    textPrimary: SURFACE.text, textMuted: SURFACE.textMuted, labelColor: SURFACE.textFaint,
    kpi: [STATE.warning, STATE.info, ACCENT.indigo, STATE.success, SURFACE.textFaint],
    filterBg: SURFACE.card, filterBorder: SURFACE.border,
    btnBorder: SURFACE.border, btnColor: SURFACE.textSecondary,
  };

  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [hoteles, setHoteles] = useState<HotelItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedClientType, setSelectedClientType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshRequestIds, setFreshRequestIds] = useState<string[]>([]);
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  // "En curso" es la vista por defecto: es la operación viva del día.
  const [activeTab, setActiveTab] = useState<"ongoing" | "dispatch" | "active" | "history" | "portal" | "editor" | "import">("ongoing");
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
  // Pestaña desde la que se abrió el editor, para volver ahí al cerrarlo en
  // vez de caer siempre en Despacho.
  const tabPrevia = useRef<typeof activeTab>("ongoing");
  /** Se llama justo antes de abrir el editor, para saber a dónde volver. */
  const recordarTab = () => {
    if (activeTab !== "editor") tabPrevia.current = activeTab;
  };
  const cerrarEditor = () => {
    setShowAdminEditor(false);
    setSelectedTripId(null);
    const destino = tabPrevia.current;
    setActiveTab(destino === "editor" || destino === "portal" ? "ongoing" : destino);
  };
  // Vista "En curso": filtros propios de la vista y página de la lista.
  const [ongoingDay, setOngoingDay] = useState("");
  const [ongoingDiscipline, setOngoingDiscipline] = useState("");
  const [ongoingHotel, setOngoingHotel] = useState("");
  const [ongoingVenue, setOngoingVenue] = useState("");
  const [ongoingPage, setOngoingPage] = useState(0);
  // Selección múltiple para borrado en lote.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  // Columnas del tablero desplegadas: el "+N más" era texto muerto y no había
  // forma de llegar a los viajes que quedaban ocultos.
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const toggleColumn = (status: string) =>
    setExpandedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  const [actionBusy, setActionBusy] = useState(false);
  const knownRequestedIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, athleteData, delegationData, driverData, vehicleData, venueData, hotelData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<VenueItem[]>("/venues"),
          apiFetch<HotelItem[]>("/accommodations").catch(() => [] as HotelItem[]),
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
      // La Flota propia (VIP/T1) se mantiene en el mapa sólo para resolver
      // nombres de viajes históricos, pero se descarta del selector de
      // conductor: los choferes operativos de Viajes son los de proveedor.
      // /drivers ya devuelve ambas fuentes y marca cuál es cuál en `source`;
      // antes esto asumía que todo lo que venía de /drivers era Flota y lo
      // corregía con un segundo pedido a /provider-participants.
      const driversMap = (driverData || []).reduce<Record<string, DriverItem>>((acc, item) => {
        const driver = { ...item, isFleet: item.source === "fleet" };
        acc[item.id] = driver;
        if (item.userId) acc[item.userId] = driver;
        return acc;
      }, {});
      setDrivers(driversMap);
      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setHoteles(hotelData || []);
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

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllFiltered = () => setSelectedIds(new Set(filteredTrips.map((trip) => trip.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // Borrado en lote: una sola llamada al backend, que además arrastra los
  // tramos de regreso. Borrar de a uno desde acá costaba ~300 ms por viaje.
  const runBulkDelete = async () => {
    if (bulkBusy || selectedIds.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ deletedCount: number; requestedCount: number }>(
        "/trips/bulk-delete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        },
      );
      const extra = result.deletedCount - result.requestedCount;
      setBulkNotice(
        `${result.deletedCount} viaje(s) eliminados` +
          (extra > 0 ? ` (incluye ${extra} tramo(s) de regreso).` : "."),
      );
      clearSelection();
      setBulkDeleteOpen(false);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron eliminar los viajes seleccionados.");
    } finally {
      setBulkBusy(false);
    }
  };

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

  /**
   * En curso: la operación viva. Todo lo que no está cerrado ni cancelado, sin
   * separar por estado interno — el operador quiere una sola lista ordenada por
   * hora con lo que todavía tiene que pasar hoy.
   */
  const ongoingTrips = useMemo(
    () =>
      generalTrips
        .filter((trip) => !CLOSED_STATUSES.has(trip.status || ""))
        .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()),
    [generalTrips]
  );

  /**
   * Días con carga, para el selector. Antes la lista venía partida por
   * encabezados de jornada: con una semana entera eso obliga a bajar a ciegas
   * hasta encontrar el día que se busca.
   */
  const ongoingDays = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const trip of ongoingTrips) {
      const clave = trip.scheduledAt ? isoDayKeyLocal(trip.scheduledAt) : "sin-fecha";
      porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
    }
    return [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count, label: key === "sin-fecha" ? t("Sin fecha") : formatDayLabel(key) }));
  }, [ongoingTrips, t]);

  /** Deportes presentes en la operación viva, para el filtro. */
  const ongoingDisciplines = useMemo(
    () =>
      [...new Set(ongoingTrips.map((t2) => t2.discipline).filter((d): d is string => Boolean(d)))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [ongoingTrips],
  );

  /**
   * Los dos lugares de un viaje, tal como los muestra su fila: origen y
   * destino. Si el destino no trae texto se usa el nombre de la sede.
   */
  const lugaresDeViaje = (trip: Trip) => {
    const destino =
      (trip.destination || "").trim() ||
      (trip.destinationVenueId ? (venues[trip.destinationVenueId]?.name || "").trim() : "");
    return [(trip.origin || "").trim(), destino].filter((valor) => valor.length > 0);
  };

  const tocaLugar = (trip: Trip, nombre: string) => {
    const objetivo = normalizarLugar(nombre);
    if (!objetivo) return false;
    return lugaresDeViaje(trip).some((texto) => normalizarLugar(texto) === objetivo);
  };

  /**
   * Hoteles y sedes de los filtros. Salen de los propios viajes y no de los
   * maestros: la planilla escribe "Hotel Hippocampus" y el maestro lo tiene
   * como "Hippocampus Concón Resort & Club", así que al cruzarlos por nombre
   * el hotel no aparecía en el filtro aunque estuviera en decenas de viajes.
   * Con esto, cada opción existe porque algún viaje la nombra, y el filtro
   * calza exacto contra ese mismo texto.
   *
   * La separación hotel/sede se decide por el maestro de Hoteles y, si el
   * lugar no está ahí, por cómo se llama.
   */
  const { ongoingHoteles, ongoingSedes } = useMemo(() => {
    const nombresDeHotel = new Set(
      hoteles.map((h) => normalizarLugar(h.name)).filter((valor) => valor.length > 0),
    );
    const suenaAHotel = /(hotel|hostal|apart|aparthotel|resort|cabana|cabanas|hosteria|residencial)/;

    const porLugar = new Map<string, { texto: string; esHotel: boolean; total: number }>();
    for (const trip of ongoingTrips) {
      // Un viaje que sale y llega al mismo lugar cuenta una sola vez.
      const clavesDelViaje = new Set<string>();
      for (const texto of lugaresDeViaje(trip)) {
        const clave = normalizarLugar(texto);
        if (!clave || clavesDelViaje.has(clave)) continue;
        clavesDelViaje.add(clave);
        const actual = porLugar.get(clave);
        if (actual) {
          actual.total += 1;
          continue;
        }
        porLugar.set(clave, {
          texto,
          esHotel: nombresDeHotel.has(clave) || suenaAHotel.test(clave),
          total: 1,
        });
      }
    }

    const ordenados = [...porLugar.values()].sort((a, b) => a.texto.localeCompare(b.texto, "es"));
    return {
      ongoingHoteles: ordenados.filter((lugar) => lugar.esHotel),
      ongoingSedes: ordenados.filter((lugar) => !lugar.esHotel),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoteles, ongoingTrips, venues]);

  const ongoingFiltered = useMemo(
    () =>
      ongoingTrips
        .filter(
          (trip) =>
            !ongoingDay ||
            (trip.scheduledAt ? isoDayKeyLocal(trip.scheduledAt) : "sin-fecha") === ongoingDay,
        )
        .filter((trip) => !ongoingDiscipline || trip.discipline === ongoingDiscipline)
        .filter((trip) => !ongoingHotel || tocaLugar(trip, ongoingHotel))
        .filter((trip) => !ongoingVenue || tocaLugar(trip, ongoingVenue)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ongoingTrips, ongoingDay, ongoingDiscipline, ongoingHotel, ongoingVenue, venues],
  );

  const ongoingTotalPages = Math.max(1, Math.ceil(ongoingFiltered.length / ONGOING_PAGE_SIZE));
  const ongoingVisible = useMemo(
    () => ongoingFiltered.slice(ongoingPage * ONGOING_PAGE_SIZE, (ongoingPage + 1) * ONGOING_PAGE_SIZE),
    [ongoingFiltered, ongoingPage],
  );
  // Cambiar de día o quedarse sin filas no puede dejar la vista en una página
  // que ya no existe.
  useEffect(() => {
    if (ongoingPage > 0 && ongoingPage >= ongoingTotalPages) setOngoingPage(0);
  }, [ongoingPage, ongoingTotalPages]);

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
    { key: "ongoing" as const, label: t("En curso"), count: ongoingTrips.length },
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
          background: hasDriver ? pal.cardBg : STATE.warningSoft,
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
              <input
                type="checkbox"
                checked={selectedIds.has(trip.id)}
                onChange={() => toggleSelected(trip.id)}
                aria-label="Seleccionar este viaje"
                title="Seleccionar para eliminar en lote"
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: STATE.danger, flexShrink: 0 }}
              />
              <span style={chipStyle}>
                {sc.pulse && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: sc.accent, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                {t(tone.label)}
              </span>
              {trip.clientType && (
                <span style={{
                  background: PORTAL_CLIENT_TYPES.has(trip.clientType) ? "rgba(168,85,247,0.12)" : "rgba(100,116,139,0.1)",
                  border: `1px solid ${PORTAL_CLIENT_TYPES.has(trip.clientType) ? "rgba(168,85,247,0.3)" : "rgba(100,116,139,0.25)"}`,
                  borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700,
                  color: PORTAL_CLIENT_TYPES.has(trip.clientType) ? "#a855f7" : SURFACE.textFaint,
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
                <span style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: BRAND.teal, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Ida y vuelta
                </span>
              )}
              {isFresh && (
                <span style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: STATE.success, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: STATE.success, animation: "pulse 1.5s infinite", display: "inline-block" }} />
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
            { label: "Origen", value: safeText(trip.origin), sub: null, icon: <PinIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
            { label: "Sede destino", value: venue?.name || safeText(trip.destination), sub: venue ? buildVenueAddress(venue) : null, icon: <LayoutGridIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
            { label: "Conductor / Vehículo", value: resolveDriver(trip), sub: resolveVehicle(trip), icon: <TruckIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
            { label: "Servicio", value: `${trip.passengerCount || 0} persona(s)`, sub: `Solicitado ${formatDateTime(trip.requestedAt)}${etaMinutes !== null ? ` · ${etaMinutes >= 0 ? `en ${etaMinutes} min` : `${Math.abs(etaMinutes)} min atrasado`}` : ""}`, icon: <UsersIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
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
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "10px" }}>Tramo de regreso</p>
            {trip.childTrips.map((child) => {
              const childSc = STATUS_COLORS[child.status ?? "REQUESTED"] ?? STATUS_COLORS.REQUESTED;
              const childTone = statusTone(child.status);
              const childVenue = child.destinationVenueId ? venues[child.destinationVenueId] : null;
              return (
                <div key={child.id} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Estado regreso", value: t(childTone.label), icon: <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: childSc.accent, display: "inline-block" }} /> },
                    { label: "Programación regreso", value: formatDateTime(child.scheduledAt), icon: <ClockIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
                    { label: "Origen regreso", value: safeText(child.origin), icon: <PinIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
                    { label: "Destino regreso", value: childVenue ? buildVenueAddress(childVenue) : safeText(child.destination), icon: <LayoutGridIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
                    { label: "Conductor regreso", value: child.driverId ? (drivers[child.driverId]?.fullName || "Asignado") : t("Por asignar"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={SURFACE.textFaint} strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                    { label: "Vehículo regreso", value: child.vehicleId ? resolveVehicle(child) : t("Por asignar"), icon: <TruckIcon size={11} color={SURFACE.textFaint} strokeWidth={2.5} /> },
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
                    recordarTab();
                    setShowAdminEditor(true);
                    setActiveTab("editor");
                    setSelectedTripId(child.id);
                  }}
                  style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: BRAND.teal, cursor: "pointer" }}
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
                color: STATE.warningText,
                maxWidth: "600px",
                background: STATE.warningSoft,
                border: `1px solid ${STATE.warningBorder}`,
                borderLeft: `4px solid ${STATE.warning}`,
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: 600,
              }}
            >
              <span style={{ fontWeight: 800, color: STATE.warningText }}><AlertIcon size={12} className="inline mr-1" />Observación:</span>{" "}
              {safeText(trip.notes.replace(/^\[Portal\]\s*/, ""), "Sin observaciones operativas.")}
            </p>
          ) : (
            <p style={{ fontSize: "13px", color: pal.textMuted, maxWidth: "600px" }}>
              <span style={{ fontWeight: 700, color: pal.textPrimary }}>Observaciones:</span>{" "}
              Sin observaciones operativas.
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Un viaje se edita en cualquier estado. La tarjeta de un viaje en
                curso no ofrecía nada: si el chofer se cambiaba a mitad de
                jornada había que ir a buscarlo a otra pantalla. */}
            <button
              type="button"
              onClick={() => {
                recordarTab();
                setShowAdminEditor(true);
                setActiveTab("editor");
                setSelectedTripId(trip.id);
                setTimeout(() => {
                  document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 120);
              }}
              style={{
                background: hasDriver ? sc.chipBg : `linear-gradient(135deg, ${STATE.warning}, #d97706)`,
                border: hasDriver ? `1px solid ${sc.chipBorder}` : "none",
                borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 700,
                color: hasDriver ? sc.accent : SURFACE.card,
                boxShadow: hasDriver ? "none" : "0 2px 8px rgba(245,158,11,0.35)",
                cursor: "pointer",
              }}
            >
              {hasDriver ? "Gestionar servicio" : "Asignar conductor"}
            </button>

            <button type="button" onClick={() => setLogTrip(trip)}
              style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: pal.textMuted, cursor: "pointer" }}>
              Ver bitácora
            </button>
            {CANCELLABLE_STATUSES.has(trip.status || "") && (
              <button type="button" onClick={() => setPendingAction({ trip, kind: "cancel" })}
                style={{ background: SURFACE.card, border: "1px solid rgba(245,158,11,0.5)", borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: STATE.warningText, cursor: "pointer" }}>
                Cancelar
              </button>
            )}
            <button type="button" onClick={() => setPendingAction({ trip, kind: "delete" })}
              style={{ background: SURFACE.card, border: "1px solid rgba(239,68,68,0.4)", borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: STATE.danger, cursor: "pointer" }}>
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
            style={{ border: `1px solid ${SURFACE.border}`, borderRadius: "12px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: SURFACE.textSecondary, background: SURFACE.card, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Actualizando..." : "Refrescar ahora"}
          </button>
        }
      />


      {freshRequestIds.length > 0 && (
        <section style={{ borderRadius: "20px", border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.07)", padding: "16px 20px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ display: "inline-flex", width: "10px", height: "10px", borderRadius: "50%", background: STATE.success, animation: "pulse 1.5s infinite", flexShrink: 0 }} />
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
              style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: "1px solid rgba(16,185,129,0.35)", padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: STATE.success, background: SURFACE.card, cursor: "pointer" }}
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
            background: SURFACE.card,
            border: `1px solid ${SURFACE.border}`,
            borderTop: `3px solid ${pal.kpi[i]}`,
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
          }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SURFACE.textMuted, lineHeight: 1.2 }}>
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
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
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
        {/* Selección múltiple: punto de entrada para limpiar de una vez una
            importación completa, en vez de borrar viaje por viaje. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={filteredTrips.length === 0}
            style={{
              background: SURFACE.card,
              border: `1px solid ${SURFACE.border}`,
              borderRadius: "99px",
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: SURFACE.textSecondary,
              cursor: filteredTrips.length === 0 ? "not-allowed" : "pointer",
              opacity: filteredTrips.length === 0 ? 0.5 : 1,
            }}
          >
            Seleccionar los {filteredTrips.length} viajes filtrados
          </button>
          {selectedIds.size > 0 && (
            <span style={{ color: SURFACE.textMuted, fontSize: 13 }}>
              {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: STATE.danger }}>{error}</p>}
      </section>

      {/* ── NAVEGACIÓN PRIMARIA: ORIGEN DEL VIAJE ──
          Segmented control en estilo light, consistente con el resto del admin. */}
      <section
        className="surface rounded-2xl p-3"
        style={{
          background: SURFACE.card,
          border: `1px solid ${SURFACE.border}`,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        <p style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.22em",
          textTransform: "uppercase", color: SURFACE.textMuted,
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
                  background: active ? meta.bg : SURFACE.card,
                  color: active ? meta.color : SURFACE.textSecondary,
                  border: active
                    ? `1.5px solid ${meta.color}`
                    : `1px solid ${SURFACE.border}`,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: active ? `0 4px 12px ${meta.color}30` : "none",
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = SURFACE.bg;
                    e.currentTarget.style.borderColor = SURFACE.borderStrong;
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = SURFACE.card;
                    e.currentTarget.style.borderColor = SURFACE.border;
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
                  color: active ? SURFACE.card : meta.color,
                  flexShrink: 0,
                }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: active ? meta.color : SURFACE.text }}>
                    {meta.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: SURFACE.textFaint,
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
                  background: active ? meta.color : SURFACE.borderMuted,
                  color: active ? SURFACE.card : SURFACE.textSecondary,
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
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Timeline operativa")}</p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>{t("Estado general de viajes")}</h3>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted, background: SURFACE.bg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "4px 12px" }}>
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
                    background: hasItems ? sc.chipBg : SURFACE.borderMuted,
                    color: hasItems ? sc.accent : pal.textMuted,
                    border: hasItems ? `1px solid ${sc.chipBorder}` : `1px solid ${pal.cardBorder}`,
                  }}>
                    {items.length}
                  </span>
                </div>
                {/* Mini trip cards */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  // Desplegada, una columna con muchos viajes estiraba todo el
                  // tablero: se le pone scroll propio.
                  maxHeight: expandedColumns.has(status) ? "60vh" : undefined,
                  overflowY: expandedColumns.has(status) ? "auto" : undefined,
                }}>
                  {(expandedColumns.has(status) ? items : items.slice(0, COLUMN_PREVIEW)).map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setInfoTrip(trip)}
                      style={{
                        background: SURFACE.bg,
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
                  {items.length > COLUMN_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => toggleColumn(status)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "4px 0",
                        fontSize: "11px",
                        color: sc.accent,
                        textAlign: "center",
                        fontWeight: 700,
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      {expandedColumns.has(status)
                        ? t("Ver menos")
                        : `+${items.length - COLUMN_PREVIEW} ${t("más")}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
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
                    background: selected ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : SURFACE.borderMuted,
                    color: selected ? SURFACE.card : SURFACE.textSecondary,
                    boxShadow: selected ? "0 2px 8px rgba(33,208,179,0.35)" : "none",
                  }}>
                  {t(tab.label)}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "1px 7px",
                    borderRadius: 99,
                    background: selected ? "rgba(255,255,255,0.25)" : SURFACE.card,
                    color: selected ? SURFACE.card : SURFACE.textMuted,
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
                recordarTab();
                setActiveTab("editor");
                setShowAdminEditor(true);
                setSelectedTripId(null);
                setTripSource("MANUAL");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold rounded-lg"
              style={{
                padding: "7px 14px",
                background: `linear-gradient(135deg, ${BRAND.teal} 0%, #15B09A 100%)`,
                color: SURFACE.card, border: "none", cursor: "pointer",
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
                background: SURFACE.card, color: SURFACE.textSecondary,
                border: `1px solid ${SURFACE.borderStrong}`, cursor: "pointer",
              }}
            >
              <UploadIcon size={14} className="inline mr-1" />Importar
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
                  background: selected ? BRAND.teal : "transparent",
                  border: selected ? "none" : `1px solid transparent`,
                  transition: "all 150ms",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: selected ? "rgba(255,255,255,0.7)" : pal.labelColor }}>{t("Vista")}</p>
                  <p style={{ marginTop: "3px", fontSize: "13px", fontWeight: 700, color: selected ? SURFACE.card : pal.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(tab.label)}</p>
                </div>
                <span style={{
                  minWidth: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.2)" : pal.cardBg,
                  color: selected ? SURFACE.card : pal.textMuted,
                  border: selected ? "none" : `1px solid ${pal.cardBorder}`,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {/* ── EN CURSO: la operación viva ──
            Tabla, no tarjetas ni listas agrupadas: el día se elige arriba y la
            tabla muestra sólo ese día, paginada. Con una semana cargada, los
            encabezados de jornada intercalados obligaban a desplazarse a ciegas
            para saber dónde empieza cada día. */}
        {activeTab === "ongoing" && (
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>
                  {t("Operación viva")}
                </p>
                <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>{t("Viajes en curso")}</h3>
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
                {[
                  { label: t("En curso"), value: ongoingTrips.length, color: null },
                  { label: t("Sin conductor"), value: ongoingTrips.filter((tr) => !tr.driverId).length, color: STATE.warning },
                  { label: t("En ruta"), value: ongoingTrips.filter((tr) => tr.status === "EN_ROUTE" || tr.status === "PICKED_UP").length, color: STATE.info },
                ].map((k) => (
                  <span key={k.label} style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: pal.labelColor, whiteSpace: "nowrap" }}>
                      {k.label}
                    </span>
                    <span style={{
                      fontSize: "20px", lineHeight: 1, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                      color: k.color && k.value > 0 ? k.color : pal.textPrimary,
                    }}>
                      {k.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Filtros de la vista. Van con StyledSelect y no con el select
                nativo: el desplegable del sistema operativo rompe el lenguaje
                visual del resto del panel. */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <label className="text-sm block" style={{ minWidth: 230 }}>
                <span className="block mb-1" style={{ fontSize: "12px", color: pal.textMuted }}>{t("Jornada")}</span>
                <StyledSelect
                  value={ongoingDay}
                  onChange={(e) => { setOngoingDay(e.target.value); setOngoingPage(0); }}
                >
                  <option value="">{`${t("Todas las jornadas")} (${ongoingTrips.length})`}</option>
                  {ongoingDays.map((d) => (
                    <option key={d.key} value={d.key}>{`${d.label} (${d.count})`}</option>
                  ))}
                </StyledSelect>
              </label>

              <label className="text-sm block" style={{ minWidth: 180 }}>
                <span className="block mb-1" style={{ fontSize: "12px", color: pal.textMuted }}>{t("Disciplina")}</span>
                <StyledSelect
                  value={ongoingDiscipline}
                  onChange={(e) => { setOngoingDiscipline(e.target.value); setOngoingPage(0); }}
                >
                  <option value="">{t("Todas")}</option>
                  {ongoingDisciplines.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </StyledSelect>
              </label>

              <label className="text-sm block" style={{ minWidth: 200 }}>
                <span className="block mb-1" style={{ fontSize: "12px", color: pal.textMuted }}>{t("Hotel")}</span>
                <StyledSelect
                  value={ongoingHotel}
                  onChange={(e) => { setOngoingHotel(e.target.value); setOngoingPage(0); }}
                >
                  <option value="">{t("Todos")}</option>
                  {ongoingHoteles.map((h) => (
                    <option key={h.texto} value={h.texto}>{`${h.texto} (${h.total})`}</option>
                  ))}
                </StyledSelect>
              </label>

              <label className="text-sm block" style={{ minWidth: 220 }}>
                <span className="block mb-1" style={{ fontSize: "12px", color: pal.textMuted }}>{t("Sede")}</span>
                <StyledSelect
                  value={ongoingVenue}
                  onChange={(e) => { setOngoingVenue(e.target.value); setOngoingPage(0); }}
                >
                  <option value="">{t("Todas")}</option>
                  {ongoingSedes.map((v) => (
                    <option key={v.texto} value={v.texto}>{`${v.texto} (${v.total})`}</option>
                  ))}
                </StyledSelect>
              </label>

              {(ongoingDay || ongoingDiscipline || ongoingHotel || ongoingVenue) && (
                <button
                  type="button"
                  onClick={() => {
                    setOngoingDay("");
                    setOngoingDiscipline("");
                    setOngoingHotel("");
                    setOngoingVenue("");
                    setOngoingPage(0);
                  }}
                  style={{
                    border: `1px solid ${SURFACE.border}`, borderRadius: 8, background: SURFACE.card,
                    color: SURFACE.textMuted, padding: "9px 14px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {t("Limpiar filtros")}
                </button>
              )}
            </div>

            {ongoingFiltered.length === 0 ? (
              <div style={{ borderRadius: "14px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" }}>
                <ClockIcon size={22} color={pal.labelColor} strokeWidth={1.8} />
                <p style={{ marginTop: 10, color: pal.textMuted, fontSize: "14px", fontWeight: 500 }}>
                  {ongoingTrips.length === 0 ? t("No hay viajes en curso.") : t("Ningún viaje coincide con los filtros.")}
                </p>
                <p style={{ marginTop: 2, color: pal.labelColor, fontSize: "12.5px" }}>
                  {ongoingTrips.length === 0
                    ? t("Importa una planilla o crea uno manual para empezar el día.")
                    : t("Prueba quitando alguno de los filtros de arriba.")}
                </p>
              </div>
            ) : (
              <div>
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Barra de selección: la casilla de "todos" vive acá,
                        porque las filas ya no son una grilla con cabecera. */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 2px 10px",
                    }}>
                      <input
                        type="checkbox"
                        aria-label={t("Seleccionar todos los viajes de la vista")}
                        checked={ongoingFiltered.length > 0 && ongoingFiltered.every((tr) => selectedIds.has(tr.id))}
                        ref={(el) => {
                          if (el) {
                            const marcados = ongoingFiltered.filter((tr) => selectedIds.has(tr.id)).length;
                            el.indeterminate = marcados > 0 && marcados < ongoingFiltered.length;
                          }
                        }}
                        onChange={(e) => {
                          const marcar = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            ongoingFiltered.forEach((tr) => (marcar ? next.add(tr.id) : next.delete(tr.id)));
                            return next;
                          });
                        }}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: BRAND.teal }}
                      />
                      <span style={{ fontSize: 11.5, color: SURFACE.textMuted }}>
                        {t("Seleccionar todo")}
                      </span>
                    </div>

                    {ongoingVisible.map((trip) => {
                      const sc = STATUS_COLORS[trip.status ?? "SCHEDULED"] ?? STATUS_COLORS.SCHEDULED;
                      const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                      const marcado = selectedIds.has(trip.id);
                      const sinChofer = !trip.driverId;
                      const vehiculo = trip.vehicleId ? vehicles[trip.vehicleId]?.plate : trip.vehiclePlate;
                      const meta = [
                        sinChofer ? t("Sin conductor") : resolveDriver(trip),
                        vehiculo ? String(vehiculo).toUpperCase() : null,
                        trip.discipline || null,
                        trip.passengerCount ? `${trip.passengerCount} pax` : null,
                        trip.clientType || null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ");
                      return (
                        <div
                          key={trip.id}
                          style={{ display: "flex", alignItems: "center", gap: 10 }}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => toggleSelected(trip.id)}
                            aria-label={t("Seleccionar viaje")}
                            style={{ flexShrink: 0, width: 15, height: 15, cursor: "pointer", accentColor: BRAND.teal }}
                          />

                          {/* Misma tarjeta que el listado de tracking: barra de
                              estado a la izquierda, ruta como título, y al
                              pinchar se abre el detalle con el mapa. */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setInfoTrip(trip)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInfoTrip(trip); } }}
                            style={{
                              flex: 1, minWidth: 0,
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "13px 16px", borderRadius: 14,
                              border: `1px solid ${marcado ? "rgba(33,208,179,0.5)" : SURFACE.border}`,
                              borderLeft: `4px solid ${sc.accent}`,
                              background: marcado ? "rgba(33,208,179,0.06)" : SURFACE.card,
                              cursor: "pointer", transition: "all .15s",
                            }}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = SURFACE.bg;
                              el.style.borderColor = SURFACE.borderStrong;
                              el.style.borderLeftColor = sc.accent;
                              el.style.transform = "translateX(2px)";
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = marcado ? "rgba(33,208,179,0.06)" : SURFACE.card;
                              el.style.borderColor = marcado ? "rgba(33,208,179,0.5)" : SURFACE.border;
                              el.style.borderLeftColor = sc.accent;
                              el.style.transform = "";
                            }}
                          >
                            <span style={{ flexShrink: 0, width: 10, height: 10, borderRadius: "50%", background: sc.accent, boxShadow: `0 0 0 4px ${sc.chipBg}` }} />

                            <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: SURFACE.text, fontVariantNumeric: "tabular-nums", width: 46 }}>
                              {trip.scheduledAt
                                ? new Date(trip.scheduledAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })
                                : "—"}
                            </span>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                                  {trip.origin || t("Origen pendiente")}{" "}
                                  <span style={{ color: SURFACE.textFaint, display: "inline-flex", verticalAlign: "middle" }}><ArrowRightIcon size={12} /></span>{" "}
                                  {venue?.name || trip.destination || t("Destino pendiente")}
                                </span>
                                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, color: sc.accent }}>
                                  {t(statusTone(trip.status).label)}
                                </span>
                                {sinChofer && (
                                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: STATE.warningSoft, border: `1px solid ${STATE.warningBorder}`, color: STATE.warningText }}>
                                    {t("Por asignar")}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {meta}
                              </p>
                            </div>

                            <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  recordarTab();
                                  setShowAdminEditor(true);
                                  setActiveTab("editor");
                                  setSelectedTripId(trip.id);
                                  setTimeout(() => {
                                    document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }, 120);
                                }}
                                title={t("Editar viaje")}
                                style={ONGOING_ACTION_STYLE}
                              >
                                <PenLineIcon size={13} strokeWidth={1.8} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setLogTrip(trip)}
                                title={t("Ver bitácora")}
                                style={ONGOING_ACTION_STYLE}
                              >
                                <FileTextIcon size={13} strokeWidth={1.8} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingAction({ trip, kind: "delete" })}
                                title={t("Eliminar viaje")}
                                style={{ ...ONGOING_ACTION_STYLE, color: STATE.danger }}
                              >
                                <TrashIcon size={13} strokeWidth={1.8} />
                              </button>
                              <ChevronRightIcon size={16} color={SURFACE.borderStrong} strokeWidth={2} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pie: sin esto, una semana cargada es un scroll sin fin. */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "12px 4px 0",
                }}>
                  <span style={{ fontSize: "12px", color: pal.textMuted, fontVariantNumeric: "tabular-nums" }}>
                    {ongoingFiltered.length === 0
                      ? "0"
                      : `${ongoingPage * ONGOING_PAGE_SIZE + 1}–${Math.min((ongoingPage + 1) * ONGOING_PAGE_SIZE, ongoingFiltered.length)}`}{" "}
                    {t("de")} {ongoingFiltered.length}
                  </span>
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setOngoingPage((p) => Math.max(0, p - 1))}
                      disabled={ongoingPage === 0}
                      style={ongoingPaginaStyle(ongoingPage === 0)}
                    >
                      {t("Anterior")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOngoingPage((p) => (p + 1 < ongoingTotalPages ? p + 1 : p))}
                      disabled={ongoingPage + 1 >= ongoingTotalPages}
                      style={ongoingPaginaStyle(ongoingPage + 1 >= ongoingTotalPages)}
                    >
                      {t("Siguiente")}
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "dispatch" && (
          <div className="mt-6 space-y-5">
            {/* ── Resumen del despacho: qué falta y qué está cubierto ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div style={{
                borderRadius: "16px", padding: "14px 18px",
                background: pendingAssignment.length > 0 ? `linear-gradient(135deg, ${STATE.warningSoft}, ${STATE.warningSoft})` : STATE.successSoft,
                border: `1px solid ${pendingAssignment.length > 0 ? "#fcd34d" : "#86efac"}`,
              }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: pendingAssignment.length > 0 ? STATE.warningText : STATE.successText }}>
                  Asignación pendiente
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: pendingAssignment.length > 0 ? STATE.warningText : STATE.success }}>
                  {pendingAssignment.length}
                </p>
                <p style={{ fontSize: "11px", color: pendingAssignment.length > 0 ? STATE.warningText : STATE.successText, marginTop: 2 }}>
                  {pendingAssignment.length > 0 ? "servicios a la espera de conductor" : "programación completamente cubierta"}
                </p>
              </div>
              <div style={{ borderRadius: "16px", padding: "14px 18px", background: STATE.successSoft, border: `1px solid ${STATE.successBorder}` }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: STATE.successText }}>
                  Servicios confirmados
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: STATE.success }}>
                  {readyToGo.length}
                </p>
                <p style={{ fontSize: "11px", color: STATE.successText, marginTop: 2 }}>con conductor · pasan a Activos al iniciar</p>
              </div>
              <div style={{ borderRadius: "16px", padding: "14px 18px", background: SURFACE.card, border: `1px solid ${pal.cardBorder}` }}>
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
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: STATE.warningText }}>Cola de asignación</p>
                    <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: SURFACE.text }}>Servicios por asignar</h3>
                    <p style={{ marginTop: "2px", fontSize: "12px", color: pal.textMuted }}>
                      Solicitudes del portal, planilla operativa y registros manuales sin conductor, ordenados por hora de salida.
                    </p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 700, color: STATE.warningText }}>
                    {pendingAssignment.length} pendiente{pendingAssignment.length === 1 ? "" : "s"}
                  </span>
                </div>
                {pendingAssignment.length === 0 ? (
                  <div style={{ borderRadius: "20px", border: `1px dashed ${STATE.successBorder}`, background: STATE.successSoft, padding: "48px 24px", textAlign: "center" as const, fontSize: "14px", color: STATE.successText }}>
                    No hay servicios pendientes de asignación. Las nuevas solicitudes aparecerán aquí automáticamente.
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
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: STATE.successText }}>Programación confirmada</p>
                    <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: SURFACE.text }}>Servicios confirmados</h3>
                    <p style={{ marginTop: "2px", fontSize: "12px", color: pal.textMuted }}>
                      Con conductor y vehículo definidos, a la espera del inicio del servicio.
                    </p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", padding: "6px 16px", fontSize: "13px", fontWeight: 700, color: STATE.successText }}>
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
                <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: SURFACE.text }}>{t("Seguimiento de servicio en curso")}</h3>
              </div>
              <Link
                href="/operations/vehicle-positions"
                style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: `1px solid ${SURFACE.border}`, padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: SURFACE.textSecondary, textDecoration: "none", background: SURFACE.card }}
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
                  {/* Filas de 6 columnas: scroll horizontal en pantallas
                      chicas en vez de aplastarse bajo el overflow hidden. */}
                  <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: "720px" }}>
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
                          {sc.accent === STATE.success && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.accent, display: "inline-block" }} />}
                          {t(statusTone(trip.status).label)}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{resolveRequester(trip)}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{venue?.name || trip.destination || "-"}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{resolveDriver(trip)}</span>
                        <span style={{ fontSize: "12px", color: pal.labelColor, fontVariantNumeric: "tabular-nums" }}>{formatDateTime(trip.completedAt || trip.updatedAt)}</span>
                        {/* Un viaje cerrado también se corrige: la hora real,
                            el conductor que finalmente lo hizo, los pasajeros.
                            Antes el historial era de sólo lectura. */}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => {
                              recordarTab();
                              setShowAdminEditor(true);
                              setActiveTab("editor");
                              setSelectedTripId(trip.id);
                              setTimeout(() => {
                                document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 120);
                            }}
                            title={t("Editar viaje")}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 12px", borderRadius: "8px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.textSecondary, fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            <PenLineIcon size={12} strokeWidth={2} />
                            {t("Editar")}
                          </button>
                          <button type="button" onClick={() => setLogTrip(trip)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 12px", borderRadius: "8px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.textSecondary, fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            <FileTextIcon size={12} strokeWidth={2} />
                            Ver bitácora
                          </button>
                        </span>
                      </div>
                    );
                  })}
                  </div>
                  </div>
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
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: SURFACE.text }}>Viajes VIP / T1</h3>
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
                  style={{ background: BRAND.teal, border: "none", borderRadius: "99px", padding: "8px 22px", fontSize: "13px", fontWeight: 700, color: SURFACE.card, cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.7 : 1 }}>
                  {importing ? "Importando…" : "Importar viajes"}
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: SURFACE.bg }}>
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
            <p style={{ fontSize: "13px", fontWeight: 600, color: importErrors.length ? STATE.warning : STATE.success }}>{importResult}</p>
          )}
          {importErrors.length > 0 && (
            <ul style={{ fontSize: "12px", color: STATE.danger, paddingLeft: "16px", lineHeight: 1.8 }}>
              {importErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </section>
      )}

      {showAdminEditor && activeTab === "editor" && (
        <section id="trip-editor-section" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "24px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>{t("Gestion manual")}</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: SURFACE.text }}>{t("Gestión manual de viajes")}</h3>
              <p style={{ marginTop: "6px", maxWidth: "600px", fontSize: "13px", color: SURFACE.textMuted }}>
                Mantiene el CRUD completo para reasignar chofer, vehículo, estados y datos del viaje sin ensuciar la vista principal.
              </p>
            </div>
            <button
              type="button"
              onClick={cerrarEditor}
              style={{ display: "inline-flex", alignItems: "center", borderRadius: "99px", border: `1px solid ${SURFACE.border}`, padding: "6px 16px", fontSize: "13px", fontWeight: 600, color: SURFACE.textSecondary, background: SURFACE.card, cursor: "pointer" }}
            >
              Cerrar editor
            </button>
          </div>
          <ResourceScreen
            config={resources.trips}
            externalEditingId={selectedTripId}
            // Cancelar la edición y cerrar el editor eran dos pasos para lo
            // mismo: quien cancela quiere volver a la lista, no quedarse en un
            // formulario vacío.
            onEditCancelled={cerrarEditor}
          />
        </section>
      )}
      {/* ── Modal Bitácora ── */}
      {infoTrip && (() => {
        const isc = STATUS_COLORS[infoTrip.status ?? ""] ?? STATUS_COLORS.SCHEDULED;
        const itone = statusTone(infoTrip.status);
        const ivenue = infoTrip.destinationVenueId ? venues[infoTrip.destinationVenueId] : null;
        const idestino = ivenue ? buildVenueAddress(ivenue) : safeText(infoTrip.destination, "Destino pendiente");
        // Región y disciplina salen del viaje mismo: en los Juegos Escolares el
        // traslado se asigna a la delegación (región) + deporte y no a una
        // persona. Si el viaje no las trae cargadas, se deducen de los
        // pasajeros, que es como se resolvían hasta ahora.
        const iporPasajeros = resolveDelegation(infoTrip);
        const iregion =
          delegationLabel(infoTrip.delegationId ? delegations[infoTrip.delegationId] : null) ||
          (iporPasajeros === "-" ? "" : iporPasajeros);
        const idisciplina = safeText(infoTrip.discipline, "");
        const itipoViaje = tripTypeLabel(infoTrip.tripType);
        const itramo = legTypeLabel(infoTrip.legType);
        const iparticipantes = infoTrip.athleteNames?.length ? infoTrip.athleteNames.join(", ") : "";

        // Clasificación con etiqueta, no chips sueltos: un "VOLEIBOL" a secas
        // no dice si es la disciplina o la actividad. Región, disciplina y
        // tipo de viaje salen siempre —con guión si el viaje no los trae—
        // porque su ausencia también es información: los traslados que entran
        // por la planilla de operatividad no traen delegación.
        const iclases: { label: string; value: string; destacado?: boolean }[] = [
          { label: "Región", value: iregion || "—", destacado: Boolean(iregion) },
          { label: "Disciplina", value: idisciplina || "—", destacado: Boolean(idisciplina) },
          { label: "Tipo de viaje", value: itipoViaje || "—", destacado: Boolean(itipoViaje) },
          ...(infoTrip.clientType ? [{ label: "Tipo de cliente", value: t(clientTypeLabel(infoTrip.clientType)) }] : []),
          ...(itramo ? [{ label: "Tramo", value: infoTrip.isRoundTrip ? `${itramo} · ${t("ida y vuelta")}` : itramo }] : []),
          ...(infoTrip.committeeValidated ? [{ label: "Comité", value: t("Validado") }] : []),
        ];

        // "Más info": sólo lo que este viaje trae cargado. Una grilla llena de
        // guiones ocupa pantalla y no informa nada.
        const imasInfo: { label: string; value: string }[] = [
          ...(infoTrip.requestedAt ? [{ label: "Solicitado", value: formatDateTime(infoTrip.requestedAt) }] : []),
          ...(infoTrip.startedAt ? [{ label: "Inicio real", value: formatDateTime(infoTrip.startedAt) }] : []),
          ...(infoTrip.completedAt ? [{ label: "Término", value: formatDateTime(infoTrip.completedAt) }] : []),
          ...(infoTrip.travelTimeMinutes ? [{ label: "Duración estimada", value: `${infoTrip.travelTimeMinutes} min` }] : []),
          ...(infoTrip.returnAt ? [{ label: "Regreso", value: formatDateTime(infoTrip.returnAt) }] : []),
          // La importación de planilla guarda la actividad también en
          // `trip_type`, así que se omite cuando ya se ve arriba.
          ...(infoTrip.activity?.trim() && infoTrip.activity.trim() !== itipoViaje
            ? [{ label: "Actividad", value: infoTrip.activity.trim() }]
            : []),
          ...(infoTrip.fleetAcronym?.trim() ? [{ label: "Flota", value: infoTrip.fleetAcronym.trim() }] : []),
          ...(infoTrip.wheelchairCount ? [{ label: "Sillas de ruedas", value: String(infoTrip.wheelchairCount) }] : []),
          ...(infoTrip.flightNumber?.trim() ? [{ label: "Vuelo", value: infoTrip.flightNumber.trim() }] : []),
          ...(infoTrip.requestedVehicleType
            ? [{ label: "Vehículo pedido", value: VEHICLE_TYPE_LABELS[infoTrip.requestedVehicleType] || infoTrip.requestedVehicleType }]
            : []),
          ...(infoTrip.tripCost != null ? [{ label: "Valor", value: formatCLP(infoTrip.tripCost) }] : []),
        ];

        const microEtiqueta = { fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: SURFACE.textFaint, margin: "0 0 3px" };
        const valorTexto = { fontSize: "13px", fontWeight: 600, color: SURFACE.text, margin: 0, lineHeight: 1.35 };
        const cajaDato = { background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: "12px", padding: "9px 12px" };
        const tituloSeccion = { fontSize: "9px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: SURFACE.textFaint, margin: "14px 0 8px" };
        const dato = (label: string, value: string, ancho?: boolean) => (
          <div key={label} style={{ ...cajaDato, gridColumn: ancho ? "1 / -1" : undefined }}>
            <p style={microEtiqueta}>{t(label)}</p>
            <p style={valorTexto}>{value}</p>
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setInfoTrip(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "520px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}`, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 4px" }}>{t("Detalle del viaje")}</p>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: SURFACE.text, margin: 0 }}>{resolveRequester(infoTrip)}</p>
                </div>
                <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: isc.accent, background: isc.chipBg, border: `1px solid ${isc.chipBorder}`, borderRadius: "99px", padding: "5px 12px" }}>
                  {t(itone.label)}
                </span>
              </div>
              {/* Datos */}
              <div style={{ padding: "16px 24px", overflowY: "auto" }}>
                {/* De quién es el viaje, antes del mapa: al abrir un traslado
                    lo primero que se pregunta la operación es de qué región y
                    de qué deporte es el grupo que se sube. */}
                <p style={{ ...tituloSeccion, marginTop: 0 }}>{t("Clasificación")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  {iclases.map((c) => (
                    <div
                      key={c.label}
                      style={{
                        background: c.destacado ? "rgba(33,208,179,0.06)" : SURFACE.bg,
                        border: `1px solid ${c.destacado ? "rgba(33,208,179,0.22)" : SURFACE.border}`,
                        borderRadius: "12px",
                        padding: "8px 11px",
                      }}
                    >
                      <p style={microEtiqueta}>{t(c.label)}</p>
                      <p style={{ ...valorTexto, color: c.value === "—" ? SURFACE.textFaint : SURFACE.text }}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* La ruta: es lo otro que se viene a ver al abrir un viaje. */}
                {(() => {
                  const embed = buildDirectionsEmbed(infoTrip.origin, ivenue ? buildVenueAddress(ivenue) : infoTrip.destination);
                  if (!embed) return null;
                  return (
                    <div style={{ marginBottom: 14, borderRadius: 14, overflow: "hidden", border: `1px solid ${SURFACE.border}` }}>
                      <iframe
                        title={t("Ruta del viaje")}
                        src={embed}
                        style={{ width: "100%", height: 220, border: "none", display: "block" }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  );
                })()}

                {/* Cuándo: la hora del pasajero y, si la hay, la de
                    presentación del conductor, que es la que él tiene que
                    cumplir y no es la misma. */}
                <div style={{ display: "grid", gridTemplateColumns: infoTrip.presentationAt ? "1fr 1fr" : "1fr", gap: "10px" }}>
                  <div style={{ background: "rgba(33,208,179,0.07)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "12px", padding: "9px 12px" }}>
                    <p style={{ ...microEtiqueta, color: BRAND.tealInk }}>{t("Programación")}</p>
                    <p style={valorTexto}>{formatDateTime(infoTrip.scheduledAt)}</p>
                  </div>
                  {infoTrip.presentationAt && (
                    <div style={cajaDato}>
                      <p style={microEtiqueta}>{t("Presentación conductor")}</p>
                      <p style={valorTexto}>{formatDateTime(infoTrip.presentationAt)}</p>
                    </div>
                  )}
                </div>

                {/* Ruta en línea de tiempo: origen arriba, destino abajo. En
                    dos cajas sueltas no se leía cuál era cuál. */}
                <p style={tituloSeccion}>{t("Ruta")}</p>
                <div style={{ display: "flex", gap: "12px", ...cajaDato }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4px" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${BRAND.teal}`, background: SURFACE.card, flexShrink: 0 }} />
                    <span style={{ width: 2, flex: 1, minHeight: 20, margin: "3px 0", borderRadius: 1, background: `linear-gradient(180deg, ${BRAND.teal}, ${STATE.danger})`, opacity: 0.35 }} />
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATE.danger, flexShrink: 0 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                      <p style={microEtiqueta}>{t("Origen")}</p>
                      <p style={valorTexto}>{safeText(infoTrip.origin, "Origen pendiente")}</p>
                    </div>
                    <div>
                      <p style={microEtiqueta}>{t("Destino")}</p>
                      <p style={valorTexto}>{idestino}</p>
                    </div>
                  </div>
                </div>

                {/* Quién lo hace */}
                <p style={tituloSeccion}>{t("Asignación")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {dato("Conductor", infoTrip.driverId ? (drivers[infoTrip.driverId]?.fullName || t("Asignado")) : t("Por asignar"))}
                  {dato("Vehículo", infoTrip.vehicleId || infoTrip.vehiclePlate ? resolveVehicle(infoTrip) : t("Por asignar"))}
                  {infoTrip.passengerCount ? dato("Pasajeros", String(infoTrip.passengerCount)) : null}
                  {iparticipantes ? dato("Participantes", iparticipantes, !infoTrip.passengerCount) : null}
                </div>

                {imasInfo.length > 0 && (
                  <>
                    <p style={tituloSeccion}>{t("Más info")}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {imasInfo.map((f) => dato(f.label, f.value))}
                    </div>
                  </>
                )}

                {infoTrip.notes && (
                  <p style={{ marginTop: "12px", fontSize: "12.5px", color: STATE.warningText, background: STATE.warningSoft, border: `1px solid ${STATE.warningBorder}`, borderLeft: `4px solid ${STATE.warning}`, borderRadius: 10, padding: "8px 12px", fontWeight: 600 }}>
                    <span style={{ fontWeight: 800, color: STATE.warningText }}><AlertIcon size={12} className="inline mr-1" />{t("Observación")}:</span>{" "}
                    {safeText(infoTrip.notes.replace(/^\[Portal\]\s*/, ""))}
                  </p>
                )}
              </div>
              {/* Acciones */}
              <div style={{ padding: "14px 24px 18px", borderTop: `1px solid ${SURFACE.borderMuted}`, flexShrink: 0, display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setInfoTrip(null)}
                  style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: SURFACE.textMuted, cursor: "pointer" }}>
                  Cerrar
                </button>
                <button type="button" onClick={() => { setLogTrip(infoTrip); setInfoTrip(null); }}
                  style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: SURFACE.textSecondary, cursor: "pointer" }}>
                  Ver bitácora
                </button>
                <button type="button" onClick={() => {
                    const target = infoTrip;
                    recordarTab();
                    setInfoTrip(null);
                    setShowAdminEditor(true);
                    setActiveTab("editor");
                    setSelectedTripId(target.id);
                    setTimeout(() => {
                      document.getElementById("trip-editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 120);
                  }}
                  style={{ background: `linear-gradient(135deg, ${BRAND.teal}, #14b8a6)`, border: "none", borderRadius: "99px", padding: "8px 18px", fontSize: "13px", fontWeight: 700, color: SURFACE.card, cursor: "pointer", boxShadow: "0 2px 8px rgba(20,184,166,0.35)" }}>
                  Editar viaje
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {logTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setLogTrip(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}`, flexShrink: 0 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 4px" }}>Bitácora del viaje</p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: SURFACE.text, margin: 0 }}>{resolveRequester(logTrip)} → {logTrip.destination || "Sin destino"}</p>
            </div>
            {/* Log entries */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {(() => {
                const log = Array.isArray((logTrip.metadata as any)?.log) ? (logTrip.metadata as any).log as { action: string; by: string; at: string; detail?: string }[] : [];
                const ACTION_LABELS: Record<string, { label: string; color: string }> = {
                  CREATED: { label: "Solicitud creada", color: STATE.info },
                  MODIFIED: { label: "Modificado por usuario", color: STATE.warning },
                  CANCELLED: { label: "Cancelado por usuario", color: STATE.danger },
                  DRIVER_ASSIGNED: { label: "Conductor asignado", color: STATE.success },
                  VEHICLE_ASSIGNED: { label: "Vehículo asignado", color: STATE.success },
                  STATUS_CHANGED: { label: "Estado actualizado", color: ACCENT.violetLight },
                  SCHEDULE_CHANGED: { label: "Horario modificado", color: "#0ea5e9" },
                  VEHICLE_TYPE_CHANGED: { label: "Tipo vehículo cambiado", color: STATE.warning },
                  PASSENGER_COUNT_CHANGED: { label: "Pasajeros modificados", color: STATE.warning },
                };
                if (log.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "32px 0", color: SURFACE.textFaint }}>
                      <FileTextIcon size={24} color={SURFACE.borderStrong} strokeWidth={1.5} style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: "13px", margin: 0 }}>Sin registros en la bitácora</p>
                    </div>
                  );
                }
                return (
                  <div style={{ position: "relative", paddingLeft: "20px" }}>
                    {/* Timeline line */}
                    <div style={{ position: "absolute", left: "5px", top: "4px", bottom: "4px", width: "2px", background: SURFACE.border, borderRadius: "1px" }} />
                    {log.map((entry, i) => {
                      const info = ACTION_LABELS[entry.action] ?? { label: entry.action, color: SURFACE.textMuted };
                      const date = new Date(entry.at);
                      const timeStr = !isNaN(date.getTime()) ? date.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                      return (
                        <div key={i} style={{ position: "relative", marginBottom: i < log.length - 1 ? "16px" : 0 }}>
                          {/* Dot */}
                          <div style={{ position: "absolute", left: "-20px", top: "2px", width: "12px", height: "12px", borderRadius: "50%", background: SURFACE.card, border: `2px solid ${info.color}`, zIndex: 1 }} />
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: info.color, margin: "0 0 2px" }}>{info.label}</p>
                            {entry.detail && <p style={{ fontSize: "11px", color: SURFACE.textMuted, margin: "0 0 2px", background: SURFACE.borderMuted, borderRadius: "4px", padding: "2px 8px", display: "inline-block" }}>{humanizeLogDetail(entry.detail)}</p>}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                              <span style={{ fontSize: "11px", color: SURFACE.textFaint }}>{entry.by}</span>
                              <span style={{ fontSize: "10px", color: SURFACE.borderStrong }}>•</span>
                              <span style={{ fontSize: "11px", color: SURFACE.textFaint }}>{timeStr}</span>
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
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${SURFACE.borderMuted}` }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 10px" }}>
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
                              style={{ width: "150px", height: "100px", objectFit: "cover", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, display: "block" }} />
                            <p style={{ fontSize: "11.5px", fontWeight: 700, color: SURFACE.text, margin: "6px 0 0" }}>
                              {p.kind === "start" ? "Inicio de jornada" : "Término de jornada"}
                            </p>
                            <p style={{ fontSize: "10.5px", color: SURFACE.textFaint, margin: "1px 0 0" }}>{timeStr}</p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 24px", borderTop: `1px solid ${SURFACE.borderMuted}`, flexShrink: 0, textAlign: "center" }}>
              <button type="button" onClick={() => setLogTrip(null)}
                style={{ padding: "10px 32px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.3)" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra flotante de selección múltiple ──
          Aparece sólo con algo seleccionado y queda fija sobre el contenido,
          para no tener que volver arriba después de marcar viajes. */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "24px",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px 10px 18px",
            background: SURFACE.card,
            border: `1px solid ${SURFACE.border}`,
            borderRadius: "999px",
            boxShadow: "0 14px 38px rgba(15,23,42,0.26)",
            maxWidth: "calc(100vw - 32px)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: SURFACE.textSecondary, whiteSpace: "nowrap" }}>
            {selectedIds.size} viaje{selectedIds.size === 1 ? "" : "s"} seleccionado{selectedIds.size === 1 ? "" : "s"}
          </span>
          {/* En "En curso" el seleccionar-todo vive en la cabecera de la lista
              y abarca sólo esa vista; ofrecer aquí "los N filtrados" metería
              viajes ya cerrados en la selección sin que se vean. */}
          {selectedIds.size < filteredTrips.length && activeTab !== "ongoing" && (
            <button
              type="button"
              onClick={selectAllFiltered}
              style={{
                background: "transparent", border: "none", borderRadius: "99px",
                padding: "6px 10px", fontSize: 13, fontWeight: 600,
                color: BRAND.teal, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Seleccionar los {filteredTrips.length}
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            style={{
              background: "transparent", border: `1px solid ${SURFACE.borderMuted}`, borderRadius: "99px",
              padding: "6px 14px", fontSize: 13, fontWeight: 600,
              color: SURFACE.textMuted, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setBulkDeleteOpen(true)}
            style={{
              background: STATE.danger, border: "none", borderRadius: "99px",
              padding: "8px 18px", fontSize: 13, fontWeight: 700,
              color: SURFACE.card, cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(239,68,68,0.4)",
            }}
          >
            Eliminar seleccionados
          </button>
        </div>
      )}

      {bulkNotice && (
        <div
          style={{
            position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)",
            zIndex: 60, padding: "10px 18px", background: SURFACE.card,
            border: `1px solid ${SURFACE.border}`, borderRadius: "999px",
            boxShadow: "0 14px 38px rgba(15,23,42,0.26)", fontSize: 13, fontWeight: 600,
            color: SURFACE.textSecondary, display: "flex", alignItems: "center", gap: 12,
          }}
        >
          {bulkNotice}
          <button
            type="button"
            onClick={() => setBulkNotice(null)}
            style={{ background: "transparent", border: "none", color: SURFACE.textMuted, cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Confirmación de borrado en lote ── */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        danger
        title={`Eliminar ${selectedIds.size} viaje${selectedIds.size === 1 ? "" : "s"}`}
        message={
          `Se eliminarán definitivamente ${selectedIds.size} viaje(s) seleccionado(s), ` +
          "incluidos sus tramos de regreso, y no se podrán recuperar. ¿Eliminar?"
        }
        confirmLabel={bulkBusy ? "Eliminando…" : "Eliminar"}
        cancelLabel="Volver"
        onConfirm={runBulkDelete}
        onCancel={() => { if (!bulkBusy) setBulkDeleteOpen(false); }}
      />

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
