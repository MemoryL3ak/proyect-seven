"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import KpiCard from "@/components/ui/KpiCard";
import EmptyState from "@/components/ui/EmptyState";
import { DollarIcon, TruckIcon, UsersIcon, AlertIcon, RefreshIcon, ClipboardIcon } from "@/components/ui/Icons";
import { clientTypeLabel } from "@/lib/clientTypes";

/* ────────────────────────────────────────────────────────────
   Panel Financiero de Transporte
   Ingreso (tarifa cliente) · Costo (tarifa proveedor) · Margen
──────────────────────────────────────────────────────────── */

type Grupo = {
  clave: string;
  viajes: number;
  ingreso: number;
  costo: number;
  margen: number;
  margenPct: number;
  ticketPromedio: number;
};

type Resumen = {
  generadoEn: string;
  moneda: string;
  totales: {
    viajes: number;
    viajesActivos: number;
    viajesPrestados: number;
    viajesCancelados: number;
    pasajeros: number;
    ingresoTotal: number;
    costoTotal: number;
    margenTotal: number;
    margenPct: number;
    ingresoPrestado: number;
    costoPrestado: number;
    margenPrestado: number;
    ingresoComprometido: number;
    ingresoAnulado: number;
    ticketPromedio: number;
    costoPorPasajero: number;
  };
  calidadDatos: { sinValorizar: number; porReferencia: number; cobertura: number };
  presupuesto: {
    adjudicado: number;
    viajesLicitados: number;
    proveedoresConLicitacion: number;
    consumido: number;
    disponible: number;
    pctConsumido: number;
    pctViajes: number;
  };
  porProveedor: {
    providerId: string | null;
    nombre: string;
    viajes: number;
    ingreso: number;
    costo: number;
    margen: number;
    margenPct: number;
    adjudicado: number;
    viajesLicitados: number;
    pctConsumido: number | null;
  }[];
  porFlota: Grupo[];
  porServicio: Grupo[];
  porTipoCliente: Grupo[];
  serieDiaria: { fecha: string; viajes: number; ingreso: number; costo: number; margen: number }[];
  topConductores: {
    driverId: string;
    nombre: string;
    proveedor: string;
    viajes: number;
    ingreso: number;
    costo: number;
    margen: number;
    ticketPromedio: number;
  }[];
  viajesSinTarifa: {
    id: string;
    fecha: string | null;
    status: string;
    clientType: string;
    vehiculo: string;
    servicio: string;
    flotaNormalizada: string | null;
    origen: string;
    ruta: string;
  }[];
};

type Detalle = {
  id: string;
  fecha: string | null;
  status: string;
  clientType: string;
  servicio: string;
  flota: string;
  vehiculoSolicitado: string;
  conductor: string;
  proveedor: string;
  origen: string;
  destino: string;
  pasajeros: number;
  ingreso: number;
  costo: number;
  margen: number;
  origenValor: string;
};

type EventItem = { id: string; name?: string | null };

/* ── Formato ── */
const clp = (n: number) =>
  `$${Math.round(n || 0).toLocaleString("es-CL")}`;

