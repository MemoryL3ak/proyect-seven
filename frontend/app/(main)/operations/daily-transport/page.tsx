"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import FileDropZone from "@/components/ui/FileDropZone";
import EmptyStateBox from "@/components/ui/EmptyState";
import KpiCard from "@/components/ui/KpiCard";
import { clientTypeLabel } from "@/lib/clientTypes";
import {
  TruckIcon,
  UploadIcon,
  SettingsIcon,
  CalendarIcon,
  RefreshIcon,
  AlertIcon,
  CheckIcon,
  UsersIcon,
} from "@/components/ui/Icons";

// Etiqueta + color de badge por estado de viaje, consistente con el resto del
// admin (mismos estados que la pantalla Operaciones / Viajes).
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: "Solicitado", cls: "badge-amber" },
  SCHEDULED: { label: "Programado", cls: "badge-blue" },
  ASSIGNED: { label: "Asignado", cls: "badge-gold" },
  EN_ROUTE: { label: "En ruta", cls: "badge-emerald" },
  PICKED_UP: { label: "En curso", cls: "badge-emerald" },
  DROPPED_OFF: { label: "Dejado", cls: "badge-slate" },
  COMPLETED: { label: "Completado", cls: "badge-slate" },
  CANCELLED: { label: "Cancelado", cls: "badge-rose" },
};
const statusBadge = (status?: string | null) =>
  STATUS_BADGE[String(status || "").toUpperCase()] ?? {
    label: status || "—",
    cls: "badge-slate",
  };

// Tramo del viaje (lo genera el backend en inglés) → etiqueta en español.
const LEG_TYPE_LABEL: Record<string, string> = {
  OUTBOUND: "Ida",
  RETURN: "Vuelta",
};
const legTypeLabel = (v?: string | null) =>
  LEG_TYPE_LABEL[String(v || "").toUpperCase()] ?? (v || "—");

type Event = {
  id: string;
  name?: string | null;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
};
type Driver = {
  id: string;
  fullName: string;
  allowedClientTypes?: string[] | null;
  vehicleId?: string | null;
};
type ScheduleRow = {
  busNumber?: string;
  legType?: string;
  clientType?: string;
  clientName?: string;
  date?: string;
  discipline?: string;
  gender?: string;
  activity?: string;
  presentationTime?: string;
  originName?: string;
  originAddress?: string;
  departureTime?: string;
  travelTime?: string;
  arrivalTime?: string;
  destinationName?: string;
  destinationAddress?: string;
  returnTime?: string;
  passengerCount?: number;
  wheelchairCount?: number;
  fleetAcronym?: string;
  fleetType?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  observation?: string;
};
type ImportResult = {
  created: Array<{ index: number; id: string }>;
  skipped: Array<{ index: number; reason: string }>;
  createdCount: number;
  skippedCount: number;
};
type AssignParams = {
  eventId?: string;
  date?: string;
  clientType?: string;
  fleetAcronym?: string;
  dryRun?: boolean;
  enforceClientTypeMatch?: boolean;
  enforceFleetTypeMatch?: boolean;
  respectVehicleCapacity?: boolean;
  respectWheelchair?: boolean;
  prioritizeRoundTrips?: boolean;
  bufferMinutes?: number;
  maxTripsPerDriver?: number | null;
  strategy?: "least_loaded" | "first_available" | "longest_idle";
};
type AssignResult = {
  assigned: Array<{ tripId: string; driverId: string; driverName: string }>;
  unassigned: Array<{ tripId: string; reason: string }>;
  assignedCount: number;
  unassignedCount: number;
  dryRun?: boolean;
  message?: string;
};
type Trip = {
  id: string;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  presentationAt?: string | null;
  presentation_at?: string | null;
  returnAt?: string | null;
  return_at?: string | null;
  origin?: string | null;
  destination?: string | null;
  clientType?: string | null;
  client_type?: string | null;
  fleetAcronym?: string | null;
  fleet_acronym?: string | null;
  status?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
  passengerCount?: number | null;
  passenger_count?: number | null;
  wheelchairCount?: number | null;
  wheelchair_count?: number | null;
  tripDate?: string | null;
  trip_date?: string | null;
  legType?: string | null;
  leg_type?: string | null;
};

