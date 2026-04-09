"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import StyledSelect from "@/components/StyledSelect";

type EventOption = { id: string; name: string };
type VenueOption = { id: string; name: string; address?: string | null; eventId?: string | null };
type DisciplineOption = {
  id: string;
  name?: string | null;
  eventId?: string | null;
  category?: string | null;
  gender?: string | null;
};
type DelegationOption = { id: string; countryCode?: string | null; eventId?: string | null };
type AthleteAndItem = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
};
type ScheduleType = "ARRIVAL" | "TRAINING" | "COMPETITION" | "DEPARTURE";

type SportsEvent = {
  id: string;
  eventId?: string | null;
  sport: string;
  league: string;
  season?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  venue?: string | null;
  startAtUtc: string;
  status?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

type CreateSportsEventPayload = {
  eventId?: string;
  sport: string;
  league: string;
  season?: string;
  competitorA?: string;
  competitorB?: string;
  venue?: string;
  startAtUtc: string;
  status?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

const STATUSES = ["ALL", "SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"];
const WEEK_LABELS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
const SCHEDULE_TYPE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: "ARRIVAL", label: "Fecha de llegada" },
  { value: "TRAINING", label: "Fechas de entrenamiento" },
  { value: "COMPETITION", label: "Fechas de pruebas" },
  { value: "DEPARTURE", label: "Fecha de retiro" },
];
const MANUAL_SCHEDULE_TYPE_OPTIONS: Array<{ value: ScheduleType; label: string }> = SCHEDULE_TYPE_OPTIONS.filter(
  (option) => option.value === "TRAINING" || option.value === "COMPETITION",
);
const DISCIPLINE_CATEGORY_OPTIONS = [
  { value: "CONVENTIONAL", label: "Convencional" },
  { value: "PARALYMPIC", label: "Paralímpica" },
];
const DISCIPLINE_GENDER_OPTIONS = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
];
const CSV_HEADERS =
  "eventId,sport,league,season,title,competitorA,competitorB,venue,startAtUtc,status,source,scheduleType,delegationId,generalQuota,delegationQuota";

function getMetaString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getMetaStringArray(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function scheduleTypeLabel(value?: string | null) {
  const found = SCHEDULE_TYPE_OPTIONS.find((option) => option.value === value);
  return found?.label ?? "Sin tipo";
}

function scheduleTypeBadgeClass(value?: string | null) {
  if (value === "ARRIVAL") return "bg-blue-500/10 text-blue-400";
  if (value === "TRAINING") return "bg-amber-500/10 text-amber-400";
  if (value === "COMPETITION") return "bg-emerald-500/10 text-emerald-400";
  if (value === "DEPARTURE") return "bg-rose-500/10 text-rose-400";
  return "bg-white/8 text-white/90";
}

function scheduleTypeCalendarCardClass(value?: string | null) {
  if (value === "ARRIVAL") return "border border-blue-500/20 bg-blue-500/10";
  if (value === "TRAINING") return "border border-amber-500/20 bg-amber-500/10";
  if (value === "COMPETITION") return "border border-emerald-500/20 bg-emerald-500/10";
  if (value === "DEPARTURE") return "border border-rose-500/20 bg-rose-500/10";
  return "border border-white/10 bg-white/5";
}

function venueLabelById(options: VenueOption[], idOrName?: string | null) {
  if (!idOrName) return "";
  const match = options.find((v) => v.id === idOrName);
  return match?.name || idOrName;
}

function delegationLabelById(options: DelegationOption[], id?: string | null) {
  if (!id) return "";
  const item = options.find((option) => option.id === id);
  return item?.countryCode || id;
}

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(date);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function isoDayKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(csv: string): CreateSportsEventPayload[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const index = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const get = (name: string) => {
      const idx = index(name);
      return idx >= 0 ? cols[idx] ?? "" : "";
    };

    const title = get("title");
    const competitorA = get("competitorA") || get("homeTeam");
    const competitorB = get("competitorB") || get("awayTeam");
    const metadata: Record<string, unknown> = {};
    if (title) metadata.title = title;
    if (get("scheduleType")) metadata.scheduleType = get("scheduleType");
    if (get("delegationId")) metadata.delegationId = get("delegationId");
    if (get("generalQuota")) metadata.generalQuota = Number(get("generalQuota"));
    if (get("delegationQuota")) metadata.delegationQuota = Number(get("delegationQuota"));

    return {
      eventId: get("eventId") || undefined,
      sport: get("sport"),
      league: get("league"),
      season: get("season") || undefined,
      competitorA: competitorA || undefined,
      competitorB: competitorB || undefined,
      venue: get("venue") || undefined,
      startAtUtc: get("startAtUtc"),
      status: get("status") || "SCHEDULED",
      source: get("source") || "csv",
      metadata: Object.keys(metadata).length ? metadata : undefined,
    };
  });
}