/** Compacto para ejes y cifras grandes: $3,3 M / $450 K */
const clpCorto = (n: number) => {
  const v = Math.abs(n || 0);
  if (v >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (v >= 1_000) return `$${Math.round(n / 1_000)} K`;
  return `$${Math.round(n || 0)}`;
};

const pct = (n: number, dec = 1) => `${(n || 0).toFixed(dec).replace(".", ",")}%`;

const FLOTA_LABEL: Record<string, string> = {
  AUTO: "Sedán / Auto",
  SUV: "SUV",
  VAN_10: "Van 10",
  VAN_15: "Van 15-17",
  VAN_19: "Van 19",
  MINIBUS: "Minibús",
  BUS: "Bus",
  "SIN CLASIFICAR": "Sin clasificar",
};

const SERVICIO_LABEL: Record<string, string> = {
  VIAJE_IDA: "Viaje de ida",
  VIAJE_REGRESO: "Viaje de regreso",
  VIAJE_IDA_REGRESO: "Ida y regreso",
  TRANSFER_IN_OUT: "Transfer in/out",
  DISPOSICION_12H: "Disposición 12 h",
};

const ORIGEN_VALOR_META: Record<string, { label: string; tone: string; bg: string; border: string }> = {
  PACTADO: { label: "Valor pactado", tone: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  TARIFA: { label: "Tarifa del proveedor", tone: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  PACTADO_SIN_TARIFA: { label: "Pactado sin tarifa", tone: "#a16207", bg: "#fefce8", border: "#fde68a" },
  REFERENCIA: { label: "Tarifa de referencia", tone: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  SIN_VALORIZAR: { label: "Sin valorizar", tone: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Solicitado",
  SCHEDULED: "Programado",
  EN_ROUTE: "En ruta",
  PICKED_UP: "Pasajero a bordo",
  DROPPED_OFF: "Servicio entregado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

/** Rango de fechas local (America/Santiago), evitando el corrimiento de UTC. */
const hoyChile = () => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
};

const restarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
};

type Preset = "todo" | "hoy" | "7d" | "30d" | "custom";

export default function TransportFinancePage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [detalle, setDetalle] = useState<Detalle[]>([]);
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [preset, setPreset] = useState<Preset>("todo");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"resumen" | "detalle" | "calidad">("resumen");
  const [orden, setOrden] = useState<{ campo: keyof Detalle; asc: boolean }>({ campo: "fecha", asc: false });

  /* ── Carga ── */
  const cargar = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams();
    if (eventId) qs.set("eventId", eventId);
    if (desde) qs.set("from", desde);
    if (hasta) qs.set("to", hasta);
    const sufijo = qs.toString() ? `?${qs}` : "";
    try {
      const [r, d] = await Promise.all([
        apiFetch<Resumen>(`/trips/finance/summary${sufijo}`),
        apiFetch<Detalle[]>(`/trips/finance/detail${sufijo}`),
      ]);
      setResumen(r);
      setDetalle(Array.isArray(d) ? d : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información financiera.");
    } finally {
      setCargando(false);
    }
  }, [eventId, desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    apiFetch<EventItem[]>("/events")
      .then((e) => setEventos(Array.isArray(e) ? e : []))
      .catch(() => setEventos([]));
  }, []);

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    const hoy = hoyChile();
    if (p === "todo") {
      setDesde("");
      setHasta("");
    } else if (p === "hoy") {
      setDesde(hoy);
      setHasta(hoy);
    } else if (p === "7d") {
      setDesde(restarDias(hoy, 6));
      setHasta(hoy);
    } else if (p === "30d") {
      setDesde(restarDias(hoy, 29));
      setHasta(hoy);
    }
  };

  /* ── Exportación ── */
  const exportarCsv = () => {
    const filas = ordenado;
    if (filas.length === 0) return;
    const cab = [
      "Fecha", "Estado", "Tipo cliente", "Servicio", "Flota", "Conductor",
      "Proveedor", "Origen", "Destino", "Pasajeros", "Ingreso", "Costo", "Margen", "Origen del valor",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cuerpo = filas.map((f) =>
      [
        f.fecha ?? "", STATUS_LABEL[f.status] ?? f.status, f.clientType,
        SERVICIO_LABEL[f.servicio] ?? f.servicio, FLOTA_LABEL[f.flota] ?? f.flota,
        f.conductor, f.proveedor, f.origen, f.destino, f.pasajeros,
        Math.round(f.ingreso), Math.round(f.costo), Math.round(f.margen),
        ORIGEN_VALOR_META[f.origenValor]?.label ?? f.origenValor,
      ].map(esc).join(";"),
    );
    // BOM para que Excel en español respete los acentos.
    const csv = "﻿" + [cab.map(esc).join(";"), ...cuerpo].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-transporte-${hoyChile()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ordenado = useMemo(() => {
    const copia = [...detalle];
    copia.sort((a, b) => {
      const va = a[orden.campo];
      const vb = b[orden.campo];
      if (typeof va === "number" && typeof vb === "number") return orden.asc ? va - vb : vb - va;
      return orden.asc
        ? String(va ?? "").localeCompare(String(vb ?? ""), "es")
        : String(vb ?? "").localeCompare(String(va ?? ""), "es");
    });
    return copia;
  }, [detalle, orden]);

  const ordenarPor = (campo: keyof Detalle) =>
    setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : false }));

  /* ── Estados de carga / error ── */
  if (cargando) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--elevated)" }} />
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
          title="No se pudo cargar el panel financiero"
          description={error}
          action={
            <button className="btn btn-primary" onClick={() => { setCargando(true); void cargar(); }}>
              Reintentar
            </button>
          }
        />
      </div>
    );
  }

  if (!resumen) return null;

  const t = resumen.totales;
  const p = resumen.presupuesto;
  const q = resumen.calidadDatos;
  const sinDatos = t.viajes === 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ══ Encabezado ══ */}
      <header
        className="rounded-2xl p-5 md:p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f4fffe 100%)",
          border: "1px solid var(--banner-border)",
          boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
        }}
      >
        {/* Filete de marca a la izquierda */}
        <div
          aria-hidden
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
            background: "linear-gradient(180deg, #34F3C6, #21D0B3)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute", top: -90, right: -70, width: 260, height: 260,
            background: "radial-gradient(circle, rgba(33,208,179,0.12) 0%, transparent 68%)",
          }}
        />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase mb-1"
              style={{ letterSpacing: "0.16em", color: "#0f766e" }}
            >
              Operación · Transporte
            </p>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: "var(--text)" }}>
              Panel Financiero de Transporte
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)", maxWidth: 640 }}>
              Ingreso facturable, costo de proveedores y margen por servicio. Cada tramo
              (ida y regreso) se valoriza como un servicio independiente.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => { setCargando(true); void cargar(); }}>
                <RefreshIcon /> Actualizar
              </button>
              <button className="btn btn-gold" onClick={exportarCsv} disabled={detalle.length === 0}>
                <ClipboardIcon /> Exportar CSV
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              Actualizado {new Date(resumen.generadoEn).toLocaleString("es-CL", { timeZone: "America/Santiago" })}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2">
          <select
            className="input"
            style={{ maxWidth: 260 }}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            aria-label="Evento"
          >
            <option value="">Todos los eventos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name || "Evento sin nombre"}</option>
            ))}
          </select>

          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
          >
            {([["todo", "Todo"], ["hoy", "Hoy"], ["7d", "7 días"], ["30d", "30 días"]] as [Preset, string][]).map(
              ([valor, etiqueta]) => (
                <button
                  key={valor}
                  onClick={() => aplicarPreset(valor)}
                  aria-pressed={preset === valor}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{
                    background: preset === valor ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "transparent",
                    color: preset === valor ? "#ffffff" : "var(--text-muted)",
                  }}
                >
                  {etiqueta}
                </button>
              ),
            )}
          </div>

          <input
            type="date" className="input" style={{ maxWidth: 150 }} value={desde}
            onChange={(e) => { setDesde(e.target.value); setPreset("custom"); }}
            aria-label="Desde"
          />
          <span style={{ color: "var(--text-faint)" }}>→</span>
          <input
            type="date" className="input" style={{ maxWidth: 150 }} value={hasta}
            onChange={(e) => { setHasta(e.target.value); setPreset("custom"); }}
            aria-label="Hasta"
          />
        </div>
      </header>

      {sinDatos ? (
        <EmptyState
          icon={<DollarIcon />}
          title="Sin servicios en el período seleccionado"
          description="Ajusta el rango de fechas o el evento para ver la información financiera."
          action={<button className="btn btn-ghost" onClick={() => aplicarPreset("todo")}>Ver todo el período</button>}
        />
      ) : (
        <>
          {/* ══ KPIs ══ */}
          <section
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}
          >
            <KpiCard
              label="Ingreso facturable"
              value={clpCorto(t.ingresoTotal)}
              detail={`${t.viajesActivos} servicios activos · ${clp(t.ingresoTotal)}`}
              accent="green"
              icon={<DollarIcon />}
            />
            <KpiCard
              label="Costo proveedores"
              value={clpCorto(t.costoTotal)}
              detail={`${pct(t.ingresoTotal > 0 ? (t.costoTotal / t.ingresoTotal) * 100 : 0)} del ingreso`}
              accent="red"
              icon={<TruckIcon />}
            />
            <KpiCard
              label="Margen bruto"
              value={clpCorto(t.margenTotal)}
              detail={`Margen de ${pct(t.margenPct)} sobre el ingreso`}
              accent="blue"
              icon={<DollarIcon />}
            />
            <KpiCard
              label="Ticket promedio"
              value={clpCorto(t.ticketPromedio)}
              detail={`${t.pasajeros} pasajeros · ${clpCorto(t.costoPorPasajero)} de costo por pasajero`}
              accent="purple"
              icon={<UsersIcon />}
            />
            <KpiCard
              label="Servicios entregados"
              value={String(t.viajesPrestados)}
              detail={`${clpCorto(t.ingresoPrestado)} devengado · ${t.viajesCancelados} cancelados`}
              accent="amber"
              icon={<ClipboardIcon />}
            />
          </section>

          {/* ══ Ejecución presupuestaria + composición ══ */}
          <section className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)" }}>
            <EjecucionPresupuestaria p={p} viajesActivos={t.viajesActivos} />
            <ComposicionIngreso t={t} />
          </section>

          {/* ══ Pestañas ══ */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--elevated)" }}>
            {([
              ["resumen", "Resumen por dimensión"],
              ["detalle", `Detalle de servicios (${detalle.length})`],
              ["calidad", `Calidad de datos${q.sinValorizar + q.porReferencia > 0 ? ` (${q.sinValorizar + q.porReferencia})` : ""}`],
            ] as [typeof vista, string][]).map(([valor, etiqueta]) => (
              <button
                key={valor}
                onClick={() => setVista(valor)}
                aria-pressed={vista === valor}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: vista === valor ? "var(--surface)" : "transparent",
                  color: vista === valor ? "var(--text)" : "var(--text-muted)",
                  boxShadow: vista === valor ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {vista === "resumen" && (
            <div className="space-y-4">
              <SerieDiaria serie={resumen.serieDiaria} />

              <TablaProveedores filas={resumen.porProveedor} />

              <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
                <DesgloseBarras
                  titulo="Por tipo de flota"
                  subtitulo="Dónde se concentra el gasto de la operación"
                  filas={resumen.porFlota}
                  etiqueta={(k) => FLOTA_LABEL[k] ?? k}
                />
                <DesgloseBarras
                  titulo="Por tipo de servicio"
                  subtitulo="Ida, regreso, transfer y disposición"
                  filas={resumen.porServicio}
                  etiqueta={(k) => SERVICIO_LABEL[k] ?? k}
                />
                <DesgloseBarras
                  titulo="Por tipo de cliente"
                  subtitulo="Consumo por segmento atendido"
                  filas={resumen.porTipoCliente}
                  etiqueta={(k) => (k === "SIN TIPO" ? "Sin tipo" : clientTypeLabel(k) || k)}
                />
              </section>

              <TopConductores filas={resumen.topConductores} />
            </div>
          )}

          {vista === "detalle" && (
            <TablaDetalle filas={ordenado} orden={orden} onOrdenar={ordenarPor} />
          )}

          {vista === "calidad" && <CalidadDatos q={q} filas={resumen.viajesSinTarifa} total={t.viajes} />}
        </>
      )}
    </div>
  );
}

