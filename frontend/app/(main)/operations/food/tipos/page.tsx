"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// All possible types — always show every one
const ALL_TYPES = [
  { key: "ESTANDAR",     label: "Estándar",      icon: "🍽️",  bg: "bg-white",               border: "border-slate-200",  text: "text-slate-700",   badge: "bg-slate-100 text-slate-600" },
  { key: "VEGETARIANO",  label: "Vegetariano",    icon: "🥦",  bg: "bg-green-50",             border: "border-green-200",  text: "text-green-700",   badge: "bg-green-100 text-green-700" },
  { key: "VEGANO",       label: "Vegano",         icon: "🌿",  bg: "bg-emerald-50",           border: "border-emerald-200",text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  { key: "SIN_GLUTEN",   label: "Sin gluten",     icon: "🌾",  bg: "bg-amber-50",             border: "border-amber-200",  text: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  { key: "SIN_LACTOSA",  label: "Sin lactosa",    icon: "🥛",  bg: "bg-yellow-50",            border: "border-yellow-200", text: "text-yellow-700",  badge: "bg-yellow-100 text-yellow-700" },
  { key: "HALAL",        label: "Halal",          icon: "☪️",  bg: "bg-teal-50",              border: "border-teal-200",   text: "text-teal-700",    badge: "bg-teal-100 text-teal-700" },
  { key: "KOSHER",       label: "Kosher",         icon: "✡️",  bg: "bg-blue-50",              border: "border-blue-200",   text: "text-blue-700",    badge: "bg-blue-100 text-blue-700" },
  { key: "SIN_MARISCOS", label: "Sin mariscos",   icon: "🦐",  bg: "bg-orange-50",            border: "border-orange-200", text: "text-orange-700",  badge: "bg-orange-100 text-orange-700" },
  { key: "DIABETICO",    label: "Diabético",      icon: "💉",  bg: "bg-red-50",               border: "border-red-200",    text: "text-red-700",     badge: "bg-red-100 text-red-700" },
  { key: "OTRO",         label: "Otro",           icon: "❓",  bg: "bg-purple-50",            border: "border-purple-200", text: "text-purple-700",  badge: "bg-purple-100 text-purple-700" },
] as const;

type DietaryKey = typeof ALL_TYPES[number]["key"];
type Athlete = { id: string; fullName: string; dietaryNeeds?: string; delegationId?: string };
type Delegation = { id: string; countryCode: string };

export default function TiposAlimentacionPage() {
  const { t } = useI18n();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Athlete[]>("/athletes"),
      apiFetch<Delegation[]>("/delegations"),
    ]).then(([aths, dels]) => {
      setAthletes(aths ?? []);
      setDelegations(dels ?? []);
      setLoading(false);
    });
  }, []);

  // Count per dietary type (key → number)
  const typeCounts = athletes.reduce<Record<string, number>>((acc, a) => {
    const k = a.dietaryNeeds || "ESTANDAR";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const total = athletes.length;
  const specialCount = athletes.filter((a) => a.dietaryNeeds && a.dietaryNeeds !== "ESTANDAR").length;

  // Delegation name map: id → countryCode
  const delegMap = Object.fromEntries(delegations.map((d) => [d.id, d.countryCode]));

  // Breakdown: delegationId → { dietaryKey → count }
  const delegBreakdown = athletes.reduce<Record<string, Record<string, number>>>((acc, a) => {
    const delKey = a.delegationId ?? "__none__";
    const type = (a.dietaryNeeds || "ESTANDAR") as DietaryKey;
    (acc[delKey] ??= {})[type] = ((acc[delKey]?.[type]) ?? 0) + 1;
    return acc;
  }, {});

  // Sorted delegations by total desc
  const sortedDelegations = Object.entries(delegBreakdown).sort(([, a], [, b]) => {
    return (
      Object.values(b).reduce((s, v) => s + v, 0) -
      Object.values(a).reduce((s, v) => s + v, 0)
    );
  });

  // Only show types that have at least 1 participant in the table columns
  const activeTypes = ALL_TYPES.filter((t) => (typeCounts[t.key] ?? 0) > 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "64px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#94a3b8" }}>
            <svg style={{ animation: "spin 1s linear infinite" }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <p style={{ fontSize: "13px" }}>{t("Cargando datos...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("Total participantes"), value: total, sub: null },
          { label: t("Req. especiales"), value: specialCount, sub: total > 0 ? `${((specialCount / total) * 100).toFixed(1)}% ${t("del total")}` : null },
          { label: t("Tipos distintos"), value: activeTypes.length, sub: null },
          { label: t("Delegaciones"), value: sortedDelegations.length, sub: null },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#94a3b8" }}>{kpi.label}</p>
            <p style={{ fontSize: "3rem", fontWeight: 800, color: "#0f172a", marginTop: "12px", lineHeight: 1 }}>{kpi.value}</p>
            {kpi.sub && <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Dietary type cards — ALL 10 always shown */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>{t("Distribución por tipo de alimentación")}</h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_TYPES.map((dtype) => {
            const count = typeCounts[dtype.key] ?? 0;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
            const isEmpty = count === 0;
            return (
              <div
                key={dtype.key}
                className={`rounded-2xl border p-4 flex flex-col gap-2 transition-opacity ${dtype.bg} ${dtype.border} ${isEmpty ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl leading-none">{dtype.icon}</span>
                  {!isEmpty && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dtype.badge}`}>
                      {pct}%
                    </span>
                  )}
                </div>
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${isEmpty ? "text-slate-400" : dtype.text}`}>
                    {t(dtype.label)}
                  </p>
                  <p className={`text-3xl font-bold mt-0.5 ${isEmpty ? "text-slate-300" : dtype.text}`}>
                    {count}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Delegation breakdown — only if there's data */}
      {sortedDelegations.length > 0 && (
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>{t("Desglose por delegación")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left py-3 pr-6 pl-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 whitespace-nowrap">
                    {t("Delegación")}
                  </th>
                  {activeTypes.map((dtype) => (
                    <th key={dtype.key} className="text-center py-3 px-3 border-b border-slate-200 whitespace-nowrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${dtype.badge} ${dtype.border}`}>
                        {t(dtype.label)}
                      </span>
                    </th>
                  ))}
                  <th className="text-center py-3 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    {t("Total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDelegations.map(([delId, counts], idx) => {
                  const rowTotal = Object.values(counts).reduce((s, v) => s + v, 0);
                  const label = delId === "__none__"
                    ? t("Sin delegación")
                    : (delegMap[delId] ?? delId.slice(0, 8) + "…");
                  return (
                    <tr key={delId} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td className="py-3 pr-6 pl-2 font-semibold whitespace-nowrap rounded-l-lg" style={{ color: "#0f172a" }}>
                        {label}
                      </td>
                      {activeTypes.map((dtype) => {
                        const n = counts[dtype.key] ?? 0;
                        return (
                          <td key={dtype.key} className="text-center py-3 px-3">
                            {n > 0 ? (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${dtype.badge} ${dtype.border}`}>
                                {n}
                              </span>
                            ) : (
                              <span className="text-slate-200 text-base">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-3 px-3 font-bold rounded-r-lg" style={{ color: "#0f172a" }}>{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-3 pr-6 pl-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("Total general")}
                  </td>
                  {activeTypes.map((dtype) => (
                    <td key={dtype.key} className="text-center py-3 px-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${dtype.badge} ${dtype.border}`}>
                        {typeCounts[dtype.key] ?? 0}
                      </span>
                    </td>
                  ))}
                  <td className="text-center py-3 px-3 font-bold text-base" style={{ color: "#0f172a" }}>{total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {total === 0 && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "64px 24px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
          {t("No hay participantes registrados.")}
        </div>
      )}
    </div>
  );
}
