"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";

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

  return (
    <div className="space-y-6">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="rounded-xl p-6 animate-fade-up"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-muted)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label mb-2">Event Operations Dashboard</p>
            <h1 className="font-bold" style={{ fontSize: "1.6rem", letterSpacing: "-0.02em", color: "var(--text)" }}>
              Panel Operativo
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? "Cargando datos..." : error ? "Error al cargar" : "Resumen en tiempo real del evento"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error ? <span className="badge badge-rose">{error}</span> : null}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "var(--success-dim)", border: "1px solid rgba(63,185,80,0.2)", color: "var(--success)" }}
            >
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

      {/* ── Viajes ─────────────────────────────────────────── */}
      <section className="animate-fade-up stagger-2">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle label="Movilidad · Transporte" />
          <Link href="/operations/trips" className="text-xs font-semibold transition-colors" style={{ color: "var(--gold)" }}>
            Ver todos →
          </Link>
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

      {/* ── Hotelería ──────────────────────────────────────── */}
      <section className="animate-fade-up stagger-3">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle label="Hotelería · Ocupación" />
          <Link href="/operations/hotel-tracking" className="text-xs font-semibold transition-colors" style={{ color: "var(--gold)" }}>
            Ver tracking →
          </Link>
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
