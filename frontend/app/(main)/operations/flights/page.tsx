"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type Flight = {
  id: string;
  eventId: string;
  flightNumber: string;
  airline: string;
  arrivalTime: string;
  origin: string;
  terminal?: string | null;
};

type EventItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null; eventId?: string | null };
type DisciplineItem = { id: string; name?: string | null; parentId?: string | null };

type AthleteItem = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  flightNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TrackResult = {
  flightNumber: string;
  airlineName: string | null;
  flightStatus: string | null;
  flightDate: string | null;
  depAirport: string | null;
  depIata: string | null;
  depCity: string | null;
  depScheduled: string | null;
  depActual: string | null;
  depGate: string | null;
  depDelayMinutes: number | null;
  arrAirport: string | null;
  arrIata: string | null;
  arrCity: string | null;
  arrScheduled: string | null;
  arrEstimated: string | null;
  arrActual: string | null;
  arrBaggage: string | null;
  arrDelayMinutes: number | null;
  liveUpdated: string | null;
  liveLatitude: number | null;
  liveLongitude: number | null;
  liveAltitude: number | null;
  liveSpeedHorizontal: number | null;
  liveIsGround: boolean | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; pulse: boolean }> = {
  scheduled:  { label: "Programado",  color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)",  pulse: false },
  active:     { label: "En vuelo",    color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  pulse: true  },
  landed:     { label: "Aterrizó",    color: "#21D0B3", bg: "rgba(33,208,179,0.1)",  border: "rgba(33,208,179,0.3)",  pulse: false },
  cancelled:  { label: "Cancelado",   color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   pulse: false },
  diverted:   { label: "Desviado",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  pulse: false },
  incident:   { label: "Incidente",   color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  pulse: false },
};

