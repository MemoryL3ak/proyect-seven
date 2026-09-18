"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  TicketIcon,
  SearchIcon,
  RefreshIcon,
  CheckIcon,
  AlertIcon,
  XIcon,
  ArrowRightIcon,
} from "@/components/ui/Icons";
import { normalizeClientType, clientTypeLabel } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n";
import { BRAND, TRIP_STATUS_META, STATE, SURFACE, ACCENT } from "@/lib/design";

/**
 * Solicitudes de viaje generadas desde la app (portal del pasajero).
 * Se gestionan sobre la tabla real de viajes (`/trips`), de modo que asignar
 * un conductor aquí notifica al conductor y el pasajero ve el estado en su app.
 */
type Trip = {
  id: string;
  eventId?: string | null;
  clientType?: string | null;
  tripType?: string | null;
  status: string;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  notes?: string | null;
  scheduledAt?: string | null;
  requestedAt?: string | null;
  createdAt?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  vehiclePlate?: string | null;
  legType?: string | null;
  /** Tramos de vuelta que /trips anida dentro de su viaje de ida. */
  childTrips?: Trip[];
  /** Bitácora del viaje: la escribe TripsService en cada cambio. */
  metadata?: { log?: LogEntry[] } & Record<string, unknown>;
  /** Quién pidió el viaje; lo resuelve el backend junto a los pasajeros. */
  requesterName?: string | null;
  /** Pasajeros ligados al viaje (transport.trip_athletes). */
  athleteNames?: string[];
  /** Tipo de cliente de quienes viajan (pasajeros + solicitante). */
  passengerClientTypes?: string[];
  /** Tipo de cliente de quien pidió el viaje. */
  requesterClientType?: string | null;
  /** Cada pasajero con su propio tipo de cliente. */
  passengers?: Array<{ id: string; name: string | null; clientType: string | null }>;
};

/** Entrada de la bitácora tal como la escribe el backend. */
type LogEntry = { action?: string; by?: string; at?: string; detail?: string };

type EventItem = { id: string; name?: string | null };
type DriverItem = { id: string; fullName?: string | null; full_name?: string | null };
type VehicleItem = { id: string; plate?: string | null };

/**
 * Despliega los tramos anidados que devuelve /trips. Cada tramo necesita su
 * propia fila: tiene conductor y estado propios, y la vuelta suele quedar sin
 * asignar cuando termina la ida.
 */
function flattenLegs(trips: Trip[]): Trip[] {
  const out: Trip[] = [];
  const seen = new Set<string>();
  for (const trip of trips) {
    for (const leg of [trip, ...(trip.childTrips ?? [])]) {
      if (seen.has(leg.id)) continue;
      seen.add(leg.id);
      out.push(leg);
    }
  }
  return out;
}

/**
 * Pasajeros de categoría prioritaria (T1/VIP) que van en el viaje. Un traslado
 * pedido por un TA que lleva a un VIP entra a esta pantalla justamente por
 * ellos, así que hay que poder señalarlos: si no, el detalle muestra "TA" y la
 * razón por la que el viaje está acá queda invisible.
 */
function prioritarios(trip: Trip): Array<{ name: string | null; clientType: string | null }> {
  return (trip.passengers ?? []).filter((p) =>
    CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(p.clientType)),
  );
}

/** Cómo se lee cada acción de la bitácora en el detalle. */
const LOG_META: Record<string, { label: string; color: string }> = {
  CREATED:               { label: "Solicitud creada",       color: "#0ea5e9" },
  DRIVER_ASSIGNED:       { label: "Conductor asignado",     color: ACCENT.indigo },
  VEHICLE_ASSIGNED:      { label: "Vehículo asignado",      color: ACCENT.indigo },
  STATUS_CHANGED:        { label: "Cambio de estado",       color: ACCENT.violet },
  SCHEDULE_CHANGED:      { label: "Horario modificado",     color: STATE.warning },
  VEHICLE_TYPE_CHANGED:  { label: "Tipo de vehículo",       color: STATE.warning },
  PASSENGER_COUNT_CHANGED:{ label: "Pasajeros",             color: STATE.warning },
  CANCELLED:             { label: "Cancelada",              color: STATE.dangerText },
};