const CLIENT_TYPES = [
  { value: "TF", label: "TF — Oficiales Técnicos" },
  { value: "TM", label: "TM — Medios / Prensa" },
  { value: "TA", label: "TA — Team Atleta" },
  { value: "VIP", label: "VIP" },
  { value: "T1", label: "T1" },
  { value: "FAMILIA_PARAPAN", label: "Familia Parapan" },
  { value: "COMITE_ORGANIZADOR", label: "Comité Organizador" },
  { value: "PROVEEDORES", label: "Proveedores" },
];

const FLEET_TYPES = [
  { value: "M1", label: "M1 — Van" },
  { value: "M4", label: "M4 — Bus 44" },
  { value: "M5", label: "M5 — Van Adaptada" },
];

const COLUMN_ALIASES: Record<string, string> = {
  "n°bus": "busNumber",
  "nºbus": "busNumber",
  "n° bus": "busNumber",
  "destino": "legType",
  "acronimo": "clientType",
  "tipo de cliente": "clientName",
  "fecha": "date",
  "disciplina": "discipline",
  "genero": "gender",
  "género": "gender",
  "actividad": "activity",
  "presentación": "presentationTime",
  "presentacion": "presentationTime",
  "presentación ": "presentationTime",
  "lugar origen": "originName",
  "dirección": "originAddress",
  "direccion": "originAddress",
  "hora llegada bus": "departureTime",
  "hora salida origen": "departureTime",
  "t° traslado": "travelTime",
  "tº traslado": "travelTime",
  "t traslado": "travelTime",
  "hora llegada recinto": "arrivalTime",
  " recinto": "destinationName",
  "recinto": "destinationName",
  "regresar a las": "returnTime",
  "capacidad vuelta": "passengerCount",
  "sillas de rueda": "wheelchairCount",
  "pax": "passengerCount",
  "acronimo flota": "fleetAcronym",
  "tipo flota": "fleetType",
  "patente": "vehiclePlate",
  "conductor": "driverName",
  "teléfono": "driverPhone",
  "telefono": "driverPhone",
  "notas": "notes",
  "obs": "observation",
  "observacion": "observation",
  "observación": "observation",
};

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Búsqueda de columnas insensible a acentos: la planilla real usa "Acrónimo",
// "Acrónimo Flota", "Presentación", etc. con tilde, que antes no matcheaban
// contra los alias sin tilde y dejaban sin mapear tipo de cliente y flota.
const NORMALIZED_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([k, v]) => [stripAccents(k), v]),
);

function normalizeKey(key: string): string | null {
  const k = stripAccents(String(key || "").toLowerCase().trim());
  return NORMALIZED_ALIASES[k] ?? null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const DATE_FIELDS = new Set(["date"]);
const TIME_FIELDS = new Set([
  "presentationTime",
  "departureTime",
  "arrivalTime",
  "returnTime",
]);

// Excel entrega las celdas de fecha/hora como números (serial de fecha o
// fracción de día) apenas el archivo se abre/edita/guarda en Excel. El backend
// espera texto "YYYY-MM-DD" y "HH:MM"; sin esta conversión todas las filas se
// saltan con "Fecha inválida" / "Sin hora de salida/llegada" y no se crea
// ningún viaje. Usamos el decodificador de seriales de SheetJS (XLSX.SSF).
function coerceCell(norm: string, value: unknown): string {
  const isDate = DATE_FIELDS.has(norm);
  const isTime = TIME_FIELDS.has(norm);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (isDate)
      return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    if (isTime) return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }

  if ((isDate || isTime) && typeof value === "number" && Number.isFinite(value)) {
    const c = XLSX.SSF.parse_date_code(value);
    if (c) {
      if (isDate) return `${c.y}-${pad2(c.m)}-${pad2(c.d)}`;
      if (isTime) return `${pad2(c.H)}:${pad2(c.M)}`;
    }
  }

  return String(value ?? "").trim();
}

