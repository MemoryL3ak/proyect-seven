"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  TruckIcon,
  UsersIcon,
  CheckIcon,
  RefreshIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import type { PresenceMarker } from "@/components/DriverPresenceMap";

const DriverPresenceMap = dynamic(() => import("@/components/DriverPresenceMap"), {
  ssr: false,
});

type PresenceDriver = {
  driverId: string;
  fullName: string;
  driverStatus: string | null;
  online: boolean;
  sessionStartedAt: string | null;
  lastSeenAt: string | null;
  secondsSinceSeen: number | null;
  heartbeats: number | null;
  platform: string | null;
  appVersion: string | null;
  activeTrips: number;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
};

type Snapshot = {
  ts: string;
  stats: { totalDrivers: number; onlineNow: number; driversToday: number; sessionsToday: number };
  drivers: PresenceDriver[];
};

function ago(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}

export default function DriverMonitoringPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Snapshot>("/driver-presence/snapshot");
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const stats = snapshot?.stats ?? { totalDrivers: 0, onlineNow: 0, driversToday: 0, sessionsToday: 0 };
  const drivers = snapshot?.drivers ?? [];

  const markers = useMemo<PresenceMarker[]>(
    () =>
      drivers
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          id: d.driverId,
          lat: d.lat as number,
          lng: d.lng as number,
          name: d.fullName,
          online: d.online,
          lastSeen: ago(d.secondsSinceSeen),
          gpsTime:
            d.gpsTimestamp != null
              ? new Date(d.gpsTimestamp).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—",
          activeTrips: d.activeTrips,
          platform: d.platform,
        })),
    [drivers],
  );

  const exportCsv = () => {
    if (drivers.length === 0) return;
    downloadCSV(
      `monitoreo-conductores-${new Date().toISOString().slice(0, 10)}`,
      drivers.map((d) => ({
        conductor: d.fullName,
        estado: d.online ? "Conectado" : "Desconectado",
        ultima_conexion: d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("es-CL") : "Nunca",
        inicio_sesion: d.sessionStartedAt ? new Date(d.sessionStartedAt).toLocaleString("es-CL") : "—",
        latidos: d.heartbeats ?? 0,
        plataforma: d.platform ?? "—",
        viajes_activos: d.activeTrips,
        gps: d.gpsAgeSeconds == null ? "sin señal" : `hace ${Math.round(d.gpsAgeSeconds / 60)} min`,
      })),
    );
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Monitoreo de Conductores"
        description="Seguimiento en vivo de los conductores que tienen la aplicación abierta, hayan iniciado un viaje o no. Detecta presencia, sesiones y actividad de la app."
        icon={<TruckIcon size={24} />}
        meta={
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
            style={{ background: "#e7f5ec", color: "#1eb19a" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#21D0B3",
                boxShadow: "0 0 0 3px rgba(33,208,179,0.25)",
              }}
            />
            En vivo · se actualiza cada 8 s
          </span>
        }
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={drivers.length === 0}
            className="btn btn-ghost"
          >
            <UploadIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
            Exportar CSV
          </button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Conectados ahora"
          value={stats.onlineNow}
          detail="con la app abierta"
          icon={<UsersIcon size={18} />}
          accent={stats.onlineNow > 0 ? "green" : "neutral"}
        />
        <KpiCard
          label="Conductores totales"
          value={stats.totalDrivers}
          detail="registrados en el evento"
          icon={<TruckIcon size={18} />}
          accent="blue"
        />
        <KpiCard
          label="Activos hoy"
          value={stats.driversToday}
          detail="abrieron la app hoy"
          icon={<CheckIcon size={18} />}
          accent="purple"
        />
        <KpiCard
          label="Sesiones hoy"
          value={stats.sessionsToday}
          detail="aperturas de la app"
          icon={<RefreshIcon size={18} />}
          accent="amber"
        />
      </section>

      {error && (
        <section
          className="surface rounded-2xl p-4"
          style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}
        >
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}

      {drivers.length > 0 && (
        <section className="surface rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Mapa de conductores
            </h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {markers.length} con señal GPS
            </span>
          </div>
          {markers.length === 0 ? (
            <div
              className="rounded-xl flex items-center justify-center text-center px-4"
              style={{ height: 280, background: "#f1f5f9" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Ningún conductor tiene una posición GPS registrada todavía.
                <br />
                El mapa se poblará cuando la app de un conductor reporte su ubicación.
              </p>
            </div>
          ) : (
            <DriverPresenceMap markers={markers} height={420} />
          )}
        </section>
      )}

      {loading && !snapshot ? (
        <section className="surface rounded-2xl p-8">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando monitoreo…</p>
        </section>
      ) : drivers.length === 0 ? (
        <EmptyStateBox
          icon={<TruckIcon size={36} />}
          title="No hay conductores registrados"
          description="Cuando un conductor abra el Portal Conductor, su sesión aparecerá acá en tiempo real, haya iniciado un viaje o no."
        />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: "#1f4e8c", color: "#fff" }}>
                <tr>
                  <th className="p-3 text-left">Conductor</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Última conexión</th>
                  <th className="p-3 text-left">Sesión</th>
                  <th className="p-3 text-left">Viajes activos</th>
                  <th className="p-3 text-left">GPS</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => {
                  const gpsActive = d.gpsAgeSeconds != null && d.gpsAgeSeconds < 600;
                  return (
                    <tr key={d.driverId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 font-medium whitespace-nowrap">{d.fullName}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={
                            d.online
                              ? { backgroundColor: "#e7f5ec", color: "#2e7d32" }
                              : { backgroundColor: "#eef1f6", color: "#5e6b7a" }
                          }
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              marginRight: 5,
                              background: d.online ? "#2e7d32" : "#94a3b8",
                            }}
                          />
                          {d.online ? "Conectado" : "Desconectado"}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {ago(d.secondsSinceSeen)}
                      </td>
                      <td className="p-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {d.sessionStartedAt ? (
                          <>
                            {new Date(d.sessionStartedAt).toLocaleTimeString("es-CL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            <span> · {d.heartbeats ?? 0} latidos</span>
                            {d.platform && <span> · {d.platform}</span>}
                          </>
                        ) : (
                          "Nunca usó la app"
                        )}
                      </td>
                      <td className="p-3">
                        {d.activeTrips > 0 ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "#e3edfa", color: "#1f4e8c" }}
                          >
                            {d.activeTrips} en curso
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span style={{ color: gpsActive ? "#2e7d32" : "#94a3b8", fontWeight: 600 }}>
                          {gpsActive ? "● Reportando" : "○ Sin señal"}
                        </span>
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
