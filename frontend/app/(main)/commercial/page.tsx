"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

type Driver = { budgetAmount?: number | null };

// Brand palette — Seven Arena
const TEAL       = "#21D0B3";
const TEAL_LIGHT = "#34F3C6";
const BLUE       = "#1FCDFF";
const CHARCOAL   = "#30455B";

const ACCENTS = [TEAL, BLUE, CHARCOAL, TEAL_LIGHT];

const PLACEHOLDER_BUCKETS = [
  { key: "hospitality", label: "Hotelería",    awarded: 932_000_000, consumed: 701_000_000, forecast: 884_000_000, accentIndex: 1, real: false },
  { key: "food",        label: "Alimentación", awarded: 624_000_000, consumed: 356_000_000, forecast: 598_000_000, accentIndex: 2, real: false },
  { key: "production",  label: "Producción",   awarded: 278_000_000, consumed: 174_000_000, forecast: 241_000_000, accentIndex: 3, real: false },
];

const spendByWeek = [
  { label: "Sem 1", amount: 142_000_000 },
  { label: "Sem 2", amount: 198_000_000 },
  { label: "Sem 3", amount: 254_000_000 },
  { label: "Sem 4", amount: 301_000_000 },
  { label: "Sem 5", amount: 355_000_000 },
];

function Card({ children, accentColor, style }: { children: React.ReactNode; accentColor?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderTop: accentColor ? `2px solid ${accentColor}` : "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "20px",
      boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: "99px", transition: "width 0.8s ease" }} />
    </div>
  );
}

