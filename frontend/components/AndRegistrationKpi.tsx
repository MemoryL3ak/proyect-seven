"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type EventItem = {
  id: string;
  name?: string | null;
  disciplineIds?: string[];
  config?: Record<string, unknown> | null;
  expectedCapacities?: Array<{
    disciplineId?: string | null;
    delegationCode?: string | null;
    expectedCount?: number | string | null;
  }> | null;
};

type DisciplineItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null; eventId?: string | null };
type AthleteItem = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
};

type KpiProps = {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
};

function percentValue(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function formatPercent(pct: number) {
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  if (pct < 1) return `${pct.toFixed(1)}%`;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function normalizeDelegationKey(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function readDelegationExpected(
  row: Record<string, number> | undefined,
  delegationId?: string | null,
  delegationCountryCode?: string | null,
) {
  if (!row) return undefined;
  const candidates = [
    delegationId,
    delegationCountryCode,
    normalizeDelegationKey(delegationId),
    normalizeDelegationKey(delegationCountryCode),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return row[candidate];
    const normalizedMatch = Object.entries(row).find(
      ([key]) => normalizeDelegationKey(key) === normalizeDelegationKey(candidate),
    );
    if (normalizedMatch) return normalizedMatch[1];
  }

  return undefined;
}

function readExpectedByDiscipline(config?: Record<string, unknown> | null) {
  const raw = config?.andExpectedByDiscipline;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as Record<string, number>;
  const result: Record<string, number> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n >= 0) result[key] = n;
  });
  return result;
}

function readExpectedByDisciplineDelegation(config?: Record<string, unknown> | null) {
  const raw = config?.andExpectedByDisciplineDelegation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as Record<string, Record<string, number>>;
  const result: Record<string, Record<string, number>> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([disciplineId, nested]) => {
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) return;
    const row: Record<string, number> = {};
    Object.entries(nested as Record<string, unknown>).forEach(([delegationId, value]) => {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n) && n >= 0) row[delegationId] = n;
    });
    result[disciplineId] = row;
  });
  return result;
}

function readExpectedFromRows(event?: EventItem | null) {
  const totals: Record<string, number> = {};
  const matrix: Record<string, Record<string, number>> = {};
  const rows = Array.isArray(event?.expectedCapacities) ? event?.expectedCapacities : [];
  rows.forEach((row) => {
    const disciplineId = String(row?.disciplineId ?? "").trim();
    const delegationCode = String(row?.delegationCode ?? "").trim().toUpperCase();
    const n = typeof row?.expectedCount === "number" ? row.expectedCount : Number(row?.expectedCount);
    if (!disciplineId || !delegationCode || !Number.isFinite(n) || n < 0) return;
    matrix[disciplineId] = matrix[disciplineId] || {};
    matrix[disciplineId][delegationCode] = n;
    totals[disciplineId] = (totals[disciplineId] ?? 0) + n;
  });
  return { totals, matrix };
}

