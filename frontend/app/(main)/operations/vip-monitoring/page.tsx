"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import EmptyState from "@/components/ui/EmptyState";
import { UsersIcon, PinIcon, RouteIcon, SearchIcon, AlertIcon } from "@/components/ui/Icons";
import type { PresenceMarker } from "@/components/DriverPresenceMap";

const DriverPresenceMap = dynamic(() => import("@/components/DriverPresenceMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />,
});

type VipRow = {
  id: string;
  fullName: string;
  phone?: string | null;
  eventId?: string | null;
  trip: {
    id: string;
    status: string;
    active?: boolean;
    origin?: string | null;
    destination?: string | null;
    scheduledAt?: string | null;
    driverName?: string | null;
  } | null;
  position: {
    lat: number;
    lng: number;
    source: "PASSENGER" | "VEHICLE";
    timestamp?: string | null;
  } | null;
};

type Snapshot = {
  ts: string;
  stats: { total: number; enViaje: number; conUbicacion: number };
  vips: VipRow[];
};

type EventItem = { id: string; name?: string | null };

const TRIP_LABEL: Record<string, string> = {
  REQUESTED: "Viaje solicitado",
  SCHEDULED: "Viaje programado",
  ASSIGNED: "Conductor asignado",
  EN_ROUTE: "Vehículo en camino",
  PICKED_UP: "A bordo del vehículo",
  DROPPED_OFF: "En destino",
  COMPLETED: "Viaje completado",
};

