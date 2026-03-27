"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

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

type DisciplineItem = {
  id: string;
  name?: string | null;
  category?: string | null;
  gender?: string | null;
};
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

function typeLabel(value?: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "CONVENTIONAL") return "Convencional";
  if (normalized === "PARALYMPIC") return "Paralímpica";
  return value || "-";
}

function genderLabel(value?: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "M" || normalized === "MALE" || normalized === "MASCULINO") return "Masculino";
  if (normalized === "F" || normalized === "FEMALE" || normalized === "FEMENINO") return "Femenino";
  if (normalized === "X" || normalized === "MIXED" || normalized === "MIXTO") return "Mixto";
  return value || "-";
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
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("");
  const [maxRows, setMaxRows] = useState(100);
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
      setAthletes(filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []));
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
      delegationKey: string;
      delegationName: string;
      disciplineId: string;
      disciplineName: string;
      disciplineType: string;
      disciplineGender: string;
      expected: number;
      registered: number;
      pct: number | null;
      variance: number | null;
      statusTone: "good" | "warn" | "over";
      hasDelegationExpected: boolean;
    }>;

    const expectedFromRows = readExpectedFromRows(selectedEvent);
    const disciplineDataById = new Map(disciplines.map((item) => [item.id, item]));
    const expectedByDiscipline =
      Object.keys(expectedFromRows.totals).length > 0
        ? expectedFromRows.totals
        : readExpectedByDiscipline(selectedEvent.config);
    const expectedByDisciplineDelegation =
      Object.keys(expectedFromRows.matrix).length > 0
        ? expectedFromRows.matrix
        : readExpectedByDisciplineDelegation(selectedEvent.config);

    const eventAthletes = filterValidatedAthletes(athletes).filter((a) => a.eventId === selectedEvent.id);
    const delegationCodeById = new Map(
      filteredDelegations.map((item) => [item.id, normalizeDelegationKey(item.countryCode || item.id)]),
    );
    const delegationNameByCode = new Map(
      filteredDelegations.map((item) => [
        normalizeDelegationKey(item.countryCode || item.id),
        item.countryCode || item.id || "Sin delegación",
      ]),
    );
    const selectedDelegationCode = selectedDelegationId
      ? delegationCodeById.get(selectedDelegationId) || normalizeDelegationKey(selectedDelegationId)
      : "";

    const actualByDisciplineDelegation = new Map<string, number>();
    const actualByDiscipline = new Map<string, number>();
    eventAthletes.forEach((athlete) => {
      const disciplineKey = athlete.disciplineId ?? "SIN_DISCIPLINA";
      const delegationCode = normalizeDelegationKey(
        delegationCodeById.get(athlete.delegationId || "") || athlete.delegationId || "SIN_DELEGACION",
      );
      const compositeKey = `${disciplineKey}__${delegationCode}`;
      actualByDisciplineDelegation.set(compositeKey, (actualByDisciplineDelegation.get(compositeKey) ?? 0) + 1);
      actualByDiscipline.set(disciplineKey, (actualByDiscipline.get(disciplineKey) ?? 0) + 1);
      if (!delegationNameByCode.has(delegationCode)) {
        delegationNameByCode.set(delegationCode, delegationCode || "Sin delegación");
      }
    });

    const allIds = new Set<string>([
      ...(selectedEvent.disciplineIds ?? []),
      ...Object.keys(expectedByDiscipline),
      ...Object.keys(expectedByDisciplineDelegation),
      ...Array.from(actualByDiscipline.keys()),
    ]);

    return Array.from(allIds)
      .flatMap((disciplineId) => {
        const disciplineName =
          disciplineId === "SIN_DISCIPLINA" ? "Sin disciplina" : disciplineMap.get(disciplineId) || disciplineId;
        const disciplineData = disciplineDataById.get(disciplineId);
        const disciplineType = typeLabel(disciplineData?.category);
        const disciplineGender = genderLabel(disciplineData?.gender);
        const delegationRow = expectedByDisciplineDelegation[disciplineId] ?? {};
        const expectedDelegationCodes = Object.keys(delegationRow).map((key) =>
          normalizeDelegationKey(delegationCodeById.get(key) || key),
        );
        const actualDelegationCodes = Array.from(actualByDisciplineDelegation.keys())
          .filter((key) => key.startsWith(`${disciplineId}__`))
          .map((key) => key.split("__")[1]);
        const delegationCodesFromEvent = filteredDelegations.map((item) =>
          normalizeDelegationKey(item.countryCode || item.id),
        );

        const buildRow = (delegationCode: string, fallbackExpected: number | null = null) => {
          const expectedFromDelegation = Object.entries(delegationRow).find(([key]) => {
            const normalizedKey = normalizeDelegationKey(delegationCodeById.get(key) || key);
            return normalizedKey === delegationCode;
          });
          const expected =
            expectedFromDelegation !== undefined
              ? Number(expectedFromDelegation[1] ?? 0)
              : fallbackExpected ?? 0;
          const registered =
            actualByDisciplineDelegation.get(`${disciplineId}__${delegationCode}`) ?? 0;
          const hasDelegationExpected = expectedFromDelegation !== undefined || fallbackExpected !== null;
          const pct = hasDelegationExpected ? percentValue(registered, expected) : null;
          const variance = hasDelegationExpected ? registered - expected : null;
          const statusTone = (pct ?? 0) > 100 ? "over" : (pct ?? 0) >= 100 ? "good" : "warn";
          return {
            delegationKey: delegationCode,
            delegationName: delegationNameByCode.get(delegationCode) || delegationCode || "Sin delegación",
            disciplineId,
            disciplineName,
            disciplineType,
            disciplineGender,
            expected,
            registered,
            pct,
            variance,
            statusTone,
            hasDelegationExpected,
          };
        };

        if (selectedDelegationId) {
          const delegationSpecificExpected = readDelegationExpected(
            delegationRow,
            selectedDelegationId,
            selectedDelegationCountryCode,
          );
          return [buildRow(selectedDelegationCode, delegationSpecificExpected ?? null)];
        }

        const combinedCodes = new Set<string>([
          ...delegationCodesFromEvent,
          ...expectedDelegationCodes,
          ...actualDelegationCodes,
        ]);

        const totalExpectedByDiscipline =
          expectedByDiscipline[disciplineId] ??
          Object.values(delegationRow).reduce((s, n) => s + n, 0);

        if (combinedCodes.size === 0) {
          const registered = actualByDiscipline.get(disciplineId) ?? 0;
          const pct = percentValue(registered, totalExpectedByDiscipline);
          const variance = registered - totalExpectedByDiscipline;
          const statusTone = (pct ?? 0) > 100 ? "over" : (pct ?? 0) >= 100 ? "good" : "warn";
          return [
            {
              delegationKey: "TODAS",
              delegationName: "Todas",
              disciplineId,
              disciplineName,
              disciplineType,
              disciplineGender,
              expected: totalExpectedByDiscipline,
              registered,
              pct,
              variance,
              statusTone,
              hasDelegationExpected: true,
            },
          ];
        }

        return Array.from(combinedCodes).map((delegationCode) => buildRow(delegationCode));
      })
      .sort((a, b) => {
        const byDelegation = a.delegationName.localeCompare(b.delegationName);
        if (byDelegation !== 0) return byDelegation;
        return a.disciplineName.localeCompare(b.disciplineName);
      });
  }, [selectedEvent, athletes, selectedDelegationId, selectedDelegationCountryCode, disciplineMap, disciplines, filteredDelegations]);

  const disciplineOptions = useMemo(
    () =>
      rows
        .map((row) => ({ id: row.disciplineId, name: row.disciplineName }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  useEffect(() => {
    if (!selectedDisciplineId) return;
    const exists = disciplineOptions.some((item) => item.id === selectedDisciplineId);
    if (!exists) setSelectedDisciplineId("");
  }, [disciplineOptions, selectedDisciplineId]);

  const filteredRows = useMemo(
    () => (selectedDisciplineId ? rows.filter((row) => row.disciplineId === selectedDisciplineId) : rows),
    [rows, selectedDisciplineId],
  );

  const totals = useMemo(() => {
    const comparableRows = selectedDelegationId
      ? filteredRows.filter((row) => row.hasDelegationExpected)
      : filteredRows;
    const expected = comparableRows.reduce((sum, row) => sum + row.expected, 0);
    const registered = filteredRows.reduce((sum, row) => sum + row.registered, 0);
    const hasComparableExpected = comparableRows.length > 0 && comparableRows.some((row) => row.expected > 0 || row.hasDelegationExpected);
    const pct = hasComparableExpected ? percentValue(registered, expected) : null;
    const variance = hasComparableExpected ? registered - expected : null;
    return { expected, registered, pct, variance, hasComparableExpected };
  }, [filteredRows, selectedDelegationId]);

  const visibleRows = useMemo(() => filteredRows.slice(0, maxRows), [filteredRows, maxRows]);

  const deficitStats = useMemo(() => {
    const comparable = filteredRows.filter((r) => r.hasDelegationExpected && r.pct !== null);
    const deficit = comparable.filter((r) => (r.pct ?? 0) < 100);
    const onTrack = comparable.filter((r) => (r.pct ?? 0) >= 100);
    const uniqueDeficitDisciplines = new Set(deficit.map((r) => r.disciplineId)).size;
    return { deficit: deficit.length, onTrack: onTrack.length, uniqueDeficitDisciplines };
  }, [filteredRows]);

  const varianceColor = totals.variance === null
    ? "var(--text-muted)"
    : totals.variance < 0 ? "#ef4444"
    : totals.variance > 0 ? "#f59e0b"
    : "#10b981";

  const complianceColor = totals.pct === null
    ? "var(--text-muted)"
    : (totals.pct ?? 0) >= 100 ? "#10b981"
    : (totals.pct ?? 0) >= 75 ? "#f59e0b"
    : "#ef4444";

  return (
    <section className="surface rounded-3xl p-5" style={{ border: "1px solid var(--border)", borderTop: "2px solid #21D0B3", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
          {loading ? "Actualizando..." : "Refrescar KPI"}
        </button>
      </div>

      {/* ── Filters */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        <select className="input" value={selectedDisciplineId} onChange={(e) => setSelectedDisciplineId(e.target.value)}>
          <option value="">Todas las disciplinas</option>
          {disciplineOptions.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
          ))}
        </select>
      </div>

      {/* ── KPI Cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cumplimiento */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `2px solid ${complianceColor}`, borderRadius: "16px", padding: "18px", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={complianceColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
            </svg>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: complianceColor, display: "inline-block" }} />
          </div>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: complianceColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {totals.pct === null ? "N/D" : formatPercent(totals.pct)}
          </p>
          <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em" }}>Cumplimiento total</p>
          <div style={{ marginTop: "10px", height: "4px", borderRadius: "99px", background: "#f1f5f9" }}>
            <div style={{ height: "4px", borderRadius: "99px", width: `${Math.min(totals.pct ?? 0, 100)}%`, background: complianceColor, transition: "width 0.5s ease" }} />
          </div>
        </div>

        {/* Brecha neta */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `2px solid ${varianceColor}`, borderRadius: "16px", padding: "18px", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={varianceColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {totals.variance === null || totals.variance === 0
                ? <><line x1="5" y1="12" x2="19" y2="12"/></>
                : totals.variance < 0
                ? <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>
                : <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>}
            </svg>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: varianceColor, display: "inline-block" }} />
          </div>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: varianceColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {totals.variance === null ? "-" : totals.variance > 0 ? `+${totals.variance}` : totals.variance}
          </p>
          <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em" }}>Brecha neta</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {selectedDelegationId && !totals.hasComparableExpected ? "Sin meta configurada" : `${totals.registered} reg. / ${totals.expected} esp.`}
          </p>
        </div>

        {/* Disciplinas con déficit */}
        {(() => {
          const defColor = deficitStats.deficit > 0 ? "#ef4444" : "#10b981";
          return (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `2px solid ${defColor}`, borderRadius: "16px", padding: "18px", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={defColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: defColor, display: "inline-block" }} />
              </div>
              <p style={{ fontSize: "2rem", fontWeight: 800, color: defColor, lineHeight: 1 }}>
                {deficitStats.uniqueDeficitDisciplines}
              </p>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em" }}>Disciplinas en déficit</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {deficitStats.onTrack} en objetivo · {deficitStats.deficit} rezagadas
              </p>
            </div>
          );
        })()}

        {/* Cobertura delegaciones */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "2px solid #1FCDFF", borderRadius: "16px", padding: "18px", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1FCDFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1FCDFF", display: "inline-block" }} />
          </div>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#1FCDFF", lineHeight: 1 }}>
            {filteredDelegations.length}
          </p>
          <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em" }}>Delegaciones</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {totals.registered} participantes AND
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Mostrando {Math.min(filteredRows.length, maxRows)} de {filteredRows.length} filas
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Límite</span>
          <select
            className="input h-9 min-w-[120px]"
            value={maxRows}
            onChange={(e) => setMaxRows(Number(e.target.value) || 100)}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      <div className="mt-3 max-h-[560px] overflow-auto">
        <table className="table">
          <thead>
            <tr>
              {["Delegación","Disciplina","Tipo","Género","Esperado","Registrado","Brecha","Cumplimiento"].map((col) => (
                <th key={col} className="sticky top-0 z-10" style={{ background: "linear-gradient(to bottom, #eaf4fb, #e8f0f8)", color: "#1FCDFF", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", borderBottom: "2px solid rgba(31,205,255,0.25)", fontWeight: 700 }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.delegationKey}-${row.disciplineId}`}>
                <td>{row.delegationName}</td>
                <td className="font-medium" style={{ color: "var(--text)" }}>{row.disciplineName}</td>
                <td>{row.disciplineType}</td>
                <td>{row.disciplineGender}</td>
                <td>{row.hasDelegationExpected ? row.expected : "-"}</td>
                <td>{row.registered}</td>
                <td style={{ color: row.variance === null ? "var(--text-faint)" : row.variance < 0 ? "#f87171" : row.variance > 0 ? "#fbbf24" : "#34d399" }}>
                  {row.variance === null ? "-" : row.variance > 0 ? `+${row.variance}` : row.variance}
                </td>
                <td>
                  <div className="flex min-w-[220px] items-center gap-2">
                    <div className="h-2 flex-1 rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(row.pct ?? 0, 100)}%`,
                          background: row.statusTone === "good" ? "#10b981" : row.statusTone === "over" ? "#f59e0b" : "#06b6d4"
                        }}
                      />
                    </div>
                    <span className="min-w-[52px] text-right text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {row.pct === null ? "N/D" : formatPercent(row.pct)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && filteredRows.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Define primero la planificacion AND en Eventos (capacidad por disciplina y por delegacion) para ver este KPI.
        </p>
      ) : null}
    </section>
  );
}
