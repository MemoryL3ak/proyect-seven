"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import EmptyState from "@/components/ui/EmptyState";
import { UsersIcon, CalendarIcon, AlertIcon, SearchIcon, RefreshIcon } from "@/components/ui/Icons";

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
      const [ath, dels, evs] = await Promise.all([
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<Delegation[]>("/delegations").catch(() => []),
        apiFetch<EventItem[]>("/events").catch(() => []),
      ]);
      setAthletes(filterValidatedAthletes(Array.isArray(ath) ? ath : []));
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

  /* Participantes con salida: trip_type DEPARTURE o con hora de salida cargada. */
  const salidas = useMemo(
    () =>
      athletes.filter((a) => {
        const meta = (a.metadata || {}) as Record<string, unknown>;
        return (
          (a.tripType || "").toUpperCase() === "DEPARTURE" ||
          Boolean(a.departureTime) ||
          Boolean(meta.vuelo_salida)
        );
      }),
    [athletes],
  );

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
      <PageHeader
        title="Monitoreo de Salidas"
        description="Participantes con vuelo de salida: fecha, vuelo, aerolínea y puerta de embarque. Sólo se listan participantes validados."
        icon={<CalendarIcon size={24} />}
        action={
          <button className="btn btn-ghost" onClick={() => { setCargando(true); void cargar(); }}>
            <RefreshIcon /> Actualizar
          </button>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Salidas registradas" value={kpis.total} detail="participantes con salida" icon={<UsersIcon size={18} />} accent="blue" />
        <KpiCard label="Salen hoy" value={kpis.salidasHoy} detail={fechaLarga(hoy)} icon={<CalendarIcon size={18} />} accent={kpis.salidasHoy > 0 ? "amber" : "neutral"} />
        <KpiCard label="Próximas salidas" value={kpis.proximas} detail={`${kpis.pasadas} ya salieron`} icon={<CalendarIcon size={18} />} accent="green" />
        <KpiCard label="Sin vuelo asignado" value={kpis.sinVuelo} detail="requieren número de vuelo" icon={<AlertIcon size={18} />} accent={kpis.sinVuelo > 0 ? "red" : "neutral"} />
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