function ago(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

export default function VipMonitoringPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [soloEnViaje, setSoloEnViaje] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const qs = eventId ? `?eventId=${eventId}` : "";
      const data = await apiFetch<Snapshot>(`/vip-monitoring/snapshot${qs}`);
      setSnapshot(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el monitoreo VIP.");
    } finally {
      setCargando(false);
    }
  }, [eventId]);

  useEffect(() => {
    setCargando(true);
    void cargar();
    const timer = setInterval(() => void cargar(), 10_000);
    return () => clearInterval(timer);
  }, [cargar]);

  useEffect(() => {
    apiFetch<EventItem[]>("/events")
      .then((e) => setEventos(Array.isArray(e) ? e : []))
      .catch(() => setEventos([]));
  }, []);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.vips ?? [])
      .filter((v) => (soloEnViaje ? !!v.trip?.active : true))
      .filter((v) => (q ? `${v.fullName} ${v.phone ?? ""}`.toLowerCase().includes(q) : true));
  }, [snapshot, search, soloEnViaje]);

  const markers: PresenceMarker[] = useMemo(
    () =>
      visibles
        .filter((v) => v.position)
        .map((v) => ({
          id: v.id,
          lat: v.position!.lat,
          lng: v.position!.lng,
          name: v.fullName,
          online: !!v.trip?.active,
          onTrip: !!v.trip?.active,
          tripLabel: v.trip ? (TRIP_LABEL[v.trip.status] ?? v.trip.status) : null,
          lastSeen: v.position!.timestamp ? ago(v.position!.timestamp) : "en vivo",
          gpsTime: v.position!.timestamp
            ? new Date(v.position!.timestamp).toLocaleTimeString("es-CL")
            : "GPS del pasajero",
          activeTrips: v.trip ? 1 : 0,
          platform: v.position!.source === "PASSENGER" ? "GPS del VIP" : "GPS del vehículo",
          clientTypes: ["VIP"],
        })),
    [visibles],
  );

  if (cargando && !snapshot) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />
        <div className="h-[420px] rounded-2xl animate-pulse" style={{ background: "var(--elevated)" }} />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="p-6">
        <EmptyState
          variant="warning"
          icon={<AlertIcon />}
          title="No se pudo cargar el monitoreo VIP"
          description={error}
          action={<button className="btn btn-primary" onClick={() => { setCargando(true); void cargar(); }}>Reintentar</button>}
        />
      </div>
    );
  }

  const stats = snapshot?.stats ?? { total: 0, enViaje: 0, conUbicacion: 0 };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Monitoreo de Usuarios VIP"
        description="Ubicación permanente de los VIP: el portal reporta el GPS del teléfono mientras está abierto (con o sin viaje), con respaldo del vehículo asignado."
        icon={<PinIcon size={24} />}
        meta={
          snapshot && (
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              En vivo · se actualiza cada 10 s · {new Date(snapshot.ts).toLocaleTimeString("es-CL")}
            </span>
          )
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Usuarios VIP" value={stats.total} icon={<UsersIcon size={18} />} accent="amber" />
        <KpiCard
          label="En viaje ahora"
          value={stats.enViaje}
          detail={stats.enViaje > 0 ? "con viaje activo" : "sin viajes activos"}
          icon={<RouteIcon size={18} />}
          accent="green"
        />
        <KpiCard
          label="Con ubicación"
          value={stats.conUbicacion}
          detail="reportando GPS"
          icon={<PinIcon size={18} />}
          accent="blue"
        />
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>
            <SearchIcon size={15} />
          </span>
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar VIP por nombre o teléfono…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {eventos.length > 0 && (
          <select className="input" style={{ maxWidth: 240 }} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Todos los eventos</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.name || "Evento sin nombre"}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setSoloEnViaje((v) => !v)}
          className="text-xs font-bold px-3 py-2 rounded-lg"
          style={{
            border: `1px solid ${soloEnViaje ? "var(--brand)" : "var(--border)"}`,
            background: soloEnViaje ? "rgba(33,208,179,0.12)" : "transparent",
            color: soloEnViaje ? "#0a7a6b" : "var(--text-muted)",
            cursor: "pointer",
          }}>
          Sólo en viaje
        </button>
      </section>

      {/* Mapa */}
      <section className="surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>Mapa en vivo</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {markers.length} VIP con ubicación visible
          </span>
        </div>
        {markers.length > 0 ? (
          <DriverPresenceMap markers={markers} height={420} />
        ) : (
          <div className="h-[280px] rounded-xl flex flex-col items-center justify-center gap-2"
            style={{ background: "var(--elevated)", border: "1px dashed var(--border)" }}>
            <PinIcon size={28} color="#94a3b8" />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Sin ubicaciones que mostrar</p>
            <p className="text-xs text-center" style={{ color: "var(--text-faint)", maxWidth: 420 }}>
              La ubicación aparece cuando el VIP abre su portal con permiso de ubicación
              (tracking permanente) o cuando va en un vehículo transmitiendo GPS.
            </p>
          </div>
        )}
      </section>

      {/* Tabla */}
      <section className="surface rounded-2xl overflow-hidden">
        <div className="px-4 py-3" style={{ background: "var(--elevated)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
            Detalle ({visibles.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 760 }}>
            <thead>
              <tr style={{ background: "var(--elevated)" }}>
                {["VIP", "Estado", "Viaje", "Conductor", "Ubicación", "Última señal"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase"
                    style={{ letterSpacing: "0.08em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((v) => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-2.5">
                    <p className="font-bold" style={{ color: "var(--text)" }}>{v.fullName}</p>
                    {v.phone && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{v.phone}</p>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {v.trip ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={v.trip.active
                          ? { background: "rgba(16,185,129,0.12)", color: "#047857", border: "1px solid rgba(16,185,129,0.4)" }
                          : { background: "rgba(37,99,235,0.10)", color: "#1e40af", border: "1px solid rgba(37,99,235,0.35)" }}>
                        {TRIP_LABEL[v.trip.status] ?? v.trip.status}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ background: "var(--elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        Sin viaje hoy
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text)" }}>
                    {v.trip ? (
                      <span className="text-xs">
                        {[v.trip.origin, v.trip.destination].filter(Boolean).join(" → ") || "—"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {v.trip?.driverName || "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {v.position ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={v.position.source === "PASSENGER"
                          ? { background: "#fef3c7", color: "#7a4a00", border: "1px solid #fcd34d" }
                          : { background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd" }}>
                        {v.position.source === "PASSENGER" ? "GPS del VIP" : "GPS del vehículo"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {v.position ? (v.position.timestamp ? ago(v.position.timestamp) : "en vivo") : "—"}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No hay usuarios VIP que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
