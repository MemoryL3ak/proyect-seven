"use client";

import { useEffect, useMemo, useState } from "react";
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
  hotelId: string; roomId: string; bedId: string;
  keyNumber: string; copyNumber: string; label: string; notes: string;
};
type IssueForm = {
  holderName: string; holderType: string; holderParticipantId: string; actorName: string; notes: string;
};
type ReturnForm = { actorName: string; notes: string };

const STATUS_STYLES: Record<string, { accent: string; chipBg: string; chipBorder: string; label: string }> = {
  AVAILABLE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.10)",  chipBorder: "rgba(16,185,129,0.28)",  label: "Disponible"    },
  ASSIGNED:    { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.10)",  chipBorder: "rgba(59,130,246,0.28)",  label: "Entregada"     },
  MAINTENANCE: { accent: "#f59e0b", chipBg: "rgba(245,158,11,0.10)",  chipBorder: "rgba(245,158,11,0.28)",  label: "Mantenimiento" },
  LOST:        { accent: "#ef4444", chipBg: "rgba(239,68,68,0.08)",   chipBorder: "rgba(239,68,68,0.25)",   label: "Perdida"       },
};
const getStatus = (s?: string | null) =>
  STATUS_STYLES[s ?? ""] ?? { accent: "#94a3b8", chipBg: "rgba(148,163,184,0.10)", chipBorder: "rgba(148,163,184,0.22)", label: s || "-" };

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
};

const emptyKeyForm = (): KeyForm => ({ hotelId: "", roomId: "", bedId: "", keyNumber: "", copyNumber: "1", label: "", notes: "" });
const emptyIssueForm = (): IssueForm => ({ holderName: "", holderType: "", holderParticipantId: "", actorName: "", notes: "" });
const emptyReturnForm = (): ReturnForm => ({ actorName: "", notes: "" });

const inputStyle: React.CSSProperties = {
  width: "100%", height: "38px", padding: "0 12px", borderRadius: "10px",
  border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a",
  fontSize: "13px", outline: "none",
};
const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "10px",
  border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a",
  fontSize: "13px", outline: "none", resize: "vertical" as const, minHeight: "80px",
};
const selectStyle: React.CSSProperties = { ...inputStyle };