/* ════════ Ejecución presupuestaria ════════ */
function EjecucionPresupuestaria({
  p,
  viajesActivos,
}: {
  p: Resumen["presupuesto"];
  viajesActivos: number;
}) {
  const pctMonto = Math.min(100, p.pctConsumido);
  const pctViajes = Math.min(100, p.pctViajes);

  return (
    <div className="surface p-5 rounded-2xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
            Ejecución del contrato
          </p>
          <h2 className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
            Presupuesto adjudicado
          </h2>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "var(--brand-dim)", color: "#0f766e" }}
        >
          {p.proveedoresConLicitacion} proveedor{p.proveedoresConLicitacion === 1 ? "" : "es"}
        </span>
      </div>

      {p.adjudicado === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Ningún proveedor tiene monto adjudicado cargado. Regístralo en Registro → Proveedores
          para habilitar el seguimiento presupuestario.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Cifra etiqueta="Adjudicado" valor={clpCorto(p.adjudicado)} detalle={clp(p.adjudicado)} />
            <Cifra etiqueta="Consumido" valor={clpCorto(p.consumido)} detalle={pct(p.pctConsumido, 2)} color="#0f766e" />
            <Cifra
              etiqueta="Disponible"
              valor={clpCorto(p.disponible)}
              detalle={p.disponible < 0 ? "Sobre ejecutado" : "Saldo del contrato"}
              color={p.disponible < 0 ? "#b91c1c" : undefined}
            />
          </div>

          <Barra titulo="Monto ejecutado" porcentaje={pctMonto} detalle={`${clpCorto(p.consumido)} de ${clpCorto(p.adjudicado)}`} />
          <div className="mt-3">
            <Barra
              titulo="Servicios realizados"
              porcentaje={pctViajes}
              detalle={`${viajesActivos} de ${p.viajesLicitados || "—"} licitados`}
              tono="#1d4ed8"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Cifra({
  etiqueta, valor, detalle, color,
}: { etiqueta: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase mb-1" style={{ letterSpacing: "0.1em", color: "var(--text-faint)" }}>
        {etiqueta}
      </p>
      <p className="text-xl font-bold leading-none" style={{ color: color || "var(--text)" }}>{valor}</p>
      {detalle && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{detalle}</p>}
    </div>
  );
}

function Barra({
  titulo, porcentaje, detalle, tono = "#21D0B3",
}: { titulo: string; porcentaje: number; detalle: string; tono?: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{titulo}</span>
        <span className="text-xs font-bold" style={{ color: tono }}>{pct(porcentaje, 2)}</span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ background: "var(--elevated)" }}
        role="progressbar"
        aria-valuenow={Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={titulo}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(porcentaje, 0.5)}%`, background: `linear-gradient(90deg, ${tono}, ${tono}cc)` }}
        />
      </div>
      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{detalle}</p>
    </div>
  );
}

/* ════════ Composición del ingreso ════════ */
function ComposicionIngreso({ t }: { t: Resumen["totales"] }) {
  const base = t.ingresoPrestado + t.ingresoComprometido;
  const filas = [
    { etiqueta: "Devengado (servicio entregado)", valor: t.ingresoPrestado, color: "#16a34a" },
    { etiqueta: "Comprometido (programado)", valor: t.ingresoComprometido, color: "#d97706" },
    { etiqueta: "Anulado (cancelados)", valor: t.ingresoAnulado, color: "#94a3b8" },
  ];

  return (
    <div className="surface p-5 rounded-2xl">
      <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
        Composición
      </p>
      <h2 className="text-lg font-bold mt-0.5 mb-4" style={{ color: "var(--text)" }}>
        Estado del ingreso
      </h2>

      <div className="space-y-3">
        {filas.map((f) => {
          const ancho = base > 0 ? (f.valor / base) * 100 : 0;
          return (
            <div key={f.etiqueta}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{f.etiqueta}</span>
                <span className="text-sm font-bold" style={{ color: f.color }}>{clpCorto(f.valor)}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--elevated)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, ancho)}%`, background: f.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Margen sobre lo entregado
          </span>
          <span className="text-lg font-bold" style={{ color: "#0f766e" }}>
            {clpCorto(t.margenPrestado)}
          </span>
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          {clpCorto(t.ingresoPrestado)} facturado − {clpCorto(t.costoPrestado)} de costo
        </p>
      </div>
    </div>
  );
}

