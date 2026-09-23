"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { leerPlanilla, rowDateToIso, type ScheduleRow } from "@/lib/planilla";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import FileDropZone from "@/components/ui/FileDropZone";
import EmptyStateBox from "@/components/ui/EmptyState";
import KpiCard from "@/components/ui/KpiCard";
import { clientTypeLabel } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n";
import { BRAND, TRIP_STATUS_META, STATE, SURFACE } from "@/lib/design";
import {
  TruckIcon,
  UploadIcon,
  SettingsIcon,
  CalendarIcon,
  RefreshIcon,
  AlertIcon,
  CheckIcon,
  UsersIcon,
  ClipboardIcon,
  AccessibilityIcon,
  ArrowLeftRightIcon,
  TicketIcon,
  DownloadIcon,
} from "@/components/ui/Icons";

// Estado de viaje → clase de badge del tema. Los labels salen del catálogo
// canónico (TRIP_STATUS_META en lib/design); las clases `.badge-*` son la
// paleta propia de este módulo. ASSIGNED es un estado extra local.
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: TRIP_STATUS_META.REQUESTED.label, cls: "badge-amber" },
  SCHEDULED: { label: TRIP_STATUS_META.SCHEDULED.label, cls: "badge-blue" },
  ASSIGNED: { label: "Asignado", cls: "badge-gold" },
  EN_ROUTE: { label: TRIP_STATUS_META.EN_ROUTE.label, cls: "badge-emerald" },
  PICKED_UP: { label: TRIP_STATUS_META.PICKED_UP.label, cls: "badge-emerald" },
  DROPPED_OFF: { label: TRIP_STATUS_META.DROPPED_OFF.label, cls: "badge-slate" },
  COMPLETED: { label: TRIP_STATUS_META.COMPLETED.label, cls: "badge-slate" },
  CANCELLED: { label: TRIP_STATUS_META.CANCELLED.label, cls: "badge-rose" },
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
// La vista previa muestra TODAS las columnas de la planilla, en el mismo orden
// del archivo, para que el operador pueda comparar 1:1 contra su Excel antes de
// importar. Una columna que llega vacía en todas las filas es la señal de que
// no se reconoció la cabecera (típicamente un CSV con los acentos rotos), y por
// eso se marcan aparte en vez de pasar desapercibidas.
const PREVIEW_COLUMNS: Array<{ key: keyof ScheduleRow; label: string }> = [
  { key: "busNumber", label: "N° Bus" },
  { key: "legType", label: "Destino" },
  { key: "clientType", label: "Acrónimo" },
  { key: "clientName", label: "Tipo de Cliente" },
  { key: "delegation", label: "Delegación" },
  { key: "date", label: "Fecha" },
  { key: "discipline", label: "Disciplina" },
  { key: "gender", label: "Género" },
  { key: "activity", label: "Actividad" },
  { key: "presentationTime", label: "Presentación" },
  { key: "originName", label: "Lugar Origen" },
  { key: "originAddress", label: "Dirección" },
  { key: "departureTime", label: "Hora Llegada Bus" },
  { key: "travelTime", label: "T° Traslado" },
  { key: "arrivalTime", label: "Hora Llegada Recinto" },
  { key: "destinationName", label: "Recinto" },
  { key: "returnTime", label: "Regresar a las" },
  { key: "passengerCount", label: "PAX" },
  { key: "wheelchairCount", label: "Sillas de Rueda" },
  { key: "fleetAcronym", label: "Acrónimo Flota" },
  { key: "fleetType", label: "Tipo Flota" },
  { key: "vehiclePlate", label: "Patente" },
  { key: "driverName", label: "Conductor" },
  { key: "driverPhone", label: "Teléfono" },
  { key: "notes", label: "Notas" },
  { key: "observation", label: "Obs" },
];

type ImportResult = {
  created: Array<{ index: number; id: string; label?: string; driver?: string }>;
  skipped: Array<{ index: number; reason: string }>;
  warnings?: string[];
  createdCount: number;
  skippedCount: number;
  // Viajes que quedaron con el conductor que ya venía escrito en la planilla
  // (columnas Conductor / Patente), sin pasar por la auto-asignación.
  driverAssignedCount?: number;
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
  { value: "JEFE_MISION", label: "Jefe de Misión" },
  { value: "COMITE_ORGANIZADOR", label: "Comité Organizador" },
  { value: "PROVEEDORES", label: "Proveedores" },
];

