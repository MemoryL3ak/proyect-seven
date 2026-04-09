"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* ─── Types ─── */
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
  if (count >= LOAD_HIGH) return { color: "#ef4444", label: "Alta carga" };
  if (count >= LOAD_MEDIUM) return { color: "#f59e0b", label: "Carga media" };
  return { color: "#10b981", label: "Disponible" };
}

function cellBg(count: number): string {
  if (count === 0) return "#f1f5f9";
  if (count === 1) return "rgba(33,208,179,0.18)";
  if (count === 2) return "rgba(33,208,179,0.40)";
  if (count === 3) return "rgba(33,208,179,0.60)";
  return "rgba(33,208,179,0.80)";
}

function cellText(count: number): string {
  return count >= 3 ? "#fff" : "#0f172a";
}

function formatRating(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(1);
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
      const [tripsData, driversData, participantsData] = await Promise.all([
        apiFetch<Trip[]>("/trips"),
        apiFetch<DriverItem[]>("/drivers"),
        apiFetch<ParticipantItem[]>("/provider-participants").catch(() => []),
      ]);
      setTrips(tripsData || []);
      const lookup: Record<string, DriverItem> = {};
      for (const d of driversData || []) {
        if (d.id) lookup[d.id] = d;
        if (d.userId) lookup[d.userId] = d;
      }
      for (const p of participantsData || []) {
        const meta = p.metadata ?? {};
        if (meta.isDriver === true || meta.isDriver === "true") {
          lookup[p.id] = { id: p.id, fullName: p.fullName, metadata: p.metadata };
        }
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

  /* ─── Today's trips ─── */
  const dayTrips = useMemo(() =>
    trips.filter((tr) => {
      const raw = tr.scheduledAt || tr.startedAt;
      if (!raw) return false;
      const d = new Date(raw);
      return d >= dayStart && d <= dayEnd;
    }),
  [trips, dayStart, dayEnd]);

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
      const hour = new Date(tr.scheduledAt || tr.startedAt!).getHours();
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
    return { totalTrips: dayTrips.length, activeDrivers: activeDriverIds.length, avgRating, busiestHour, completed };
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
        name: drivers[driverId]?.fullName || "Sin nombre",
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
    pageBg: "#f8fafc",
    cardBg: "#ffffff",
    cardBorder: "#e8ecf1",
    textPrimary: "#0f172a",
    textMuted: "#64748b",
    labelColor: "#94a3b8",
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
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 4px" }}>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pal.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Viajes del día", value: kpis.totalTrips, color: "#f59e0b" },
          { label: "Completados", value: kpis.completed, color: "#10b981" },
          { label: "Conductores activos", value: kpis.activeDrivers, color: "#3b82f6" },
          { label: "Rating promedio", value: kpis.avgRating !== null ? kpis.avgRating.toFixed(1) + " ★" : "—", color: "#6366f1" },
          { label: "Hora punta", value: kpis.busiestHour, color: "#ec4899" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: pal.cardBg, borderRadius: "16px", padding: "16px 18px", borderTop: `3px solid ${kpi.color}`, boxShadow: pal.shadow }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.labelColor, margin: "0 0 4px" }}>{kpi.label}</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Heatmap ── */}
      <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${pal.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 4px" }}>Mapa de calor</p>
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
                          {driver?.fullName || driverId.slice(-8)}
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
                              background: "#0f172a", color: "#fff", borderRadius: "10px", padding: "10px 14px",
                              fontSize: "11px", whiteSpace: "nowrap", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                              pointerEvents: "none",
                            }}>
                              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "#21D0B3" }}>
                                {driver?.fullName} · {String(h).padStart(2, "0")}:00
                              </p>
                              {cellTrips.map((tr, i) => (
                                <p key={i} style={{ margin: "2px 0", color: "#cbd5e1" }}>
                                  {tr.origin?.split(",")[0] || "?"} → {tr.destination?.split(",")[0] || "?"} · {tr.passengerCount || 0} pax
                                </p>
                              ))}
                              <div style={{ position: "absolute", bottom: "-4px", left: "50%", transform: "translateX(-50%) rotate(45deg)", width: "8px", height: "8px", background: "#0f172a" }} />
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

      {/* ── Rankings ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Left: Ranking table */}
        <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${pal.cardBorder}` }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6366f1", margin: "0 0 8px" }}>Rankings generales</p>
            <div style={{ display: "flex", gap: "4px" }}>
              {([
                { key: "trips" as const, label: "Más viajes" },
                { key: "rating" as const, label: "Mejor calificados" },
                { key: "idle" as const, label: "Mayor inactividad" },
              ]).map((tab) => (
                <button key={tab.key} type="button" onClick={() => setRankTab(tab.key)}
                  style={{
                    padding: "6px 14px", borderRadius: "99px", border: "none", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    background: rankTab === tab.key ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#f1f5f9",
                    color: rankTab === tab.key ? "#fff" : pal.textMuted,
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
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div key={r.driverId} style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 100px 50px",
                    gap: "8px", alignItems: "center", padding: "10px 20px",
                    background: i % 2 === 0 ? "transparent" : "#fafafa",
                    borderBottom: `1px solid ${pal.cardBorder}`,
                  }}>
                    <span style={{ fontSize: medal ? "16px" : "13px", fontWeight: 800, color: medal ? undefined : pal.labelColor, textAlign: "center" }}>
                      {medal || `#${i + 1}`}
                    </span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary, margin: 0 }}>{r.name}</p>
                      <p style={{ fontSize: "10px", color: pal.labelColor, margin: 0 }}>{r.todayTrips} viajes hoy · {r.activeHours}h activo</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {rankTab === "trips" && <span style={{ fontSize: "16px", fontWeight: 800, color: "#6366f1" }}>{r.totalTrips}</span>}
                      {rankTab === "rating" && (
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#f59e0b" }}>
                          {formatRating(r.avgRating)} <span style={{ fontSize: "11px" }}>★</span>
                        </span>
                      )}
                      {rankTab === "idle" && <span style={{ fontSize: "16px", fontWeight: 800, color: "#ef4444" }}>{r.idleHours}h</span>}
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
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", margin: "0 0 12px" }}>
              Indicadores de carga
            </p>
            {[
              { color: "#10b981", label: "Disponible", desc: `0–${LOAD_MEDIUM - 1} viajes en el día` },
              { color: "#f59e0b", label: "Carga media", desc: `${LOAD_MEDIUM}–${LOAD_HIGH - 1} viajes en el día` },
              { color: "#ef4444", label: "Alta carga", desc: `${LOAD_HIGH}+ viajes en el día` },
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
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f59e0b", margin: "0 0 12px" }}>
              Mejor evaluados
            </p>
            {rankings
              .filter((r) => r.avgRating !== null)
              .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
              .slice(0, 3)
              .map((r, i) => (
                <div key={r.driverId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary, margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: "10px", color: pal.labelColor, margin: 0 }}>{r.completedTrips} viajes completados</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#f59e0b" }}>{formatRating(r.avgRating)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                </div>
              ))}
            {rankings.filter((r) => r.avgRating !== null).length === 0 && (
              <p style={{ fontSize: "12px", color: pal.textMuted, textAlign: "center" }}>Sin evaluaciones aún</p>
            )}
          </div>

          {/* Most active today */}
          <div style={{ background: pal.cardBg, borderRadius: "20px", border: `1px solid ${pal.cardBorder}`, boxShadow: pal.shadow, padding: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3b82f6", margin: "0 0 12px" }}>
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
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#3b82f6" }}>{r.todayTrips}</span>
                    </div>
                    <div style={{ height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "3px", background: "linear-gradient(90deg,#3b82f6,#6366f1)", width: `${pct}%`, transition: "width 0.5s" }} />
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
