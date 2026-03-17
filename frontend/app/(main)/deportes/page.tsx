"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type EventExpectedCapacity = {
  disciplineId: string;
  delegationCode: string;
  expectedCount: number;
};

type EventItem = {
  id: string;
  name?: string | null;
  expectedCapacities?: EventExpectedCapacity[];
};

type Discipline = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  category?: string | null;
  gender?: string | null;
};

type Delegation = {
  id: string;
  eventId?: string | null;
  countryCode?: string | null;
};

type Athlete = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
};

type QuotaState = Record<string, string>;

type PlanningRow = {
  key: string;
  delegationId: string;
  delegationCode: string;
  disciplineId: string;
  disciplineName: string;
  category: string;
  gender: string;
  andCount: number;
};

const CATEGORY_OPTIONS = [
  { label: "Todos los tipos", value: "" },
  { label: "Convencional", value: "CONVENTIONAL" },
  { label: "Paralímpica", value: "PARALYMPIC" },
];

const GENDER_OPTIONS = [
  { label: "Todos los géneros", value: "" },
  { label: "Masculino", value: "MALE" },
  { label: "Femenino", value: "FEMALE" },
  { label: "Mixto", value: "MIXED" },
];

function categoryLabel(value?: string | null) {
  if (!value) return "-";
  if (value === "CONVENTIONAL") return "Convencional";
  if (value === "PARALYMPIC") return "Paralímpica";
  return value;
}

function genderLabel(value?: string | null) {
  if (!value) return "-";
  const normalized = value.trim().toUpperCase();
  if (normalized === "MALE" || normalized === "M") return "Masculino";
  if (normalized === "FEMALE" || normalized === "F") return "Femenino";
  if (normalized === "MIXED" || normalized === "X") return "Mixto";
  return value;
}

function quotaKey(delegationCode: string, disciplineId: string) {
  return `${delegationCode}::${disciplineId}`;
}