function buildMonthGrid(anchorMonth: Date) {
  const monthStart = startOfMonth(anchorMonth);
  const jsDay = monthStart.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + index);
    return d;
  });
}

function formatTime(value: string) {
  const date = new Date(value);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeKey(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function entryFormTitle(scheduleType?: string | null, editing = false) {
  const base =
    scheduleType === "TRAINING"
      ? "entrenamiento"
      : scheduleType === "COMPETITION"
        ? "prueba"
        : "actividad";
  return editing ? `Editar ${base}` : `Programar ${base}`;
}

function titleFromEvent(event: SportsEvent) {
  const metadataTitle = event.metadata?.title;
  if (typeof metadataTitle === "string" && metadataTitle.trim()) return metadataTitle.trim();

  const competitorA = event.homeTeam?.trim() ?? "";
  const competitorB = event.awayTeam?.trim() ?? "";

  if (competitorA && competitorB) return `${competitorA} vs ${competitorB}`;
  if (competitorA) return competitorA;
  return `${event.sport} - ${event.league}`;
}

function toLocalDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalDateTimeInput(value: string) {
  if (!value) return "";
  return new Date(value).toISOString();
}

export default function SportsCalendarPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<SportsEvent[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);
  const [delegationOptions, setDelegationOptions] = useState<DelegationOption[]>([]);
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteAndItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [sportFilter, setSportFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<CreateSportsEventPayload>({
    sport: "",
    league: "",
    competitorA: "",
    competitorB: "",
    startAtUtc: "",
    status: "SCHEDULED",
    source: "manual",
    metadata: {},
  });

  const loadEventOptions = async () => {
    try {
      const data = await apiFetch<EventOption[]>("/events");
      setEventOptions(Array.isArray(data) ? data : []);
    } catch {
      setEventOptions([]);
    }
  };

  const loadDelegations = async () => {
    try {
      const data = await apiFetch<DelegationOption[]>("/delegations");
      setDelegationOptions(Array.isArray(data) ? data : []);
    } catch {
      setDelegationOptions([]);
    }
  };

  const loadVenues = async () => {
    try {
      const data = await apiFetch<VenueOption[]>("/venues");
      setVenueOptions(Array.isArray(data) ? data : []);
    } catch {
      setVenueOptions([]);
    }
  };

  const loadDisciplines = async () => {
    try {
      const data = await apiFetch<DisciplineOption[]>("/disciplines");
      setDisciplineOptions(Array.isArray(data) ? data : []);
    } catch {
      setDisciplineOptions([]);
    }
  };

  const loadAthletes = async () => {
    try {
      const data = await apiFetch<AthleteAndItem[]>("/athletes");
      setAthletes(filterValidatedAthletes(Array.isArray(data) ? data : []));
    } catch {
      setAthletes([]);
    }
  };

  const loadEntries = async () => {
    const grid = buildMonthGrid(monthCursor);
    const from = new Date(grid[0]);
    from.setHours(0, 0, 0, 0);
    const to = new Date(grid[41]);
    to.setHours(23, 59, 59, 999);

    const params = new URLSearchParams();
    params.set("from", from.toISOString());
    params.set("to", to.toISOString());
    if (selectedEventId) params.set("eventId", selectedEventId);
    if (sportFilter.trim()) params.set("sport", sportFilter.trim());
    if (phaseFilter.trim()) params.set("league", phaseFilter.trim());
    if (personFilter.trim()) params.set("team", personFilter.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    setLoading(true);
    try {
      const data = await apiFetch<SportsEvent[]>(`/sports-calendar/events?${params.toString()}`);
      const source = Array.isArray(data) ? data : [];
      setEntries(
        selectedDelegationId
          ? source.filter(
              (item) => getMetaString(item.metadata, "delegationId") === selectedDelegationId,
            )
          : source,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo cargar calendario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventOptions();
    loadDisciplines();
    loadDelegations();
    loadVenues();
    loadAthletes();
  }, []);

  useEffect(() => {
    loadEntries();
  }, [monthCursor, selectedEventId, selectedDelegationId, sportFilter, phaseFilter, personFilter, statusFilter]);

  const filteredVenueOptions = useMemo(() => {
    if (!selectedEventId) return venueOptions;
    const byEvent = venueOptions.filter((v) => v.eventId === selectedEventId);
    return byEvent.length > 0 ? byEvent : venueOptions;
  }, [venueOptions, selectedEventId]);

  const filteredDelegationOptions = useMemo(
    () =>
      delegationOptions.filter((item) =>
        selectedEventId ? item.eventId === selectedEventId : true,
      ),
    [delegationOptions, selectedEventId],
  );
  const filteredDisciplineOptions = useMemo(
    () => {
      const selectedCategory = getMetaString(newEntry.metadata, "disciplineCategory");
      const selectedGender = getMetaString(newEntry.metadata, "disciplineGender");
      return disciplineOptions.filter((item) => {
        if (selectedEventId && item.eventId !== selectedEventId) return false;
        if (selectedCategory && item.category && item.category !== selectedCategory) return false;
        if (selectedGender && item.gender && item.gender !== selectedGender) return false;
        return true;
      });
    },
    [disciplineOptions, selectedEventId, newEntry.metadata],
  );
  const disciplineNameMap = useMemo(
    () =>
      disciplineOptions.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name || item.id;
        return acc;
      }, {}),
    [disciplineOptions],
  );
  const disciplineNameToIdMap = useMemo(
    () =>
      disciplineOptions.reduce<Record<string, string>>((acc, item) => {
        const key = normalizeKey(item.name || item.id);
        if (key) acc[key] = item.id;
        return acc;
      }, {}),
    [disciplineOptions],
  );

  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const todayKey = isoDayKey(new Date());
  const selectedDayKey = isoDayKey(selectedDay);
  const selectedManualScheduleType = getMetaString(newEntry.metadata, "scheduleType");
  const isCompetitionActivity = selectedManualScheduleType === "COMPETITION";
  const isTrainingActivity = selectedManualScheduleType === "TRAINING";
  const liveCount = entries.filter((entry) => (entry.status ?? "").toUpperCase() === "LIVE").length;
  const scopedAthletes = useMemo(
    () =>
      athletes.filter((item) => {
        if (selectedEventId && item.eventId !== selectedEventId) return false;
        if (selectedDelegationId && item.delegationId !== selectedDelegationId) return false;
        return true;
      }),
    [athletes, selectedEventId, selectedDelegationId],
  );
  const andDelegationScheduleRows = useMemo(() => {
    type Row = {
      delegationId: string;
      delegationLabel: string;
      arrivalAt?: string;
      departureAt?: string;
      peopleCount: number;
      disciplines: Map<string, { disciplineId: string; disciplineName: string; athleteCount: number }>;
      trainingDates: string[];
      competitionDates: string[];
    };

    const rows = new Map<string, Row>();
    const getRow = (delegationId: string) => {
      const key = delegationId;
      const existing = rows.get(key);
      if (existing) return existing;
      const created: Row = {
        delegationId,
        delegationLabel: delegationLabelById(delegationOptions, delegationId) || delegationId,
        peopleCount: 0,
        disciplines: new Map(),
        trainingDates: [],
        competitionDates: [],
      };
      rows.set(key, created);
      return created;
    };

    scopedAthletes.forEach((athlete) => {
      if (!athlete.delegationId) return;
      const disciplineId = athlete.disciplineId || "SIN_DISCIPLINA";
      const disciplineName =
        disciplineId === "SIN_DISCIPLINA" ? "Sin disciplina" : disciplineNameMap[disciplineId] || disciplineId;
      const row = getRow(athlete.delegationId);
      row.peopleCount += 1;
      const currentDiscipline = row.disciplines.get(disciplineId) ?? {
        disciplineId,
        disciplineName,
        athleteCount: 0,
      };
      currentDiscipline.athleteCount += 1;
      row.disciplines.set(disciplineId, currentDiscipline);
      if (athlete.arrivalTime) {
        if (!row.arrivalAt || new Date(athlete.arrivalTime) < new Date(row.arrivalAt)) {
          row.arrivalAt = athlete.arrivalTime;
        }
      }
      if (athlete.departureTime) {
        if (!row.departureAt || new Date(athlete.departureTime) > new Date(row.departureAt)) {
          row.departureAt = athlete.departureTime;
        }
      }
    });

    entries.forEach((entry) => {
      const scheduleType = getMetaString(entry.metadata, "scheduleType");
      if (scheduleType !== "TRAINING" && scheduleType !== "COMPETITION") return;
      const delegationId = getMetaString(entry.metadata, "delegationId");
      if (!delegationId) return;
      if (selectedDelegationId && delegationId !== selectedDelegationId) return;
      const row = getRow(delegationId);
      const target = scheduleType === "TRAINING" ? row.trainingDates : row.competitionDates;
      if (!target.includes(entry.startAtUtc)) target.push(entry.startAtUtc);
    });

    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        disciplines: Array.from(row.disciplines.values()).sort((a, b) => a.disciplineName.localeCompare(b.disciplineName)),
        trainingDates: [...row.trainingDates].sort(),
        competitionDates: [...row.competitionDates].sort(),
      }))
      .sort((a, b) => a.delegationLabel.localeCompare(b.delegationLabel));
  }, [
    scopedAthletes,
    entries,
    delegationOptions,
    selectedDelegationId,
    disciplineNameMap,
  ]);
  const derivedAndCalendarEntries = useMemo(() => {
    const result: SportsEvent[] = [];
    andDelegationScheduleRows.forEach((row) => {
      const disciplineNames = row.disciplines.map((item) => item.disciplineName);
      if (row.arrivalAt) {
        result.push({
          id: `and-arrival-${row.delegationId}-${row.arrivalAt}`,
          eventId: selectedEventId || undefined,
          sport: "Llegada delegacion",
          league: "Llegada AND",
          venue: "AND",
          startAtUtc: row.arrivalAt,
          status: "SCHEDULED",
          source: "and-derived",
          metadata: {
            title: `Llegada ${row.delegationLabel}`,
            scheduleType: "ARRIVAL",
            delegationId: row.delegationId,
            peopleCount: row.peopleCount,
            disciplineCount: row.disciplines.length,
            disciplineNames,
            derivedFrom: "AND",
          },
        });
      }
      if (row.departureAt) {
        result.push({
          id: `and-departure-${row.delegationId}-${row.departureAt}`,
          eventId: selectedEventId || undefined,
          sport: "Retiro delegacion",
          league: "Retiro AND",
          venue: "AND",
          startAtUtc: row.departureAt,
          status: "SCHEDULED",
          source: "and-derived",
          metadata: {
            title: `Retiro ${row.delegationLabel}`,
            scheduleType: "DEPARTURE",
            delegationId: row.delegationId,
            peopleCount: row.peopleCount,
            disciplineCount: row.disciplines.length,
            disciplineNames,
            derivedFrom: "AND",
          },
        });
      }
    });
    return result;
  }, [andDelegationScheduleRows, selectedEventId]);
  const calendarDisplayEntries = useMemo(
    () =>
      [...entries, ...derivedAndCalendarEntries].sort(
        (a, b) => new Date(a.startAtUtc).getTime() - new Date(b.startAtUtc).getTime(),
      ),
    [entries, derivedAndCalendarEntries],
  );
  const groupedByDay = useMemo(() => {
    const map = new Map<string, SportsEvent[]>();
    calendarDisplayEntries.forEach((entry) => {
      const key = isoDayKey(entry.startAtUtc);
      const current = map.get(key) ?? [];
      current.push(entry);
      map.set(key, current);
    });
    return map;
  }, [calendarDisplayEntries]);
  const selectedDayEntries = groupedByDay.get(selectedDayKey) ?? [];

  const createEntry = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const meta = (newEntry.metadata ?? {}) as Record<string, any>;
      const useDateRange = meta.useDateRange && !editingEntryId;

      if (useDateRange && meta.rangeStart && meta.rangeEnd && meta.rangeTime) {
        // Create one entry per day in the date range
        const start = new Date(meta.rangeStart + "T00:00:00");
        const end = new Date(meta.rangeEnd + "T00:00:00");
        const [hours, minutes] = (meta.rangeTime as string).split(":").map(Number);
        let created = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayDate = new Date(d);
          dayDate.setHours(hours, minutes, 0, 0);
          const { useDateRange: _, rangeStart: _rs, rangeEnd: _re, rangeTime: _rt, ...cleanMeta } = meta;
          await apiFetch("/sports-calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...newEntry,
              startAtUtc: dayDate.toISOString(),
              league: selectedManualScheduleType === "COMPETITION" ? (newEntry.league || "Prueba") : newEntry.league,
              eventId: selectedEventId || undefined,
              metadata: Object.keys(cleanMeta).length > 0 ? cleanMeta : undefined,
            }),
          });
          created++;
        }
        setMessage(`Se crearon ${created} actividad(es) en el rango de fechas.`);
      } else {
        await apiFetch(
          editingEntryId
            ? `/sports-calendar/events/${editingEntryId}`
            : "/sports-calendar/events",
          {
            method: editingEntryId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...newEntry,
              league:
                selectedManualScheduleType === "COMPETITION"
                  ? (newEntry.league || "Prueba")
                  : newEntry.league,
              eventId: selectedEventId || undefined,
              metadata:
                newEntry.metadata && Object.keys(newEntry.metadata).length > 0
                  ? newEntry.metadata
                  : undefined,
            }),
          },
        );
        setMessage(editingEntryId ? "Actividad actualizada." : "Actividad creada en calendario.");
      }
      setEditingEntryId(null);
      setNewEntry((prev) => ({
        sport: prev.sport,
        league: prev.league,
        competitorA: "",
        competitorB: "",
        startAtUtc: "",
        status: "SCHEDULED",
        source: "manual",
        metadata: {},
      }));
      await loadEntries();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : editingEntryId
            ? "No se pudo actualizar la actividad."
            : "No se pudo crear la actividad.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onEditEntry = (entry: SportsEvent) => {
    setEditingEntryId(entry.id);
    setSelectedDay(new Date(entry.startAtUtc));
    setNewEntry({
      eventId: entry.eventId ?? undefined,
      sport: entry.sport,
      league: entry.league,
      season: entry.season ?? undefined,
      competitorA: entry.homeTeam ?? "",
      competitorB: entry.awayTeam ?? "",
      venue: entry.venue ?? "",
      startAtUtc: entry.startAtUtc,
      status: entry.status ?? "SCHEDULED",
      source: entry.source ?? "manual",
      metadata: entry.metadata ?? {},
    });
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setNewEntry((prev) => ({
      sport: prev.sport,
      league: prev.league,
      competitorA: "",
      competitorB: "",
      startAtUtc: "",
      status: "SCHEDULED",
      source: "manual",
      metadata: {},
    }));
  };

  const uploadCsv = (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const parsed = parseCsv(String(reader.result ?? "")).filter(
        (row) => row.sport && row.league && row.startAtUtc,
      );
      if (parsed.length === 0) {
        setMessage("CSV sin filas validas.");
        return;
      }

      setSaving(true);
      try {
        const payload = parsed.map((row) => ({
          ...row,
          eventId: row.eventId || selectedEventId || undefined,
        }));
        const result = await apiFetch<{ inserted: number }>("/sports-calendar/events/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: payload }),
        });
        setMessage(`Carga masiva completada: ${result.inserted} actividades.`);
        await loadEntries();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "No se pudo importar CSV.");
      } finally {
        setSaving(false);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const example =
      `${CSV_HEADERS}\n` +
      `${selectedEventId || ""},Atletismo,100m Semifinal,2026,Semifinal 100m varones,,,Estadio Nacional,2026-02-20T14:00:00.000Z,SCHEDULED,csv,COMPETITION,,40,4`;
    const blob = new Blob([example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sports-calendar-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteEntry = async (id: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/sports-calendar/events/${id}`, { method: "DELETE" });
      if (editingEntryId === id) {
        cancelEdit();
      }
      setMessage("Actividad eliminada.");
      await loadEntries();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo eliminar la actividad.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">

      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-2 lg:grid-cols-12">
          <StyledSelect wrapperClassName="lg:col-span-3" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Todos los eventos principales</option>
            {eventOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </StyledSelect>
          <StyledSelect wrapperClassName="lg:col-span-2" value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
            <option value="">Todas las delegaciones</option>
            {filteredDelegationOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>
            ))}
          </StyledSelect>
          <input className="input lg:col-span-2" placeholder="Disciplina" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} />
          <input className="input lg:col-span-1" placeholder="Fase/Categoria" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} />
          <input className="input lg:col-span-2" placeholder="Competidor o delegacion" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} />
          <StyledSelect wrapperClassName="lg:col-span-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status === "ALL" ? "Todos" : status}</option>
            ))}
          </StyledSelect>
          <button className="btn btn-ghost lg:col-span-1" type="button" onClick={downloadTemplate} style={{ fontSize: "12px", padding: "6px 12px" }}>Template CSV</button>
          <button className="btn btn-primary lg:col-span-1" type="button" onClick={() => fileRef.current?.click()} disabled={saving}>
            {saving ? "Importando..." : "Cargar CSV"}
          </button>
          <input ref={fileRef} className="hidden" type="file" accept=".csv,text/csv" onChange={uploadCsv} />
        </div>
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Agenda AND por delegacion</span>
            <h2 style={{ marginTop: "4px", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Fechas por disciplina y delegacion</h2>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>Llegada y retiro se obtienen desde AND. Entrenamientos y pruebas se completan en este calendario.</p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#21D0B3" }}>
            {selectedDelegationId ? "Vista filtrada por delegacion" : "Vista consolidada (todas las delegaciones)"}
          </div>
        </div>

        <div style={{ marginTop: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Delegacion", "Personas", "Disciplinas", "Fecha de llegada (AND)", "Fechas de entrenamiento", "Fechas de pruebas", "Fecha de retiro (AND)"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {andDelegationScheduleRows.map((row, idx) => (
                <tr key={row.delegationId} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f172a" }}>{row.delegationLabel}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{row.peopleCount}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {row.disciplines.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.disciplines.map((discipline) => (
                          <span key={discipline.disciplineId} style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                            {discipline.disciplineName} · {discipline.athleteCount}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sin detalle</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569", fontSize: "12px" }}>{formatDateTime(row.arrivalAt)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {row.trainingDates.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.trainingDates.map((value) => (
                          <span key={value} style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#d97706" }}>
                            {formatDateShort(value)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sin programar</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {row.competitionDates.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.competitionDates.map((value) => (
                          <span key={value} style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#059669" }}>
                            {formatDateShort(value)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sin programar</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569", fontSize: "12px" }}>{formatDateTime(row.departureAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {andDelegationScheduleRows.length === 0 ? (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "#94a3b8" }}>No hay datos para construir la agenda por delegacion con los filtros actuales.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost" type="button" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Mes anterior</button>
              <button className="btn btn-ghost" type="button" onClick={() => { const now = new Date(); setMonthCursor(startOfMonth(now)); setSelectedDay(now); }}>Hoy</button>
              <button className="btn btn-ghost" type="button" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Mes siguiente</button>
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", textTransform: "capitalize" }}>{monthLabel(monthCursor)}</h2>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {SCHEDULE_TYPE_OPTIONS.map((item) => (
              <span
                key={item.value}
                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${scheduleTypeBadgeClass(item.value)}`}
              >
                {item.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.14em] text-white/50">
            {WEEK_LABELS.map((label) => <div key={label}>{label}</div>)}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthGrid.map((day) => {
              const key = isoDayKey(day);
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDayKey;
              const isPast = !isToday && key < todayKey;
              const dayEntries = groupedByDay.get(key) ?? [];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setNewEntry((prev) => ({
                      ...prev,
                      startAtUtc: fromLocalDateTimeInput(`${key}T12:00`),
                    }));
                  }}
                  style={{
                    minHeight: "110px",
                    borderRadius: "12px",
                    padding: "8px",
                    textAlign: "left",
                    transition: "all 150ms ease",
                    background: !inMonth
                      ? "#f1f4f9"
                      : isPast
                        ? "#e8ecf4"
                        : isSelected
                          ? "#dbeafe"
                          : isToday
                            ? "#eff6ff"
                            : "#ffffff",
                    border: isSelected
                      ? "2px solid #1e4ed8"
                      : isToday
                        ? "2px solid #93c5fd"
                        : "1px solid #e2e8f0",
                    opacity: !inMonth ? 0.5 : 1,
                    outline: "none",
                    cursor: "pointer",
                    boxShadow: isPast || !inMonth ? "none" : "0 1px 4px rgba(15,23,42,0.06)"
                  }}
                >
                  <p style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: !inMonth ? "#94a3b8" : isPast ? "#94a3b8" : isToday ? "#1e4ed8" : "#0f172a"
                  }}>{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded px-1 py-0.5 ${scheduleTypeCalendarCardClass(getMetaString(entry.metadata, "scheduleType"))}`}
                      >
                        <p className="truncate text-[10px] font-semibold" style={{ color: "#0f172a" }}>
                          {titleFromEvent(entry)}
                        </p>
                        <p className="truncate text-[10px]" style={{ color: "#64748b" }}>
                          {scheduleTypeLabel(getMetaString(entry.metadata, "scheduleType"))}
                        </p>
                        <p className="truncate text-[10px]" style={{ color: "#64748b" }}>
                          {formatTime(entry.startAtUtc)} {entry.venue ? `- ${venueLabelById(venueOptions, entry.venue)}` : ""}
                        </p>
                      </div>
                    ))}
                    {dayEntries.length > 3 ? (
                      <p className="text-[10px]" style={{ color: "#94a3b8" }}>+{dayEntries.length - 3} mas</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <form onSubmit={createEntry} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Programar actividad</span>
            <h3 style={{ marginTop: "2px", fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              {entryFormTitle(getMetaString(newEntry.metadata, "scheduleType"), Boolean(editingEntryId))}
            </h3>
            <p style={{ marginTop: "2px", fontSize: "12px", color: "#64748b" }}>{dayLabel(selectedDay)}</p>
            <div className="mt-3 grid gap-2">
              <StyledSelect
                value={selectedManualScheduleType}
                onChange={(e) =>
                  setNewEntry({
                    ...newEntry,
                    league:
                      e.target.value === "COMPETITION"
                        ? (newEntry.league || "Prueba")
                        : newEntry.league,
                    competitorA: e.target.value === "TRAINING" ? "" : newEntry.competitorA,
                    competitorB: e.target.value === "TRAINING" ? "" : newEntry.competitorB,
                    metadata: {
                      ...newEntry.metadata,
                      scheduleType: e.target.value || undefined,
                    },
                  })
                }
              >
                <option value="">Tipo de fecha</option>
                {MANUAL_SCHEDULE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </StyledSelect>
              <p style={{ fontSize: "11px", color: "#94a3b8" }}>
                Llegada y retiro se calculan automaticamente desde AND (no se cargan manualmente aqui).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <StyledSelect
                  value={getMetaString(newEntry.metadata, "disciplineCategory")}
                  onChange={(e) =>
                    setNewEntry({
                      ...newEntry,
                      metadata: {
                        ...newEntry.metadata,
                        disciplineCategory: e.target.value || undefined,
                        disciplineId: undefined,
                      },
                    })
                  }
                >
                  <option value="">Categoria de disciplina</option>
                  {DISCIPLINE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </StyledSelect>
                <StyledSelect
                  value={getMetaString(newEntry.metadata, "disciplineGender")}
                  onChange={(e) =>
                    setNewEntry({
                      ...newEntry,
                      metadata: {
                        ...newEntry.metadata,
                        disciplineGender: e.target.value || undefined,
                        disciplineId: undefined,
                      },
                    })
                  }
                >
                  <option value="">Genero de disciplina</option>
                  {DISCIPLINE_GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </StyledSelect>
              </div>
              <StyledSelect
                value={getMetaString(newEntry.metadata, "disciplineId")}
                onChange={(e) => {
                  const disciplineId = e.target.value;
                  const found = filteredDisciplineOptions.find((item) => item.id === disciplineId);
                    setNewEntry({
                      ...newEntry,
                      sport: found?.name || "",
                      metadata: {
                        ...newEntry.metadata,
                        disciplineId: disciplineId || undefined,
                      disciplineCategory: found?.category || getMetaString(newEntry.metadata, "disciplineCategory") || undefined,
                      disciplineGender: found?.gender || getMetaString(newEntry.metadata, "disciplineGender") || undefined,
                    },
                  });
                }}
              >
                <option value="">Disciplina vinculada (opcional)</option>
                {filteredDisciplineOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name || item.id}</option>
                ))}
              </StyledSelect>
              <StyledSelect
                value={getMetaString(newEntry.metadata, "delegationId")}
                onChange={(e) =>
                  setNewEntry({
                    ...newEntry,
                    metadata: { ...newEntry.metadata, delegationId: e.target.value || undefined },
                  })
                }
              >
                <option value="">Todas / sin delegacion</option>
                {filteredDelegationOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>
                ))}
              </StyledSelect>
              {isTrainingActivity ? (
                <>
                  <input
                    className="input"
                    placeholder="Descripcion del entrenamiento"
                    value={String(newEntry.metadata?.title ?? "")}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, title: e.target.value } })
                    }
                  />
                  <input
                    className="input"
                    placeholder="Bloque / sesion"
                    value={newEntry.league}
                    onChange={(e) => setNewEntry({ ...newEntry, league: e.target.value })}
                    required
                  />
                </>
              ) : null}
              {isCompetitionActivity ? (
                <>
                  <input
                    className="input"
                    placeholder="Descripcion de la prueba"
                    value={String(newEntry.metadata?.title ?? "")}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, title: e.target.value } })
                    }
                  />
                  <input
                    className="input"
                    placeholder="Fase / categoria"
                    value={newEntry.league}
                    onChange={(e) => setNewEntry({ ...newEntry, league: e.target.value })}
                    required
                  />
                </>
              ) : null}
              {/* Date range toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <button type="button" onClick={() => setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, useDateRange: !(newEntry.metadata as any)?.useDateRange } })}
                  style={{ width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: (newEntry.metadata as any)?.useDateRange ? "#21D0B3" : "#cbd5e1", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 2, left: (newEntry.metadata as any)?.useDateRange ? 20 : 2, width: 16, height: 16, borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Rango de fechas (crear para varios días)</span>
              </div>
              {(newEntry.metadata as any)?.useDateRange ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 2 }}>Fecha inicio</label>
                    <input className="input" type="date" value={(newEntry.metadata as any)?.rangeStart || ""} onChange={(e) => setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, rangeStart: e.target.value } })} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 2 }}>Fecha fin</label>
                    <input className="input" type="date" value={(newEntry.metadata as any)?.rangeEnd || ""} onChange={(e) => setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, rangeEnd: e.target.value } })} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 2 }}>Hora (todos los días)</label>
                    <input className="input" type="time" value={(newEntry.metadata as any)?.rangeTime || ""} onChange={(e) => setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, rangeTime: e.target.value } })} required />
                  </div>
                </div>
              ) : (
                <input
                  className="input"
                  type="datetime-local"
                  value={toLocalDateTimeInput(newEntry.startAtUtc)}
                  onChange={(e) =>
                    setNewEntry({
                      ...newEntry,
                      startAtUtc: fromLocalDateTimeInput(e.target.value),
                    })
                  }
                  required
                />
              )}
              <select className="input" value={newEntry.venue ?? ""} onChange={(e) => setNewEntry({ ...newEntry, venue: e.target.value })}>
                <option value="">Selecciona una sede</option>
                {filteredVenueOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.address ? ` — ${v.address}` : ""}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" type="submit" disabled={saving || !selectedEventId || !selectedManualScheduleType || !getMetaString(newEntry.metadata, "disciplineId")}>
                  {selectedEventId ? (saving ? "Guardando..." : editingEntryId ? "Guardar cambios" : "Crear actividad") : "Selecciona evento principal"}
                </button>
                {editingEntryId ? (
                  <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Actividades del dia</span>
                <p style={{ marginTop: "2px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{dayLabel(selectedDay)}</p>
              </div>
              <Link
                href={`/sports-calendar/day/${selectedDayKey}?eventId=${encodeURIComponent(selectedEventId || "")}&delegationId=${encodeURIComponent(selectedDelegationId || "")}`}
                className="btn btn-primary"
              >
                Ver detalle del dia
              </Link>
            </div>
            {loading ? <p style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>Cargando...</p> : null}
            {!loading && selectedDayEntries.length === 0 ? <p style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>Sin actividades en esta fecha.</p> : null}
            <div className="mt-2 space-y-2">
              {selectedDayEntries.map((entry) => (
                <div key={entry.id} style={{ borderRadius: "10px", border: "1px solid #e2e8f0", borderLeft: "3px solid #21D0B3", background: "#f8fafc", padding: "10px 12px" }}>
                  <p style={{ fontSize: "11px", color: "#94a3b8" }}>{formatTime(entry.startAtUtc)} · {entry.sport} / {entry.league}</p>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{titleFromEvent(entry)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${scheduleTypeBadgeClass(getMetaString(entry.metadata, "scheduleType"))}`}>
                      {scheduleTypeLabel(getMetaString(entry.metadata, "scheduleType"))}
                    </span>
                    {getMetaString(entry.metadata, "delegationId") ? (
                      <span style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(99,102,241,0.1)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#6366f1" }}>
                        {delegationLabelById(delegationOptions, getMetaString(entry.metadata, "delegationId"))}
                      </span>
                    ) : null}
                    {entry.source === "and-derived" && getMetaString(entry.metadata, "peopleCount") ? (
                      <span style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(33,208,179,0.08)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                        {getMetaString(entry.metadata, "peopleCount")} personas
                      </span>
                    ) : null}
                    {entry.source === "and-derived" && getMetaString(entry.metadata, "disciplineCount") ? (
                      <span style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(139,92,246,0.1)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#7c3aed" }}>
                        {getMetaString(entry.metadata, "disciplineCount")} disciplinas
                      </span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{venueLabelById(venueOptions, entry.venue) || "Sede por confirmar"} · {entry.status ?? "SCHEDULED"}</p>
                  {entry.source === "and-derived" && getMetaStringArray(entry.metadata, "disciplineNames").length ? (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8" }}>Detalle</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {getMetaStringArray(entry.metadata, "disciplineNames").map((discipline) => (
                          <span key={discipline} style={{ display: "inline-flex", borderRadius: "99px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                            {discipline}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ marginTop: "8px" }}>
                    {entry.source === "and-derived" ? (
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "#21D0B3" }}>Hito AND (solo lectura)</p>
                    ) : (
                      <div className="flex gap-2">
                        <button className="btn btn-ghost" type="button" onClick={() => onEditEntry(entry)}>Editar</button>
                        <button className="btn btn-ghost" type="button" onClick={() => setPendingDeleteEntryId(entry.id)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-white/90">{message}</p> : null}

      {pendingDeleteEntryId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="surface w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <h4 className="text-base font-semibold text-white">Eliminar actividad</h4>
            <p className="mt-2 text-sm text-white/65">
              Esta accion eliminara la actividad del calendario. ¿Deseas continuar?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPendingDeleteEntryId(null)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={async () => {
                  const id = pendingDeleteEntryId;
                  setPendingDeleteEntryId(null);
                  if (id) await deleteEntry(id);
                }}
                disabled={saving}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