/** Traduce "SCHEDULED → EN_ROUTE" a los nombres que usa la pantalla. */
function readableDetail(entry: LogEntry): string | null {
  if (!entry.detail) return null;
  if (entry.action !== "STATUS_CHANGED") return entry.detail;
  return entry.detail.replace(/[A-Z_]+/g, (code) => {
    const meta = STATUS_META[code];
    return meta ? meta.label : code;
  });
}

function fmtStamp(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Esta pantalla es la de los clientes T1 y VIP: el criterio es DE QUIÉN es el
 * viaje, no cómo se creó.
 *
 * Antes filtraba por tipo de viaje (los originados en la app del pasajero), que
 * es otra cosa: escondía 6 viajes VIP creados desde el panel y mostraba 10 de
 * clientes TA que no corresponden a esta pantalla.
 */
const CLIENT_TYPES_EN_PANTALLA = new Set(["T1", "VIP"]);

// Colores de estado desde el catálogo canónico (TRIP_STATUS_META en
// lib/design). Labels y bordes son extensión local de esta pantalla:
// aquí se habla de "solicitudes" (femenino) y los chips llevan borde,
// cosas que el catálogo canónico no define.
const statusMetaLocal = (status: string, label: string, border: string) => {
  const m = TRIP_STATUS_META[status];
  return { label, color: m.color, bg: m.bg, border };
};
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  REQUESTED:   statusMetaLocal("REQUESTED",   "Pendiente",  STATE.warning),
  SCHEDULED:   statusMetaLocal("SCHEDULED",   "Agendada",   "rgba(33,208,179,0.35)"),
  EN_ROUTE:    statusMetaLocal("EN_ROUTE",    "En ruta",    "rgba(59,130,246,0.35)"),
  PICKED_UP:   statusMetaLocal("PICKED_UP",   "En curso",   "rgba(139,92,246,0.35)"),
  DROPPED_OFF: statusMetaLocal("DROPPED_OFF", "En destino", SURFACE.borderStrong),
  COMPLETED:   statusMetaLocal("COMPLETED",   "Completada", SURFACE.borderStrong),
  CANCELLED:   statusMetaLocal("CANCELLED",   "Cancelada",  "rgba(239,68,68,0.35)"),
};

const CLIENT_META: Record<string, { color: string; bg: string; border: string }> = {
  T1:  { color: STATE.infoText, bg: STATE.infoSoft, border: STATE.infoBorder },
  VIP: { color: STATE.warningText, bg: STATE.warningSoft, border: STATE.warning },
};

/** Flujo normal de una solicitud, para el timeline de progreso. */
const REQUEST_FLOW = ["REQUESTED", "SCHEDULED", "EN_ROUTE", "PICKED_UP", "COMPLETED"] as const;

