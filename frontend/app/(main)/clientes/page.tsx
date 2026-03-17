"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type Athlete = {
  id: string;
  fullName?: string | null;
  userType?: string | null;
  dietaryNeeds?: string | null;
  email?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
};

type EventItem = { id: string; name?: string | null };
type Delegation = { id: string; countryCode?: string | null };
type Discipline = { id: string; name?: string | null };

const normalizeType = (value?: string | null) => {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : "SIN_TIPO";
};

export default function ClientesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [delegations, setDelegations] = useState<Record<string, Delegation>>({});
  const [disciplines, setDisciplines] = useState<Record<string, Discipline>>({});
  const [selectedType, setSelectedType] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [athleteData, eventData, delegationData, disciplineData] = await Promise.all([
          apiFetch<Athlete[]>("/athletes"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<Delegation[]>("/delegations"),
          apiFetch<Discipline[]>("/disciplines")
        ]);

        setAthletes(filterValidatedAthletes(athleteData || []));
        setEvents(
          (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
        setDelegations(
          (delegationData || []).reduce<Record<string, Delegation>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
        setDisciplines(
          (disciplineData || []).reduce<Record<string, Discipline>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar clientes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const typeOptions = useMemo(() => {
    const set = new Set(athletes.map((item) => normalizeType(item.userType)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [athletes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return athletes
      .filter((item) => (selectedType ? normalizeType(item.userType) === selectedType : true))
      .filter((item) => (selectedEventId ? item.eventId === selectedEventId : true))
      .filter((item) => {
        if (!term) return true;
        return [
          item.fullName,
          item.email,
          normalizeType(item.userType),
          item.dietaryNeeds,
          delegations[item.delegationId || ""]?.countryCode
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [athletes, selectedType, selectedEventId, search, delegations]);

  const typeCounts = useMemo(() => {
    return filtered.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeType(item.userType);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Visualización de participantes y filtro por tipo de cliente."
      />

      <section className="surface rounded-3xl p-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <select
            className="input"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
          >
            <option value="">Todos los tipos de cliente</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            <option value="">Todos los eventos</option>
            {Object.values(events).map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.name || eventItem.id}
              </option>
            ))}
          </select>
          <input
            className="input lg:col-span-2"
            placeholder="Buscar por nombre, email, tipo o delegación"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <article className="surface rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>Total clientes</p>
          <p className="mt-2 text-3xl font-sans font-bold" style={{ color: "var(--text)" }}>{filtered.length}</p>
        </article>
        {Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([type, count]) => (
            <article key={type} className="surface rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>{type}</p>
              <p className="mt-2 text-3xl font-sans font-bold" style={{ color: "var(--text)" }}>{count}</p>
            </article>
          ))}
      </section>

      <section className="surface rounded-3xl p-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Evento</th>
                <th>Delegación</th>
                <th>Disciplina</th>
                <th>Alimentación</th>
                <th>Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.fullName || item.id}</td>
                  <td>{normalizeType(item.userType)}</td>
                  <td>{events[item.eventId || ""]?.name || item.eventId || "-"}</td>
                  <td>{delegations[item.delegationId || ""]?.countryCode || "-"}</td>
                  <td>{disciplines[item.disciplineId || ""]?.name || "-"}</td>
                  <td>{item.dietaryNeeds || "-"}</td>
                  <td>{item.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>No hay participantes para este filtro.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}


