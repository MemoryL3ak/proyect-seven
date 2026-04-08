"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import DonutChart from "@/components/charts/DonutChart";
import BarChart from "@/components/charts/BarChart";
import { downloadExcel, downloadPDF } from "@/lib/reports";

// ── Brand palette — Seven Arena ────────────────────────────────
const TEAL       = "#21D0B3";
const TEAL_LIGHT = "#34F3C6";
const BLUE       = "#1FCDFF";
const CHARCOAL   = "#30455B";

type Trip = { id: string; status?: string | null };
type HotelAssignment = { id: string; roomId?: string | null; status?: string | null };
type HotelRoom = { id: string; status?: string | null };
type Discipline = { id: string; name?: string | null; parentId?: string | null; category?: string | null; gender?: string | null };
type EventData = { id: string; expectedCapacities?: Array<{ disciplineId: string; delegationCode: string; expectedCount: number }> };
type AthleteItem = { id: string; disciplineId?: string | null; status?: string | null };

const STATUS = {
  scheduled: new Set(["SCHEDULED", "PROGRAMADO", "PROGRAMADA", "PROGRAMMED"]),
  active: new Set(["EN_ROUTE", "EN_RUTA", "PICKED_UP", "RECOGIDO", "DROPPED_OFF"]),
  completed: new Set(["COMPLETED", "FINALIZADO", "COMPLETADO"]),
};

const norm = (v?: string | null) => (v ? v.trim().toUpperCase() : "");
const fmt  = (n: number) => new Intl.NumberFormat("es-CL").format(n);

