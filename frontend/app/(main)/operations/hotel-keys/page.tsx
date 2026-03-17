"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type HotelKeyStatus = "AVAILABLE" | "ASSIGNED" | "LOST" | "MAINTENANCE" | string;

type HotelKey = {
  id: string;
  hotelId: string;
  roomId: string;
  bedId?: string | null;
  keyNumber: string;
  copyNumber?: number | null;
  label?: string | null;
  status: HotelKeyStatus;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  issuedAt?: string | null;
  returnedAt?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
};

type HotelKeyMovement = {
  id: string;
  keyId: string;
  action: string;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  actorName?: string | null;
  notes?: string | null;
  happenedAt?: string | null;
  createdAt?: string | null;
};

type EventItem = { id: string; name?: string | null };
type Accommodation = { id: string; eventId?: string | null; name?: string | null };
type HotelRoom = { id: string; hotelId?: string | null; roomNumber?: string | null };
type HotelBed = { id: string; roomId?: string | null; bedType?: string | null };
type Athlete = { id: string; fullName?: string | null };

type KeyForm = {
  hotelId: string;
  roomId: string;
  bedId: string;
  keyNumber: string;
  copyNumber: string;
  label: string;
  notes: string;
};

type IssueForm = {
  holderName: string;
  holderType: string;
  holderParticipantId: string;
  actorName: string;
  notes: string;
};

type ReturnForm = {
  actorName: string;
  notes: string;
};

const statusBadge = (status?: string | null) => {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-400/15 text-emerald-400 ring-1 ring-emerald-400/30";
    case "ASSIGNED":
      return "bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/30";
    case "LOST":
      return "bg-rose-400/15 text-rose-400 ring-1 ring-rose-400/30";
    case "MAINTENANCE":
      return "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30";
    default:
      return "bg-white/10 text-white/60 ring-1 ring-white/20";
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  });
};

const emptyKeyForm = (): KeyForm => ({
  hotelId: "",
  roomId: "",
  bedId: "",
  keyNumber: "",
  copyNumber: "1",
  label: "",
  notes: ""
});

const emptyIssueForm = (): IssueForm => ({
  holderName: "",
  holderType: "",
  holderParticipantId: "",
  actorName: "",
  notes: ""
});

const emptyReturnForm = (): ReturnForm => ({
  actorName: "",
  notes: ""
});