const FLEET_TYPES = [
  { value: "M1", label: "M1 — Van" },
  { value: "M4", label: "M4 — Bus 44" },
  { value: "M5", label: "M5 — Van Adaptada" },
];

/**
 * El evento ocurre en Chile, así que la hora que se muestra es siempre la de
 * Chile — no la del reloj del computador que abre el panel, ni la del servidor.
 *
 * Antes esta vista sacaba la hora recortando el texto del ISO (`slice(11, 16)`),
 * y ese texto viene en UTC: la planilla decía 07:45 y la Vista del día mostraba
 * 10:45, tres horas adelantada, mientras la pestaña Viajes — que sí convierte
 * con `Date` — mostraba la hora correcta.
 */
const EVENT_TIME_ZONE = "America/Santiago";

const formatEventClock = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

/** "YYYY-MM-DD" del día del evento, para comparar contra el selector de fecha. */
const eventDayKey = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

// Formatea "YYYY-MM-DD" como "DD-MM-YYYY" para mostrarlo al usuario.
function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export default function DailyTransportPage() {
  const { t } = useI18n();
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

  // Columnas de la planilla que no traen dato en NINGUNA fila: casi siempre
  // significa que la cabecera no se reconoció, no que el operador las dejó en
  // blanco. Se avisan arriba de la tabla para que no pase inadvertido.
  const emptyPreviewColumns = useMemo(() => {
    if (rows.length === 0) return [];
    return PREVIEW_COLUMNS.filter((col) =>
      rows.every((r) => {
        const v = r[col.key];
        return v === undefined || v === null || v === "";
      }),
    ).map((col) => col.label);
  }, [rows]);

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
    // /drivers ya devuelve flota propia + choferes de proveedor, sin duplicados.
    apiFetch<Driver[]>("/drivers")
      .then((list) => setDrivers(list || []))
      .catch(() => setDrivers([]));
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
        // Todas las hojas del libro: la planilla real trae una por deporte y
        // antes había que cargarla hoja por hoja.
        const cleaned: ScheduleRow[] = leerPlanilla(evt.target?.result as string).map((f) => {
          const row: Record<string, unknown> = { ...f };
          delete row.hoja;
          delete row.fila;
          return row as ScheduleRow;
        });
        setRows(cleaned);
        if (cleaned.length === 0) setError(t("No se detectaron filas válidas en el archivo"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("No se pudo leer el archivo"));
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const headers = [
      "N° Bus", "Destino", "Acrónimo", "Tipo de Cliente", "Delegación", "Fecha",
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
      1, "IDA", "ATHLETE", "Atletas Chile", "Región de Ñuble", "15-10",
      "Atletismo", "M", "Maratón", "06:00",
      "Villa Panamericana", "Pedro Aguirre Cerda con Departamental", "06:30", 30,
      "07:00", "Parque O'Higgins", "12:00",
      20, 0,
      "M3", "Bus 31-40 asientos", "",
      "", "", "Llevar agua", "",
    ];
    const example2 = [
      2, "VUELTA", "VIP", "Delegación Argentina", "Región de Valparaíso", "15-10",
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
            t("Revisa el motivo fila por fila en la tabla de abajo — típicamente falta la fecha, la hora, o hay un problema de esquema en la base."),
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
      setError(err instanceof Error ? err.message : t("Error en importación"));
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
      setError(err instanceof Error ? err.message : t("Error en auto-asignación"));
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
        const d = t.tripDate || t.trip_date || eventDayKey(t.scheduledAt || t.scheduled_at);
        return d === viewDate;
      });
      setViewTrips(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error cargando viajes"));
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
        title={t("Operatividad diaria — Transporte")}
        description={t("Importa horarios desde planilla, auto-asigna conductores respetando restricciones, y revisa el día operativo completo.")}
        icon={<TruckIcon size={24} />}
        meta={
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}>{t("Evento:")}</label>
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
            { key: "import" as const, n: 1, title: t("Importar planilla"), desc: t("Carga el programa operativo del día"), icon: <UploadIcon size={15} />, badge: rows.length > 0 ? `${rows.length} ${t("filas")}` : importResult ? `${importResult.createdCount} ${t("creados")}` : null },
            { key: "assign" as const, n: 2, title: t("Asignar conductores"), desc: t("Motor de asignación con reglas operativas"), icon: <SettingsIcon size={15} />, badge: assignResult ? `${assignResult.assignedCount} ${t("asignados")}` : null },
            { key: "view" as const, n: 3, title: t("Vista del día"), desc: t("Control y cobertura del día operativo"), icon: <CalendarIcon size={15} />, badge: viewTrips.length > 0 ? `${viewTrips.length} ${t("servicios")}` : null },
          ].map((s) => {
            const active = tab === s.key;
            return (
              <button key={s.key} type="button" onClick={() => setTab(s.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                  padding: "12px 16px", borderRadius: 14, cursor: "pointer",
                  background: active ? `linear-gradient(135deg, ${BRAND.teal} 0%, #1eb19a 100%)` : "transparent",
                  border: active ? "1px solid transparent" : "1px dashed var(--border)",
                  boxShadow: active ? "0 4px 14px rgba(33,208,179,0.35)" : "none",
                  transition: "all 150ms",
                }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: active ? "rgba(255,255,255,0.22)" : "rgba(33,208,179,0.1)",
                  color: active ? SURFACE.card : BRAND.tealDark,
                }}>
                  {s.icon}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: active ? "rgba(255,255,255,0.7)" : SURFACE.textFaint, letterSpacing: "0.1em" }}>{t("PASO")} {s.n}</span>
                    {s.badge && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : "rgba(33,208,179,0.12)", color: active ? SURFACE.card : BRAND.tealDark, whiteSpace: "nowrap" }}>
                        {s.badge}
                      </span>
                    )}
                  </span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, marginTop: 1, color: active ? SURFACE.card : SURFACE.text }}>{s.title}</span>
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
              <p className="section-label mb-1">{t("Cargar planilla operativa")}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "65ch" }}>
                {t("Acepta el formato de la planilla de operación con columnas: Fecha, Acrónimo cliente, Disciplina, Presentación, Lugar Origen, Hora Llegada Recinto, Recinto, Acrónimo Flota, PAX, Sillas de rueda, etc. Las fechas sin año se asumirán del evento seleccionado")}
                {" "}(<strong>{defaultYear}</strong>).
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn btn-ghost"
              title={t("Descarga un archivo Excel con todas las columnas esperadas y filas de ejemplo")}
            >
              <DownloadIcon size={15} strokeWidth={1.9} className="inline-block mr-1.5 -mt-0.5" />
              {t("Descargar plantilla")}
            </button>
          </div>

          <FileDropZone
            accept=".csv,.xls,.xlsx"
            onFile={handleFile}
            selectedFileName={fileName}
            selectedDetail={rows.length > 0 ? `${rows.length} ${t("fila(s) detectadas")}` : undefined}
          />

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { icon: <ClipboardIcon size={12} />, label: `${rows.length} servicio${rows.length === 1 ? "" : "s"}` },
                { icon: <CalendarIcon size={12} />, label: `${importStats.dates} fecha${importStats.dates === 1 ? "" : "s"} operativa${importStats.dates === 1 ? "" : "s"}` },
                { icon: <UsersIcon size={12} />, label: `${importStats.pax} ${t("pasajeros")}` },
                ...(importStats.wheelchairs > 0 ? [{ icon: <AccessibilityIcon size={12} />, label: `${importStats.wheelchairs} ${t("silla(s) de rueda")}` }] : []),
                ...(importStats.roundTrips > 0 ? [{ icon: <ArrowLeftRightIcon size={12} />, label: `${importStats.roundTrips} ${t("con tramo de regreso")}` }] : []),
                ...(importStats.clients.length > 0 ? [{ icon: <TicketIcon size={12} />, label: importStats.clients.join(" · ") }] : []),
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5"
                  style={{ background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", color: BRAND.tealInk }}>
                  <span aria-hidden style={{ display: "inline-flex" }}>{c.icon}</span> {c.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {rows.length > 0
                ? t("Se crearán los servicios (y sus tramos de regreso) en las fechas indicadas. Podrás asignar conductores en el paso 2.")
                : t("Selecciona o arrastra la planilla operativa para previsualizarla antes de importar.")}
            </p>
            <button
              type="button"
              disabled={!rows.length || importing}
              onClick={runImport}
              style={{
                padding: "10px 24px", borderRadius: 12, fontSize: 13.5, fontWeight: 800, border: "none",
                background: rows.length && !importing ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : "var(--border)",
                color: rows.length && !importing ? SURFACE.card : "var(--text-muted)",
                boxShadow: rows.length && !importing ? "0 4px 14px rgba(33,208,179,0.4)" : "none",
                cursor: rows.length && !importing ? "pointer" : "not-allowed",
              }}
            >
              {importing
                ? t("Importando…")
                : rows.length > 0
                  ? `${t("Importar")} ${rows.length} servicio${rows.length === 1 ? "" : "s"}`
                  : t("Selecciona un archivo primero")}
            </button>
          </div>
          {rows.length > 0 && (
            <div className="space-y-2">
              {emptyPreviewColumns.length > 0 && (
                <p className="rounded-lg p-2 text-xs" style={{ background: "var(--warning-soft, rgba(245,158,11,0.12))", color: "var(--text-secondary)", border: "1px solid rgba(245,158,11,0.4)" }}>
                  <strong>{emptyPreviewColumns.length} {t("columna(s) llegaron vacías")}:</strong>{" "}
                  {emptyPreviewColumns.join(", ")}.{" "}
                  {t("Si en tu archivo esas columnas tienen datos, la cabecera no se reconoció: guarda la planilla como .xlsx y vuelve a cargarla.")}
                </p>
              )}
              <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--border)", maxHeight: "60vh" }}>
                <table className="text-xs" style={{ minWidth: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--elevated)", color: "var(--text-muted)", position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th className="p-2 text-left font-semibold uppercase tracking-wide" style={{ position: "sticky", left: 0, background: "var(--elevated)", zIndex: 2 }}>#</th>
                      {PREVIEW_COLUMNS.map((col) => {
                        const vacia = emptyPreviewColumns.includes(col.label);
                        return (
                          <th
                            key={col.key}
                            className="p-2 text-left font-semibold uppercase tracking-wide"
                            style={{ whiteSpace: "nowrap", color: vacia ? "var(--danger, #ef4444)" : undefined }}
                            title={vacia ? t("Esta columna llegó vacía en todas las filas") : col.label}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-muted)", background: i % 2 === 0 ? "var(--surface)" : "var(--elevated)" }}>
                        <td className="p-2" style={{ position: "sticky", left: 0, background: "inherit", fontWeight: 600 }}>{i + 1}</td>
                        {PREVIEW_COLUMNS.map((col) => {
                          const value = r[col.key];
                          const texto = value === undefined || value === null || value === "" ? null : String(value);
                          return (
                            <td key={col.key} className="p-2" style={{ whiteSpace: "nowrap" }}>
                              {texto ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {rows.length > 50
                  ? `${t("Mostrando 50 de")} ${rows.length}. ${t("Todas se importarán al confirmar.")}`
                  : `${rows.length} ${t("fila(s)")} × ${PREVIEW_COLUMNS.length} ${t("columnas de la planilla. Desplázate horizontalmente para ver el resto.")}`}
              </p>
            </div>
          )}
          {importResult && (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-success">{importResult.createdCount} {t("viajes creados")}</span>
                {(importResult.driverAssignedCount ?? 0) > 0 && (
                  <span className="badge badge-success">
                    {importResult.driverAssignedCount} {t("con el conductor de la planilla")}
                  </span>
                )}
                {importResult.skippedCount > 0 && (
                  <span className="badge badge-danger">{importResult.skippedCount} {t("saltados")}</span>
                )}
              </div>
              {(importResult.warnings ?? []).length > 0 && (
                <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  {(importResult.warnings ?? []).map((w, i) => (
                    <p key={i} className="text-xs" style={{ color: STATE.warningText }}><AlertIcon size={11} className="inline mr-1" />{w}</p>
                  ))}
                </div>
              )}
              {importResult.created.length > 0 && (
                <details>
                  <summary className="text-xs cursor-pointer font-semibold" style={{ color: "var(--text-muted)" }}>
                    {t("Ver los")} {importResult.created.length} {t("viajes creados")}
                  </summary>
                  <div className="rounded-lg max-h-48 overflow-auto mt-2" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-xs">
                      <thead style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                        <tr><th className="p-2 text-left font-semibold uppercase tracking-wide">{t("Fila")}</th><th className="p-2 text-left font-semibold uppercase tracking-wide">{t("Viaje")}</th><th className="p-2 text-left font-semibold uppercase tracking-wide">{t("Conductor")}</th></tr>
                      </thead>
                      <tbody>
                        {importResult.created.map((c, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--border-muted)" }}>
                            <td className="p-2">{c.index + 1}</td>
                            <td className="p-2">{c.label || c.id.slice(0, 8)}</td>
                            <td className="p-2">
                              {c.driver || <span style={{ color: "var(--text-muted)" }}>{t("sin asignar")}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              {importResult.createdCount > 0 && lastImportedDate && (
                <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <span>{t("Los viajes quedaron para el")} <strong>{isoToDisplay(lastImportedDate)}</strong>.</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setTab("view")}
                  >
                    <CalendarIcon size={14} className="inline-block mr-1.5 -mt-0.5" />
                    {t("Ver los viajes del")} {isoToDisplay(lastImportedDate)}
                  </button>
                </div>
              )}
              {importResult.skipped.length > 0 && (
                <div className="rounded-lg max-h-48 overflow-auto" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full text-xs">
                    <thead style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                      <tr><th className="p-2 text-left font-semibold uppercase tracking-wide">{t("Fila")}</th><th className="p-2 text-left font-semibold uppercase tracking-wide">{t("Motivo")}</th></tr>
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
                <p className="section-label mb-1">{t("Parámetros de asignación")}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "62ch" }}>
                  {t("El motor evalúa cada servicio sin conductor del día y busca el mejor candidato entre la Flota propia y los conductores de proveedores, respetando las reglas activas.")}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("Fecha operativa")}</span>
                  <input type="date" className="input"
                    value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
                  <span className="block text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {t("Se asignan los servicios sin conductor de este día.")}
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("Tipo de cliente")}</span>
                  <select className="input"
                    value={assignClientType} onChange={(e) => setAssignClientType(e.target.value)}>
                    <option value="">{t("Todos")}</option>
                    {CLIENT_TYPES.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("Flota")}</span>
                  <select className="input"
                    value={assignFleet} onChange={(e) => setAssignFleet(e.target.value)}>
                    <option value="">{t("Todas")}</option>
                    {FLEET_TYPES.map((f) => <option key={f.value} value={f.value}>{t(f.label)}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <p className="section-label mb-2">{t("Reglas operativas")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ToggleRow checked={enforceClientTypeMatch} onChange={setEnforceClientTypeMatch}
                    label={t("Tipo de cliente habilitado")}
                    hint={t("El conductor debe estar autorizado para el tipo de cliente del servicio")} />
                  <ToggleRow checked={enforceFleetTypeMatch} onChange={setEnforceFleetTypeMatch}
                    label={t("Flota requerida (M1 / M4 / M5)")}
                    hint={t("El vehículo debe ser compatible con la flota indicada en la planilla")} />
                  <ToggleRow checked={respectVehicleCapacity} onChange={setRespectVehicleCapacity}
                    label={t("Capacidad del vehículo")}
                    hint={t("Los pasajeros del servicio no pueden exceder la capacidad declarada")} />
                  <ToggleRow checked={respectWheelchair} onChange={setRespectWheelchair}
                    label={t("Accesibilidad")}
                    hint={t("Servicios con silla de ruedas solo en vehículo adaptado (M5)")} />
                  <ToggleRow checked={prioritizeRoundTrips} onChange={setPrioritizeRoundTrips}
                    label={t("Continuidad ida y regreso")}
                    hint={t("El mismo conductor cubre ambos tramos del servicio")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {t("Buffer entre servicios:")} <strong style={{ color: BRAND.tealInk }}>{bufferMinutes} min</strong>
                  </span>
                  <input type="range" min={0} max={240} step={15} className="block w-full mt-1"
                    value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t("Recomendado: 90 min según política operativa.")}
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("Máx. servicios por conductor")}</span>
                  <input type="number" min={1} placeholder={t("Sin tope")} className="input"
                    value={maxTripsPerDriver} onChange={(e) => setMaxTripsPerDriver(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("Estrategia")}</span>
                  <select className="input"
                    value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                    <option value="least_loaded">{t("Menor carga (balanceado)")}</option>
                    <option value="first_available">{t("Primer disponible")}</option>
                    <option value="longest_idle">{t("Más tiempo libre")}</option>
                  </select>
                </label>
              </div>
            </div>

            {/* ── Tarjeta de ejecución ── */}
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: `linear-gradient(160deg, ${SURFACE.text} 0%, #1f4e8c 130%)`, boxShadow: "0 8px 24px rgba(15,23,42,0.25)" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal }}>
                  {t("Motor de asignación")}
                </p>
                <h3 style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: SURFACE.card }}>{t("Resumen de ejecución")}</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  [t("Fecha operativa"), isoToDisplay(viewDate)],
                  [t("Tipo de cliente"), assignClientType ? t(CLIENT_TYPES.find((c) => c.value === assignClientType)?.label ?? assignClientType) : t("Todos")],
                  [t("Flota"), assignFleet ? t(FLEET_TYPES.find((f) => f.value === assignFleet)?.label ?? assignFleet) : t("Todas")],
                  [t("Reglas activas"), `${[enforceClientTypeMatch, enforceFleetTypeMatch, respectVehicleCapacity, respectWheelchair, prioritizeRoundTrips].filter(Boolean).length} ${t("de 5")}`],
                  [t("Buffer entre servicios"), `${bufferMinutes} min`],
                  [t("Tope por conductor"), maxTripsPerDriver ? `${maxTripsPerDriver} ${t("servicios")}` : t("Sin tope")],
                  [t("Estrategia"), strategy === "least_loaded" ? t("Menor carga") : strategy === "first_available" ? t("Primer disponible") : t("Más tiempo libre")],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 7 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{k}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: SURFACE.card, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-1">
                <button type="button" disabled={assigning} onClick={() => runAssign(true)}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: "rgba(255,255,255,0.08)", color: SURFACE.card, border: "1px solid rgba(255,255,255,0.22)",
                    cursor: assigning ? "default" : "pointer", opacity: assigning ? 0.6 : 1,
                  }}>
                  {t("Simular sin aplicar (dry-run)")}
                </button>
                <button type="button" disabled={assigning} onClick={() => runAssign(false)}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 800,
                    background: `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)`, color: SURFACE.card, border: "none",
                    boxShadow: "0 4px 14px rgba(33,208,179,0.4)",
                    cursor: assigning ? "default" : "pointer", opacity: assigning ? 0.7 : 1,
                  }}>
                  {assigning ? t("Asignando…") : t("Aplicar asignación")}
                </button>
                <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", textAlign: "center", margin: 0 }}>
                  {t("La simulación muestra el plan completo sin escribir cambios.")}
                </p>
              </div>
            </div>
          </div>

          {assignResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="rounded-2xl p-4" style={{ background: "var(--success-dim)", border: "1px solid var(--success-border)" }}>
                <p className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: "var(--success)" }}>
                  <CheckIcon size={15} /> {t("Asignados")}
                  <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "rgba(46,125,50,0.15)" }}>{assignResult.assignedCount}</span>
                  {assignResult.dryRun && <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ background: SURFACE.card, color: "var(--text-muted)" }}>{t("simulación")}</span>}
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
                  <AlertIcon size={15} /> {t("Sin asignar")}
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
                label={t("Viajes del día")}
                value={viewKpis.total}
                accent="blue"
                icon={<TruckIcon size={18} />}
                detail={isoToDisplay(viewDate)}
              />
              <KpiCard
                label={t("Con conductor")}
                value={viewKpis.assigned}
                accent="green"
                icon={<CheckIcon size={18} />}
                detail={`${viewKpis.total ? Math.round((viewKpis.assigned / viewKpis.total) * 100) : 0}% ${t("de cobertura")}`}
              />
              <KpiCard
                label={t("Sin asignar")}
                value={viewKpis.unassigned}
                accent="red"
                icon={<AlertIcon size={18} />}
                detail={viewKpis.unassigned > 0 ? t("Requieren conductor") : t("Cobertura completa")}
              />
              <KpiCard
                label={t("Pasajeros")}
                value={viewKpis.pax}
                accent="purple"
                icon={<UsersIcon size={18} />}
                detail={t("Capacidad total del día")}
              />
            </div>
          )}

          <div className="surface rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <span className="block text-xs mb-1 uppercase tracking-wide font-medium"
                  style={{ color: "var(--text-muted)" }}>{t("Fecha")}</span>
                <input type="date" className="input"
                  value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
              </label>
              <button className="btn btn-ghost" type="button" onClick={loadView}>
                <RefreshIcon size={14} className="inline-block mr-1" />
                {t("Refrescar")}
              </button>
            </div>
            <span className="badge badge-slate">
              {viewLoading
                ? t("Cargando…")
                : `${viewTrips.length} servicio${viewTrips.length === 1 ? "" : "s"} ${t("en la fecha")}`}
            </span>
          </div>

          {viewTrips.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {t("Cobertura de conductores")}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--elevated)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{
                  width: `${viewKpis.total ? Math.round((viewKpis.assigned / viewKpis.total) * 100) : 0}%`,
                  height: "100%", borderRadius: 99,
                  background: viewKpis.assigned === viewKpis.total
                    ? `linear-gradient(90deg, ${BRAND.teal}, #1eb19a)`
                    : `linear-gradient(90deg, ${STATE.warning}, #d97706)`,
                  transition: "width 300ms ease",
                }} />
              </div>
              <span className="text-xs font-extrabold" style={{ color: viewKpis.assigned === viewKpis.total ? STATE.success : STATE.warningText, whiteSpace: "nowrap" }}>
                {viewKpis.assigned}/{viewKpis.total}
              </span>
            </div>
          )}

          {!viewLoading && viewTrips.length === 0 ? (
            <EmptyStateBox
              icon={<CalendarIcon size={36} />}
              title={t("No hay viajes para esta fecha")}
              description={t("Cambia de fecha o importa una planilla en la pestaña anterior para ver los viajes operativos del día.")}
              action={
                <button className="btn btn-primary" type="button" onClick={() => setTab("import")}>
                  <UploadIcon size={14} className="inline-block mr-1" />
                  {t("Importar planilla")}
                </button>
              }
            />
          ) : (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                  <tr>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Hora")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Cliente")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Flota")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Origen → Destino")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("PAX")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("SR")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Tipo")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Conductor")}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-wide text-[11px]">{t("Estado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTrips
                    .sort((a, b) => String(a.scheduledAt || a.scheduled_at || "").localeCompare(String(b.scheduledAt || b.scheduled_at || "")))
                    .map((trip, idx) => {
                      const driverId = trip.driverId || trip.driver_id;
                      const time = formatEventClock(trip.scheduledAt || trip.scheduled_at);
                      return (
                        <tr key={trip.id}
                          style={{ borderTop: "1px solid var(--border-muted)", background: idx % 2 === 0 ? "var(--surface)" : "var(--elevated)" }}>
                          <td className="p-3 font-mono font-semibold">{time}</td>
                          <td className="p-3 font-medium">{t(clientTypeLabel(trip.clientType || trip.client_type))}</td>
                          <td className="p-3">
                            {(trip.fleetAcronym || trip.fleet_acronym)
                              ? <span className="badge badge-slate">{trip.fleetAcronym || trip.fleet_acronym}</span>
                              : <span style={{ color: "var(--text-faint)" }}>—</span>}
                          </td>
                          <td className="p-3">{trip.origin} → {trip.destination}</td>
                          <td className="p-3">{trip.passengerCount ?? trip.passenger_count ?? "-"}</td>
                          <td className="p-3">{trip.wheelchairCount ?? trip.wheelchair_count ?? "-"}</td>
                          <td className="p-3">{t(legTypeLabel(trip.legType || trip.leg_type))}</td>
                          <td className="p-3">
                            {driverId ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                  background: `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)`, color: SURFACE.card,
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
                              <span className="badge badge-amber">{t("Por asignar")}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {(() => { const b = statusBadge(trip.status); return <span className={`badge ${b.cls}`}>{t(b.label)}</span>; })()}
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
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: SURFACE.text }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{hint}</span>}
      </span>
      <span aria-hidden style={{
        width: 36, height: 20, borderRadius: 99, position: "relative", flexShrink: 0,
        background: checked ? BRAND.teal : SURFACE.borderStrong, transition: "background 150ms",
      }}>
        <span style={{
          position: "absolute", top: 3, left: checked ? 19 : 3,
          width: 14, height: 14, borderRadius: "50%", background: SURFACE.card,
          transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }} />
      </span>
    </button>
  );
}
