"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useTheme } from "@/lib/theme";

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
const TYPE_ICONS: Record<string, string> = {
  DEPORTISTA: "🏅", ATLETA: "🏅", STAFF: "🪪", COACH: "🎽",
  ENTRENADOR: "🎽", MEDICO: "⚕️", JUEZ: "⚖️", VOLUNTARIO: "🤝",
  PRENSA: "📸", OFICIAL: "🏛️", SIN_TIPO: "👤",
};
const getTypeIcon = (t: string) => TYPE_ICONS[t.toUpperCase()] ?? "👤";

export default function ClientesPage() {
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

  const pal = isObsidian ? {
    panelBg: "linear-gradient(135deg, #0a1322 0%, #0e1728 60%, #0d1a30 100%)",
    panelBorder: "rgba(34,211,238,0.08)", panelShadow: "0 4px 32px rgba(0,0,0,0.6)",
    orb1: "rgba(56,189,248,0.08)", orb2: "rgba(168,85,247,0.06)",
    accent: "#22d3ee", titleColor: "#e2e8f0", subtitleColor: "rgba(255,255,255,0.45)",
    cardBg: "#0e1728", cardBorder: "rgba(34,211,238,0.1)", cardShadow: "0 4px 20px rgba(0,0,0,0.5)",
    labelColor: "rgba(255,255,255,0.35)", textMuted: "rgba(255,255,255,0.5)",
    rowBg: "rgba(255,255,255,0.03)", rowHover: "rgba(255,255,255,0.06)",
    inputBg: "rgba(255,255,255,0.06)", inputColor: "#e2e8f0",
    tableBorder: "rgba(255,255,255,0.06)", tableHead: "rgba(255,255,255,0.04)",
    tableText: "#e2e8f0", tableMuted: "rgba(255,255,255,0.4)",
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
    panelBorder: "rgba(255,255,255,0.06)", panelShadow: "0 4px 24px rgba(0,0,0,0.45)",
    orb1: "rgba(56,189,248,0.07)", orb2: "rgba(129,140,248,0.06)",
    accent: "#38bdf8", titleColor: "#f1f5f9", subtitleColor: "rgba(255,255,255,0.4)",
    cardBg: "var(--surface)", cardBorder: "var(--border)", cardShadow: "0 2px 12px rgba(0,0,0,0.3)",
    labelColor: "var(--text-faint)", textMuted: "var(--text-muted)",
    rowBg: "rgba(255,255,255,0.03)", rowHover: "rgba(255,255,255,0.05)",
    inputBg: "rgba(255,255,255,0.07)", inputColor: "#f1f5f9",
    tableBorder: "rgba(255,255,255,0.07)", tableHead: "rgba(255,255,255,0.04)",
    tableText: "#f1f5f9", tableMuted: "rgba(255,255,255,0.45)",
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 60%, #eef1f8 100%)",
    panelBorder: "#c7d2fe", panelShadow: "0 1px 4px rgba(0,0,0,0.07)",
    orb1: "rgba(59,91,219,0.06)", orb2: "rgba(100,129,240,0.05)",
    accent: "#3b5bdb", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    rowBg: "#f8fafc", rowHover: "#f1f5f9",
    inputBg: "#ffffff", inputColor: "#0f172a",
    tableBorder: "#e2e8f0", tableHead: "#f8fafc",
    tableText: "#1e293b", tableMuted: "#64748b",
  } : {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
    panelBorder: "#e2e8f0", panelShadow: "0 1px 4px rgba(0,0,0,0.06)",
    orb1: "rgba(56,189,248,0.05)", orb2: "rgba(124,58,237,0.04)",
    accent: "#1e3a8a", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 3px rgba(0,0,0,0.05)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    rowBg: "#f8fafc", rowHover: "#f1f5f9",
    inputBg: "#ffffff", inputColor: "#0f172a",
    tableBorder: "#e2e8f0", tableHead: "#f8fafc",
    tableText: "#1e293b", tableMuted: "#64748b",
  };

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
          apiFetch<Discipline[]>("/disciplines")
        ]);

        setAthletes(filterValidatedAthletes(athleteData || []));
        setEvents(
          (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
        setDelegations(
          (delegationData || []).reduce<Record<string, Delegation>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
        setDisciplines(
          (disciplineData || []).reduce<Record<string, Discipline>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
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
          item.fullName,
          item.email,
          normalizeType(item.userType),
          item.dietaryNeeds,
          delegations[item.delegationId || ""]?.countryCode
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [athletes, selectedType, selectedEventId, search, delegations]);

  const typeCounts = useMemo(() => {
    return filtered.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeType(item.userType);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filtered]);

  const typeKpis = useMemo(() =>
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count], i) => ({ type, count, color: TYPE_COLORS[i % TYPE_COLORS.length], icon: getTypeIcon(type) })),
    [typeCounts]
  );

  return (
    <div className="space-y-5">

      {/* ── Command panel */}
      <section style={{ borderRadius: "24px", overflow: "hidden", boxShadow: pal.panelShadow }}>
        <div style={{ background: pal.panelBg, border: `1px solid ${pal.panelBorder}`, borderRadius: "24px", padding: "24px 28px 20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-50px", right: "-30px", width: "240px", height: "240px", borderRadius: "50%", background: pal.orb1, filter: "blur(55px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "15%", width: "180px", height: "180px", borderRadius: "50%", background: pal.orb2, filter: "blur(45px)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.labelColor }}>Seven Arena</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "99px", padding: "2px 10px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#38bdf8" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: pal.titleColor, margin: "0 0 16px" }}>Clientes</h1>

            <div className="grid gap-3 lg:grid-cols-4">
              <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }}
                value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="">Todos los tipos de cliente</option>
                {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }}
                value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">Todos los eventos</option>
                {Object.values(events).map((ev) => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
              </select>
              <input className="input lg:col-span-2 rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }}
                placeholder="Buscar por nombre, email, tipo o delegación"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {error ? <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p> : null}
          </div>
        </div>
      </section>

      {/* ── KPI cards */}
      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <article style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderTop: `3px solid ${pal.accent}`, borderRadius: "20px",
          padding: "18px 20px", boxShadow: pal.cardShadow,
          transition: "transform 120ms ease",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>Total clientes</p>
            <span style={{ fontSize: "20px" }}>👥</span>
          </div>
          <p style={{
            fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: pal.accent,
            textShadow: (isObsidian || isDark) ? `0 0 20px ${pal.accent}44` : "none",
          }}>{filtered.length}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: pal.accent, boxShadow: `0 0 6px ${pal.accent}` }} />
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Participantes activos</p>
          </div>
        </article>

        {/* Per-type KPIs */}
        {typeKpis.map((card) => (
          <article key={card.type} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderTop: `3px solid ${card.color}`, borderRadius: "20px",
            padding: "18px 20px", boxShadow: pal.cardShadow,
            transition: "transform 120ms ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: card.color }}>{card.type}</p>
              <span style={{ fontSize: "20px" }}>{card.icon}</span>
            </div>
            <p style={{
              fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: card.color,
              textShadow: (isObsidian || isDark) ? `0 0 20px ${card.color}44` : "none",
            }}>{card.count}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: card.color, boxShadow: `0 0 6px ${card.color}` }} />
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>registrados</p>
            </div>
          </article>
        ))}
      </section>

      {/* ── Table */}
      <section style={{
        background: "var(--surface)", border: `1px solid var(--border)`,
        borderRadius: "24px", padding: "0", boxShadow: pal.cardShadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--elevated)" }}>
                {["Cliente", "Tipo", "Evento", "Delegación", "Disciplina", "Alimentación", "Contacto"].map((h) => (
                  <th key={h} style={{
                    padding: "13px 16px", textAlign: "left", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "var(--text-faint)", borderBottom: `1px solid var(--border)`,
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
                    background: idx % 2 === 0 ? "transparent" : "var(--elevated)",
                    borderBottom: "1px solid var(--border)",
                    transition: "background 120ms ease",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevated)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "transparent" : "var(--elevated)"; }}
                  >
                    <td style={{ padding: "11px 16px", fontWeight: 700, color: "var(--text)" }}>{item.fullName || item.id}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        background: `${typeColor}18`, border: `1px solid ${typeColor}35`,
                        borderRadius: "99px", padding: "3px 10px",
                        fontSize: "11px", fontWeight: 700, color: typeColor,
                      }}>
                        {getTypeIcon(type)} {type}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{events[item.eventId || ""]?.name || item.eventId || "-"}</td>
                    <td style={{ padding: "11px 16px", color: "var(--text)", fontWeight: 600 }}>{delegations[item.delegationId || ""]?.countryCode || "-"}</td>
                    <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{disciplines[item.disciplineId || ""]?.name || "-"}</td>
                    <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{item.dietaryNeeds || "-"}</td>
                    <td style={{ padding: "11px 16px", color: "var(--text-muted)", fontSize: "12px" }}>{item.email || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? (
            <p style={{ padding: "24px 16px", fontSize: "13px", color: "var(--text-muted)" }}>No hay participantes para este filtro.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
