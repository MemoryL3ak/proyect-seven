"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Trip = {
  id: string;
  status?: string | null;
};

type HotelAssignment = {
  id: string;
  bedId?: string | null;
  roomId?: string | null;
  status?: string | null;
};

type HotelBed = {
  id: string;
  status?: string | null;
};

type HotelRoom = {
  id: string;
  status?: string | null;
};

const STATUS = {
  scheduled: new Set(["SCHEDULED", "PROGRAMADO", "PROGRAMADA", "PROGRAMMED"]),
  active: new Set(["EN_ROUTE", "EN_RUTA", "PICKED_UP", "RECOGIDO", "DROPPED_OFF"]),
  completed: new Set(["COMPLETED", "FINALIZADO", "COMPLETADO"]),
};

const normalizeStatus = (value?: string | null) =>
  value ? value.trim().toUpperCase() : "";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CL").format(value);

const SectionTitle = ({ label }: { label: string }) => (
  <div className="tracking-[0.3em] uppercase text-[11px] text-slate-500">
    {label}
  </div>
);

const StatCard = ({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "slate" | "emerald" | "sky" | "amber";
}) => {
  const toneMap = {
    slate: "border-slate-200/70 bg-white",
    emerald: "border-emerald-200/70 bg-emerald-50/60",
    sky: "border-sky-200/70 bg-sky-50/60",
    amber: "border-amber-200/70 bg-amber-50/60",
  } as const;

  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] ${toneMap[tone]}`}
    >
      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-2 text-sm text-slate-600">{helper}</div> : null}
    </div>
  );
};

const SectionHeader = ({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <SectionTitle label={label} />
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  </div>
);

export default function Page() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsCount, setEventsCount] = useState(0);
  const [athletesCount, setAthletesCount] = useState(0);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [accommodationsCount, setAccommodationsCount] = useState(0);
  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [hotelBeds, setHotelBeds] = useState<HotelBed[]>([]);
  const [hotelAssignments, setHotelAssignments] = useState<HotelAssignment[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          events,
          athletes,
          tripsList,
          accommodations,
          rooms,
          beds,
          assignments,
        ] = await Promise.all([
          apiFetch("/events"),
          apiFetch("/athletes"),
          apiFetch("/trips"),
          apiFetch("/accommodations"),
          apiFetch("/hotel-rooms").catch(() => []),
          apiFetch("/hotel-beds").catch(() => []),
          apiFetch("/hotel-assignments").catch(() => []),
        ]);

        if (cancelled) return;

        setEventsCount(Array.isArray(events) ? events.length : 0);
        setAthletesCount(Array.isArray(athletes) ? athletes.length : 0);
        setTrips(Array.isArray(tripsList) ? tripsList : []);
        setAccommodationsCount(Array.isArray(accommodations) ? accommodations.length : 0);
        setHotelRooms(Array.isArray(rooms) ? rooms : []);
        setHotelBeds(Array.isArray(beds) ? beds : []);
        setHotelAssignments(Array.isArray(assignments) ? assignments : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tripStats = useMemo(() => {
    const stats = {
      scheduled: 0,
      active: 0,
      completed: 0,
    };

    trips.forEach((trip) => {
      const status = normalizeStatus(trip.status);
      if (STATUS.completed.has(status)) stats.completed += 1;
      else if (STATUS.active.has(status)) stats.active += 1;
      else if (STATUS.scheduled.has(status)) stats.scheduled += 1;
    });

    return stats;
  }, [trips]);

  const bedStats = useMemo(() => {
    const occupied = hotelAssignments.filter(
      (assignment) =>
        assignment.bedId &&
        !["CHECKOUT", "CHECKED_OUT", "FINISHED", "CANCELLED"].includes(
          normalizeStatus(assignment.status)
        )
    ).length;

    const available = hotelBeds.filter(
      (bed) =>
        ["AVAILABLE", "DISPONIBLE", ""].includes(normalizeStatus(bed.status)) ||
        !bed.status
    ).length;

    return {
      available,
      occupied,
      total: hotelBeds.length,
    };
  }, [hotelAssignments, hotelBeds]);

  const roomStats = useMemo(() => {
    const available = hotelRooms.filter(
      (room) =>
        ["AVAILABLE", "DISPONIBLE", ""].includes(normalizeStatus(room.status)) ||
        !room.status
    ).length;

    return {
      available,
      total: hotelRooms.length,
    };
  }, [hotelRooms]);

  const headline = loading
    ? t("Cargando datos...")
    : error
    ? t("Sin datos disponibles")
    : t("Panel operativo en vivo");

  return (
    <div className="relative space-y-10">
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -top-8 left-10 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />

      <section className="relative rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionTitle label={t("Panel operativo")} />
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {t("Overview general")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{headline}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
              {loading ? t("Cargando") : t("En vivo")}
            </div>
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label={t("Participantes registrados")}
            value={formatNumber(athletesCount)}
            helper={t("Total en plataforma")}
          />
          <StatCard
            label={t("Eventos activos")}
            value={formatNumber(eventsCount)}
            helper={t("Eventos configurados")}
            tone="sky"
          />
          <StatCard
            label={t("Hoteles registrados")}
            value={formatNumber(accommodationsCount)}
            helper={t("Inventario activo")}
            tone="emerald"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          label={t("Movilidad")}
          title={t("Estado de viajes")}
          subtitle={t("Seguimiento operativo por fase del traslado")}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard
            label={t("Viajes programados")}
            value={formatNumber(tripStats.scheduled)}
            helper={t("Pendientes por iniciar")}
          />
          <StatCard
            label={t("Viajes en curso")}
            value={formatNumber(tripStats.active)}
            helper={t("Operando ahora")}
            tone="amber"
          />
          <StatCard
            label={t("Viajes completados")}
            value={formatNumber(tripStats.completed)}
            helper={t("Histórico")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          label={t("Hotelería")}
          title={t("Capacidad y ocupación")}
          subtitle={t("Asignaciones y disponibilidad en tiempo real")}
        />
        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard
            label={t("Asignaciones hoteleras")}
            value={formatNumber(hotelAssignments.length)}
            helper={t("Participantes con cama asignada")}
            tone="emerald"
          />
          <StatCard
            label={t("Habitaciones disponibles")}
            value={formatNumber(roomStats.available)}
            helper={`${formatNumber(roomStats.total)} ${t("totales")}`}
          />
          <StatCard
            label={t("Camas disponibles")}
            value={formatNumber(bedStats.available)}
            helper={`${formatNumber(bedStats.total)} ${t("totales")}`}
          />
          <StatCard
            label={t("Camas ocupadas")}
            value={formatNumber(bedStats.occupied)}
            helper={t("Con participantes asignados")}
            tone="amber"
          />
        </div>
      </section>
    </div>
  );
}