export default function HotelKeysPage() {
  const [keys, setKeys] = useState<HotelKey[]>([]);
  const [movements, setMovements] = useState<HotelKeyMovement[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [hotels, setHotels] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [beds, setBeds] = useState<HotelBed[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState<KeyForm>(emptyKeyForm);
  const [issueForm, setIssueForm] = useState<IssueForm>(emptyIssueForm);
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm);
  const [issueKeyId, setIssueKeyId] = useState<string | null>(null);
  const [returnKeyId, setReturnKeyId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keyData, movementData, eventData, hotelData, roomData, bedData, athleteData] = await Promise.all([
        apiFetch<HotelKey[]>("/hotel-keys"),
        apiFetch<HotelKeyMovement[]>("/hotel-keys/movements"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<Accommodation[]>("/accommodations"),
        apiFetch<HotelRoom[]>("/hotel-rooms"),
        apiFetch<HotelBed[]>("/hotel-beds"),
        apiFetch<Athlete[]>("/athletes")
      ]);
      setKeys(keyData || []);
      setMovements(movementData || []);
      setEvents(eventData || []);
      setHotels(hotelData || []);
      setRooms(roomData || []);
      setBeds(bedData || []);
      setAthletes(filterValidatedAthletes(athleteData || []));

      if (!selectedEventId && (eventData || []).length > 0) {
        setSelectedEventId((eventData || [])[0].id);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar gestión de llaves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedKeyId) return;
    const loadOne = async () => {
      setLoadingMovements(true);
      try {
        const data = await apiFetch<HotelKeyMovement[]>(`/hotel-keys/${selectedKeyId}/movements`);
        setMovements(data || []);
      } catch {
        setMovements([]);
      } finally {
        setLoadingMovements(false);
      }
    };
    loadOne();
  }, [selectedKeyId]);

  const hotelById = useMemo(
    () =>
      hotels.reduce<Record<string, Accommodation>>((acc, hotel) => {
        acc[hotel.id] = hotel;
        return acc;
      }, {}),
    [hotels]
  );

  const roomById = useMemo(
    () =>
      rooms.reduce<Record<string, HotelRoom>>((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms]
  );

  const bedById = useMemo(
    () =>
      beds.reduce<Record<string, HotelBed>>((acc, bed) => {
        acc[bed.id] = bed;
        return acc;
      }, {}),
    [beds]
  );

  const athleteById = useMemo(
    () =>
      athletes.reduce<Record<string, Athlete>>((acc, athlete) => {
        acc[athlete.id] = athlete;
        return acc;
      }, {}),
    [athletes]
  );

  const filteredHotels = useMemo(
    () =>
      hotels.filter((hotel) => (selectedEventId ? hotel.eventId === selectedEventId : true)),
    [hotels, selectedEventId]
  );

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => (keyForm.hotelId ? room.hotelId === keyForm.hotelId : true)),
    [rooms, keyForm.hotelId]
  );

  const filteredBeds = useMemo(
    () =>
      beds.filter((bed) => (keyForm.roomId ? bed.roomId === keyForm.roomId : true)),
    [beds, keyForm.roomId]
  );

  const enrichedKeys = useMemo(() => {
    const term = search.trim().toLowerCase();

    return keys
      .map((key) => {
        const room = roomById[key.roomId];
        const hotel = hotelById[key.hotelId];
        const bed = key.bedId ? bedById[key.bedId] : null;
        const holderAthlete = key.holderParticipantId
          ? athleteById[key.holderParticipantId]
          : null;
        return {
          ...key,
          hotelName: hotel?.name || key.hotelId,
          eventId: hotel?.eventId || "",
          roomNumber: room?.roomNumber || key.roomId,
          bedLabel: bed?.bedType || (key.bedId ? key.bedId : "-"),
          holderText:
            holderAthlete?.fullName ||
            key.holderName ||
            (key.status === "ASSIGNED" ? "Asignada" : "Sin asignar")
        };
      })
      .filter((key) => (selectedEventId ? key.eventId === selectedEventId : true))
      .filter((key) => (selectedHotelId ? key.hotelId === selectedHotelId : true))
      .filter((key) => (selectedStatus ? key.status === selectedStatus : true))
      .filter((key) => {
        if (!term) return true;
        return [
          key.keyNumber,
          key.label,
          key.hotelName,
          key.roomNumber,
          key.holderText
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const score = (status: string) =>
          status === "ASSIGNED" ? 0 : status === "AVAILABLE" ? 1 : status === "MAINTENANCE" ? 2 : 3;
        const statusCompare = score(a.status) - score(b.status);
        if (statusCompare !== 0) return statusCompare;
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [keys, roomById, hotelById, bedById, athleteById, selectedEventId, selectedHotelId, selectedStatus, search]);

  const selectedKey = useMemo(
    () => enrichedKeys.find((item) => item.id === selectedKeyId) || null,
    [enrichedKeys, selectedKeyId]
  );

  const selectedMovements = useMemo(() => {
    if (!selectedKeyId) return [];
    return movements.filter((movement) => movement.keyId === selectedKeyId);
  }, [movements, selectedKeyId]);

  const stats = useMemo(() => {
    const total = enrichedKeys.length;
    const available = enrichedKeys.filter((item) => item.status === "AVAILABLE").length;
    const assigned = enrichedKeys.filter((item) => item.status === "ASSIGNED").length;
    const maintenance = enrichedKeys.filter((item) => item.status === "MAINTENANCE").length;
    const lost = enrichedKeys.filter((item) => item.status === "LOST").length;
    return { total, available, assigned, maintenance, lost };
  }, [enrichedKeys]);

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/hotel-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: keyForm.hotelId,
          roomId: keyForm.roomId,
          bedId: keyForm.bedId || null,
          keyNumber: keyForm.keyNumber,
          copyNumber: Number(keyForm.copyNumber || "1"),
          label: keyForm.label || null,
          notes: keyForm.notes || null
        })
      });
      setKeyForm(emptyKeyForm());
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la llave");
    }
  };

  const submitIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!issueKeyId) return;
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${issueKeyId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderName: issueForm.holderName,
          holderType: issueForm.holderType || null,
          holderParticipantId: issueForm.holderParticipantId || null,
          actorName: issueForm.actorName || null,
          notes: issueForm.notes || null
        })
      });
      setIssueForm(emptyIssueForm());
      setIssueKeyId(null);
      await loadData();
      setSelectedKeyId(issueKeyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar la llave");
    }
  };

  const submitReturn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returnKeyId) return;
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${returnKeyId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: returnForm.actorName || null,
          notes: returnForm.notes || null
        })
      });
      setReturnForm(emptyReturnForm());
      setReturnKeyId(null);
      await loadData();
      setSelectedKeyId(returnKeyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la devolución");
    }
  };

  const changeStatus = async (keyId: string, status: HotelKeyStatus) => {
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${keyId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          actorName: "Operaciones Hotelería"
        })
      });
      await loadData();
      setSelectedKeyId(keyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar estado");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de llaves"
        description="Control operativo de entrega, devolución y estado de llaves por habitación y cama."
        action={
          <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        }
      />

      <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_10%_10%,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.2),transparent_35%),linear-gradient(125deg,#022c22_0%,#065f46_45%,#0f766e_100%)] p-6 text-white shadow-[0_24px_70px_rgba(6,95,70,0.28)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white/70">Hotelería</p>
            <h2 className="mt-2 font-sans font-bold text-4xl leading-tight">Control centralizado de llaves</h2>
            <p className="mt-2 text-sm text-white/80">
              Cada llave y copia queda trazada con responsable, timestamps y bitácora operativa.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/70">Última sincronización</p>
            <p className="mt-1 font-semibold">{lastUpdated ? formatDateTime(lastUpdated.toISOString()) : "-"}</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-[26px] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            className="input h-11 rounded-2xl"
            value={selectedEventId}
            onChange={(event) => {
              setSelectedEventId(event.target.value);
              setSelectedHotelId("");
            }}
          >
            <option value="">Todos los eventos</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.id}
              </option>
            ))}
          </select>
          <select
            className="input h-11 rounded-2xl"
            value={selectedHotelId}
            onChange={(event) => setSelectedHotelId(event.target.value)}
          >
            <option value="">Todos los hoteles</option>
            {filteredHotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name || hotel.id}
              </option>
            ))}
          </select>
          <select
            className="input h-11 rounded-2xl"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Entregada</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="LOST">Perdida</option>
          </select>
          <input
            className="input h-11 rounded-2xl"
            placeholder="Buscar llave, habitación, hotel o responsable"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="surface rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Total</p>
          <p className="mt-2 text-3xl font-sans font-bold text-white">{stats.total}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Disponibles</p>
          <p className="mt-2 text-3xl font-sans font-bold text-emerald-400">{stats.available}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Entregadas</p>
          <p className="mt-2 text-3xl font-sans font-bold text-sky-400">{stats.assigned}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Mantenimiento</p>
          <p className="mt-2 text-3xl font-sans font-bold text-amber-400">{stats.maintenance}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Perdidas</p>
          <p className="mt-2 text-3xl font-sans font-bold text-rose-400">{stats.lost}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <article className="surface rounded-[26px] p-5">
            <h3 className="font-sans font-bold text-2xl text-white">Inventario de llaves</h3>
            <p className="mt-1 text-sm text-white/50">Selecciona una llave para ver su bitácora y operar entrega/devolución.</p>
            <div className="mt-4 space-y-3">
              {enrichedKeys.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-white/50">
                  Sin llaves registradas para este filtro.
                </div>
              ) : (
                enrichedKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`rounded-2xl border p-4 transition ${
                      selectedKeyId === key.id
                        ? "border-emerald-400/40 bg-emerald-400/10 shadow-sm"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(key.status)}`}>
                            {key.status}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-white/50 hover:text-white/80"
                            onClick={() => setSelectedKeyId(key.id)}
                          >
                            Ver bitácora
                          </button>
                        </div>
                        <h4 className="mt-2 font-sans font-bold text-2xl text-white">
                          {key.keyNumber} · Copia {key.copyNumber || 1}
                        </h4>
                        <p className="text-sm text-white/50">
                          {key.hotelName} · Habitación {key.roomNumber} · Cama {key.bedLabel}
                        </p>
                        <p className="mt-1 text-sm text-white/65">
                          Responsable: <span className="font-semibold text-white">{key.holderText}</span>
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          Entrega: {formatDateTime(key.issuedAt)} · Devolución: {formatDateTime(key.returnedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {key.status !== "ASSIGNED" && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                            onClick={() => {
                              setIssueKeyId(key.id);
                              setIssueForm((prev) => ({
                                ...prev,
                                holderName: key.holderName || "",
                                holderType: key.holderType || ""
                              }));
                              setReturnKeyId(null);
                              setSelectedKeyId(key.id);
                            }}
                          >
                            Entregar
                          </button>
                        )}
                        {key.status === "ASSIGNED" && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                            onClick={() => {
                              setReturnKeyId(key.id);
                              setIssueKeyId(null);
                              setSelectedKeyId(key.id);
                            }}
                          >
                            Registrar devolución
                          </button>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-400/20"
                          onClick={() => changeStatus(key.id, "MAINTENANCE")}
                        >
                          Mantenimiento
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-400/20"
                          onClick={() => changeStatus(key.id, "LOST")}
                        >
                          Marcar perdida
                        </button>
                        {key.status !== "AVAILABLE" && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-400/20"
                            onClick={() => changeStatus(key.id, "AVAILABLE")}
                          >
                            Marcar disponible
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="space-y-4">
          <article className="surface rounded-[26px] p-5">
            <h3 className="font-sans font-bold text-2xl text-white">Alta de llave</h3>
            <form className="mt-4 space-y-3" onSubmit={submitCreate}>
              <select
                className="input rounded-2xl"
                value={keyForm.hotelId}
                onChange={(event) =>
                  setKeyForm((prev) => ({
                    ...prev,
                    hotelId: event.target.value,
                    roomId: "",
                    bedId: ""
                  }))
                }
                required
              >
                <option value="">Selecciona hotel</option>
                {filteredHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name || hotel.id}
                  </option>
                ))}
              </select>
              <select
                className="input rounded-2xl"
                value={keyForm.roomId}
                onChange={(event) =>
                  setKeyForm((prev) => ({
                    ...prev,
                    roomId: event.target.value,
                    bedId: ""
                  }))
                }
                required
              >
                <option value="">Selecciona habitación</option>
                {filteredRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Habitación {room.roomNumber || room.id}
                  </option>
                ))}
              </select>
              <select
                className="input rounded-2xl"
                value={keyForm.bedId}
                onChange={(event) => setKeyForm((prev) => ({ ...prev, bedId: event.target.value }))}
              >
                <option value="">Sin cama asociada</option>
                {filteredBeds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.bedType || "Cama"} · {bed.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input rounded-2xl"
                  placeholder="Número llave"
                  value={keyForm.keyNumber}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, keyNumber: event.target.value }))}
                  required
                />
                <input
                  className="input rounded-2xl"
                  placeholder="N° copia"
                  type="number"
                  min={1}
                  value={keyForm.copyNumber}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, copyNumber: event.target.value }))}
                  required
                />
              </div>
              <input
                className="input rounded-2xl"
                placeholder="Etiqueta opcional"
                value={keyForm.label}
                onChange={(event) => setKeyForm((prev) => ({ ...prev, label: event.target.value }))}
              />
              <textarea
                className="input min-h-[90px] rounded-2xl"
                placeholder="Notas de inventario"
                value={keyForm.notes}
                onChange={(event) => setKeyForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <button className="btn btn-primary w-full justify-center" type="submit">
                Registrar llave
              </button>
            </form>
          </article>

          {issueKeyId && (
            <article className="surface rounded-[26px] p-5">
              <h3 className="font-sans font-bold text-2xl text-white">Entrega de llave</h3>
              <form className="mt-4 space-y-3" onSubmit={submitIssue}>
                <select
                  className="input rounded-2xl"
                  value={issueForm.holderParticipantId}
                  onChange={(event) => {
                    const athlete = athleteById[event.target.value];
                    setIssueForm((prev) => ({
                      ...prev,
                      holderParticipantId: event.target.value,
                      holderName: athlete?.fullName || prev.holderName
                    }));
                  }}
                >
                  <option value="">Seleccionar participante (opcional)</option>
                  {athletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.fullName || athlete.id}
                    </option>
                  ))}
                </select>
                <input
                  className="input rounded-2xl"
                  placeholder="Nombre de quien recibe"
                  value={issueForm.holderName}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, holderName: event.target.value }))}
                  required
                />
                <input
                  className="input rounded-2xl"
                  placeholder="Rol / tipo (atleta, staff, delegación)"
                  value={issueForm.holderType}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, holderType: event.target.value }))}
                />
                <input
                  className="input rounded-2xl"
                  placeholder="Operador que entrega"
                  value={issueForm.actorName}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, actorName: event.target.value }))}
                />
                <textarea
                  className="input min-h-[80px] rounded-2xl"
                  placeholder="Observaciones de entrega"
                  value={issueForm.notes}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1 justify-center" type="submit">
                    Confirmar entrega
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setIssueKeyId(null);
                      setIssueForm(emptyIssueForm());
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          )}

          {returnKeyId && (
            <article className="surface rounded-[26px] p-5">
              <h3 className="font-sans font-bold text-2xl text-white">Devolución de llave</h3>
              <form className="mt-4 space-y-3" onSubmit={submitReturn}>
                <input
                  className="input rounded-2xl"
                  placeholder="Operador que recibe"
                  value={returnForm.actorName}
                  onChange={(event) => setReturnForm((prev) => ({ ...prev, actorName: event.target.value }))}
                />
                <textarea
                  className="input min-h-[80px] rounded-2xl"
                  placeholder="Observaciones de devolución"
                  value={returnForm.notes}
                  onChange={(event) => setReturnForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1 justify-center" type="submit">
                    Confirmar devolución
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setReturnKeyId(null);
                      setReturnForm(emptyReturnForm());
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          )}

          <article className="surface rounded-[26px] p-5">
            <h3 className="font-sans font-bold text-2xl text-white">Bitácora</h3>
            {!selectedKey ? (
              <p className="mt-3 text-sm text-white/50">Selecciona una llave para ver su historial.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-white/50">
                  Llave <span className="font-semibold text-white">{selectedKey.keyNumber}</span> · Habitación{" "}
                  <span className="font-semibold text-white">{selectedKey.roomNumber}</span>
                </p>
                <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
                  {loadingMovements ? (
                    <p className="text-sm text-white/50">Cargando movimientos...</p>
                  ) : selectedMovements.length === 0 ? (
                    <p className="text-sm text-white/50">Sin movimientos registrados.</p>
                  ) : (
                    selectedMovements.map((movement) => (
                      <div key={movement.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                            {movement.action}
                          </span>
                          <span className="text-xs text-white/50">
                            {formatDateTime(movement.happenedAt || movement.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white/85">
                          {movement.holderName || movement.actorName || "Sin responsable informado"}
                        </p>
                        {movement.notes ? (
                          <p className="mt-1 text-xs text-white/50">{movement.notes}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}


