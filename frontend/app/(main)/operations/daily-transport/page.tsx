"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
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
  created: Array<{ index: number; id: string; label?: string }>;
  skipped: Array<{ index: number; reason: string }>;
  warnings?: string[];
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
  assigned: Array<{ tripId: string; tripLabel?: string; driverId: string; driverName: string }>;
  unassigned: Array<{ tripId: string; tripLabel?: string; reason: string }>;
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
    // Nombres de chofer: Flota propia + choferes de proveedor (participantes con
    // isDriver). Sin los segundos, la vista del día mostraba el UUID recortado.
    Promise.all([
      apiFetch<Driver[]>("/drivers").catch(() => [] as Driver[]),
      apiFetch<Array<Record<string, unknown>>>("/provider-participants").catch(
        () => [] as Array<Record<string, unknown>>,
      ),
    ]).then(([fleet, participants]) => {
      const participantDrivers: Driver[] = (participants || [])
        .filter((p) => {
          const meta = (p.metadata ?? {}) as Record<string, unknown>;
          return meta.isDriver === true || meta.isDriver === "true";
        })
        .map((p) => ({
          id: String(p.id),
          fullName: String((p.fullName as string) ?? (p.full_name as string) ?? p.id),
        }));
      setDrivers([...(fleet || []), ...participantDrivers]);
    });
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
      if (result.createdCount === 0) {
        setError(
          `No se creó ningún viaje (${result.skippedCount} fila(s) saltadas). ` +
            "Revisa el motivo fila por fila en la tabla de abajo — típicamente falta la fecha, la hora, o hay un problema de esquema en la base.",
        );
      } else {
        setMessage(
          `Importación completada: ${result.createdCount} viaje(s) creados` +
            (result.skippedCount > 0 ? `, ${result.skippedCount} fila(s) saltadas (ver detalle abajo).` : "."),
        );
      }
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
      if (result.message && result.assignedCount === 0 && result.unassignedCount === 0) {
        // Sin viajes pendientes: el backend explica por qué (fecha/filtros).
        setError(result.message);
      } else {
        setMessage(
          dryRun
            ? `Simulación: ${result.assignedCount} asignables, ${result.unassignedCount} sin asignar.`
            : `Aplicado: ${result.assignedCount} asignados, ${result.unassignedCount} sin asignar.`,
        );
      }
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

  // Resumen de la planilla cargada, para validar de un vistazo antes de importar.
  const importStats = useMemo(() => {
    const dates = new Set(rows.map((r) => r.date).filter(Boolean));
    const pax = rows.reduce((a, r) => a + (r.passengerCount ?? 0), 0);
    const wheelchairs = rows.reduce((a, r) => a + (r.wheelchairCount ?? 0), 0);
    const roundTrips = rows.filter((r) => r.returnTime).length;
    const clients = Array.from(new Set(rows.map((r) => r.clientType).filter(Boolean)));
    return { dates: dates.size, pax, wheelchairs, roundTrips, clients };
  }, [rows]);

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

      {/* ── Flujo de trabajo en 3 pasos ── */}
      <section className="surface rounded-2xl p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { key: "import" as const, n: 1, title: "Importar planilla", desc: "Carga el programa operativo del día", icon: <UploadIcon size={15} />, badge: rows.length > 0 ? `${rows.length} filas` : importResult ? `${importResult.createdCount} creados` : null },
            { key: "assign" as const, n: 2, title: "Asignar conductores", desc: "Motor de asignación con reglas operativas", icon: <SettingsIcon size={15} />, badge: assignResult ? `${assignResult.assignedCount} asignados` : null },
            { key: "view" as const, n: 3, title: "Vista del día", desc: "Control y cobertura del día operativo", icon: <CalendarIcon size={15} />, badge: viewTrips.length > 0 ? `${viewTrips.length} servicios` : null },
          ].map((s) => {
            const active = tab === s.key;
            return (
              <button key={s.key} type="button" onClick={() => setTab(s.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                  padding: "12px 16px", borderRadius: 14, cursor: "pointer",
                  background: active ? "linear-gradient(135deg, #21D0B3 0%, #1eb19a 100%)" : "transparent",
                  border: active ? "1px solid transparent" : "1px dashed var(--border)",
                  boxShadow: active ? "0 4px 14px rgba(33,208,179,0.35)" : "none",
                  transition: "all 150ms",
                }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: active ? "rgba(255,255,255,0.22)" : "rgba(33,208,179,0.1)",
                  color: active ? "#fff" : "#1eb19a",
                }}>
                  {s.icon}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: active ? "rgba(255,255,255,0.7)" : "#94a3b8", letterSpacing: "0.1em" }}>PASO {s.n}</span>
                    {s.badge && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : "rgba(33,208,179,0.12)", color: active ? "#fff" : "#1eb19a", whiteSpace: "nowrap" }}>
                        {s.badge}
                      </span>
                    )}
                  </span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, marginTop: 1, color: active ? "#fff" : "#0f172a" }}>{s.title}</span>
                  <span style={{ display: "block", fontSize: 10.5, marginTop: 1, color: active ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

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

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { icon: "📋", label: `${rows.length} servicio${rows.length === 1 ? "" : "s"}` },
                { icon: "📅", label: `${importStats.dates} fecha${importStats.dates === 1 ? "" : "s"} operativa${importStats.dates === 1 ? "" : "s"}` },
                { icon: "👥", label: `${importStats.pax} pasajeros` },
                ...(importStats.wheelchairs > 0 ? [{ icon: "♿", label: `${importStats.wheelchairs} silla(s) de rueda` }] : []),
                ...(importStats.roundTrips > 0 ? [{ icon: "⇄", label: `${importStats.roundTrips} con tramo de regreso` }] : []),
                ...(importStats.clients.length > 0 ? [{ icon: "🎫", label: importStats.clients.join(" · ") }] : []),
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5"
                  style={{ background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", color: "#0f766e" }}>
                  <span aria-hidden>{c.icon}</span> {c.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {rows.length > 0
                ? "Se crearán los servicios (y sus tramos de regreso) en las fechas indicadas. Podrás asignar conductores en el paso 2."
                : "Selecciona o arrastra la planilla operativa para previsualizarla antes de importar."}
            </p>
            <button
              type="button"
              disabled={!rows.length || importing}
              onClick={runImport}
              style={{
                padding: "10px 24px", borderRadius: 12, fontSize: 13.5, fontWeight: 800, border: "none",
                background: rows.length && !importing ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "var(--border)",
                color: rows.length && !importing ? "#fff" : "var(--text-muted)",
                boxShadow: rows.length && !importing ? "0 4px 14px rgba(33,208,179,0.4)" : "none",
                cursor: rows.length && !importing ? "pointer" : "not-allowed",
              }}
            >
              {importing
                ? "Importando…"
                : rows.length > 0
                  ? `Importar ${rows.length} servicio${rows.length === 1 ? "" : "s"}`
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
              {(importResult.warnings ?? []).length > 0 && (
                <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  {(importResult.warnings ?? []).map((w, i) => (
                    <p key={i} className="text-xs" style={{ color: "#b45309" }}>⚠ {w}</p>
                  ))}
                </div>
              )}
              {importResult.created.length > 0 && (
                <details>
                  <summary className="text-xs cursor-pointer font-semibold" style={{ color: "var(--text-muted)" }}>
                    Ver los {importResult.created.length} viajes creados
                  </summary>
                  <div className="rounded-lg max-h-48 overflow-auto mt-2" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-xs">
                      <thead style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                        <tr><th className="p-2 text-left font-semibold uppercase tracking-wide">Fila</th><th className="p-2 text-left font-semibold uppercase tracking-wide">Viaje</th></tr>
                      </thead>
                      <tbody>
                        {importResult.created.map((c, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--border-muted)" }}>
                            <td className="p-2">{c.index + 1}</td>
                            <td className="p-2">{c.label || c.id.slice(0, 8)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
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
        <section className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_360px] items-start">
            {/* ── Parámetros del motor ── */}
            <div className="surface rounded-2xl p-5 space-y-5">
              <div>
                <p className="section-label mb-1">Parámetros de asignación</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "62ch" }}>
                  El motor evalúa cada servicio sin conductor del día y busca el mejor candidato entre la
                  Flota propia y los conductores de proveedores, respetando las reglas activas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Fecha operativa</span>
                  <input type="date" className="input"
                    value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
                  <span className="block text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Se asignan los servicios sin conductor de este día.
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Tipo de cliente</span>
                  <select className="input"
                    value={assignClientType} onChange={(e) => setAssignClientType(e.target.value)}>
                    <option value="">Todos</option>
                    {CLIENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Flota</span>
                  <select className="input"
                    value={assignFleet} onChange={(e) => setAssignFleet(e.target.value)}>
                    <option value="">Todas</option>
                    {FLEET_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <p className="section-label mb-2">Reglas operativas</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ToggleRow checked={enforceClientTypeMatch} onChange={setEnforceClientTypeMatch}
                    label="Tipo de cliente habilitado"
                    hint="El conductor debe estar autorizado para el tipo de cliente del servicio" />
                  <ToggleRow checked={enforceFleetTypeMatch} onChange={setEnforceFleetTypeMatch}
                    label="Flota requerida (M1 / M4 / M5)"
                    hint="El vehículo debe ser compatible con la flota indicada en la planilla" />
                  <ToggleRow checked={respectVehicleCapacity} onChange={setRespectVehicleCapacity}
                    label="Capacidad del vehículo"
                    hint="Los pasajeros del servicio no pueden exceder la capacidad declarada" />
                  <ToggleRow checked={respectWheelchair} onChange={setRespectWheelchair}
                    label="Accesibilidad"
                    hint="Servicios con silla de ruedas solo en vehículo adaptado (M5)" />
                  <ToggleRow checked={prioritizeRoundTrips} onChange={setPrioritizeRoundTrips}
                    label="Continuidad ida y regreso"
                    hint="El mismo conductor cubre ambos tramos del servicio" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Buffer entre servicios: <strong style={{ color: "#0f766e" }}>{bufferMinutes} min</strong>
                  </span>
                  <input type="range" min={0} max={240} step={15} className="block w-full mt-1"
                    value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Recomendado: 90 min según política operativa.
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Máx. servicios por conductor</span>
                  <input type="number" min={1} placeholder="Sin tope" className="input"
                    value={maxTripsPerDriver} onChange={(e) => setMaxTripsPerDriver(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Estrategia</span>
                  <select className="input"
                    value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                    <option value="least_loaded">Menor carga (balanceado)</option>
                    <option value="first_available">Primer disponible</option>
                    <option value="longest_idle">Más tiempo libre</option>
                  </select>
                </label>
              </div>
            </div>

            {/* ── Tarjeta de ejecución ── */}
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "linear-gradient(160deg, #0f172a 0%, #1f4e8c 130%)", boxShadow: "0 8px 24px rgba(15,23,42,0.25)" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3" }}>
                  Motor de asignación
                </p>
                <h3 style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: "#fff" }}>Resumen de ejecución</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Fecha operativa", isoToDisplay(viewDate)],
                  ["Tipo de cliente", assignClientType ? (CLIENT_TYPES.find((c) => c.value === assignClientType)?.label ?? assignClientType) : "Todos"],
                  ["Flota", assignFleet ? (FLEET_TYPES.find((f) => f.value === assignFleet)?.label ?? assignFleet) : "Todas"],
                  ["Reglas activas", `${[enforceClientTypeMatch, enforceFleetTypeMatch, respectVehicleCapacity, respectWheelchair, prioritizeRoundTrips].filter(Boolean).length} de 5`],
                  ["Buffer entre servicios", `${bufferMinutes} min`],
                  ["Tope por conductor", maxTripsPerDriver ? `${maxTripsPerDriver} servicios` : "Sin tope"],
                  ["Estrategia", strategy === "least_loaded" ? "Menor carga" : strategy === "first_available" ? "Primer disponible" : "Más tiempo libre"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 7 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{k}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-1">
                <button type="button" disabled={assigning} onClick={() => runAssign(true)}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)",
                    cursor: assigning ? "default" : "pointer", opacity: assigning ? 0.6 : 1,
                  }}>
                  Simular sin aplicar (dry-run)
                </button>
                <button type="button" disabled={assigning} onClick={() => runAssign(false)}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 800,
                    background: "linear-gradient(135deg, #21D0B3, #1eb19a)", color: "#fff", border: "none",
                    boxShadow: "0 4px 14px rgba(33,208,179,0.4)",
                    cursor: assigning ? "default" : "pointer", opacity: assigning ? 0.7 : 1,
                  }}>
                  {assigning ? "Asignando…" : "Aplicar asignación"}
                </button>
                <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", textAlign: "center", margin: 0 }}>
                  La simulación muestra el plan completo sin escribir cambios.
                </p>
              </div>
            </div>
          </div>

          {assignResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="rounded-2xl p-4" style={{ background: "var(--success-dim)", border: "1px solid var(--success-border)" }}>
                <p className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: "var(--success)" }}>
                  <CheckIcon size={15} /> Asignados
                  <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "rgba(46,125,50,0.15)" }}>{assignResult.assignedCount}</span>
                  {assignResult.dryRun && <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ background: "#fff", color: "var(--text-muted)" }}>simulación</span>}
                </p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.assigned.map((a) => (
                    <div key={a.tripId} className="py-1" style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      {a.tripLabel || <code>{a.tripId.slice(0, 8)}…</code>} → <strong>{a.driverName}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--danger-dim)", border: "1px solid var(--danger-border)" }}>
                <p className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: "var(--danger)" }}>
                  <AlertIcon size={15} /> Sin asignar
                  <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "rgba(179,35,27,0.12)" }}>{assignResult.unassignedCount}</span>
                </p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.unassigned.map((u, i) => (
                    <div key={i} className="py-1" style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      <strong>{u.tripLabel || `${u.tripId.slice(0, 8)}…`}</strong>
                      <span style={{ color: "var(--text-muted)" }}> — {u.reason}</span>
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
                label="Con conductor"
                value={viewKpis.assigned}
                accent="green"
                icon={<CheckIcon size={18} />}
                detail={`${viewKpis.total ? Math.round((viewKpis.assigned / viewKpis.total) * 100) : 0}% de cobertura`}
              />
              <KpiCard
                label="Sin asignar"
                value={viewKpis.unassigned}
                accent="red"
                icon={<AlertIcon size={18} />}
                detail={viewKpis.unassigned > 0 ? "Requieren conductor" : "Cobertura completa"}
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
                : `${viewTrips.length} servicio${viewTrips.length === 1 ? "" : "s"} en la fecha`}
            </span>
          </div>

          {viewTrips.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Cobertura de conductores
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--elevated)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{
                  width: `${viewKpis.total ? Math.round((viewKpis.assigned / viewKpis.total) * 100) : 0}%`,
                  height: "100%", borderRadius: 99,
                  background: viewKpis.assigned === viewKpis.total
                    ? "linear-gradient(90deg, #21D0B3, #1eb19a)"
                    : "linear-gradient(90deg, #f59e0b, #d97706)",
                  transition: "width 300ms ease",
                }} />
              </div>
              <span className="text-xs font-extrabold" style={{ color: viewKpis.assigned === viewKpis.total ? "#16a34a" : "#d97706", whiteSpace: "nowrap" }}>
                {viewKpis.assigned}/{viewKpis.total}
              </span>
            </div>
          )}

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
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">Conductor</th>
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
                            {driverId ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                  background: "linear-gradient(135deg, #21D0B3, #1eb19a)", color: "#fff",
                                  fontSize: 9, fontWeight: 800, display: "inline-flex",
                                  alignItems: "center", justifyContent: "center", letterSpacing: "0.03em",
                                }}>
                                  {(driverNameById.get(driverId) || "?")
                                    .split(/\s+/).filter(Boolean).slice(0, 2)
                                    .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"}
                                </span>
                                <span className="font-medium">{driverNameById.get(driverId) || driverId.slice(0, 8)}</span>
                              </span>
                            ) : (
                              <span className="badge badge-amber">Por asignar</span>
                            )}
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

// ────────────────────────────────────────────────────────────────────────────
// ToggleRow — regla operativa con switch, título y descripción
// ────────────────────────────────────────────────────────────────────────────

function ToggleRow({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all"
      style={{
        background: checked ? "rgba(33,208,179,0.07)" : "var(--elevated)",
        border: `1px solid ${checked ? "rgba(33,208,179,0.35)" : "var(--border)"}`,
        cursor: "pointer",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{hint}</span>}
      </span>
      <span aria-hidden style={{
        width: 36, height: 20, borderRadius: 99, position: "relative", flexShrink: 0,
        background: checked ? "#21D0B3" : "#cbd5e1", transition: "background 150ms",
      }}>
        <span style={{
          position: "absolute", top: 3, left: checked ? 19 : 3,
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }} />
      </span>
    </button>
  );
}