function statusStyle(status?: string | null) {
  return STATUS_CONFIG[status?.toLowerCase() ?? ""] ?? {
    label: status ?? "Desconocido", color: "#94a3b8",
    bg: "#f1f5f9", border: "#e2e8f0", pulse: false,
  };
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = { flightNumber: "", airline: "", arrivalTime: "", origin: "", terminal: "", eventId: "" };

export default function FlightsPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [trackModal, setTrackModal] = useState<{ flight: Flight } | null>(null);
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick search (without adding)
  const [quickSearch, setQuickSearch] = useState("");
  const [quickResult, setQuickResult] = useState<TrackResult | null>(null);
  const [quickSearching, setQuickSearching] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterDelegation, setFilterDelegation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Flight | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [flightData, eventData, athleteData, delegationData, disciplineData] = await Promise.all([
        apiFetch<Flight[]>("/flights"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<AthleteItem[]>("/athletes"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<DisciplineItem[]>("/disciplines"),
      ]);
      setFlights(flightData ?? []);
      setEvents(eventData ?? []);
      setAthletes(filterValidatedAthletes(athleteData ?? []));
      setDelegations(delegationData ?? []);
      setDisciplines(disciplineData ?? []);
      if (!selectedEventId && eventData?.length) setSelectedEventId(eventData[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    if (autoRefresh && trackModal) {
      refreshTimer.current = setInterval(() => doTrack(trackModal.flight), 30000);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [autoRefresh, trackModal]);

  const delegationById = useMemo(() => delegations.reduce<Record<string, DelegationItem>>((acc, d) => { acc[d.id] = d; return acc; }, {}), [delegations]);
  const disciplineById = useMemo(() => disciplines.reduce<Record<string, DisciplineItem>>((acc, d) => { acc[d.id] = d; return acc; }, {}), [disciplines]);

  const filteredFlights = useMemo(() =>
    flights.filter(f => {
      if (selectedEventId && f.eventId !== selectedEventId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!f.flightNumber.toLowerCase().includes(q) && !f.airline.toLowerCase().includes(q) && !f.origin.toLowerCase().includes(q)) return false;
      }
      if (filterDate) {
        const flightDay = f.arrivalTime ? new Date(f.arrivalTime).toISOString().slice(0, 10) : "";
        if (flightDay !== filterDate) return false;
      }
      return true;
    }),
    [flights, selectedEventId, searchQuery, filterDate]
  );

  const flightPassengers = useMemo(() => {
    return filteredFlights.map(f => {
      const normalizedFN = f.flightNumber.replace(/\s+/g, "").toUpperCase();
      const passengers = athletes.filter(a => {
        // Match by athlete's direct flightNumber field
        const directFN = (a.flightNumber ?? "").replace(/\s+/g, "").toUpperCase();
        if (directFN && directFN === normalizedFN) return true;
        // Fallback: match by metadata vuelo_llegada / vuelo_salida
        const m = a.metadata;
        if (!m) return false;
        const metaFN = String(m.vuelo_llegada ?? m.vuelo_salida ?? "").replace(/\s+/g, "").toUpperCase();
        return metaFN === normalizedFN;
      });
      return { flight: f, passengers };
    });
  }, [filteredFlights, athletes]);

  // Apply delegation filter
  const displayFlights = useMemo(() => {
    if (!filterDelegation) return flightPassengers;
    return flightPassengers.filter(({ passengers }) =>
      passengers.some(p => p.delegationId === filterDelegation)
    );
  }, [flightPassengers, filterDelegation]);

  // Apply status filter
  const finalFlights = useMemo(() => {
    if (!filterStatus) return displayFlights;
    return displayFlights.filter(({ flight }) => {
      const arrDate = flight.arrivalTime ? new Date(flight.arrivalTime) : null;
      const isPast = arrDate && arrDate.getTime() < Date.now();
      const isToday = arrDate && arrDate.toDateString() === new Date().toDateString();
      if (filterStatus === "arrived") return isPast && !isToday;
      if (filterStatus === "today") return isToday;
      if (filterStatus === "upcoming") return !isPast && !isToday;
      return true;
    });
  }, [displayFlights, filterStatus]);

  const lookupAirline = async (flightNum: string) => {
    if (!flightNum.trim()) return;
    setLookingUp(true);
    try {
      const data = await apiFetch<{ airlineName: string; origin: string; departureGate: string }>(
        `/flights/lookup-airline?flightNumber=${encodeURIComponent(flightNum.trim())}`
      );
      setForm(f => ({ ...f, airline: data.airlineName || f.airline, origin: data.origin || f.origin }));
    } catch { /* silent */ } finally { setLookingUp(false); }
  };

  const saveFlightForm = async () => {
    if (!form.flightNumber.trim()) { setFormError("El número de vuelo es requerido."); return; }
    if (!form.airline.trim()) { setFormError("La aerolínea es requerida."); return; }
    if (!form.arrivalTime) { setFormError("La hora de llegada es requerida."); return; }
    if (!form.origin.trim()) { setFormError("El origen es requerido."); return; }
    const eventId = form.eventId || selectedEventId;
    if (!eventId) { setFormError("Selecciona un evento."); return; }
    setSaving(true); setFormError(null);
    try {
      await apiFetch("/flights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId, flightNumber: form.flightNumber.trim().toUpperCase(),
          airline: form.airline.trim(),
          arrivalTime: new Date(form.arrivalTime).toISOString(),
          origin: form.origin.trim(), terminal: form.terminal || null,
        }),
      });
      setModal(false); setForm(EMPTY_FORM); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const removeFlight = async (f: Flight) => {
    try { await apiFetch(`/flights/${f.id}`, { method: "DELETE" }); setDeleteConfirm(null); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Error al eliminar"); }
  };

  const doTrack = async (f: Flight) => {
    setTracking(true); setTrackError(null);
    try {
      const flightDate = f.arrivalTime ? new Date(f.arrivalTime).toISOString().slice(0, 10) : "";
      const dateParam = flightDate ? `&flightDate=${flightDate}` : "";
      const result = await apiFetch<TrackResult>(`/flights/track?flightNumber=${encodeURIComponent(f.flightNumber)}${dateParam}`);
      setTrackResult(result);
    } catch (e) { setTrackError(e instanceof Error ? e.message : "Error al rastrear"); setTrackResult(null); }
    finally { setTracking(false); }
  };

  const doQuickSearch = async () => {
    if (!quickSearch.trim()) return;
    setQuickSearching(true); setQuickError(null); setQuickResult(null);
    try {
      const result = await apiFetch<TrackResult>(`/flights/track?flightNumber=${encodeURIComponent(quickSearch.trim().toUpperCase())}`);
      setQuickResult(result);
    } catch (e) { setQuickError(e instanceof Error ? e.message : "Vuelo no encontrado"); }
    finally { setQuickSearching(false); }
  };

  const openTrack = (f: Flight) => {
    setTrackModal({ flight: f }); setTrackResult(null); setTrackError(null); setAutoRefresh(false);
    doTrack(f);
  };

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    let arrived = 0, todayCount = 0, upcoming = 0, totalPax = 0;
    flightPassengers.forEach(({ flight, passengers }) => {
      const d = flight.arrivalTime ? new Date(flight.arrivalTime) : null;
      if (d && d.getTime() < Date.now() && d.toDateString() !== today) arrived++;
      else if (d && d.toDateString() === today) todayCount++;
      else upcoming++;
      totalPax += passengers.length;
    });
    return { total: flightPassengers.length, arrived, today: todayCount, upcoming, totalPax };
  }, [flightPassengers]);

  const pal = {
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(15,23,42,0.06)",
    textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
  };

  const activeFilters = [searchQuery, filterDate, filterDelegation, filterStatus].filter(Boolean).length;

  const getFlightStatus = (arrivalTime: string) => {
    const arrDate = new Date(arrivalTime);
    const isPast = arrDate.getTime() < Date.now();
    const isToday = arrDate.toDateString() === new Date().toDateString();
    if (isPast && !isToday) return { label: "Arribado", color: "#64748b", bg: "rgba(100,116,139,0.08)" };
    if (isToday) return { label: "Hoy", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
    return { label: "Programado", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" };
  };

  const getPassengerDelegations = (passengers: AthleteItem[]) => {
    const delegationIds = [...new Set(passengers.map(p => p.delegationId).filter(Boolean))];
    return delegationIds.map(id => delegationById[id!]?.countryCode || "").filter(Boolean);
  };

  const getPassengerDisciplines = (passengers: AthleteItem[]) => {
    const discIds = [...new Set(passengers.map(p => p.disciplineId).filter(Boolean))];
    return discIds.map(id => {
      const d = disciplineById[id!];
      if (!d) return "";
      const parent = d.parentId ? disciplineById[d.parentId] : null;
      return parent ? parent.name : d.name;
    }).filter(Boolean) as string[];
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section style={{ background: "#ffffff", borderRadius: "24px", padding: "28px 32px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", borderTop: "3px solid #21D0B3" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l5.4 3.1-3 3-1.7-.5c-.3-.1-.7 0-.9.2l-.3.3c-.2.3-.1.7.1.9l2.8 2.1 2.1 2.8c.2.3.6.4.9.1l.3-.3c.2-.2.3-.6.2-.9l-.5-1.7 3-3 3.1 5.4c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Operaciones aéreas</p>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: pal.textPrimary, lineHeight: 1.1 }}>Monitor de vuelos</h1>
            <p style={{ fontSize: "13px", color: pal.textMuted, marginTop: "4px" }}>Seguimiento en tiempo real · AviationStack</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <select className="input" style={{ width: "200px", borderRadius: "12px" }} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              <option value="">Todos los eventos</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
            </select>
            <button onClick={() => { setModal(true); setForm(EMPTY_FORM); setFormError(null); }}
              style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(33,208,179,0.4)", display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar vuelo
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginTop: "20px" }}>
          {[
            { label: "Total vuelos", value: stats.total, color: pal.textPrimary, accent: "#64748b" },
            { label: "Arribados", value: stats.arrived, color: "#64748b", accent: "#64748b" },
            { label: "Hoy", value: stats.today, color: "#f59e0b", accent: "#f59e0b" },
            { label: "Próximos", value: stats.upcoming, color: "#3b82f6", accent: "#3b82f6" },
            { label: "Pasajeros AND", value: stats.totalPax, color: "#21D0B3", accent: "#21D0B3" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: "14px", padding: "12px 14px", border: "1px solid #e2e8f0", borderTop: `2px solid ${k.accent}` }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{k.label}</p>
              <p style={{ fontSize: "22px", fontWeight: 800, color: k.color, marginTop: "2px" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick flight search */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "16px 20px", boxShadow: pal.shadow }}>
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", marginBottom: "8px" }}>Búsqueda rápida de vuelo</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input className="input flex-1" placeholder="Ingresa número de vuelo (ej: LA180, AV457)..." value={quickSearch}
            onChange={e => setQuickSearch(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && doQuickSearch()}
            style={{ borderRadius: "12px" }} />
          <button onClick={doQuickSearch} disabled={quickSearching || !quickSearch.trim()}
            style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: quickSearching ? 0.6 : 1 }}>
            {quickSearching ? "Buscando..." : "Buscar vuelo"}
          </button>
        </div>
        {quickError && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>{quickError}</p>}
        {quickResult && (
          <div style={{ marginTop: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px", fontWeight: 900, color: pal.textPrimary }}>{quickResult.flightNumber}</span>
                  <span style={{ fontSize: "12px", color: pal.textMuted }}>{quickResult.airlineName}</span>
                  {(() => { const st = statusStyle(quickResult.flightStatus); return (
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "99px", background: st.bg, color: st.color, border: `1px solid ${st.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {st.pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                      {st.label}
                    </span>
                  ); })()}
                </div>
                <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "12px", color: pal.textMuted }}>
                  <span><b style={{ color: pal.textPrimary }}>{quickResult.depIata || "—"}</b> {quickResult.depCity || quickResult.depAirport || ""} → <b style={{ color: pal.textPrimary }}>{quickResult.arrIata || "—"}</b> {quickResult.arrCity || quickResult.arrAirport || ""}</span>
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "6px", fontSize: "12px" }}>
                  {quickResult.depScheduled && <span style={{ color: pal.textMuted }}>Sale: <b style={{ color: pal.textPrimary }}>{fmtTime(quickResult.depScheduled)}</b></span>}
                  {quickResult.arrScheduled && <span style={{ color: pal.textMuted }}>Llega: <b style={{ color: "#21D0B3" }}>{fmtTime(quickResult.arrScheduled)}</b></span>}
                  {quickResult.flightDate && <span style={{ color: pal.textMuted }}>Fecha: {quickResult.flightDate}</span>}
                  {(quickResult.arrDelayMinutes ?? 0) > 0 && <span style={{ color: "#f59e0b", fontWeight: 700 }}>{quickResult.arrDelayMinutes} min retraso</span>}
                </div>
              </div>
              <button onClick={() => { setQuickResult(null); setQuickSearch(""); }} style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "11px", color: pal.textMuted, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        )}
      </section>

      {/* Filters */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "12px 16px", boxShadow: pal.shadow, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input className="input" style={{ paddingLeft: "32px", borderRadius: "10px", width: "100%" }} placeholder="Buscar vuelo, aerolínea u origen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <input className="input" type="date" style={{ borderRadius: "10px", width: "160px" }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <select className="input" style={{ borderRadius: "10px", width: "160px" }} value={filterDelegation} onChange={e => setFilterDelegation(e.target.value)}>
          <option value="">Delegación</option>
          {delegations.filter(d => selectedEventId ? d.eventId === selectedEventId : true).map(d => (
            <option key={d.id} value={d.id}>{d.countryCode || d.id}</option>
          ))}
        </select>
        <select className="input" style={{ borderRadius: "10px", width: "140px" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Estado</option>
          <option value="arrived">Arribado</option>
          <option value="today">Hoy</option>
          <option value="upcoming">Programado</option>
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setSearchQuery(""); setFilterDate(""); setFilterDelegation(""); setFilterStatus(""); }}
            style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Limpiar ({activeFilters})
          </button>
        )}
      </section>

      {/* Flight list */}
      {loading ? (
        <div style={{ background: "#fff", borderRadius: "18px", padding: "40px", textAlign: "center", color: pal.labelColor, fontSize: "13px" }}>
          <div style={{ width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "#21D0B3", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          Cargando vuelos...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : finalFlights.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", padding: "40px", textAlign: "center" }}>
          <svg style={{ margin: "0 auto 12px", opacity: 0.3 }} width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l5.4 3.1-3 3-1.7-.5c-.3-.1-.7 0-.9.2l-.3.3c-.2.3-.1.7.1.9l2.8 2.1 2.1 2.8c.2.3.6.4.9.1l.3-.3c.2-.2.3-.6.2-.9l-.5-1.7 3-3 3.1 5.4c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
          <p style={{ fontSize: "14px", fontWeight: 600, color: pal.textPrimary }}>{flights.length === 0 ? "No hay vuelos registrados" : "Sin resultados"}</p>
          <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "4px" }}>{flights.length === 0 ? "Agrega un vuelo o usa la búsqueda rápida." : "Ajusta los filtros de búsqueda."}</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: pal.shadow }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#fafbfc" }}>
                {["", "Vuelo", "Aerolínea", "Ruta", "Llegada", "Estado", "Delegaciones", "Pax", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalFlights.map(({ flight, passengers }) => {
                const st = getFlightStatus(flight.arrivalTime);
                const delegationCodes = getPassengerDelegations(passengers);
                const discNames = getPassengerDisciplines(passengers);
                const isExpanded = expandedFlightId === flight.id;
                return (
                  <>
                  <tr key={flight.id} style={{ borderBottom: isExpanded ? "none" : "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => setExpandedFlightId(isExpanded ? null : flight.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fafbfc"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ padding: "10px 8px 10px 14px", width: "24px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}><polyline points="9 18 15 12 9 6"/></svg>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: pal.textPrimary, letterSpacing: "0.03em" }}>{flight.flightNumber}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: pal.textMuted, fontWeight: 500 }}>{flight.airline}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: pal.textPrimary }}>{flight.origin}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" style={{ margin: "0 6px", verticalAlign: "middle" }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      <span style={{ color: pal.textMuted }}>Destino</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div><span style={{ fontWeight: 700, color: pal.textPrimary }}>{fmtTime(flight.arrivalTime)}</span></div>
                      <div style={{ fontSize: "10px", color: pal.textMuted }}>{fmtDate(flight.arrivalTime)}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {delegationCodes.slice(0, 3).map(code => (
                          <span key={code} style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.15)" }}>{code}</span>
                        ))}
                        {delegationCodes.length > 3 && <span style={{ fontSize: "9px", color: pal.labelColor }}>+{delegationCodes.length - 3}</span>}
                        {delegationCodes.length === 0 && <span style={{ fontSize: "10px", color: "#cbd5e1" }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: passengers.length > 0 ? "#21D0B3" : "#cbd5e1" }}>{passengers.length}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button onClick={() => openTrack(flight)} style={{ padding: "5px 12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#21D0B3,#14AE98)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Rastrear</button>
                        <button onClick={() => setDeleteConfirm(flight)} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fff", color: "#f43f5e", cursor: "pointer" }}>
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr key={`${flight.id}-detail`}>
                      <td colSpan={9} style={{ padding: "0 14px 14px", background: "#fafbfc", borderBottom: "1px solid #e2e8f0" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "14px 0" }}>
                          {/* Passengers */}
                          <div>
                            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "8px" }}>Pasajeros AND ({passengers.length})</p>
                            {passengers.length === 0 ? (
                              <p style={{ fontSize: "12px", color: pal.labelColor }}>No hay pasajeros vinculados a este vuelo</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                                {passengers.map(p => {
                                  const del = p.delegationId ? delegationById[p.delegationId] : null;
                                  const disc = p.disciplineId ? disciplineById[p.disciplineId] : null;
                                  const parentDisc = disc?.parentId ? disciplineById[disc.parentId] : null;
                                  return (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", padding: "4px 8px", borderRadius: "8px", background: "#fff", border: "1px solid #f1f5f9" }}>
                                      <span style={{ fontWeight: 600, color: pal.textPrimary, flex: 1 }}>{p.fullName || p.id}</span>
                                      {del && <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>{del.countryCode}</span>}
                                      {(parentDisc || disc) && <span style={{ fontSize: "9px", fontWeight: 600, padding: "1px 5px", borderRadius: "4px", background: "rgba(33,208,179,0.08)", color: "#0a7a6b" }}>{parentDisc?.name || disc?.name}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {/* Flight details */}
                          <div>
                            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#a78bfa", marginBottom: "8px" }}>Detalle del vuelo</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                              {[
                                { label: "Aerolínea", value: flight.airline },
                                { label: "Terminal", value: flight.terminal || "—" },
                                { label: "Origen", value: flight.origin },
                                { label: "Llegada", value: `${fmtTime(flight.arrivalTime)} · ${fmtDate(flight.arrivalTime)}` },
                              ].map(d => (
                                <div key={d.label} style={{ padding: "8px 10px", borderRadius: "10px", background: "#fff", border: "1px solid #f1f5f9" }}>
                                  <p style={{ fontSize: "9px", fontWeight: 700, color: pal.labelColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>{d.label}</p>
                                  <p style={{ fontSize: "12px", fontWeight: 600, color: pal.textPrimary, marginTop: "2px" }}>{d.value}</p>
                                </div>
                              ))}
                            </div>
                            {discNames.length > 0 && (
                              <div style={{ marginTop: "8px" }}>
                                <p style={{ fontSize: "9px", fontWeight: 700, color: pal.labelColor, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Disciplinas</p>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                  {discNames.map(name => (
                                    <span key={name} style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "rgba(33,208,179,0.08)", color: "#0a7a6b", border: "1px solid rgba(33,208,179,0.15)" }}>{name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add flight modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "440px", borderTop: "3px solid #21D0B3", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
            <div style={{ padding: "24px 24px 16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Nuevo</p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: pal.textPrimary }}>Agregar vuelo</h2>
            </div>
            <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                Evento
                <select className="input" style={{ borderRadius: "10px" }} value={form.eventId || selectedEventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">Selecciona evento</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                Número de vuelo *
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input flex-1" style={{ borderRadius: "10px" }} value={form.flightNumber} placeholder="ej: LA180"
                    onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value.toUpperCase() }))} />
                  <button type="button" onClick={() => lookupAirline(form.flightNumber)} disabled={lookingUp || !form.flightNumber.trim()}
                    style={{ padding: "0 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer", opacity: lookingUp ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {lookingUp ? "..." : "Auto"}
                  </button>
                </div>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                  Aerolínea *
                  <input className="input" style={{ borderRadius: "10px" }} value={form.airline} placeholder="ej: LATAM" onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                  Terminal
                  <input className="input" style={{ borderRadius: "10px" }} value={form.terminal} placeholder="ej: 2" onChange={e => setForm(f => ({ ...f, terminal: e.target.value }))} />
                </label>
              </div>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                Origen *
                <input className="input" style={{ borderRadius: "10px" }} value={form.origin} placeholder="ej: Buenos Aires, ARG" onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
              </label>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                Hora de llegada *
                <input className="input" style={{ borderRadius: "10px" }} type="datetime-local" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
              </label>
              {formError && <p style={{ fontSize: "12px", color: "#f43f5e" }}>{formError}</p>}
            </div>
            <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f1f5f9" }}>
              <button onClick={() => setModal(false)} disabled={saving} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: pal.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveFlightForm} disabled={saving} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track modal */}
      {trackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "560px", borderTop: "3px solid #21D0B3", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "24px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Rastreo en vivo</p>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: pal.textPrimary }}>
                  {trackModal.flight.flightNumber}
                  {trackResult?.airlineName && <span style={{ fontSize: "13px", fontWeight: 500, color: pal.textMuted, marginLeft: "8px" }}>{trackResult.airlineName}</span>}
                </h2>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: pal.textMuted, cursor: "pointer" }}>
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto 30s
                </label>
                <button onClick={() => doTrack(trackModal.flight)} disabled={tracking}
                  style={{ padding: "6px 14px", borderRadius: "99px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: tracking ? "not-allowed" : "pointer", opacity: tracking ? 0.6 : 1 }}>
                  {tracking ? "..." : "↻"}
                </button>
                <button onClick={() => { setTrackModal(null); setAutoRefresh(false); }}
                  style={{ padding: "6px 12px", borderRadius: "99px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "13px", color: pal.textMuted, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "0 24px 24px", flex: 1 }}>
              {tracking && !trackResult && (
                <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: pal.labelColor }}>Consultando AviationStack...</div>
              )}
              {trackError && (
                <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px" }}>{trackError}</div>
              )}
              {trackResult && (() => {
                const st = statusStyle(trackResult.flightStatus);
                const hasDelay = (trackResult.arrDelayMinutes ?? 0) > 0 || (trackResult.depDelayMinutes ?? 0) > 0;
                return (
                  <div className="space-y-4">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "16px", background: st.bg, border: `1px solid ${st.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {st.pulse && <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: st.color, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                        <span style={{ fontSize: "15px", fontWeight: 800, color: st.color }}>{st.label}</span>
                      </div>
                      {trackResult.flightDate && <span style={{ fontSize: "12px", color: pal.textMuted }}>Fecha: {trackResult.flightDate}</span>}
                      {hasDelay && (
                        <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "99px", padding: "3px 10px" }}>
                          {Math.max(trackResult.depDelayMinutes ?? 0, trackResult.arrDelayMinutes ?? 0)} min retraso
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: "8px", alignItems: "center" }}>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor, marginBottom: "4px" }}>Salida</p>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.06em" }}>{trackResult.depIata ?? "—"}</p>
                        <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>{trackResult.depCity ?? trackResult.depAirport ?? "—"}</p>
                        <div style={{ marginTop: "10px", fontSize: "12px", color: pal.textMuted, display: "flex", flexDirection: "column", gap: "3px" }}>
                          {trackResult.depScheduled && <p>Prog: <span style={{ fontWeight: 600, color: pal.textPrimary }}>{fmtTime(trackResult.depScheduled)}</span></p>}
                          {trackResult.depActual && <p>Real: <span style={{ fontWeight: 700, color: "#21D0B3" }}>{fmtTime(trackResult.depActual)}</span></p>}
                          {trackResult.depGate && <p>Puerta: <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.depGate}</span></p>}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      </div>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor, marginBottom: "4px" }}>Llegada</p>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.06em" }}>{trackResult.arrIata ?? "—"}</p>
                        <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>{trackResult.arrCity ?? trackResult.arrAirport ?? "—"}</p>
                        <div style={{ marginTop: "10px", fontSize: "12px", color: pal.textMuted, display: "flex", flexDirection: "column", gap: "3px" }}>
                          {trackResult.arrScheduled && <p>Prog: <span style={{ fontWeight: 600, color: pal.textPrimary }}>{fmtTime(trackResult.arrScheduled)}</span></p>}
                          {trackResult.arrEstimated && <p>Est: <span style={{ fontWeight: 700, color: "#3b82f6" }}>{fmtTime(trackResult.arrEstimated)}</span></p>}
                          {trackResult.arrActual && <p>Real: <span style={{ fontWeight: 700, color: "#21D0B3" }}>{fmtTime(trackResult.arrActual)}</span></p>}
                          {trackResult.arrBaggage && <p>Cinta: <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.arrBaggage}</span></p>}
                        </div>
                      </div>
                    </div>
                    {trackResult.liveLatitude !== null && (
                      <div style={{ background: "rgba(33,208,179,0.06)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "10px" }}>Posición en vivo</p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {[
                            { label: "Altitud", value: trackResult.liveAltitude ? `${trackResult.liveAltitude.toLocaleString()} m` : "—" },
                            { label: "Velocidad", value: trackResult.liveSpeedHorizontal ? `${Math.round(trackResult.liveSpeedHorizontal)} km/h` : "—" },
                            { label: "Lat", value: trackResult.liveLatitude?.toFixed(3) ?? "—" },
                            { label: "Lon", value: trackResult.liveLongitude?.toFixed(3) ?? "—" },
                          ].map(item => (
                            <div key={item.label}>
                              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#21D0B3" }}>{item.label}</p>
                              <p style={{ fontSize: "15px", fontWeight: 700, color: pal.textPrimary, marginTop: "2px" }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {trackResult.liveIsGround && <p style={{ marginTop: "8px", fontSize: "12px", fontWeight: 600, color: "#f59e0b" }}>Aeronave en tierra</p>}
                        {trackResult.liveUpdated && <p style={{ marginTop: "6px", fontSize: "11px", color: pal.labelColor }}>Última actualización: {new Date(trackResult.liveUpdated).toLocaleTimeString("es-CL")}</p>}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "380px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: pal.textPrimary, margin: "0 0 6px" }}>Eliminar vuelo</h3>
            <p style={{ fontSize: "13px", color: pal.textMuted, margin: "0 0 20px" }}>
              ¿Estás seguro de eliminar el vuelo <b style={{ color: pal.textPrimary }}>{deleteConfirm.flightNumber}</b> ({deleteConfirm.airline})? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: pal.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => removeFlight(deleteConfirm)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(239,68,68,0.3)" }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
