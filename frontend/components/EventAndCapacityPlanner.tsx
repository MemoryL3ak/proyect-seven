"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type EventItem = {
  id: string;
  name?: string | null;
  disciplineIds?: string[];
  config?: Record<string, unknown> | null;
};

type DisciplineItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null; eventId?: string | null };

type NumericMap = Record<string, number>;
type NumericStringMap = Record<string, string>;
type MatrixStringMap = Record<string, NumericStringMap>;

type SavedDelegationMatrix = Record<string, NumericMap>;

function readDisciplineTotals(config?: Record<string, unknown> | null): NumericMap {
  const raw = config?.andExpectedByDiscipline;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: NumericMap = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n >= 0) result[key] = n;
  });
  return result;
}

function readDelegationMatrix(config?: Record<string, unknown> | null): SavedDelegationMatrix {
  const raw = config?.andExpectedByDisciplineDelegation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: SavedDelegationMatrix = {};
  Object.entries(raw as Record<string, unknown>).forEach(([disciplineId, nested]) => {
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) return;
    const row: NumericMap = {};
    Object.entries(nested as Record<string, unknown>).forEach(([delegationId, value]) => {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n) && n >= 0) row[delegationId] = n;
    });
    result[disciplineId] = row;
  });
  return result;
}

function sumRow(values?: NumericStringMap) {
  if (!values) return 0;
  return Object.values(values).reduce((sum, raw) => {
    const n = Number(raw);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}

export default function EventAndCapacityPlanner() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("");
  const [disciplineTotals, setDisciplineTotals] = useState<NumericStringMap>({});
  const [delegationMatrix, setDelegationMatrix] = useState<MatrixStringMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, delegationData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<DisciplineItem[]>("/disciplines"),
        apiFetch<DelegationItem[]>("/delegations"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      setEvents(safeEvents);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      if (!selectedEventId && safeEvents.length) setSelectedEventId(safeEvents[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar planificacion AND del evento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const disciplineNameMap = useMemo(
    () => new Map(disciplines.map((item) => [item.id, item.name || item.id])),
    [disciplines],
  );

  const eventDisciplines = useMemo(() => {
    if (!selectedEvent) return [] as Array<{ id: string; name: string }>;
    return (selectedEvent.disciplineIds ?? []).map((id) => ({
      id,
      name: disciplineNameMap.get(id) || id,
    }));
  }, [selectedEvent, disciplineNameMap]);

  const eventDelegations = useMemo(
    () => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [delegations, selectedEventId],
  );

  useEffect(() => {
    if (!selectedEvent) {
      setDisciplineTotals({});
      setDelegationMatrix({});
      setSelectedDisciplineId("");
      return;
    }

    const totalsSaved = readDisciplineTotals(selectedEvent.config);
    const matrixSaved = readDelegationMatrix(selectedEvent.config);
    const nextTotals: NumericStringMap = {};
    const nextMatrix: MatrixStringMap = {};

    (selectedEvent.disciplineIds ?? []).forEach((disciplineId) => {
      nextTotals[disciplineId] = totalsSaved[disciplineId] !== undefined ? String(totalsSaved[disciplineId]) : "";
      nextMatrix[disciplineId] = {};
      eventDelegations.forEach((delegation) => {
        const value = matrixSaved[disciplineId]?.[delegation.id];
        nextMatrix[disciplineId][delegation.id] = value !== undefined ? String(value) : "";
      });
    });

    setDisciplineTotals(nextTotals);
    setDelegationMatrix(nextMatrix);
    setSelectedDisciplineId((prev) => {
      if (prev && (selectedEvent.disciplineIds ?? []).includes(prev)) return prev;
      return selectedEvent.disciplineIds?.[0] ?? "";
    });
  }, [selectedEvent, eventDelegations]);

  const selectedDiscipline = useMemo(
    () => eventDisciplines.find((item) => item.id === selectedDisciplineId) ?? null,
    [eventDisciplines, selectedDisciplineId],
  );

  const plannerRows = useMemo(() => {
    return eventDisciplines.map((discipline) => {
      const total = Number(disciplineTotals[discipline.id] || 0) || 0;
      const allocated = sumRow(delegationMatrix[discipline.id]);
      const balance = total - allocated;
      return { ...discipline, total, allocated, balance };
    });
  }, [eventDisciplines, disciplineTotals, delegationMatrix]);

  const totalExpected = useMemo(() => plannerRows.reduce((sum, row) => sum + row.total, 0), [plannerRows]);
  const totalAllocated = useMemo(() => plannerRows.reduce((sum, row) => sum + row.allocated, 0), [plannerRows]);
  const totalBalance = totalExpected - totalAllocated;

  const selectedDisciplineSummary = useMemo(() => {
    if (!selectedDiscipline) return { total: 0, allocated: 0, balance: 0 };
    const total = Number(disciplineTotals[selectedDiscipline.id] || 0) || 0;
    const allocated = sumRow(delegationMatrix[selectedDiscipline.id]);
    return { total, allocated, balance: total - allocated };
  }, [selectedDiscipline, disciplineTotals, delegationMatrix]);

  const save = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const andExpectedByDiscipline: NumericMap = {};
      const andExpectedByDisciplineDelegation: SavedDelegationMatrix = {};

      Object.entries(disciplineTotals).forEach(([disciplineId, raw]) => {
        if (!raw.trim()) return;
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) andExpectedByDiscipline[disciplineId] = n;
      });

      Object.entries(delegationMatrix).forEach(([disciplineId, row]) => {
        const cleanRow: NumericMap = {};
        Object.entries(row).forEach(([delegationId, raw]) => {
          if (!raw.trim()) return;
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) cleanRow[delegationId] = n;
        });
        if (Object.keys(cleanRow).length > 0) andExpectedByDisciplineDelegation[disciplineId] = cleanRow;
      });

      await apiFetch(`/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...(selectedEvent.config ?? {}),
            andExpectedByDiscipline,
            andExpectedByDisciplineDelegation,
          },
        }),
      });

      setMessage("Planificacion AND guardada: capacidad por disciplina y por delegacion.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la planificacion AND.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface rounded-3xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Planificacion AND</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Capacidad esperada por disciplina y delegacion</h2>
          <p className="mt-1 text-sm text-slate-500">
            Define el objetivo de llegada/registro para cada disciplina y distribuyelo por delegacion del evento.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={save} disabled={!selectedEvent || saving || loading}>
          {saving ? "Guardando..." : "Guardar planificacion AND"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <select
          className="input lg:col-span-2"
          value={selectedEventId}
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            setMessage(null);
            setError(null);
          }}
        >
          <option value="">Selecciona un evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name || event.id}</option>
          ))}
        </select>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">Total esperado</div>
          <div className="text-lg font-semibold text-slate-900">{totalExpected}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">Asignado a delegaciones</div>
          <div className="text-lg font-semibold text-slate-900">{totalAllocated}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Balance global:</span>{" "}
        <span className={totalBalance === 0 ? "font-semibold text-emerald-700" : totalBalance > 0 ? "font-semibold text-amber-700" : "font-semibold text-rose-700"}>
          {totalBalance > 0 ? `Faltan ${totalBalance} por asignar` : totalBalance < 0 ? `Exceso de ${Math.abs(totalBalance)} asignados` : "Cuadre perfecto"}
        </span>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-500">Cargando planificacion...</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading && selectedEvent && eventDisciplines.length === 0 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este evento no tiene disciplinas asociadas. Primero agrega disciplinas en el formulario de Eventos y luego configura la planificacion AND.
        </p>
      ) : null}

      {eventDisciplines.length > 0 ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Objetivo por disciplina</h3>
              <span className="text-xs text-slate-500">{plannerRows.length} disciplinas</span>
            </div>
            <div className="space-y-2">
              {plannerRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedDisciplineId(row.id)}
                  className={[
                    "w-full rounded-xl border p-3 text-left transition",
                    selectedDisciplineId === row.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Asignado {row.allocated} / Objetivo {row.total}
                      </p>
                    </div>
                    <input
                      className="input h-10 w-28"
                      type="number"
                      min={0}
                      step={1}
                      value={disciplineTotals[row.id] ?? ""}
                      onChange={(e) => setDisciplineTotals((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="0"
                    />
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full ${row.balance < 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${row.total > 0 ? Math.min(Math.round((row.allocated / row.total) * 100), 100) : 0}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-xs ${row.balance === 0 ? "text-emerald-700" : row.balance > 0 ? "text-amber-700" : "text-rose-700"}`}>
                    {row.balance === 0 ? "Distribucion completa" : row.balance > 0 ? `Faltan ${row.balance} por distribuir` : `Exceso de ${Math.abs(row.balance)}`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedDiscipline ? `Distribucion por delegacion: ${selectedDiscipline.name}` : "Distribucion por delegacion"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Define cuanto deberia registrar cada delegacion para la disciplina seleccionada.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Objetivo</div>
                  <div className="font-semibold text-slate-900">{selectedDisciplineSummary.total}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Asignado</div>
                  <div className="font-semibold text-slate-900">{selectedDisciplineSummary.allocated}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Balance</div>
                  <div className={`font-semibold ${selectedDisciplineSummary.balance === 0 ? "text-emerald-700" : selectedDisciplineSummary.balance > 0 ? "text-amber-700" : "text-rose-700"}`}>
                    {selectedDisciplineSummary.balance}
                  </div>
                </div>
              </div>
            </div>

            {!selectedDiscipline ? (
              <p className="mt-4 text-sm text-slate-500">Selecciona una disciplina para asignar cupos por delegacion.</p>
            ) : eventDelegations.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No hay delegaciones creadas para este evento.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Delegacion</th>
                      <th>Cupo esperado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventDelegations.map((delegation) => (
                      <tr key={delegation.id}>
                        <td className="font-medium text-slate-900">{delegation.countryCode || delegation.id}</td>
                        <td className="w-[220px]">
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step={1}
                            value={delegationMatrix[selectedDiscipline.id]?.[delegation.id] ?? ""}
                            onChange={(e) =>
                              setDelegationMatrix((prev) => ({
                                ...prev,
                                [selectedDiscipline.id]: {
                                  ...(prev[selectedDiscipline.id] ?? {}),
                                  [delegation.id]: e.target.value,
                                },
                              }))
                            }
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
