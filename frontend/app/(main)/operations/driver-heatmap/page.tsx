"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import { StarIcon, MedalIcon, RefreshIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { nombrePropio } from "@/lib/nombres";

/* ─── Types ─── */
/** Estados en los que un viaje ya no le exige nada al conductor. */
const CERRADOS = new Set(["DROPPED_OFF", "COMPLETED", "CANCELLED"]);

/**
 * Jornada del conductor: 13 horas desde que inicia su primer viaje del día.
 *
 * Al cumplirse el plazo el contador NO se corta solo. Sigue corriendo como
 * horas extra mientras al conductor le quede trabajo: un viaje en curso que
 * todavía no termina, o viajes programados del mismo día sin completar. Se
 * cierra recién cuando termina el último viaje, y las extras son lo que va
 * desde el plazo hasta ese cierre.
 */
const JORNADA_HORAS = 13;
const JORNADA_MS = JORNADA_HORAS * 60 * 60 * 1000;
/** Umbral para avisar que la jornada está por vencer. */
const JORNADA_AVISO_MS = 60 * 60 * 1000;

/** Color por estado: el operador mira la franja izquierda, no el texto. */
const ESTADO_JORNADA: Record<
  string,
  { label: string; color: string; bg: string; borde: string; texto: string }
> = {
  SIN_INICIAR: { label: "Sin iniciar", color: "#cbd5e1", bg: "#f8fafc", borde: "#e2e8f0", texto: "#64748b" },
  EN_JORNADA: { label: "En jornada", color: "#21d0b3", bg: "rgba(33,208,179,0.10)", borde: "rgba(33,208,179,0.3)", texto: "#0a7a6b" },
  POR_VENCER: { label: "Por vencer", color: "#f59e0b", bg: "#fef3c7", borde: "rgba(245,158,11,0.4)", texto: "#92400e" },
  EXTRA: { label: "Horas extra", color: "#ef4444", bg: "rgba(239,68,68,0.1)", borde: "rgba(239,68,68,0.35)", texto: "#b91c1c" },
  CERRADA: { label: "Cerrada", color: "#94a3b8", bg: "#f1f5f9", borde: "#e2e8f0", texto: "#475569" },
};

type EstadoJornada = "SIN_INICIAR" | "EN_JORNADA" | "POR_VENCER" | "EXTRA" | "CERRADA";

type Jornada = {
  driverId: string;
  inicio: Date | null;
  /** Inicio + 13 h. */
  limite: Date | null;
  /** Cierre real: fin del último viaje, o null si la jornada sigue abierta. */
  cierre: Date | null;
  estado: EstadoJornada;
  /** Milisegundos trabajados, hasta ahora o hasta el cierre. */
  trabajadoMs: number;
  /** Milisegundos por sobre las 13 h. */
  extraMs: number;
  /** Lo que mantiene la jornada abierta pasado el plazo. */
  viajeEnCurso: boolean;
  pendientes: number;
  totalViajes: number;
};

