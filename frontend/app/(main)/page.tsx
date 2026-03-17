"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import DonutChart from "@/components/charts/DonutChart";
import BarChart from "@/components/charts/BarChart";

type Trip = { id: string; status?: string | null };
type HotelAssignment = { id: string; roomId?: string | null; status?: string | null };
type HotelRoom = { id: string; status?: string | null };

const STATUS = {
  scheduled: new Set(["SCHEDULED", "PROGRAMADO", "PROGRAMADA", "PROGRAMMED"]),
  active: new Set(["EN_ROUTE", "EN_RUTA", "PICKED_UP", "RECOGIDO", "DROPPED_OFF"]),
  completed: new Set(["COMPLETED", "FINALIZADO", "COMPLETADO"]),
};

const norm = (v?: string | null) => (v ? v.trim().toUpperCase() : "");
const fmt = (n: number) => new Intl.NumberFormat("es-CL").format(n);

function KpiCard({
  label,
  value,
  helper,
  accent = false,
  index = 0,
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: boolean;
  index?: number;
}) {
  return (
    <div
      className={`rounded-xl p-5 animate-fade-up stagger-${Math.min(index + 1, 6)}`}
      style={{
        background: accent ? "var(--gold-dim)" : "var(--surface)",
        border: `1px solid ${accent ? "rgba(212,168,67,0.25)" : "var(--border-muted)"}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
      }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.18em] font-semibold"
        style={{ color: accent ? "var(--gold)" : "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-3 font-bold tabular-nums"
        style={{
          fontSize: "1.9rem",
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: accent ? "var(--gold-light)" : "var(--text)",
        }}
      >
        {value}
      </p>
      {helper ? <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{helper}</p> : null}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <p className="section-label mb-4">{label}</p>;
}

function ProgressRow({
  label,
  value,
  total,
  color = "#c9a84c",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="font-semibold" style={{ color }}>
          {fmt(value)} <span style={{ color: "var(--text-faint)" }}>/ {fmt(total)}</span>
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="rounded-lg p-4 text-center" style={{ background: "var(--elevated)", border: "1px solid var(--border-muted)" }}>
      <p className="font-bold text-2xl tabular-nums" style={{ color }}>
        {fmt(count)}
      </p>
      <p className="text-[11px] mt-1 uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

export default function Page() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsCount, setEventsCount] = useState(0);
  const [athletesCount, setAthletesCount] = useState(0);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [accommodationsCount, setAccommodationsCount] = useState(0);
  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [hotelAssignments, setHotelAssignments] = useState<HotelAssignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [events, athletes, tripsList, accommodations, rooms, assignments] = await Promise.all([
          apiFetch("/events"),
          apiFetch("/athletes"),
          apiFetch("/trips"),
          apiFetch("/accommodations"),
          apiFetch("/hotel-rooms").catch(() => []),
          apiFetch("/hotel-assignments").catch(() => []),
        ]);
        if (cancelled) return;
        setEventsCount(Array.isArray(events) ? events.length : 0);
        setAthletesCount(Array.isArray(athletes) ? filterValidatedAthletes(athletes).length : 0);
        setTrips(Array.isArray(tripsList) ? tripsList : []);
        setAccommodationsCount(Array.isArray(accommodations) ? accommodations.length : 0);
        setHotelRooms(Array.isArray(rooms) ? rooms : []);
        setHotelAssignments(Array.isArray(assignments) ? assignments : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tripStats = useMemo(() => {
    const s = { scheduled: 0, active: 0, completed: 0 };
    trips.forEach((trip) => {
      const st = norm(trip.status);
      if (STATUS.completed.has(st)) s.completed += 1;
      else if (STATUS.active.has(st)) s.active += 1;
      else if (STATUS.scheduled.has(st)) s.scheduled += 1;
    });
    return s;
  }, [trips]);

  const bedStats = useMemo(() => {
    const occupied = hotelAssignments.filter(
      (a) => a.roomId && !["CHECKOUT", "CHECKED_OUT", "FINISHED", "CANCELLED"].includes(norm(a.status)),
    ).length;
    return { available: Math.max(0, hotelRooms.length - occupied), occupied, total: hotelRooms.length };
  }, [hotelAssignments, hotelRooms]);

  const roomStats = useMemo(() => {
    const available = hotelRooms.filter((r) => ["AVAILABLE", "DISPONIBLE", ""].includes(norm(r.status)) || !r.status)
      .length;
    return { available, total: hotelRooms.length };
  }, [hotelRooms]);

  const occupancyPct = bedStats.total > 0 ? Math.round((bedStats.occupied / bedStats.total) * 100) : 0;
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";

  const tripDonutSegments = [
    { value: tripStats.scheduled, color: "#f59e0b", label: "Programados" },
    { value: tripStats.active, color: "#10b981", label: "En curso" },
    { value: tripStats.completed, color: "#22d3ee", label: "Completados" },
  ].filter((s) => s.value > 0);

  const hotelDonutSegments = [
    { value: bedStats.occupied, color: "#a855f7", label: "Ocupadas" },
    { value: bedStats.available, color: "#22d3ee", label: "Disponibles" },
  ].filter((s) => s.value > 0);

  const tripBarData = [
    { label: "Prog.", value: tripStats.scheduled, color: "#f59e0b" },
    { label: "Activo", value: tripStats.active, color: "#10b981" },
    { label: "Hecho", value: tripStats.completed, color: "#22d3ee" },
  ];

  if (isObsidian) {
    return (
      <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>
        {/* ── KPI row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Participantes", value: fmt(athletesCount), color: "#22d3ee", icon: "👥" },
            { label: "Eventos", value: fmt(eventsCount), color: "#a855f7", icon: "🗓" },
            { label: "Hoteles", value: fmt(accommodationsCount), color: "#f59e0b", icon: "🏨" },
            { label: "Viajes totales", value: fmt(trips.length), color: "#10b981", icon: "🚌" },
            { label: "Asignaciones", value: fmt(hotelAssignments.length), color: "#22d3ee", icon: "🛏" },
            { label: "Ocupación", value: `${occupancyPct}%`, color: occupancyPct > 80 ? "#ef4444" : "#10b981", icon: "📊" },
          ].map((kpi, i) => (
            <div key={i} className="glass-card p-4" style={{ animationDelay: `${i * 0.06}s`, animation: "fadeInUp 0.4s ease both" }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: "18px" }}>{kpi.icon}</span>
                <span style={{ fontSize: "10px", color: kpi.color, fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              </div>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 20px ${kpi.color}66` }}>
                {loading ? "—" : kpi.value}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ── Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Transport donut */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: "#22d3ee", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Transporte</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Estado de viajes</p>
              </div>
              <Link href="/operations/trips" style={{ fontSize: "11px", color: "#22d3ee", textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div className="flex items-center justify-center gap-6">
              {tripDonutSegments.length > 0 ? (
                <DonutChart segments={tripDonutSegments} size={140} thickness={20}
                  label={fmt(trips.length)} sublabel="total" />
              ) : (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Hotel donut */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: "#a855f7", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Hotelería</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Ocupación de camas</p>
              </div>
              <Link href="/operations/hotel-tracking" style={{ fontSize: "11px", color: "#a855f7", textDecoration: "none" }}>Ver tracking →</Link>
            </div>
            <div className="flex items-center justify-center">
              {hotelDonutSegments.length > 0 ? (
                <DonutChart segments={hotelDonutSegments} size={140} thickness={20}
                  label={`${occupancyPct}%`} sublabel="ocupado" />
              ) : (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Bar chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Distribución</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Viajes por estado</p>
              </div>
            </div>
            <BarChart data={tripBarData} height={100} showValues />
          </div>
        </div>

        {/* ── Hotel rooms grid */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontSize: "11px", color: "#22d3ee", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Inventario hotelero</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total habitaciones", value: fmt(roomStats.total), color: "rgba(255,255,255,0.7)" },
              { label: "Disponibles", value: fmt(roomStats.available), color: "#22d3ee" },
              { label: "Total camas", value: fmt(bedStats.total), color: "rgba(255,255,255,0.7)" },
              { label: "Camas libres", value: fmt(bedStats.available), color: "#10b981" },
            ].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{item.label}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: item.color, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "—" : item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span>Camas ocupadas</span>
                <span style={{ color: "#a855f7", fontWeight: 600 }}>{bedStats.occupied} / {bedStats.total}</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.07)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${occupancyPct}%`, background: "linear-gradient(90deg, #22d3ee, #a855f7)", borderRadius: "99px", boxShadow: "0 0 8px rgba(168,85,247,0.5)", transition: "width 0.8s ease" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span>Habitaciones disponibles</span>
                <span style={{ color: "#10b981", fontWeight: 600 }}>{roomStats.available} / {roomStats.total}</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.07)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: roomStats.total > 0 ? `${Math.round((roomStats.available / roomStats.total) * 100)}%` : "0%", background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: "99px", boxShadow: "0 0 8px rgba(16,185,129,0.4)", transition: "width 0.8s ease" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero */}
      <section className="rounded-xl p-6 animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--border-muted)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label mb-2">Event Operations Dashboard</p>
            <h1 className="font-bold" style={{ fontSize: "1.6rem", letterSpacing: "-0.02em", color: "var(--text)" }}>Panel Operativo</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? "Cargando datos..." : error ? "Error al cargar" : "Resumen en tiempo real del evento"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error ? <span className="badge badge-rose">{error}</span> : null}
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "var(--success-dim)", border: "1px solid rgba(63,185,80,0.2)", color: "var(--success)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)", animation: "pulseDot 2s ease-in-out infinite" }} />
              {loading ? "Cargando" : "En vivo"}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3">
          <KpiCard label="Participantes" value={loading ? "—" : fmt(athletesCount)} helper="Total en plataforma" accent index={0} />
          <KpiCard label="Eventos activos" value={loading ? "—" : fmt(eventsCount)} helper="Configurados" index={1} />
          <KpiCard label="Hoteles registrados" value={loading ? "—" : fmt(accommodationsCount)} helper="Inventario activo" index={2} />
        </div>
      </section>

      {/* ── Viajes */}
      <section className="animate-fade-up stagger-2">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle label="Movilidad · Transporte" />
          <Link href="/operations/trips" className="text-xs font-semibold transition-colors" style={{ color: "var(--brand)" }}>Ver todos →</Link>
        </div>
        <div className="surface rounded-xl p-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatusPill count={loading ? 0 : tripStats.scheduled} label="Programados" color="var(--gold)" />
            <StatusPill count={loading ? 0 : tripStats.active} label="En curso" color="var(--success)" />
            <StatusPill count={loading ? 0 : tripStats.completed} label="Completados" color="var(--info)" />
          </div>
          <ProgressRow label="Completados del total" value={tripStats.completed} total={trips.length} />
        </div>
      </section>

      {/* ── Hotelería */}
      <section className="animate-fade-up stagger-3">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle label="Hotelería · Ocupación" />
          <Link href="/operations/hotel-tracking" className="text-xs font-semibold transition-colors" style={{ color: "var(--brand)" }}>Ver tracking →</Link>
        </div>
        <div className="surface rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <KpiCard label="Asignaciones" value={loading ? "—" : fmt(hotelAssignments.length)} helper="Con cama asignada" index={0} />
            <KpiCard label="Habitaciones disp." value={loading ? "—" : fmt(roomStats.available)} helper={`de ${fmt(roomStats.total)}`} index={1} />
            <KpiCard label="Camas disp." value={loading ? "—" : fmt(bedStats.available)} helper={`de ${fmt(bedStats.total)}`} index={2} />
            <KpiCard label="Ocupación" value={loading ? "—" : `${occupancyPct}%`} helper="Camas ocupadas" accent index={3} />
          </div>
          <div className="space-y-3">
            <ProgressRow label="Camas ocupadas" value={bedStats.occupied} total={bedStats.total} />
            <ProgressRow label="Habitaciones disponibles" value={roomStats.available} total={roomStats.total} color="var(--success)" />
          </div>
        </div>
      </section>
    </div>
  );
}
