"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import EmptyState from "@/components/ui/EmptyState";
import { CalendarIcon, AlertIcon, SearchIcon, RefreshIcon } from "@/components/ui/Icons";

/* ────────────────────────────────────────────────────────────
   Monitoreo de Salidas de Participantes
   Vista dedicada a los vuelos de salida (trip_type = DEPARTURE):
   quién sale, cuándo, en qué vuelo y por qué puerta.
──────────────────────────────────────────────────────────── */

type Athlete = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  userType?: string | null;
  tripType?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  departureTime?: string | null;
  departureGate?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Delegation = { id: string; countryCode?: string | null; name?: string | null };
type EventItem = { id: string; name?: string | null };
type Trip = {
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

const hoyChile = () => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
};

const fechaLocal = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const horaLocal = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" });
};

const fechaLarga = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  });
};

export default function DepartureMonitoringPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [transferOutTrips, setTransferOutTrips] = useState<Trip[]>([]);
  const [delegations, setDelegations] = useState<Record<string, Delegation>>({});
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [fecha, setFecha] = useState("");
  const [delegacionId, setDelegacionId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setError(null);
    try {
      const [ath, dels, evs, trips] = await Promise.all([
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<Delegation[]>("/delegations").catch(() => []),
        apiFetch<EventItem[]>("/events").catch(() => []),
        apiFetch<Trip[]>("/trips").catch(() => []),
      ]);
      setAthletes(filterValidatedAthletes(Array.isArray(ath) ? ath : []));
      // Viajes Transfer Out: también son salidas a monitorear.
      setTransferOutTrips(
        (Array.isArray(trips) ? trips : []).filter(
          (t) => String(t.tripType || "").toUpperCase() === "TRANSFER_OUT" && t.status !== "CANCELLED",
        ),
      );
      const delMap: Record<string, Delegation> = {};
      (Array.isArray(dels) ? dels : []).forEach((d) => { delMap[d.id] = d; });
      setDelegations(delMap);
      setEventos(Array.isArray(evs) ? evs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de salidas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  /* Participantes con salida: trip_type DEPARTURE o con hora de salida
     cargada. Además, los VIAJES tipo Transfer Out entran como salidas. */
  const salidas = useMemo(() => {
    const deParticipantes = athletes.filter((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      return (
        (a.tripType || "").toUpperCase() === "DEPARTURE" ||
        Boolean(a.departureTime) ||
        Boolean(meta.vuelo_salida)
      );
    });
    const deViajes: Athlete[] = transferOutTrips.map((t) => {
      const requester = athletes.find((a) => a.id === t.requesterAthleteId);
      const flight = t.flightNumber || ((t.metadata || {}) as Record<string, unknown>).flightNumber;
      return {
        id: `trip-${t.id}`,
        fullName:
          requester?.fullName ||
          [t.origin, t.destination].filter(Boolean).join(" → ") ||
          "Viaje Transfer Out",
        eventId: t.eventId ?? null,
        delegationId: requester?.delegationId ?? null,
        userType: `Transfer Out${t.clientType ? ` · ${t.clientType}` : ""}`,
        tripType: "DEPARTURE",
        flightNumber: typeof flight === "string" && flight ? flight : null,
        airline: null,
        departureTime: t.scheduledAt ?? null,
        departureGate: null,
        metadata: {},
      };
    });
    return [...deParticipantes, ...deViajes];
  }, [athletes, transferOutTrips]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return salidas
      .filter((a) => !eventId || a.eventId === eventId)
      .filter((a) => !delegacionId || a.delegationId === delegacionId)
      .filter((a) => !fecha || fechaLocal(a.departureTime) === fecha)
      .filter((a) => {
        if (!q) return true;
        const del = delegations[a.delegationId || ""];
        return [a.fullName, a.flightNumber, a.airline, a.departureGate, del?.countryCode, del?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const ta = a.departureTime ? new Date(a.departureTime).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.departureTime ? new Date(b.departureTime).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
  }, [salidas, eventId, delegacionId, fecha, busqueda, delegations]);

  const hoy = hoyChile();
  const kpis = useMemo(() => {
    const salidasHoy = salidas.filter((a) => fechaLocal(a.departureTime) === hoy).length;
    const proximas = salidas.filter((a) => {
      const f = fechaLocal(a.departureTime);
      return f !== null && f > hoy;
    }).length;
    const pasadas = salidas.filter((a) => {
      const f = fechaLocal(a.departureTime);
      return f !== null && f < hoy;
    }).length;
    const sinVuelo = salidas.filter((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      return !a.flightNumber && !meta.vuelo_salida;
    }).length;
    return { total: salidas.length, salidasHoy, proximas, pasadas, sinVuelo };
  }, [salidas, hoy]);

  /* Agrupar por día (sin fecha al final) */
  const porDia = useMemo(() => {
    const grupos = new Map<string, Athlete[]>();
    filtradas.forEach((a) => {
      const clave = fechaLocal(a.departureTime) || "sin-fecha";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(a);
    });
    return Array.from(grupos.entries()).sort(([a], [b]) => {
      if (a === "sin-fecha") return 1;
      if (b === "sin-fecha") return -1;
      return a.localeCompare(b);
    });
  }, [filtradas]);

  const delegacionesOrdenadas = useMemo(
    () =>
      Object.values(delegations).sort((a, b) =>
        String(a.countryCode || a.name || "").localeCompare(String(b.countryCode || b.name || ""), "es"),
      ),
    [delegations],
  );

  const vueloDe = (a: Athlete) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    return a.flightNumber || (typeof meta.vuelo_salida === "string" ? meta.vuelo_salida : null);
  };

  if (cargando) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--elevated)" }} />
          ))}
        </div>
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          variant="warning"
          icon={<AlertIcon />}
          title="No se pudo cargar el monitoreo de salidas"
          description={error}
          action={<button className="btn btn-primary" onClick={() => { setCargando(true); void cargar(); }}>Reintentar</button>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header estilo Monitor de Vuelos */}
      <section style={{ background: "#ffffff", borderRadius: "24px", padding: "28px 32px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", borderTop: "3px solid #21D0B3" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l5.4 3.1-3 3-1.7-.5c-.3-.1-.7 0-.9.2l-.3.3c-.2.3-.1.7.1.9l2.8 2.1 2.1 2.8c.2.3.6.4.9.1l.3-.3c.2-.2.3-.6.2-.9l-.5-1.7 3-3 3.1 5.4c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Operaciones aéreas</p>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>Monitoreo de Salidas</h1>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Participantes con vuelo de salida y viajes Transfer Out · Sólo participantes validados</p>
          </div>
          <button className="btn btn-ghost" onClick={() => { setCargando(true); void cargar(); }}>
            <RefreshIcon /> Actualizar
          </button>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginTop: "20px" }}>
          {[
            { label: "Total salidas", value: kpis.total, color: "#0f172a", accent: "#64748b" },
            { label: "Salen hoy", value: kpis.salidasHoy, color: "#f59e0b", accent: "#f59e0b" },
            { label: "Próximas", value: kpis.proximas, color: "#3b82f6", accent: "#3b82f6" },
            { label: "Ya salieron", value: kpis.pasadas, color: "#64748b", accent: "#64748b" },
            { label: "Sin vuelo", value: kpis.sinVuelo, color: kpis.sinVuelo > 0 ? "#ef4444" : "#0f172a", accent: "#ef4444" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: "14px", padding: "12px 14px", border: "1px solid #e2e8f0", borderTop: `2px solid ${k.accent}` }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>{k.label}</p>
              <p style={{ fontSize: "22px", fontWeight: 800, color: k.color, marginTop: "2px" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="text-sm block">
            <span className="block mb-1">Evento</span>
            <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Todos los eventos</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name || "Evento sin nombre"}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">Fecha de salida</span>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="text-sm block">
            <span className="block mb-1">Delegación</span>
            <select className="input" value={delegacionId} onChange={(e) => setDelegacionId(e.target.value)}>
              <option value="">Todas las delegaciones</option>
              {delegacionesOrdenadas.map((d) => (
                <option key={d.id} value={d.id}>{d.countryCode || d.name || d.id}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">Buscar</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 32 }}
                placeholder="Nombre, vuelo, aerolínea…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </label>
        </div>
      </section>

      {/* Listado agrupado por día */}
      {filtradas.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="Sin salidas para los filtros seleccionados"
          description="Ajusta la fecha, la delegación o la búsqueda para ver participantes con vuelo de salida."
        />
      ) : (
        porDia.map(([dia, grupo]) => (
          <section key={dia} className="surface rounded-2xl overflow-hidden">
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{
                background: dia === hoy ? "rgba(245,158,11,0.08)" : "var(--elevated)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2 className="text-sm font-bold capitalize" style={{ color: dia === hoy ? "#b45309" : "var(--text)" }}>
                {dia === "sin-fecha" ? "Sin fecha de salida" : fechaLarga(dia)}
                {dia === hoy && " · HOY"}
              </h2>
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {grupo.length} participante{grupo.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "var(--elevated)" }}>
                    {["Hora", "Participante", "Delegación", "Tipo", "Vuelo", "Aerolínea", "Puerta"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[10px] font-bold uppercase"
                        style={{ letterSpacing: "0.08em", color: "var(--text-muted)", whiteSpace: "nowrap" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupo.map((a) => {
                    const del = delegations[a.delegationId || ""];
                    const vuelo = vueloDe(a);
                    return (
                      <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                          {horaLocal(a.departureTime)}
                        </td>
                        <td className="px-3 py-2.5" style={{ color: "var(--text)" }}>{a.fullName || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          {del?.countryCode || del?.name || "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{a.userType || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {vuelo ? (
                            <span
                              className="text-[11px] font-bold px-2 py-0.5 rounded"
                              style={{ background: "rgba(167,139,250,0.12)", color: "#7c3aed", border: "1px solid rgba(167,139,250,0.4)" }}
                            >
                              ✈ {vuelo}
                            </span>
                          ) : (
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
                            >
                              Sin vuelo
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{a.airline || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{a.departureGate || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
