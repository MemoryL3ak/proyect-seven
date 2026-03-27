"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import StyledSelect from "@/components/StyledSelect";

type Athlete = {
  id: string;
  fullName?: string | null;
  userType?: string | null;
  dietaryNeeds?: string | null;
  email?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
};

type EventItem = { id: string; name?: string | null };
type Delegation = { id: string; countryCode?: string | null };
type Discipline = { id: string; name?: string | null };

const normalizeType = (value?: string | null) => {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : "SIN_TIPO";
};

const TYPE_COLORS = ["#38bdf8", "#10b981", "#f59e0b", "#a78bfa", "#f472b6", "#34d399", "#fb923c"];

const pal = {
  accent: "#21D0B3",
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0",
  cardShadow: "0 1px 4px rgba(15,23,42,0.06)",
  textMuted: "#64748b",
  tableBorder: "#e2e8f0",
  tableHead: "#f8fafc",
  tableText: "#1e293b",
  tableMuted: "#64748b",
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "10px",
  border: "1px solid #e2e8f0", background: "#f8fafc",
  fontSize: "14px", color: "#0f172a", outline: "none",
};

const UsersIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const UserIcon = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function ClientesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [delegations, setDelegations] = useState<Record<string, Delegation>>({});
  const [disciplines, setDisciplines] = useState<Record<string, Discipline>>({});
  const [selectedType, setSelectedType] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [athleteData, eventData, delegationData, disciplineData] = await Promise.all([
          apiFetch<Athlete[]>("/athletes"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<Delegation[]>("/delegations"),
          apiFetch<Discipline[]>("/disciplines"),
        ]);
        setAthletes(filterValidatedAthletes(athleteData || []));
        setEvents((eventData || []).reduce<Record<string, EventItem>>((acc, item) => { acc[item.id] = item; return acc; }, {}));
        setDelegations((delegationData || []).reduce<Record<string, Delegation>>((acc, item) => { acc[item.id] = item; return acc; }, {}));
        setDisciplines((disciplineData || []).reduce<Record<string, Discipline>>((acc, item) => { acc[item.id] = item; return acc; }, {}));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar clientes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const typeOptions = useMemo(() => {
    const set = new Set(athletes.map((item) => normalizeType(item.userType)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [athletes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return athletes
      .filter((item) => (selectedType ? normalizeType(item.userType) === selectedType : true))
      .filter((item) => (selectedEventId ? item.eventId === selectedEventId : true))
      .filter((item) => {
        if (!term) return true;
        return [
          item.fullName, item.email, normalizeType(item.userType),
          item.dietaryNeeds, delegations[item.delegationId || ""]?.countryCode,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      });
  }, [athletes, selectedType, selectedEventId, search, delegations]);

  const typeCounts = useMemo(() =>
    filtered.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeType(item.userType);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  [filtered]);

  const typeKpis = useMemo(() =>
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count], i) => ({ type, count, color: TYPE_COLORS[i % TYPE_COLORS.length] })),
  [typeCounts]);

  return (
    <div className="space-y-5">

      {/* ── Header */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Seven Arena</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#21D0B3" }}>EN VIVO</span>
          </span>
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "0 0 16px" }}>Clientes</h1>

        <div className="grid gap-3 lg:grid-cols-4">
          <StyledSelect value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="">Todos los tipos de cliente</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </StyledSelect>
          <StyledSelect value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Todos los eventos</option>
            {Object.values(events).map((ev) => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
          </StyledSelect>
          <input
            className="lg:col-span-2"
            style={fieldStyle}
            placeholder="Buscar por nombre, email, tipo o delegación"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {error ? <p style={{ marginTop: "8px", fontSize: "13px", color: "#ef4444" }}>{error}</p> : null}
      </section>

      {/* ── KPI cards */}
      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <article style={{
          background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
          borderTop: `3px solid ${pal.accent}`, borderRadius: "20px",
          padding: "18px 20px", boxShadow: pal.cardShadow,
          transition: "transform 120ms ease",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>Total clientes</p>
            <UsersIcon color={pal.accent} size={20} />
          </div>
          <p style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: pal.accent }}>{filtered.length}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: pal.accent, boxShadow: `0 0 6px ${pal.accent}` }} />
            <p style={{ fontSize: "11px", color: pal.textMuted }}>Participantes activos</p>
          </div>
        </article>

        {/* Per-type KPIs */}
        {typeKpis.map((card) => (
          <article key={card.type} style={{
            background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
            borderTop: `3px solid ${card.color}`, borderRadius: "20px",
            padding: "18px 20px", boxShadow: pal.cardShadow,
            transition: "transform 120ms ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: card.color }}>{card.type}</p>
              <UserIcon color={card.color} size={20} />
            </div>
            <p style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: card.color }}>{card.count}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: card.color, boxShadow: `0 0 6px ${card.color}` }} />
              <p style={{ fontSize: "11px", color: pal.textMuted }}>registrados</p>
            </div>
          </article>
        ))}
      </section>

      {/* ── Table */}
      <section style={{
        background: pal.cardBg, border: `1px solid ${pal.tableBorder}`,
        borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow,
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: pal.tableHead }}>
                {["Cliente", "Tipo", "Evento", "Delegación", "Disciplina", "Alimentación", "Contacto"].map((h) => (
                  <th key={h} style={{
                    padding: "13px 16px", textAlign: "left", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "#94a3b8", borderBottom: `1px solid ${pal.tableBorder}`,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const type = normalizeType(item.userType);
                const typeColor = TYPE_COLORS[typeOptions.indexOf(type) % TYPE_COLORS.length] ?? pal.accent;
                return (
                  <tr key={item.id} style={{
                    background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                    borderBottom: `1px solid ${pal.tableBorder}`,
                    transition: "background 120ms ease",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#ffffff" : "#f8fafc"; }}
                  >
                    <td style={{ padding: "11px 16px", fontWeight: 700, color: pal.tableText }}>{item.fullName || item.id}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        background: `${typeColor}18`, border: `1px solid ${typeColor}35`,
                        borderRadius: "99px", padding: "3px 10px",
                        fontSize: "11px", fontWeight: 700, color: typeColor,
                      }}>
                        <UserIcon color={typeColor} size={12} />
                        {type}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", color: pal.tableMuted }}>{events[item.eventId || ""]?.name || item.eventId || "-"}</td>
                    <td style={{ padding: "11px 16px", color: pal.tableText, fontWeight: 600 }}>{delegations[item.delegationId || ""]?.countryCode || "-"}</td>
                    <td style={{ padding: "11px 16px", color: pal.tableMuted }}>{disciplines[item.disciplineId || ""]?.name || "-"}</td>
                    <td style={{ padding: "11px 16px", color: pal.tableMuted }}>{item.dietaryNeeds || "-"}</td>
                    <td style={{ padding: "11px 16px", color: pal.tableMuted, fontSize: "12px" }}>{item.email || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? (
            <p style={{ padding: "24px 16px", fontSize: "13px", color: pal.textMuted }}>No hay participantes para este filtro.</p>
          ) : null}
        </div>
      </section>

    </div>
  );
}