function Card({ children, accentColor, style }: { children: React.ReactNode; accentColor?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderTop: accentColor ? `2px solid ${accentColor}` : "1px solid #e2e8f0",
      borderRadius: "16px",
      padding: "20px",
      boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "11px", color, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: "#f1f5f9", borderRadius: "99px", overflow: "hidden", position: "relative" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, pct)}%`,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        borderRadius: "99px",
        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: `0 0 8px ${color}30`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
          animation: "shimmer 2.5s ease-in-out infinite",
        }} />
      </div>
    </div>
  );
}

export default function Page() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [eventsCount, setEventsCount] = useState(0);
  const [athletesCount, setAthletesCount] = useState(0);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [accommodationsCount, setAccommodationsCount] = useState(0);
  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [hotelAssignments, setHotelAssignments] = useState<HotelAssignment[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [capacityByDiscipline, setCapacityByDiscipline] = useState<Map<string, number>>(new Map());
  const [athletesByDiscipline, setAthletesByDiscipline] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [events, athletes, tripsList, accommodations, rooms, assignments, disciplinesList] = await Promise.all([
          apiFetch<EventData[]>("/events"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch("/trips"),
          apiFetch("/accommodations"),
          apiFetch("/hotel-rooms").catch(() => []),
          apiFetch("/hotel-assignments").catch(() => []),
          apiFetch<Discipline[]>("/disciplines").catch(() => []),
        ]);
        if (cancelled) return;
        setEventsCount(Array.isArray(events) ? events.length : 0);
        const validAthletes = Array.isArray(athletes) ? filterValidatedAthletes(athletes) : [];
        setAthletesCount(validAthletes.length);
        setTrips(Array.isArray(tripsList) ? tripsList : []);
        setAccommodationsCount(Array.isArray(accommodations) ? accommodations.length : 0);
        setHotelRooms(Array.isArray(rooms) ? rooms : []);
        setHotelAssignments(Array.isArray(assignments) ? assignments : []);
        setDisciplines(Array.isArray(disciplinesList) ? disciplinesList : []);

        // Capacity by discipline (sum expectedCount across events/delegations)
        const capMap = new Map<string, number>();
        (Array.isArray(events) ? events : []).forEach((ev) => {
          (ev.expectedCapacities || []).forEach((cap) => {
            capMap.set(cap.disciplineId, (capMap.get(cap.disciplineId) || 0) + cap.expectedCount);
          });
        });
        setCapacityByDiscipline(capMap);

        // Validated athletes by discipline
        const athMap = new Map<string, number>();
        validAthletes.forEach((a: AthleteItem) => {
          if (a.disciplineId) {
            athMap.set(a.disciplineId, (athMap.get(a.disciplineId) || 0) + 1);
          }
        });
        setAthletesByDiscipline(athMap);
      } catch {
        // silently ignore — data stays at defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tripStats = useMemo(() => {
    const s = { scheduled: 0, active: 0, completed: 0 };
    trips.forEach((trip) => {
      const st = norm(trip.status);
      if (STATUS.completed.has(st)) s.completed++;
      else if (STATUS.active.has(st)) s.active++;
      else if (STATUS.scheduled.has(st)) s.scheduled++;
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
    const available = hotelRooms.filter(
      (r) => ["AVAILABLE", "DISPONIBLE", ""].includes(norm(r.status)) || !r.status
    ).length;
    return { available, total: hotelRooms.length };
  }, [hotelRooms]);

  const occupancyPct = bedStats.total > 0 ? Math.round((bedStats.occupied / bedStats.total) * 100) : 0;

  const buildOperationalReport = () => {
    const sections = [
      {
        title: "KPIs generales",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Participantes registrados", athletesCount],
          ["Eventos", eventsCount],
          ["Hoteles", accommodationsCount],
          ["Viajes totales", trips.length],
          ["Asignaciones hoteleras", hotelAssignments.length],
          ["Ocupación hotelera", `${occupancyPct}%`],
        ] as (string | number)[][],
      },
      {
        title: "Transporte — Estado de viajes",
        headers: ["Estado", "Cantidad"],
        rows: [
          ["Programados", tripStats.scheduled],
          ["En curso", tripStats.active],
          ["Completados", tripStats.completed],
          ["Total", trips.length],
        ] as (string | number)[][],
      },
      {
        title: "Hotelería — Inventario",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Total habitaciones", roomStats.total],
          ["Habitaciones disponibles", roomStats.available],
          ["Total camas", bedStats.total],
          ["Camas libres", bedStats.available],
          ["Camas ocupadas", bedStats.occupied],
          ["% ocupación", `${occupancyPct}%`],
        ] as (string | number)[][],
      },
    ];

    if (capacityByDiscipline.size > 0) {
      const discRows = Array.from(capacityByDiscipline.entries())
        .map(([discId, cupos]) => {
          const disc = disciplines.find((d) => d.id === discId);
          const parentDisc = disc?.parentId ? disciplines.find((d) => d.id === disc.parentId) : null;
          const registered = athletesByDiscipline.get(discId) || 0;
          const pct = cupos > 0 ? `${Math.round((registered / cupos) * 100)}%` : "0%";
          const cLabel = disc?.category === "CONVENTIONAL" ? "Convencional" : disc?.category === "PARALYMPIC" ? "Paralímpico" : "";
          const gLabel = disc?.gender === "MALE" ? "Masculino" : disc?.gender === "FEMALE" ? "Femenino" : "";
          const suffix = [cLabel, gLabel].filter(Boolean).join(" - ");
          const name = (parentDisc ? `${parentDisc.name} — ${disc?.name}` : (disc?.name || "Sin nombre")) + (suffix ? ` (${suffix})` : "");
          return [name, cupos, registered, pct] as (string | number)[];
        })
        .sort((a, b) => (b[1] as number) - (a[1] as number));

      sections.push({
        title: "Cupos por disciplina vs registrados AND",
        headers: ["Disciplina", "Cupos", "Registrados", "% Cobertura"],
        rows: discRows,
      });
    }

    return sections;
  };

  const tripDonutSegments = [
    { value: tripStats.scheduled, color: BLUE,       label: "Programados" },
    { value: tripStats.active,    color: TEAL_LIGHT, label: "En curso" },
    { value: tripStats.completed, color: TEAL,       label: "Completados" },
  ].filter((s) => s.value > 0);

  const hotelDonutSegments = [
    { value: bedStats.occupied,  color: CHARCOAL,   label: "Ocupadas" },
    { value: bedStats.available, color: TEAL_LIGHT,  label: "Disponibles" },
  ].filter((s) => s.value > 0);

  const kpiIcons: Record<string, React.ReactNode> = {
    participantes: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    eventos: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    hoteles: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    viajes: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    asignaciones: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9V5a2 2 0 0 1 2-2h4"/><path d="M22 9V5a2 2 0 0 0-2-2h-4"/>
        <path d="M2 15v4a2 2 0 0 0 2 2h4"/><path d="M22 15v4a2 2 0 0 1-2 2h-4"/>
        <rect x="7" y="9" width="10" height="6" rx="1"/>
      </svg>
    ),
    ocupacion: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  };

  const kpis = [
    { label: "Participantes",   value: fmt(athletesCount),          color: TEAL,       iconKey: "participantes", link: "/registro/participantes" },
    { label: "Eventos",         value: fmt(eventsCount),            color: BLUE,       iconKey: "eventos",       link: "/deportes" },
    { label: "Hoteles",         value: fmt(accommodationsCount),    color: CHARCOAL,   iconKey: "hoteles",       link: "/masters/accommodations" },
    { label: "Viajes totales",  value: fmt(trips.length),           color: TEAL,       iconKey: "viajes",        link: "/operations/trips" },
    { label: "Asignaciones",    value: fmt(hotelAssignments.length),color: BLUE,       iconKey: "asignaciones",  link: "/operations/hotel-assignments" },
    { label: "Ocupación",       value: `${occupancyPct}%`,          color: TEAL_LIGHT, iconKey: "ocupacion",     link: "/operations/hotel-tracking" },
  ];

  return (
    <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>

      {/* ── Header with export */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={() => downloadExcel("reporte_operacional", buildOperationalReport())}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(34,197,94,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(34,197,94,0.1)"; }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)", fontSize: 12, fontWeight: 700, color: "#16a34a", cursor: "pointer", transition: "all 150ms ease", boxShadow: "0 1px 4px rgba(34,197,94,0.1)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#16a34a" strokeWidth="1.8"/><path d="M8 7l4 5-4 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 7l-4 5 4 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Excel
        </button>
        <button type="button" onClick={() => downloadPDF("reporte_operacional", "Reporte Operacional — Seven Arena", buildOperationalReport())}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(239,68,68,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(239,68,68,0.1)"; }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", fontSize: 12, fontWeight: 700, color: "#dc2626", cursor: "pointer", transition: "all 150ms ease", boxShadow: "0 1px 4px rgba(239,68,68,0.1)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#dc2626" strokeWidth="1.8"/><polyline points="14 2 14 8 20 8" stroke="#dc2626" strokeWidth="1.8"/><text x="7" y="17" fill="#dc2626" fontSize="7" fontWeight="bold" fontFamily="Arial">PDF</text></svg>
          PDF
        </button>
      </div>

      {/* ── KPI row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi, i) => (
          <Link key={i} href={kpi.link} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderTop: `2px solid ${kpi.color}`,
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease",
                animation: "fadeInUp 0.4s ease both",
                animationDelay: `${i * 0.06}s`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(15,23,42,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 6px rgba(15,23,42,0.06)"; }}
            >
              <div className="flex items-center justify-between mb-3">
                <span style={{ color: kpi.color }}>{kpiIcons[kpi.iconKey]}</span>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: kpi.color, display: "inline-block" }} />
              </div>
              <p style={{ fontSize: "1.65rem", fontWeight: 800, color: kpi.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : kpi.value}
              </p>
              <p style={{ fontSize: "11px", color: "#64748b", marginTop: "5px", fontWeight: 500 }}>{kpi.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Transport donut */}
        <Card accentColor={TEAL}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel color={TEAL}>Transporte</SectionLabel>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Estado de viajes</p>
            </div>
            <Link href="/operations/trips" style={{ fontSize: "11px", color: TEAL, fontWeight: 600, textDecoration: "none" }}>Ver todos →</Link>
          </div>
          <div className="flex items-center justify-center gap-6">
            {tripDonutSegments.length > 0 ? (
              <DonutChart segments={tripDonutSegments} size={140} thickness={20} label={fmt(trips.length)} sublabel="total" />
            ) : (
              <p style={{ color: "#94a3b8", fontSize: "13px" }}>Sin datos</p>
            )}
          </div>
          {tripDonutSegments.length > 0 && (
            <div className="flex justify-center gap-4 mt-3">
              {tripDonutSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Hotel donut */}
        <Card accentColor={BLUE}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel color={BLUE}>Hotelería</SectionLabel>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Ocupación de camas</p>
            </div>
            <Link href="/operations/hotel-tracking" style={{ fontSize: "11px", color: BLUE, fontWeight: 600, textDecoration: "none" }}>Ver tracking →</Link>
          </div>
          <div className="flex items-center justify-center">
            {hotelDonutSegments.length > 0 ? (
              <DonutChart segments={hotelDonutSegments} size={140} thickness={20} label={`${occupancyPct}%`} sublabel="ocupado" />
            ) : (
              <p style={{ color: "#94a3b8", fontSize: "13px" }}>Sin datos</p>
            )}
          </div>
          {hotelDonutSegments.length > 0 && (
            <div className="flex justify-center gap-4 mt-3">
              {hotelDonutSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Bar chart */}
        <Card accentColor={CHARCOAL}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel color={CHARCOAL}>Distribución</SectionLabel>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Viajes por estado</p>
            </div>
          </div>
          <BarChart
            data={[
              { label: "Prog.",  value: tripStats.scheduled, color: BLUE },
              { label: "Activo", value: tripStats.active,    color: TEAL_LIGHT },
              { label: "Hecho",  value: tripStats.completed, color: TEAL },
            ]}
            height={100}
            showValues
          />
        </Card>
      </div>

      {/* ── Discipline capacity vs registered */}
      {!loading && (
        <Card accentColor={CHARCOAL}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel color={CHARCOAL}>Acreditación deportiva</SectionLabel>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Cupos por disciplina vs registrados AND</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {[
                { color: CHARCOAL, label: "Cupos" },
                { color: TEAL, label: "Registrados" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary KPIs */}
          {(() => {
            const totalCupos = Array.from(capacityByDiscipline.values()).reduce((s, v) => s + v, 0);
            const totalRegistered = Array.from(athletesByDiscipline.values()).reduce((s, v) => s + v, 0);
            const fillPct = totalCupos > 0 ? Math.round((totalRegistered / totalCupos) * 100) : 0;
            const semColor = fillPct >= 85 ? "#22c55e" : fillPct >= 60 ? "#f59e0b" : "#ef4444";
            return (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Total cupos</p>
                  <p style={{ fontSize: "1.3rem", fontWeight: 800, color: CHARCOAL, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(totalCupos)}</p>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Registrados AND</p>
                  <p style={{ fontSize: "1.3rem", fontWeight: 800, color: TEAL, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(totalRegistered)}</p>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>% cobertura</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: semColor, display: "inline-block", boxShadow: `0 0 6px ${semColor}40` }} />
                    <p style={{ fontSize: "1.3rem", fontWeight: 800, color: semColor, fontVariantNumeric: "tabular-nums", margin: 0 }}>{fillPct}%</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Per-discipline bars */}
          {capacityByDiscipline.size === 0 ? (
            <div style={{ padding: "20px", borderRadius: 10, background: "#f8fafc", border: "1px dashed #e2e8f0", textAlign: "center" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", margin: 0 }}>Sin cupos configurados</p>
              <p style={{ fontSize: "11px", color: "#cbd5e1", margin: "4px 0 0" }}>Configura los cupos esperados en la sección de Deportes.</p>
            </div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {(() => {
              // Get disciplines that have capacity, sorted by capacity desc
              const rows = Array.from(capacityByDiscipline.entries())
                .map(([discId, cupos]) => {
                  const disc = disciplines.find((d) => d.id === discId);
                  const parentDisc = disc?.parentId ? disciplines.find((d) => d.id === disc.parentId) : null;
                  const registered = athletesByDiscipline.get(discId) || 0;
                  const pct = cupos > 0 ? Math.round((registered / cupos) * 100) : 0;
                  const categoryLabel = disc?.category === "CONVENTIONAL" ? "Convencional" : disc?.category === "PARALYMPIC" ? "Paralímpico" : null;
                  const genderLabel = disc?.gender === "MALE" ? "Masculino" : disc?.gender === "FEMALE" ? "Femenino" : null;
                  const tags = [categoryLabel, genderLabel].filter(Boolean).join(" - ");
                  return { discId, name: disc?.name || "Sin nombre", parent: parentDisc?.name || null, tags, cupos, registered, pct };
                })
                .sort((a, b) => b.cupos - a.cupos);

              return rows.map((row) => {
                const semColor = row.pct >= 85 ? "#22c55e" : row.pct >= 60 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={row.discId}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: semColor, flexShrink: 0, boxShadow: `0 0 4px ${semColor}40` }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.parent ? `${row.parent} — ` : ""}{row.name}
                          {row.tags && <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginLeft: 6 }}>({row.tags})</span>}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: semColor, flexShrink: 0, marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>
                        {row.registered}/{row.cupos}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, row.pct)}%`, background: semColor, borderRadius: "99px", transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          )}
        </Card>
      )}

      {/* ── Hotel inventory */}
      <Card accentColor={TEAL}>
        <SectionLabel color={TEAL}>Inventario hotelero</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total habitaciones", value: fmt(roomStats.total),    color: "#0f172a" },
            { label: "Disponibles",        value: fmt(roomStats.available), color: TEAL },
            { label: "Total camas",        value: fmt(bedStats.total),      color: "#0f172a" },
            { label: "Camas libres",       value: fmt(bedStats.available),  color: TEAL_LIGHT },
          ].map((item, i) => (
            <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em" }}>{item.label}</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, color: item.color, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : item.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[
            { label: "Camas ocupadas",          value: bedStats.occupied,     total: bedStats.total,  color: CHARCOAL, pct: occupancyPct },
            { label: "Habitaciones disponibles", value: roomStats.available,   total: roomStats.total, color: TEAL,
              pct: roomStats.total > 0 ? Math.round((roomStats.available / roomStats.total) * 100) : 0 },
          ].map((row, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1" style={{ color: "#64748b" }}>
                <span>{row.label}</span>
                <span style={{ color: row.color, fontWeight: 600 }}>{row.value} / {row.total}</span>
              </div>
              <ProgressBar pct={row.pct} color={row.color} height={7} />
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