/** Timeline compacto del estado de la solicitud: puntos + conectores. */
function RequestTimeline({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === "CANCELLED") {
    return (
      <p className="text-[10px] mt-1.5 font-semibold" style={{ color: STATE.dangerText }}>
        <XIcon size={12} className="inline mr-1" />{t("Flujo interrumpido")}
      </p>
    );
  }
  // DROPPED_OFF queda entre "En curso" y "Completada".
  const idx = status === "DROPPED_OFF"
    ? 3.5
    : REQUEST_FLOW.indexOf(status as (typeof REQUEST_FLOW)[number]);
  if (idx < 0) return null;
  return (
    <div className="flex items-center mt-1.5" aria-label={`${t("Progreso")}: ${t(STATUS_META[status]?.label ?? status)}`}>
      {REQUEST_FLOW.map((step, i) => {
        const meta = STATUS_META[step];
        const reached = idx >= i;
        const current = Math.floor(idx) === i;
        return (
          <div key={step} className="flex items-center">
            <span
              title={t(meta.label)}
              style={{
                width: current ? 10 : 8,
                height: current ? 10 : 8,
                borderRadius: "50%",
                background: reached ? meta.color : SURFACE.border,
                boxShadow: current ? `0 0 0 3px ${meta.bg}` : "none",
                flexShrink: 0,
                transition: "all 150ms",
              }}
            />
            {i < REQUEST_FLOW.length - 1 && (
              <span style={{ width: 14, height: 2, background: idx > i ? meta.color : SURFACE.border, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function driverName(d: DriverItem): string {
  return d.fullName ?? d.full_name ?? d.id;
}

export default function TripRequestsPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<"" | "T1" | "VIP">("");
  const [search, setSearch] = useState("");

  // Asignación
  const [detail, setDetail] = useState<Trip | null>(null);
  const [listStatus, setListStatus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Trip | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Trip[]>("/trips");
      // /trips anida el tramo de vuelta dentro de su viaje de ida y sólo
      // devuelve los de primer nivel. Sin aplanar, el RETURN de un ida y
      // vuelta no aparecía en ninguna pantalla: no se le podía asignar
      // conductor y quedaba congelado en SCHEDULED para siempre.
      const flat = flattenLegs(data ?? []);
      // Entra el viaje si es de un cliente T1/VIP O si traslada a alguien de
      // esas categorías. Un traslado pedido por un TA que lleva a un VIP es un
      // viaje VIP para la operación, aunque el viaje herede el tipo del que lo
      // pidió: son 12 viajes hoy, uno de ellos en curso.
      setTrips(
        flat.filter(
          (t) =>
            CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(t.clientType)) ||
            (t.passengerClientTypes ?? []).some((tipo) =>
              CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(tipo)),
            ),
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudieron cargar las solicitudes."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    const int = setInterval(load, 10000);
    return () => clearInterval(int);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [ev, dr, ve] = await Promise.all([
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
        ]);
        setEvents(ev ?? []);
        // /drivers ya une flota propia y choferes de proveedor, sin duplicados.
        setDrivers(dr ?? []);
        setVehicles(ve ?? []);
      } catch {
        /* catálogos opcionales para la asignación */
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((r) => {
      const client = normalizeClientType(r.clientType);
      if (selectedEventId && r.eventId !== selectedEventId) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (clientFilter && client !== clientFilter) return false;
      if (q && !`${r.origin ?? ""} ${r.destination ?? ""} ${r.notes ?? ""} ${r.vehiclePlate ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, selectedEventId, statusFilter, clientFilter, search]);

  const summary = useMemo(() => {
    const base = visible;
    return {
      total: base.length,
      pending: base.filter((r) => r.status === "REQUESTED").length,
      scheduled: base.filter((r) => r.status === "SCHEDULED").length,
      t1: base.filter((r) => normalizeClientType(r.clientType) === "T1").length,
      vip: base.filter((r) => normalizeClientType(r.clientType) === "VIP").length,
    };
  }, [visible]);

  /**
   * Solicitudes de una columna del tablero. Lo usan la columna y el listado
   * completo, así que "+N más" siempre abre exactamente lo que cuenta la
   * columna.
   */
  const itemsForStatus = (status: string) =>
    visible.filter((r) => r.status === status || (status === "COMPLETED" && r.status === "DROPPED_OFF"));

  const driverLabel = useCallback(
    (id: string | null | undefined) => (id ? drivers.find((d) => d.id === id) : null),
    [drivers],
  );

  function openAssign(r: Trip) {
    setAssigning(r);
    setAssignDriverId(r.driverId ?? "");
    setAssignVehicleId(r.vehicleId ?? "");
  }

  async function submitAssign() {
    if (!assigning) return;
    if (!assignDriverId && !assignVehicleId) {
      setError(t("Selecciona al menos un conductor o un vehículo."));
      return;
    }
    setSaving(true);
    try {
      const plate = assignVehicleId ? vehicles.find((v) => v.id === assignVehicleId)?.plate ?? undefined : undefined;
      await apiFetch(`/trips/${assigning.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: assignDriverId || undefined,
          vehicleId: assignVehicleId || undefined,
          vehiclePlate: plate,
        }),
      });
      setAssigning(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo asignar la solicitud."));
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(r: Trip) {
    if (!window.confirm(t("¿Cancelar esta solicitud de viaje?"))) return;
    try {
      await apiFetch(`/trips/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cancelar la solicitud."));
    }
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader
        title={t("Solicitudes de Viaje")}
        description={t("Solicitudes T1 y VIP generadas desde la app. Al asignar un conductor aquí, se notifica al conductor y el pasajero ve el estado en su app.")}
        icon={<TicketIcon size={26} />}
        iconBg={`linear-gradient(135deg, ${BRAND.teal} 0%, #1f4e8c 100%)`}
        accentStrip="teal"
        meta={
          <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
            style={{ background: STATE.successSoft, color: BRAND.tealDark }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: BRAND.teal,
              boxShadow: "0 0 0 3px rgba(33,208,179,0.25)", animation: "pulse 1.8s infinite",
            }} />
            {t("En vivo · se actualiza cada 10 s")}
          </span>
        }
        action={
          <button type="button" className="btn btn-ghost text-xs" onClick={load}>
            <RefreshIcon size={13} className="inline-block mr-1" /> {t("Refrescar")}
          </button>
        }
      />

      {error && (
        <section className="surface rounded-2xl p-4 flex items-center justify-between" style={{ borderLeft: `4px solid ${STATE.dangerText}`, backgroundColor: STATE.dangerSoft }}>
          <p className="text-sm flex items-center gap-2" style={{ color: "#7a1313" }}>
            <AlertIcon size={15} /> {error}
          </p>
          <button type="button" className="text-xs underline" style={{ color: "#7a1313" }} onClick={() => setError(null)}>{t("Cerrar")}</button>
        </section>
      )}

      {/* Resumen */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary.total, color: STATE.infoText },
          { label: "Pendientes", value: summary.pending, color: STATE.warningText },
          { label: "Agendadas", value: summary.scheduled, color: ACCENT.violet },
          { label: "T1", value: summary.t1, color: STATE.infoText },
          { label: "VIP", value: summary.vip, color: STATE.warningText },
        ].map((c) => (
          <div key={c.label} className="surface rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: SURFACE.textMuted }}>{t(c.label)}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </section>

      {/* ── Timeline operativa: estado general de las solicitudes (respeta los filtros) ── */}
      <section className="surface rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: SURFACE.textFaint }}>{t("Timeline operativa")}</p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: SURFACE.text }}>{t("Estado general de solicitudes")}</h3>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: SURFACE.textMuted, background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: "99px", padding: "4px 12px" }}>
            {visible.length} {visible.length === 1 ? t("solicitud") : t("solicitudes")} {t("con los filtros actuales")}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {REQUEST_FLOW.map((status) => {
            const meta = STATUS_META[status];
            const items = itemsForStatus(status);
            const hasItems = items.length > 0;
            return (
              <div key={status} style={{
                background: SURFACE.card,
                border: `1px solid ${SURFACE.border}`,
                borderTop: `3px solid ${meta.color}`,
                borderRadius: "16px",
                padding: "12px",
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {t(meta.label)}
                  </span>
                  <span style={{
                    minWidth: "22px", height: "22px", borderRadius: "99px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 800,
                    background: hasItems ? meta.bg : SURFACE.borderMuted,
                    color: hasItems ? meta.color : SURFACE.textMuted,
                    border: `1px solid ${hasItems ? meta.border : "#e2e8f0"}`,
                  }}>
                    {items.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {items.slice(0, 3).map((r) => {
                    const client = normalizeClientType(r.clientType);
                    const cm = CLIENT_META[client] ?? { color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDetail(r)}
                        title={t("Ver detalle y bitácora")}
                        style={{
                          background: SURFACE.bg,
                          border: `1px solid ${SURFACE.border}`,
                          borderLeft: `3px solid ${meta.color}`,
                          borderRadius: "10px",
                          padding: "8px 10px",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "block",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "1px 7px", borderRadius: 99, background: cm.bg, color: cm.color, border: `1px solid ${cm.border}` }}>
                            {client}
                          </span>
                          <span style={{ fontSize: "10.5px", fontWeight: 700, color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums" }}>
                            {fmtDate(r.scheduledAt ?? r.requestedAt)}
                          </span>
                        </div>
                        <p style={{ fontSize: "11.5px", fontWeight: 700, color: SURFACE.text, marginTop: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.origin ?? t("¿Origen?")} → {r.destination ?? t("¿Destino?")}
                        </p>
                        <p style={{ fontSize: "10.5px", color: SURFACE.textFaint, marginTop: "1px" }}>
                          {r.driverId ? (driverLabel(r.driverId) ? driverName(driverLabel(r.driverId)!) : t("Conductor asignado")) : t("Sin conductor")}
                          {prioritarios(r).length > 0 &&
                            !CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(r.clientType)) && (
                              <span style={{ marginLeft: 5, color: "#a16207", fontWeight: 700 }}>
                                · {t("lleva")} {clientTypeLabel(prioritarios(r)[0].clientType)}
                              </span>
                            )}
                        </p>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <p style={{ fontSize: "12px", color: SURFACE.textFaint, textAlign: "center", padding: "12px 0" }}>{t("Sin solicitudes.")}</p>
                  )}
                  {items.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setListStatus(status)}
                      style={{
                        fontSize: "11px", color: meta.color, textAlign: "center", fontWeight: 700,
                        background: "transparent", border: "none", cursor: "pointer", padding: "2px 0", width: "100%",
                      }}
                    >
                      +{items.length - 3} {t("más")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <select className="input max-w-[220px]" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
          <option value="">{t("Todos los eventos")}</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name ?? ev.id}</option>)}
        </select>
        <select className="input max-w-[170px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t("Todos los estados")}</option>
          <option value="REQUESTED">{t("Pendiente")}</option>
          <option value="SCHEDULED">{t("Agendada")}</option>
          <option value="EN_ROUTE">{t("En ruta")}</option>
          <option value="PICKED_UP">{t("En curso")}</option>
          <option value="COMPLETED">{t("Completada")}</option>
          <option value="CANCELLED">{t("Cancelada")}</option>
        </select>
        <select className="input max-w-[140px]" value={clientFilter} onChange={(e) => setClientFilter(e.target.value as typeof clientFilter)}>
          <option value="">{t("T1 y VIP")}</option>{/* ambos: la pantalla ya no trae otros */}
          <option value="T1">{t("Sólo T1")}</option>
          <option value="VIP">{t("Sólo VIP")}</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: SURFACE.textFaint }}>
            <SearchIcon size={15} />
          </span>
          <input className="input pl-9 w-full" placeholder={t("Buscar origen, destino, notas…")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </section>

      {/* Tabla */}
      <section className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: SURFACE.bg, color: SURFACE.textSecondary }} className="text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3">{t("Cliente")}</th>
                <th className="px-4 py-3">{t("Ruta")}</th>
                <th className="px-4 py-3">{t("Pax")}</th>
                <th className="px-4 py-3">{t("Programado")}</th>
                <th className="px-4 py-3">{t("Asignación")}</th>
                <th className="px-4 py-3">{t("Estado")}</th>
                <th className="px-4 py-3 text-right">{t("Acciones")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: SURFACE.textFaint }}>{t("Cargando…")}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: SURFACE.textFaint }}>{t("No hay solicitudes que coincidan con los filtros.")}</td></tr>
              ) : visible.map((r) => {
                const sm = STATUS_META[r.status] ?? { label: r.status, color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
                const client = normalizeClientType(r.clientType);
                const cm = CLIENT_META[client] ?? { color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
                const dr = driverLabel(r.driverId);
                const canManage = r.status === "REQUESTED" || r.status === "SCHEDULED";
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${SURFACE.borderMuted}` }}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{ color: cm.color, background: cm.bg, border: `1px solid ${cm.border}` }}>
                        {clientTypeLabel(r.clientType)}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: SURFACE.textStrong }}>
                      {r.legType === "RETURN" && (
                        <span className="inline-flex items-center text-[10px] font-bold rounded px-1.5 py-0.5 mr-1.5"
                          style={{ color: ACCENT.violet, background: ACCENT.violetSoft, border: "1px solid #ddd6fe" }}>
                          {t("Vuelta")}
                        </span>
                      )}
                      <span className="font-medium">{r.origin ?? "—"}</span>
                      <span style={{ color: SURFACE.textFaint, display: "inline-flex", margin: "0 4px", verticalAlign: "middle" }}><ArrowRightIcon size={12} /></span>
                      <span className="font-medium">{r.destination ?? "—"}</span>
                      {r.notes && <p className="text-xs mt-0.5" style={{ color: SURFACE.textFaint }}>{r.notes}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: SURFACE.textStrong }}>{r.passengerCount ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: SURFACE.textStrong }}>{fmtDate(r.scheduledAt ?? r.requestedAt)}</td>
                    <td className="px-4 py-3" style={{ color: SURFACE.textStrong }}>
                      {dr ? driverName(dr) : <span style={{ color: SURFACE.textFaint }}>{t("Sin asignar")}</span>}
                      {r.vehiclePlate && <span className="text-xs" style={{ color: SURFACE.textFaint }}> · {r.vehiclePlate}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={{ color: sm.color, background: sm.bg, border: `1px solid ${sm.border}` }}>
                        {t(sm.label)}
                      </span>
                      <RequestTimeline status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canManage && (
                        <>
                          <button type="button" className="btn btn-ghost text-xs" onClick={() => openAssign(r)}>
                            {r.status === "SCHEDULED" ? t("Reasignar") : t("Asignar")}
                          </button>
                          <button type="button" className="btn btn-ghost text-xs" style={{ color: STATE.dangerText }} onClick={() => cancelRequest(r)}>
                            {t("Cancelar")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Listado completo de una columna del tablero */}
      {listStatus && (() => {
        const meta = STATUS_META[listStatus] ?? { label: listStatus, color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
        const items = itemsForStatus(listStatus);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}
            onClick={() => setListStatus(null)}>
            <div className="surface rounded-2xl p-5 w-full max-w-lg space-y-3" style={{ maxHeight: "86vh", overflowY: "auto" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {t(meta.label)}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: SURFACE.textMuted }}>
                    {items.length} {items.length === 1 ? t("solicitud") : t("solicitudes")}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost text-xs" onClick={() => setListStatus(null)}>{t("Cerrar")}</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((r) => {
                  const client = normalizeClientType(r.clientType);
                  const cm = CLIENT_META[client] ?? { color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
                  const dr = driverLabel(r.driverId);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setListStatus(null); setDetail(r); }}
                      title={t("Ver detalle y bitácora")}
                      style={{
                        background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${meta.color}`,
                        borderRadius: 10, padding: "8px 10px", width: "100%", textAlign: "left", cursor: "pointer", display: "block",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "1px 7px", borderRadius: 99, background: cm.bg, color: cm.color, border: `1px solid ${cm.border}` }}>
                            {client}
                          </span>
                          {r.legType === "RETURN" && (
                            <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "1px 6px", borderRadius: 4, color: ACCENT.violet, background: ACCENT.violetSoft, border: "1px solid #ddd6fe" }}>
                              {t("Vuelta")}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums" }}>
                          {fmtDate(r.scheduledAt ?? r.requestedAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: "11.5px", fontWeight: 700, color: SURFACE.text, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.origin ?? t("¿Origen?")} → {r.destination ?? t("¿Destino?")}
                      </p>
                      <p style={{ fontSize: "10.5px", color: SURFACE.textFaint, marginTop: 1 }}>
                        {dr ? driverName(dr) : t("Sin conductor")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detalle de la solicitud: datos + bitácora */}
      {detail && (() => {
        const sm = STATUS_META[detail.status] ?? { label: detail.status, color: SURFACE.textSecondary, bg: SURFACE.borderMuted, border: SURFACE.borderStrong };
        const dr = driverLabel(detail.driverId);
        const entries = [...(detail.metadata?.log ?? [])].sort(
          (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}
            onClick={() => setDetail(null)}>
            <div className="surface rounded-2xl p-5 w-full max-w-lg space-y-4" style={{ maxHeight: "86vh", overflowY: "auto" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5"
                      style={{ color: sm.color, background: sm.bg, border: `1px solid ${sm.border}` }}>
                      {t(sm.label)}
                    </span>
                    <span className="text-xs font-bold" style={{ color: SURFACE.textMuted }}>{clientTypeLabel(detail.clientType)}</span>
                    {prioritarios(detail).length > 0 &&
                      !CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(detail.clientType)) && (
                        <span className="text-[10px] font-bold rounded px-1.5 py-0.5"
                          style={{ color: "#a16207", background: "#fefce8", border: "1px solid #fde68a" }}>
                          {t("Lleva")} {clientTypeLabel(prioritarios(detail)[0].clientType)}
                        </span>
                      )}
                    {detail.legType === "RETURN" && (
                      <span className="text-[10px] font-bold rounded px-1.5 py-0.5"
                        style={{ color: ACCENT.violet, background: ACCENT.violetSoft, border: "1px solid #ddd6fe" }}>{t("Vuelta")}</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold" style={{ color: SURFACE.text }}>
                    {detail.origin ?? t("¿Origen?")} → {detail.destination ?? t("¿Destino?")}
                  </h3>
                </div>
                <button type="button" className="btn btn-ghost text-xs" onClick={() => setDetail(null)}>{t("Cerrar")}</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  [t("Solicitante"), detail.requesterName ?? t("No registrado")],
                  [t("Agendada"), fmtStamp(detail.scheduledAt ?? detail.requestedAt)],
                  [t("Conductor"), dr ? driverName(dr) : t("Sin asignar")],
                  [t("Vehículo"), detail.vehiclePlate ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}`, borderRadius: 10, padding: "8px 10px" }}>
                    <p style={{ color: SURFACE.textFaint, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{k}</p>
                    <p style={{ color: SURFACE.text, fontWeight: 700, margin: "2px 0 0" }}>{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: SURFACE.textFaint, marginBottom: 6 }}>
                  {t("Pasajeros")}
                  <span style={{ marginLeft: 6, color: SURFACE.textMuted, letterSpacing: 0 }}>
                    · {(detail.passengers ?? detail.athleteNames ?? []).length}
                  </span>
                  {/* El contador declarado en la solicitud y los pasajeros
                      efectivamente ligados no siempre coinciden: se muestran
                      los dos en vez de esconder la diferencia. */}
                  {detail.passengerCount != null &&
                    detail.passengerCount !== (detail.passengers ?? detail.athleteNames ?? []).length && (
                      <span style={{ marginLeft: 6, color: "#a16207", letterSpacing: 0, fontWeight: 600 }}>
                        ({t("declarados")}: {detail.passengerCount})
                      </span>
                    )}
                </p>
                {(detail.passengers ?? []).length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(detail.passengers ?? []).map((p, i) => {
                      const destacado = CLIENT_TYPES_EN_PANTALLA.has(normalizeClientType(p.clientType));
                      return (
                        <span key={`${p.id}-${i}`} className="text-xs font-semibold"
                          style={{
                            color: destacado ? "#7c3aed" : SURFACE.textStrong,
                            background: destacado ? "#f5f3ff" : SURFACE.bg,
                            border: `1px solid ${destacado ? "#ddd6fe" : "#e2e8f0"}`,
                            borderRadius: 99,
                            padding: "3px 10px",
                          }}>
                          {p.name ?? "—"}
                          {p.clientType && (
                            <span style={{ marginLeft: 5, opacity: 0.75, fontWeight: 700 }}>
                              {clientTypeLabel(p.clientType)}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: SURFACE.textFaint }}>{t("Sin pasajeros ligados a la solicitud.")}</p>
                )}
              </div>

              {detail.notes && (
                <p className="text-xs" style={{ color: SURFACE.textMuted, background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}`, borderRadius: 10, padding: "8px 10px" }}>
                  {detail.notes}
                </p>
              )}

              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: SURFACE.textFaint, marginBottom: 10 }}>
                  {t("Bitácora")}
                </p>
                {entries.length === 0 ? (
                  <p className="text-xs" style={{ color: SURFACE.textFaint }}>
                    {t("Sin movimientos registrados. La bitácora empieza a llenarse con los cambios hechos desde la plataforma.")}
                  </p>
                ) : (
                  <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {entries.map((e, i) => {
                      const lm = LOG_META[e.action ?? ""] ?? { label: e.action ?? t("Movimiento"), color: SURFACE.textMuted };
                      const det = readableDetail(e);
                      const last = i === entries.length - 1;
                      return (
                        <li key={`${e.at}-${i}`} style={{ display: "flex", gap: 10 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ width: 9, height: 9, borderRadius: 99, background: lm.color, marginTop: 4, flexShrink: 0 }} />
                            {!last && <span style={{ width: 2, flex: 1, background: SURFACE.border, margin: "2px 0" }} />}
                          </div>
                          <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0 }}>
                            <p style={{ fontSize: 12.5, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{t(lm.label)}</p>
                            {det && <p style={{ fontSize: 12, color: SURFACE.textSecondary, margin: "1px 0 0" }}>{det}</p>}
                            <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "2px 0 0" }}>
                              {fmtStamp(e.at)}{e.by ? ` · ${e.by}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {(detail.status === "REQUESTED" || detail.status === "SCHEDULED") && (
                <button type="button" className="btn btn-ghost text-xs"
                  onClick={() => { const r = detail; setDetail(null); openAssign(r); }}>
                  {detail.status === "SCHEDULED" ? t("Reasignar") : t("Asignar")}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal de asignación */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}>
          <div className="surface rounded-2xl p-5 w-full max-w-md space-y-4">
            <div>
              <h3 className="text-lg font-bold" style={{ color: STATE.infoText }}>{t("Asignar solicitud")} {clientTypeLabel(assigning.clientType)}</h3>
              <p className="text-xs" style={{ color: SURFACE.textFaint }}>{assigning.origin ?? "—"} → {assigning.destination ?? "—"}</p>
            </div>
            <label className="block text-sm">
              <span className="font-semibold" style={{ color: SURFACE.textSecondary }}>{t("Conductor")}</span>
              <select className="input w-full mt-1" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
                <option value="">{t("— Sin conductor —")}</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{driverName(d)}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold" style={{ color: SURFACE.textSecondary }}>{t("Vehículo")}</span>
              <select className="input w-full mt-1" value={assignVehicleId} onChange={(e) => setAssignVehicleId(e.target.value)}>
                <option value="">{t("— Sin vehículo —")}</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate ?? v.id}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setAssigning(null)} disabled={saving}>{t("Cancelar")}</button>
              <button type="button" className="btn btn-primary text-sm" onClick={submitAssign} disabled={saving}>
                <CheckIcon size={14} className="inline-block mr-1" /> {saving ? t("Guardando…") : t("Confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
