"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

type EventItem = {
  id: string;
  name?: string | null;
  config?: Record<string, unknown> | null;
  expectedCapacities?: Array<{
    disciplineId: string;
    delegationCode: string;
    expectedCount: number;
  }>;
};

type Discipline = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  category?: string | null;
  gender?: string | null;
};

type QuotaState = Record<string, string>;

function readExpectedByDiscipline(eventItem: EventItem | null): Record<string, number> {
  if (!eventItem) return {};
  const config = eventItem.config && typeof eventItem.config === "object" ? eventItem.config : {};
  const fromConfig = (config as Record<string, unknown>).andExpectedByDiscipline;

  if (fromConfig && typeof fromConfig === "object" && !Array.isArray(fromConfig)) {
    return Object.entries(fromConfig as Record<string, unknown>).reduce<Record<string, number>>(
      (acc, [disciplineId, value]) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) acc[disciplineId] = Math.floor(parsed);
        return acc;
      },
      {}
    );
  }

  const fromRows = (eventItem.expectedCapacities || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.disciplineId] = (acc[row.disciplineId] || 0) + Number(row.expectedCount || 0);
    return acc;
  }, {});
  return fromRows;
}

export default function DeportesPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");
  const [quotas, setQuotas] = useState<QuotaState>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<Discipline[]>("/disciplines")
      ]);

      setEvents(eventData || []);
      setDisciplines(disciplineData || []);

      if (!selectedEventId && (eventData || []).length > 0) {
        const firstEventId = (eventData || [])[0].id;
        setSelectedEventId(firstEventId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar módulo de deportes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    const expected = readExpectedByDiscipline(selectedEvent);
    const next = Object.entries(expected).reduce<QuotaState>((acc, [disciplineId, value]) => {
      acc[disciplineId] = String(value);
      return acc;
    }, {});
    setQuotas(next);
    setMessage(null);
  }, [selectedEventId, selectedEvent]);

  const filteredDisciplines = useMemo(() => {
    const term = search.trim().toLowerCase();
    return disciplines
      .filter((discipline) => (selectedEventId ? discipline.eventId === selectedEventId : true))
      .filter((discipline) => {
        if (!term) return true;
        return [discipline.name, discipline.category, discipline.gender]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [disciplines, selectedEventId, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedEventId, search]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDisciplines.length / pageSize)),
    [filteredDisciplines.length]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedDisciplines = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDisciplines.slice(start, start + pageSize);
  }, [filteredDisciplines, page]);

  const totalQuota = useMemo(
    () =>
      pagedDisciplines.reduce((sum, discipline) => {
        const current = Number(quotas[discipline.id] || "0");
        return sum + (Number.isFinite(current) ? Math.max(0, current) : 0);
      }, 0),
    [pagedDisciplines, quotas]
  );

  const saveQuotas = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const existingConfig =
        selectedEvent.config && typeof selectedEvent.config === "object"
          ? (selectedEvent.config as Record<string, unknown>)
          : {};

      const andExpectedByDiscipline = filteredDisciplines.reduce<Record<string, number>>(
        (acc, discipline) => {
          const nextValue = Math.max(0, Math.floor(Number(quotas[discipline.id] || "0")));
          acc[discipline.id] = Number.isFinite(nextValue) ? nextValue : 0;
          return acc;
        },
        {}
      );

      await apiFetch(`/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...existingConfig,
            andExpectedByDiscipline
          }
        })
      });

      setMessage("Cuotas guardadas correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar cuotas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deportes"
        description="Visualización de disciplinas y edición de cuotas esperadas por deporte."
      />

      <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_8%_15%,rgba(14,165,233,0.26),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.25),transparent_30%),linear-gradient(125deg,#0b132b_0%,#1e3a8a_45%,#0f766e_100%)] p-6 text-white">
        <p className="text-xs uppercase tracking-[0.28em] text-white/70">Panel Deportes</p>
        <h2 className="mt-2 font-display text-4xl">Cuotas operativas por disciplina</h2>
        <p className="mt-2 text-sm text-white/80">
          Ajusta en un solo módulo las cuotas esperadas por deporte para cada evento.
        </p>
      </section>

      <section className="surface rounded-3xl p-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <select
            className="input lg:col-span-2"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            <option value="">Selecciona evento</option>
            {events.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.name || eventItem.id}
              </option>
            ))}
          </select>
          <input
            className="input lg:col-span-2"
            placeholder="Buscar disciplina"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Total cuotas visibles (página): <span className="font-semibold text-slate-900">{totalQuota}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              Página {page} de {totalPages}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
            <button className="btn btn-primary" onClick={saveQuotas} disabled={saving || !selectedEventId}>
              {saving ? "Guardando..." : "Guardar cuotas"}
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="surface rounded-3xl p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando disciplinas...</p>
        ) : filteredDisciplines.length === 0 ? (
          <p className="text-sm text-slate-500">No hay disciplinas para este evento.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pagedDisciplines.map((discipline) => (
              <article key={discipline.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Disciplina</p>
                <h3 className="mt-1 font-display text-2xl text-ink">{discipline.name || discipline.id}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {discipline.category || "-"} · {discipline.gender || "-"}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Cuota esperada</label>
                  <input
                    className="input max-w-[130px] text-right"
                    type="number"
                    min={0}
                    step={1}
                    value={quotas[discipline.id] ?? "0"}
                    onChange={(event) =>
                      setQuotas((prev) => ({
                        ...prev,
                        [discipline.id]: event.target.value
                      }))
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
