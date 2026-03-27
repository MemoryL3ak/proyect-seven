"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

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

type AthleteItem = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");

  // Add flight modal
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Track modal
  const [trackModal, setTrackModal] = useState<{ flight: Flight } | null>(null);
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [flightData, eventData, athleteData] = await Promise.all([
        apiFetch<Flight[]>("/flights"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<AthleteItem[]>("/athletes"),
      ]);
      setFlights(flightData ?? []);
      setEvents(eventData ?? []);
      setAthletes(athleteData ?? []);
      if (!selectedEventId && eventData?.length) setSelectedEventId(eventData[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh track
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    if (autoRefresh && trackModal) {
      refreshTimer.current = setInterval(() => doTrack(trackModal.flight), 30000);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [autoRefresh, trackModal]);

  const filteredFlights = useMemo(() =>
    flights.filter(f => !selectedEventId || f.eventId === selectedEventId),
    [flights, selectedEventId]
  );

  // Athletes with arrival flight info from metadata
  const flightPassengers = useMemo(() => {
    return filteredFlights.map(f => {
      const passengers = athletes.filter(a => {
        const m = a.metadata;
        if (!m) return false;
        const fn = String(m.vuelo_llegada ?? m.vuelo_salida ?? "").replace(/\s+/g, "").toUpperCase();
        return fn === f.flightNumber.replace(/\s+/g, "").toUpperCase();
      });
      return { flight: f, passengers };
    });
  }, [filteredFlights, athletes]);

  const lookupAirline = async (flightNum: string) => {
    if (!flightNum.trim()) return;
    setLookingUp(true);
    try {
      const data = await apiFetch<{ airlineName: string; origin: string; departureGate: string }>(
        `/flights/lookup-airline?flightNumber=${encodeURIComponent(flightNum.trim())}`
      );
      setForm(f => ({
        ...f,
        airline: data.airlineName || f.airline,
        origin: data.origin || f.origin,
      }));
    } catch { /* silent */ } finally {
      setLookingUp(false);
    }
  };

  const saveFlightForm = async () => {
    if (!form.flightNumber.trim()) { setFormError("El número de vuelo es requerido."); return; }
    if (!form.airline.trim()) { setFormError("La aerolínea es requerida."); return; }
    if (!form.arrivalTime) { setFormError("La hora de llegada es requerida."); return; }
    if (!form.origin.trim()) { setFormError("El origen es requerido."); return; }
    const eventId = form.eventId || selectedEventId;
    if (!eventId) { setFormError("Selecciona un evento."); return; }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          flightNumber: form.flightNumber.trim().toUpperCase(),
          airline: form.airline.trim(),
          arrivalTime: new Date(form.arrivalTime).toISOString(),
          origin: form.origin.trim(),
          terminal: form.terminal || null,
        }),
      });
      setModal(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeFlight = async (f: Flight) => {
    if (!confirm(`¿Eliminar vuelo ${f.flightNumber}?`)) return;
    try {
      await apiFetch(`/flights/${f.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const doTrack = async (f: Flight) => {
    setTracking(true);
    setTrackError(null);
    try {
      const result = await apiFetch<TrackResult>(`/flights/track?flightNumber=${encodeURIComponent(f.flightNumber)}`);
      setTrackResult(result);
    } catch (e) {
      setTrackError(e instanceof Error ? e.message : "Error al rastrear");
      setTrackResult(null);
    } finally {
      setTracking(false);
    }
  };

  const openTrack = (f: Flight) => {
    setTrackModal({ flight: f });
    setTrackResult(null);
    setTrackError(null);
    setAutoRefresh(false);
    doTrack(f);
  };

  const pal = {
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(15,23,42,0.06)",
    textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderTop: "2px solid #21D0B3", boxShadow: pal.shadow }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Operaciones</p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: pal.textPrimary, lineHeight: 1.1 }}>Monitor de vuelos</h1>
          <p style={{ fontSize: "13px", color: pal.textMuted, marginTop: "4px" }}>Seguimiento en tiempo real vía AviationStack</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select className="input w-52" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
            <option value="">Todos los eventos</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setModal(true); setForm(EMPTY_FORM); setFormError(null); }}>
            + Agregar vuelo
          </button>
        </div>
      </section>

      {/* Flight cards */}
      {loading ? (
        <div className="surface rounded-2xl p-8 text-center text-sm" style={{ color: pal.labelColor }}>Cargando vuelos…</div>
      ) : filteredFlights.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-sm" style={{ color: pal.labelColor }}>
          No hay vuelos registrados. Agrega uno para comenzar a monitorear.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flightPassengers.map(({ flight, passengers }) => (
            <article key={flight.id} style={{
              background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
              borderTop: "3px solid #21D0B3", borderRadius: "20px", padding: "18px 20px",
              boxShadow: pal.shadow, display: "flex", flexDirection: "column", gap: "12px",
            }}>
              {/* Flight number + airline */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.04em", lineHeight: 1 }}>{flight.flightNumber}</p>
                  <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "3px" }}>{flight.airline}</p>
                </div>
                {/* Passenger badge */}
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: passengers.length > 0 ? "rgba(33,208,179,0.1)" : "#f1f5f9", border: `1px solid ${passengers.length > 0 ? "rgba(33,208,179,0.3)" : "#e2e8f0"}`, color: passengers.length > 0 ? "#21D0B3" : pal.labelColor, flexShrink: 0 }}>
                  {passengers.length} pax AND
                </span>
              </div>

              {/* Route */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: pal.textMuted }}>
                <span style={{ fontWeight: 600, color: pal.textPrimary }}>{flight.origin}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
                <span>Llegada</span>
              </div>

              {/* Time + terminal */}
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>Llegada estimada</p>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: "#21D0B3", lineHeight: 1.2, marginTop: "3px" }}>
                    {fmtTime(flight.arrivalTime)}
                  </p>
                  <p style={{ fontSize: "11px", color: pal.textMuted }}>{fmtDate(flight.arrivalTime)}</p>
                </div>
                {flight.terminal && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px", textAlign: "center" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>Terminal</p>
                    <p style={{ fontSize: "20px", fontWeight: 800, color: pal.textPrimary, lineHeight: 1.2, marginTop: "3px" }}>{flight.terminal}</p>
                  </div>
                )}
              </div>

              {/* Passengers preview */}
              {passengers.length > 0 && (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.labelColor, marginBottom: "6px" }}>Pasajeros AND</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {passengers.slice(0, 4).map(p => (
                      <p key={p.id} style={{ fontSize: "12px", color: pal.textMuted }}>• {p.fullName || p.id}</p>
                    ))}
                    {passengers.length > 4 && (
                      <p style={{ fontSize: "11px", color: "#21D0B3", fontWeight: 600 }}>+{passengers.length - 4} más</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => openTrack(flight)}
                  style={{ flex: 1, background: "linear-gradient(135deg, #21D0B3, #14AE98)", border: "none", borderRadius: "10px", padding: "9px 0", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                  Rastrear ahora
                </button>
                <button onClick={() => removeFlight(flight)}
                  style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#f43f5e", cursor: "pointer" }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add flight modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface rounded-3xl w-full max-w-md flex flex-col" style={{ borderTop: "2px solid #21D0B3", boxShadow: "0 8px 32px rgba(15,23,42,0.18)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Nuevo</p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: pal.textPrimary }}>Agregar vuelo</h2>
            </div>
            <div className="overflow-y-auto px-6 pb-2 flex-1 space-y-4">
              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                Evento
                <select className="input" value={form.eventId || selectedEventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">Selecciona evento</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                Número de vuelo *
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input flex-1" value={form.flightNumber} placeholder="ej: LA800"
                    onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value.toUpperCase() }))} />
                  <button type="button" onClick={() => lookupAirline(form.flightNumber)} disabled={lookingUp || !form.flightNumber.trim()}
                    style={{ padding: "0 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer", opacity: lookingUp ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {lookingUp ? "Buscando…" : "Auto-completar"}
                  </button>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                  Aerolínea *
                  <input className="input" value={form.airline} placeholder="ej: LATAM" onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                  Terminal
                  <input className="input" value={form.terminal} placeholder="ej: 2" onChange={e => setForm(f => ({ ...f, terminal: e.target.value }))} />
                </label>
              </div>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                Origen *
                <input className="input" value={form.origin} placeholder="ej: Buenos Aires, ARG" onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
              </label>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor }}>
                Hora de llegada *
                <input className="input" type="datetime-local" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
              </label>

              {formError && <p className="text-sm" style={{ color: "#f43f5e" }}>{formError}</p>}
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveFlightForm} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track modal */}
      {trackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface rounded-3xl w-full max-w-xl flex flex-col" style={{ borderTop: "3px solid #21D0B3", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", maxHeight: "90vh" }}>
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0 flex items-start justify-between gap-3">
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Rastreo en vivo</p>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: pal.textPrimary }}>
                  {trackModal.flight.flightNumber}
                  {trackResult?.airlineName && <span style={{ fontSize: "13px", fontWeight: 500, color: pal.textMuted, marginLeft: "8px" }}>{trackResult.airlineName}</span>}
                </h2>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: pal.textMuted, cursor: "pointer" }}>
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                  Auto 30s
                </label>
                <button onClick={() => doTrack(trackModal.flight)} disabled={tracking}
                  style={{ padding: "6px 14px", borderRadius: "99px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: tracking ? "not-allowed" : "pointer", opacity: tracking ? 0.6 : 1 }}>
                  {tracking ? "Actualizando…" : "↻ Refrescar"}
                </button>
                <button onClick={() => { setTrackModal(null); setAutoRefresh(false); }}
                  style={{ padding: "6px 12px", borderRadius: "99px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "13px", color: pal.textMuted, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-6 flex-1">
              {tracking && !trackResult && (
                <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: pal.labelColor }}>Consultando AviationStack…</div>
              )}
              {trackError && (
                <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px" }}>
                  {trackError}
                </div>
              )}

              {trackResult && (() => {
                const st = statusStyle(trackResult.flightStatus);
                const hasDelay = (trackResult.arrDelayMinutes ?? 0) > 0 || (trackResult.depDelayMinutes ?? 0) > 0;
                return (
                  <div className="space-y-4">
                    {/* Status badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "16px", background: st.bg, border: `1px solid ${st.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {st.pulse && <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: st.color, flexShrink: 0, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                        <span style={{ fontSize: "15px", fontWeight: 800, color: st.color }}>{st.label}</span>
                      </div>
                      {trackResult.flightDate && <span style={{ fontSize: "12px", color: pal.textMuted }}>Fecha: {trackResult.flightDate}</span>}
                      {hasDelay && (
                        <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "99px", padding: "3px 10px" }}>
                          {Math.max(trackResult.depDelayMinutes ?? 0, trackResult.arrDelayMinutes ?? 0)} min de retraso
                        </span>
                      )}
                    </div>

                    {/* Route */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: "8px", alignItems: "center" }}>
                      {/* Departure */}
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
                      {/* Arrow */}
                      <div style={{ textAlign: "center" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth={2.5} strokeLinecap="round">
                          <path d="M5 12h14M13 6l6 6-6 6"/>
                        </svg>
                      </div>
                      {/* Arrival */}
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

                    {/* Live position */}
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
                        {trackResult.liveIsGround && (
                          <p style={{ marginTop: "8px", fontSize: "12px", fontWeight: 600, color: "#f59e0b" }}>⚠ Aeronave en tierra</p>
                        )}
                        {trackResult.liveUpdated && (
                          <p style={{ marginTop: "6px", fontSize: "11px", color: pal.labelColor }}>Última actualización: {new Date(trackResult.liveUpdated).toLocaleTimeString("es-CL")}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
