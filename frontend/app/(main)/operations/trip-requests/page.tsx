"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import { TicketIcon, SearchIcon, RefreshIcon, CheckIcon, AlertIcon } from "@/components/ui/Icons";
import { normalizeClientType, clientTypeLabel } from "@/lib/clientTypes";

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
};

type EventItem = { id: string; name?: string | null };
type DriverItem = { id: string; fullName?: string | null; full_name?: string | null };
type VehicleItem = { id: string; plate?: string | null };

/** Tipos de viaje originados en la app del pasajero. */
const PORTAL_TRIP_TYPES = new Set(["PORTAL_REQUEST", "VIAJE_IDA", "VIAJE_IDA_REGRESO"]);

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  REQUESTED:   { label: "Pendiente",   color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  SCHEDULED:   { label: "Agendada",    color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  EN_ROUTE:    { label: "En ruta",     color: "#4338ca", bg: "#e0e7ff", border: "#a5b4fc" },
  PICKED_UP:   { label: "En curso",    color: "#6d28d9", bg: "#f3e8ff", border: "#d8b4fe" },
  DROPPED_OFF: { label: "En destino",  color: "#0e7490", bg: "#cffafe", border: "#67e8f9" },
  COMPLETED:   { label: "Completada",  color: "#15803d", bg: "#dcfce7", border: "#86efac" },
  CANCELLED:   { label: "Cancelada",   color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
};

const CLIENT_META: Record<string, { color: string; bg: string; border: string }> = {
  T1:  { color: "#1f4e8c", bg: "#dbeafe", border: "#93c5fd" },
  VIP: { color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
};

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
  const [assigning, setAssigning] = useState<Trip | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Trip[]>("/trips");
      // Sólo solicitudes originadas en la app del pasajero.
      setTrips((data ?? []).filter((t) => PORTAL_TRIP_TYPES.has(t.tripType ?? "")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError("Selecciona al menos un conductor o un vehículo.");
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
      setError(err instanceof Error ? err.message : "No se pudo asignar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(r: Trip) {
    if (!window.confirm("¿Cancelar esta solicitud de viaje?")) return;
    try {
      await apiFetch(`/trips/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la solicitud.");
    }
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader
        title="Solicitudes de Viaje"
        description="Solicitudes T1 y VIP generadas desde la app. Al asignar un conductor aquí, se notifica al conductor y el pasajero ve el estado en su app."
        icon={<TicketIcon size={26} />}
        iconBg="linear-gradient(135deg, #21D0B3 0%, #1f4e8c 100%)"
        accentStrip="teal"
        meta={
          <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
            style={{ background: "#e7f5ec", color: "#1eb19a" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: "#21D0B3",
              boxShadow: "0 0 0 3px rgba(33,208,179,0.25)", animation: "pulse 1.8s infinite",
            }} />
            En vivo · se actualiza cada 10 s
          </span>
        }
        action={
          <button type="button" className="btn btn-ghost text-xs" onClick={load}>
            <RefreshIcon size={13} className="inline-block mr-1" /> Refrescar
          </button>
        }
      />

      {error && (
        <section className="surface rounded-2xl p-4 flex items-center justify-between" style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm flex items-center gap-2" style={{ color: "#7a1313" }}>
            <AlertIcon size={15} /> {error}
          </p>
          <button type="button" className="text-xs underline" style={{ color: "#7a1313" }} onClick={() => setError(null)}>Cerrar</button>
        </section>
      )}

      {/* Resumen */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary.total, color: "#1f4e8c" },
          { label: "Pendientes", value: summary.pending, color: "#b45309" },
          { label: "Agendadas", value: summary.scheduled, color: "#7c3aed" },
          { label: "T1", value: summary.t1, color: "#1f4e8c" },
          { label: "VIP", value: summary.vip, color: "#92400e" },
        ].map((c) => (
          <div key={c.label} className="surface rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <select className="input max-w-[220px]" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
          <option value="">Todos los eventos</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name ?? ev.id}</option>)}
        </select>
        <select className="input max-w-[170px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="REQUESTED">Pendiente</option>
          <option value="SCHEDULED">Agendada</option>
          <option value="EN_ROUTE">En ruta</option>
          <option value="PICKED_UP">En curso</option>
          <option value="COMPLETED">Completada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <select className="input max-w-[140px]" value={clientFilter} onChange={(e) => setClientFilter(e.target.value as typeof clientFilter)}>
          <option value="">T1 y VIP</option>
          <option value="T1">Sólo T1</option>
          <option value="VIP">Sólo VIP</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }}>
            <SearchIcon size={15} />
          </span>
          <input className="input pl-9 w-full" placeholder="Buscar origen, destino, notas…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </section>

      {/* Tabla */}
      <section className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }} className="text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3">Pax</th>
                <th className="px-4 py-3">Programado</th>
                <th className="px-4 py-3">Asignación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: "#94a3b8" }}>Cargando…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: "#94a3b8" }}>No hay solicitudes que coincidan con los filtros.</td></tr>
              ) : visible.map((r) => {
                const sm = STATUS_META[r.status] ?? { label: r.status, color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" };
                const client = normalizeClientType(r.clientType);
                const cm = CLIENT_META[client] ?? { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" };
                const dr = driverLabel(r.driverId);
                const canManage = r.status === "REQUESTED" || r.status === "SCHEDULED";
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{ color: cm.color, background: cm.bg, border: `1px solid ${cm.border}` }}>
                        {clientTypeLabel(r.clientType)}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#334155" }}>
                      <span className="font-medium">{r.origin ?? "—"}</span>
                      <span style={{ color: "#94a3b8" }}> → </span>
                      <span className="font-medium">{r.destination ?? "—"}</span>
                      {r.notes && <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{r.notes}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#334155" }}>{r.passengerCount ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#334155" }}>{fmtDate(r.scheduledAt ?? r.requestedAt)}</td>
                    <td className="px-4 py-3" style={{ color: "#334155" }}>
                      {dr ? driverName(dr) : <span style={{ color: "#94a3b8" }}>Sin asignar</span>}
                      {r.vehiclePlate && <span className="text-xs" style={{ color: "#94a3b8" }}> · {r.vehiclePlate}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={{ color: sm.color, background: sm.bg, border: `1px solid ${sm.border}` }}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canManage && (
                        <>
                          <button type="button" className="btn btn-ghost text-xs" onClick={() => openAssign(r)}>
                            {r.status === "SCHEDULED" ? "Reasignar" : "Asignar"}
                          </button>
                          <button type="button" className="btn btn-ghost text-xs" style={{ color: "#dc2626" }} onClick={() => cancelRequest(r)}>
                            Cancelar
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

      {/* Modal de asignación */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}>
          <div className="surface rounded-2xl p-5 w-full max-w-md space-y-4">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "#1f4e8c" }}>Asignar solicitud {clientTypeLabel(assigning.clientType)}</h3>
              <p className="text-xs" style={{ color: "#94a3b8" }}>{assigning.origin ?? "—"} → {assigning.destination ?? "—"}</p>
            </div>
            <label className="block text-sm">
              <span className="font-semibold" style={{ color: "#475569" }}>Conductor</span>
              <select className="input w-full mt-1" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
                <option value="">— Sin conductor —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{driverName(d)}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold" style={{ color: "#475569" }}>Vehículo</span>
              <select className="input w-full mt-1" value={assignVehicleId} onChange={(e) => setAssignVehicleId(e.target.value)}>
                <option value="">— Sin vehículo —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate ?? v.id}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setAssigning(null)} disabled={saving}>Cancelar</button>
              <button type="button" className="btn btn-primary text-sm" onClick={submitAssign} disabled={saving}>
                <CheckIcon size={14} className="inline-block mr-1" /> {saving ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
