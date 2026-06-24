"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import { TruckIcon, UsersIcon, SearchIcon, RefreshIcon, CheckIcon, AlertIcon } from "@/components/ui/Icons";

type DriverAvailability = {
  id: string;
  fullName: string;
  rut: string | null;
  phone: string | null;
  status: string;
  online: boolean;
  secondsSinceSeen: number | null;
  accessTypes: string[];
  allowedClientTypes: string[];
  preferredVehicleId: string | null;
  preferredVehiclePlate: string | null;
  activeTripId: string | null;
  activeTripStatus: string | null;
  activeTripDestination: string | null;
  activeTripClientType: string | null;
  activeTripScheduledAt: string | null;
  availability: "FREE" | "ON_TRIP" | "OFFLINE" | "INACTIVE";
};

type VehicleAvailability = {
  id: string;
  plate: string;
  type: string;
  brand: string | null;
  model: string | null;
  capacity: number;
  status: string;
  activeTripId: string | null;
  activeTripStatus: string | null;
  activeTripDestination: string | null;
  activeTripDriverId: string | null;
  activeTripDriverName: string | null;
  activeTripScheduledAt: string | null;
  availability: "FREE" | "ON_TRIP" | "OUT_OF_SERVICE";
};

type Snapshot = {
  ts: string;
  drivers: DriverAvailability[];
  vehicles: VehicleAvailability[];
  summary: {
    drivers: { total: number; free: number; onTrip: number; offline: number; inactive: number };
    vehicles: { total: number; free: number; onTrip: number; outOfService: number };
  };
};