export default function AndRegistrationKpi({
  title = "Cumplimiento AND: esperado vs registrado",
  subtitle = "Compara el objetivo definido en Eventos con los participantes registrados en Arrival & Departure por disciplina.",
  eyebrow = "AND KPI",
}: KpiProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, delegationData, athleteData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<DisciplineItem[]>("/disciplines"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<AthleteItem[]>("/athletes"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      setEvents(safeEvents);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      setAthletes(Array.isArray(athleteData) ? athleteData : []);
      if (!selectedEventId && safeEvents.length) setSelectedEventId(safeEvents[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar KPI AND.");
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

  const disciplineMap = useMemo(
    () => new Map(disciplines.map((item) => [item.id, item.name || item.id])),
    [disciplines],
  );

  const filteredDelegations = useMemo(
    () => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [delegations, selectedEventId],
  );
  const selectedDelegationCountryCode = useMemo(
    () =>
      selectedDelegationId
        ? filteredDelegations.find((item) => item.id === selectedDelegationId)?.countryCode || ""
        : "",
    [filteredDelegations, selectedDelegationId],
  );

  const rows = useMemo(() => {
    if (!selectedEvent) return [] as Array<{
      disciplineId: string;
      disciplineName: string;
      expected: number;
      registered: number;
      pct: number | null;
      variance: number | null;
      statusTone: "good" | "warn" | "over";
      hasDelegationExpected: boolean;
    }>;

    const expectedFromRows = readExpectedFromRows(selectedEvent);
    const expectedByDiscipline =
      Object.keys(expectedFromRows.totals).length > 0
        ? expectedFromRows.totals
        : readExpectedByDiscipline(selectedEvent.config);
    const expectedByDisciplineDelegation =
      Object.keys(expectedFromRows.matrix).length > 0
        ? expectedFromRows.matrix
        : readExpectedByDisciplineDelegation(selectedEvent.config);

    const eventAthletes = athletes.filter((a) => a.eventId === selectedEvent.id);
    const scopedAthletes = selectedDelegationId
      ? eventAthletes.filter((a) => a.delegationId === selectedDelegationId)
      : eventAthletes;

    const actualByDiscipline = new Map<string, number>();
    scopedAthletes.forEach((athlete) => {
      const key = athlete.disciplineId ?? "SIN_DISCIPLINA";
      actualByDiscipline.set(key, (actualByDiscipline.get(key) ?? 0) + 1);
    });

    const allIds = new Set<string>([
      ...(selectedEvent.disciplineIds ?? []),
      ...Object.keys(expectedByDiscipline),
      ...Object.keys(expectedByDisciplineDelegation),
      ...Array.from(actualByDiscipline.keys()),
    ]);

    return Array.from(allIds)
      .map((disciplineId) => {
        const delegationSpecificExpected = selectedDelegationId
          ? readDelegationExpected(
              expectedByDisciplineDelegation[disciplineId],
              selectedDelegationId,
              selectedDelegationCountryCode,
            )
          : undefined;
        const totalExpectedByDiscipline =
          expectedByDiscipline[disciplineId] ??
          Object.values(expectedByDisciplineDelegation[disciplineId] ?? {}).reduce((s, n) => s + n, 0);
        const hasDelegationExpected = !selectedDelegationId || delegationSpecificExpected !== undefined;
        const expected = selectedDelegationId
          ? (delegationSpecificExpected ?? 0)
          : totalExpectedByDiscipline;
        const registered = actualByDiscipline.get(disciplineId) ?? 0;
        const pct = hasDelegationExpected ? percentValue(registered, expected) : null;
        const variance = hasDelegationExpected ? registered - expected : null;
        const statusTone = (pct ?? 0) > 100 ? "over" : (pct ?? 0) >= 100 ? "good" : "warn";
        return {
          disciplineId,
          disciplineName: disciplineId === "SIN_DISCIPLINA" ? "Sin disciplina" : disciplineMap.get(disciplineId) || disciplineId,
          expected,
          registered,
          pct,
          variance,
          statusTone,
          hasDelegationExpected,
        };
      })
      .sort((a, b) => a.disciplineName.localeCompare(b.disciplineName));
  }, [selectedEvent, athletes, selectedDelegationId, selectedDelegationCountryCode, disciplineMap]);

  const totals = useMemo(() => {
    const comparableRows = selectedDelegationId ? rows.filter((row) => row.hasDelegationExpected) : rows;
    const expected = comparableRows.reduce((sum, row) => sum + row.expected, 0);
    const registered = rows.reduce((sum, row) => sum + row.registered, 0);
    const hasComparableExpected = comparableRows.length > 0 && comparableRows.some((row) => row.expected > 0 || row.hasDelegationExpected);
    const pct = hasComparableExpected ? percentValue(registered, expected) : null;
    const variance = hasComparableExpected ? registered - expected : null;
    return { expected, registered, pct, variance, hasComparableExpected };
  }, [rows, selectedDelegationId]);

  return (
    <section className="surface rounded-3xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
          {loading ? "Actualizando..." : "Refrescar KPI"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_2fr_1fr_1fr]">
        <select className="input" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
          <option value="">Selecciona evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name || event.id}</option>
          ))}
        </select>
        <select className="input" value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
          <option value="">Todas las delegaciones</option>
          {filteredDelegations.map((delegation) => (
            <option key={delegation.id} value={delegation.id}>{delegation.countryCode || delegation.id}</option>
          ))}
        </select>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">Esperado</div>
          <div className="text-lg font-semibold text-slate-900">
            {selectedDelegationId && !totals.hasComparableExpected ? "-" : totals.expected}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">Registrado</div>
          <div className="text-lg font-semibold text-slate-900">{totals.registered}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cumplimiento total</p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-3xl font-semibold text-emerald-700">
              {totals.pct === null ? "N/D" : formatPercent(totals.pct)}
            </p>
            <p className="pb-1 text-sm text-slate-500">esperado vs registrado</p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(totals.pct ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Brecha neta</p>
          <p
            className={`mt-2 text-3xl font-semibold ${
              totals.variance === null
                ? "text-slate-500"
                : totals.variance < 0
                  ? "text-rose-700"
                  : totals.variance > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
            }`}
          >
            {totals.variance === null ? "-" : totals.variance > 0 ? `+${totals.variance}` : totals.variance}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {totals.variance === null
              ? "Sin meta por delegacion configurada"
              : "Participantes respecto del objetivo definido"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vista activa</p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {selectedDelegationId
              ? `Delegacion ${filteredDelegations.find((d) => d.id === selectedDelegationId)?.countryCode || selectedDelegationId}`
              : "Consolidado del evento"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {selectedDelegationId
              ? totals.hasComparableExpected
                ? "Usa capacidad por disciplina + delegacion"
                : "Sin meta esperada por delegacion (solo registro real)"
              : "Usa capacidad total por disciplina"}
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Esperado</th>
              <th>Registrado</th>
              <th>Brecha</th>
              <th>Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.disciplineId}>
                <td className="font-medium text-slate-900">{row.disciplineName}</td>
                <td>{row.hasDelegationExpected ? row.expected : "-"}</td>
                <td>{row.registered}</td>
                <td className={row.variance === null ? "text-slate-400" : row.variance < 0 ? "text-rose-600" : row.variance > 0 ? "text-amber-700" : "text-emerald-700"}>
                  {row.variance === null ? "-" : row.variance > 0 ? `+${row.variance}` : row.variance}
                </td>
                <td>
                  <div className="flex min-w-[220px] items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${row.statusTone === "good" ? "bg-emerald-500" : row.statusTone === "over" ? "bg-amber-500" : "bg-cyan-500"}`}
                        style={{ width: `${Math.min(row.pct ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="min-w-[52px] text-right text-xs font-semibold text-slate-700">
                      {row.pct === null ? "N/D" : formatPercent(row.pct)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Define primero la planificacion AND en Eventos (capacidad por disciplina y por delegacion) para ver este KPI.
        </p>
      ) : null}
    </section>
  );
}
