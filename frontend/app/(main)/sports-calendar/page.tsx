"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type EventOption = { id: string; name: string };

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
const CSV_HEADERS =
  "eventId,sport,league,season,title,competitorA,competitorB,venue,startAtUtc,status,source";

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
      metadata: title ? { title } : undefined,
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
  const [selectedEventId, setSelectedEventId] = useState("");
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
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo cargar calendario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventOptions();
  }, []);

  useEffect(() => {
    loadEntries();
  }, [monthCursor, selectedEventId, sportFilter, phaseFilter, personFilter, statusFilter]);

  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const todayKey = isoDayKey(new Date());
  const selectedDayKey = isoDayKey(selectedDay);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, SportsEvent[]>();
    entries.forEach((entry) => {
      const key = isoDayKey(entry.startAtUtc);
      const current = map.get(key) ?? [];
      current.push(entry);
      map.set(key, current);
    });
    return map;
  }, [entries]);

  const selectedDayEntries = groupedByDay.get(selectedDayKey) ?? [];
  const liveCount = entries.filter((entry) => (entry.status ?? "").toUpperCase() === "LIVE").length;

  const createEntry = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(
        editingEntryId
          ? `/sports-calendar/events/${editingEntryId}`
          : "/sports-calendar/events",
        {
          method: editingEntryId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newEntry,
            eventId: selectedEventId || undefined,
            metadata:
              newEntry.metadata && Object.keys(newEntry.metadata).length > 0
                ? newEntry.metadata
                : undefined,
          }),
        },
      );
      setMessage(editingEntryId ? "Prueba actualizada." : "Prueba creada en calendario.");
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
            ? "No se pudo actualizar la prueba."
            : "No se pudo crear la prueba.",
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
        setMessage(`Carga masiva completada: ${result.inserted} pruebas.`);
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
      `${selectedEventId || ""},Atletismo,100m Semifinal,2026,Semifinal 100m varones,,,Estadio Nacional,2026-02-20T14:00:00.000Z,SCHEDULED,csv`;
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
      setMessage("Prueba eliminada.");
      await loadEntries();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo eliminar la prueba.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl border border-slate-300 p-5 text-white"
        style={{ background: "linear-gradient(110deg, #0f172a 0%, #0f766e 58%, #0ea5a0 100%)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/85">Calendario deportivo</p>
            <h1 className="mt-1 text-2xl font-semibold">Planificacion por disciplinas y pruebas</h1>
            <p className="mt-1 text-sm text-white/85">
              Compatible con pruebas individuales y deportes de equipo en sede neutral.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-700 px-3 py-1 text-xs">{entries.length} pruebas</span>
            <span className="rounded-full bg-rose-700 px-3 py-1 text-xs">{liveCount} en vivo</span>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-4">
        <div className="grid gap-2 lg:grid-cols-12">
          <select className="input lg:col-span-3" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Todos los eventos principales</option>
            {eventOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input className="input lg:col-span-2" placeholder="Disciplina" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} />
          <input className="input lg:col-span-2" placeholder="Fase/Categoria" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} />
          <input className="input lg:col-span-2" placeholder="Competidor o delegacion" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} />
          <select className="input lg:col-span-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status === "ALL" ? "Todos" : status}</option>
            ))}
          </select>
          <button className="btn btn-ghost lg:col-span-1" type="button" onClick={downloadTemplate}>Template CSV</button>
          <button className="btn btn-primary lg:col-span-1" type="button" onClick={() => fileRef.current?.click()} disabled={saving}>
            {saving ? "Importando..." : "Cargar CSV"}
          </button>
          <input ref={fileRef} className="hidden" type="file" accept=".csv,text/csv" onChange={uploadCsv} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="surface rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost" type="button" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Mes anterior</button>
              <button className="btn btn-ghost" type="button" onClick={() => { const now = new Date(); setMonthCursor(startOfMonth(now)); setSelectedDay(now); }}>Hoy</button>
              <button className="btn btn-ghost" type="button" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Mes siguiente</button>
            </div>
            <h2 className="text-lg font-semibold capitalize text-slate-900">{monthLabel(monthCursor)}</h2>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.14em] text-slate-500">
            {WEEK_LABELS.map((label) => <div key={label}>{label}</div>)}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthGrid.map((day) => {
              const key = isoDayKey(day);
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDayKey;
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
                  className={[
                    "min-h-[110px] rounded-xl border p-2 text-left transition",
                    inMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-400",
                    isToday ? "ring-2 ring-emerald-300" : "",
                    isSelected ? "border-emerald-400 bg-emerald-50" : "",
                  ].join(" ")}
                >
                  <p className="text-xs font-semibold">{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="rounded bg-slate-100 px-1 py-0.5">
                        <p className="truncate text-[10px] font-semibold text-slate-700">
                          {titleFromEvent(entry)}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {formatTime(entry.startAtUtc)} {entry.venue ? `- ${entry.venue}` : ""}
                        </p>
                      </div>
                    ))}
                    {dayEntries.length > 3 ? (
                      <p className="text-[10px] text-slate-500">+{dayEntries.length - 3} mas</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <form onSubmit={createEntry} className="surface rounded-2xl p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              {editingEntryId ? "Editar prueba" : "Programar prueba"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{dayLabel(selectedDay)}</p>
            <div className="mt-3 grid gap-2">
              <input className="input" placeholder="Disciplina" value={newEntry.sport} onChange={(e) => setNewEntry({ ...newEntry, sport: e.target.value })} required />
              <input className="input" placeholder="Fase/Categoria" value={newEntry.league} onChange={(e) => setNewEntry({ ...newEntry, league: e.target.value })} required />
              <input className="input" placeholder="Descripcion" value={String(newEntry.metadata?.title ?? "")} onChange={(e) => setNewEntry({ ...newEntry, metadata: { ...newEntry.metadata, title: e.target.value } })} />
              <input className="input" placeholder="Competidor/Delegacion A" value={newEntry.competitorA ?? ""} onChange={(e) => setNewEntry({ ...newEntry, competitorA: e.target.value })} />
              <input className="input" placeholder="Competidor/Delegacion B" value={newEntry.competitorB ?? ""} onChange={(e) => setNewEntry({ ...newEntry, competitorB: e.target.value })} />
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
              <input className="input" placeholder="Sede" value={newEntry.venue ?? ""} onChange={(e) => setNewEntry({ ...newEntry, venue: e.target.value })} />
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" type="submit" disabled={saving || !selectedEventId}>
                  {selectedEventId ? (saving ? "Guardando..." : editingEntryId ? "Guardar cambios" : "Crear prueba") : "Selecciona evento principal"}
                </button>
                {editingEntryId ? (
                  <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <div className="surface rounded-2xl p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Pruebas del dia</h3>
            {loading ? <p className="mt-2 text-sm text-slate-500">Cargando...</p> : null}
            {!loading && selectedDayEntries.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin pruebas en esta fecha.</p> : null}
            <div className="mt-2 space-y-2">
              {selectedDayEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">{formatTime(entry.startAtUtc)} - {entry.sport} / {entry.league}</p>
                  <p className="text-sm font-semibold text-slate-900">{titleFromEvent(entry)}</p>
                  <p className="text-xs text-slate-600">{entry.venue ?? "Sede por confirmar"} - {entry.status ?? "SCHEDULED"}</p>
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => onEditEntry(entry)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => setPendingDeleteEntryId(entry.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      {pendingDeleteEntryId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-900">Eliminar prueba</h4>
            <p className="mt-2 text-sm text-slate-600">
              Esta accion eliminara la prueba del calendario. ¿Deseas continuar?
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
