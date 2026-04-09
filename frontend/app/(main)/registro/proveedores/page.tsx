"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import CountrySelect from "@/components/CountrySelect";

// ── Type/subtype catalogue ──────────────────────────────────────────────────
type TypeEntry = { label: string; subtypes: string[]; color: string; bg: string };

const PROVIDER_TYPES: Record<string, TypeEntry> = {
  TRANSPORTE:       { label: "Transporte",           subtypes: [],                                                                    color: "#1FCDFF", bg: "rgba(31,205,255,0.08)" },
  LOGISTICA:        { label: "Logística",             subtypes: [],                                                                    color: "#21D0B3", bg: "rgba(33,208,179,0.08)" },
  HOTELERIA:        { label: "Hotelería",             subtypes: [],                                                                    color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  ALIMENTACION:     { label: "Alimentación",          subtypes: [],                                                                    color: "#fb923c", bg: "rgba(251,146,60,0.08)"  },
  PRODUCTORA:       { label: "Productora",            subtypes: [],                                                                    color: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  VOLUNTARIOS:      { label: "Voluntarios",           subtypes: [],                                                                    color: "#34d399", bg: "rgba(52,211,153,0.08)"  },
  SEGURIDAD:        { label: "Seguridad",             subtypes: [],                                                                    color: "#f87171", bg: "rgba(248,113,113,0.08)" },
  STAFF:            { label: "Staff",                 subtypes: ["Recursos Humanos", "Dpto de Compras", "Sport Manager", "Comité Organizador"], color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
  INFRAESTRUCTURA:  { label: "Infraestructura",       subtypes: ["Recintos"],                                                          color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
  CONTROL_TECNICO:  { label: "Control Técnico",       subtypes: ["Jueces", "Mesa de Control"],                                         color: "#e879f9", bg: "rgba(232,121,249,0.08)" },
  SALUD:            { label: "Salud",                 subtypes: ["Antidopaje"],                                                        color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
  BROADCAST:        { label: "Broadcast y Medios",    subtypes: [],                                                                    color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
  MERCHANDISING:    { label: "Merchandising",         subtypes: ["Marketing", "Equipamiento Deportivo"],                               color: "#ec4899", bg: "rgba(236,72,153,0.08)"  },
  TECNOLOGIA:       { label: "Tecnología",            subtypes: [],                                                                    color: "#38bdf8", bg: "rgba(56,189,248,0.08)"  },
  RRHH:             { label: "Recursos Humanos",      subtypes: [],                                                                    color: "#a3e635", bg: "rgba(163,230,53,0.08)"  },
  ASEO:             { label: "Aseo y Mantención",     subtypes: [],                                                                    color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
  ACREDITACION:     { label: "Acreditación",          subtypes: [],                                                                    color: "#2dd4bf", bg: "rgba(45,212,191,0.08)"  },
};

// ── Transport documents ─────────────────────────────────────────────────────
const TRANSPORT_DOCS_PERSON = [
  { key: "doc_carnet",        label: "Fotocopia Carnet" },
  { key: "doc_antecedentes",  label: "Antecedentes" },
  { key: "doc_inhabilidades", label: "Cert. Inhabilidades menores" },
  { key: "doc_licencia",      label: "Licencia de conducir" },
  { key: "doc_foto_carnet",   label: "Foto tipo Carnet" },
];

const TRANSPORT_DOCS_VEHICLE = [
  { key: "doc_permiso_circ",     label: "Permiso de circulación" },
  { key: "doc_soap",             label: "SOAP" },
  { key: "doc_decreto_80",       label: "Decreto 80" },
  { key: "doc_gases",            label: "Gases" },
  { key: "doc_padron",           label: "Padrón" },
  { key: "doc_seguro_adicional", label: "Seguros adicionales" },
  { key: "doc_foto_vehiculo",    label: "Foto del vehículo" },
];

const ALL_TRANSPORT_DOCS = [...TRANSPORT_DOCS_PERSON, ...TRANSPORT_DOCS_VEHICLE];

const TRIP_TYPES = ["ARRIVAL", "DEPARTURE", "BOTH"];
const TRIP_TYPE_LABELS: Record<string, string> = {
  ARRIVAL: "Llegada",
  DEPARTURE: "Salida",
  BOTH: "Llegada y Salida",
};

// ── Types ───────────────────────────────────────────────────────────────────
type Provider = {
  id: string;
  name: string;
  type?: string | null;
  subtype?: string | null;
  email?: string | null;
  rut?: string | null;
  bidAmount?: number | null;
  bidTripCount?: number | null;
  parentProviderId?: string | null;
  invoiceType?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  contactName?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProviderRate = {
  id?: string;
  providerId: string;
  fleetType: string;
  passengerRange?: string | null;
  tripType: string;
  clientPrice: number;
  providerPrice: number;
};

const FLEET_TYPES = [
  { value: "AUTO", label: "Auto", passengers: "" },
  { value: "SUV", label: "SUV", passengers: "" },
  { value: "VAN_10", label: "Van", passengers: "10" },
  { value: "VAN_15", label: "Van", passengers: "15 a 17" },
  { value: "VAN_19", label: "Van", passengers: "19" },
  { value: "MINIBUS", label: "Minibus", passengers: "20 a 33" },
  { value: "BUS", label: "Bus", passengers: "40 a 64" },
] as const;

const SERVICE_TYPES = [
  { value: "TRANSFER_IN_OUT", label: "Transfer In Out" },
  { value: "DISPOSICION_12H", label: "Disposición 12 Horas" },
  { value: "VIAJE_IDA", label: "Viaje de ida" },
  { value: "VIAJE_REGRESO", label: "Viaje de regreso" },
  { value: "VIAJE_IDA_REGRESO", label: "Viaje de ida y regreso" },
] as const;

type Participant = {
  id: string;
  providerId: string;
  fullName: string;
  rut?: string | null;
  countryCode?: string | null;
  passportNumber?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
  userType?: string | null;
  visaRequired?: boolean | null;
  tripType?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  origin?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  observations?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function countUploadedDocs(metadata?: Record<string, unknown> | null): number {
  if (!metadata) return 0;
  return ALL_TRANSPORT_DOCS.filter(
    d => typeof metadata[d.key] === "string" && (metadata[d.key] as string).length > 0
  ).length;
}

// ── DocRow ───────────────────────────────────────────────────────────────────
function DocRow({
  label, docKey, file, url, onFile, disabled,
}: {
  label: string;
  docKey: string;
  file: File | null;
  url?: string;
  onFile: (key: string, file: File | null) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hasUploaded = typeof url === "string" && url.length > 0;
  const hasNew = file !== null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ flex: 1, fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "11px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: hasNew ? "#21D0B3" : hasUploaded ? "#10b981" : "var(--text-faint)" }}>
        {hasNew ? file.name : hasUploaded ? "✓ Cargado" : "—"}
      </span>
      {hasUploaded && url && (
        <a href={url} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--elevated)", cursor: "pointer", flexShrink: 0 }}
          title="Ver documento">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </a>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        disabled={disabled}
        onChange={e => { onFile(docKey, e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: "1px solid var(--border)",
          background: "var(--elevated)", color: "var(--text-muted)", cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap", flexShrink: 0 }}
      >
        {hasUploaded || hasNew ? "Cambiar" : "Cargar"}
      </button>
      {hasNew && (
        <button type="button" disabled={disabled} onClick={() => onFile(docKey, null)}
          style={{ fontSize: "13px", color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "2px", flexShrink: 0, lineHeight: 1 }}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── Empty forms ──────────────────────────────────────────────────────────────
const EMPTY_PROVIDER_FORM = { name: "", type: "", subtype: "", email: "", rut: "", phone: "", address: "", city: "", contactName: "", invoiceType: "", bidAmount: "", bidTripCount: "" };
const EMPTY_PARTICIPANT_FORM = {
  providerId: "",
  fullName: "",
  rut: "",
  countryCode: "",
  passportNumber: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  userType: "",
  visaRequired: "",
  tripType: "",
  flightNumber: "",
  airline: "",
  origin: "",
  arrivalTime: "",
  departureTime: "",
  observations: "",
  isDriver: false,
  vehicleMarca: "",
  vehicleModelo: "",
  vehicleAno: "",
  vehiclePatente: "",
  vehicleTipo: "",
  photoDataUrl: "",
};

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const [activeTab, setActiveTab] = useState<"proveedores" | "participantes">("proveedores");
  const [providerFilter, setProviderFilter] = useState<string>(""); // provider id filter for participantes tab

  // ── Providers state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerSearch, setProviderSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [providerModal, setProviderModal] = useState<null | { editing?: Provider | null; parentId?: string }>(null);
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER_FORM);
  const [providerDocFiles, setProviderDocFiles] = useState<Record<string, File | null>>({});
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerRates, setProviderRates] = useState<ProviderRate[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);

  // ── Participants state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [bulkPhotoResult, setBulkPhotoResult] = useState<{ matched: number; notFound: number; names: string[] } | null>(null);
  const [participantModal, setParticipantModal] = useState<null | { editing?: Participant }>(null);
  const [participantForm, setParticipantForm] = useState(EMPTY_PARTICIPANT_FORM);
  const [participantDocFiles, setParticipantDocFiles] = useState<Record<string, File | null>>({});
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [lookingUpPlate, setLookingUpPlate] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);

  const lookupPlate = async (plate: string) => {
    const p = plate.trim().toUpperCase().replace(/\s+/g, "");
    if (p.length < 5) return;
    setLookingUpPlate(true);
    setPlateError(null);
    try {
      const data = await apiFetch<{ brand: string | null; model: string | null; year: number | null }>(
        `/transports/lookup-plate/${encodeURIComponent(p)}`
      );
      setParticipantForm(f => ({
        ...f,
        vehicleMarca: data.brand ?? f.vehicleMarca,
        vehicleModelo: data.model ?? f.vehicleModelo,
        vehicleAno: data.year ? String(data.year) : f.vehicleAno,
      }));
    } catch {
      setPlateError("No se encontró información para esta patente");
    } finally {
      setLookingUpPlate(false);
    }
  };

  // ── Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // ── Loaders ─────────────────────────────────────────────────────────────
  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const data = await apiFetch<Provider[]>("/providers");
      setProviders(data);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const url = providerFilter
        ? `/provider-participants?providerId=${providerFilter}`
        : "/provider-participants";
      const data = await apiFetch<Participant[]>(url);
      setParticipants(data);
    } finally {
      setLoadingParticipants(false);
    }
  };

  useEffect(() => { loadProviders(); }, []);
  useEffect(() => {
    if (activeTab === "participantes") loadParticipants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, providerFilter]);

  // ── Provider logic ───────────────────────────────────────────────────────
  const availableSubtypes = useMemo(() => {
    if (!providerForm.type) return [];
    return PROVIDER_TYPES[providerForm.type]?.subtypes ?? [];
  }, [providerForm.type]);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return providers.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) &&
          !(p.email ?? "").toLowerCase().includes(q) &&
          !(p.rut ?? "").toLowerCase().includes(q)) return false;
      if (filterType && p.type !== filterType) return false;
      return true;
    });
  }, [providers, providerSearch, filterType]);

  const groupedProviders = useMemo(() => {
    const map: Record<string, Provider[]> = {};
    filteredProviders.forEach(p => {
      const key = p.type ?? "__none__";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [filteredProviders]);

  const groupKeys = Object.keys(groupedProviders).sort((a, b) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return (PROVIDER_TYPES[a]?.label ?? a).localeCompare(PROVIDER_TYPES[b]?.label ?? b);
  });

  const openAddProvider = () => {
    setProviderForm(EMPTY_PROVIDER_FORM);
    setProviderDocFiles({});
    setProviderError(null);
    setProviderRates([]);
    setProviderModal({});
  };

  const openEditProvider = (p: Provider) => {
    setProviderForm({ name: p.name, type: p.type ?? "", subtype: p.subtype ?? "", email: p.email ?? "", rut: p.rut ?? "", phone: p.phone ?? "", address: p.address ?? "", city: p.city ?? "", contactName: p.contactName ?? "", invoiceType: p.invoiceType ?? "", bidAmount: p.bidAmount != null ? String(p.bidAmount) : "", bidTripCount: p.bidTripCount != null ? String(p.bidTripCount) : "" });
    if (p.type === "TRANSPORTE") {
      apiFetch<ProviderRate[]>(`/providers/${p.id}/rates`).then(setProviderRates).catch(() => setProviderRates([]));
    } else {
      setProviderRates([]);
    }
    setProviderDocFiles({});
    setProviderError(null);
    setProviderModal({ editing: p });
  };

  const saveProvider = async () => {
    if (!providerForm.name.trim()) { setProviderError("El nombre es requerido."); return; }
    setSavingProvider(true);
    setProviderError(null);
    try {
      const parentId = providerModal?.parentId ?? null;
      const parentProv = parentId ? providers.find(pr => pr.id === parentId) : null;
      const body = {
        name: providerForm.name.trim(),
        type: providerForm.type || parentProv?.type || null,
        subtype: providerForm.subtype || null,
        email: providerForm.email || null,
        rut: providerForm.rut || null,
        phone: providerForm.phone || null,
        address: providerForm.address || null,
        city: providerForm.city || null,
        contactName: providerForm.contactName || null,
        invoiceType: providerForm.invoiceType || null,
        bidAmount: providerForm.bidAmount ? Number(providerForm.bidAmount) : null,
        bidTripCount: providerForm.bidTripCount ? Number(providerForm.bidTripCount) : null,
        ...(parentId ? { parentProviderId: parentId } : {}),
      };

      let providerId: string;
      if (providerModal?.editing) {
        await apiFetch(`/providers/${providerModal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        providerId = providerModal.editing.id;
      } else {
        const created = await apiFetch<Provider>("/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        providerId = created.id;
      }

      // Save rates for transport providers
      if (providerForm.type === "TRANSPORTE" && providerRates.length > 0) {
        await apiFetch(`/providers/${providerId}/rates/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(providerRates.map((r) => ({
            providerId,
            fleetType: r.fleetType,
            passengerRange: r.passengerRange || null,
            tripType: r.tripType,
            clientPrice: r.clientPrice,
            providerPrice: r.providerPrice,
          }))),
        });
      }

      const pending = Object.entries(providerDocFiles).filter(([, f]) => f !== null);
      for (const [key, file] of pending) {
        const dataUrl = await fileToDataUrl(file!);
        await apiFetch(`/providers/${providerId}/document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, dataUrl }),
        });
      }

      setProviderModal(null);
      await loadProviders();
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingProvider(false);
    }
  };

  const removeProvider = (p: Provider) => {
    setConfirmDialog({
      message: `¿Eliminar proveedor "${p.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiFetch(`/providers/${p.id}`, { method: "DELETE" });
          await loadProviders();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Error al eliminar");
        }
      },
    });
  };

  const handleProviderClick = (p: Provider) => {
    setProviderFilter(p.id);
    setActiveTab("participantes");
  };

  // ── Participant logic ────────────────────────────────────────────────────
  const selectedProviderForParticipant = useMemo(() => {
    return providers.find(p => p.id === participantForm.providerId) ?? null;
  }, [providers, participantForm.providerId]);

  const isTransporteParticipant = selectedProviderForParticipant?.type === "TRANSPORTE";

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    return participants.filter(p => {
      if (q && !p.fullName.toLowerCase().includes(q) &&
          !(p.rut ?? "").toLowerCase().includes(q) &&
          !(p.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [participants, participantSearch]);

  const openAddParticipant = () => {
    setParticipantForm({ ...EMPTY_PARTICIPANT_FORM, providerId: providerFilter });
    setParticipantDocFiles({});
    setParticipantError(null);
    setPlateError(null);
    setParticipantModal({});
  };

  const openEditParticipant = (p: Participant) => {
    setParticipantForm({
      providerId: p.providerId,
      fullName: p.fullName,
      rut: p.rut ?? "",
      countryCode: p.countryCode ?? "",
      passportNumber: p.passportNumber ?? "",
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split("T")[0] : "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      userType: p.userType ?? "",
      visaRequired: p.visaRequired == null ? "" : p.visaRequired ? "true" : "false",
      tripType: p.tripType ?? "",
      flightNumber: p.flightNumber ?? "",
      airline: p.airline ?? "",
      origin: p.origin ?? "",
      arrivalTime: p.arrivalTime ? p.arrivalTime.slice(0, 16) : "",
      departureTime: p.departureTime ? p.departureTime.slice(0, 16) : "",
      observations: p.observations ?? "",
      isDriver: p.metadata?.isDriver === true,
      vehicleMarca: (p.metadata?.vehicleMarca as string) ?? "",
      vehicleModelo: (p.metadata?.vehicleModelo as string) ?? "",
      vehicleAno: (p.metadata?.vehicleAno as string) ?? "",
      vehiclePatente: (p.metadata?.vehiclePatente as string) ?? "",
      vehicleTipo: (p.metadata?.vehicleTipo as string) ?? "",
      photoDataUrl: (p.metadata?.photoUrl as string) ?? "",
    });
    setParticipantDocFiles({});
    setParticipantError(null);
    setPlateError(null);
    setParticipantModal({ editing: p });
  };

  const saveParticipant = async () => {
    if (!participantForm.fullName.trim()) { setParticipantError("El nombre completo es requerido."); return; }
    if (!participantForm.providerId) { setParticipantError("Debe seleccionar un proveedor."); return; }
    setSavingParticipant(true);
    setParticipantError(null);
    try {
      const body: Record<string, unknown> = {
        providerId: participantForm.providerId,
        fullName: participantForm.fullName.trim(),
        rut: participantForm.rut || null,
        countryCode: participantForm.countryCode || null,
        passportNumber: participantForm.passportNumber || null,
        dateOfBirth: participantForm.dateOfBirth || null,
        email: participantForm.email || null,
        phone: participantForm.phone || null,
        userType: participantForm.userType || null,
        visaRequired: participantForm.visaRequired === "true" ? true : participantForm.visaRequired === "false" ? false : null,
        tripType: participantForm.tripType || null,
        flightNumber: participantForm.flightNumber || null,
        airline: participantForm.airline || null,
        origin: participantForm.origin || null,
        arrivalTime: participantForm.arrivalTime || null,
        departureTime: participantForm.departureTime || null,
        observations: participantForm.observations || null,
        metadata: isTransporteParticipant ? {
          ...(participantModal?.editing?.metadata ?? {}),
          isDriver: participantForm.isDriver,
          ...(participantForm.isDriver ? {
            vehicleMarca: participantForm.vehicleMarca || null,
            vehicleModelo: participantForm.vehicleModelo || null,
            vehicleAno: participantForm.vehicleAno || null,
            vehiclePatente: participantForm.vehiclePatente || null,
            vehicleTipo: participantForm.vehicleTipo || null,
          } : {}),
        } : undefined,
      };

      let participantId: string;
      if (participantModal?.editing) {
        await apiFetch(`/provider-participants/${participantModal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        participantId = participantModal.editing.id;
      } else {
        const created = await apiFetch<Participant>("/provider-participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        participantId = created.id;
      }

      // Upload photo if provided
      if (participantForm.photoDataUrl && participantForm.photoDataUrl.startsWith("data:")) {
        await apiFetch(`/provider-participants/${participantId}/document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "photoUrl", dataUrl: participantForm.photoDataUrl }),
        });
      }

      const pending = Object.entries(participantDocFiles).filter(([, f]) => f !== null);
      for (const [key, file] of pending) {
        const dataUrl = await fileToDataUrl(file!);
        await apiFetch(`/provider-participants/${participantId}/document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, dataUrl }),
        });
      }

      setParticipantModal(null);
      await loadParticipants();
    } catch (e) {
      setParticipantError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingParticipant(false);
    }
  };

  const removeParticipant = (p: Participant) => {
    setConfirmDialog({
      message: `¿Eliminar participante "${p.fullName}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiFetch(`/provider-participants/${p.id}`, { method: "DELETE" });
          await loadParticipants();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Error al eliminar");
        }
      },
    });
  };

  const activeFilterProvider = providers.find(p => p.id === providerFilter) ?? null;

  const isTransporteProvider = providerForm.type === "TRANSPORTE";
  const editingProviderMeta = providerModal?.editing?.metadata ?? null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!confirmDialog}
        title="Confirmar eliminación"
        message={confirmDialog?.message ?? ""}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* Header */}
      <section
        className="surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderTop: "2px solid #21D0B3", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}
      >
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>Registro</p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.1 }}>Proveedores</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            Gestión de proveedores y sus participantes
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={activeTab === "proveedores" ? openAddProvider : openAddParticipant}
        >
          {activeTab === "proveedores" ? "+ Nuevo proveedor" : "+ Nuevo participante"}
        </button>
      </section>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid var(--border)", paddingBottom: "0" }}>
        {(["proveedores", "participantes"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #21D0B3" : "2px solid transparent",
              color: activeTab === tab ? "#21D0B3" : "var(--text-muted)",
              cursor: "pointer",
              marginBottom: "-2px",
              textTransform: "capitalize",
              letterSpacing: "0.03em",
              transition: "color 0.15s",
            }}
          >
            {tab === "proveedores" ? "Proveedores" : "Participantes"}
          </button>
        ))}
      </div>

      {/* ── TAB: PROVEEDORES ─────────────────────────────────────────────── */}
      {activeTab === "proveedores" && (
        <>
          {/* Stats bar */}
          {!loadingProviders && providers.length > 0 && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div className="surface rounded-2xl px-5 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)", minWidth: "130px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(33,208,179,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#21D0B3" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{providers.length}</p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Proveedores</p>
                </div>
              </div>
              {Object.entries(
                providers.reduce((acc, p) => {
                  if (p.type) acc[p.type] = (acc[p.type] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([type, count]) => {
                  const entry = PROVIDER_TYPES[type];
                  return (
                    <div
                      key={type}
                      className="surface rounded-2xl px-5 py-3 flex items-center gap-3 cursor-pointer"
                      style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)", minWidth: "130px", border: filterType === type ? `1.5px solid ${entry?.color ?? "#21D0B3"}` : "1.5px solid transparent" }}
                      onClick={() => setFilterType(filterType === type ? "" : type)}
                    >
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: entry?.bg ?? "rgba(33,208,179,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: entry?.color ?? "#21D0B3" }}>{count}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{entry?.label ?? type}</p>
                        <p style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "1px" }}>proveedor{count !== 1 ? "es" : ""}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Filters */}
          <section className="surface rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
              <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="input"
                style={{ paddingLeft: "32px" }}
                placeholder="Buscar por nombre, email o RUT…"
                value={providerSearch}
                onChange={e => setProviderSearch(e.target.value)}
              />
            </div>
            <select className="input w-52" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">— Todos los tipos —</option>
              {Object.entries(PROVIDER_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <span style={{ fontSize: "12px", color: "var(--text-faint)", whiteSpace: "nowrap" }}>
              {filteredProviders.length} de {providers.length}
            </span>
          </section>

          {loadingProviders ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-faint)" }}>
              Cargando proveedores…
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="surface rounded-2xl p-10 text-center" style={{ color: "var(--text-faint)" }}>
              <svg style={{ margin: "0 auto 12px", opacity: 0.3 }} width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p style={{ fontSize: "14px", fontWeight: 600 }}>
                {providers.length === 0 ? "No hay proveedores registrados" : "Sin resultados"}
              </p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                {providers.length === 0 ? "Agrega un proveedor para comenzar." : "Ajusta los filtros de búsqueda."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupKeys.map(key => {
                const items = groupedProviders[key];
                const typeEntry = PROVIDER_TYPES[key];
                const typeLabel = key === "__none__" ? "Sin tipo asignado" : (typeEntry?.label ?? key);
                const typeColor = key === "__none__" ? "#94a3b8" : (typeEntry?.color ?? "#21D0B3");
                const typeBg = key === "__none__" ? "rgba(148,163,184,0.08)" : (typeEntry?.bg ?? "rgba(33,208,179,0.08)");

                return (
                  <div key={key}>
                    {/* Group header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <div style={{ height: "2px", width: "16px", background: typeColor, borderRadius: "2px", flexShrink: 0 }} />
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: typeColor }}>
                        {typeLabel}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: typeColor, opacity: 0.5 }}>· {items.length}</span>
                      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                    </div>

                    {/* Provider cards grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
                      {items.map(p => {
                        const initials = p.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

                        return (
                          <div
                            key={p.id}
                            className="surface rounded-2xl overflow-hidden"
                            style={{ boxShadow: "0 1px 6px rgba(15,23,42,0.07)", borderLeft: `3px solid ${typeColor}`, transition: "box-shadow 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(15,23,42,0.12)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 6px rgba(15,23,42,0.07)"; }}
                          >
                            <div style={{ padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                              {/* Avatar / Logo */}
                              {typeof p.metadata?.logo === "string" && (p.metadata.logo as string).startsWith("http") ? (
                                <img src={p.metadata.logo as string} alt={p.name} style={{ width: "42px", height: "42px", borderRadius: "12px", objectFit: "cover", flexShrink: 0, border: `1px solid ${typeColor}30` }} />
                              ) : (
                                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: typeBg, border: `1px solid ${typeColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <span style={{ fontSize: "14px", fontWeight: 800, color: typeColor }}>{initials}</span>
                                </div>
                              )}

                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <button
                                  onClick={() => handleProviderClick(p)}
                                  style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = typeColor; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
                                  title={`Ver participantes de ${p.name}`}
                                >
                                  {p.name}
                                </button>

                                <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                                  {p.subtype && (
                                    <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "99px", background: typeBg, color: typeColor, border: `1px solid ${typeColor}30` }}>
                                      {p.subtype}
                                    </span>
                                  )}
                                </div>

                                {(p.email || p.rut) && (
                                  <div style={{ marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                    {p.email && (
                                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        {p.email}
                                      </span>
                                    )}
                                    {p.rut && (
                                      <span style={{ fontSize: "11px", color: "var(--text-faint)", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
                                        </svg>
                                        {p.rut}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
                                <button
                                  onClick={() => openEditProvider(p)}
                                  style={{ padding: "5px", borderRadius: "7px", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", transition: "all 0.15s" }}
                                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(31,205,255,0.1)"; el.style.color = "#1FCDFF"; }}
                                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "none"; el.style.color = "var(--text-faint)"; }}
                                  title="Editar"
                                >
                                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => removeProvider(p)}
                                  style={{ padding: "5px", borderRadius: "7px", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", transition: "all 0.15s" }}
                                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(244,63,94,0.1)"; el.style.color = "#f43f5e"; }}
                                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "none"; el.style.color = "var(--text-faint)"; }}
                                  title="Eliminar"
                                >
                                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Footer: actions */}
                            <div style={{ display: "flex", borderTop: `1px solid ${typeColor}20` }}>
                              <button
                                onClick={() => handleProviderClick(p)}
                                style={{ flex: 1, padding: "8px 16px", background: typeBg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "background 0.15s" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}18`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = typeBg; }}
                              >
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={typeColor} strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span style={{ fontSize: "11px", fontWeight: 600, color: typeColor }}>Participantes</span>
                              </button>
                              {!p.parentProviderId && (
                                <button
                                  onClick={() => setProviderModal({ editing: null, parentId: p.id })}
                                  style={{ padding: "8px 14px", background: typeBg, border: "none", borderLeft: `1px solid ${typeColor}20`, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "background 0.15s" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}18`; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = typeBg; }}
                                  title="Crear subproveedor"
                                >
                                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={typeColor} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  <span style={{ fontSize: "10px", fontWeight: 600, color: typeColor }}>Sub</span>
                                </button>
                              )}
                            </div>

                            {/* Sub-providers */}
                            {(() => {
                              const subs = providers.filter(sp => sp.parentProviderId === p.id);
                              if (subs.length === 0) return null;
                              return (
                                <div style={{ padding: "8px 16px 12px", borderTop: `1px solid ${typeColor}15`, background: `${typeColor}05` }}>
                                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: typeColor, margin: "0 0 6px" }}>Subproveedores ({subs.length})</p>
                                  {subs.map(sub => (
                                    <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 3 }}>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{sub.name}</span>
                                      <div style={{ display: "flex", gap: 4 }}>
                                        <button onClick={() => openEditProvider(sub)} style={{ padding: 3, borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }} title="Editar">
                                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                        </button>
                                        <button onClick={() => removeProvider(sub)} style={{ padding: 3, borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }} title="Eliminar">
                                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: PARTICIPANTES ───────────────────────────────────────────── */}
      {activeTab === "participantes" && (
        <>
          {/* Filters */}
          <section className="surface rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
            <input
              className="input flex-1 min-w-[180px]"
              placeholder="Buscar por nombre, RUT o email…"
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
            />
            <select
              className="input w-64"
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
            >
              <option value="">— Todos los proveedores —</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {activeFilterProvider && (
              <button
                onClick={() => setProviderFilter("")}
                style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "99px",
                  background: "rgba(33,208,179,0.1)", border: "1px solid rgba(33,208,179,0.3)",
                  color: "#21D0B3", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {activeFilterProvider.name} ✕
              </button>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>
              {filteredParticipants.length} resultado{filteredParticipants.length !== 1 ? "s" : ""}
            </span>
          </section>

          {/* Bulk photo upload */}
          <section className="surface" style={{ borderRadius: "14px", padding: "14px 18px", borderTop: "2px solid #a78bfa", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", marginBottom: "4px" }}>
                  Carga masiva de fotos
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                  El nombre del archivo debe coincidir con el nombre completo del participante.
                </p>
              </div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "12px",
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", boxShadow: "0 2px 10px rgba(167,139,250,0.35)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Seleccionar fotos
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  let matched = 0, notFound = 0;
                  const notFoundNames: string[] = [];
                  for (const file of files) {
                    const baseName = file.name.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/[._-]/g, " ");
                    const participant = participants.find(p => (p.fullName || "").toLowerCase() === baseName);
                    if (!participant) { notFound++; notFoundNames.push(file.name); continue; }
                    try {
                      const raw = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); });
                      let dataUrl = raw;
                      try {
                        dataUrl = await new Promise<string>((resolve) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const MAX = 1200; let w = img.width, h = img.height;
                            if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
                            canvas.width = w; canvas.height = h;
                            canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
                            resolve(canvas.toDataURL("image/jpeg", 0.7));
                          };
                          img.onerror = () => resolve(raw);
                          img.src = raw;
                        });
                      } catch { /* use raw */ }
                      await apiFetch(`/provider-participants/${participant.id}/document`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: "photoUrl", dataUrl }),
                      });
                      matched++;
                    } catch { notFound++; notFoundNames.push(file.name); }
                  }
                  setBulkPhotoResult({ matched, notFound, names: notFoundNames });
                  await loadParticipants();
                  e.target.value = "";
                }} />
              </label>
            </div>
          </section>

          {/* Bulk photo result modal */}
          {bulkPhotoResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: bulkPhotoResult.matched > 0 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  {bulkPhotoResult.matched > 0 ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  )}
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px" }}>{bulkPhotoResult.matched > 0 ? "Carga completada" : "Sin coincidencias"}</h3>
                <div style={{ display: "flex", justifyContent: "center", gap: "16px", margin: "12px 0 16px" }}>
                  <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p style={{ fontSize: "20px", fontWeight: 800, color: "#10b981", margin: 0 }}>{bulkPhotoResult.matched}</p>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#065f46", margin: 0 }}>Exitosas</p>
                  </div>
                  <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p style={{ fontSize: "20px", fontWeight: 800, color: "#ef4444", margin: 0 }}>{bulkPhotoResult.notFound}</p>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#991b1b", margin: 0 }}>Sin match</p>
                  </div>
                </div>
                {bulkPhotoResult.names.length > 0 && (
                  <div style={{ textAlign: "left", background: "#f8fafc", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", maxHeight: "120px", overflowY: "auto" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>Archivos sin coincidencia</p>
                    {bulkPhotoResult.names.slice(0, 10).map(name => (
                      <p key={name} style={{ fontSize: "12px", color: "#64748b", margin: "2px 0" }}>{name}</p>
                    ))}
                    {bulkPhotoResult.names.length > 10 && <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>+{bulkPhotoResult.names.length - 10} más...</p>}
                  </div>
                )}
                <button onClick={() => setBulkPhotoResult(null)}
                  style={{ padding: "10px 32px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.3)" }}>
                  Entendido
                </button>
              </div>
            </div>
          )}

          {loadingParticipants ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-faint)" }}>
              Cargando participantes…
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="surface rounded-2xl p-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              {participants.length === 0
                ? "No hay participantes registrados para este proveedor."
                : "Sin resultados para el filtro actual."}
            </div>
          ) : (
            <div className="surface rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              {filteredParticipants.map((p, i) => {
                const provider = providers.find(pr => pr.id === p.providerId);
                const isTransporte = provider?.type === "TRANSPORTE";
                const docCount = isTransporte ? countUploadedDocs(p.metadata) : -1;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-5 py-3"
                    style={{ borderBottom: i < filteredParticipants.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    {/* Photo */}
                    {(() => {
                      const photo = (p.metadata as any)?.photoUrl;
                      return photo && typeof photo === "string" && photo.startsWith("http") ? (
                        <img src={photo} alt="" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"2px solid #21D0B3" }} />
                      ) : (
                        <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:"rgba(33,208,179,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:"#21D0B3" }}>
                          {(p.fullName || "?").split(" ").slice(0,2).map(w => w[0] ?? "").join("").toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{p.fullName}</span>
                      <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                        {provider && (
                          <span style={{ fontSize: "11px", color: "#21D0B3", fontWeight: 500 }}>{provider.name}</span>
                        )}
                        {p.userType && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.userType}</span>
                        )}
                        {p.countryCode && (
                          <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>{p.countryCode}</span>
                        )}
                      </div>
                    </div>

                    {p.tripType && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                        background: p.tripType === "ARRIVAL" ? "rgba(31,205,255,0.1)" : p.tripType === "DEPARTURE" ? "rgba(168,85,247,0.1)" : "rgba(33,208,179,0.1)",
                        border: `1px solid ${p.tripType === "ARRIVAL" ? "rgba(31,205,255,0.3)" : p.tripType === "DEPARTURE" ? "rgba(168,85,247,0.3)" : "rgba(33,208,179,0.3)"}`,
                        color: p.tripType === "ARRIVAL" ? "#1FCDFF" : p.tripType === "DEPARTURE" ? "#a855f7" : "#21D0B3",
                        flexShrink: 0,
                      }}>
                        {TRIP_TYPE_LABELS[p.tripType] ?? p.tripType}
                      </span>
                    )}

                    {docCount >= 0 && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                        padding: "2px 8px", borderRadius: "99px",
                        background: docCount === ALL_TRANSPORT_DOCS.length ? "rgba(16,185,129,0.1)" : "rgba(33,208,179,0.08)",
                        border: `1px solid ${docCount === ALL_TRANSPORT_DOCS.length ? "rgba(16,185,129,0.3)" : "rgba(33,208,179,0.25)"}`,
                        color: docCount === ALL_TRANSPORT_DOCS.length ? "#10b981" : "#21D0B3",
                        flexShrink: 0,
                      }}>
                        {docCount}/{ALL_TRANSPORT_DOCS.length} docs
                      </span>
                    )}

                    {p.rut && (
                      <span className="hidden md:block" style={{ fontSize: "12px", color: "var(--text-faint)" }}>{p.rut}</span>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditParticipant(p)}
                        className="transition-colors p-1.5"
                        style={{ color: "var(--text-faint)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#1FCDFF"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                        title="Editar"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeParticipant(p)}
                        className="transition-colors p-1.5"
                        style={{ color: "var(--text-faint)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f43f5e"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                        title="Eliminar"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── MODAL: PROVEEDOR ─────────────────────────────────────────────── */}
      {providerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="surface rounded-3xl w-full flex flex-col"
            style={{
              maxWidth: isTransporteProvider ? "820px" : "448px",
              maxHeight: "90vh",
              borderTop: "2px solid #21D0B3",
              boxShadow: "0 8px 32px rgba(15,23,42,0.18)",
            }}
          >
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>
                {providerModal.editing ? "Editar" : "Nuevo"}
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                {providerModal.editing ? "Editar proveedor" : providerModal.parentId ? `Nuevo subproveedor de ${providers.find(pr => pr.id === providerModal.parentId)?.name || ""}` : "Nuevo proveedor"}
              </h2>
            </div>

            <div className="overflow-y-auto px-6 pb-2 flex-1 space-y-4">
              {/* Logo upload */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {(() => {
                  const logoUrl = providerDocFiles.logo
                    ? URL.createObjectURL(providerDocFiles.logo)
                    : typeof providerModal?.editing?.metadata?.logo === "string" ? (providerModal.editing.metadata.logo as string) : null;
                  return (
                    <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "2px dashed #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      )}
                    </div>
                  );
                })()}
                <div style={{ flex: 1 }}>
                  <DocRow
                    label="Logo del proveedor"
                    docKey="logo"
                    file={providerDocFiles.logo ?? null}
                    url={typeof providerModal?.editing?.metadata?.logo === "string" ? (providerModal.editing.metadata.logo as string) : undefined}
                    onFile={(k, f) => setProviderDocFiles(prev => ({ ...prev, [k]: f }))}
                    disabled={savingProvider}
                  />
                </div>
              </div>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Nombre *
                <input className="input" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del proveedor" autoFocus />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Tipo
                  <select className="input" value={providerForm.type} onChange={e => setProviderForm(f => ({ ...f, type: e.target.value, subtype: "" }))}>
                    <option value="">— Sin tipo —</option>
                    {Object.entries(PROVIDER_TYPES).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Sub-tipo
                  <select className="input" value={providerForm.subtype} onChange={e => setProviderForm(f => ({ ...f, subtype: e.target.value }))} disabled={availableSubtypes.length === 0}>
                    <option value="">—</option>
                    {availableSubtypes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Email
                  <input className="input" type="email" value={providerForm.email} onChange={e => setProviderForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@proveedor.com" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  RUT
                  <input className="input" value={providerForm.rut} onChange={e => setProviderForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Teléfono
                  <input className="input" value={providerForm.phone} onChange={e => setProviderForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Nombre de contacto
                  <input className="input" value={providerForm.contactName} onChange={e => setProviderForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nombre del contacto" />
                </label>
              </div>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Dirección
                <input className="input" value={providerForm.address} onChange={e => setProviderForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección del proveedor" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Ciudad
                  <input className="input" value={providerForm.city} onChange={e => setProviderForm(f => ({ ...f, city: e.target.value }))} placeholder="Santiago" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Tipo de factura
                  <select className="input" value={providerForm.invoiceType} onChange={e => setProviderForm(f => ({ ...f, invoiceType: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    <option value="AFECTO">Afecto</option>
                    <option value="EXENTO">Exento</option>
                    <option value="MIXTO">Mixto</option>
                  </select>
                </label>
              </div>

              {/* Bid amount + trip count for transport, hospitality, food */}
              {(providerForm.type === "TRANSPORTE" || providerForm.type === "HOTELERIA" || providerForm.type === "ALIMENTACION") && (
                <div className={providerForm.type === "TRANSPORTE" ? "grid grid-cols-2 gap-3" : ""}>
                  <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Monto licitado
                    <input className="input" type="text" inputMode="numeric" value={providerForm.bidAmount ? `$${Number(providerForm.bidAmount).toLocaleString("es-CL")}` : ""} onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setProviderForm(f => ({ ...f, bidAmount: raw })); }} placeholder="$0" />
                  </label>
                  {providerForm.type === "TRANSPORTE" && (
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Total viajes licitados
                      <input className="input" type="text" inputMode="numeric" value={providerForm.bidTripCount || ""} onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setProviderForm(f => ({ ...f, bidTripCount: raw })); }} placeholder="0" />
                    </label>
                  )}
                </div>
              )}

              {/* Rate table for transport providers */}
              {isTransporteProvider && (
                <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "rgba(33,208,179,0.06)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0 }}>Tabla de tarifas</p>
                    <button type="button" onClick={() => {
                      // Generate all combinations if empty
                      if (providerRates.length === 0) {
                        const generated: ProviderRate[] = [];
                        for (const fleet of FLEET_TYPES) {
                          for (const service of SERVICE_TYPES) {
                            generated.push({
                              providerId: providerModal?.editing?.id || "",
                              fleetType: fleet.value,
                              passengerRange: fleet.passengers || null,
                              tripType: service.value,
                              clientPrice: 0,
                              providerPrice: 0,
                            });
                          }
                        }
                        setProviderRates(generated);
                      }
                    }} style={{ fontSize: 11, fontWeight: 600, color: "#21D0B3", background: "none", border: "1px solid rgba(33,208,179,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                      {providerRates.length === 0 ? "Generar tabla" : "Regenerar"}
                    </button>
                  </div>

                  {providerRates.length > 0 && (
                    <div style={{ maxHeight: 320, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>Flota</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>Pax</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>Tipo servicio</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>Valor cliente</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>Valor proveedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providerRates.map((rate, idx) => {
                            const fleet = FLEET_TYPES.find((f) => f.value === rate.fleetType);
                            const service = SERVICE_TYPES.find((s) => s.value === rate.tripType);
                            const isFirstOfFleet = idx === 0 || providerRates[idx - 1].fleetType !== rate.fleetType;
                            return (
                              <tr key={`${rate.fleetType}-${rate.tripType}`} style={{ borderBottom: "1px solid #f1f5f9", background: isFirstOfFleet ? "#fafbfc" : "#fff" }}>
                                <td style={{ padding: "6px 10px", fontWeight: isFirstOfFleet ? 700 : 400, color: "#0f172a" }}>
                                  {isFirstOfFleet ? (fleet?.label || rate.fleetType) : ""}
                                </td>
                                <td style={{ padding: "6px", textAlign: "center", color: "#64748b" }}>
                                  {isFirstOfFleet ? (fleet?.passengers || "-") : ""}
                                </td>
                                <td style={{ padding: "6px 10px", color: "#334155" }}>{service?.label || rate.tripType}</td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <input type="text" inputMode="numeric" value={Number(rate.clientPrice) ? `$${Number(rate.clientPrice).toLocaleString("es-CL")}` : ""} onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    const next = [...providerRates];
                                    next[idx] = { ...next[idx], clientPrice: Number(raw) || 0 };
                                    setProviderRates(next);
                                  }} placeholder="$0" style={{ width: 95, padding: "4px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, textAlign: "right" }} />
                                </td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <input type="text" inputMode="numeric" value={Number(rate.providerPrice) ? `$${Number(rate.providerPrice).toLocaleString("es-CL")}` : ""} onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    const next = [...providerRates];
                                    next[idx] = { ...next[idx], providerPrice: Number(raw) || 0 };
                                    setProviderRates(next);
                                  }} placeholder="$0" style={{ width: 95, padding: "4px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, textAlign: "right" }} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {providerError && <p className="text-sm" style={{ color: "#f43f5e" }}>{providerError}</p>}
            </div>

            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setProviderModal(null)} disabled={savingProvider}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveProvider} disabled={savingProvider}>
                {savingProvider ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PARTICIPANTE ──────────────────────────────────────────── */}
      {participantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="surface rounded-3xl w-full flex flex-col"
            style={{
              maxWidth: isTransporteParticipant ? "720px" : "560px",
              maxHeight: "92vh",
              borderTop: "2px solid #21D0B3",
              boxShadow: "0 8px 32px rgba(15,23,42,0.18)",
            }}
          >
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "4px" }}>
                {participantModal.editing ? "Editar" : "Nuevo"}
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                {participantModal.editing ? "Editar participante" : "Nuevo participante"}
              </h2>
            </div>

            <div className="overflow-y-auto px-6 pb-2 flex-1 space-y-4">
              {/* Proveedor */}
              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Proveedor *
                <select
                  className="input"
                  value={participantForm.providerId}
                  onChange={e => setParticipantForm(f => ({ ...f, providerId: e.target.value }))}
                >
                  <option value="">— Seleccionar proveedor —</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.type ? ` (${PROVIDER_TYPES[p.type]?.label ?? p.type})` : ""}</option>
                  ))}
                </select>
              </label>

              {/* Foto */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0" }}>
                {participantForm.photoDataUrl ? (
                  <img src={participantForm.photoDataUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #21D0B3" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(33,208,179,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#21D0B3" }}>
                    {(participantForm.fullName || "?").split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase()}
                  </div>
                )}
                <div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px",
                    background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "12px", fontWeight: 700,
                    cursor: "pointer", boxShadow: "0 2px 8px rgba(33,208,179,0.3)",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    {participantForm.photoDataUrl ? "Cambiar foto" : "Subir foto"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const raw = reader.result as string;
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          const MAX = 1200;
                          let w = img.width, h = img.height;
                          if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
                          canvas.width = w; canvas.height = h;
                          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
                          setParticipantForm(f => ({ ...f, photoDataUrl: canvas.toDataURL("image/jpeg", 0.7) }));
                        };
                        img.onerror = () => setParticipantForm(f => ({ ...f, photoDataUrl: raw }));
                        img.src = raw;
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }} />
                  </label>
                  {participantForm.photoDataUrl && (
                    <button type="button" onClick={() => setParticipantForm(f => ({ ...f, photoDataUrl: "" }))}
                      style={{ marginLeft: "8px", fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Datos personales */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px" }}>Datos personales</p>
                <div className="space-y-3">
                  <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Nombre completo *
                    <input className="input" value={participantForm.fullName} onChange={e => setParticipantForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Nombre y apellido" autoFocus />
                  </label>

                  <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    País
                    <CountrySelect
                      value={participantForm.countryCode}
                      onChange={val => setParticipantForm(f => ({ ...f, countryCode: val, rut: val !== "CHL" ? "" : f.rut, passportNumber: val === "CHL" ? "" : f.passportNumber }))}
                    />
                  </label>


                  <div className="grid grid-cols-2 gap-3">
                    {participantForm.countryCode === "CHL" ? (
                      <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        RUT
                        <input className="input" value={participantForm.rut} onChange={e => setParticipantForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" autoFocus />
                      </label>
                    ) : (
                      <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        Pasaporte
                        <input className="input" value={participantForm.passportNumber} onChange={e => setParticipantForm(f => ({ ...f, passportNumber: e.target.value }))} placeholder="A12345678" />
                      </label>
                    )}
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Fecha de nacimiento
                      <input className="input" type="date" value={participantForm.dateOfBirth} onChange={e => setParticipantForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Email
                      <input className="input" type="email" value={participantForm.email} onChange={e => setParticipantForm(f => ({ ...f, email: e.target.value }))} placeholder="nombre@email.com" />
                    </label>
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Teléfono
                      <input className="input" value={participantForm.phone} onChange={e => setParticipantForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Rol / Tipo
                      <input className="input" value={participantForm.userType} onChange={e => setParticipantForm(f => ({ ...f, userType: e.target.value }))} placeholder="Conductor, Coordinador…" />
                    </label>
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Requiere visa
                      <select className="input" value={participantForm.visaRequired} onChange={e => setParticipantForm(f => ({ ...f, visaRequired: e.target.value }))}>
                        <option value="">— Sin especificar —</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Observaciones
                <textarea className="input" rows={2} value={participantForm.observations} onChange={e => setParticipantForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notas adicionales…" style={{ resize: "vertical" }} />
              </label>

              {/* Chofer flag + vehículo + docs (solo TRANSPORTE) */}
              {isTransporteParticipant && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>

                  {/* Toggle chofer */}
                  <button
                    type="button"
                    onClick={() => setParticipantForm(f => ({ ...f, isDriver: !f.isDriver }))}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: "12px", cursor: "pointer", border: "none",
                      background: participantForm.isDriver ? "rgba(33,208,179,0.08)" : "var(--elevated)",
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={participantForm.isDriver ? "#21D0B3" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: participantForm.isDriver ? "#21D0B3" : "var(--text-muted)" }}>
                        Es chofer
                      </span>
                    </div>
                    {/* Toggle pill */}
                    <div style={{
                      width: "40px", height: "22px", borderRadius: "11px", position: "relative",
                      background: participantForm.isDriver ? "#21D0B3" : "var(--border-strong)",
                      transition: "background 0.2s", flexShrink: 0,
                    }}>
                      <div style={{
                        position: "absolute", top: "3px",
                        left: participantForm.isDriver ? "21px" : "3px",
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                  </button>

                  {participantForm.isDriver && (<>
                    {/* Vehículo */}
                    <div style={{ marginTop: "16px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" }}>
                        Detalle del vehículo
                      </p>
                      <div className="space-y-3">
                        {/* Patente con lookup */}
                        <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            Patente
                            {lookingUpPlate && (
                              <span style={{ fontSize: "10px", color: "#21D0B3", fontWeight: 500, letterSpacing: "0.05em" }}>Buscando…</span>
                            )}
                            {!lookingUpPlate && plateError && (
                              <span style={{ fontSize: "10px", color: "#f87171", fontWeight: 500 }}>{plateError}</span>
                            )}
                            {!lookingUpPlate && !plateError && participantForm.vehicleMarca && (
                              <span style={{ fontSize: "10px", color: "#21D0B3", fontWeight: 500 }}>✓ Datos encontrados</span>
                            )}
                          </span>
                          <input
                            className="input"
                            value={participantForm.vehiclePatente}
                            onChange={e => { setPlateError(null); setParticipantForm(f => ({ ...f, vehiclePatente: e.target.value.toUpperCase() })); }}
                            onBlur={e => lookupPlate(e.target.value)}
                            placeholder="ABCD12"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Marca
                            <input className="input" value={participantForm.vehicleMarca} onChange={e => setParticipantForm(f => ({ ...f, vehicleMarca: e.target.value }))} placeholder="Toyota" />
                          </label>
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Modelo
                            <input className="input" value={participantForm.vehicleModelo} onChange={e => setParticipantForm(f => ({ ...f, vehicleModelo: e.target.value }))} placeholder="Corolla" />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Año
                            <input className="input" value={participantForm.vehicleAno} onChange={e => setParticipantForm(f => ({ ...f, vehicleAno: e.target.value }))} placeholder="2022" maxLength={4} />
                          </label>
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Tipo
                            <select className="input" value={participantForm.vehicleTipo} onChange={e => setParticipantForm(f => ({ ...f, vehicleTipo: e.target.value }))}>
                              <option value="">— Tipo —</option>
                              <option value="SEDAN">Sedán</option>
                              <option value="SUV">SUV</option>
                              <option value="VAN_10">Van 10</option>
                              <option value="VAN_15">Van 15-17</option>
                              <option value="VAN_19">Van 19</option>
                              <option value="MINIBUS">Minibus</option>
                              <option value="BUS">Bus</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Documentación */}
                    <div style={{ marginTop: "20px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "2px" }}>
                        Documentación requerida
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                        Documentos del participante y del vehículo. Formatos: imagen o PDF.
                      </p>

                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
                        Documentos personales
                      </p>
                      {TRANSPORT_DOCS_PERSON.map(doc => (
                        <DocRow
                          key={doc.key}
                          label={doc.label}
                          docKey={doc.key}
                          file={participantDocFiles[doc.key] ?? null}
                          url={typeof participantModal?.editing?.metadata?.[doc.key] === "string" ? (participantModal.editing.metadata![doc.key] as string) : undefined}
                          onFile={(k, f) => setParticipantDocFiles(prev => ({ ...prev, [k]: f }))}
                          disabled={savingParticipant}
                        />
                      ))}

                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: "16px", marginBottom: "4px" }}>
                        Documentos del vehículo
                      </p>
                      {TRANSPORT_DOCS_VEHICLE.map(doc => (
                        <DocRow
                          key={doc.key}
                          label={doc.label}
                          docKey={doc.key}
                          file={participantDocFiles[doc.key] ?? null}
                          url={typeof participantModal?.editing?.metadata?.[doc.key] === "string" ? (participantModal.editing.metadata![doc.key] as string) : undefined}
                          onFile={(k, f) => setParticipantDocFiles(prev => ({ ...prev, [k]: f }))}
                          disabled={savingParticipant}
                        />
                      ))}
                    </div>
                  </>)}

                </div>
              )}

              {participantError && <p className="text-sm" style={{ color: "#f43f5e" }}>{participantError}</p>}
            </div>

            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setParticipantModal(null)} disabled={savingParticipant}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveParticipant} disabled={savingParticipant}>
                {savingParticipant ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
