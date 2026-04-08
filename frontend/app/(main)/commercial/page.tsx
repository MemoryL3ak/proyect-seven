"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CLIENT_TYPE_OPTIONS, clientTypeLabel } from "@/lib/clientTypes";
import { downloadExcel, downloadPDF } from "@/lib/reports";
import { AreaChart, Area, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

type ProviderItem = { id: string; type?: string | null; bidAmount?: number | null; bidTripCount?: number | null };
type TripItem = { id: string; tripCost?: number | null; status?: string | null; scheduledAt?: string | null; clientType?: string | null };

const TEAL     = "#21D0B3";
const BLUE     = "#1FCDFF";
const CHARCOAL = "#30455B";
const ACCENTS  = [TEAL, BLUE, CHARCOAL, "#a78bfa", "#fb923c", "#f472b6"];

function sem(pct: number, hasData: boolean) {
  if (!hasData) return { color: "#94a3b8", bg: "#f8fafc", glow: "transparent" };
  if (pct < 60) return { color: "#22c55e", bg: "rgba(34,197,94,0.08)", glow: "rgba(34,197,94,0.25)" };
  if (pct < 85) return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", glow: "rgba(245,158,11,0.25)" };
  return { color: "#ef4444", bg: "rgba(239,68,68,0.08)", glow: "rgba(239,68,68,0.25)" };
}

const BUCKET_ICONS: Record<string, React.ReactNode> = {
  transport: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  hospitality: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  food: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
};

type BucketData = { key: string; label: string; awarded: number; consumed: number; forecast: number; accentIndex: number };

export default function CommercialDashboardPage() {
  const { t } = useI18n();
  const [buckets, setBuckets] = useState<BucketData[]>([
    { key: "transport",   label: "Transporte",   awarded: 0, consumed: 0, forecast: 0, accentIndex: 0 },
    { key: "hospitality", label: "Hotelería",    awarded: 0, consumed: 0, forecast: 0, accentIndex: 1 },
    { key: "food",        label: "Alimentación", awarded: 0, consumed: 0, forecast: 0, accentIndex: 2 },
  ]);
  const [tripCounts, setTripCounts] = useState({ bid: 0, completed: 0, total: 0 });
  const [clientTypeBreakdown, setClientTypeBreakdown] = useState<{ clientType: string; count: number; cost: number }[]>([]);
  const [weeklySpend, setWeeklySpend] = useState<{ label: string; amount: number }[]>([]);
  const [dailySpend, setDailySpend] = useState<{ date: string; amount: number; count: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<ProviderItem[]>("/providers"),
      apiFetch<TripItem[]>("/trips"),
    ]).then(([providers, trips]) => {
      const done = new Set(["COMPLETED", "DROPPED_OFF"]);
      const awardedByType = (type: string) => (providers || []).filter((p) => p.type === type).reduce((s, p) => s + (Number(p.bidAmount) || 0), 0);
      const tripConsumed = (trips || []).filter((t) => done.has(t.status || "")).reduce((s, t) => s + (Number(t.tripCost) || 0), 0);
      const tripForecast = (trips || []).filter((t) => t.status !== "CANCELLED").reduce((s, t) => s + (Number(t.tripCost) || 0), 0);
      const bidTrips = (providers || []).filter((p) => p.type === "TRANSPORTE").reduce((s, p) => s + (Number(p.bidTripCount) || 0), 0);
      const completedCount = (trips || []).filter((t) => done.has(t.status || "")).length;
      const totalCount = (trips || []).filter((t) => t.status !== "CANCELLED").length;
      setTripCounts({ bid: bidTrips, completed: completedCount, total: totalCount });

      const ctMap = new Map<string, { count: number; cost: number }>();
      (trips || []).filter((t) => done.has(t.status || "")).forEach((t) => {
        const ct = t.clientType || "SIN_TIPO";
        const prev = ctMap.get(ct) || { count: 0, cost: 0 };
        ctMap.set(ct, { count: prev.count + 1, cost: prev.cost + (Number(t.tripCost) || 0) });
      });
      setClientTypeBreakdown(Array.from(ctMap.entries()).map(([clientType, data]) => ({ clientType, ...data })).filter((item) => item.cost > 0).sort((a, b) => b.cost - a.cost));

      setBuckets([
        { key: "transport",   label: "Transporte",   awarded: awardedByType("TRANSPORTE"),   consumed: tripConsumed, forecast: tripForecast, accentIndex: 0 },
        { key: "hospitality", label: "Hotelería",    awarded: awardedByType("HOTELERIA"),    consumed: 0, forecast: 0, accentIndex: 1 },
        { key: "food",        label: "Alimentación", awarded: awardedByType("ALIMENTACION"), consumed: 0, forecast: 0, accentIndex: 2 },
      ]);

      const weekMap = new Map<string, number>();
      (trips || []).filter((t) => done.has(t.status || "") && t.scheduledAt).forEach((t) => {
        const d = new Date(t.scheduledAt!);
        const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
        const key = ws.toISOString().slice(0, 10);
        weekMap.set(key, (weekMap.get(key) || 0) + (Number(t.tripCost) || 0));
      });
      setWeeklySpend(Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, amount], i) => ({ label: `Sem ${i + 1}`, amount })));

      // Daily spend (last 14 days)
      const dayMap = new Map<string, { amount: number; count: number }>();
      (trips || []).filter((t) => done.has(t.status || "") && t.scheduledAt).forEach((t) => {
        const key = new Date(t.scheduledAt!).toISOString().slice(0, 10);
        const prev = dayMap.get(key) || { amount: 0, count: 0 };
        dayMap.set(key, { amount: prev.amount + (Number(t.tripCost) || 0), count: prev.count + 1 });
      });
      setDailySpend(
        Array.from(dayMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-14)
          .map(([date, data]) => ({
            date: new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
            ...data,
          })),
      );

      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const totals = buckets.reduce((a, b) => ({ awarded: a.awarded + b.awarded, consumed: a.consumed + b.consumed, forecast: a.forecast + b.forecast }), { awarded: 0, consumed: 0, forecast: 0 });
  const usePct = totals.awarded > 0 ? Math.round((totals.consumed / totals.awarded) * 100) : 0;
  const totalSem = sem(usePct, totals.awarded > 0);
  const tripPct = tripCounts.bid > 0 ? Math.round((tripCounts.completed / tripCounts.bid) * 100) : 0;
  const tripSem = sem(tripPct, tripCounts.bid > 0);
  const maxWeek = Math.max(...(weeklySpend.length > 0 ? weeklySpend : [{ amount: 1 }]).map((w) => w.amount), 1);

  const buildReportSections = () => {
    const f = (v: number) => `$${v.toLocaleString("es-CL")}`;
    const s = [
      { title: "Resumen por servicio", headers: ["Servicio", "Adjudicado", "Consumido", "% Consumido"], rows: buckets.map((b) => [b.label, f(b.awarded), f(b.consumed), b.awarded > 0 ? `${Math.round((b.consumed / b.awarded) * 100)}%` : "0%"]) },
      { title: "Viajes licitados vs consumidos", headers: ["Métrica", "Valor"], rows: [["Licitados", tripCounts.bid], ["Completados", tripCounts.completed], ["Total creados", tripCounts.total], ["% consumido", tripCounts.bid > 0 ? `${tripPct}%` : "—"]] as (string | number)[][] },
    ];
    if (clientTypeBreakdown.length > 0) s.push({ title: "Detalle por tipo de cliente", headers: ["Tipo", "Viajes", "Costo"], rows: clientTypeBreakdown.map((i) => [clientTypeLabel(i.clientType), i.count, f(i.cost)]) });
    if (weeklySpend.length > 0) s.push({ title: "Tendencia semanal", headers: ["Semana", "Monto"], rows: weeklySpend.map((w) => [w.label, f(w.amount)]) });
    return s;
  };

  return (
    <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: "11px", color: TEAL, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>{t("Control comercial")}</p>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{t("Dashboard consumo operacional")}</h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: 4 }}>{t("Presupuesto adjudicado, ejecución acumulada y proyección por servicio.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => downloadExcel("reporte_comercial", buildReportSections())}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(34,197,94,0.25)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(34,197,94,0.1)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)", fontSize: 12, fontWeight: 700, color: "#16a34a", cursor: "pointer", transition: "all 150ms ease", boxShadow: "0 1px 4px rgba(34,197,94,0.1)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#16a34a" strokeWidth="1.8"/><path d="M8 7l4 5-4 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 7l-4 5 4 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Excel
          </button>
          <button type="button" onClick={() => downloadPDF("reporte_comercial", "Reporte Comercial — Seven Arena", buildReportSections())}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(239,68,68,0.25)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(239,68,68,0.1)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", fontSize: 12, fontWeight: 700, color: "#dc2626", cursor: "pointer", transition: "all 150ms ease", boxShadow: "0 1px 4px rgba(239,68,68,0.1)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#dc2626" strokeWidth="1.8"/><polyline points="14 2 14 8 20 8" stroke="#dc2626" strokeWidth="1.8"/><text x="7" y="17" fill="#dc2626" fontSize="7" fontWeight="bold" fontFamily="Arial">PDF</text></svg>
            PDF
          </button>
        </div>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { label: t("Adjudicado"), value: formatCurrency(totals.awarded), color: TEAL },
          { label: t("Consumido"), value: formatCurrency(totals.consumed), color: BLUE },
          { label: t("Restante"), value: formatCurrency(Math.max(0, totals.awarded - totals.consumed)), color: "#a78bfa" },
          { label: t("Viajes restantes"), value: `${Math.max(0, tripCounts.bid - tripCounts.completed)}`, color: "#fb923c" },
          { label: t("Uso total"), value: `${usePct}%`, color: totalSem.color },
        ].map((kpi, i) => (
          <div key={i}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${kpi.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 2px 8px ${kpi.color}10`; }}
            style={{
              background: "#fff", border: `1px solid ${kpi.color}25`, borderRadius: 16,
              padding: "18px 16px", boxShadow: `0 2px 8px ${kpi.color}10`,
              transition: "all 200ms ease", cursor: "default",
              animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.05}s`,
            }}>
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{kpi.label}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: kpi.color, lineHeight: 1, fontVariantNumeric: "tabular-nums", margin: 0 }}>{kpi.value}</p>
              {i === 4 && <span style={{ width: 10, height: 10, borderRadius: "50%", background: totalSem.color, display: "inline-block", boxShadow: `0 0 8px ${totalSem.glow}` }} />}
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-service cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {buckets.map((bucket, i) => {
          const color = ACCENTS[bucket.accentIndex];
          const has = bucket.awarded > 0;
          const hasCon = bucket.consumed > 0;
          const pct = has ? Math.min(100, Math.round((bucket.consumed / bucket.awarded) * 100)) : 0;
          const s = sem(pct, has && hasCon);
          return (
            <div key={bucket.key}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${color}18`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)"; }}
              style={{
                background: "#fff", border: `1px solid ${color}20`, borderRadius: 18,
                padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                transition: "all 200ms ease", cursor: "default",
                animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.08}s`,
                position: "relative", overflow: "hidden",
              }}>
              {/* Accent strip */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    {BUCKET_ICONS[bucket.key]}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{t(bucket.label)}</p>
                </div>
                {has && <span style={{ width: 12, height: 12, borderRadius: "50%", background: hasCon ? s.color : "#22c55e", boxShadow: `0 0 8px ${hasCon ? s.glow : "rgba(34,197,94,0.25)"}` }} />}
              </div>

              {has ? (
                <>
                  <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {hasCon ? formatCurrency(bucket.consumed) : formatCurrency(bucket.awarded)}
                  </p>
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {hasCon ? `consumido de ${formatCurrency(bucket.awarded)}` : "adjudicado"}
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                      <span>% consumido</span>
                      <span style={{ fontWeight: 700, color: hasCon ? s.color : color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", position: "relative" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${hasCon ? s.color : color}, ${hasCon ? s.color : color}bb)`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", animation: "shimmer 2.5s ease-in-out infinite" }} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 4, padding: 18, borderRadius: 12, background: "#f8fafc", border: "1px dashed #e2e8f0", textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: 0 }}>Sin monto adjudicado</p>
                  <p style={{ fontSize: 11, color: "#cbd5e1", margin: "4px 0 0" }}>Ingresa el monto licitado en el proveedor.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Trip count + Client type ── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Trips comparison */}
        <div style={{ background: "#fff", border: `1px solid ${TEAL}20`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${TEAL}, ${BLUE})` }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: TEAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>Viajes licitados vs consumidos</p>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: tripSem.color, boxShadow: `0 0 8px ${tripSem.glow}` }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Licitados", value: tripCounts.bid > 0 ? tripCounts.bid.toLocaleString("es-CL") : "—", color: "#0f172a", bg: "#f8fafc" },
              { label: "Completados", value: tripCounts.completed.toLocaleString("es-CL"), color: tripSem.color, bg: tripSem.bg },
              { label: "Total creados", value: tripCounts.total.toLocaleString("es-CL"), color: BLUE, bg: "rgba(31,205,255,0.06)" },
            ].map((item) => (
              <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: "1.4rem", fontWeight: 800, color: item.color, marginTop: 6, fontVariantNumeric: "tabular-nums", margin: "6px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>
          {tripCounts.bid > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                <span>% viajes consumidos</span>
                <span style={{ fontWeight: 700, color: tripSem.color }}>{tripPct}%</span>
              </div>
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${tripPct}%`, background: `linear-gradient(90deg, ${tripSem.color}, ${tripSem.color}bb)`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", animation: "shimmer 2.5s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Client type breakdown */}
        <div style={{ background: "#fff", border: `1px solid ${CHARCOAL}15`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${CHARCOAL}, ${CHARCOAL}88)` }} />
          <p style={{ fontSize: 11, color: CHARCOAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 14px" }}>Detalle por tipo de cliente</p>
          {clientTypeBreakdown.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clientTypeBreakdown.map((item, idx) => {
                const maxCost = clientTypeBreakdown[0]?.cost || 1;
                const barPct = Math.max(5, Math.round((item.cost / maxCost) * 100));
                const c = ACCENTS[idx % ACCENTS.length];
                return (
                  <div key={item.clientType}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{clientTypeLabel(item.clientType)}</span>
                        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#f1f5f9" }}>{item.count}</span>
                      </div>
                      <span style={{ fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{formatCurrency(item.cost)}</span>
                    </div>
                    <div style={{ height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: `linear-gradient(90deg, ${c}, ${c}bb)`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", animation: "shimmer 2.5s ease-in-out infinite" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 20, borderRadius: 12, background: "#f8fafc", border: "1px dashed #e2e8f0", textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: 0 }}>Sin viajes completados aún</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts: Daily + Weekly ── */}
      {(dailySpend.length > 0 || weeklySpend.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Daily trend area chart */}
          {dailySpend.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${TEAL}20`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${TEAL}, ${BLUE})` }} />
              <p style={{ fontSize: 11, color: TEAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 2px" }}>Consumo diario</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>Monto por día (últimos 14 días)</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailySpend}>
                  <defs>
                    <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                    formatter={(value: number) => [formatCurrency(value), "Monto"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke={TEAL} strokeWidth={2.5} fill="url(#gradTeal)" dot={{ r: 3, fill: TEAL, strokeWidth: 0 }} activeDot={{ r: 5, fill: TEAL, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly bar chart */}
          {weeklySpend.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${BLUE}20`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${BLUE}, ${TEAL})` }} />
              <p style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 2px" }}>Consumo semanal</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>Monto acumulado por semana</p>
              <ResponsiveContainer width="100%" height={220}>
                <RBarChart data={weeklySpend}>
                  <defs>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={TEAL} stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                    formatter={(value: number) => [formatCurrency(value), "Monto"]}
                  />
                  <Bar dataKey="amount" fill="url(#gradBlue)" radius={[6, 6, 0, 0]} />
                </RBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Executive summary ── */}
      <div style={{ background: "#fff", border: `1px solid ${CHARCOAL}15`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${CHARCOAL}, ${TEAL})` }} />
        <p style={{ fontSize: 11, color: CHARCOAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 4px" }}>Lectura ejecutiva</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 18 }}>Estado general por servicio</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {buckets.map((bucket) => {
            const has = bucket.awarded > 0;
            const hasCon = bucket.consumed > 0;
            const pct = has ? Math.round((bucket.consumed / bucket.awarded) * 100) : 0;
            const s = sem(pct, has && hasCon);
            const color = ACCENTS[bucket.accentIndex];
            return (
              <div key={bucket.key} style={{ padding: "14px 16px", borderRadius: 14, background: hasCon ? s.bg : "#f8fafc", border: `1px solid ${hasCon ? s.glow : "#e2e8f0"}`, transition: "all 200ms ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                      {BUCKET_ICONS[bucket.key]}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{bucket.label}</span>
                  </div>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: hasCon ? s.color : (has ? "#22c55e" : "#94a3b8"), boxShadow: `0 0 8px ${hasCon ? s.glow : "transparent"}` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                  <span>{hasCon ? `${formatCurrency(bucket.consumed)} consumido de ${formatCurrency(bucket.awarded)}` : has ? `${formatCurrency(bucket.awarded)} adjudicado` : "Sin monto adjudicado"}</span>
                  <span style={{ fontWeight: 700, color: hasCon ? s.color : "#cbd5e1" }}>{pct}%</span>
                </div>
                <div style={{ height: 7, background: "rgba(255,255,255,0.6)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${has ? Math.max(hasCon ? pct : 0, 0) : 0}%`, background: `linear-gradient(90deg, ${hasCon ? s.color : "#e2e8f0"}, ${hasCon ? `${s.color}bb` : "#e2e8f0"})`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
