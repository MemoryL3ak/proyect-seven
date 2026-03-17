"use client";

import { useEffect, useMemo, useState } from "react";
import ResourceScreen from "@/components/ResourceScreen";
import { apiFetch } from "@/lib/api";
import { resources } from "@/lib/resources";

type Hotel = { id: string; name?: string | null };
type CapacityRow = {
  roomType: string;
  rooms: number;
  totalCapacity: number;
  assigned: number;
  available: number;
};

export default function HotelAssignmentsPage() {
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [roomType, setRoomType] = useState("DOUBLE");
  const [refreshKey, setRefreshKey] = useState(0);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [keepCountryTogether, setKeepCountryTogether] = useState(true);
  const [keepDisciplineTogether, setKeepDisciplineTogether] = useState(true);
  const [avoidMixedGender, setAvoidMixedGender] = useState(true);
  const [avoidMinorAdultMix, setAvoidMinorAdultMix] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiFetch<Hotel[]>("/accommodations")
      .then((rows) => {
        if (ignore) return;
        const safe = Array.isArray(rows) ? rows : [];
        setHotels(safe);
        if (!selectedHotelId && safe[0]?.id) setSelectedHotelId(safe[0].id);
      })
      .catch(() => {
        if (ignore) return;
        setHotels([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadCapacity = async (hotelId: string) => {
    if (!hotelId) {
      setCapacity([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await apiFetch<CapacityRow[]>(`/hotel-assignments/capacity/${hotelId}`);
      setCapacity(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar capacidad");
      setCapacity([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapacity(selectedHotelId);
  }, [selectedHotelId, refreshKey]);

  const selectedHotelLabel = useMemo(
    () => hotels.find((item) => item.id === selectedHotelId)?.name || selectedHotelId,
    [hotels, selectedHotelId],
  );

  const autoAssign = async () => {
    if (!selectedHotelId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ created?: Array<{ id: string }>; unassigned?: Array<{ participantId: string }> }>(
        "/hotel-assignments/auto-assign-by-room-type",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hotelId: selectedHotelId,
            roomType,
            assignmentsCount: 1,
            keepCountryTogether,
            keepDisciplineTogether,
            avoidMixedGender,
            avoidMinorAdultMix,
          }),
        },
      );

      const created = result?.created?.length || 0;
      const unassigned = result?.unassigned?.length || 0;
      setMessage(`Autoasignación ejecutada. Asignados: ${created}. Sin asignar: ${unassigned}.`);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo autoasignar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <section className="surface rounded-2xl p-3">
        <div className="flex gap-2">
          <button
            className={`btn ${tab === "manual" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("manual")}
            type="button"
          >
            Asignación manual
          </button>
          <button
            className={`btn ${tab === "auto" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("auto")}
            type="button"
          >
            Asignación automática
          </button>
        </div>
      </section>

      {tab === "manual" ? (
        <ResourceScreen
          config={resources.hotelAssignments}
          refreshKey={refreshKey}
          onDataChanged={() => setRefreshKey((value) => value + 1)}
        />
      ) : (
        <section className="surface rounded-3xl p-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <select className="input" value={selectedHotelId} onChange={(event) => setSelectedHotelId(event.target.value)}>
              <option value="">Selecciona hotel</option>
              {hotels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id}
                </option>
              ))}
            </select>
            <select className="input" value={roomType} onChange={(event) => setRoomType(event.target.value)}>
              <option value="SINGLE">Single</option>
              <option value="DOUBLE">Double</option>
              <option value="TRIPLE">Triple</option>
              <option value="SUITE">Suite</option>
            </select>
            <button className="btn btn-primary" type="button" onClick={autoAssign} disabled={saving || !selectedHotelId}>
              {saving ? "Autoasignando..." : "Autoasignar"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepCountryTogether} onChange={(e) => setKeepCountryTogether(e.target.checked)} /> Todo el país en un hotel</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepDisciplineTogether} onChange={(e) => setKeepDisciplineTogether(e.target.checked)} /> Toda la disciplina en un hotel</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avoidMixedGender} onChange={(e) => setAvoidMixedGender(e.target.checked)} /> No mezclar sexo en habitación</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avoidMinorAdultMix} onChange={(e) => setAvoidMinorAdultMix(e.target.checked)} /> No mezclar menor con mayor</label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo habitación</th>
                  <th>N° habitaciones</th>
                  <th>Capacidad total</th>
                  <th>Asignados</th>
                  <th>Disponible</th>
                </tr>
              </thead>
              <tbody>
                {(capacity || []).map((row) => (
                  <tr key={row.roomType}>
                    <td>{row.roomType}</td>
                    <td>{row.rooms}</td>
                    <td>{row.totalCapacity}</td>
                    <td>{row.assigned}</td>
                    <td>{row.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && capacity.length === 0 ? (
              <p className="p-3 text-sm text-white/60">Sin datos de capacidad para {selectedHotelLabel || "el hotel"}.</p>
            ) : null}
          </div>

          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        </section>
      )}
    </div>
  );
}
