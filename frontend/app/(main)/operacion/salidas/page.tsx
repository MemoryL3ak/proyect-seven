"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import LineaTraslado from "@/components/LineaTraslado";
import ConfirmDialog from "@/components/ConfirmDialog";
import RegistrarTrasladoDialog, { type DatosRegistro } from "@/components/RegistrarTrasladoDialog";
import { cuerpoRegistro } from "@/lib/registro-traslado";
import { conductorEnEvento } from "@/lib/conductores-del-evento";
import { opcionesDeConductores } from "@/lib/opciones-conductores";
import { estadoAlMarcar, trasladoRealizado } from "@/lib/marcar-traslado";
import { aplanarTramos, esSalida } from "@/lib/tramos-traslado";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import { filterValidatedAthletes } from "@/lib/athletes";
import EmptyState from "@/components/ui/EmptyState";
import { CalendarIcon, AlertIcon, SearchIcon, RefreshIcon, PlaneIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { useEventoActivo } from "@/lib/evento-activo-provider";
import { useIsMobile } from "@/lib/useIsMobile";

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
  /** Transfer Out de la persona (o el viaje suelto, si no hay ficha). */
  traslado?: Trip | null;
};

type Delegation = { id: string; eventId?: string | null; countryCode?: string | null; name?: string | null };
type Trip = {
  id: string;
  eventId?: string | null;
  tripType?: string | null;
  legType?: string | null;
  parentTripId?: string | null;
  childTrips?: Trip[] | null;
  clientType?: string | null;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  driverId?: string | null;
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
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [transferOutTrips, setTransferOutTrips] = useState<Trip[]>([]);
  const [delegations, setDelegations] = useState<Record<string, Delegation>>({});
  // El evento lo elige el selector de la barra superior.
  const { eventoId: eventId } = useEventoActivo();
  const [fecha, setFecha] = useState("");
  const [delegacionId, setDelegacionId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  // Nombres de conductores y hora de referencia de la línea de tiempo.
  const [conductores, setConductores] = useState<Record<string, string>>({});
  // Conductores con sus eventos, para registrar a mano quién hizo el traslado.
  const [listaConductores, setListaConductores] = useState<Array<{ id: string; fullName?: string | null; eventIds?: string[] | null; eventId?: string | null }>>([]);
  const [ahora, setAhora] = useState(() => new Date());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Traslado que espera confirmación para marcarse realizado o pendiente.
  const [porMarcar, setPorMarcar] = useState<{ viaje: Trip; nombre: string } | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  const cargar = async () => {
    setError(null);
    try {
      const [ath, dels, trips, conductoresData] = await Promise.all([
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<Delegation[]>("/delegations").catch(() => []),
        apiFetch<Trip[]>("/trips").catch(() => []),
        apiFetch<Array<{ id: string; fullName?: string | null; eventIds?: string[] | null; eventId?: string | null }>>("/drivers").catch(() => []),
      ]);
      setConductores(Object.fromEntries((conductoresData ?? []).map((d) => [d.id, d.fullName ?? ""])));
      setListaConductores(conductoresData ?? []);
      setAhora(new Date());
      setAthletes(filterValidatedAthletes(Array.isArray(ath) ? ath : []));
      // Salidas a monitorear: los Transfer Out y el regreso de cada Transfer
      // In Out, que /trips entrega anidado en su llegada.
      setTransferOutTrips(
        aplanarTramos(Array.isArray(trips) ? trips : []).filter(
          (t) => esSalida(t) && t.status !== "CANCELLED",
        ),
      );
      const delMap: Record<string, Delegation> = {};
      (Array.isArray(dels) ? dels : []).forEach((d) => { delMap[d.id] = d; });
      setDelegations(delMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo cargar la información de salidas."));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  /**
   * Realizado / Pendiente desde el monitor: cambia el estado del viaje, el
   * mismo que ve el conductor en su app y el tracking de Viajes.
   */
  const marcarTraslado = async (viaje: Trip, registro?: DatosRegistro) => {
    setMarcando(viaje.id);
    setError(null);
    try {
      // Realizado: con el conductor y las horas reales (lib/registro-traslado).
      const cuerpo = registro
        ? cuerpoRegistro({ ...registro, donde: t("Monitoreo de Salidas") }, new Date())
        : { status: estadoAlMarcar(viaje) };
      await apiFetch(`/trips/${viaje.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo actualizar el traslado."));
    } finally {
      setMarcando(null);
      setPorMarcar(null);
    }
  };

  // Conductores del evento para el registro manual, por nombre.
  const opcionesConductor = useMemo(
    () => opcionesDeConductores(listaConductores.filter((c) => conductorEnEvento(c, eventId))),
    [listaConductores, eventId],
  );

  // La línea de tiempo avanza sola: cada 30 s se vuelve a leer, y así se ve
  // cuando el conductor toca Iniciar, Recoger o Finalizar.
  useEffect(() => {
    const timer = setInterval(() => void cargar(), 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // El Transfer Out va en la fila de su persona; antes salía también como
    // una fila aparte y la misma salida se veía dos veces.
    const trasladoDe = new Map<string, Trip>();
    transferOutTrips.forEach((t) => {
      if (t.requesterAthleteId && !trasladoDe.has(t.requesterAthleteId)) trasladoDe.set(t.requesterAthleteId, t);
    });
    const conFila = new Set(deParticipantes.map((a) => a.id));
    const deViajes: Athlete[] = transferOutTrips
      .filter((t) => !t.requesterAthleteId || !conFila.has(t.requesterAthleteId))
      .map((t) => {
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
        // Hora del vuelo (la deja AND en el viaje); si no, la del viaje.
        departureTime:
          (typeof (t.metadata || {}).flightTime === "string" ? ((t.metadata || {}).flightTime as string) : null) ??
          t.scheduledAt ??
          null,
        departureGate: null,
        metadata: {},
        traslado: t,
      };
    });
    return [...deParticipantes.map((a) => ({ ...a, traslado: trasladoDe.get(a.id) ?? null })), ...deViajes];
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
      Object.values(delegations)
        .filter((d) => !eventId || !d.eventId || d.eventId === eventId)
        .sort((a, b) =>
          String(a.countryCode || a.name || "").localeCompare(String(b.countryCode || b.name || ""), "es"),
        ),
    [delegations, eventId],
  );

  // El vuelo y la aerolínea de SALIDA. La carga AND deja en la ficha el de
  // llegada (flight_number) y el de salida en metadata.departure: antes aquí
  // se mostraba el de llegada (Sergio Alvarenga "salía" en su LA1324).
  const salidaDe = (a: Athlete) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    const d = (meta.departure && typeof meta.departure === "object" ? meta.departure : {}) as Record<string, unknown>;
    const soloSalida = (a.tripType || "").toUpperCase() === "DEPARTURE";
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      vuelo: texto(d.flightNumber) ?? texto(meta.vuelo_salida) ?? (soloSalida ? texto(a.flightNumber) : null),
      aerolinea: texto(d.airline) ?? (soloSalida ? texto(a.airline) : null),
    };
  };
  const vueloDe = (a: Athlete) => salidaDe(a).vuelo;

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
          title={t("No se pudo cargar el monitoreo de salidas")}
          description={error}
          action={<button className="btn btn-primary" onClick={() => { setCargando(true); void cargar(); }}>{t("Reintentar")}</button>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header estilo Monitor de Vuelos */}
      <section style={{ background: SURFACE.card, borderRadius: "24px", padding: isMobile ? "16px" : "28px 32px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", borderTop: `3px solid ${BRAND.teal}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <PlaneIcon size={20} color={BRAND.teal} strokeWidth={2} />
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.teal }}>{t("Operaciones aéreas")}</p>
            </div>
            <h1 style={{ fontSize: isMobile ? "1.4rem" : "1.75rem", fontWeight: 800, color: SURFACE.text, lineHeight: 1.1 }}>{t("Monitoreo de Salidas")}</h1>
            <p style={{ fontSize: "13px", color: SURFACE.textMuted, marginTop: "4px" }}>{t("Participantes con vuelo de salida y viajes Transfer Out · Sólo participantes validados")}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => { setCargando(true); void cargar(); }}>
            <RefreshIcon /> {t("Actualizar")}
          </button>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginTop: "20px" }}>
          {[
            { label: "Total salidas", value: kpis.total, color: SURFACE.text, accent: SURFACE.textMuted },
            { label: "Salen hoy", value: kpis.salidasHoy, color: STATE.warning, accent: STATE.warning },
            { label: "Próximas", value: kpis.proximas, color: STATE.info, accent: STATE.info },
            { label: "Ya salieron", value: kpis.pasadas, color: SURFACE.textMuted, accent: SURFACE.textMuted },
            { label: "Sin vuelo", value: kpis.sinVuelo, color: kpis.sinVuelo > 0 ? STATE.danger : SURFACE.text, accent: STATE.danger },
          ].map(k => (
            <div key={k.label} style={{ background: SURFACE.bg, borderRadius: "14px", padding: "12px 14px", border: `1px solid ${SURFACE.border}`, borderTop: `2px solid ${k.accent}` }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: SURFACE.textFaint }}>{t(k.label)}</p>
              <p style={{ fontSize: "22px", fontWeight: 800, color: k.color, marginTop: "2px" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="text-sm block">
            <span className="block mb-1">{t("Fecha de salida")}</span>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="text-sm block">
            <span className="block mb-1">{t("Delegación")}</span>
            <select className="input" value={delegacionId} onChange={(e) => setDelegacionId(e.target.value)}>
              <option value="">{t("Todas las delegaciones")}</option>
              {delegacionesOrdenadas.map((d) => (
                <option key={d.id} value={d.id}>{d.countryCode || d.name || d.id}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block mb-1">{t("Buscar")}</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 32 }}
                placeholder={t("Nombre, vuelo, aerolínea…")}
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
          title={t("Sin salidas para los filtros seleccionados")}
          description={t("Ajusta la fecha, la delegación o la búsqueda para ver participantes con vuelo de salida.")}
        />
      ) : (
        porDia.map(([dia, grupo]) => (
          <section key={dia} className="surface rounded-2xl overflow-hidden">
            <div
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              style={{
                background: dia === hoy ? "rgba(245,158,11,0.08)" : "var(--elevated)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2 className="text-sm font-bold capitalize" style={{ color: dia === hoy ? STATE.warningText : "var(--text)" }}>
                {dia === "sin-fecha" ? t("Sin fecha de salida") : fechaLarga(dia)}
                {dia === hoy && ` · ${t("HOY")}`}
              </h2>
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {grupo.length} {grupo.length === 1 ? t("participante") : t("participantes")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 1060 }}>
                <thead>
                  <tr style={{ background: "var(--elevated)" }}>
                    {["Hora", "Participante", "Delegación", "Tipo", "Vuelo", "Aerolínea", "Puerta", "Traslado al aeropuerto"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[10px] font-bold uppercase"
                        style={{ letterSpacing: "0.08em", color: "var(--text-muted)", whiteSpace: "nowrap" }}
                      >
                        {t(h)}
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
                              style={{ background: "rgba(167,139,250,0.12)", color: ACCENT.violet, border: "1px solid rgba(167,139,250,0.4)" }}
                            >
                              <PlaneIcon size={11} className="inline mr-1" />{vuelo}
                            </span>
                          ) : (
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}` }}
                            >
                              {t("Sin vuelo")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{salidaDe(a).aerolinea || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{a.departureGate || "—"}</td>
                        <td className="px-3 py-2.5">
                          {a.traslado ? (
                            <LineaTraslado
                              viaje={a.traslado}
                              conductor={a.traslado.driverId ? conductores[a.traslado.driverId] || t("Conductor asignado") : null}
                              ahora={ahora}
                              marcando={marcando === a.traslado.id}
                              onMarcar={() => a.traslado && setPorMarcar({ viaje: a.traslado, nombre: a.fullName || t("este pasajero") })}
                            />
                          ) : (
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("Sin traslado")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      <RegistrarTrasladoDialog
        open={Boolean(porMarcar) && !trasladoRealizado(porMarcar!.viaje)}
        titulo={t("Registrar traslado realizado")}
        detalle={porMarcar ? `${porMarcar.nombre}.` : ""}
        viaje={porMarcar && !trasladoRealizado(porMarcar.viaje) ? porMarcar.viaje : null}
        conductores={opcionesConductor}
        guardando={Boolean(marcando)}
        onGuardar={(datos) => { if (porMarcar && !marcando) void marcarTraslado(porMarcar.viaje, datos); }}
        onCancel={() => { if (!marcando) setPorMarcar(null); }}
      />
      <ConfirmDialog
        open={Boolean(porMarcar) && trasladoRealizado(porMarcar!.viaje)}
        danger={false}
        title={porMarcar && !trasladoRealizado(porMarcar.viaje) ? t("Marcar traslado realizado") : t("Marcar traslado pendiente")}
        message={
          porMarcar
            ? !trasladoRealizado(porMarcar.viaje)
              ? `${t("Se marcará como realizado")} ${t("el traslado de")} ${porMarcar.nombre}. ${t("El conductor lo verá cerrado en su app y en Viajes queda Completado.")}`
              : `${t("Se marcará como pendiente")} ${t("el traslado de")} ${porMarcar.nombre}. ${t("Vuelve a Programado en la app del conductor y se borran sus horas de inicio y cierre.")}`
            : ""
        }
        confirmLabel={porMarcar && !trasladoRealizado(porMarcar.viaje) ? t("Marcar realizado") : t("Marcar pendiente")}
        onConfirm={() => { if (porMarcar && !marcando) void marcarTraslado(porMarcar.viaje); }}
        onCancel={() => { if (!marcando) setPorMarcar(null); }}
      />
    </div>
  );
}