/* ════════ Serie diaria (SVG propio, sin dependencias) ════════ */
function SerieDiaria({ serie }: { serie: Resumen["serieDiaria"] }) {
  if (serie.length === 0) return null;
  const max = Math.max(...serie.map((d) => d.ingreso), 1);
  const totalIngreso = serie.reduce((s, d) => s + d.ingreso, 0);
  const promedio = totalIngreso / serie.length;

  return (
    <div className="surface p-5 rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
            Evolución
          </p>
          <h2 className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
            Ingreso y costo por día
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <Leyenda color="#21D0B3" texto="Ingreso" />
          <Leyenda color="#f43f5e" texto="Costo" />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Promedio diario {clpCorto(promedio)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-end gap-1.5" style={{ minHeight: 190, minWidth: serie.length * 44 }}>
          {serie.map((d) => {
            const hIngreso = Math.max((d.ingreso / max) * 150, d.ingreso > 0 ? 3 : 0);
            const hCosto = Math.max((d.costo / max) * 150, d.costo > 0 ? 3 : 0);
            const [, mes, dia] = d.fecha.split("-");
            return (
              <div key={d.fecha} className="flex flex-col items-center gap-1" style={{ minWidth: 38, flex: 1 }}>
                <span className="text-[10px] font-bold" style={{ color: "#0f766e" }}>{clpCorto(d.ingreso)}</span>
                <div className="flex items-end gap-0.5" style={{ height: 152 }}>
                  <div
                    title={`Ingreso ${clp(d.ingreso)}`}
                    style={{
                      width: 14, height: hIngreso, borderRadius: "3px 3px 0 0",
                      background: "linear-gradient(180deg, #34F3C6, #21D0B3)",
                    }}
                  />
                  <div
                    title={`Costo ${clp(d.costo)}`}
                    style={{
                      width: 14, height: hCosto, borderRadius: "3px 3px 0 0",
                      background: "linear-gradient(180deg, #fda4af, #f43f5e)",
                    }}
                  />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  {dia}/{mes}
                </span>
                <span className="text-[9px]" style={{ color: "var(--text-faint)" }}>{d.viajes} serv.</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {texto}
    </span>
  );
}

/* ════════ Tabla de proveedores ════════ */
function TablaProveedores({ filas }: { filas: Resumen["porProveedor"] }) {
  if (filas.length === 0) return null;
  return (
    <div className="surface rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
          Proveedores
        </p>
        <h2 className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
          Ingreso, costo y margen por proveedor
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ background: "var(--elevated)" }}>
              <Th>Proveedor</Th>
              <Th alinear="right">Servicios</Th>
              <Th alinear="right">Ingreso</Th>
              <Th alinear="right">Costo</Th>
              <Th alinear="right">Margen</Th>
              <Th>Margen %</Th>
              <Th>Ejecución del contrato</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.providerId ?? f.nombre} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{f.nombre}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{f.viajes}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>{clp(f.ingreso)}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{clp(f.costo)}</td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: f.margen >= 0 ? "#0f766e" : "#b91c1c" }}>
                  {clp(f.margen)}
                </td>
                <td className="px-4 py-3">
                  <ChipMargen valor={f.margenPct} />
                </td>
                <td className="px-4 py-3" style={{ minWidth: 170 }}>
                  {f.pctConsumido == null ? (
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Sin monto adjudicado</span>
                  ) : (
                    <>
                      <div className="h-1.5 rounded-full mb-1" style={{ background: "var(--elevated)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, f.pctConsumido)}%`,
                            background: f.pctConsumido > 90 ? "#dc2626" : "#21D0B3",
                          }}
                        />
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {pct(f.pctConsumido, 2)} de {clpCorto(f.adjudicado)}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChipMargen({ valor }: { valor: number }) {
  const tono = valor >= 30 ? { c: "#0f766e", b: "#f0fdfa", bd: "#99f6e4" }
    : valor >= 15 ? { c: "#a16207", b: "#fefce8", bd: "#fde68a" }
    : { c: "#b91c1c", b: "#fef2f2", bd: "#fecaca" };
  return (
    <span
      className="text-xs font-bold px-2 py-1 rounded-md"
      style={{ color: tono.c, background: tono.b, border: `1px solid ${tono.bd}` }}
    >
      {pct(valor)}
    </span>
  );
}

function Th({ children, alinear = "left" }: { children: React.ReactNode; alinear?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-2.5 text-[10px] font-bold uppercase"
      style={{ letterSpacing: "0.1em", color: "var(--text-muted)", textAlign: alinear }}
    >
      {children}
    </th>
  );
}

/* ════════ Desglose con barras ════════ */
function DesgloseBarras({
  titulo, subtitulo, filas, etiqueta,
}: {
  titulo: string;
  subtitulo: string;
  filas: Grupo[];
  etiqueta: (k: string) => string;
}) {
  if (filas.length === 0) return null;
  const max = Math.max(...filas.map((f) => f.ingreso), 1);

  return (
    <div className="surface p-5 rounded-2xl">
      <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
        {titulo}
      </p>
      <p className="text-[11px] mb-4 mt-0.5" style={{ color: "var(--text-faint)" }}>{subtitulo}</p>

      <div className="space-y-3">
        {filas.map((f) => (
          <div key={f.clave}>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                {etiqueta(f.clave)}
              </span>
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: "var(--text)" }}>
                {clpCorto(f.ingreso)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "var(--elevated)" }}>
              {/* Costo y margen dentro de la misma barra: se lee la estructura del ingreso */}
              <div
                style={{ width: `${(f.costo / max) * 100}%`, background: "#fda4af" }}
                title={`Costo ${clp(f.costo)}`}
              />
              <div
                style={{ width: `${(Math.max(f.margen, 0) / max) * 100}%`, background: "#21D0B3" }}
                title={`Margen ${clp(f.margen)}`}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                {f.viajes} serv. · ticket {clpCorto(f.ticketPromedio)}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: f.margenPct >= 15 ? "#0f766e" : "#a16207" }}>
                margen {pct(f.margenPct)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════ Top conductores ════════ */
function TopConductores({ filas }: { filas: Resumen["topConductores"] }) {
  if (filas.length === 0) return null;
  const iniciales = (n: string) =>
    n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <div className="surface rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--text-muted)" }}>
          Conductores
        </p>
        <h2 className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
          Mayor facturación del período
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ background: "var(--elevated)" }}>
              <Th>Conductor</Th>
              <Th>Proveedor</Th>
              <Th alinear="right">Servicios</Th>
              <Th alinear="right">Ingreso</Th>
              <Th alinear="right">Ticket promedio</Th>
              <Th alinear="right">Margen</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.driverId} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0"
                      style={{ width: 30, height: 30, background: "linear-gradient(135deg, #21D0B3, #1eb19a)" }}
                    >
                      {iniciales(f.nombre)}
                    </span>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{f.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{f.proveedor}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{f.viajes}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>{clp(f.ingreso)}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{clp(f.ticketPromedio)}</td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: "#0f766e" }}>{clp(f.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════ Detalle servicio a servicio ════════ */
function TablaDetalle({
  filas, orden, onOrdenar,
}: {
  filas: Detalle[];
  orden: { campo: keyof Detalle; asc: boolean };
  onOrdenar: (c: keyof Detalle) => void;
}) {
  if (filas.length === 0) {
    return <EmptyState icon={<ClipboardIcon />} title="Sin servicios para mostrar" description="Ajusta los filtros del período." />;
  }

  const cabeceras: { campo: keyof Detalle; texto: string; alinear?: "right" }[] = [
    { campo: "fecha", texto: "Fecha" },
    { campo: "status", texto: "Estado" },
    { campo: "clientType", texto: "Cliente" },
    { campo: "servicio", texto: "Servicio" },
    { campo: "flota", texto: "Flota" },
    { campo: "conductor", texto: "Conductor" },
    { campo: "proveedor", texto: "Proveedor" },
    { campo: "pasajeros", texto: "Pax", alinear: "right" },
    { campo: "ingreso", texto: "Ingreso", alinear: "right" },
    { campo: "costo", texto: "Costo", alinear: "right" },
    { campo: "margen", texto: "Margen", alinear: "right" },
    { campo: "origenValor", texto: "Origen del valor" },
  ];

  return (
    <div className="surface rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1180 }}>
          <thead>
            <tr style={{ background: "var(--elevated)" }}>
              {cabeceras.map((c) => (
                <th
                  key={String(c.campo)}
                  onClick={() => onOrdenar(c.campo)}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase cursor-pointer select-none"
                  style={{
                    letterSpacing: "0.08em",
                    color: orden.campo === c.campo ? "var(--text)" : "var(--text-muted)",
                    textAlign: c.alinear ?? "left",
                    whiteSpace: "nowrap",
                  }}
                  title="Ordenar por esta columna"
                >
                  {c.texto}
                  {orden.campo === c.campo && <span> {orden.asc ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const meta = ORIGEN_VALOR_META[f.origenValor];
              const cancelado = f.status === "CANCELLED";
              return (
                <tr
                  key={f.id}
                  style={{ borderTop: "1px solid var(--border)", opacity: cancelado ? 0.55 : 1 }}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{f.fecha ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[11px] font-semibold" style={{ color: cancelado ? "#b91c1c" : "var(--text)" }}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {f.clientType === "—" ? "—" : clientTypeLabel(f.clientType) || f.clientType}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {SERVICIO_LABEL[f.servicio] ?? f.servicio}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {FLOTA_LABEL[f.flota] ?? f.flota}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text)" }}>{f.conductor}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{f.proveedor}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: "var(--text-muted)" }}>{f.pasajeros || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--text)" }}>
                    {clp(f.ingreso)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {clp(f.costo)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-bold whitespace-nowrap"
                    style={{ color: f.margen >= 0 ? "#0f766e" : "#b91c1c" }}
                  >
                    {clp(f.margen)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {meta && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ color: meta.tone, background: meta.bg, border: `1px solid ${meta.border}` }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-[11px]" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
        {filas.length} servicios · Los cancelados se muestran atenuados y no suman al ingreso.
      </p>
    </div>
  );
}

/* ════════ Calidad de datos ════════ */
function CalidadDatos({
  q, filas, total,
}: {
  q: Resumen["calidadDatos"];
  filas: Resumen["viajesSinTarifa"];
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        <KpiCard
          label="Cobertura de valorización"
          value={pct(q.cobertura, 0)}
          detail={`${total - q.sinValorizar} de ${total} servicios con valor asignado`}
          accent={q.cobertura >= 95 ? "green" : "amber"}
          icon={<CheckOrAlert ok={q.cobertura >= 95} />}
        />
        <KpiCard
          label="Con tarifa de referencia"
          value={String(q.porReferencia)}
          detail="Se valorizaron con el promedio del catálogo por no encontrar tarifa del proveedor"
          accent="amber"
          icon={<AlertIcon />}
        />
        <KpiCard
          label="Sin valorizar"
          value={String(q.sinValorizar)}
          detail="No fue posible asignarles ningún valor"
          accent={q.sinValorizar > 0 ? "red" : "green"}
          icon={<AlertIcon />}
        />
      </div>

      {filas.length === 0 ? (
        <EmptyState
          variant="success"
          title="Todos los servicios están valorizados con tarifa propia"
          description="No hay servicios que dependan de tarifas de referencia ni sin valor asignado."
        />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              Servicios que requieren revisión
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Estos servicios no calzaron con una tarifa del proveedor. Revisa que el conductor tenga
              proveedor asignado y que exista la tarifa para esa combinación de flota y tipo de servicio
              en Registro → Proveedores.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 780 }}>
              <thead>
                <tr style={{ background: "var(--elevated)" }}>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Vehículo solicitado</Th>
                  <Th>Flota interpretada</Th>
                  <Th>Servicio</Th>
                  <Th>Ruta</Th>
                  <Th>Situación</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const meta = ORIGEN_VALOR_META[f.origen];
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{f.fecha ?? "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                        {f.clientType === "—" ? "—" : clientTypeLabel(f.clientType) || f.clientType}
                      </td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text)" }}>{f.vehiculo}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                        {f.flotaNormalizada
                          ? FLOTA_LABEL[f.flotaNormalizada] ?? f.flotaNormalizada
                          : <span style={{ color: "#b91c1c" }}>No reconocida</span>}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                        {SERVICIO_LABEL[f.servicio] ?? f.servicio}
                      </td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--text-muted)", maxWidth: 260 }}>
                        {f.ruta}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {meta && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded"
                            style={{ color: meta.tone, background: meta.bg, border: `1px solid ${meta.border}` }}
                          >
                            {meta.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckOrAlert({ ok }: { ok: boolean }) {
  return ok ? <DollarIcon /> : <AlertIcon />;
}
