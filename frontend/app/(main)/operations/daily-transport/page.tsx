"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import FileDropZone from "@/components/ui/FileDropZone";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  TruckIcon,
  UploadIcon,
  SettingsIcon,
  CalendarIcon,
  RefreshIcon,
  AlertIcon,
} from "@/components/ui/Icons";

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

function normalizeKey(key: string): string | null {
  const k = String(key || "").toLowerCase().trim();
  return COLUMN_ALIASES[k] ?? null;
}

function toScheduleRow(raw: Record<string, unknown>): ScheduleRow {
  const out: ScheduleRow = {};
  Object.entries(raw).forEach(([k, v]) => {
    const norm = normalizeKey(k);
    if (!norm) return;
    const str = String(v ?? "").trim();
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
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
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
        date: assignDate || undefined,
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
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}
      {message && !error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #2e7d32", backgroundColor: "#e7f5ec" }}>
          <p className="text-sm" style={{ color: "#1e5125" }}>{message}</p>
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
            <div className="overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead style={{ backgroundColor: "#1f4e8c", color: "#fff" }}>
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Pres.</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Disciplina</th>
                    <th className="p-2 text-left">Origen</th>
                    <th className="p-2 text-left">Destino</th>
                    <th className="p-2 text-left">Flota</th>
                    <th className="p-2 text-left">PAX</th>
                    <th className="p-2 text-left">SR</th>
                    <th className="p-2 text-left">Vuelta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
            <div className="space-y-2">
              <p className="text-sm font-medium">
                ✅ {importResult.createdCount} viajes creados · ❌ {importResult.skippedCount} saltados
              </p>
              {importResult.skipped.length > 0 && (
                <div className="border rounded max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr><th className="p-2 text-left">Fila</th><th className="p-2 text-left">Motivo</th></tr>
                    </thead>
                    <tbody>
                      {importResult.skipped.map((s, i) => (
                        <tr key={i}><td className="p-2">{s.index + 1}</td><td className="p-2">{s.reason}</td></tr>
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
                value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
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
              <div className="border rounded p-3" style={{ backgroundColor: "#e7f5ec" }}>
                <p className="font-medium text-sm mb-2">✅ Asignados ({assignResult.assignedCount})</p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.assigned.map((a) => (
                    <div key={a.tripId} className="border-b py-1">
                      <code>{a.tripId.slice(0, 8)}…</code> → <strong>{a.driverName}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border rounded p-3" style={{ backgroundColor: "#fde2e2" }}>
                <p className="font-medium text-sm mb-2">❌ Sin asignar ({assignResult.unassignedCount})</p>
                <div className="max-h-64 overflow-auto text-xs">
                  {assignResult.unassigned.map((u, i) => (
                    <div key={i} className="border-b py-1">
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
        <section className="surface rounded-2xl p-5 space-y-4">
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
            <span className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: "#eef1f6", color: "#1f4e8c" }}>
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
            <div className="overflow-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead style={{ background: "linear-gradient(135deg, #1f4e8c 0%, #2d6aa8 100%)", color: "#fff" }}>
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
                          className="border-b transition-colors hover:bg-blue-50"
                          style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td className="p-3 font-mono font-semibold">{time}</td>
                          <td className="p-3">{t.clientType || t.client_type}</td>
                          <td className="p-3">{t.fleetAcronym || t.fleet_acronym}</td>
                          <td className="p-3">{t.origin} → {t.destination}</td>
                          <td className="p-3">{t.passengerCount ?? t.passenger_count ?? "-"}</td>
                          <td className="p-3">{t.wheelchairCount ?? t.wheelchair_count ?? "-"}</td>
                          <td className="p-3">{t.legType || t.leg_type}</td>
                          <td className="p-3">
                            {driverId
                              ? (driverNameById.get(driverId) || driverId.slice(0, 8))
                              : <em style={{ color: "#b3231b" }}>Sin asignar</em>}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: "#eef1f6", color: "#1f4e8c" }}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
