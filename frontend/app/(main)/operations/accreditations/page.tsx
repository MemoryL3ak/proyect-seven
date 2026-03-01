"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import { buildCredentialHtml } from "@/lib/credential-template";

type EventItem = { id: string; name?: string | null };
type DisciplineItem = { id: string; name?: string | null };
type ProviderItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null; eventId?: string | null };
type AthleteItem = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  fullName?: string | null;
  email?: string | null;
  countryCode?: string | null;
  passportNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};
type DriverItem = {
  id: string;
  eventId?: string | null;
  providerId?: string | null;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  accessTypes?: string[] | null;
  photoUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};
type Accreditation = {
  id: string;
  eventId: string;
  athleteId?: string | null;
  driverId?: string | null;
  subjectType: "PARTICIPANT" | "DRIVER";
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CREDENTIAL_ISSUED";
  credentialCode?: string | null;
  credentialIssuedAt?: string | null;
  credentialIssuedBy?: string | null;
  validatedBy?: string | null;
  updatedAt: string;
};

const STATUS_OPTIONS = ["ALL", "ACCREDITED", "NOT_ACCREDITED", "WITH_CREDENTIAL", "WITHOUT_CREDENTIAL"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function isAccredited(status?: Accreditation["status"]) {
  return status === "APPROVED" || status === "CREDENTIAL_ISSUED";
}

function statusFilterLabel(status: StatusFilter) {
  if (status === "ALL") return "Todos los estados";
  if (status === "ACCREDITED") return "Acreditados";
  if (status === "NOT_ACCREDITED") return "No acreditados";
  if (status === "WITH_CREDENTIAL") return "Con credencial";
  return "Sin credencial";
}

function rowStatusLabel(status?: Accreditation["status"]) {
  return isAccredited(status) ? "Acreditado" : "No acreditado";
}

function rowStatusClass(status?: Accreditation["status"]) {
  return isAccredited(status) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
}

function hasCredential(acc?: Accreditation) {
  return Boolean(acc?.credentialCode);
}

function credentialLabel(acc?: Accreditation) {
  return hasCredential(acc) ? "Generada" : "Sin generar";
}

function photoFromMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return null;
  const keys = ["photoUrl", "photo_url", "avatar", "avatarUrl", "imageUrl", "image_url"];
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function initials(name?: string | null) {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "NA";
}

export default function AccreditationsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<"ALL" | "PARTICIPANT" | "DRIVER">("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const [newSubjectType, setNewSubjectType] = useState<"PARTICIPANT" | "DRIVER">("PARTICIPANT");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [andKpiDelegationId, setAndKpiDelegationId] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [newAthleteId, setNewAthleteId] = useState("");
  const [newDriverId, setNewDriverId] = useState("");

  const eventMap = useMemo(() => events.reduce<Record<string, EventItem>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [events]);
  const disciplineMap = useMemo(() => disciplines.reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.id]: item.name || item.id }), {}), [disciplines]);
  const providerMap = useMemo(() => providers.reduce<Record<string, ProviderItem>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [providers]);
  const delegationMap = useMemo(() => delegations.reduce<Record<string, DelegationItem>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [delegations]);
  const athleteMap = useMemo(() => athletes.reduce<Record<string, AthleteItem>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [athletes]);
  const driverMap = useMemo(() => drivers.reduce<Record<string, DriverItem>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [drivers]);

  const accByAthlete = useMemo(() => accreditations.filter((item) => item.subjectType === "PARTICIPANT" && item.athleteId).reduce<Record<string, Accreditation>>((acc, item) => ({ ...acc, [item.athleteId as string]: item }), {}), [accreditations]);
  const accByDriver = useMemo(() => accreditations.filter((item) => item.subjectType === "DRIVER" && item.driverId).reduce<Record<string, Accreditation>>((acc, item) => ({ ...acc, [item.driverId as string]: item }), {}), [accreditations]);

  const selectedEventName = eventMap[selectedEventId]?.name || "";
  const selectedAthlete = newAthleteId ? athleteMap[newAthleteId] : null;
  const selectedDriver = newDriverId ? driverMap[newDriverId] : null;
  const selectedPhotoUrl = newSubjectType === "PARTICIPANT" ? photoFromMetadata(selectedAthlete?.metadata) : selectedDriver?.photoUrl || photoFromMetadata(selectedDriver?.metadata);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, providerData, delegationData, athleteData, driverData, accreditationData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<DisciplineItem[]>("/disciplines"),
        apiFetch<ProviderItem[]>("/providers"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<AthleteItem[]>("/athletes"),
        apiFetch<DriverItem[]>("/drivers"),
        apiFetch<Accreditation[]>("/accreditations"),
      ]);
      setEvents(Array.isArray(eventData) ? eventData : []);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setProviders(Array.isArray(providerData) ? providerData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      setAthletes(Array.isArray(athleteData) ? athleteData : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
      setAccreditations(Array.isArray(accreditationData) ? accreditationData : []);
      if (!selectedEventId && eventData?.length) setSelectedEventId(eventData[0].id);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar acreditaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const eventAthletes = useMemo(() => athletes.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)), [athletes, selectedEventId]);
  const eventDrivers = useMemo(() => drivers.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)), [drivers, selectedEventId]);
  const eventDelegations = useMemo(() => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)), [delegations, selectedEventId]);
  const andKpiRows = useMemo(() => {
    const scopedAthletes = eventAthletes.filter((item) => (andKpiDelegationId ? item.delegationId === andKpiDelegationId : true));
    const registeredByDiscipline = new Map<string, number>();
    const accreditedByDiscipline = new Map<string, number>();

    scopedAthletes.forEach((item) => {
      const disciplineKey = item.disciplineId || "SIN_DISCIPLINA";
      registeredByDiscipline.set(disciplineKey, (registeredByDiscipline.get(disciplineKey) ?? 0) + 1);
      const acc = accByAthlete[item.id];
      if (isAccredited(acc?.status)) {
        accreditedByDiscipline.set(disciplineKey, (accreditedByDiscipline.get(disciplineKey) ?? 0) + 1);
      }
    });

    const disciplineIds = new Set<string>([
      ...Array.from(registeredByDiscipline.keys()),
      ...Array.from(accreditedByDiscipline.keys()),
    ]);

    return Array.from(disciplineIds)
      .map((disciplineId) => {
        const registered = registeredByDiscipline.get(disciplineId) ?? 0;
        const accredited = accreditedByDiscipline.get(disciplineId) ?? 0;
        const pct = registered > 0 ? Math.round((accredited / registered) * 100) : 0;
        return {
          disciplineId,
          disciplineName: disciplineId === "SIN_DISCIPLINA" ? "Sin disciplina" : (disciplineMap[disciplineId] || disciplineId),
          registered,
          accredited,
          variance: accredited - registered,
          pct,
        };
      })
      .sort((a, b) => a.disciplineName.localeCompare(b.disciplineName));
  }, [eventAthletes, andKpiDelegationId, accByAthlete, disciplineMap]);
  const andKpiTotals = useMemo(() => {
    const registered = andKpiRows.reduce((sum, row) => sum + row.registered, 0);
    const accredited = andKpiRows.reduce((sum, row) => sum + row.accredited, 0);
    const pct = registered > 0 ? Math.round((accredited / registered) * 100) : 0;
    return { registered, accredited, pct, variance: accredited - registered };
  }, [andKpiRows]);
  const kpiPool = useMemo(() => {
    const includeParticipants = subjectFilter === "ALL" || subjectFilter === "PARTICIPANT";
    const includeDrivers = subjectFilter === "ALL" || subjectFilter === "DRIVER";
    const pool: Array<{ accredited: boolean; hasCredential: boolean }> = [];
    if (includeParticipants) {
      eventAthletes.forEach((item) => {
        const acc = accByAthlete[item.id];
        pool.push({ accredited: isAccredited(acc?.status), hasCredential: hasCredential(acc) });
      });
    }
    if (includeDrivers) {
      eventDrivers.forEach((item) => {
        const acc = accByDriver[item.id];
        pool.push({ accredited: isAccredited(acc?.status), hasCredential: hasCredential(acc) });
      });
    }
    return pool;
  }, [eventAthletes, eventDrivers, subjectFilter, accByAthlete, accByDriver]);

  const overview = useMemo(() => {
    const total = kpiPool.length;
    const accredited = kpiPool.filter((i) => i.accredited).length;
    const notAccredited = total - accredited;
    const withCredential = kpiPool.filter((i) => i.hasCredential).length;
    const accreditedWithoutCredential = kpiPool.filter((i) => i.accredited && !i.hasCredential).length;
    return { total, accredited, notAccredited, withCredential, accreditedWithoutCredential };
  }, [kpiPool]);

  const selectableAthletes = useMemo(() => {
    let source = eventAthletes.filter((item) => (selectedDelegationId ? item.delegationId === selectedDelegationId : true));
    if (subjectSearch.trim()) {
      const q = subjectSearch.trim().toLowerCase();
      source = source.filter((item) => (item.fullName ?? "").toLowerCase().includes(q) || (item.passportNumber ?? "").toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
    }
    return source.sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
  }, [eventAthletes, selectedDelegationId, subjectSearch]);

  const selectableDrivers = useMemo(() => {
    let source = [...eventDrivers];
    if (subjectSearch.trim()) {
      const q = subjectSearch.trim().toLowerCase();
      source = source.filter((item) => (item.fullName ?? "").toLowerCase().includes(q) || (item.rut ?? "").toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
    }
    return source.sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
  }, [eventDrivers, subjectSearch]);

  const participantRows = useMemo(() => {
    let rows = eventAthletes.filter((item) => (selectedDelegationId ? item.delegationId === selectedDelegationId : true));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((item) => {
        const acc = accByAthlete[item.id];
        return (item.fullName ?? "").toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || (acc?.credentialCode ?? "").toLowerCase().includes(q);
      });
    }
    return rows.filter((item) => {
      const acc = accByAthlete[item.id];
      const accredited = isAccredited(acc?.status);
      const hasCredentialFlag = hasCredential(acc);
      if (statusFilter === "ACCREDITED") return accredited;
      if (statusFilter === "NOT_ACCREDITED") return !accredited;
      if (statusFilter === "WITH_CREDENTIAL") return hasCredentialFlag;
      if (statusFilter === "WITHOUT_CREDENTIAL") return !hasCredentialFlag;
      return true;
    });
  }, [eventAthletes, selectedDelegationId, query, accByAthlete, statusFilter]);

  const driverRows = useMemo(() => {
    let rows = [...eventDrivers];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((item) => {
        const acc = accByDriver[item.id];
        return (item.fullName ?? "").toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || (item.rut ?? "").toLowerCase().includes(q) || (acc?.credentialCode ?? "").toLowerCase().includes(q);
      });
    }
    return rows.filter((item) => {
      const acc = accByDriver[item.id];
      const accredited = isAccredited(acc?.status);
      const hasCredentialFlag = hasCredential(acc);
      if (statusFilter === "ACCREDITED") return accredited;
      if (statusFilter === "NOT_ACCREDITED") return !accredited;
      if (statusFilter === "WITH_CREDENTIAL") return hasCredentialFlag;
      if (statusFilter === "WITHOUT_CREDENTIAL") return !hasCredentialFlag;
      return true;
    });
  }, [eventDrivers, query, accByDriver, statusFilter]);

  const ensureAccreditation = async (subjectType: "PARTICIPANT" | "DRIVER", subjectId: string) => {
    const existing = accreditations.find((item) => {
      if (item.eventId !== selectedEventId || item.subjectType !== subjectType) return false;
      return subjectType === "PARTICIPANT" ? item.athleteId === subjectId : item.driverId === subjectId;
    });
    if (existing) return existing;

    const payload = subjectType === "PARTICIPANT" ? { eventId: selectedEventId, subjectType: "PARTICIPANT", athleteId: subjectId } : { eventId: selectedEventId, subjectType: "DRIVER", driverId: subjectId };
    return apiFetch<Accreditation>("/accreditations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  };

  const accreditSubject = async (subjectType: "PARTICIPANT" | "DRIVER", subjectId: string) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!selectedEventId) throw new Error("Selecciona un evento para acreditar.");
      const acc = await ensureAccreditation(subjectType, subjectId);
      await apiFetch(`/accreditations/${acc.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ validatedBy: "Operador" }) });
      setMessage("Sujeto acreditado correctamente.");
      setNewAthleteId("");
      setNewDriverId("");
      setSubjectSearch("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acreditar.");
    } finally {
      setSaving(false);
    }
  };

  const createAccreditation = async (e: FormEvent) => {
    e.preventDefault();
    if (newSubjectType === "PARTICIPANT") {
      if (!newAthleteId) return setError("Debes seleccionar un participante.");
      return accreditSubject("PARTICIPANT", newAthleteId);
    }
    if (!newDriverId) return setError("Debes seleccionar un conductor.");
    return accreditSubject("DRIVER", newDriverId);
  };

  const setNotAccredited = async (acc: Accreditation) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/accreditations/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING", credentialCode: null, credentialIssuedAt: null, credentialIssuedBy: null, validatedBy: null }),
      });
      setMessage("Acreditacion modificada: sujeto en estado no acreditado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo modificar acreditacion.");
    } finally {
      setSaving(false);
    }
  };

  const generateCredential = async (subjectType: "PARTICIPANT" | "DRIVER", subjectId: string) => {
    setError(null);
    setMessage(null);
    const acc = subjectType === "PARTICIPANT" ? accByAthlete[subjectId] : accByDriver[subjectId];
    if (!acc || !isAccredited(acc.status)) return setError("Solo puedes generar credencial para sujetos acreditados.");

    try {
      const code = acc.credentialCode || `ACC-${acc.id.slice(0, 8).toUpperCase()}`;
      if (!acc.credentialCode) {
        await apiFetch(`/accreditations/${acc.id}/issue-credential`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentialCode: code, credentialIssuedBy: "Operador" }),
        });
      }

      const athlete = subjectType === "PARTICIPANT" ? athleteMap[subjectId] : null;
      const driver = subjectType === "DRIVER" ? driverMap[subjectId] : null;
      const fullName = athlete?.fullName || driver?.fullName || "Sin nombre";
      const photoUrl = subjectType === "PARTICIPANT" ? photoFromMetadata(athlete?.metadata) : driver?.photoUrl || photoFromMetadata(driver?.metadata);
      const countryTag = subjectType === "PARTICIPANT" ? (athlete?.countryCode || (athlete?.delegationId ? delegationMap[athlete.delegationId]?.countryCode : "") || "LOC") : "LOC";
      const accessTypes = subjectType === "DRIVER" ? (driver?.accessTypes ?? []) : [];
      const delegationLabel =
        subjectType === "PARTICIPANT"
          ? (athlete?.delegationId ? delegationMap[athlete.delegationId]?.countryCode || athlete.delegationId : "Sin delegacion")
          : "No aplica";
      const disciplineLabel =
        subjectType === "PARTICIPANT"
          ? (athlete?.disciplineId ? disciplineMap[athlete.disciplineId] || athlete.disciplineId : "Sin disciplina")
          : "No aplica";
      const providerLabel =
        subjectType === "DRIVER"
          ? (driver?.providerId ? providerMap[driver.providerId]?.name || driver.providerId : "No asignado")
          : "No aplica";
      const scanUrl = new URL("/scan/accreditation", window.location.origin);
      scanUrl.searchParams.set("name", fullName);
      scanUrl.searchParams.set("delegation", delegationLabel);
      scanUrl.searchParams.set("discipline", disciplineLabel);
      scanUrl.searchParams.set("subjectType", subjectType);
      scanUrl.searchParams.set("event", eventMap[acc.eventId]?.name || "Evento");
      const qrDataUrl = await QRCode.toDataURL(scanUrl.toString(), {
        width: 240,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      const html = buildCredentialHtml({
        eventName: eventMap[acc.eventId]?.name || "Evento",
        fullName,
        roleLabel: subjectType === "PARTICIPANT" ? "Participante" : "Conductor",
        credentialCode: code,
        statusLabel: "Acreditado",
        issuedAtLabel: new Date().toLocaleString("es-CL"),
        issuerLabel: "Operador",
        subjectId,
        providerLabel,
        countryTag,
        accessTypes,
        photoUrl,
        organization: "Seven - Control de Acreditaciones",
        qrDataUrl,
      });

      const popup = window.open("about:blank", "_blank");
      if (!popup) {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `credencial-${code}.html`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Popup bloqueado: se descargo el HTML de la credencial.");
      } else {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar credencial.");
    }
  };
  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border border-slate-300 p-6 text-white shadow-xl"
        style={{ background: "linear-gradient(110deg, #0f172a 0%, #0f766e 58%, #0ea5a0 100%)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/85">Control de acceso</p>
            <h1 className="mt-1 text-3xl font-semibold">Flujo de acreditacion {selectedEventName ? `- ${selectedEventName}` : ""}</h1>
            <p className="mt-1 text-sm text-white/85">Panel para validar identidad, acreditar y generar credenciales.</p>
          </div>
          <div className="rounded-2xl border border-white/35 bg-black/20 px-4 py-3 text-sm">
            Ultima actualizacion: {lastUpdated ? lastUpdated.toLocaleTimeString("es-CL") : "-"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total registrados</p><p className="text-2xl font-semibold text-slate-900">{overview.total}</p></div>
        <div className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Acreditados</p><p className="text-2xl font-semibold text-emerald-700">{overview.accredited}</p></div>
        <div className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">No acreditados</p><p className="text-2xl font-semibold text-slate-700">{overview.notAccredited}</p></div>
        <div className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Con credencial</p><p className="text-2xl font-semibold text-cyan-700">{overview.withCredential}</p></div>
        <div className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Acreditados sin credencial</p><p className="text-2xl font-semibold text-amber-700">{overview.accreditedWithoutCredential}</p></div>
      </section>

      <section className="surface rounded-3xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">AND / Acreditacion</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Cumplimiento de acreditacion sobre registro AND</h2>
            <p className="mt-1 text-sm text-slate-500">Compara participantes registrados en AND vs participantes acreditados por disciplina.</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar KPI"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_2fr_1fr_1fr]">
          <select className="input" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Selecciona evento</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
          </select>
          <select className="input" value={andKpiDelegationId} onChange={(e) => setAndKpiDelegationId(e.target.value)}>
            <option value="">Todas las delegaciones</option>
            {eventDelegations.map((item) => <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>)}
          </select>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Registrado AND</div>
            <div className="text-lg font-semibold text-slate-900">{andKpiTotals.registered}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Acreditado</div>
            <div className="text-lg font-semibold text-slate-900">{andKpiTotals.accredited}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cumplimiento total</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-semibold text-emerald-700">{andKpiTotals.pct}%</p>
              <p className="pb-1 text-sm text-slate-500">AND registrado vs acreditado</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(andKpiTotals.pct, 100)}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Brecha neta</p>
            <p className={`mt-2 text-3xl font-semibold ${andKpiTotals.variance < 0 ? "text-rose-700" : "text-emerald-700"}`}>{andKpiTotals.variance}</p>
            <p className="mt-1 text-sm text-slate-500">Acreditados respecto al registro AND</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vista activa</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{andKpiDelegationId ? (delegationMap[andKpiDelegationId]?.countryCode || andKpiDelegationId) : "Consolidado del evento"}</p>
            <p className="mt-1 text-sm text-slate-500">{andKpiDelegationId ? "Filtro por delegacion aplicado" : "Todas las delegaciones del evento"}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Registrado AND</th>
                <th>Acreditado</th>
                <th>Brecha</th>
                <th>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {andKpiRows.map((row) => (
                <tr key={row.disciplineId}>
                  <td>{row.disciplineName}</td>
                  <td>{row.registered}</td>
                  <td>{row.accredited}</td>
                  <td className={row.variance < 0 ? "text-rose-600" : "text-emerald-700"}>{row.variance}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-36 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {andKpiRows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay participantes AND para mostrar cumplimiento en este filtro.</p> : null}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="grid gap-3 lg:grid-cols-12">
          <select className="input lg:col-span-3" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Todos los eventos</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
          </select>
          <select className="input lg:col-span-2" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as "ALL" | "PARTICIPANT" | "DRIVER")}>
            <option value="ALL">Todos los sujetos</option>
            <option value="PARTICIPANT">Participante</option>
            <option value="DRIVER">Conductor</option>
          </select>
          <select className="input lg:col-span-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusFilterLabel(status)}</option>)}
          </select>
          <input className="input lg:col-span-3" placeholder="Buscar por nombre, ID o codigo credencial" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn btn-ghost lg:col-span-2" onClick={loadData} disabled={loading}>{loading ? "Actualizando..." : "Refrescar"}</button>
        </div>
        {(error || message) ? (
          <div className="mt-3 space-y-1">
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <form onSubmit={createAccreditation} className="surface rounded-2xl p-5 xl:order-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Nueva acreditacion</h3>
          <div className="mt-3 space-y-3">
            <select className="input" value={newSubjectType} onChange={(e) => {
              const type = e.target.value as "PARTICIPANT" | "DRIVER";
              setNewSubjectType(type);
              setSelectedDelegationId("");
              setSubjectSearch("");
              setNewAthleteId("");
              setNewDriverId("");
            }}>
              <option value="PARTICIPANT">Participante</option>
              <option value="DRIVER">Conductor</option>
            </select>

            {newSubjectType === "PARTICIPANT" ? (
              <select className="input" value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
                <option value="">Todas las delegaciones</option>
                {eventDelegations.map((item) => <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>)}
              </select>
            ) : null}

            <input className="input" placeholder={newSubjectType === "PARTICIPANT" ? "Buscar participante por nombre, pasaporte o ID" : "Buscar conductor por nombre, RUT o ID"} value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)} />

            {newSubjectType === "PARTICIPANT" ? (
              <select className="input" value={newAthleteId} onChange={(e) => setNewAthleteId(e.target.value)} required>
                <option value="">Selecciona participante</option>
                {selectableAthletes.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.id} - {(item.delegationId && delegationMap[item.delegationId]?.countryCode) || "SIN_DELEGACION"}</option>)}
              </select>
            ) : (
              <select className="input" value={newDriverId} onChange={(e) => setNewDriverId(e.target.value)} required>
                <option value="">Selecciona conductor</option>
                {selectableDrivers.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.id} - {item.rut || "SIN_RUT"}</option>)}
              </select>
            )}

            {(selectedAthlete || selectedDriver) ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ficha de validacion</p>
                <div className="mt-2 flex gap-3">
                  {selectedPhotoUrl ? <img src={selectedPhotoUrl} alt="Foto sujeto" className="h-24 w-20 rounded-lg border border-slate-200 object-cover" /> : <div className="grid h-24 w-20 place-items-center rounded-lg border border-slate-200 bg-slate-200 text-sm font-bold text-slate-700">{initials(selectedAthlete?.fullName || selectedDriver?.fullName)}</div>}
                  <div className="grid flex-1 gap-1 text-xs text-slate-700">
                    {newSubjectType === "PARTICIPANT" && selectedAthlete ? <><p><span className="font-semibold">Nombre:</span> {selectedAthlete.fullName || "-"}</p><p><span className="font-semibold">Email:</span> {selectedAthlete.email || "-"}</p><p><span className="font-semibold">Pais:</span> {selectedAthlete.countryCode || "-"}</p><p><span className="font-semibold">Pasaporte:</span> {selectedAthlete.passportNumber || "-"}</p><p><span className="font-semibold">Delegacion:</span> {selectedAthlete.delegationId ? delegationMap[selectedAthlete.delegationId]?.countryCode || selectedAthlete.delegationId : "-"}</p></> : null}
                    {newSubjectType === "DRIVER" && selectedDriver ? <><p><span className="font-semibold">Nombre:</span> {selectedDriver.fullName || "-"}</p><p><span className="font-semibold">RUT:</span> {selectedDriver.rut || "-"}</p><p><span className="font-semibold">Email:</span> {selectedDriver.email || "-"}</p><p><span className="font-semibold">Telefono:</span> {selectedDriver.phone || "-"}</p><p><span className="font-semibold">Licencia:</span> {selectedDriver.licenseNumber || "-"}</p><p><span className="font-semibold">Proveedor:</span> {selectedDriver.providerId ? providerMap[selectedDriver.providerId]?.name || selectedDriver.providerId : "-"}</p></> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-1"><button className="btn btn-primary px-10" type="submit" disabled={saving || !selectedEventId}>{saving ? "Guardando..." : "Acreditar"}</button></div>
          </div>
        </form>
        <div className="surface rounded-2xl p-5 xl:order-2">
          {newSubjectType === "PARTICIPANT" ? (
            <>
              <h4 className="text-xs uppercase tracking-[0.16em] text-slate-500">Participantes registrados</h4>
              <div className="overflow-x-auto mt-2">
                <table className="table">
                  <thead><tr><th>Nombre</th><th>Delegacion</th><th>Pais</th><th>Pasaporte</th><th>Estado</th><th>Credencial</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {participantRows.map((item) => {
                      const acc = accByAthlete[item.id];
                      const accredited = isAccredited(acc?.status);
                      return (
                        <tr key={item.id}>
                          <td><p className="font-medium text-slate-900">{item.fullName || item.id}</p><p className="text-xs text-slate-500">{item.id}</p></td>
                          <td>{item.delegationId ? delegationMap[item.delegationId]?.countryCode || item.delegationId : "-"}</td>
                          <td>{item.countryCode || "-"}</td>
                          <td>{item.passportNumber || "-"}</td>
                          <td><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${rowStatusClass(acc?.status)}`}>{rowStatusLabel(acc?.status)}</span></td>
                          <td>{credentialLabel(acc)}</td>
                          <td><div className="flex flex-wrap gap-2"><button className="btn btn-ghost" type="button" disabled={!acc || !accredited || saving} onClick={() => acc && setNotAccredited(acc)}>Modificar acreditacion</button><button className="btn btn-primary" type="button" disabled={!accredited} onClick={() => generateCredential("PARTICIPANT", item.id)}>Generar credencial</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {participantRows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay participantes para ese filtro.</p> : null}
            </>
          ) : (
            <>
              <h4 className="text-xs uppercase tracking-[0.16em] text-slate-500">Conductores registrados</h4>
              <div className="overflow-x-auto mt-2">
                <table className="table">
                  <thead><tr><th>Nombre</th><th>RUT</th><th>Proveedor</th><th>Telefono</th><th>Estado</th><th>Credencial</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {driverRows.map((item) => {
                      const acc = accByDriver[item.id];
                      const accredited = isAccredited(acc?.status);
                      return (
                        <tr key={item.id}>
                          <td><p className="font-medium text-slate-900">{item.fullName || item.id}</p><p className="text-xs text-slate-500">{item.id}</p></td>
                          <td>{item.rut || "-"}</td>
                          <td>{item.providerId ? providerMap[item.providerId]?.name || item.providerId : "-"}</td>
                          <td>{item.phone || "-"}</td>
                          <td><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${rowStatusClass(acc?.status)}`}>{rowStatusLabel(acc?.status)}</span></td>
                          <td>{credentialLabel(acc)}</td>
                          <td><div className="flex flex-wrap gap-2"><button className="btn btn-ghost" type="button" disabled={!acc || !accredited || saving} onClick={() => acc && setNotAccredited(acc)}>Modificar acreditacion</button><button className="btn btn-primary" type="button" disabled={!accredited} onClick={() => generateCredential("DRIVER", item.id)}>Generar credencial</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {driverRows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay conductores para ese filtro.</p> : null}
            </>
          )}
        </div>
      </section>

    </div>
  );
}
