"use client";

import { useEffect, useMemo, useState } from "react";
import ResourceScreen from "@/components/ResourceScreen";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";

type EventItem = { id: string; name?: string | null };

export default function TripsPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripData, delegationData, athleteData, eventData] = await Promise.all([
        apiFetch<any[]>("/trips"),
        apiFetch<any[]>("/delegations"),
        apiFetch<any[]>("/athletes"),
        apiFetch<EventItem[]>("/events")
      ]);

      setTrips(tripData || []);
      setDelegations(delegationData || []);
      setAthletes(athleteData || []);
      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, eventItem) => {
          acc[eventItem.id] = eventItem;
          return acc;
        }, {})
      );
      if (!selectedEventId && eventData && eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(() => {
    const filteredDelegations = selectedEventId
      ? delegations.filter((delegation) => delegation.eventId === selectedEventId)
      : delegations;

    return filteredDelegations.map((delegation) => {
      const delegationAthletes = athletes.filter(
        (athlete) =>
          athlete.delegationId === delegation.id &&
          (!selectedEventId || athlete.eventId === selectedEventId)
      );
      const delegationAthleteIds = new Set(delegationAthletes.map((athlete) => athlete.id));
      const delegationTrips = trips.filter((trip) =>
        (trip.athleteIds || []).some((id: string) => delegationAthleteIds.has(id))
      );
      const assignedAthleteIds = new Set<string>();
      delegationTrips.forEach((trip) => {
        (trip.athleteIds || []).forEach((id: string) => assignedAthleteIds.add(id));
      });
      const assignedParticipants = delegationAthletes.filter((athlete) =>
        assignedAthleteIds.has(athlete.id)
      ).length;
      const totalParticipants = delegationAthletes.length;
      const pendingParticipants = Math.max(totalParticipants - assignedParticipants, 0);

      return {
        id: delegation.id,
        label: delegation.countryCode ?? delegation.id,
        totalParticipants,
        assignedParticipants,
        pendingParticipants,
        tripsScheduled: delegationTrips.length
      };
    });
  }, [delegations, athletes, trips, selectedEventId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones"
        description="Programación y seguimiento de viajes."
      />

      <section className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {t("Última actualización")}: {lastUpdated ? lastUpdated.toLocaleTimeString("es-CL") : "-"}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Evento")}
            </label>
            <select
              className="input h-10 flex-1 min-w-[420px] leading-5"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              <option value="">{t("Todos")}</option>
              {Object.values(events).map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>
                  {eventItem.name || eventItem.id}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </section>

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl text-ink mb-4">{t("Overview por delegación")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("Sin delegaciones registradas.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Delegación")}</th>
                  <th>{t("Participantes")}</th>
                  <th>{t("Asignados a viajes")}</th>
                  <th>{t("Por programar")}</th>
                  <th>{t("Viajes programados")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>{row.totalParticipants}</td>
                    <td>{row.assignedParticipants}</td>
                    <td>
                      <span
                        className={
                          row.pendingParticipants > 0
                            ? "inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                            : "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                        }
                      >
                        {row.pendingParticipants}
                      </span>
                    </td>
                    <td>{row.tripsScheduled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResourceScreen config={resources.trips} />
    </div>
  );
}