export default function CommercialDashboardPage() {
  const { t } = useI18n();
  const [transportAwarded, setTransportAwarded] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<Driver[]>("/drivers").then(drivers => {
      const total = drivers.reduce((sum, d) => sum + (d.budgetAmount ?? 0), 0);
      setTransportAwarded(total);
    }).catch(() => {});
  }, []);

  const transportBucket = {
    key: "transport",
    label: "Transporte (conductores)",
    awarded: transportAwarded ?? 0,
    consumed: 0,
    forecast: transportAwarded ?? 0,
    accentIndex: 0,
    real: transportAwarded != null && transportAwarded > 0,
  };

  const commercialBuckets = [transportBucket, ...PLACEHOLDER_BUCKETS];

  const totals = commercialBuckets.reduce(
    (acc, item) => {
      acc.awarded  += item.awarded;
      acc.consumed += item.consumed;
      acc.forecast += item.forecast;
      return acc;
    },
    { awarded: 0, consumed: 0, forecast: 0 },
  );

  const consumptionPct = totals.awarded > 0 ? Math.round((totals.consumed / totals.awarded) * 100) : 0;
  const forecastPct    = totals.awarded > 0 ? Math.round((totals.forecast / totals.awarded) * 100) : 0;
  const maxWeekAmount  = Math.max(...spendByWeek.map((w) => w.amount), 1);

  return (
    <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>

      {/* ── Header */}
      <div>
        <p style={{ fontSize: "11px", color: TEAL, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>
          {t("Control comercial")}
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
          {t("Dashboard consumo operacional")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
          {t("Vista ejecutiva ficticia para seguir presupuesto adjudicado, ejecución acumulada y proyección de cierre por servicio crítico.")}
        </p>
      </div>

      {/* ── Summary KPIs */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          { label: t("Adjudicado total"),    value: formatCurrency(totals.awarded),  color: TEAL },
          { label: t("Consumido acumulado"), value: formatCurrency(totals.consumed), color: BLUE },
          { label: t("Uso total"),           value: `${consumptionPct}%`,            color: CHARCOAL },
        ].map((kpi, i) => (
          <Card key={i} accentColor={kpi.color} style={{ animationDelay: `${i * 0.06}s`, animation: "fadeInUp 0.4s ease both" }}>
            <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              {kpi.label}
            </p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, marginTop: "8px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Forecast de cierre */}
      <Card accentColor={TEAL}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <p style={{ fontSize: "11px", color: TEAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {t("Forecast de cierre")}
          </p>
          <span style={{ fontSize: "13px", fontWeight: 700, color: TEAL }}>{forecastPct}%</span>
        </div>
        <ProgressBar pct={forecastPct} color={TEAL} height={7} />
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "12px" }}>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(totals.forecast)}
          </p>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            {t("Proyección base: cierre en el {pct}% del adjudicado, presión principal en hotelería y movilidad.").replace("{pct}", String(forecastPct))}
          </p>
        </div>
        <div style={{ marginTop: "8px" }}>
          <span style={{
            fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
            background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0",
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            {t("Transporte real · resto ficticio")}
          </span>
        </div>
      </Card>

      {/* ── Per-service breakdown */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {commercialBuckets.map((bucket, i) => {
          const color = ACCENTS[bucket.accentIndex];
          const consumptionPctLocal = bucket.awarded > 0 ? Math.min(100, Math.round((bucket.consumed / bucket.awarded) * 100)) : 0;
          const forecastPctLocal    = bucket.awarded > 0 ? Math.min(100, Math.round((bucket.forecast / bucket.awarded) * 100)) : 0;
          return (
            <Card key={bucket.key} accentColor={color} style={{ animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.06}s` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
                  {t(bucket.label)}
                </p>
                <span style={{
                  fontSize: "9px", fontWeight: 600, padding: "1px 7px", borderRadius: "99px",
                  background: bucket.real ? `${color}18` : "#f1f5f9",
                  color: bucket.real ? color : "#94a3b8",
                  border: `1px solid ${bucket.real ? `${color}35` : "#e2e8f0"}`,
                  textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap",
                }}>
                  {bucket.real ? t("Real") : t("Ficticio")}
                </span>
              </div>

              <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginTop: "8px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                {bucket.consumed > 0 ? formatCurrency(bucket.consumed) : "—"}
              </p>
              <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                {bucket.consumed > 0 ? t("consumido de ") : t("licitado: ")}{formatCurrency(bucket.awarded)}
              </p>

              <div style={{ marginTop: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 12px" }}>
                <p style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.2em" }}>{t("Forecast / Adjudicado")}</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(bucket.forecast)}
                </p>
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                    <span>{t("% consumido")}</span>
                    <span style={{ color, fontWeight: 600 }}>{consumptionPctLocal}%</span>
                  </div>
                  <ProgressBar pct={consumptionPctLocal} color={color} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                    <span>{t("% comprometido proyectado")}</span>
                    <span style={{ color: "#94a3b8", fontWeight: 600 }}>{forecastPctLocal}%</span>
                  </div>
                  <ProgressBar pct={forecastPctLocal} color="#cbd5e1" height={4} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Weekly spend trend */}
      <Card accentColor={BLUE}>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", color: BLUE, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {t("Consumo acumulado")}
          </p>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
            {t("Tendencia semanal de ejecución")}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {spendByWeek.map((week, i) => {
            const barPct = Math.max(8, Math.round((week.amount / maxWeekAmount) * 100));
            const color  = i % 2 === 0 ? TEAL : BLUE;
            return (
              <div key={week.label} style={{ display: "grid", gridTemplateColumns: "56px 1fr 110px", alignItems: "center", gap: "10px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                  {week.label}
                </p>
                <div style={{ height: "34px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: "8px", transition: "width 0.8s ease" }} />
                </div>
                <p style={{ fontSize: "12px", color: "#64748b", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(week.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Executive summary */}
      <Card accentColor={CHARCOAL}>
        <p style={{ fontSize: "11px", color: CHARCOAL, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>
          {t("Lectura ejecutiva")}
        </p>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", marginBottom: "16px" }}>
          {t("Foco de consumo por servicio")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {commercialBuckets.map((bucket) => {
            const color = ACCENTS[bucket.accentIndex];
            const pct   = bucket.awarded > 0 ? Math.round((bucket.consumed / bucket.awarded) * 100) : 0;
            return (
              <div key={bucket.key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>
                  <span>{t(bucket.label)}</span>
                  <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                </div>
                <ProgressBar pct={pct} color={color} />
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