const KPI_ICONS = [
  <svg key="k" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="17" r="3"/><path d="M10.83 14.17l6.44-6.43"/><path d="M14 8l2-2 4 4-2 2"/></svg>,
  <svg key="a" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  <svg key="e" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="17" r="3"/><path d="M10.83 14.17l6.44-6.43"/><path d="M14 8l2-2 4 4-2 2"/><circle cx="17" cy="7" r="1" fill="currentColor"/></svg>,
  <svg key="m" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  <svg key="l" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
];

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

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedKeyId) return;
    const loadOne = async () => {
      setLoadingMovements(true);
      try {
        const data = await apiFetch<HotelKeyMovement[]>(`/hotel-keys/${selectedKeyId}/movements`);
        setMovements(data || []);
      } catch { setMovements([]); }
      finally { setLoadingMovements(false); }
    };
    loadOne();
  }, [selectedKeyId]);

  const hotelById = useMemo(() => hotels.reduce<Record<string, Accommodation>>((acc, h) => { acc[h.id] = h; return acc; }, {}), [hotels]);
  const roomById  = useMemo(() => rooms.reduce<Record<string, HotelRoom>>((acc, r) => { acc[r.id] = r; return acc; }, {}), [rooms]);
  const bedById   = useMemo(() => beds.reduce<Record<string, HotelBed>>((acc, b) => { acc[b.id] = b; return acc; }, {}), [beds]);
  const athleteById = useMemo(() => athletes.reduce<Record<string, Athlete>>((acc, a) => { acc[a.id] = a; return acc; }, {}), [athletes]);

  const filteredHotels = useMemo(() => hotels.filter((h) => (selectedEventId ? h.eventId === selectedEventId : true)), [hotels, selectedEventId]);
  const filteredRooms  = useMemo(() => rooms.filter((r) => (keyForm.hotelId ? r.hotelId === keyForm.hotelId : true)), [rooms, keyForm.hotelId]);
  const filteredBeds   = useMemo(() => beds.filter((b) => (keyForm.roomId ? b.roomId === keyForm.roomId : true)), [beds, keyForm.roomId]);

  const enrichedKeys = useMemo(() => {
    const term = search.trim().toLowerCase();
    return keys
      .map((key) => {
        const room = roomById[key.roomId];
        const hotel = hotelById[key.hotelId];
        const bed = key.bedId ? bedById[key.bedId] : null;
        const holderAthlete = key.holderParticipantId ? athleteById[key.holderParticipantId] : null;
        return {
          ...key,
          hotelName: hotel?.name || key.hotelId,
          eventId: hotel?.eventId || "",
          roomNumber: room?.roomNumber || key.roomId,
          bedLabel: bed?.bedType || (key.bedId ? key.bedId : "-"),
          holderText: holderAthlete?.fullName || key.holderName || (key.status === "ASSIGNED" ? "Asignada" : "Sin asignar"),
        };
      })
      .filter((key) => (selectedEventId ? key.eventId === selectedEventId : true))
      .filter((key) => (selectedHotelId ? key.hotelId === selectedHotelId : true))
      .filter((key) => (selectedStatus ? key.status === selectedStatus : true))
      .filter((key) => {
        if (!term) return true;
        return [key.keyNumber, key.label, key.hotelName, key.roomNumber, key.holderText]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const score = (s: string) => s === "ASSIGNED" ? 0 : s === "AVAILABLE" ? 1 : s === "MAINTENANCE" ? 2 : 3;
        const d = score(a.status) - score(b.status);
        return d !== 0 ? d : String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [keys, roomById, hotelById, bedById, athleteById, selectedEventId, selectedHotelId, selectedStatus, search]);

  const selectedKey = useMemo(() => enrichedKeys.find((item) => item.id === selectedKeyId) || null, [enrichedKeys, selectedKeyId]);
  const selectedMovements = useMemo(() => {
    if (!selectedKeyId) return [];
    return movements.filter((mv) => mv.keyId === selectedKeyId);
  }, [movements, selectedKeyId]);

  const stats = useMemo(() => {
    const total       = enrichedKeys.length;
    const available   = enrichedKeys.filter((k) => k.status === "AVAILABLE").length;
    const assigned    = enrichedKeys.filter((k) => k.status === "ASSIGNED").length;
    const maintenance = enrichedKeys.filter((k) => k.status === "MAINTENANCE").length;
    const lost        = enrichedKeys.filter((k) => k.status === "LOST").length;
    return { total, available, assigned, maintenance, lost };
  }, [enrichedKeys]);

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    try {
      await apiFetch("/hotel-keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: keyForm.hotelId, roomId: keyForm.roomId, bedId: keyForm.bedId || null, keyNumber: keyForm.keyNumber, copyNumber: Number(keyForm.copyNumber || "1"), label: keyForm.label || null, notes: keyForm.notes || null }),
      });
      setKeyForm(emptyKeyForm()); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo crear la llave"); }
  };

  const submitIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!issueKeyId) return; setError(null);
    try {
      await apiFetch(`/hotel-keys/${issueKeyId}/issue`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holderName: issueForm.holderName, holderType: issueForm.holderType || null, holderParticipantId: issueForm.holderParticipantId || null, actorName: issueForm.actorName || null, notes: issueForm.notes || null }),
      });
      setIssueForm(emptyIssueForm()); setIssueKeyId(null); await loadData(); setSelectedKeyId(issueKeyId);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo entregar la llave"); }
  };

  const submitReturn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!returnKeyId) return; setError(null);
    try {
      await apiFetch(`/hotel-keys/${returnKeyId}/return`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorName: returnForm.actorName || null, notes: returnForm.notes || null }),
      });
      setReturnForm(emptyReturnForm()); setReturnKeyId(null); await loadData(); setSelectedKeyId(returnKeyId);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar la devolución"); }
  };

  const changeStatus = async (keyId: string, status: HotelKeyStatus) => {
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${keyId}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actorName: "Operaciones Hotelería" }),
      });
      await loadData(); setSelectedKeyId(keyId);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar estado"); }
  };

  const [deleteKeyConfirm, setDeleteKeyConfirm] = useState<string | null>(null);
  const removeKey = async (keyId: string) => {
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${keyId}`, { method: "DELETE" });
      setDeleteKeyConfirm(null);
      if (selectedKeyId === keyId) setSelectedKeyId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la llave");
    }
  };

  const assignedPct = stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0;

  const kpiCards = [
    { label: "Total llaves",  value: stats.total,       color: "#64748b", i: 0, sub: "En inventario" },
    { label: "Disponibles",   value: stats.available,   color: "#10b981", i: 1, sub: "Listas para entrega" },
    { label: "Entregadas",    value: stats.assigned,    color: "#3b82f6", i: 2, sub: `${assignedPct}% del total` },
    { label: "Mantenimiento", value: stats.maintenance, color: "#f59e0b", i: 3, sub: "Fuera de servicio" },
    { label: "Perdidas",      value: stats.lost,        color: "#ef4444", i: 4, sub: stats.lost > 0 ? "¡Requiere atención!" : "Sin incidencias" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Command panel */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>Operaciones</p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, marginBottom: "4px" }}>Gestión de llaves</h1>
            <p style={{ fontSize: "13px", color: "#64748b" }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Control operativo en tiempo real"}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <select style={selectStyle} value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedHotelId(""); }}>
              <option value="">Todos los eventos</option>
              {events.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
            <select style={selectStyle} value={selectedHotelId} onChange={(e) => setSelectedHotelId(e.target.value)}>
              <option value="">Todos los hoteles</option>
              {filteredHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name || hotel.id}</option>)}
            </select>
            <select style={selectStyle} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="ASSIGNED">Entregada</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="LOST">Perdida</option>
            </select>
            <input style={inputStyle} placeholder="Buscar llave, habitación, hotel…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button onClick={loadData} disabled={loading} style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "9px 16px",
              color: loading ? "#94a3b8" : "#475569", fontSize: "13px", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>
        {error && <p style={{ marginTop: "10px", fontSize: "13px", color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <article key={card.label} style={{
            background: "#ffffff", border: "1px solid #e2e8f0",
            borderTop: `3px solid ${card.color}`, borderRadius: "20px",
            padding: "18px 20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            transition: "transform 120ms ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ color: card.color, display: "flex" }}>{KPI_ICONS[card.i]}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>{card.label}</span>
              </div>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: card.color, display: "inline-block" }} />
            </div>
            <p style={{ fontSize: "2.4rem", fontWeight: 800, color: card.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : card.value}
            </p>
            <p style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>{card.sub}</p>
          </article>
        ))}
      </section>

      {/* ── Main grid */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

        {/* Inventory list */}
        <article style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Control de inventario</p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>Inventario de llaves</h3>
            <p style={{ marginTop: "3px", fontSize: "13px", color: "#64748b" }}>Selecciona una llave para ver su bitácora y operar entrega/devolución.</p>
          </div>
          <div className="space-y-3">
            {enrichedKeys.length === 0 ? (
              <div style={{ borderRadius: "16px", border: "1px dashed #e2e8f0", background: "#f8fafc", padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                Sin llaves registradas para este filtro.
              </div>
            ) : (
              enrichedKeys.map((key) => {
                const ss = getStatus(key.status);
                const isSelected = selectedKeyId === key.id;
                return (
                  <div key={key.id} style={{
                    background: isSelected ? `${ss.accent}08` : "#f8fafc",
                    border: `1px solid ${isSelected ? ss.accent + "40" : "#e2e8f0"}`,
                    borderLeft: `4px solid ${ss.accent}`,
                    borderRadius: "16px", padding: "14px 16px",
                    transition: "all 120ms ease",
                  }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: ss.chipBg, border: `1px solid ${ss.chipBorder}`, borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: ss.accent }}>
                            {ss.label}
                          </span>
                          <button type="button" onClick={() => setSelectedKeyId(key.id)}
                            style={{ fontSize: "12px", fontWeight: 600, color: "#21D0B3", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            Ver bitácora →
                          </button>
                        </div>
                        <h4 style={{ fontWeight: 800, fontSize: "18px", color: "#0f172a", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="17" r="3"/><path d="M10.83 14.17l6.44-6.43"/><path d="M14 8l2-2 4 4-2 2"/></svg>
                          {key.keyNumber} · Copia {key.copyNumber || 1}
                        </h4>
                        <p style={{ fontSize: "13px", color: "#64748b" }}>
                          {key.hotelName} · Hab. {key.roomNumber} · Cama {key.bedLabel}
                        </p>
                        <p style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
                          Responsable: <span style={{ fontWeight: 700, color: "#0f172a" }}>{key.holderText}</span>
                        </p>
                        <p style={{ marginTop: "3px", fontSize: "11px", color: "#94a3b8" }}>
                          Entrega: {formatDateTime(key.issuedAt)} · Dev.: {formatDateTime(key.returnedAt)}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "flex-start" }}>
                        {key.status !== "ASSIGNED" && (
                          <button type="button" onClick={() => { setIssueKeyId(key.id); setIssueForm((p) => ({ ...p, holderName: key.holderName || "", holderType: key.holderType || "" })); setReturnKeyId(null); setSelectedKeyId(key.id); }}
                            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#3b82f6", cursor: "pointer" }}>
                            Entregar
                          </button>
                        )}
                        {key.status === "ASSIGNED" && (
                          <button type="button" onClick={() => { setReturnKeyId(key.id); setIssueKeyId(null); setSelectedKeyId(key.id); }}
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#10b981", cursor: "pointer" }}>
                            Registrar devolución
                          </button>
                        )}
                        <button type="button" onClick={() => changeStatus(key.id, "MAINTENANCE")}
                          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "99px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#f59e0b", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        </button>
                        <button type="button" onClick={() => changeStatus(key.id, "LOST")}
                          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: "99px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </button>
                        {key.status !== "AVAILABLE" && (
                          <button type="button" onClick={() => changeStatus(key.id, "AVAILABLE")}
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: "99px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#10b981", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </button>
                        )}
                        <button type="button" onClick={() => setDeleteKeyConfirm(key.id)}
                          style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "99px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#f43f5e", cursor: "pointer", display: "flex", alignItems: "center" }}
                          title="Eliminar llave">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Alta de llave */}
          <article style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderTop: "3px solid #21D0B3", borderRadius: "24px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "4px" }}>Registrar</p>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", marginBottom: "14px" }}>Alta de llave</h3>
            <form style={{ display: "flex", flexDirection: "column", gap: "10px" }} onSubmit={submitCreate}>
              <select style={selectStyle} value={keyForm.hotelId} onChange={(e) => setKeyForm((p) => ({ ...p, hotelId: e.target.value, roomId: "", bedId: "" }))} required>
                <option value="">Selecciona hotel</option>
                {filteredHotels.map((h) => <option key={h.id} value={h.id}>{h.name || h.id}</option>)}
              </select>
              <select style={selectStyle} value={keyForm.roomId} onChange={(e) => setKeyForm((p) => ({ ...p, roomId: e.target.value }))} required>
                <option value="">Selecciona habitación</option>
                {filteredRooms.map((r) => <option key={r.id} value={r.id}>Habitación {r.roomNumber || r.id}</option>)}
              </select>
              <input style={inputStyle} placeholder="Número de llave" value={keyForm.keyNumber} onChange={(e) => setKeyForm((p) => ({ ...p, keyNumber: e.target.value }))} required />
              <button type="submit" style={{ padding: "10px", borderRadius: "10px", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.35)" }}>
                Registrar llave
              </button>
            </form>
          </article>

          {/* Entrega */}
          {issueKeyId && (
            <article style={{ background: "#ffffff", border: "1px solid rgba(59,130,246,0.3)", borderTop: "3px solid #3b82f6", borderRadius: "24px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#3b82f6", marginBottom: "4px" }}>Operación</p>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="17" r="3"/><path d="M10.83 14.17l6.44-6.43"/><path d="M14 8l2-2 4 4-2 2"/></svg>
                Entrega de llave
              </h3>
              <form style={{ display: "flex", flexDirection: "column", gap: "10px" }} onSubmit={submitIssue}>
                <select style={selectStyle} value={issueForm.holderParticipantId}
                  onChange={(e) => { const a = athleteById[e.target.value]; setIssueForm((p) => ({ ...p, holderParticipantId: e.target.value, holderName: a?.fullName || p.holderName })); }} required>
                  <option value="">Seleccionar participante</option>
                  {athletes.map((a) => <option key={a.id} value={a.id}>{a.fullName || a.id}</option>)}
                </select>
                <input style={inputStyle} placeholder="Operador que entrega" value={issueForm.actorName} onChange={(e) => setIssueForm((p) => ({ ...p, actorName: e.target.value }))} required />
                <textarea style={textareaStyle} placeholder="Observaciones (opcional)" value={issueForm.notes} onChange={(e) => setIssueForm((p) => ({ ...p, notes: e.target.value }))} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer" }}>
                    Confirmar entrega
                  </button>
                  <button type="button" onClick={() => { setIssueKeyId(null); setIssueForm(emptyIssueForm()); }}
                    style={{ padding: "10px 16px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          )}

          {/* Devolución */}
          {returnKeyId && (
            <article style={{ background: "#ffffff", border: "1px solid rgba(16,185,129,0.3)", borderTop: "3px solid #10b981", borderRadius: "24px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#10b981", marginBottom: "4px" }}>Operación</p>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                Devolución de llave
              </h3>
              <form style={{ display: "flex", flexDirection: "column", gap: "10px" }} onSubmit={submitReturn}>
                <input style={inputStyle} placeholder="Operador que recibe" value={returnForm.actorName} onChange={(e) => setReturnForm((p) => ({ ...p, actorName: e.target.value }))} />
                <textarea style={textareaStyle} placeholder="Observaciones de devolución" value={returnForm.notes} onChange={(e) => setReturnForm((p) => ({ ...p, notes: e.target.value }))} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer" }}>
                    Confirmar devolución
                  </button>
                  <button type="button" onClick={() => { setReturnKeyId(null); setReturnForm(emptyReturnForm()); }}
                    style={{ padding: "10px 16px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          )}

          {/* Bitácora */}
          <article style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "4px" }}>Historial</p>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", marginBottom: "12px" }}>Bitácora de movimientos</h3>
            {!selectedKey ? (
              <p style={{ fontSize: "13px", color: "#94a3b8" }}>Selecciona una llave para ver su historial.</p>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                  Llave <span style={{ fontWeight: 700, color: "#0f172a" }}>{selectedKey.keyNumber}</span> · Hab. <span style={{ fontWeight: 700, color: "#0f172a" }}>{selectedKey.roomNumber}</span>
                </p>
                <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {loadingMovements ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8" }}>Cargando movimientos...</p>
                  ) : selectedMovements.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8" }}>Sin movimientos registrados.</p>
                  ) : (
                    selectedMovements.map((mv) => {
                      const action = mv.action || "";
                      const actionColor = action.includes("ISSUE") ? "#3b82f6" : action.includes("RETURN") ? "#10b981" : action.includes("LOST") ? "#ef4444" : "#94a3b8";
                      return (
                        <div key={mv.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: `3px solid ${actionColor}`, borderRadius: "12px", padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: actionColor }}>{mv.action}</span>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{formatDateTime(mv.happenedAt || mv.createdAt)}</span>
                          </div>
                          <p style={{ marginTop: "4px", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                            {mv.holderName || mv.actorName || "Sin responsable informado"}
                          </p>
                          {mv.notes && <p style={{ marginTop: "3px", fontSize: "11px", color: "#64748b" }}>{mv.notes}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </article>
        </div>
      </section>

      {/* Delete key confirmation modal */}
      {deleteKeyConfirm && (() => {
        const keyToDelete = enrichedKeys.find(k => k.id === deleteKeyConfirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "380px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Eliminar llave</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>
                ¿Estás seguro de eliminar la llave <b style={{ color: "#0f172a" }}>{keyToDelete?.keyNumber || ""}</b>{keyToDelete?.hotelName ? ` del hotel ${keyToDelete.hotelName}` : ""}? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button onClick={() => setDeleteKeyConfirm(null)}
                  style={{ padding: "10px 24px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={() => removeKey(deleteKeyConfirm)}
                  style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(239,68,68,0.3)" }}>
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
