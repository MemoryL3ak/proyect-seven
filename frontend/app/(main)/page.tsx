"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import DonutChart from "@/components/charts/DonutChart";
import BarChart from "@/components/charts/BarChart";
import SparkLine from "@/components/charts/SparkLine";

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
  const isAtlas = theme === "atlas";

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

  // ── Unified layout: dark / light / obsidian ─────────────────
  if (!isAtlas) {
    // Color palette per theme
    const pal = isObsidian ? {
      kpi:  ["#22d3ee","#a855f7","#f59e0b","#10b981","#38bdf8","#10b981"],
      c1: "#22d3ee", c2: "#a855f7", c3: "#f59e0b",
      cardBg: "#0e1728", cardBorder: "rgba(34,211,238,0.1)", cardBorderTop: (c: string) => `2px solid ${c}`,
      innerBg: "#0a1322", innerBorder: "rgba(34,211,238,0.1)",
      textPrimary: "#e2e8f0", textMuted: "rgba(255,255,255,0.45)",
      progressTrack: "#0a1322", shadow: "0 4px 24px rgba(0,0,0,0.55)",
      noData: "rgba(255,255,255,0.3)",
      donutColors: (["#a855f7","#22d3ee"] as [string,string]),
      bar: [{label:"Prog.",value:tripStats.scheduled,color:"#f59e0b"},{label:"Activo",value:tripStats.active,color:"#10b981"},{label:"Hecho",value:tripStats.completed,color:"#22d3ee"}],
    } : theme === "dark" ? {
      kpi:  ["#c9a84c","#818cf8","#f59e0b","#10b981","#c9a84c","#10b981"],
      c1: "#c9a84c", c2: "#818cf8", c3: "#f59e0b",
      cardBg: "var(--surface)", cardBorder: "var(--border)", cardBorderTop: (c: string) => `2px solid ${c}`,
      innerBg: "var(--elevated)", innerBorder: "var(--border-muted)",
      textPrimary: "var(--text)", textMuted: "var(--text-muted)",
      progressTrack: "var(--elevated)", shadow: "0 2px 12px rgba(0,0,0,0.35)",
      noData: "var(--text-faint)",
      donutColors: (["#818cf8","#c9a84c"] as [string,string]),
      bar: [{label:"Prog.",value:tripStats.scheduled,color:"#f59e0b"},{label:"Activo",value:tripStats.active,color:"#10b981"},{label:"Hecho",value:tripStats.completed,color:"#c9a84c"}],
    } : {
      kpi:  ["#1e3a8a","#7c3aed","#0ea5e9","#16a34a","#1e3a8a","#16a34a"],
      c1: "#1e3a8a", c2: "#7c3aed", c3: "#0ea5e9",
      cardBg: "#ffffff", cardBorder: "#e8edf5", cardBorderTop: (c: string) => `2px solid ${c}`,
      innerBg: "#f8fafc", innerBorder: "#e8edf5",
      textPrimary: "#0f172a", textMuted: "#64748b",
      progressTrack: "#f1f5f9", shadow: "0 1px 4px rgba(0,0,0,0.07)",
      noData: "#94a3b8",
      donutColors: (["#7c3aed","#0ea5e9"] as [string,string]),
      bar: [{label:"Prog.",value:tripStats.scheduled,color:"#f59e0b"},{label:"Activo",value:tripStats.active,color:"#16a34a"},{label:"Hecho",value:tripStats.completed,color:"#1e3a8a"}],
    };

    const tripDonutPal = [
      { value: tripStats.scheduled, color: pal.c3, label: "Programados" },
      { value: tripStats.active, color: "#10b981", label: "En curso" },
      { value: tripStats.completed, color: pal.c1, label: "Completados" },
    ].filter(s => s.value > 0);

    const hotelDonutPal = [
      { value: bedStats.occupied, color: pal.donutColors[0], label: "Ocupadas" },
      { value: bedStats.available, color: pal.donutColors[1], label: "Disponibles" },
    ].filter(s => s.value > 0);

    return (
      <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>
        {/* ── KPI row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Participantes", value: fmt(athletesCount), icon: "👥", link: "/registro/participantes" },
            { label: "Eventos", value: fmt(eventsCount), icon: "🗓", link: "/deportes" },
            { label: "Hoteles", value: fmt(accommodationsCount), icon: "🏨", link: "/masters/accommodations" },
            { label: "Viajes totales", value: fmt(trips.length), icon: "🚌", link: "/operations/trips" },
            { label: "Asignaciones", value: fmt(hotelAssignments.length), icon: "🛏", link: "/hotel-assignments" },
            { label: "Ocupación", value: `${occupancyPct}%`, icon: "📊", link: "/operations/hotel-tracking" },
          ].map((kpi, i) => {
            const color = i < pal.kpi.length ? pal.kpi[i] : pal.c1;
            return (
            <Link key={i} href={kpi.link} style={{ textDecoration: "none" }}>
              <div style={{
                background: pal.cardBg,
                border: `1px solid ${pal.cardBorder}`,
                borderTop: pal.cardBorderTop(color),
                borderRadius: "14px", padding: "16px",
                boxShadow: pal.shadow,
                transition: "transform 120ms ease, box-shadow 120ms ease",
                animationDelay: `${i * 0.06}s`, animation: "fadeInUp 0.4s ease both",
                cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: "18px" }}>{kpi.icon}</span>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}99`, display: "inline-block" }} />
                </div>
                <p style={{ fontSize: "1.65rem", fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                  ...(isObsidian ? { textShadow: `0 0 22px ${color}55` } : {}) }}>
                  {loading ? "—" : kpi.value}
                </p>
                <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "5px", fontWeight: 500 }}>{kpi.label}</p>
              </div>
            </Link>
            );
          })}
        </div>

        {/* ── Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Transport donut */}
          <div style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: pal.cardBorderTop(pal.c1), borderRadius: "16px", padding: "20px", boxShadow: pal.shadow }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: pal.c1, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Transporte</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: pal.textPrimary }}>Estado de viajes</p>
              </div>
              <Link href="/operations/trips" style={{ fontSize: "11px", color: pal.c1, textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div className="flex items-center justify-center gap-6">
              {tripDonutPal.length > 0 ? (
                <DonutChart segments={tripDonutPal} size={140} thickness={20} label={fmt(trips.length)} sublabel="total" />
              ) : (
                <p style={{ color: pal.noData, fontSize: "13px" }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Hotel donut */}
          <div style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: pal.cardBorderTop(pal.c2), borderRadius: "16px", padding: "20px", boxShadow: pal.shadow }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: pal.c2, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Hotelería</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: pal.textPrimary }}>Ocupación de camas</p>
              </div>
              <Link href="/operations/hotel-tracking" style={{ fontSize: "11px", color: pal.c2, textDecoration: "none" }}>Ver tracking →</Link>
            </div>
            <div className="flex items-center justify-center">
              {hotelDonutPal.length > 0 ? (
                <DonutChart segments={hotelDonutPal} size={140} thickness={20} label={`${occupancyPct}%`} sublabel="ocupado" />
              ) : (
                <p style={{ color: pal.noData, fontSize: "13px" }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: pal.cardBorderTop(pal.c3), borderRadius: "16px", padding: "20px", boxShadow: pal.shadow }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: "11px", color: pal.c3, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Distribución</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: pal.textPrimary }}>Viajes por estado</p>
              </div>
            </div>
            <BarChart data={pal.bar} height={100} showValues />
          </div>
        </div>

        {/* ── Hotel inventory */}
        <div style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: pal.cardBorderTop(pal.c1), borderRadius: "16px", padding: "20px", boxShadow: pal.shadow }}>
          <p style={{ fontSize: "11px", color: pal.c1, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>Inventario hotelero</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total habitaciones", value: fmt(roomStats.total), color: pal.textPrimary },
              { label: "Disponibles", value: fmt(roomStats.available), color: pal.c1 },
              { label: "Total camas", value: fmt(bedStats.total), color: pal.textPrimary },
              { label: "Camas libres", value: fmt(bedStats.available), color: "#10b981" },
            ].map((item, i) => (
              <div key={i} style={{ background: pal.innerBg, border: `1px solid ${pal.innerBorder}`, borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "10px", color: pal.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>{item.label}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: item.color, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "—" : item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[
              { label: "Camas ocupadas", value: bedStats.occupied, total: bedStats.total, color: pal.c2, pct: occupancyPct },
              { label: "Habitaciones disponibles", value: roomStats.available, total: roomStats.total, color: "#10b981",
                pct: roomStats.total > 0 ? Math.round((roomStats.available / roomStats.total) * 100) : 0 },
            ].map((row, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1" style={{ color: pal.textMuted }}>
                  <span>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 600 }}>{row.value} / {row.total}</span>
                </div>
                <div style={{ height: "7px", background: pal.progressTrack, borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: "99px", transition: "width 0.8s ease",
                    ...(isObsidian ? { boxShadow: `0 0 8px ${row.color}88` } : {}) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Atlas theme dashboard ──────────────────────────────────
  if (isAtlas) {
    const card = (style?: React.CSSProperties): React.CSSProperties => ({
      background: "#ffffff",
      border: "1px solid #e8edf5",
      borderRadius: "10px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      padding: "20px",
      ...style,
    });

    const atlasKpis = [
      { label: "Participantes", value: fmt(athletesCount), prev: null, color: "#3b5bdb", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
        </svg>
      )},
      { label: "Eventos activos", value: fmt(eventsCount), prev: null, color: "#7c3aed", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      )},
      { label: "Hoteles", value: fmt(accommodationsCount), prev: null, color: "#0ea5e9", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      )},
      { label: "Viajes totales", value: fmt(trips.length), prev: null, color: "#16a34a", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      )},
      { label: "Asignaciones hotel", value: fmt(hotelAssignments.length), prev: null, color: "#f59e0b", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 20h20M5 20V10l7-6 7 6v10"/><rect x="9" y="14" width="6" height="6"/>
        </svg>
      )},
      { label: "Ocupación camas", value: `${occupancyPct}%`, prev: null, color: occupancyPct > 80 ? "#dc2626" : "#16a34a", icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 17h20M2 12h20M6 7h12"/><rect x="3" y="17" width="18" height="4" rx="1"/>
        </svg>
      )},
    ];

    const sparkSeeds = [
      [12, 18, 14, 22, 19, 28, 24, 32, 27, 35, 30, 40],
      [8, 12, 10, 15, 13, 18, 16, 22, 19, 25, 21, 28],
      [5, 7, 6, 9, 8, 11, 10, 14, 12, 16, 14, 18],
      [20, 24, 22, 28, 26, 32, 30, 36, 34, 40, 38, 44],
      [15, 19, 17, 21, 20, 24, 22, 27, 25, 30, 28, 33],
      [10, 14, 12, 17, 15, 20, 18, 23, 21, 26, 24, 29],
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── KPI strip */}
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {atlasKpis.map((kpi, i) => (
            <div key={i} style={card()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "8px", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: `${kpi.color}14`, color: kpi.color
                }}>
                  {kpi.icon}
                </div>
                <SparkLine data={sparkSeeds[i]} width={60} height={28} color={kpi.color} filled />
              </div>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.025em" }}>
                {loading ? "—" : kpi.value}
              </p>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ── Charts row */}
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr 1fr" }}>

          {/* Trip status breakdown */}
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Transporte</p>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Estado de viajes</p>
              </div>
              <Link href="/operations/trips" style={{ fontSize: "11px", color: "#3b5bdb", fontWeight: 600, textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: "Programados", value: tripStats.scheduled, color: "#f59e0b", bg: "#fffbeb" },
                { label: "En curso", value: tripStats.active, color: "#16a34a", bg: "#f0fdf4" },
                { label: "Hechos", value: tripStats.completed, color: "#3b5bdb", bg: "#eef2ff" },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, background: item.bg, border: `1px solid ${item.color}28`, borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                  <p style={{ fontSize: "1.3rem", fontWeight: 800, color: item.color, lineHeight: 1 }}>{loading ? "—" : fmt(item.value)}</p>
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "3px", fontWeight: 500 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                <span>Completados del total</span>
                <span style={{ color: "#3b5bdb", fontWeight: 600 }}>{trips.length > 0 ? `${Math.round((tripStats.completed / trips.length) * 100)}%` : "—"}</span>
              </div>
              <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: trips.length > 0 ? `${Math.round((tripStats.completed / trips.length) * 100)}%` : "0%", background: "linear-gradient(90deg, #3b5bdb, #6481f0)", borderRadius: "99px", transition: "width 0.8s ease" }} />
              </div>
            </div>
          </div>

          {/* Hotel occupancy */}
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Hotelería</p>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Ocupación</p>
              </div>
              <Link href="/operations/hotel-tracking" style={{ fontSize: "11px", color: "#3b5bdb", fontWeight: 600, textDecoration: "none" }}>Ver tracking →</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <DonutChart segments={hotelDonutSegments.length > 0 ? hotelDonutSegments.map(s => ({...s, color: s.label === "Ocupadas" ? "#3b5bdb" : "#0ea5e9"})) : [{ value: 1, color: "#e2e8f0", label: "Sin datos" }]} size={110} thickness={16} label={`${occupancyPct}%`} sublabel="ocupado" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "Camas ocupadas", value: bedStats.occupied, total: bedStats.total, color: "#3b5bdb" },
                  { label: "Disponibles", value: bedStats.available, total: bedStats.total, color: "#0ea5e9" },
                  { label: "Habitaciones libres", value: roomStats.available, total: roomStats.total, color: "#16a34a" },
                ].map((row, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                      <span style={{ color: "#64748b" }}>{row.label}</span>
                      <span style={{ color: row.color, fontWeight: 600 }}>{fmt(row.value)}</span>
                    </div>
                    <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: row.total > 0 ? `${Math.round((row.value / row.total) * 100)}%` : "0%", background: row.color, borderRadius: "99px", transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div style={card()}>
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Resumen operacional</p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Inventario hotelero</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                { label: "Total habitaciones", value: fmt(roomStats.total), icon: "🏨" },
                { label: "Habitaciones libres", value: fmt(roomStats.available), icon: "✅", highlight: "#16a34a" },
                { label: "Total camas", value: fmt(bedStats.total), icon: "🛏" },
                { label: "Camas disponibles", value: fmt(bedStats.available), icon: "✅", highlight: "#16a34a" },
                { label: "Asignaciones activas", value: fmt(hotelAssignments.length), icon: "📋", highlight: "#3b5bdb" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 0",
                  borderBottom: i < 4 ? "1px solid #f1f5f9" : "none"
                }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px" }}>{row.icon}</span>
                    {row.label}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: row.highlight ?? "#0f172a" }}>
                    {loading ? "—" : row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Bar chart full-width */}
        <div style={card({ padding: "20px 24px" })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Distribución</p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Viajes por estado</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              {[
                { label: "Programados", color: "#f59e0b" },
                { label: "En curso", color: "#16a34a" },
                { label: "Completados", color: "#3b5bdb" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#64748b" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: item.color, display: "inline-block" }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <BarChart
            data={[
              { label: "Prog.", value: tripStats.scheduled, color: "#f59e0b" },
              { label: "Activo", value: tripStats.active, color: "#16a34a" },
              { label: "Hecho", value: tripStats.completed, color: "#3b5bdb" },
            ]}
            height={80}
            showValues
          />
        </div>

      </div>
    );
  }

  // Atlas is already handled above — this line is never reached
  return null;
}