/** "4 h 20 min", "35 min". Un contador de jornada no necesita segundos. */
function formatoDuracion(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function horaCorta(fecha: Date | null): string {
  if (!fecha) return "—";
  return fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

type Trip = {
  id: string;
  driverId?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  driverRating?: number | null;
  requestedVehicleType?: string | null;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  passengerCount?: number | null;
};

type DriverItem = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ParticipantItem = {
  id: string;
  fullName?: string | null;
  metadata?: Record<string, unknown> | null;
};

/* ─── Constants ─── */
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00 .. 23:00
const LOAD_MEDIUM = 5;
const LOAD_HIGH = 9;

function semaphore(count: number): { color: string; label: string } {
  if (count >= LOAD_HIGH) return { color: STATE.danger, label: "Alta carga" };
  if (count >= LOAD_MEDIUM) return { color: STATE.warning, label: "Carga media" };
  return { color: STATE.success, label: "Disponible" };
}

function cellBg(count: number): string {
  if (count === 0) return SURFACE.borderMuted;
  if (count === 1) return "rgba(33,208,179,0.18)";
  if (count === 2) return "rgba(33,208,179,0.40)";
  if (count === 3) return "rgba(33,208,179,0.60)";
  return "rgba(33,208,179,0.80)";
}

function cellText(count: number): string {
  return count >= 3 ? SURFACE.card : SURFACE.text;
}

function formatRating(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(1);
}

/**
 * Nombre del conductor. Cuando el id no resuelve —fichas borradas que dejaron
 * viajes apuntando a ellas— el panel imprimía un pedazo del uuid, que no le
 * dice nada a nadie. Mejor decir qué pasó.
 */
function nombreConductor(driver: DriverItem | undefined): string {
  return nombrePropio(driver?.fullName) || "Conductor no registrado";
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Component ─── */
export default function DriverHeatmapPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [selectedDate, setSelectedDate] = useState(toLocalDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [rankTab, setRankTab] = useState<"trips" | "rating" | "idle">("trips");
  const [hoveredCell, setHoveredCell] = useState<{ driverId: string; hour: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // /drivers ya devuelve flota propia + choferes de proveedor, sin
      // duplicados: no hace falta fusionar nada aca.
      const [tripsData, driversData] = await Promise.all([
        apiFetch<Trip[]>("/trips"),
        apiFetch<DriverItem[]>("/drivers"),
      ]);
      setTrips(tripsData || []);
      const lookup: Record<string, DriverItem> = {};
      for (const d of driversData || []) {
        if (d.id) lookup[d.id] = d;
        if (d.userId) lookup[d.userId] = d;
      }
      setDrivers(lookup);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const poll = () => { pollRef.current = setTimeout(async () => { await loadData(true); poll(); }, 15000); };
    poll();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  /* ─── Date boundaries ─── */
  const { dayStart, dayEnd } = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59);
    return { dayStart: start, dayEnd: end };
  }, [selectedDate]);

  /* ─── ¿Se está viendo el día de hoy? ─── */
  const isViewingToday = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return selectedDate === todayStr;
  }, [selectedDate]);

  /* ─── Today's trips ─── */
  const dayTrips = useMemo(() =>
    trips.filter((tr) => {
      // Los viajes en curso (en ruta / en curso) siempre cuentan para HOY,
      // aunque su hora programada no caiga en el día seleccionado.
      if (isViewingToday && (tr.status === "EN_ROUTE" || tr.status === "PICKED_UP")) return true;
      const raw = tr.scheduledAt || tr.startedAt;
      if (!raw) return false;
      const d = new Date(raw);
      return d >= dayStart && d <= dayEnd;
    }),
  [trips, dayStart, dayEnd, isViewingToday]);

  /* ─── Jornadas del día: 13 h desde el primer viaje iniciado ─── */
  const jornadas = useMemo<Jornada[]>(() => {
    const ahora = new Date();
    const porConductor = new Map<string, Trip[]>();
    for (const tr of dayTrips) {
      if (!tr.driverId) continue;
      const lista = porConductor.get(tr.driverId) ?? [];
      lista.push(tr);
      porConductor.set(tr.driverId, lista);
    }

    const filas: Jornada[] = [];
    porConductor.forEach((viajes, driverId) => {
      const iniciados = viajes
        .map((v) => (v.startedAt ? new Date(v.startedAt) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      // Sin un viaje iniciado no hay jornada que contar: lo programado no
      // empieza a correr el reloj.
      if (iniciados.length === 0) {
        filas.push({
          driverId, inicio: null, limite: null, cierre: null, estado: "SIN_INICIAR",
          trabajadoMs: 0, extraMs: 0, viajeEnCurso: false,
          pendientes: viajes.length, totalViajes: viajes.length,
        });
        return;
      }

      const inicio = iniciados[0];
      const limite = new Date(inicio.getTime() + JORNADA_MS);
      const viajeEnCurso = viajes.some((v) => v.status === "EN_ROUTE" || v.status === "PICKED_UP");
      // Programados del día que todavía no se hacen. Son los que mantienen el
      // contador corriendo pasado el plazo.
      const pendientes = viajes.filter(
        (v) => !CERRADOS.has(v.status ?? "") && v.status !== "CANCELLED",
      ).length;

      const cierres = viajes
        .map((v) => (v.completedAt ? new Date(v.completedAt) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      const ultimoCierre = cierres[0] ?? null;

      const abierta = viajeEnCurso || pendientes > 0;
      const cierre = abierta ? null : ultimoCierre;
      const hasta = abierta ? ahora : (ultimoCierre ?? ahora);
      const trabajadoMs = Math.max(0, hasta.getTime() - inicio.getTime());
      const extraMs = Math.max(0, hasta.getTime() - limite.getTime());

      let estado: EstadoJornada;
      if (!abierta) estado = "CERRADA";
      else if (ahora >= limite) estado = "EXTRA";
      else if (limite.getTime() - ahora.getTime() <= JORNADA_AVISO_MS) estado = "POR_VENCER";
      else estado = "EN_JORNADA";

      filas.push({
        driverId, inicio, limite, cierre, estado,
        trabajadoMs, extraMs, viajeEnCurso, pendientes,
        totalViajes: viajes.length,
      });
    });

    // Primero quien está en extras, después quien va a vencer: es el orden en
    // que el operador tiene que actuar.
    const peso: Record<EstadoJornada, number> = {
      EXTRA: 0, POR_VENCER: 1, EN_JORNADA: 2, CERRADA: 3, SIN_INICIAR: 4,
    };
    return filas.sort(
      (a, b) =>
        peso[a.estado] - peso[b.estado] ||
        b.extraMs - a.extraMs ||
        (drivers[a.driverId]?.fullName ?? "").localeCompare(drivers[b.driverId]?.fullName ?? ""),
    );
  }, [dayTrips, drivers]);

  /* ─── Active driver IDs for the day ─── */
  const activeDriverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tr of dayTrips) if (tr.driverId) ids.add(tr.driverId);
    return Array.from(ids).sort((a, b) => {
      const nameA = drivers[a]?.fullName ?? "";
      const nameB = drivers[b]?.fullName ?? "";
      return nameA.localeCompare(nameB);
    });
  }, [dayTrips, drivers]);

  /* ─── Heatmap data: driverId → hour → Trip[] ─── */
  const heatmap = useMemo(() => {
    const map = new Map<string, Map<number, Trip[]>>();
    for (const tr of dayTrips) {
      if (!tr.driverId) continue;
      if (!map.has(tr.driverId)) map.set(tr.driverId, new Map());
      const rawTime = tr.scheduledAt || tr.startedAt;
      const hour = rawTime ? new Date(rawTime).getHours() : new Date().getHours();
      const hm = map.get(tr.driverId)!;
      if (!hm.has(hour)) hm.set(hour, []);
      hm.get(hour)!.push(tr);
    }
    return map;
  }, [dayTrips]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const ratings = dayTrips.map((t) => t.driverRating).filter((r): r is number => r != null && r > 0);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
    const hourCounts = new Map<number, number>();
    for (const tr of dayTrips) {
      const h = new Date(tr.scheduledAt || tr.startedAt!).getHours();
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
    let busiestHour = "—";
    let maxC = 0;
    for (const [h, c] of hourCounts) {
      if (c > maxC) { maxC = c; busiestHour = `${String(h).padStart(2, "0")}:00`; }
    }
    const completed = dayTrips.filter((t) => t.status === "COMPLETED" || t.status === "DROPPED_OFF").length;
    const cancelled = dayTrips.filter((t) => t.status === "CANCELLED").length;
    return {
      totalTrips: dayTrips.length,
      activeDrivers: activeDriverIds.length,
      avgRating,
      busiestHour,
      busiestHourCount: maxC,
      completed,
      cancelled,
      ratingsCount: ratings.length,
    };
  }, [dayTrips, activeDriverIds]);

  /* ─── Driver rankings (all time) ─── */
  const rankings = useMemo(() => {
    const byDriver = new Map<string, Trip[]>();
    for (const tr of trips) {
      if (!tr.driverId) continue;
      if (!byDriver.has(tr.driverId)) byDriver.set(tr.driverId, []);
      byDriver.get(tr.driverId)!.push(tr);
    }
    return Array.from(byDriver.entries()).map(([driverId, driverTrips]) => {
      const ratings = driverTrips.map((t) => t.driverRating).filter((r): r is number => r != null && r > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      const todayDriverTrips = driverTrips.filter((tr) => {
        const raw = tr.scheduledAt || tr.startedAt;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= dayStart && d <= dayEnd;
      });
      const activeHoursSet = new Set(todayDriverTrips.map((tr) => new Date(tr.scheduledAt || tr.startedAt!).getHours()));
      return {
        driverId,
        name: nombreConductor(drivers[driverId]),
        totalTrips: driverTrips.length,
        todayTrips: todayDriverTrips.length,
        avgRating,
        activeHours: activeHoursSet.size,
        idleHours: HOURS.length - activeHoursSet.size,
        completedTrips: driverTrips.filter((t) => t.status === "COMPLETED" || t.status === "DROPPED_OFF").length,
      };
    });
  }, [trips, drivers, dayStart, dayEnd]);

  const sortedRankings = useMemo(() => {
    const arr = [...rankings];
    if (rankTab === "trips") arr.sort((a, b) => b.totalTrips - a.totalTrips);
    else if (rankTab === "rating") arr.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    else arr.sort((a, b) => b.idleHours - a.idleHours);
    return arr.slice(0, 15);
  }, [rankings, rankTab]);

  /* ─── Palette ─── */
  const pal = {
    pageBg: SURFACE.bg,
    cardBg: SURFACE.card,
    cardBorder: "#e8ecf1",
    textPrimary: SURFACE.text,
    textMuted: SURFACE.textMuted,
    labelColor: SURFACE.textFaint,
    shadow: "0 1px 6px rgba(15,23,42,0.06)",
  };

  const driverTodayCount = (driverId: string) => {
    const hm = heatmap.get(driverId);
    if (!hm) return 0;
    let total = 0;
    for (const arr of hm.values()) total += arr.length;
    return total;
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 4px" }}>
            Panel de conductores
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.textPrimary, margin: 0 }}>
            Mapa de Calor & Rankings
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: "12px", border: `1px solid ${pal.cardBorder}`, fontSize: "13px", fontWeight: 600, color: pal.textPrimary, background: pal.cardBg }}
          />
          <button type="button" onClick={() => loadData()} disabled={loading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 12, border: `1px solid ${pal.cardBorder}`, background: pal.cardBg, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            <RefreshIcon size={14} color={pal.textMuted} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Viajes del día", value: kpis.totalTrips, color: STATE.warning,
            detail: kpis.cancelled > 0 ? `${kpis.cancelled} cancelado${kpis.cancelled === 1 ? "" : "s"}` : "sin cancelaciones",
          },
          {
            label: "Completados", value: kpis.completed, color: STATE.success,
            detail: kpis.totalTrips > 0 ? `${Math.round((kpis.completed / kpis.totalTrips) * 100)}% del día` : "—",
          },
          {
            label: "Conductores activos", value: kpis.activeDrivers, color: STATE.info,
            detail: kpis.activeDrivers > 0 ? `${(kpis.totalTrips / kpis.activeDrivers).toFixed(1)} viajes por conductor` : "sin actividad",
          },
          {
            label: "Rating promedio", value: kpis.avgRating !== null ? kpis.avgRating.toFixed(1) : "—", color: ACCENT.indigo,
            detail: kpis.ratingsCount > 0 ? `sobre ${kpis.ratingsCount} evaluación${kpis.ratingsCount === 1 ? "" : "es"}` : "sin evaluaciones",
          },
          {
            label: "Hora punta", value: kpis.busiestHour, color: "#ec4899",
            detail: kpis.busiestHourCount > 0 ? `${kpis.busiestHourCount} viaje${kpis.busiestHourCount === 1 ? "" : "s"} en esa hora` : "—",
          },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: pal.cardBg, borderRadius: "16px", padding: "16px 18px", borderTop: `3px solid ${kpi.color}`, boxShadow: pal.shadow }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.labelColor, margin: "0 0 4px" }}>{kpi.label}</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</p>
            <p style={{ fontSize: "10.5px", fontWeight: 600, color: pal.labelColor, margin: "6px 0 0" }}>{kpi.detail}</p>
          </div>
        ))}
      </div>

      {/* ── Heatmap ── */}
      <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${pal.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 4px" }}>Mapa de calor</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: pal.textPrimary, margin: 0 }}>Actividad por conductor y hora</p>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {[
              { count: 0, label: "Sin viajes" },
              { count: 1, label: "1 viaje" },
              { count: 2, label: "2 viajes" },
              { count: 3, label: "3+ viajes" },
            ].map((l) => (
              <div key={l.count} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: cellBg(l.count), border: "1px solid rgba(0,0,0,0.06)" }} />
                <span style={{ fontSize: "10px", color: pal.labelColor }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto", padding: "0 0 8px" }}>
          {activeDriverIds.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: pal.textMuted, fontSize: "14px" }}>
              No hay conductores con viajes para esta fecha.
            </div>
          ) : (
            <div style={{ minWidth: "900px" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "200px repeat(17, 1fr)", gap: "2px", padding: "8px 12px 4px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: pal.labelColor, textTransform: "uppercase", letterSpacing: "0.1em", padding: "6px 8px" }}>
                  Conductor
                </div>
                {HOURS.map((h) => (
                  <div key={h} style={{ fontSize: "10px", fontWeight: 700, color: pal.labelColor, textAlign: "center", padding: "6px 0" }}>
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>

              {/* Driver rows */}
              {activeDriverIds.map((driverId, rowIdx) => {
                const driver = drivers[driverId];
                const todayCount = driverTodayCount(driverId);
                const sem = semaphore(todayCount);
                const hourMap = heatmap.get(driverId);
                return (
                  <div key={driverId} style={{
                    display: "grid", gridTemplateColumns: "200px repeat(17, 1fr)", gap: "2px", padding: "0 12px",
                    background: rowIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                  }}>
                    {/* Driver name cell */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 8px", minHeight: "40px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sem.color, flexShrink: 0, boxShadow: `0 0 6px ${sem.color}40` }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: pal.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nombreConductor(driver)}
                        </p>
                        <p style={{ fontSize: "10px", color: pal.labelColor, margin: 0 }}>{todayCount} viajes</p>
                      </div>
                    </div>

                    {/* Hour cells */}
                    {HOURS.map((h) => {
                      const cellTrips = hourMap?.get(h) || [];
                      const count = cellTrips.length;
                      const isHovered = hoveredCell?.driverId === driverId && hoveredCell?.hour === h;
                      return (
                        <div
                          key={h}
                          onMouseEnter={() => setHoveredCell({ driverId, hour: h })}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            position: "relative",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: cellBg(count),
                            borderRadius: "6px",
                            minHeight: "40px",
                            cursor: count > 0 ? "pointer" : "default",
                            transition: "transform 0.1s",
                            transform: isHovered && count > 0 ? "scale(1.08)" : "scale(1)",
                            boxShadow: isHovered && count > 0 ? "0 2px 12px rgba(33,208,179,0.3)" : "none",
                          }}
                        >
                          {count > 0 && (
                            <span style={{ fontSize: "13px", fontWeight: 800, color: cellText(count) }}>
                              {count}
                            </span>
                          )}
                          {/* Tooltip */}
                          {isHovered && count > 0 && (
                            <div style={{
                              position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                              background: SURFACE.text, color: SURFACE.card, borderRadius: "10px", padding: "10px 14px",
                              fontSize: "11px", whiteSpace: "nowrap", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                              pointerEvents: "none",
                            }}>
                              <p style={{ fontWeight: 700, margin: "0 0 4px", color: BRAND.teal }}>
                                {driver?.fullName} · {String(h).padStart(2, "0")}:00
                              </p>
                              {cellTrips.map((tr, i) => (
                                <p key={i} style={{ margin: "2px 0", color: SURFACE.borderStrong }}>
                                  {tr.origin?.split(",")[0] || "?"} → {tr.destination?.split(",")[0] || "?"} · {tr.passengerCount || 0} pax
                                </p>
                              ))}
                              <div style={{ position: "absolute", bottom: "-4px", left: "50%", transform: "translateX(-50%) rotate(45deg)", width: "8px", height: "8px", background: SURFACE.text }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Jornadas: el reloj de 13 h de cada conductor ──
          Regla: arranca con el primer viaje iniciado del día. Al cumplirse el
          plazo no se corta: sigue como horas extra mientras al conductor le
          quede un viaje en curso o viajes del día sin hacer. */}
      <section style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "20px", padding: "20px", boxShadow: pal.shadow }}>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: pal.labelColor }}>
              {t("Control de jornada")}
            </p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>
              {t("Jornada de 13 horas")}
            </h3>
            <p style={{ marginTop: "2px", fontSize: "12px", color: pal.textMuted }}>
              {t("Cuenta desde el primer viaje iniciado. Pasado el plazo sigue como horas extra hasta que el conductor termine el último viaje del día.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {[
              { label: t("En jornada"), valor: jornadas.filter((j) => j.estado === "EN_JORNADA").length, color: null },
              { label: t("Por vencer"), valor: jornadas.filter((j) => j.estado === "POR_VENCER").length, color: STATE.warning },
              { label: t("En extras"), valor: jornadas.filter((j) => j.estado === "EXTRA").length, color: STATE.danger },
            ].map((k) => (
              <span key={k.label} style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: pal.labelColor, whiteSpace: "nowrap" }}>
                  {k.label}
                </span>
                <span style={{ fontSize: "20px", lineHeight: 1, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: k.color && k.valor > 0 ? k.color : pal.textPrimary }}>
                  {k.valor}
                </span>
              </span>
            ))}
          </div>
        </div>

        {jornadas.length === 0 ? (
          <div style={{ borderRadius: "14px", border: `1px dashed ${pal.cardBorder}`, padding: "36px 20px", textAlign: "center", color: pal.textMuted, fontSize: "13px" }}>
            {t("Ningún conductor con viajes este día.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jornadas.map((j) => {
              const tono = ESTADO_JORNADA[j.estado];
              const chofer = drivers[j.driverId];
              // La barra se llena con las 13 h; en extras se pinta completa.
              const avance = j.limite && j.inicio
                ? Math.min(100, (j.trabajadoMs / JORNADA_MS) * 100)
                : 0;
              const restante = j.limite ? j.limite.getTime() - Date.now() : 0;
              return (
                <div
                  key={j.driverId}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                    padding: "12px 14px", borderRadius: 14,
                    border: `1px solid ${SURFACE.border}`,
                    borderLeft: `4px solid ${tono.color}`,
                    background: SURFACE.card,
                  }}
                >
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nombreConductor(chofer)}
                    </p>
                    <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "3px 0 0" }}>
                      {j.inicio
                        ? `${t("Inicio")} ${horaCorta(j.inicio)} · ${t("plazo hasta")} ${horaCorta(j.limite)}`
                        : t("Sin viajes iniciados")}
                    </p>
                  </div>

                  <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                    <div style={{ height: 7, borderRadius: 99, background: SURFACE.borderMuted, overflow: "hidden" }}>
                      <div style={{ width: `${avance}%`, height: "100%", background: tono.color, transition: "width .3s" }} />
                    </div>
                    <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "5px 0 0", fontVariantNumeric: "tabular-nums" }}>
                      {j.inicio ? `${formatoDuracion(j.trabajadoMs)} ${t("de")} ${JORNADA_HORAS} h` : "—"}
                      {j.estado === "EN_JORNADA" || j.estado === "POR_VENCER"
                        ? ` · ${t("quedan")} ${formatoDuracion(restante)}`
                        : ""}
                    </p>
                  </div>

                  <div style={{ flex: "0 0 auto", textAlign: "right", minWidth: 150 }}>
                    <span style={{
                      display: "inline-block", fontSize: 10.5, fontWeight: 700,
                      padding: "3px 10px", borderRadius: 99,
                      background: tono.bg, border: `1px solid ${tono.borde}`, color: tono.texto,
                    }}>
                      {t(tono.label)}
                    </span>
                    <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "5px 0 0" }}>
                      {j.extraMs > 0 ? (
                        <span style={{ color: STATE.dangerText, fontWeight: 700 }}>
                          +{formatoDuracion(j.extraMs)} {t("extra")}
                        </span>
                      ) : (
                        `${j.totalViajes} ${j.totalViajes === 1 ? t("viaje") : t("viajes")}`
                      )}
                    </p>
                    {/* Por qué sigue corriendo el contador pasado el plazo. */}
                    {j.estado === "EXTRA" && (
                      <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "2px 0 0" }}>
                        {j.viajeEnCurso
                          ? t("viaje en curso sin terminar")
                          : `${j.pendientes} ${j.pendientes === 1 ? t("viaje pendiente del día") : t("viajes pendientes del día")}`}
                      </p>
                    )}
                    {j.estado === "CERRADA" && j.cierre && (
                      <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "2px 0 0" }}>
                        {t("cerró")} {horaCorta(j.cierre)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Rankings ── apilados en móvil, lado a lado desde lg ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left: Ranking table */}
        <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${pal.cardBorder}` }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT.indigo, margin: "0 0 8px" }}>Rankings generales</p>
            <div style={{ display: "flex", gap: "4px" }}>
              {([
                { key: "trips" as const, label: "Más viajes" },
                { key: "rating" as const, label: "Mejor calificados" },
                { key: "idle" as const, label: "Mayor inactividad" },
              ]).map((tab) => (
                <button key={tab.key} type="button" onClick={() => setRankTab(tab.key)}
                  style={{
                    padding: "6px 14px", borderRadius: "99px", border: "none", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    background: rankTab === tab.key ? `linear-gradient(135deg,${ACCENT.indigo},#4f46e5)` : SURFACE.borderMuted,
                    color: rankTab === tab.key ? SURFACE.card : pal.textMuted,
                    boxShadow: rankTab === tab.key ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {sortedRankings.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: pal.textMuted, fontSize: "13px" }}>Sin datos</div>
            ) : (
              sortedRankings.map((r, i) => {
                const sem = semaphore(r.todayTrips);
                const medalColor = i === 0 ? STATE.warning : i === 1 ? SURFACE.textFaint : i === 2 ? STATE.warningText : null;
                return (
                  <div key={r.driverId} style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 100px 50px",
                    gap: "8px", alignItems: "center", padding: "10px 20px",
                    background: i % 2 === 0 ? "transparent" : "#fafafa",
                    borderBottom: `1px solid ${pal.cardBorder}`,
                  }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: medalColor ?? pal.labelColor, textAlign: "center", display: "inline-flex", justifyContent: "center" }}>
                      {medalColor ? <MedalIcon size={16} color={medalColor} /> : `#${i + 1}`}
                    </span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary, margin: 0 }}>{r.name}</p>
                      <p style={{ fontSize: "10px", color: pal.labelColor, margin: 0 }}>{r.todayTrips} viajes hoy · {r.activeHours}h activo</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {rankTab === "trips" && <span style={{ fontSize: "16px", fontWeight: 800, color: ACCENT.indigo }}>{r.totalTrips}</span>}
                      {rankTab === "rating" && (
                        <span style={{ fontSize: "16px", fontWeight: 800, color: STATE.warning }}>
                          {formatRating(r.avgRating)} <StarIcon size={11} className="inline" />
                        </span>
                      )}
                      {rankTab === "idle" && <span style={{ fontSize: "16px", fontWeight: 800, color: STATE.danger }}>{r.idleHours}h</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: sem.color, boxShadow: `0 0 6px ${sem.color}40` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Summary cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Semaphore legend */}
          <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, padding: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 12px" }}>
              Indicadores de carga
            </p>
            {[
              { color: STATE.success, label: "Disponible", desc: `0–${LOAD_MEDIUM - 1} viajes en el día` },
              { color: STATE.warning, label: "Carga media", desc: `${LOAD_MEDIUM}–${LOAD_HIGH - 1} viajes en el día` },
              { color: STATE.danger, label: "Alta carga", desc: `${LOAD_HIGH}+ viajes en el día` },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: `0 0 8px ${s.color}30` }} />
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: s.color, margin: 0 }}>{s.label}</p>
                  <p style={{ fontSize: "11px", color: pal.labelColor, margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top 3 rated */}
          <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, padding: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: STATE.warning, margin: "0 0 12px" }}>
              Mejor evaluados
            </p>
            {rankings
              .filter((r) => r.avgRating !== null)
              .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
              .slice(0, 3)
              .map((r, i) => (
                <div key={r.driverId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <MedalIcon size={18} color={i === 0 ? STATE.warning : i === 1 ? SURFACE.textFaint : STATE.warningText} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary, margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: "10px", color: pal.labelColor, margin: 0 }}>{r.completedTrips} viajes completados</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: STATE.warning }}>{formatRating(r.avgRating)}</span>
                    <StarIcon size={14} color={STATE.warning} strokeWidth={1} fill={STATE.warning} />
                  </div>
                </div>
              ))}
            {rankings.filter((r) => r.avgRating !== null).length === 0 && (
              <p style={{ fontSize: "12px", color: pal.textMuted, textAlign: "center" }}>Sin evaluaciones aún</p>
            )}
          </div>

          {/* Most active today */}
          <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, padding: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: STATE.info, margin: "0 0 12px" }}>
              Más activos hoy
            </p>
            {rankings
              .sort((a, b) => b.todayTrips - a.todayTrips)
              .slice(0, 5)
              .filter((r) => r.todayTrips > 0)
              .map((r) => {
                const pct = rankings.length > 0 ? Math.round((r.todayTrips / Math.max(...rankings.map((x) => x.todayTrips), 1)) * 100) : 0;
                return (
                  <div key={r.driverId} style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textPrimary }}>{r.name}</span>
                      <span style={{ fontSize: "12px", fontWeight: 800, color: STATE.info }}>{r.todayTrips}</span>
                    </div>
                    <div style={{ height: "6px", borderRadius: "3px", background: SURFACE.borderMuted, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "3px", background: `linear-gradient(90deg,${STATE.info},#6366f1)`, width: `${pct}%`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            {rankings.filter((r) => r.todayTrips > 0).length === 0 && (
              <p style={{ fontSize: "12px", color: pal.textMuted, textAlign: "center" }}>Sin actividad hoy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