export default function DeportesPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [quotas, setQuotas] = useState<QuotaState>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, delegationData, athleteData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<Discipline[]>("/disciplines"),
        apiFetch<Delegation[]>("/delegations"),
        apiFetch<Athlete[]>("/athletes"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      setEvents(safeEvents);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      setAthletes(filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []));
      if (!selectedEventId && safeEvents.length > 0) {
        setSelectedEventId(safeEvents[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar planificación deportiva");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const eventDisciplines = useMemo(
    () => disciplines.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [disciplines, selectedEventId],
  );

  const eventDelegations = useMemo(
    () => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [delegations, selectedEventId],
  );

  const eventAthletes = useMemo(
    () => athletes.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [athletes, selectedEventId],
  );

  useEffect(() => {
    setSelectedDelegationId("");
    setSelectedDisciplineId("");
    setSelectedCategory("");
    setSelectedGender("");
    setPage(1);
    setMessage(null);
  }, [selectedEventId]);

  useEffect(() => {
    const next: QuotaState = {};
    (selectedEvent?.expectedCapacities || []).forEach((row) => {
      next[quotaKey(row.delegationCode.trim().toUpperCase(), row.disciplineId)] = String(
        Math.max(0, Number(row.expectedCount || 0)),
      );
    });
    setQuotas(next);
  }, [selectedEvent]);

  const allRows = useMemo(() => {
    const disciplineMap = new Map(eventDisciplines.map((item) => [item.id, item]));
    const delegationMap = new Map(eventDelegations.map((item) => [item.id, item]));
    const andCounts = new Map<string, number>();

    eventAthletes.forEach((athlete) => {
      const delegation = athlete.delegationId ? delegationMap.get(athlete.delegationId) : null;
      const discipline = athlete.disciplineId ? disciplineMap.get(athlete.disciplineId) : null;
      const delegationCode = String(delegation?.countryCode || "").trim().toUpperCase();
      if (!delegationCode || !athlete.disciplineId || !discipline) return;
      const key = quotaKey(delegationCode, athlete.disciplineId);
      andCounts.set(key, (andCounts.get(key) ?? 0) + 1);
    });

    return eventDelegations
      .flatMap((delegation) => {
        const delegationCode = String(delegation.countryCode || "").trim().toUpperCase();
        if (!delegationCode) return [] as PlanningRow[];

        return eventDisciplines.map((discipline) => {
          const key = quotaKey(delegationCode, discipline.id);
          return {
            key,
            delegationId: delegation.id,
            delegationCode,
            disciplineId: discipline.id,
            disciplineName: discipline.name || discipline.id,
            category: discipline.category || "",
            gender: discipline.gender || "",
            andCount: andCounts.get(key) ?? 0,
          } satisfies PlanningRow;
        });
      })
      .sort((a, b) => {
        const byDelegation = a.delegationCode.localeCompare(b.delegationCode);
        if (byDelegation !== 0) return byDelegation;
        const byDiscipline = a.disciplineName.localeCompare(b.disciplineName);
        if (byDiscipline !== 0) return byDiscipline;
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
        if (byCategory !== 0) return byCategory;
        return genderLabel(a.gender).localeCompare(genderLabel(b.gender));
      });
  }, [eventAthletes, eventDelegations, eventDisciplines]);

  const filteredRows = useMemo(
    () =>
      allRows.filter((row) => {
        if (selectedDelegationId && row.delegationId !== selectedDelegationId) return false;
        if (selectedDisciplineId && row.disciplineId !== selectedDisciplineId) return false;
        if (selectedCategory && row.category !== selectedCategory) return false;
        if (selectedGender && row.gender !== selectedGender) return false;
        return true;
      }),
    [allRows, selectedDelegationId, selectedDisciplineId, selectedCategory, selectedGender],
  );

  useEffect(() => {
    setPage(1);
  }, [selectedDelegationId, selectedDisciplineId, selectedCategory, selectedGender]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / pageSize)),
    [filteredRows.length],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const visibleQuotaTotal = useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        const current = Number(quotas[row.key] || "0");
        return sum + (Number.isFinite(current) ? Math.max(0, current) : 0);
      }, 0),
    [filteredRows, quotas],
  );

  const configuredRows = useMemo(
    () => filteredRows.filter((row) => Math.max(0, Math.floor(Number(quotas[row.key] || "0"))) > 0).length,
    [filteredRows, quotas],
  );

  const saveQuotas = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const visibleKeys = new Set(filteredRows.map((row) => row.key));
      const untouched = (selectedEvent.expectedCapacities || []).filter((row) => {
        const key = quotaKey(row.delegationCode.trim().toUpperCase(), row.disciplineId);
        return !visibleKeys.has(key);
      });
      const updated = filteredRows.map((row) => ({
        disciplineId: row.disciplineId,
        delegationCode: row.delegationCode,
        expectedCount: Math.max(0, Math.floor(Number(quotas[row.key] || "0"))),
      }));

      await apiFetch(`/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCapacities: [...untouched, ...updated],
        }),
      });

      setMessage("Cupos guardados correctamente para las filas visibles.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cupos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Deportes"
        description="Planificación AND por delegación y disciplina con edición centralizada de cupos."
      />

      <section className="surface rounded-3xl p-6">
        <div className="grid gap-3 lg:grid-cols-5">
          <select className="input lg:col-span-2" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
            <option value="">Selecciona evento</option>
            {events.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.name || eventItem.id}
              </option>
            ))}
          </select>

          <select className="input" value={selectedDelegationId} onChange={(event) => setSelectedDelegationId(event.target.value)}>
            <option value="">Todas las delegaciones</option>
            {eventDelegations.map((delegation) => (
              <option key={delegation.id} value={delegation.id}>
                {delegation.countryCode || delegation.id}
              </option>
            ))}
          </select>

          <select className="input" value={selectedDisciplineId} onChange={(event) => setSelectedDisciplineId(event.target.value)}>
            <option value="">Todas las disciplinas</option>
            {eventDisciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name || discipline.id}
              </option>
            ))}
          </select>

          <select className="input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-1">
          <select className="input" value={selectedGender} onChange={(event) => setSelectedGender(event.target.value)}>
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filas visibles</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{filteredRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cupo visible total</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{visibleQuotaTotal}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filas con cupo</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{configuredRows}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              Anterior
            </button>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              Página {page} de {totalPages}
            </div>
            <button className="btn btn-ghost" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
              Siguiente
            </button>
          </div>
          <button className="btn btn-primary" onClick={saveQuotas} disabled={saving || !selectedEventId || filteredRows.length === 0}>
            {saving ? "Guardando..." : "Guardar cupos"}
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="surface overflow-hidden rounded-3xl p-0">
        {loading ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">Cargando filas...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">No hay filas para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-700">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">Delegación</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">Disciplina</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">Tipo</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">Género</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">AND</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">Cupo esperado</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={row.key} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-4 py-4">{row.delegationCode}</td>
                    <td className="px-4 py-4 font-medium text-slate-900">{row.disciplineName}</td>
                    <td className="px-4 py-4">{categoryLabel(row.category)}</td>
                    <td className="px-4 py-4">{genderLabel(row.gender)}</td>
                    <td className="px-4 py-4">{row.andCount}</td>
                    <td className="px-4 py-3">
                      <input
                        className="input max-w-[140px] text-right font-semibold"
                        type="number"
                        min={0}
                        step={1}
                        value={quotas[row.key] ?? "0"}
                        onChange={(event) =>
                          setQuotas((prev) => ({
                            ...prev,
                            [row.key]: event.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