function toScheduleRow(raw: Record<string, unknown>): ScheduleRow {
  const out: ScheduleRow = {};
  Object.entries(raw).forEach(([k, v]) => {
    const norm = normalizeKey(k);
    if (!norm) return;
    const str = coerceCell(norm, v);
    if (!str) return;
    if (norm === "passengerCount" || norm === "wheelchairCount") {
      const n = parseInt(str, 10);
      if (!Number.isNaN(n)) (out as any)[norm] = n;
    } else {
      (out as any)[norm] = str;
    }
  });
  return out;
}

// Convierte la fecha de una fila ("15-10", "1-nov", "2026-11-01") al ISO
// "YYYY-MM-DD" que usa la pestaña "Vista del día", replicando el parseo del
// backend para poder llevar al operador directo a los viajes recién creados.
const MONTHS_ES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};
function rowDateToIso(raw: string | undefined, defaultYear: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad2(+iso[2])}-${pad2(+iso[3])}`;
  const parts = t.split(/[-/\s]/).filter(Boolean);
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const mk = String(parts[1]).toLowerCase();
    const month = MONTHS_ES[mk] ?? parseInt(parts[1], 10);
    const year =
      parts[2] && /^\d{4}$/.test(parts[2]) ? Number(parts[2]) : Number(defaultYear);
    if (!Number.isNaN(day) && month >= 1 && month <= 12 && year) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return null;
}

// Formatea "YYYY-MM-DD" como "DD-MM-YYYY" para mostrarlo al usuario.
function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export default function DailyTransportPage() {
  const [tab, setTab] = useState<"import" | "assign" | "view">("import");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // ── Import tab ─────────────────────────────────────────────────
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Fecha (ISO) del primer viaje creado en la última importación — permite
  // saltar directo a "Vista del día" ya posicionado en el día correcto.
  const [lastImportedDate, setLastImportedDate] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Año por defecto = año de inicio del evento seleccionado
  const defaultYear = useMemo(() => {
    const ev = events.find((e) => e.id === eventId);
    const raw = ev?.startDate || ev?.start_date || ev?.endDate || ev?.end_date;
    if (raw) {
      const m = String(raw).match(/^(\d{4})/);
      if (m) return m[1];
    }
    return String(new Date().getFullYear());
  }, [events, eventId]);

  // ── Assign tab ─────────────────────────────────────────────────
  // La fecha operativa es única y compartida (viewDate): se fija al importar,
  // y tanto "Asignar conductores" como "Vista del día" operan sobre ese mismo
  // día. Antes la asignación tenía su propia fecha (arrancaba en hoy) y no
  // encontraba los viajes importados a otra fecha → 0 asignados / 0 sin asignar.
  const [assignClientType, setAssignClientType] = useState("");
  const [assignFleet, setAssignFleet] = useState("");
  const [enforceClientTypeMatch, setEnforceClientTypeMatch] = useState(true);
  const [enforceFleetTypeMatch, setEnforceFleetTypeMatch] = useState(true);
  const [respectVehicleCapacity, setRespectVehicleCapacity] = useState(true);
  const [respectWheelchair, setRespectWheelchair] = useState(true);
  const [prioritizeRoundTrips, setPrioritizeRoundTrips] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(90);
  const [maxTripsPerDriver, setMaxTripsPerDriver] = useState<string>("");
  const [strategy, setStrategy] = useState<"least_loaded" | "first_available" | "longest_idle">("least_loaded");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<AssignResult | null>(null);

  // ── View tab ───────────────────────────────────────────────────
  const [viewDate, setViewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewTrips, setViewTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    apiFetch<Event[]>("/events").then((rows) => {
      const safe = Array.isArray(rows) ? rows : [];
      setEvents(safe);
      if (!eventId && safe[0]?.id) setEventId(safe[0].id);
    }).catch(() => setEvents([]));
    apiFetch<Driver[]>("/drivers").then((rows) => setDrivers(Array.isArray(rows) ? rows : [])).catch(() => setDrivers([]));
  }, []);

  // ── Import handlers ────────────────────────────────────────────
  const handleFile = (file: File) => {
    setRows([]);
    setImportResult(null);
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        // Skip the header-banner row (first cell may say "N° BUS")
        const cleaned = raw
          .map((r) => toScheduleRow(r))
          .filter((r) => r.date || r.clientType || r.discipline);
        setRows(cleaned);
        if (cleaned.length === 0) setError("No se detectaron filas válidas en el archivo");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const headers = [
      "N° Bus", "Destino", "Acrónimo", "Tipo de Cliente", "Fecha",
      "Disciplina", "Género", "Actividad", "Presentación",
      "Lugar Origen", "Dirección", "Hora Llegada Bus", "T° Traslado",
      "Hora Llegada Recinto", "Recinto", "Regresar a las",
      "PAX", "Sillas de Rueda",
      "Acrónimo Flota", "Tipo Flota", "Patente",
      "Conductor", "Teléfono", "Notas", "Obs",
    ];
    // Filas de ejemplo: solo datos del cronograma (lo que llena el usuario).
    // Conductor, Teléfono y Patente quedan vacíos — los completa el sistema
    // al ejecutar la auto-asignación en la pestaña "Asignar conductores".
    const example1 = [
      1, "IDA", "ATHLETE", "Atletas Chile", "15-10",
      "Atletismo", "M", "Maratón", "06:00",
      "Villa Panamericana", "Pedro Aguirre Cerda con Departamental", "06:30", 30,
      "07:00", "Parque O'Higgins", "12:00",
      20, 0,
      "M3", "Bus 31-40 asientos", "",
      "", "", "Llevar agua", "",
    ];
    const example2 = [
      2, "VUELTA", "VIP", "Delegación Argentina", "15-10",
      "Natación", "F", "Final 100m libre", "14:00",
      "Estadio Nacional", "Av. Grecia 2001, Ñuñoa", "14:30", 20,
      "15:00", "Hotel Sheraton", "18:00",
      8, 1,
      "M5", "Van Adaptada", "",
      "", "", "", "Pasajera con silla de ruedas",
    ];
    const sheetData = [headers, example1, example2];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operatividad");
    XLSX.writeFile(wb, `plantilla-operatividad-diaria-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const runImport = async () => {
    if (!rows.length || !eventId) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await apiFetch<ImportResult>("/trips/bulk-from-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, rows, defaultYear }),
      });
      setImportResult(result);
      setMessage(`Importación completada: ${result.createdCount} creados, ${result.skippedCount} saltados.`);
      // Deja "Vista del día" apuntando al primer día importado, para que el
      // operador encuentre de inmediato los viajes recién creados.
      const createdIdx = new Set(result.created.map((c) => c.index));
      const firstDate = rows
        .filter((_, i) => createdIdx.has(i))
        .map((r) => rowDateToIso(r.date, defaultYear))
        .filter((d): d is string => !!d)
        .sort()[0];
      if (firstDate) {
        setViewDate(firstDate);
        setLastImportedDate(firstDate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en importación");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Assign handlers ────────────────────────────────────────────
  const runAssign = async (dryRun: boolean) => {
    setAssigning(true);
    setError(null);
    setAssignResult(null);
    try {
      const payload: AssignParams = {
        eventId: eventId || undefined,
        date: viewDate || undefined,
        clientType: assignClientType || undefined,
        fleetAcronym: assignFleet || undefined,
        dryRun,
        enforceClientTypeMatch,
        enforceFleetTypeMatch,
        respectVehicleCapacity,
        respectWheelchair,
        prioritizeRoundTrips,
        bufferMinutes,
        maxTripsPerDriver: maxTripsPerDriver ? Number(maxTripsPerDriver) : null,
        strategy,
      };
      const result = await apiFetch<AssignResult>("/trips/auto-assign-drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setAssignResult(result);
      setMessage(
        dryRun
          ? `Simulación: ${result.assignedCount} asignables, ${result.unassignedCount} sin asignar.`
          : `Aplicado: ${result.assignedCount} asignados, ${result.unassignedCount} sin asignar.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en auto-asignación");
    } finally {
      setAssigning(false);
    }
  };

  // ── View handlers ──────────────────────────────────────────────
  const loadView = async () => {
    setViewLoading(true);
    try {
      const rows = await apiFetch<Trip[]>(`/trips`);
      const safe = Array.isArray(rows) ? rows : [];
      const filtered = safe.filter((t) => {
        const d = t.tripDate || t.trip_date || (t.scheduledAt || t.scheduled_at || "").slice(0, 10);
        return d === viewDate;
      });
      setViewTrips(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando viajes");
    } finally {
      setViewLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "view") loadView();
  }, [tab, viewDate]);

  const driverNameById = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d) => map.set(d.id, d.fullName));
    return map;
  }, [drivers]);

  // KPIs de la vista del día — resumen operativo del día seleccionado.
  const viewKpis = useMemo(() => {
    const total = viewTrips.length;
    const assigned = viewTrips.filter((t) => t.driverId || t.driver_id).length;
    const pax = viewTrips.reduce(
      (acc, t) => acc + (t.passengerCount ?? t.passenger_count ?? 0),
      0,
    );
    return { total, assigned, unassigned: total - assigned, pax };
  }, [viewTrips]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Operatividad diaria — Transporte"
        description="Importa horarios desde planilla, auto-asigna conductores respetando restricciones, y revisa el día operativo completo."
        icon={<TruckIcon size={24} />}
        meta={
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}>Evento:</label>
            <select className="input" style={{ minWidth: "240px" }}
              value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
            </select>
          </div>
        }
      />

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as any)}
        tabs={[
          { key: "import", label: "Importar planilla", icon: <UploadIcon size={16} /> },
          { key: "assign", label: "Asignar conductores", icon: <SettingsIcon size={16} /> },
          { key: "view", label: "Vista del día", icon: <CalendarIcon size={16} /> },
        ]}
      />

      {error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid var(--danger)", background: "var(--danger-dim)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        </section>
      )}
      {message && !error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid var(--success)", background: "var(--success-dim)" }}>
          <p className="text-sm" style={{ color: "var(--success)" }}>{message}</p>
        </section>
      )}

      {tab === "import" && (
        <section className="surface rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="section-label mb-1">Cargar planilla operativa</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "65ch" }}>
                Acepta el formato de la planilla de operación con columnas: Fecha, Acrónimo cliente,
                Disciplina, Presentación, Lugar Origen, Hora Llegada Recinto, Recinto, Acrónimo Flota,
                PAX, Sillas de rueda, etc. Las fechas sin año se asumirán del evento seleccionado
                (<strong>{defaultYear}</strong>).
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn btn-ghost"
              title="Descarga un archivo Excel con todas las columnas esperadas y filas de ejemplo"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 -mt-0.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar plantilla
            </button>
          </div>

          <FileDropZone
            accept=".csv,.xls,.xlsx"
            onFile={handleFile}
            selectedFileName={fileName}
            selectedDetail={rows.length > 0 ? `${rows.length} fila(s) detectadas` : undefined}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="btn btn-primary"
              disabled={!rows.length || importing}
              onClick={runImport}
              type="button"
            >
              {importing
                ? "Importando…"
                : rows.length > 0
                  ? `Importar ${rows.length} fila(s)`
                  : "Selecciona un archivo primero"}
            </button>
          </div>
          {rows.length > 0 && (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                  <tr>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">#</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Fecha</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Pres.</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Cliente</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Disciplina</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Origen</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Destino</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Flota</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">PAX</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">SR</th>
                    <th className="p-2 text-left font-semibold uppercase tracking-wide">Vuelta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border-muted)", background: i % 2 === 0 ? "var(--surface)" : "var(--elevated)" }}>
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{r.date}</td>
                      <td className="p-2">{r.presentationTime}</td>
                      <td className="p-2">{r.clientType}</td>
                      <td className="p-2">{r.discipline}</td>
                      <td className="p-2">{r.originName}</td>
                      <td className="p-2">{r.destinationName}</td>
                      <td className="p-2">{r.fleetAcronym}</td>
                      <td className="p-2">{r.passengerCount ?? "-"}</td>
                      <td className="p-2">{r.wheelchairCount ?? "-"}</td>
                      <td className="p-2">{r.returnTime ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="p-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Mostrando 50 de {rows.length}. Todas se importarán al confirmar.
                </p>
              )}
            </div>
          )}
          {importResult && (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-success">{importResult.createdCount} viajes creados</span>
                {importResult.skippedCount > 0 && (
                  <span className="badge badge-danger">{importResult.skippedCount} saltados</span>
                )}
              </div>
              {importResult.createdCount > 0 && lastImportedDate && (
                <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <span>Los viajes quedaron para el <strong>{isoToDisplay(lastImportedDate)}</strong>.</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setTab("view")}
                  >
                    <CalendarIcon size={14} className="inline-block mr-1.5 -mt-0.5" />
                    Ver los viajes del {isoToDisplay(lastImportedDate)}
                  </button>
                </div>
              )}
              {importResult.skipped.length > 0 && (
                <div className="rounded-lg max-h-48 overflow-auto" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full text-xs">
                    <thead style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                      <tr><th className="p-2 text-left font-semibold uppercase tracking-wide">Fila</th><th className="p-2 text-left font-semibold uppercase tracking-wide">Motivo</th></tr>
                    </thead>
                    <tbody>
                      {importResult.skipped.map((s, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border-muted)" }}><td className="p-2">{s.index + 1}</td><td className="p-2">{s.reason}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "assign" && (
        <section className="surface rounded-2xl p-5 space-y-4">
          <p className="section-label">Filtros</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Fecha</span>
              <input type="date" className="input"
                value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
              <span className="block text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                Se asignan los viajes sin chofer de este día.
              </span>
            </label>
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Tipo de cliente</span>
              <select className="input"
                value={assignClientType} onChange={(e) => setAssignClientType(e.target.value)}>
                <option value="">Todos</option>
                {CLIENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Flota</span>
              <select className="input"
                value={assignFleet} onChange={(e) => setAssignFleet(e.target.value)}>
                <option value="">Todas</option>
                {FLEET_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
          </div>

          <p className="section-label mt-4">Restricciones (toggles)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={enforceClientTypeMatch}
                onChange={(e) => setEnforceClientTypeMatch(e.target.checked)} />
              Respetar tipos de cliente permitidos del chofer
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={enforceFleetTypeMatch}
                onChange={(e) => setEnforceFleetTypeMatch(e.target.checked)} />
              Respetar flota requerida (M1/M4/M5)
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={respectVehicleCapacity}
                onChange={(e) => setRespectVehicleCapacity(e.target.checked)} />
              Respetar capacidad del vehículo (PAX)
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={respectWheelchair}
                onChange={(e) => setRespectWheelchair(e.target.checked)} />
              Sillas de rueda → vehículo adaptado (M5)
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={prioritizeRoundTrips}
                onChange={(e) => setPrioritizeRoundTrips(e.target.checked)} />
              Mismo chofer para ida y retorno
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Buffer entre viajes: <strong>{bufferMinutes} min</strong>
              </span>
              <input type="range" min={0} max={240} step={15} className="block w-full mt-1"
                value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Recomendado: 90 min (1.5 h) según política operativa.
              </span>
            </label>
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Máx. viajes por chofer</span>
              <input type="number" min={1} placeholder="Sin tope" className="input"
                value={maxTripsPerDriver} onChange={(e) => setMaxTripsPerDriver(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Estrategia</span>
              <select className="input"
                value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                <option value="least_loaded">Menor carga (balanceado)</option>
                <option value="first_available">Primer disponible</option>
                <option value="longest_idle">Más tiempo libre</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="btn btn-ghost" disabled={assigning} onClick={() => runAssign(true)} type="button">
              Simular (dry-run)
            </button>
            <button className="btn btn-primary" disabled={assigning} onClick={() => runAssign(false)} type="button">
              {assigning ? "Asignando…" : "Aplicar asignación"}
            </button>
          </div>

          {assignResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="rounded-xl p-3" style={{ background: "var(--success-dim)", border: "1px solid var(--success-border)" }}>
                <p className="font-medium text-sm mb-2" style={{ color: "var(--success)" }}>Asignados ({assignResult.assignedCount})</p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.assigned.map((a) => (
                    <div key={a.tripId} className="py-1" style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      <code>{a.tripId.slice(0, 8)}…</code> → <strong>{a.driverName}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "var(--danger-dim)", border: "1px solid var(--danger-border)" }}>
                <p className="font-medium text-sm mb-2" style={{ color: "var(--danger)" }}>Sin asignar ({assignResult.unassignedCount})</p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.unassigned.map((u, i) => (
                    <div key={i} className="py-1" style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      <code>{u.tripId.slice(0, 8)}…</code> — {u.reason}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "view" && (
        <section className="space-y-5">
          {viewTrips.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Viajes del día"
                value={viewKpis.total}
                accent="blue"
                icon={<TruckIcon size={18} />}
                detail={isoToDisplay(viewDate)}
              />
              <KpiCard
                label="Con chofer"
                value={viewKpis.assigned}
                accent="green"
                icon={<CheckIcon size={18} />}
                detail={`${viewKpis.total ? Math.round((viewKpis.assigned / viewKpis.total) * 100) : 0}% asignado`}
              />
              <KpiCard
                label="Sin asignar"
                value={viewKpis.unassigned}
                accent="red"
                icon={<AlertIcon size={18} />}
                detail={viewKpis.unassigned > 0 ? "Requieren chofer" : "Todo cubierto"}
              />
              <KpiCard
                label="Pasajeros"
                value={viewKpis.pax}
                accent="purple"
                icon={<UsersIcon size={18} />}
                detail="Capacidad total del día"
              />
            </div>
          )}

          <div className="surface rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <span className="block text-xs mb-1 uppercase tracking-wide font-medium"
                  style={{ color: "var(--text-muted)" }}>Fecha</span>
                <input type="date" className="input"
                  value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
              </label>
              <button className="btn btn-ghost" type="button" onClick={loadView}>
                <RefreshIcon size={14} className="inline-block mr-1" />
                Refrescar
              </button>
            </div>
            <span className="badge badge-slate">
              {viewLoading
                ? "Cargando…"
                : `${viewTrips.length} viaje${viewTrips.length === 1 ? "" : "s"} en la fecha`}
            </span>
          </div>

          {!viewLoading && viewTrips.length === 0 ? (
            <EmptyStateBox
              icon={<CalendarIcon size={36} />}
              title="No hay viajes para esta fecha"
              description="Cambia de fecha o importa una planilla en la pestaña anterior para ver los viajes operativos del día."
              action={
                <button className="btn btn-primary" type="button" onClick={() => setTab("import")}>
                  <UploadIcon size={14} className="inline-block mr-1" />
                  Importar planilla
                </button>
              }
            />
          ) : (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                  <tr>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Hora</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Cliente</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Flota</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Origen → Destino</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">PAX</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">SR</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Tipo</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Chofer</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTrips
                    .sort((a, b) => String(a.scheduledAt || a.scheduled_at || "").localeCompare(String(b.scheduledAt || b.scheduled_at || "")))
                    .map((t, idx) => {
                      const driverId = t.driverId || t.driver_id;
                      const time = String(t.scheduledAt || t.scheduled_at || "").slice(11, 16);
                      return (
                        <tr key={t.id}
                          style={{ borderTop: "1px solid var(--border-muted)", background: idx % 2 === 0 ? "var(--surface)" : "var(--elevated)" }}>
                          <td className="p-3 font-mono font-semibold">{time}</td>
                          <td className="p-3 font-medium">{clientTypeLabel(t.clientType || t.client_type)}</td>
                          <td className="p-3">
                            {(t.fleetAcronym || t.fleet_acronym)
                              ? <span className="badge badge-slate">{t.fleetAcronym || t.fleet_acronym}</span>
                              : <span style={{ color: "var(--text-faint)" }}>—</span>}
                          </td>
                          <td className="p-3">{t.origin} → {t.destination}</td>
                          <td className="p-3">{t.passengerCount ?? t.passenger_count ?? "-"}</td>
                          <td className="p-3">{t.wheelchairCount ?? t.wheelchair_count ?? "-"}</td>
                          <td className="p-3">{legTypeLabel(t.legType || t.leg_type)}</td>
                          <td className="p-3">
                            {driverId
                              ? (driverNameById.get(driverId) || driverId.slice(0, 8))
                              : <em style={{ color: "var(--danger)" }}>Sin asignar</em>}
                          </td>
                          <td className="p-3">
                            {(() => { const b = statusBadge(t.status); return <span className={`badge ${b.cls}`}>{b.label}</span>; })()}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </section>
      )}
    </div>
  );
}
