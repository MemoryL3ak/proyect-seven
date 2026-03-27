"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import ResourceScreen from "@/components/ResourceScreen";
import { apiFetch } from "@/lib/api";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";

type BulkRow = { participant_id: string; hotel_id: string; room_number?: string; checkin_at?: string; checkout_at?: string };
type BulkResult = { participantId: string; status: "created" | "error"; message?: string };

type Hotel = { id: string; name?: string | null; accommodationType?: string | null; tower?: string | null };
type CapacityRow = {
  roomType: string;
  rooms: number;
  totalCapacity: number;
  assigned: number;
  available: number;
};

export default function HotelAssignmentsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [accommodationTypeFilter, setAccommodationTypeFilter] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [roomType, setRoomType] = useState("DOUBLE");
  const [refreshKey, setRefreshKey] = useState(0);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkRows([]);
    setBulkResults(null);
    setBulkError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const rows: BulkRow[] = raw.map((r) => ({
          participant_id: String(r["participant_id"] ?? "").trim(),
          hotel_id: String(r["hotel_id"] ?? "").trim(),
          room_number: String(r["room_number"] ?? "").trim() || undefined,
          checkin_at: String(r["checkin_at"] ?? "").trim() || undefined,
          checkout_at: String(r["checkout_at"] ?? "").trim() || undefined,
        })).filter((r) => r.participant_id && r.hotel_id);
        setBulkRows(rows);
      } catch {
        setBulkError("No se pudo leer el archivo.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadBulkTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["participant_id", "hotel_id", "room_number", "checkin_at", "checkout_at"],
      ["uuid-participante", "uuid-hotel", "101", "2026-06-01T14:00:00", "2026-06-10T12:00:00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asignaciones");
    XLSX.writeFile(wb, "plantilla_asignacion_hotel.xlsx");
  };

  const runBulkImport = async () => {
    if (!bulkRows.length) return;
    setBulkImporting(true);
    setBulkResults(null);
    setBulkError(null);
    try {
      const results = await apiFetch<BulkResult[]>("/hotel-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkRows.map((r) => ({
          participantId: r.participant_id,
          hotelId: r.hotel_id,
          roomNumber: r.room_number,
          checkinAt: r.checkin_at,
          checkoutAt: r.checkout_at,
        }))),
      });
      setBulkResults(results ?? []);
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Error en la importación");
    } finally {
      setBulkImporting(false);
      if (bulkFileRef.current) bulkFileRef.current.value = "";
    }
  };

  const [keepCountryTogether, setKeepCountryTogether] = useState(true);
  const [keepDisciplineTogether, setKeepDisciplineTogether] = useState(true);
  const [avoidMixedGender, setAvoidMixedGender] = useState(true);
  const [avoidMinorAdultMix, setAvoidMinorAdultMix] = useState(true);
  const [avoidMixedClientType, setAvoidMixedClientType] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiFetch<Hotel[]>("/accommodations")
      .then((rows) => {
        if (ignore) return;
        const safe = (Array.isArray(rows) ? rows : []).map((r: any) => ({
          id: r.id,
          name: r.name ?? null,
          accommodationType: String(r.accommodationType || "HOTEL").toUpperCase(),
          tower: r.tower ?? null,
        }));
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

  const hotelLabel = (item: Hotel) => {
    if (item.accommodationType === "VILLA" && item.tower) return `${item.name || item.id} – Torre ${item.tower}`;
    return item.name || item.id;
  };

  const filteredHotels = useMemo(
    () => accommodationTypeFilter ? hotels.filter((h) => h.accommodationType === accommodationTypeFilter) : hotels,
    [hotels, accommodationTypeFilter],
  );

  const selectedHotelLabel = useMemo(
    () => { const h = hotels.find((item) => item.id === selectedHotelId); return h ? hotelLabel(h) : selectedHotelId; },
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
            avoidMixedClientType,
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
            {t("Asignación manual")}
          </button>
          <button
            className={`btn ${tab === "auto" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("auto")}
            type="button"
          >
            {t("Asignación automática")}
          </button>
        </div>
      </section>

      {tab === "manual" ? (
        <>
<section className="surface rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-label">{t("Carga masiva de asignaciones")}</p>
              <button type="button" className="btn btn-ghost text-xs" onClick={downloadBulkTemplate}>
                {t("Descargar plantilla")}
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              El archivo debe contener las columnas: <strong>participant_id</strong>, <strong>hotel_id</strong>, <strong>room_number</strong> (opcional), <strong>checkin_at</strong> / <strong>checkout_at</strong> (opcional).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={bulkFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                id="hotel-bulk-file"
                onChange={handleBulkFile}
              />
              <label htmlFor="hotel-bulk-file" className="btn btn-ghost cursor-pointer">
                {t("Seleccionar archivo")}
              </label>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {bulkRows.length > 0 ? `${bulkRows.length} ${t("fila(s).")}` : t("Sin archivo seleccionado")}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bulkRows.length || bulkImporting}
                onClick={runBulkImport}
              >
                {bulkImporting ? t("Cargando...") : `${t("Cargar")} ${bulkRows.length} ${t("fila(s).")}`}
              </button>
            </div>
            {bulkRows.length > 0 && !bulkResults && (
              <div className="overflow-x-auto rounded-xl border border-white/10 max-h-48">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>participant_id</th>
                      <th>hotel_id</th>
                      <th>room_number</th>
                      <th>checkin_at</th>
                      <th>checkout_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono">{r.participant_id}</td>
                        <td className="font-mono">{r.hotel_id}</td>
                        <td>{r.room_number ?? "—"}</td>
                        <td>{r.checkin_at ?? "—"}</td>
                        <td>{r.checkout_at ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkRows.length > 20 && <p className="p-2 text-xs text-white/40">…y {bulkRows.length - 20} más</p>}
              </div>
            )}
            {bulkResults && (
              <div className="space-y-1 text-sm">
                <p className="text-emerald-400">
                  Importados: {bulkResults.filter((r) => r.status === "created").length} / {bulkResults.length}
                </p>
                {bulkResults.filter((r) => r.status === "error").map((r, i) => (
                  <p key={i} className="text-rose-400 text-xs">{r.participantId}: {r.message}</p>
                ))}
              </div>
            )}
            {bulkError && <p className="text-sm text-rose-400">{bulkError}</p>}
          </section>
          <ResourceScreen
            config={resources.hotelAssignments}
            refreshKey={refreshKey}
            onDataChanged={() => setRefreshKey((value) => value + 1)}
          />
        </>
      ) : (
        <section className="surface rounded-3xl p-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <select className="input" value={accommodationTypeFilter} onChange={(e) => { setAccommodationTypeFilter(e.target.value); setSelectedHotelId(""); }}>
              <option value="">Hotel / Villa</option>
              <option value="HOTEL">{t("Hotel")}</option>
              <option value="VILLA">{t("Villa Panamericana")}</option>
            </select>
            <select className="input" value={selectedHotelId} onChange={(event) => setSelectedHotelId(event.target.value)}>
              <option value="">Selecciona {accommodationTypeFilter === "VILLA" ? "villa" : accommodationTypeFilter === "HOTEL" ? "hotel" : "alojamiento"}</option>
              {filteredHotels.map((item) => (
                <option key={item.id} value={item.id}>
                  {hotelLabel(item)}
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
              {saving ? t("Autoasignando...") : t("Autoasignar")}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepCountryTogether} onChange={(e) => setKeepCountryTogether(e.target.checked)} /> {t("Todo el país en un hotel")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepDisciplineTogether} onChange={(e) => setKeepDisciplineTogether(e.target.checked)} /> {t("Toda la disciplina en un hotel")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avoidMixedGender} onChange={(e) => setAvoidMixedGender(e.target.checked)} /> {t("No mezclar género en habitación")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avoidMinorAdultMix} onChange={(e) => setAvoidMinorAdultMix(e.target.checked)} /> {t("No mezclar menor con mayor")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avoidMixedClientType} onChange={(e) => setAvoidMixedClientType(e.target.checked)} /> {t("No mezclar tipos de clientes")}</label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Tipo habitación")}</th>
                  <th>{t("N° habitaciones")}</th>
                  <th>{t("Capacidad total")}</th>
                  <th>{t("Asignados")}</th>
                  <th>{t("Disponible")}</th>
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
              <p className="p-3 text-sm text-white/60">Sin datos de capacidad para {selectedHotelLabel || "el alojamiento seleccionado"}.</p>
            ) : null}
          </div>

          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        </section>
      )}
    </div>
  );
}