const DRIVER_AVAILABILITY_META: Record<DriverAvailability["availability"], { label: string; color: string; bg: string; border: string }> = {
  FREE:     { label: "Libre",      color: "#059669", bg: "#dcfce7", border: "#86efac" },
  ON_TRIP:  { label: "En viaje",   color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  OFFLINE:  { label: "Offline",    color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  INACTIVE: { label: "Inactivo",   color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
};

const VEHICLE_AVAILABILITY_META: Record<VehicleAvailability["availability"], { label: string; color: string; bg: string; border: string }> = {
  FREE:           { label: "Disponible", color: "#059669", bg: "#dcfce7", border: "#86efac" },
  ON_TRIP:        { label: "En ruta",    color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  OUT_OF_SERVICE: { label: "Fuera de servicio", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
};

function ago(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

type EventOption = { id: string; name: string };

export default function FleetAvailabilityPage() {
  const [section, setSection] = useState<"availability" | "drivers" | "vehicles">("availability");
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"both" | "drivers" | "vehicles">("both");
  const [driverFilter, setDriverFilter] = useState<"" | DriverAvailability["availability"]>("");
  const [vehicleFilter, setVehicleFilter] = useState<"" | VehicleAvailability["availability"]>("");
  const [search, setSearch] = useState("");

  // Cargar eventos al montar
  useEffect(() => {
    apiFetch<EventOption[]>("/events")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setEventOptions(list);
        if (list.length === 1) setSelectedEventId(list[0].id);
      })
      .catch(() => setEventOptions([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Snapshot>("/fleet/availability");
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la disponibilidad.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const int = setInterval(load, 8000);
    return () => clearInterval(int);
  }, [load]);

  const visibleDrivers = useMemo(() => {
    if (!snapshot) return [];
    const q = search.trim().toLowerCase();
    return snapshot.drivers.filter(d => {
      if (driverFilter && d.availability !== driverFilter) return false;
      if (q && !`${d.fullName} ${d.rut ?? ""} ${d.preferredVehiclePlate ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [snapshot, driverFilter, search]);

  const visibleVehicles = useMemo(() => {
    if (!snapshot) return [];
    const q = search.trim().toLowerCase();
    return snapshot.vehicles.filter(v => {
      if (vehicleFilter && v.availability !== vehicleFilter) return false;
      if (q && !`${v.plate} ${v.type} ${v.brand ?? ""} ${v.model ?? ""} ${v.activeTripDriverName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [snapshot, vehicleFilter, search]);

  const sd = snapshot?.summary.drivers ?? { total: 0, free: 0, onTrip: 0, offline: 0, inactive: 0 };
  const sv = snapshot?.summary.vehicles ?? { total: 0, free: 0, onTrip: 0, outOfService: 0 };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader
        title="Flota"
        description="Conductores y vehículos. Registra nuevos o mira la disponibilidad en tiempo real para asignar viajes."
        icon={<TruckIcon size={26} />}
        iconBg="linear-gradient(135deg, #21D0B3 0%, #1f4e8c 100%)"
        accentStrip="teal"
        meta={
          section === "availability" ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
              style={{ background: "#e7f5ec", color: "#1eb19a" }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#21D0B3",
                boxShadow: "0 0 0 3px rgba(33,208,179,0.25)", animation: "pulse 1.8s infinite",
              }} />
              En vivo · se actualiza cada 8 s
            </span>
          ) : undefined
        }
        action={
          section === "availability" ? (
            <button type="button" className="btn btn-ghost text-xs" onClick={load}>
              <RefreshIcon size={13} className="inline-block mr-1" /> Refrescar
            </button>
          ) : undefined
        }
      />

      {/* Secciones */}
      <section className="surface rounded-2xl p-3">
        <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: "#f1f5f9" }}>
          {([
            { v: "availability", label: "📊 Disponibilidad", hint: "Vista en tiempo real" },
            { v: "drivers", label: "🧑‍✈ Conductores", hint: "Registro de conductores" },
            { v: "vehicles", label: "🚗 Vehículos", hint: "Registro de vehículos" },
          ] as const).map(s => {
            const active = section === s.v;
            return (
              <button key={s.v} type="button" onClick={() => setSection(s.v)}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: active ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "transparent",
                  color: active ? "#fff" : "#475569",
                  boxShadow: active ? "0 2px 6px rgba(33,208,179,0.35)" : "none",
                  textAlign: "left",
                  lineHeight: 1.2,
                }}>
                <div>{s.label}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 1, fontWeight: 600 }}>{s.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      {section !== "availability" && (
        <CrudSection
          section={section}
          eventOptions={eventOptions}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
        />
      )}

      {section !== "availability" && <div className="hidden">
        {/* placeholder para mantener el resto del JSX en este if-chain */}
      </div>}

      {section === "availability" && error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}

      {section === "availability" && (<>


      {/* KPIs en 2 grupos: drivers + vehicles */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          title="Conductores"
          subtitle={`${sd.total} total · ${sd.free} libres · ${sd.onTrip} en viaje`}
          icon={<UsersIcon size={20} />}
          stats={[
            { label: "Libres", value: sd.free, color: "#059669" },
            { label: "En viaje", value: sd.onTrip, color: "#7c3aed" },
            { label: "Offline", value: sd.offline, color: "#64748b" },
          ]}
        />
        <KpiTile
          title="Vehículos"
          subtitle={`${sv.total} total · ${sv.free} disponibles · ${sv.onTrip} en ruta`}
          icon={<TruckIcon size={20} />}
          stats={[
            { label: "Disponibles", value: sv.free, color: "#059669" },
            { label: "En ruta", value: sv.onTrip, color: "#7c3aed" },
            { label: "Fuera servicio", value: sv.outOfService, color: "#dc2626" },
          ]}
        />
        <article className="surface rounded-2xl p-4">
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            Cobertura de viajes
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#21D0B3", lineHeight: 1.1, marginTop: 4 }}>
            {sd.onTrip + sv.onTrip > 0 ? `${sd.onTrip}/${sv.onTrip}` : "0/0"}
          </p>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            conductores en viaje / vehículos en ruta
          </p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            Capacidad libre ahora
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#1FCDFF", lineHeight: 1.1, marginTop: 4 }}>
            {Math.min(sd.free, sv.free)}
          </p>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            asignaciones posibles (conductor + vehículo libre)
          </p>
        </article>
      </section>

      {/* Tabs + búsqueda */}
      <section className="surface rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f1f5f9" }}>
            {(["both", "drivers", "vehicles"] as const).map(t => {
              const active = activeTab === t;
              return (
                <button key={t} type="button" onClick={() => setActiveTab(t)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "transparent",
                    color: active ? "#fff" : "#475569",
                    boxShadow: active ? "0 2px 6px rgba(33,208,179,0.35)" : "none",
                  }}>
                  {t === "both" ? "Ambos" : t === "drivers" ? "Solo conductores" : "Solo vehículos"}
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
              <SearchIcon size={15} />
            </span>
            <input className="input" style={{ paddingLeft: 36 }}
              placeholder="Buscar conductor, patente, vehículo…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </section>

      {loading && !snapshot ? (
        <section className="surface rounded-2xl p-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando flota…</p>
        </section>
      ) : (
        <section className={activeTab === "both" ? "grid gap-4 lg:grid-cols-2" : ""}>
          {(activeTab === "both" || activeTab === "drivers") && (
            <DriverColumn
              drivers={visibleDrivers}
              filter={driverFilter}
              setFilter={setDriverFilter}
              counts={sd}
            />
          )}
          {(activeTab === "both" || activeTab === "vehicles") && (
            <VehicleColumn
              vehicles={visibleVehicles}
              filter={vehicleFilter}
              setFilter={setVehicleFilter}
              counts={sv}
            />
          )}
        </section>
      )}
      </>)}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CRUD Section — Conductores y Vehículos
// ────────────────────────────────────────────────────────────────────────────

type DriverRow = {
  id: string;
  fullName: string;
  rut: string;
  email?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  status?: string;
  allowedClientTypes?: string[];
  accessTypes?: string[];
  vehicleId?: string | null;
  metadata?: Record<string, unknown>;
};

type VehicleRow = {
  id: string;
  plate: string;
  type: string;
  brand?: string | null;
  model?: string | null;
  capacity?: number;
  status?: string;
};

const CLIENT_TYPE_DRIVER_OPTIONS = [
  { value: "TF", label: "TF — Familiares" },
  { value: "TM", label: "TM — Médico" },
  { value: "TA", label: "TA — Deportistas" },
  { value: "VIP", label: "VIP" },
  { value: "T1", label: "T1 — Autoridades" },
  { value: "FAMILIA_PARAPAN", label: "Familia Parapan" },
  { value: "COMITE_ORGANIZADOR", label: "Comité Organizador" },
  { value: "PROVEEDORES", label: "Proveedores" },
];

const ACCESS_TYPE_OPTIONS = [
  { value: "C", label: "C (Competencia)" },
  { value: "TR", label: "TR (Training)" },
  { value: "H", label: "H (Hospedaje)" },
  { value: "R", label: "R (Restaurant)" },
  { value: "A", label: "A (Ampliación)" },
  { value: "RD", label: "RD (Restringida)" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "AUTO", label: "Auto" },
  { value: "VAN", label: "Van" },
  { value: "MINIBUS", label: "Minibus" },
  { value: "BUS", label: "Bus" },
  { value: "MOTO", label: "Moto" },
  { value: "OTRO", label: "Otro" },
];

const VEHICLE_STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "MAINTENANCE", label: "En mantenimiento" },
  { value: "OUT_OF_SERVICE", label: "Fuera de servicio" },
];

function CrudSection({
  section,
  eventOptions,
  selectedEventId,
  setSelectedEventId,
}: {
  section: "drivers" | "vehicles";
  eventOptions: EventOption[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
}) {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (section === "drivers") {
        const d = await apiFetch<DriverRow[]>("/drivers");
        setDrivers(Array.isArray(d) ? d : []);
      } else {
        const v = await apiFetch<VehicleRow[]>("/transports");
        setVehicles(Array.isArray(v) ? v : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (section === "drivers") {
      return drivers.filter(d => !q ||
        `${d.fullName} ${d.rut} ${d.email ?? ""} ${d.phone ?? ""} ${d.licenseNumber ?? ""}`.toLowerCase().includes(q)
      );
    }
    return vehicles.filter(v => !q ||
      `${v.plate} ${v.type} ${v.brand ?? ""} ${v.model ?? ""}`.toLowerCase().includes(q)
    );
  }, [search, section, drivers, vehicles]);

  const remove = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) return;
    try {
      const path = section === "drivers" ? `/drivers/${id}` : `/transports/${id}`;
      await apiFetch(path, { method: "DELETE" });
      setMessage("Eliminado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando");
    }
  };

  const noEventSelected = !selectedEventId;

  return (
    <>
      <section className="surface rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          {eventOptions.length > 1 && (
            <label className="text-sm block">
              <span className="block mb-1">Evento</span>
              <select className="input" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">— Seleccionar evento —</option>
                {eventOptions.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm block" style={{ flex: 1, minWidth: 200 }}>
            <span className="block mb-1">Buscar</span>
            <input className="input"
              placeholder={section === "drivers" ? "Nombre, RUT, email…" : "Patente, marca, modelo…"}
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setModalOpen(true)}
            disabled={noEventSelected}
            title={noEventSelected ? "Selecciona un evento primero" : ""}
          >
            + {section === "drivers" ? "Nuevo conductor" : "Nuevo vehículo"}
          </button>
        </div>
        {noEventSelected && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Selecciona un evento para poder registrar nuevos {section === "drivers" ? "conductores" : "vehículos"}.
          </p>
        )}
        {error && (
          <p className="text-xs mt-2" style={{ color: "#b3231b" }}>{error}</p>
        )}
        {message && !error && (
          <p className="text-xs mt-2" style={{ color: "#2e7d32" }}>{message}</p>
        )}
      </section>

      {/* Lista */}
      {loading && filtered.length === 0 ? (
        <section className="surface rounded-2xl p-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando…</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="surface rounded-2xl p-12 text-center">
          <p className="text-3xl mb-2">{section === "drivers" ? "🧑‍✈" : "🚗"}</p>
          <p className="text-sm font-bold" style={{ color: "#0f172a" }}>
            Sin {section === "drivers" ? "conductores" : "vehículos"} registrados
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Empezá creando el primero con el botón de arriba.
          </p>
        </section>
      ) : (
        <section className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  {section === "drivers" ? (
                    <>
                      <th className="p-3 text-left">Nombre</th>
                      <th className="p-3 text-left">RUT</th>
                      <th className="p-3 text-left">Contacto</th>
                      <th className="p-3 text-left">Vehículo</th>
                      <th className="p-3 text-left">Tipos cliente</th>
                      <th className="p-3 text-left">Estado</th>
                      <th className="p-3"></th>
                    </>
                  ) : (
                    <>
                      <th className="p-3 text-left">Patente</th>
                      <th className="p-3 text-left">Vehículo</th>
                      <th className="p-3 text-left">Tipo</th>
                      <th className="p-3 text-left">Capacidad</th>
                      <th className="p-3 text-left">Estado</th>
                      <th className="p-3"></th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {section === "drivers" && (filtered as DriverRow[]).map((d, i) => (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                    <td className="p-3 font-semibold">{d.fullName}</td>
                    <td className="p-3 font-mono text-[11px]">{d.rut}</td>
                    <td className="p-3" style={{ color: "var(--text-muted)" }}>
                      {d.email && <div>{d.email}</div>}
                      {d.phone && <div className="text-[10px]">{d.phone}</div>}
                    </td>
                    <td className="p-3" style={{ color: "var(--text-muted)" }}>
                      {d.vehicleId ? <span className="text-[11px]">Asignado</span> : <span className="text-[11px] text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(d.allowedClientTypes || []).slice(0, 3).map(c => (
                          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: "#dbeafe", color: "#1e40af" }}>{c}</span>
                        ))}
                        {(d.allowedClientTypes?.length ?? 0) > 3 && (
                          <span className="text-[9px] text-gray-400">+{(d.allowedClientTypes!.length - 3)}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: d.status === "ACTIVE" ? "#dcfce7" : "#f1f5f9",
                          color: d.status === "ACTIVE" ? "#166534" : "#64748b",
                        }}>
                        {d.status === "ACTIVE" ? "Activo" : (d.status || "—")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-[11px] underline" style={{ color: "#b3231b" }}
                        onClick={() => remove(d.id, d.fullName)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {section === "vehicles" && (filtered as VehicleRow[]).map((v, i) => (
                  <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                    <td className="p-3">
                      <span style={{
                        background: "#0f172a", color: "#fff",
                        fontFamily: "monospace", fontWeight: 800, fontSize: 12,
                        padding: "4px 10px", borderRadius: 5,
                        border: "2px solid #fde68a",
                      }}>{v.plate}</span>
                    </td>
                    <td className="p-3 font-semibold">
                      {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="p-3" style={{ color: "var(--text-muted)" }}>{v.type}</td>
                    <td className="p-3">{v.capacity ?? 0} pax</td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: v.status === "AVAILABLE" ? "#dcfce7" : "#fef2f2",
                          color: v.status === "AVAILABLE" ? "#166534" : "#7a1313",
                        }}>
                        {v.status === "AVAILABLE" ? "Disponible" : (v.status || "—")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-[11px] underline" style={{ color: "#b3231b" }}
                        onClick={() => remove(v.id, v.plate)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalOpen && (section === "drivers"
        ? <DriverFormModal
            eventId={selectedEventId}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); reload(); setMessage("Conductor creado."); }}
          />
        : <VehicleFormModal
            eventId={selectedEventId}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); reload(); setMessage("Vehículo creado."); }}
          />
      )}
    </>
  );
}

function DriverFormModal({ eventId, onClose, onSaved }: {
  eventId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "", rut: "", email: "", phone: "", licenseNumber: "",
    allowedClientTypes: [] as string[],
    accessTypes: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleArray = (key: "allowedClientTypes" | "accessTypes", value: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value],
    }));
  };

  const submit = async () => {
    if (!form.fullName.trim() || !form.rut.trim()) {
      setError("Nombre y RUT son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, eventId, status: "ACTIVE" }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando conductor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">Nuevo conductor</h2>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <label className="text-sm block">
            <span className="block mb-1">Nombre completo *</span>
            <input className="input" value={form.fullName}
              onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="block mb-1">RUT *</span>
              <input className="input font-mono" value={form.rut}
                placeholder="12345678-9"
                onChange={(e) => setForm(f => ({ ...f, rut: e.target.value }))} />
            </label>
            <label className="text-sm block">
              <span className="block mb-1">N° licencia</span>
              <input className="input" value={form.licenseNumber}
                onChange={(e) => setForm(f => ({ ...f, licenseNumber: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="block mb-1">Email</span>
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="text-sm block">
              <span className="block mb-1">Teléfono</span>
              <input className="input" value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              Tipos de cliente que puede transportar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_TYPE_DRIVER_OPTIONS.map(o => {
                const sel = form.allowedClientTypes.includes(o.value);
                return (
                  <button key={o.value} type="button"
                    onClick={() => toggleArray("allowedClientTypes", o.value)}
                    className="text-[11px] px-2.5 py-1 rounded-full font-bold transition"
                    style={{
                      background: sel ? "#1f4e8c" : "#eef1f6",
                      color: sel ? "#fff" : "#1f4e8c",
                    }}>
                    {sel ? "✓ " : ""}{o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              Tipos de acceso (credencial)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ACCESS_TYPE_OPTIONS.map(o => {
                const sel = form.accessTypes.includes(o.value);
                return (
                  <button key={o.value} type="button"
                    onClick={() => toggleArray("accessTypes", o.value)}
                    className="text-[11px] px-2.5 py-1 rounded-full font-bold transition"
                    style={{
                      background: sel ? "#21D0B3" : "#eef1f6",
                      color: sel ? "#fff" : "#0a7a6b",
                    }}>
                    {sel ? "✓ " : ""}{o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: "#b3231b" }}>{error}</p>}
        </div>
        <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Crear conductor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleFormModal({ eventId, onClose, onSaved }: {
  eventId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    plate: "", type: "AUTO", brand: "", model: "", capacity: 4, status: "AVAILABLE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.plate.trim() || !form.type.trim()) {
      setError("Patente y tipo son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/transports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, eventId, plate: form.plate.toUpperCase() }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando vehículo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Nuevo vehículo</h2>
          <button onClick={onClose} className="text-sm">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="block mb-1">Patente *</span>
              <input className="input font-mono uppercase" value={form.plate}
                placeholder="AB-1234"
                onChange={(e) => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
            </label>
            <label className="text-sm block">
              <span className="block mb-1">Tipo *</span>
              <select className="input" value={form.type}
                onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>
                {VEHICLE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="block mb-1">Marca</span>
              <input className="input" value={form.brand}
                onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))} />
            </label>
            <label className="text-sm block">
              <span className="block mb-1">Modelo</span>
              <input className="input" value={form.model}
                onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="block mb-1">Capacidad (pax)</span>
              <input className="input" type="number" min={0} value={form.capacity}
                onChange={(e) => setForm(f => ({ ...f, capacity: Number(e.target.value) || 0 }))} />
            </label>
            <label className="text-sm block">
              <span className="block mb-1">Estado</span>
              <select className="input" value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                {VEHICLE_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="text-xs" style={{ color: "#b3231b" }}>{error}</p>}
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Crear vehículo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────────────────

function KpiTile({ title, subtitle, icon, stats }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  stats: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <article className="surface rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: "rgba(33,208,179,0.12)", color: "#21D0B3",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{title}</p>
          <p style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-3 mt-2">
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </p>
            <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, fontWeight: 600 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function DriverColumn({ drivers, filter, setFilter, counts }: {
  drivers: DriverAvailability[];
  filter: "" | DriverAvailability["availability"];
  setFilter: (v: "" | DriverAvailability["availability"]) => void;
  counts: { total: number; free: number; onTrip: number; offline: number; inactive: number };
}) {
  return (
    <section className="surface rounded-2xl overflow-hidden">
      <header className="p-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "#eef1f6" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            Conductores
          </p>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
            {drivers.length} {drivers.length === 1 ? "conductor" : "conductores"}
          </h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["", "Todos", counts.total],
            ["FREE", "Libres", counts.free],
            ["ON_TRIP", "En viaje", counts.onTrip],
            ["OFFLINE", "Offline", counts.offline],
          ] as const).map(([v, label, n]) => {
            const active = filter === v;
            return (
              <button key={v || "all"} type="button" onClick={() => setFilter(v as any)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1.5"
                style={{
                  background: active ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "#f1f5f9",
                  color: active ? "#fff" : "#475569",
                }}>
                {label}
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : "#fff", color: active ? "#fff" : "#64748b", fontWeight: 800 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </header>
      <div className="divide-y" style={{ borderColor: "#eef1f6", maxHeight: 600, overflowY: "auto" }}>
        {drivers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold" style={{ color: "#475569" }}>Sin conductores</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Prueba quitando filtros</p>
          </div>
        ) : drivers.map(d => {
          const meta = DRIVER_AVAILABILITY_META[d.availability];
          return (
            <div key={d.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: d.online ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "linear-gradient(135deg, #cbd5e1, #94a3b8)",
                color: "#fff", fontSize: 12, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: d.online ? "0 2px 6px rgba(33,208,179,0.3)" : "none",
                flexShrink: 0,
              }}>
                {initials(d.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "#0f172a" }}>{d.fullName}</p>
                <p className="text-[11px] truncate" style={{ color: "#64748b" }}>
                  {d.preferredVehiclePlate && <>🚗 {d.preferredVehiclePlate} · </>}
                  {d.allowedClientTypes.length > 0 ? d.allowedClientTypes.join(", ") : "Sin tipos asignados"}
                </p>
                {d.availability === "ON_TRIP" && d.activeTripDestination && (
                  <p className="text-[10px] mt-0.5" style={{ color: "#7c3aed", fontWeight: 600 }}>
                    → {d.activeTripDestination}{d.activeTripClientType && ` · ${d.activeTripClientType}`}
                  </p>
                )}
                {d.availability === "OFFLINE" && d.secondsSinceSeen !== null && (
                  <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>
                    Última conexión hace {ago(d.secondsSinceSeen)}
                  </p>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99,
                background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VehicleColumn({ vehicles, filter, setFilter, counts }: {
  vehicles: VehicleAvailability[];
  filter: "" | VehicleAvailability["availability"];
  setFilter: (v: "" | VehicleAvailability["availability"]) => void;
  counts: { total: number; free: number; onTrip: number; outOfService: number };
}) {
  return (
    <section className="surface rounded-2xl overflow-hidden">
      <header className="p-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "#eef1f6" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            Vehículos
          </p>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
            {vehicles.length} {vehicles.length === 1 ? "vehículo" : "vehículos"}
          </h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["", "Todos", counts.total],
            ["FREE", "Disponibles", counts.free],
            ["ON_TRIP", "En ruta", counts.onTrip],
            ["OUT_OF_SERVICE", "Fuera", counts.outOfService],
          ] as const).map(([v, label, n]) => {
            const active = filter === v;
            return (
              <button key={v || "all"} type="button" onClick={() => setFilter(v as any)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1.5"
                style={{
                  background: active ? "linear-gradient(135deg, #21D0B3, #1eb19a)" : "#f1f5f9",
                  color: active ? "#fff" : "#475569",
                }}>
                {label}
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : "#fff", color: active ? "#fff" : "#64748b", fontWeight: 800 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </header>
      <div className="divide-y" style={{ borderColor: "#eef1f6", maxHeight: 600, overflowY: "auto" }}>
        {vehicles.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold" style={{ color: "#475569" }}>Sin vehículos</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Prueba quitando filtros</p>
          </div>
        ) : vehicles.map(v => {
          const meta = VEHICLE_AVAILABILITY_META[v.availability];
          return (
            <div key={v.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div style={{
                width: 50, height: 30, borderRadius: 6,
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                color: "#fff", fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace", letterSpacing: "0.04em",
                flexShrink: 0,
                border: "2px solid #fde68a",
              }}>
                {v.plate}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "#0f172a" }}>
                  {[v.brand, v.model].filter(Boolean).join(" ") || v.type}
                </p>
                <p className="text-[11px] truncate" style={{ color: "#64748b" }}>
                  {v.type} · 👥 {v.capacity} pax
                </p>
                {v.availability === "ON_TRIP" && (
                  <p className="text-[10px] mt-0.5" style={{ color: "#7c3aed", fontWeight: 600 }}>
                    {v.activeTripDriverName && <>🧑‍✈ {v.activeTripDriverName} · </>}
                    {v.activeTripDestination && <>→ {v.activeTripDestination}</>}
                  </p>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99,
                background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
