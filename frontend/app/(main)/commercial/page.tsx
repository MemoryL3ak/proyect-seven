"use client";

import { useTheme } from "@/lib/theme";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

const commercialBuckets = [
  {
    key: "transport",
    label: "Vehículos",
    awarded: 486_000_000,
    consumed: 318_000_000,
    forecast: 442_000_000,
    accentIndex: 0,
  },
  {
    key: "hospitality",
    label: "Hotelería",
    awarded: 932_000_000,
    consumed: 701_000_000,
    forecast: 884_000_000,
    accentIndex: 1,
  },
  {
    key: "food",
    label: "Alimentación",
    awarded: 624_000_000,
    consumed: 356_000_000,
    forecast: 598_000_000,
    accentIndex: 2,
  },
  {
    key: "production",
    label: "Producción",
    awarded: 278_000_000,
    consumed: 174_000_000,
    forecast: 241_000_000,
    accentIndex: 3,
  },
] as const;

const spendByWeek = [
  { label: "Sem 1", amount: 142_000_000 },
  { label: "Sem 2", amount: 198_000_000 },
  { label: "Sem 3", amount: 254_000_000 },
  { label: "Sem 4", amount: 301_000_000 },
  { label: "Sem 5", amount: 355_000_000 },
];

export default function CommercialDashboardPage() {
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";

  const totals = commercialBuckets.reduce(
    (acc, item) => {
      acc.awarded += item.awarded;
      acc.consumed += item.consumed;
      acc.forecast += item.forecast;
      return acc;
    },
    { awarded: 0, consumed: 0, forecast: 0 },
  );

  const consumptionPct = Math.round((totals.consumed / totals.awarded) * 100);
  const forecastPct = Math.round((totals.forecast / totals.awarded) * 100);

  const pal = isObsidian
    ? {
        accents: ["#22d3ee", "#a855f7", "#f59e0b", "#10b981"],
        cardBg: "#0e1728",
        cardBorder: "rgba(34,211,238,0.1)",
        cardBorderTop: (c: string) => `2px solid ${c}`,
        innerBg: "#0a1322",
        innerBorder: "rgba(34,211,238,0.1)",
        textPrimary: "#e2e8f0",
        textMuted: "rgba(255,255,255,0.45)",
        textFaint: "rgba(255,255,255,0.25)",
        progressTrack: "#0a1322",
        shadow: "0 4px 24px rgba(0,0,0,0.55)",
        tag: { bg: "rgba(34,211,238,0.08)", color: "rgba(255,255,255,0.35)", border: "rgba(34,211,238,0.15)" },
      }
    : isAtlas
    ? {
        accents: ["#3b5bdb", "#7c3aed", "#f59e0b", "#16a34a"],
        cardBg: "#ffffff",
        cardBorder: "#e8edf5",
        cardBorderTop: (c: string) => `2px solid ${c}`,
        innerBg: "#f8fafc",
        innerBorder: "#e8edf5",
        textPrimary: "#0f172a",
        textMuted: "#64748b",
        textFaint: "#94a3b8",
        progressTrack: "#f1f5f9",
        shadow: "0 1px 4px rgba(0,0,0,0.07)",
        tag: { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
      }
    : theme === "dark"
    ? {
        accents: ["#c9a84c", "#818cf8", "#f59e0b", "#10b981"],
        cardBg: "var(--surface)",
        cardBorder: "var(--border)",
        cardBorderTop: (c: string) => `2px solid ${c}`,
        innerBg: "var(--elevated)",
        innerBorder: "var(--border-muted)",
        textPrimary: "var(--text)",
        textMuted: "var(--text-muted)",
        textFaint: "var(--text-faint)",
        progressTrack: "var(--elevated)",
        shadow: "0 2px 12px rgba(0,0,0,0.35)",
        tag: { bg: "var(--elevated)", color: "var(--text-faint)", border: "var(--border-muted)" },
      }
    : {
        // light
        accents: ["#1e3a8a", "#7c3aed", "#0ea5e9", "#16a34a"],
        cardBg: "#ffffff",
        cardBorder: "#e8edf5",
        cardBorderTop: (c: string) => `2px solid ${c}`,
        innerBg: "#f8fafc",
        innerBorder: "#e8edf5",
        textPrimary: "#0f172a",
        textMuted: "#64748b",
        textFaint: "#94a3b8",
        progressTrack: "#f1f5f9",
        shadow: "0 1px 4px rgba(0,0,0,0.07)",
        tag: { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
      };

  const maxWeekAmount = Math.max(...spendByWeek.map((w) => w.amount), 1);

  return (
    <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease" }}>
      {/* ── Header */}
      <div>
        <p style={{ fontSize: "11px", color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
          Control comercial
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: pal.textPrimary, marginTop: "4px" }}>
          Dashboard consumo operacional
        </h1>
        <p style={{ fontSize: "13px", color: pal.textMuted, marginTop: "4px" }}>
          Vista ejecutiva ficticia para seguir presupuesto adjudicado, ejecución acumulada y proyección de cierre por servicio crítico.
        </p>
      </div>

      {/* ── Summary KPIs */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          { label: "Adjudicado total", value: formatCurrency(totals.awarded), color: pal.accents[0] },
          { label: "Consumido acumulado", value: formatCurrency(totals.consumed), color: pal.accents[1] },
          { label: "Uso total", value: `${consumptionPct}%`, color: pal.accents[2] },
        ].map((kpi, i) => (
          <div
            key={i}
            style={{
              background: pal.cardBg,
              border: `1px solid ${pal.cardBorder}`,
              borderTop: pal.cardBorderTop(kpi.color),
              borderRadius: "14px",
              padding: "18px 20px",
              boxShadow: pal.shadow,
              animation: `fadeInUp 0.4s ease both`,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <p style={{ fontSize: "10px", color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
              {kpi.label}
            </p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, marginTop: "8px", lineHeight: 1, fontVariantNumeric: "tabular-nums",
              ...(isObsidian ? { textShadow: `0 0 22px ${kpi.color}55` } : {}) }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Forecast de cierre */}
      <div style={{
        background: pal.cardBg,
        border: `1px solid ${pal.cardBorder}`,
        borderTop: pal.cardBorderTop(pal.accents[0]),
        borderRadius: "14px",
        padding: "20px",
        boxShadow: pal.shadow,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <p style={{ fontSize: "11px", color: pal.accents[0], fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Forecast de cierre
          </p>
          <span style={{ fontSize: "13px", fontWeight: 700, color: pal.accents[0] }}>{forecastPct}%</span>
        </div>
        <div style={{ height: "7px", background: pal.progressTrack, borderRadius: "99px", overflow: "hidden", marginBottom: "12px" }}>
          <div style={{ height: "100%", width: `${Math.min(100, forecastPct)}%`, background: pal.accents[0], borderRadius: "99px", transition: "width 0.8s ease",
            ...(isObsidian ? { boxShadow: `0 0 8px ${pal.accents[0]}88` } : {}) }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: pal.textPrimary, fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(totals.forecast)}
          </p>
          <p style={{ fontSize: "12px", color: pal.textMuted }}>
            Proyección base: cierre en el {forecastPct}% del adjudicado, presión principal en hotelería y movilidad.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
          <span style={{
            fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
            background: pal.tag.bg, color: pal.tag.color, border: `1px solid ${pal.tag.border}`,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            Datos ficticios
          </span>
        </div>
      </div>

      {/* ── Per-service breakdown */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {commercialBuckets.map((bucket, i) => {
          const color = pal.accents[bucket.accentIndex];
          const consumptionPctLocal = Math.min(100, Math.round((bucket.consumed / bucket.awarded) * 100));
          const forecastPctLocal = Math.min(100, Math.round((bucket.forecast / bucket.awarded) * 100));
          return (
            <div
              key={bucket.key}
              style={{
                background: pal.cardBg,
                border: `1px solid ${pal.cardBorder}`,
                borderTop: pal.cardBorderTop(color),
                borderRadius: "14px",
                padding: "18px",
                boxShadow: pal.shadow,
                animation: "fadeInUp 0.4s ease both",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              <p style={{ fontSize: "10px", color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
                {bucket.label}
              </p>
              <p style={{ fontSize: "1.35rem", fontWeight: 700, color: pal.textPrimary, marginTop: "8px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(bucket.consumed)}
              </p>
              <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "3px" }}>
                consumido de {formatCurrency(bucket.awarded)}
              </p>

              <div style={{ marginTop: "14px", background: pal.innerBg, border: `1px solid ${pal.innerBorder}`, borderRadius: "10px", padding: "10px 12px" }}>
                <p style={{ fontSize: "9px", color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.2em" }}>Forecast</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: pal.textPrimary, marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(bucket.forecast)}
                </p>
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: pal.textMuted, marginBottom: "4px" }}>
                    <span>% consumido</span>
                    <span style={{ color, fontWeight: 600 }}>{consumptionPctLocal}%</span>
                  </div>
                  <div style={{ height: "6px", background: pal.progressTrack, borderRadius: "99px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${consumptionPctLocal}%`, background: color, borderRadius: "99px", transition: "width 0.8s ease",
                      ...(isObsidian ? { boxShadow: `0 0 6px ${color}88` } : {}) }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: pal.textMuted, marginBottom: "4px" }}>
                    <span>% comprometido proyectado</span>
                    <span style={{ color: pal.textMuted, fontWeight: 600 }}>{forecastPctLocal}%</span>
                  </div>
                  <div style={{ height: "4px", background: pal.progressTrack, borderRadius: "99px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${forecastPctLocal}%`, background: pal.textFaint, borderRadius: "99px", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Weekly spend trend */}
      <div style={{
        background: pal.cardBg,
        border: `1px solid ${pal.cardBorder}`,
        borderTop: pal.cardBorderTop(pal.accents[1]),
        borderRadius: "14px",
        padding: "20px",
        boxShadow: pal.shadow,
      }}>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", color: pal.accents[1], fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Consumo acumulado
          </p>
          <p style={{ fontSize: "15px", fontWeight: 600, color: pal.textPrimary, marginTop: "2px" }}>
            Tendencia semanal de ejecución
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {spendByWeek.map((week, i) => {
            const barPct = Math.max(8, Math.round((week.amount / maxWeekAmount) * 100));
            const color = i % 2 === 0 ? pal.accents[0] : pal.accents[1];
            return (
              <div key={week.label} style={{ display: "grid", gridTemplateColumns: "56px 1fr 110px", alignItems: "center", gap: "10px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: pal.textMuted, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                  {week.label}
                </p>
                <div style={{ height: "34px", background: pal.progressTrack, borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barPct}%`,
                    background: color, borderRadius: "8px",
                    transition: "width 0.8s ease",
                    display: "flex", alignItems: "center", paddingLeft: "10px",
                    ...(isObsidian ? { boxShadow: `0 0 8px ${color}66` } : {}),
                  }} />
                </div>
                <p style={{ fontSize: "12px", color: pal.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(week.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Executive summary bars */}
      <div style={{
        background: pal.cardBg,
        border: `1px solid ${pal.cardBorder}`,
        borderTop: pal.cardBorderTop(pal.accents[2]),
        borderRadius: "14px",
        padding: "20px",
        boxShadow: pal.shadow,
      }}>
        <p style={{ fontSize: "11px", color: pal.accents[2], fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>
          Lectura ejecutiva
        </p>
        <p style={{ fontSize: "15px", fontWeight: 600, color: pal.textPrimary, marginBottom: "16px" }}>
          Foco de consumo por servicio
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {commercialBuckets.map((bucket) => {
            const color = pal.accents[bucket.accentIndex];
            const pct = Math.round((bucket.consumed / bucket.awarded) * 100);
            return (
              <div key={bucket.key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: pal.textMuted, marginBottom: "5px" }}>
                  <span>{bucket.label}</span>
                  <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: "6px", background: pal.progressTrack, borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: "99px", transition: "width 0.8s ease",
                    ...(isObsidian ? { boxShadow: `0 0 6px ${color}88` } : {}) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
