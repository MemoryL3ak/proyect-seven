"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AirlineLogo from "@/components/AirlineLogo";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import {
  RefreshIcon,
  PlaneIcon,
  XIcon,
  PlusIcon,
  SearchIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
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

type TripItem = {
  id: string;
  eventId?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  flightNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TrackResult = {
  flightNumber: string;
  airlineName: string | null;
  airlineIata?: string | null;
  provider?: "aerodatabox" | "aviationstack" | null;
  flightStatus: string | null;
  flightDate: string | null;
  requestedDate?: string | null;
  depTimezone?: string | null;
  arrTimezone?: string | null;
  depTerminal?: string | null;
  arrTerminal?: string | null;
  depCheckInDesk?: string | null;
  aircraftModel?: string | null;
  aircraftReg?: string | null;
  depAirport: string | null;
  depIata: string | null;
  depCity: string | null;
  depScheduled: string | null;
  depEstimated?: string | null;
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
  scheduled:  { label: "Programado",  color: STATE.info, bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)",  pulse: false },
  boarding:   { label: "Embarcando",  color: ACCENT.violetLight, bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)",  pulse: true  },
  active:     { label: "En vuelo",    color: STATE.success, bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  pulse: true  },
  approaching:{ label: "Aproximando", color: STATE.success, bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  pulse: true  },
  delayed:    { label: "Retrasado",   color: STATE.warning, bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  pulse: false },
  landed:     { label: "Aterrizó",    color: BRAND.teal, bg: "rgba(33,208,179,0.1)",  border: "rgba(33,208,179,0.3)",  pulse: false },
  cancelled:  { label: "Cancelado",   color: STATE.danger, bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   pulse: false },
  diverted:   { label: "Desviado",    color: STATE.warning, bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  pulse: false },
  incident:   { label: "Incidente",   color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  pulse: false },
};

function statusStyle(status?: string | null) {
  return STATUS_CONFIG[status?.toLowerCase() ?? ""] ?? {
    label: status ?? "Desconocido", color: SURFACE.textFaint,
    bg: SURFACE.borderMuted, border: SURFACE.border, pulse: false,
  };
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// AviationStack devuelve la hora local de cada aeropuerto con un offset
// "+00:00" que no corresponde a esa hora. Si la convirtiéramos con Date() el
// navegador la desplazaría según su zona horaria (en Chile, -4h). Por eso
// leemos la hora literal del string en vez de reinterpretarla.
function fmtAirportTime(iso?: string | null) {
  if (!iso) return "—";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : fmtTime(iso);
}

/** "America/Santiago" → "Santiago" */
function tzCity(tz?: string | null) {
  return tz ? tz.split("/").pop()?.replace(/_/g, " ") ?? "" : "";
}

function fmtLongDate(date?: string | null) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Duración del vuelo. Sólo se puede calcular cuando los horarios traen el
 * offset real de cada aeropuerto (AeroDataBox); con AviationStack el offset es
 * siempre "+00:00" y la resta daría un valor falso, así que no la mostramos.
 */
function flightDuration(r: TrackResult) {
  if (r.provider !== "aerodatabox" || !r.depScheduled || !r.arrScheduled) return null;
  const mins = Math.round((new Date(r.arrScheduled).getTime() - new Date(r.depScheduled).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m ? `${m}min` : ""}`.trim() : `${m}min`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = { flightNumber: "", airline: "", arrivalTime: "", origin: "", terminal: "", eventId: "" };

export default function FlightsPage() {
  const { t } = useI18n();
  // Layout inline: en teléfono se apilan las grillas y se achican los paddings.
  const isMobile = useIsMobile();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [transferInTrips, setTransferInTrips] = useState<TripItem[]>([]);
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
      const [flightData, eventData, athleteData, delegationData, disciplineData, tripData] = await Promise.all([
        apiFetch<Flight[]>("/flights"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<AthleteItem[]>("/athletes"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<DisciplineItem[]>("/disciplines"),
        apiFetch<TripItem[]>("/trips").catch(() => []),
      ]);
      setFlights(flightData ?? []);
      setEvents(eventData ?? []);
      setAthletes(filterValidatedAthletes(athleteData ?? []));
      // Viajes Transfer In (aeropuerto → hotel/sede): son llegadas a monitorear.
      setTransferInTrips(
        (tripData ?? []).filter(
          (t) => String(t.tripType || "").toUpperCase() === "TRANSFER_IN" && t.status !== "CANCELLED",
        ),
      );
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

  const athleteById = useMemo(() => athletes.reduce<Record<string, AthleteItem>>((acc, a) => { acc[a.id] = a; return acc; }, {}), [athletes]);

  // Transfer In visibles: respetan evento, búsqueda y fecha del monitor.
  const displayTransferIns = useMemo(() =>
    transferInTrips
      .filter(t => {
        if (selectedEventId && t.eventId !== selectedEventId) return false;
        const requester = t.requesterAthleteId ? athleteById[t.requesterAthleteId] : null;
        const flight = t.flightNumber || String((t.metadata as Record<string, unknown> | null)?.flightNumber ?? "");
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const haystack = [requester?.fullName, t.destination, t.origin, flight, t.clientType].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filterDate) {
          const day = t.scheduledAt ? new Date(t.scheduledAt).toISOString().slice(0, 10) : "";
          if (day !== filterDate) return false;
        }
        if (filterDelegation) {
          if (!requester || requester.delegationId !== filterDelegation) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      }),
    [transferInTrips, selectedEventId, searchQuery, filterDate, filterDelegation, athleteById]
  );

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
    if (!form.flightNumber.trim()) { setFormError(t("El número de vuelo es requerido.")); return; }
    if (!form.airline.trim()) { setFormError(t("La aerolínea es requerida.")); return; }
    if (!form.arrivalTime) { setFormError(t("La hora de llegada es requerida.")); return; }
    if (!form.origin.trim()) { setFormError(t("El origen es requerido.")); return; }
    const eventId = form.eventId || selectedEventId;
    if (!eventId) { setFormError(t("Selecciona un evento.")); return; }
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
    } catch (e) { setFormError(e instanceof Error ? e.message : t("Error al guardar")); }
    finally { setSaving(false); }
  };

  const removeFlight = async (f: Flight) => {
    try { await apiFetch(`/flights/${f.id}`, { method: "DELETE" }); setDeleteConfirm(null); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : t("Error al eliminar")); }
  };

  const doTrack = async (f: Flight) => {
    setTracking(true); setTrackError(null);
    try {
      const flightDate = f.arrivalTime ? new Date(f.arrivalTime).toISOString().slice(0, 10) : "";
      const dateParam = flightDate ? `&flightDate=${flightDate}` : "";
      const result = await apiFetch<TrackResult>(`/flights/track?flightNumber=${encodeURIComponent(f.flightNumber)}${dateParam}`);
      setTrackResult(result);
    } catch (e) { setTrackError(e instanceof Error ? e.message : t("Error al rastrear")); setTrackResult(null); }
    finally { setTracking(false); }
  };

  const doQuickSearch = async () => {
    if (!quickSearch.trim()) return;
    setQuickSearching(true); setQuickError(null); setQuickResult(null);
    try {
      const result = await apiFetch<TrackResult>(`/flights/track?flightNumber=${encodeURIComponent(quickSearch.trim().toUpperCase())}`);
      setQuickResult(result);
    } catch (e) { setQuickError(e instanceof Error ? e.message : t("Vuelo no encontrado")); }
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
    cardBg: SURFACE.card, cardBorder: SURFACE.border, shadow: "0 1px 4px rgba(15,23,42,0.06)",
    textPrimary: SURFACE.text, textMuted: SURFACE.textMuted, labelColor: SURFACE.textFaint,
  };

  const activeFilters = [searchQuery, filterDate, filterDelegation, filterStatus].filter(Boolean).length;

  const getFlightStatus = (arrivalTime: string) => {
    const arrDate = new Date(arrivalTime);
    const isPast = arrDate.getTime() < Date.now();
    const isToday = arrDate.toDateString() === new Date().toDateString();
    if (isPast && !isToday) return { label: "Arribado", color: SURFACE.textMuted, bg: "rgba(100,116,139,0.08)" };
    if (isToday) return { label: "Hoy", color: STATE.warning, bg: "rgba(245,158,11,0.08)" };
    return { label: "Programado", color: STATE.info, bg: "rgba(59,130,246,0.08)" };
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
      <section style={{ background: SURFACE.card, borderRadius: "24px", padding: isMobile ? "16px" : "28px 32px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", borderTop: `3px solid ${BRAND.teal}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          {/* En el teléfono la barra superior ya dice "Vuelos": la cabecera
              se reduce a una línea. */}
          <div style={{ minWidth: 0 }}>
            {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <PlaneIcon size={20} color={BRAND.teal} strokeWidth={2} />
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.teal }}>{t("Operaciones aéreas")}</p>
            </div>
            )}
            <h1 style={{ fontSize: isMobile ? "1.15rem" : "1.75rem", fontWeight: 800, color: pal.textPrimary, lineHeight: 1.1 }}>{t("Monitor de vuelos")}</h1>
            <p style={{ fontSize: isMobile ? "12px" : "13px", color: pal.textMuted, marginTop: "4px" }}>{t("Seguimiento en tiempo real · AviationStack")}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
            <select className="input" style={{ width: isMobile ? "100%" : "200px", borderRadius: "12px" }} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              <option value="">{t("Todos los eventos")}</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
            </select>
            <button onClick={() => { setModal(true); setForm(EMPTY_FORM); setFormError(null); }}
              style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(33,208,179,0.4)", display: "flex", alignItems: "center", gap: "6px" }}>
              <PlusIcon size={14} strokeWidth={2.5} />
              {t("Agregar vuelo")}
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className={isMobile ? "mobile-strip" : undefined} style={isMobile ? ({ "--strip-w": "140px", marginTop: 12, marginLeft: -14, marginRight: -14, paddingLeft: 14, paddingRight: 14 } as React.CSSProperties) : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginTop: "20px" }}>
          {[
            { label: "Total vuelos", value: stats.total, color: pal.textPrimary, accent: SURFACE.textMuted },
            { label: "Arribados", value: stats.arrived, color: SURFACE.textMuted, accent: SURFACE.textMuted },
            { label: "Hoy", value: stats.today, color: STATE.warning, accent: STATE.warning },
            { label: "Próximos", value: stats.upcoming, color: STATE.info, accent: STATE.info },
            { label: "Pasajeros AND", value: stats.totalPax, color: BRAND.teal, accent: BRAND.teal },
            { label: "Transfer In", value: transferInTrips.length, color: ACCENT.violetLight, accent: ACCENT.violetLight },
          ].map(k => (
            <div key={k.label} style={{ background: SURFACE.bg, borderRadius: "14px", padding: "12px 14px", border: `1px solid ${SURFACE.border}`, borderTop: `2px solid ${k.accent}` }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{t(k.label)}</p>
              <p style={{ fontSize: "22px", fontWeight: 800, color: k.color, marginTop: "2px" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick flight search */}
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "18px", padding: isMobile ? "14px" : "16px 20px", boxShadow: pal.shadow }}>
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT.violetLight, marginBottom: "8px" }}>{t("Búsqueda rápida de vuelo")}</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input className="input flex-1" placeholder={t("Ingresa número de vuelo (ej: LA180, AV457)...")} value={quickSearch}
            onChange={e => setQuickSearch(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && doQuickSearch()}
            style={{ borderRadius: "12px" }} />
          <button onClick={doQuickSearch} disabled={quickSearching || !quickSearch.trim()}
            style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg, ${ACCENT.violetLight}, ${ACCENT.violet})`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: quickSearching ? 0.6 : 1 }}>
            {quickSearching ? t("Buscando...") : t("Buscar vuelo")}
          </button>
        </div>
        {quickError && <p style={{ fontSize: "12px", color: STATE.danger, marginTop: "8px" }}>{quickError}</p>}
        {quickResult && (() => {
          const st = statusStyle(quickResult.flightStatus);
          const depReal = quickResult.depActual || quickResult.depEstimated;
          const arrReal = quickResult.arrActual || quickResult.arrEstimated;
          const depChanged = depReal ? fmtAirportTime(depReal) !== fmtAirportTime(quickResult.depScheduled) : false;
          const arrChanged = arrReal ? fmtAirportTime(arrReal) !== fmtAirportTime(quickResult.arrScheduled) : false;
          const duration = flightDuration(quickResult);
          const delay = quickResult.arrDelayMinutes ?? 0;

          const endpoint = (opts: {
            label: string; iata?: string | null; city?: string | null; airport?: string | null;
            scheduled?: string | null; real?: string | null; changed: boolean;
            terminal?: string | null; gate?: string | null; extra?: string | null;
            align: "left" | "right";
          }) => (
            <div style={{ textAlign: opts.align, minWidth: 0 }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{opts.label}</p>
              <p style={{ fontSize: "26px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.04em", lineHeight: 1.15 }}>{opts.iata || "—"}</p>
              <p style={{ fontSize: "12px", color: pal.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opts.city || opts.airport || ""}</p>
              <div style={{ marginTop: "6px", display: "flex", alignItems: "baseline", gap: "8px", justifyContent: opts.align === "right" ? "flex-end" : "flex-start", flexWrap: "wrap" }}>
                <span style={{ fontSize: "19px", fontWeight: 800, color: opts.changed ? pal.labelColor : pal.textPrimary, textDecoration: opts.changed ? "line-through" : "none" }}>
                  {fmtAirportTime(opts.scheduled)}
                </span>
                {opts.changed && <span style={{ fontSize: "19px", fontWeight: 900, color: STATE.warning }}>{fmtAirportTime(opts.real)}</span>}
              </div>
              <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "3px" }}>
                {[opts.terminal ? `${t("Terminal")} ${opts.terminal}` : null, opts.gate ? `${t("Puerta")} ${opts.gate}` : null, opts.extra].filter(Boolean).join(" · ") || " "}
              </p>
            </div>
          );

          return (
            <div style={{ marginTop: "12px", background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "16px", padding: "16px 18px", boxShadow: pal.shadow }}>
              {/* Encabezado: logo, vuelo, aerolínea y estado */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <AirlineLogo iata={quickResult.airlineIata} flightNumber={quickResult.flightNumber} name={quickResult.airlineName} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "19px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.02em" }}>{quickResult.flightNumber}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "99px", background: st.bg, color: st.color, border: `1px solid ${st.border}`, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      {st.pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                      {t(st.label)}
                    </span>
                    {delay > 0 && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "99px", background: "rgba(245,158,11,0.12)", color: STATE.warningText, border: "1px solid rgba(245,158,11,0.3)" }}>
                        {delay} {t("min de retraso")}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>
                    {[quickResult.airlineName, fmtLongDate(quickResult.flightDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button onClick={() => { setQuickResult(null); setQuickSearch(""); }}
                  style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: "8px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, fontSize: "11px", color: pal.textMuted, cursor: "pointer" }}>{t("Cerrar")}</button>
              </div>

              {/* Ruta: origen — trayecto — destino */}
              <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 56px minmax(0,1fr)" : "minmax(0,1fr) minmax(90px,1.1fr) minmax(0,1fr)", gap: "10px", alignItems: "center" }}>
                {endpoint({
                  label: t("Salida"), iata: quickResult.depIata, city: quickResult.depCity, airport: quickResult.depAirport,
                  scheduled: quickResult.depScheduled, real: depReal, changed: depChanged,
                  terminal: quickResult.depTerminal, gate: quickResult.depGate,
                  extra: quickResult.depCheckInDesk ? `${t("Check-in")} ${quickResult.depCheckInDesk}` : null,
                  align: "left",
                })}

                <div style={{ textAlign: "center", paddingBottom: "18px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: pal.textMuted, marginBottom: "3px" }}>{duration ?? " "}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ flex: 1, height: "2px", background: `linear-gradient(90deg,${SURFACE.border},#a78bfa)`, borderRadius: "2px" }} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={ACCENT.violet} style={{ flexShrink: 0 }}>
                      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
                    </svg>
                    <span style={{ flex: 1, height: "2px", background: `linear-gradient(90deg,#a78bfa,${SURFACE.border})`, borderRadius: "2px" }} />
                  </div>
                  {quickResult.aircraftModel && (
                    <p style={{ fontSize: "10px", color: pal.labelColor, marginTop: "4px" }}>{quickResult.aircraftModel}</p>
                  )}
                </div>

                {endpoint({
                  label: t("Llegada"), iata: quickResult.arrIata, city: quickResult.arrCity, airport: quickResult.arrAirport,
                  scheduled: quickResult.arrScheduled, real: arrReal, changed: arrChanged,
                  terminal: quickResult.arrTerminal, gate: null,
                  extra: quickResult.arrBaggage ? `${t("Cinta")} ${quickResult.arrBaggage}` : null,
                  align: "right",
                })}
              </div>

              <p style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${SURFACE.borderMuted}`, fontSize: "10px", color: pal.labelColor }}>
                {t("Horarios en hora local de cada aeropuerto")}
                {quickResult.depTimezone ? ` · ${tzCity(quickResult.depTimezone)} → ${tzCity(quickResult.arrTimezone)}` : ""}
                {quickResult.aircraftReg ? ` · ${t("Matrícula")} ${quickResult.aircraftReg}` : ""}
                {quickResult.provider ? ` · ${t("Fuente:")} ${quickResult.provider === "aerodatabox" ? "AeroDataBox" : "AviationStack"}` : ""}
              </p>
            </div>
          );
        })()}
      </section>

      {/* Filters */}
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "16px", padding: "12px 16px", boxShadow: pal.shadow, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <SearchIcon size={14} color={SURFACE.textFaint} strokeWidth={2} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: "32px", borderRadius: "10px", width: "100%" }} placeholder={t("Buscar vuelo, aerolínea u origen...")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {/* En teléfono los filtros se reparten de a dos por fila en vez de anchos fijos. */}
        <input className="input" type="date" style={{ borderRadius: "10px", width: isMobile ? "auto" : "160px", flex: isMobile ? "1 1 140px" : undefined }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <select className="input" style={{ borderRadius: "10px", width: isMobile ? "auto" : "160px", flex: isMobile ? "1 1 140px" : undefined }} value={filterDelegation} onChange={e => setFilterDelegation(e.target.value)}>
          <option value="">{t("Delegación")}</option>
          {delegations.filter(d => selectedEventId ? d.eventId === selectedEventId : true).map(d => (
            <option key={d.id} value={d.id}>{d.countryCode || d.id}</option>
          ))}
        </select>
        <select className="input" style={{ borderRadius: "10px", width: isMobile ? "auto" : "140px", flex: isMobile ? "1 1 140px" : undefined }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t("Estado")}</option>
          <option value="arrived">{t("Arribado")}</option>
          <option value="today">{t("Hoy")}</option>
          <option value="upcoming">{t("Programado")}</option>
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setSearchQuery(""); setFilterDate(""); setFilterDelegation(""); setFilterStatus(""); }}
            style={{ fontSize: "11px", color: STATE.danger, fontWeight: 600, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <XIcon size={12} strokeWidth={2} />
            {t("Limpiar")} ({activeFilters})
          </button>
        )}
      </section>

      {/* Flight list */}
      {loading ? (
        <div style={{ background: SURFACE.card, borderRadius: "18px", padding: "40px", textAlign: "center", color: pal.labelColor, fontSize: "13px" }}>
          <div style={{ width: "32px", height: "32px", border: `3px solid ${SURFACE.border}`, borderTopColor: BRAND.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          {t("Cargando vuelos...")}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : finalFlights.length === 0 ? (
        <div style={{ background: SURFACE.card, borderRadius: "18px", border: `1px solid ${SURFACE.border}`, padding: "40px", textAlign: "center" }}>
          <PlaneIcon size={40} color={SURFACE.textFaint} strokeWidth={1.5} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: pal.textPrimary }}>{flights.length === 0 ? t("No hay vuelos registrados") : t("Sin resultados")}</p>
          <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "4px" }}>{flights.length === 0 ? t("Agrega un vuelo o usa la búsqueda rápida.") : t("Ajusta los filtros de búsqueda.")}</p>
        </div>
      ) : (
        <div style={{ background: SURFACE.card, borderRadius: "18px", border: `1px solid ${SURFACE.border}`, overflow: "hidden", boxShadow: pal.shadow }}>
          {/* overflow hidden del card recortaba columnas en móvil: la tabla
              scrollea horizontal dentro de su propio contenedor. */}
          <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: "820px", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                {["", "Vuelo", "Aerolínea", "Ruta", "Llegada", "Estado", "Delegaciones", "Pax", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{h ? t(h) : h}</th>
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
                  <tr key={flight.id} style={{ borderBottom: isExpanded ? "none" : `1px solid ${SURFACE.borderMuted}`, cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => setExpandedFlightId(isExpanded ? null : flight.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = SURFACE.bg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ padding: "10px 8px 10px 14px", width: "24px" }}>
                      <ChevronRightIcon size={12} color={SURFACE.textFaint} strokeWidth={2} style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: pal.textPrimary, letterSpacing: "0.03em" }}>{flight.flightNumber}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: pal.textMuted, fontWeight: 500 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <AirlineLogo flightNumber={flight.flightNumber} name={flight.airline} size={26} />
                        {flight.airline}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: pal.textPrimary }}>{flight.origin}</span>
                      <ArrowRightIcon size={12} color={BRAND.teal} strokeWidth={2.5} style={{ margin: "0 6px", verticalAlign: "middle" }} />
                      <span style={{ color: pal.textMuted }}>{t("Destino")}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div><span style={{ fontWeight: 700, color: pal.textPrimary }}>{fmtTime(flight.arrivalTime)}</span></div>
                      <div style={{ fontSize: "10px", color: pal.textMuted }}>{fmtDate(flight.arrivalTime)}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                        {t(st.label)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {delegationCodes.slice(0, 3).map(code => (
                          <span key={code} style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: ACCENT.indigo, border: "1px solid rgba(99,102,241,0.15)" }}>{code}</span>
                        ))}
                        {delegationCodes.length > 3 && <span style={{ fontSize: "9px", color: pal.labelColor }}>+{delegationCodes.length - 3}</span>}
                        {delegationCodes.length === 0 && <span style={{ fontSize: "10px", color: SURFACE.borderStrong }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: passengers.length > 0 ? BRAND.teal : SURFACE.borderStrong }}>{passengers.length}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button onClick={() => openTrack(flight)} style={{ padding: "5px 12px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg,${BRAND.teal},#14AE98)`, color: SURFACE.card, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>{t("Rastrear")}</button>
                        <button onClick={() => setDeleteConfirm(flight)} style={{ padding: "5px 8px", borderRadius: "8px", border: `1px solid ${STATE.dangerBorder}`, background: SURFACE.card, color: STATE.danger, cursor: "pointer" }}>
                          <TrashIcon size={11} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr key={`${flight.id}-detail`}>
                      <td colSpan={9} style={{ padding: "0 14px 14px", background: SURFACE.bg, borderBottom: `1px solid ${SURFACE.border}` }}>
                        {/* En teléfono el detalle se apila y queda pegado (sticky) al borde
                            izquierdo del scroll horizontal: así se lee sin desplazar la
                            tabla de 820 px. */}
                        <div style={{
                          display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px", padding: "14px 0",
                          ...(isMobile ? { position: "sticky" as const, left: 0, width: "calc(100vw - 60px)", maxWidth: "100%" } : {}),
                        }}>
                          {/* Passengers */}
                          <div>
                            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "8px" }}>{t("Pasajeros AND")} ({passengers.length})</p>
                            {passengers.length === 0 ? (
                              <p style={{ fontSize: "12px", color: pal.labelColor }}>{t("No hay pasajeros vinculados a este vuelo")}</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                                {passengers.map(p => {
                                  const del = p.delegationId ? delegationById[p.delegationId] : null;
                                  const disc = p.disciplineId ? disciplineById[p.disciplineId] : null;
                                  const parentDisc = disc?.parentId ? disciplineById[disc.parentId] : null;
                                  return (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", padding: "4px 8px", borderRadius: "8px", background: SURFACE.card, border: `1px solid ${SURFACE.borderMuted}` }}>
                                      <span style={{ fontWeight: 600, color: pal.textPrimary, flex: 1 }}>{p.fullName || p.id}</span>
                                      {del && <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: ACCENT.indigo }}>{del.countryCode}</span>}
                                      {(parentDisc || disc) && <span style={{ fontSize: "9px", fontWeight: 600, padding: "1px 5px", borderRadius: "4px", background: "rgba(33,208,179,0.08)", color: BRAND.tealInk }}>{parentDisc?.name || disc?.name}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {/* Flight details */}
                          <div>
                            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT.violetLight, marginBottom: "8px" }}>{t("Detalle del vuelo")}</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                              {[
                                { label: "Aerolínea", value: flight.airline },
                                { label: "Terminal", value: flight.terminal || "—" },
                                { label: "Origen", value: flight.origin },
                                { label: "Llegada", value: `${fmtTime(flight.arrivalTime)} · ${fmtDate(flight.arrivalTime)}` },
                              ].map(d => (
                                <div key={d.label} style={{ padding: "8px 10px", borderRadius: "10px", background: SURFACE.card, border: `1px solid ${SURFACE.borderMuted}` }}>
                                  <p style={{ fontSize: "9px", fontWeight: 700, color: pal.labelColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t(d.label)}</p>
                                  <p style={{ fontSize: "12px", fontWeight: 600, color: pal.textPrimary, marginTop: "2px" }}>{d.value}</p>
                                </div>
                              ))}
                            </div>
                            {discNames.length > 0 && (
                              <div style={{ marginTop: "8px" }}>
                                <p style={{ fontSize: "9px", fontWeight: 700, color: pal.labelColor, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>{t("Disciplinas")}</p>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                  {discNames.map(name => (
                                    <span key={name} style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "rgba(33,208,179,0.08)", color: BRAND.tealInk, border: "1px solid rgba(33,208,179,0.15)" }}>{name}</span>
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
        </div>
      )}

      {/* Llegadas Transfer In (aeropuerto → hotel/sede) */}
      {!loading && (
        <div style={{ background: SURFACE.card, borderRadius: "18px", border: `1px solid ${SURFACE.border}`, overflow: "hidden", boxShadow: pal.shadow }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${SURFACE.borderMuted}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT.violetLight }}>{t("Llegadas Transfer In")}</p>
              <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>{t("Viajes aeropuerto → hotel/sede creados en Transporte")}</p>
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: ACCENT.violet, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "99px", padding: "4px 12px" }}>
              {displayTransferIns.length} {displayTransferIns.length === 1 ? t("viaje") : t("viajes")}
            </span>
          </div>
          {displayTransferIns.length === 0 ? (
            <p style={{ padding: "24px", textAlign: "center", fontSize: "12px", color: pal.labelColor }}>
              {t("No hay viajes Transfer In para los filtros actuales.")}
            </p>
          ) : (
            <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "680px", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                  {["Llegada", "Pasajero", "Tipo cliente", "Destino", "Vuelo", "Estado"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTransferIns.map(trip => {
                  const requester = trip.requesterAthleteId ? athleteById[trip.requesterAthleteId] : null;
                  const del = requester?.delegationId ? delegationById[requester.delegationId] : null;
                  const flightRaw = trip.flightNumber || (trip.metadata as Record<string, unknown> | null)?.flightNumber;
                  const flight = typeof flightRaw === "string" && flightRaw ? flightRaw : null;
                  const st = trip.scheduledAt ? getFlightStatus(trip.scheduledAt) : { label: "Sin fecha", color: SURFACE.textFaint, bg: SURFACE.borderMuted };
                  return (
                    <tr key={trip.id} style={{ borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div><span style={{ fontWeight: 700, color: pal.textPrimary }}>{fmtTime(trip.scheduledAt)}</span></div>
                        <div style={{ fontSize: "10px", color: pal.textMuted }}>{fmtDate(trip.scheduledAt)}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontWeight: 600, color: pal.textPrimary }}>{requester?.fullName || "—"}</span>
                        {del?.countryCode && (
                          <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: ACCENT.indigo, border: "1px solid rgba(99,102,241,0.15)" }}>{del.countryCode}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: pal.textMuted, fontWeight: 500 }}>{trip.clientType || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontWeight: 600, color: pal.textPrimary }}>{t("Aeropuerto")}</span>
                        <ArrowRightIcon size={12} color={ACCENT.violetLight} strokeWidth={2.5} style={{ margin: "0 6px", verticalAlign: "middle" }} />
                        <span style={{ color: pal.textMuted }}>{trip.destination?.split(",")[0] || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {flight ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "rgba(167,139,250,0.1)", color: ACCENT.violet, border: "1px solid rgba(167,139,250,0.3)" }}><PlaneIcon size={11} className="inline mr-1" />{flight}</span>
                        ) : (
                          <span style={{ fontSize: "10px", color: SURFACE.borderStrong }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                          {t(st.label === "Arribado" ? "Llegó" : st.label)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Add flight modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div style={{ background: SURFACE.card, borderRadius: "24px", width: "100%", maxWidth: "440px", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", borderTop: `3px solid ${BRAND.teal}`, boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
            <div style={{ padding: isMobile ? "16px 16px 12px" : "24px 24px 16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>{t("Nuevo")}</p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: pal.textPrimary }}>{t("Agregar vuelo")}</h2>
            </div>
            <div style={{ padding: isMobile ? "0 16px 12px" : "0 24px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                {t("Evento")}
                <select className="input" style={{ borderRadius: "10px" }} value={form.eventId || selectedEventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">{t("Selecciona evento")}</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                {t("Número de vuelo *")}
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input flex-1" style={{ borderRadius: "10px" }} value={form.flightNumber} placeholder={t("ej: LA180")}
                    onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value.toUpperCase() }))} />
                  <button type="button" onClick={() => lookupAirline(form.flightNumber)} disabled={lookingUp || !form.flightNumber.trim()}
                    style={{ padding: "0 14px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, fontSize: "12px", fontWeight: 600, color: SURFACE.textSecondary, cursor: "pointer", opacity: lookingUp ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {lookingUp ? "..." : "Auto"}
                  </button>
                </div>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "12px" : "8px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                  {t("Aerolínea *")}
                  <input className="input" style={{ borderRadius: "10px" }} value={form.airline} placeholder={t("ej: LATAM")} onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                  {t("Terminal")}
                  <input className="input" style={{ borderRadius: "10px" }} value={form.terminal} placeholder={t("ej: 2")} onChange={e => setForm(f => ({ ...f, terminal: e.target.value }))} />
                </label>
              </div>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                {t("Origen *")}
                <input className="input" style={{ borderRadius: "10px" }} value={form.origin} placeholder={t("ej: Buenos Aires, ARG")} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
              </label>
              <label style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.labelColor, display: "flex", flexDirection: "column", gap: "4px" }}>
                {t("Hora de llegada *")}
                <input className="input" style={{ borderRadius: "10px" }} type="datetime-local" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
              </label>
              {formError && <p style={{ fontSize: "12px", color: STATE.danger }}>{formError}</p>}
            </div>
            <div style={{ padding: isMobile ? "12px 16px 16px" : "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: `1px solid ${SURFACE.borderMuted}` }}>
              <button onClick={() => setModal(false)} disabled={saving} style={{ padding: "10px 20px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: pal.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{t("Cancelar")}</button>
              <button onClick={saveFlightForm} disabled={saving} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {saving ? t("Guardando...") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track modal */}
      {trackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div style={{ background: SURFACE.card, borderRadius: "24px", width: "100%", maxWidth: "560px", borderTop: `3px solid ${BRAND.teal}`, boxShadow: "0 8px 40px rgba(15,23,42,0.2)", maxHeight: "calc(100dvh - 32px)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: isMobile ? "16px 16px 12px" : "24px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexShrink: 0, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <AirlineLogo iata={trackResult?.airlineIata} flightNumber={trackModal.flight.flightNumber} name={trackResult?.airlineName ?? trackModal.flight.airline} size={40} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>{t("Rastreo en vivo")}</p>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: pal.textPrimary }}>
                    {trackModal.flight.flightNumber}
                    {trackResult?.airlineName && <span style={{ fontSize: "13px", fontWeight: 500, color: pal.textMuted, marginLeft: "8px" }}>{trackResult.airlineName}</span>}
                  </h2>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: pal.textMuted, cursor: "pointer" }}>
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> {t("Auto 30s")}
                </label>
                <button onClick={() => doTrack(trackModal.flight)} disabled={tracking}
                  style={{ padding: "6px 14px", borderRadius: "99px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, fontSize: "12px", fontWeight: 600, color: SURFACE.textSecondary, cursor: tracking ? "not-allowed" : "pointer", opacity: tracking ? 0.6 : 1 }}>
                  {tracking ? "..." : <RefreshIcon size={14} />}
                </button>
                <button onClick={() => { setTrackModal(null); setAutoRefresh(false); }}
                  style={{ padding: "6px 12px", borderRadius: "99px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, fontSize: "13px", color: pal.textMuted, cursor: "pointer", display: "inline-flex" }} aria-label="Cerrar"><XIcon size={14} /></button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: isMobile ? "0 16px 16px" : "0 24px 24px", flex: 1 }}>
              {tracking && !trackResult && (
                <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: pal.labelColor }}>{t("Consultando AviationStack...")}</div>
              )}
              {trackError && (
                <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: STATE.danger, fontSize: "13px" }}>{trackError}</div>
              )}
              {trackResult && (() => {
                const st = statusStyle(trackResult.flightStatus);
                const hasDelay = (trackResult.arrDelayMinutes ?? 0) > 0 || (trackResult.depDelayMinutes ?? 0) > 0;
                return (
                  <div className="space-y-4">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "16px", background: st.bg, border: `1px solid ${st.border}`, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {st.pulse && <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: st.color, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                        <span style={{ fontSize: "15px", fontWeight: 800, color: st.color }}>{t(st.label)}</span>
                      </div>
                      {trackResult.flightDate && <span style={{ fontSize: "12px", color: pal.textMuted }}>{t("Fecha:")} {trackResult.flightDate}</span>}
                      {trackResult.aircraftModel && <span style={{ fontSize: "12px", color: pal.textMuted }}>{trackResult.aircraftModel}{trackResult.aircraftReg ? ` · ${trackResult.aircraftReg}` : ""}</span>}
                      {hasDelay && (
                        <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: STATE.warning, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "99px", padding: "3px 10px" }}>
                          {Math.max(trackResult.depDelayMinutes ?? 0, trackResult.arrDelayMinutes ?? 0)} {t("min retraso")}
                        </span>
                      )}
                    </div>
                    {trackResult.requestedDate && trackResult.flightDate && trackResult.requestedDate !== trackResult.flightDate && (
                      <div style={{ padding: "10px 14px", borderRadius: "12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "12px", color: STATE.warningText }}>
                        {t("No hay datos del")} <b>{trackResult.requestedDate}</b> {t("para este vuelo (el plan actual de la API sólo entrega el vuelo vigente). Se muestra la operación del")} <b>{trackResult.flightDate}</b>.
                      </div>
                    )}
                    {/* Salida / flecha / llegada: en teléfono se apilan y la flecha apunta hacia abajo. */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 40px 1fr", gap: "8px", alignItems: "center" }}>
                      <div style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor, marginBottom: "4px" }}>{t("Salida")}</p>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.06em" }}>{trackResult.depIata ?? "—"}</p>
                        <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>{trackResult.depCity ?? trackResult.depAirport ?? "—"}</p>
                        <div style={{ marginTop: "10px", fontSize: "12px", color: pal.textMuted, display: "flex", flexDirection: "column", gap: "3px" }}>
                          {trackResult.depScheduled && <p>{t("Prog:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{fmtAirportTime(trackResult.depScheduled)}</span></p>}
                          {trackResult.depEstimated && !trackResult.depActual && <p>{t("Est:")} <span style={{ fontWeight: 700, color: STATE.info }}>{fmtAirportTime(trackResult.depEstimated)}</span></p>}
                          {trackResult.depActual && <p>{t("Real:")} <span style={{ fontWeight: 700, color: BRAND.teal }}>{fmtAirportTime(trackResult.depActual)}</span></p>}
                          {trackResult.depTerminal && <p>{t("Terminal:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.depTerminal}</span></p>}
                          {trackResult.depGate && <p>{t("Puerta:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.depGate}</span></p>}
                          {trackResult.depCheckInDesk && <p>{t("Check-in:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.depCheckInDesk}</span></p>}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", transform: isMobile ? "rotate(90deg)" : undefined }}>
                        <ArrowRightIcon size={20} color={BRAND.teal} strokeWidth={2.5} />
                      </div>
                      <div style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor, marginBottom: "4px" }}>{t("Llegada")}</p>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: pal.textPrimary, letterSpacing: "0.06em" }}>{trackResult.arrIata ?? "—"}</p>
                        <p style={{ fontSize: "12px", color: pal.textMuted, marginTop: "2px" }}>{trackResult.arrCity ?? trackResult.arrAirport ?? "—"}</p>
                        <div style={{ marginTop: "10px", fontSize: "12px", color: pal.textMuted, display: "flex", flexDirection: "column", gap: "3px" }}>
                          {trackResult.arrScheduled && <p>{t("Prog:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{fmtAirportTime(trackResult.arrScheduled)}</span></p>}
                          {trackResult.arrEstimated && <p>{t("Est:")} <span style={{ fontWeight: 700, color: STATE.info }}>{fmtAirportTime(trackResult.arrEstimated)}</span></p>}
                          {trackResult.arrActual && <p>{t("Real:")} <span style={{ fontWeight: 700, color: BRAND.teal }}>{fmtAirportTime(trackResult.arrActual)}</span></p>}
                          {trackResult.arrTerminal && <p>{t("Terminal:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.arrTerminal}</span></p>}
                          {trackResult.arrBaggage && <p>{t("Cinta:")} <span style={{ fontWeight: 600, color: pal.textPrimary }}>{trackResult.arrBaggage}</span></p>}
                        </div>
                      </div>
                    </div>
                    {trackResult.liveLatitude !== null && (
                      <div style={{ background: "rgba(33,208,179,0.06)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "14px", padding: "14px 16px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "10px" }}>{t("Posición en vivo")}</p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {[
                            { label: "Altitud", value: trackResult.liveAltitude ? `${trackResult.liveAltitude.toLocaleString()} m` : "—" },
                            { label: "Velocidad", value: trackResult.liveSpeedHorizontal ? `${Math.round(trackResult.liveSpeedHorizontal)} km/h` : "—" },
                            { label: "Lat", value: trackResult.liveLatitude?.toFixed(3) ?? "—" },
                            { label: "Lon", value: trackResult.liveLongitude?.toFixed(3) ?? "—" },
                          ].map(item => (
                            <div key={item.label}>
                              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: BRAND.teal }}>{t(item.label)}</p>
                              <p style={{ fontSize: "15px", fontWeight: 700, color: pal.textPrimary, marginTop: "2px" }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {trackResult.liveIsGround && <p style={{ marginTop: "8px", fontSize: "12px", fontWeight: 600, color: STATE.warning }}>{t("Aeronave en tierra")}</p>}
                        {trackResult.liveUpdated && <p style={{ marginTop: "6px", fontSize: "11px", color: pal.labelColor }}>{t("Última actualización:")} {new Date(trackResult.liveUpdated).toLocaleTimeString("es-CL")}</p>}
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
          <div style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "380px", padding: isMobile ? "20px" : "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <TrashIcon size={24} color={STATE.danger} strokeWidth={2} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: pal.textPrimary, margin: "0 0 6px" }}>{t("Eliminar vuelo")}</h3>
            <p style={{ fontSize: "13px", color: pal.textMuted, margin: "0 0 20px" }}>
              {t("¿Estás seguro de eliminar el vuelo")} <b style={{ color: pal.textPrimary }}>{deleteConfirm.flightNumber}</b> ({deleteConfirm.airline})? {t("Esta acción no se puede deshacer.")}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: pal.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button onClick={() => removeFlight(deleteConfirm)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${STATE.danger}, ${STATE.dangerText})`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(239,68,68,0.3)" }}>
                {t("Sí, eliminar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
