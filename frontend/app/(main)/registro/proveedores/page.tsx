"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import { descargarConductores, ES_CONDUCTOR } from "@/lib/export-conductores";
import {
  cumpleFiltroDocumentacion,
  cumpleFiltroTipo,
  documentacionDe,
  DOCS_PERSONA,
  DOCS_VEHICULO,
  DOCS_CONDUCTOR,
  type FiltroDocumentacion,
  type FiltroTipoPersona,
  OPCIONES_FILTRO_DOCUMENTACION,
} from "@/lib/documentos-personas";
import {
  CheckIcon,
  XIcon,
  AlertIcon,
  EyeIcon,
  BuildingIcon,
  SearchIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  UploadIcon,
  AlertCircleIcon,
  CameraIcon,
  DownloadIcon,
} from "@/components/ui/Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import StyledSelect from "@/components/StyledSelect";
import CountrySelect from "@/components/CountrySelect";
import { CLIENT_TYPE_OPTIONS } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n";
import { useEventoActivo } from "@/lib/evento-activo-provider";
import {
  accionAlQuitar,
  accionAlQuitarPersona,
  agregarEvento,
  eventosParaNuevo,
  nombresDeEventos,
  otrosEventos,
  participantesDelEvento,
  proveedoresDelEvento,
  proveedoresParaTraer,
  quitadosDelEvento,
  quitarEvento,
  recortar,
  repartirSeleccion,
} from "@/lib/proveedores-evento";

// ── Type/subtype catalogue ──────────────────────────────────────────────────
type TypeEntry = { label: string; subtypes: string[]; color: string; bg: string };

const PROVIDER_TYPES: Record<string, TypeEntry> = {
  TRANSPORTE:       { label: "Transporte",           subtypes: [],                                                                    color: BRAND.blue, bg: "rgba(31,205,255,0.08)" },
  LOGISTICA:        { label: "Logística",             subtypes: [],                                                                    color: BRAND.teal, bg: "rgba(33,208,179,0.08)" },
  HOTELERIA:        { label: "Hotelería",             subtypes: [],                                                                    color: ACCENT.violetLight, bg: "rgba(167,139,250,0.08)" },
  ALIMENTACION:     { label: "Alimentación",          subtypes: [],                                                                    color: "#fb923c", bg: "rgba(251,146,60,0.08)"  },
  PRODUCTORA:       { label: "Productora",            subtypes: [],                                                                    color: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  VOLUNTARIOS:      { label: "Voluntarios",           subtypes: [],                                                                    color: "#34d399", bg: "rgba(52,211,153,0.08)"  },
  SEGURIDAD:        { label: "Seguridad",             subtypes: [],                                                                    color: "#f87171", bg: "rgba(248,113,113,0.08)" },
  STAFF:            { label: "Staff",                 subtypes: ["Recursos Humanos", "Dpto de Compras", "Sport Manager", "Comité Organizador"], color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
  INFRAESTRUCTURA:  { label: "Infraestructura",       subtypes: ["Recintos"],                                                          color: STATE.warning, bg: "rgba(251,191,36,0.08)"  },
  CONTROL_TECNICO:  { label: "Control Técnico",       subtypes: ["Jueces", "Mesa de Control"],                                         color: "#e879f9", bg: "rgba(232,121,249,0.08)" },
  SALUD:            { label: "Salud",                 subtypes: ["Antidopaje"],                                                        color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
  BROADCAST:        { label: "Broadcast y Medios",    subtypes: [],                                                                    color: STATE.warning, bg: "rgba(245,158,11,0.08)"  },
  MERCHANDISING:    { label: "Merchandising",         subtypes: ["Marketing", "Equipamiento Deportivo"],                               color: "#ec4899", bg: "rgba(236,72,153,0.08)"  },
  TECNOLOGIA:       { label: "Tecnología",            subtypes: [],                                                                    color: "#38bdf8", bg: "rgba(56,189,248,0.08)"  },
  RRHH:             { label: "Recursos Humanos",      subtypes: [],                                                                    color: "#a3e635", bg: "rgba(163,230,53,0.08)"  },
  ASEO:             { label: "Aseo y Mantención",     subtypes: [],                                                                    color: SURFACE.textFaint, bg: "rgba(148,163,184,0.08)" },
  ACREDITACION:     { label: "Acreditación",          subtypes: [],                                                                    color: "#2dd4bf", bg: "rgba(45,212,191,0.08)"  },
};

// ── Transport documents ─────────────────────────────────────────────────────
// La lista vive en lib/documentos-personas, que también usa el módulo
// Documentos para decir quién no ha subido nada.
const TRANSPORT_DOCS_PERSON = DOCS_PERSONA;
const TRANSPORT_DOCS_VEHICLE = DOCS_VEHICULO;
const ALL_TRANSPORT_DOCS = DOCS_CONDUCTOR;

/**
 * Ancho de un filtro en la barra: StyledSelect fija width 100% en línea, así
 * que la clase md:w-* no manda. Con flex y un tope, en el escritorio se
 * reparten la fila y en el teléfono cada uno ocupa la fila entera.
 */
const FILTRO_ANCHO = (base: number): React.CSSProperties => ({ flex: `1 1 ${base}px`, width: "auto", maxWidth: base + 80 });

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
  /** Eventos en que trabaja (28-09-2026); vacío = ficha antigua, se ve en todos. */
  eventIds?: string[] | null;
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
  { value: "BUS", label: "Bus", passengers: "40 a 45" },
] as const;

const SERVICE_TYPES = [
  { value: "TRANSFER_IN_OUT", label: "Transfer In Out" },
  { value: "DISPOSICION_12H", label: "Disposición 12 Horas" },
  { value: "VIAJE_IDA", label: "Viaje de ida" },
  { value: "VIAJE_REGRESO", label: "Viaje de regreso" },
  { value: "VIAJE_IDA_REGRESO", label: "Viaje de ida y regreso" },
  { value: "COMEDOR", label: "Comedor" },
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
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const hasUploaded = typeof url === "string" && url.length > 0;
  const hasNew = file !== null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ flex: 1, fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "11px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: hasNew ? BRAND.teal : hasUploaded ? STATE.success : "var(--text-faint)" }}>
        {hasNew ? file.name : hasUploaded ? t("Cargado") : "—"}
      </span>
      {hasUploaded && url && (
        <a href={url} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--elevated)", cursor: "pointer", flexShrink: 0 }}
          title={t("Ver documento")}>
          <EyeIcon size={12} color="var(--text-muted)" strokeWidth={2} />
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
        {hasUploaded || hasNew ? t("Cambiar") : t("Cargar")}
      </button>
      {hasNew && (
        <button type="button" disabled={disabled} onClick={() => onFile(docKey, null)}
          style={{ fontSize: "13px", color: STATE.danger, background: "none", border: "none", cursor: "pointer", padding: "2px", flexShrink: 0, lineHeight: 1 }}>
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}

// ── Empty forms ──────────────────────────────────────────────────────────────
const EMPTY_PROVIDER_FORM = { name: "", type: "", subtype: "", email: "", rut: "", phone: "", address: "", city: "", contactName: "", invoiceType: "", bidAmount: "", bidTripCount: "" };
/**
 * Capacidad sugerida por tipo de vehículo. Es el valor que la app asumía
 * cuando la ficha no traía capacidad; ahora sólo se propone al elegir el tipo
 * y se puede corregir: los buses de la flota son de 46, pero un bus de 50
 * asientos dejaba de aparecer al pedir 46 pasajeros.
 */
const CAPACIDAD_SUGERIDA: Record<string, number> = {
  SEDAN: 4, SUV: 6, VAN_10: 10, VAN_15: 17, VAN_19: 19, MINIBUS: 33, BUS: 46,
};

/** Capacidad guardada en la ficha, venga como número o como texto. */
const capacidadDeMetadata = (meta?: Record<string, unknown> | null): string => {
  const c = meta?.vehicleCapacity;
  if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  if (typeof c === 'string' && c.trim()) return c.trim();
  return '';
};

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
  // Tipos de cliente que el chofer puede transportar — TA por defecto.
  allowedClientTypes: ["TA"] as string[],
  vehicleMarca: "",
  vehicleModelo: "",
  vehicleAno: "",
  vehiclePatente: "",
  vehicleTipo: "",
  vehicleCapacidad: "",
  photoDataUrl: "",
};

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const { t } = useI18n();
  // Evento activo del panel: los proveedores trabajan en uno o varios eventos.
  const { eventoId, evento, eventos } = useEventoActivo();
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
  // "Traer de otro evento": el mismo proveedor, con sus conductores, sin duplicarlo.
  const [traerAbierto, setTraerAbierto] = useState(false);
  const [traerBusqueda, setTraerBusqueda] = useState("");
  /** Todas las personas de todos los proveedores, para contar las de cada uno. null = cargando. */
  const [personasTodas, setPersonasTodas] = useState<Participant[] | null | "error">(null);
  const [trayendoId, setTrayendoId] = useState<string | null>(null);

  // ── Participants state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  /** Filtros de la nómina: conductor u otro, y estado de su documentación. */
  const [participantTipo, setParticipantTipo] = useState<FiltroTipoPersona>("");
  const [participantDocs, setParticipantDocs] = useState<FiltroDocumentacion>("");
  // Llegada desde el módulo Documentos: /registro/proveedores?buscar=<nombre>
  // abre la nómina con esa persona buscada.
  useEffect(() => {
    const buscar = new URLSearchParams(window.location.search).get("buscar");
    if (buscar) {
      setParticipantSearch(buscar);
      setActiveTab("participantes");
    }
  }, []);
  const [bulkPhotoResult, setBulkPhotoResult] = useState<{ matched: number; notFound: number; names: string[] } | null>(null);
  const [participantModal, setParticipantModal] = useState<null | { editing?: Participant }>(null);
  const [participantForm, setParticipantForm] = useState(EMPTY_PARTICIPANT_FORM);
  const [participantDocFiles, setParticipantDocFiles] = useState<Record<string, File | null>>({});
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  // Selección masiva de la nómina (28-09-2026): al traer un proveedor de otro
  // evento vienen todas sus personas, y sacarlas una por una con la papelera
  // las borraba también del otro evento.
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [procesandoLote, setProcesandoLote] = useState(false);
  /** Mostrar a las personas quitadas de este evento, para devolverlas. */
  const [verQuitados, setVerQuitados] = useState(false);
  // Envío manual del correo de bienvenida con el código de acceso
  const [sendingMailId, setSendingMailId] = useState<string | null>(null);
  /** Participante cuyo código se acaba de copiar, para confirmarlo en pantalla. */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Código de acceso del portal: los últimos 6 caracteres del UUID. Es el mismo
   * que resuelve MobileAuthService.login y el que sale en el correo de
   * bienvenida; hasta ahora sólo se podía enviar por correo, sin verlo.
   */
  const accessCode = (id: string) => String(id).slice(-6).toLowerCase();

  const copyAccessCode = async (id: string) => {
    try {
      await navigator.clipboard.writeText(accessCode(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      /* sin permiso de portapapeles: el código igual queda a la vista */
    }
  };
  const [mailToast, setMailToast] = useState<{ ok: boolean; msg: string } | null>(null);
  useEffect(() => {
    if (!mailToast) return;
    const t = setTimeout(() => setMailToast(null), 4500);
    return () => clearTimeout(t);
  }, [mailToast]);
  const sendAccessEmail = async (p: Participant) => {
    if (sendingMailId) return;
    setSendingMailId(p.id);
    try {
      const res = await apiFetch<{ message: string }>(
        `/provider-participants/${p.id}/send-welcome-email`,
        { method: "POST" },
      );
      setMailToast({ ok: true, msg: res.message || `${t("Correo enviado a")} ${p.email}` });
    } catch (e) {
      setMailToast({ ok: false, msg: e instanceof Error ? e.message : t("No se pudo enviar el correo") });
    } finally {
      setSendingMailId(null);
    }
  };
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
      setPlateError(t("No se encontró información para esta patente"));
    } finally {
      setLookingUpPlate(false);
    }
  };

  // ── Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    /** Para "Quitar del evento", que no borra nada. */
    title?: string;
    confirmLabel?: string;
    danger?: boolean;
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

  // Sólo los del evento activo: con World Rugby creado se veían los
  // proveedores de los Juegos Escolares. Contadores, filtros y búsqueda
  // parten de esta lista, no de la de todos los eventos.
  const proveedoresEvento = useMemo(() => proveedoresDelEvento(providers, eventoId), [providers, eventoId]);

  /** Cuántos proveedores de cada tipo hay en el evento (tarjetas y filtro). */
  const tiposEvento = useMemo(() => {
    const cuenta: Record<string, number> = {};
    proveedoresEvento.forEach(p => { if (p.type) cuenta[p.type] = (cuenta[p.type] ?? 0) + 1; });
    return cuenta;
  }, [proveedoresEvento]);

  // Al cambiar de evento no queda elegido nada del otro: un proveedor o un
  // tipo que aquí no tiene a nadie dejaba la lista vacía sin explicación.
  useEffect(() => {
    if (loadingProviders) return;
    const enEvento = (id: string) => proveedoresEvento.some(p => p.id === id);
    if (providerFilter && !enEvento(providerFilter)) setProviderFilter("");
    if (filterType && !tiposEvento[filterType]) setFilterType("");
    // Un participante nuevo no puede quedar colgando de un proveedor de otro evento.
    if (participantModal && !participantModal.editing && participantForm.providerId && !enEvento(participantForm.providerId)) {
      setParticipantForm(f => ({ ...f, providerId: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedoresEvento, loadingProviders]);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return proveedoresEvento.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) &&
          !(p.email ?? "").toLowerCase().includes(q) &&
          !(p.rut ?? "").toLowerCase().includes(q)) return false;
      if (filterType && p.type !== filterType) return false;
      return true;
    });
  }, [proveedoresEvento, providerSearch, filterType]);

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
    if (!providerForm.name.trim()) { setProviderError(t("El nombre es requerido.")); return; }
    setSavingProvider(true);
    setProviderError(null);
    try {
      const parentId = providerModal?.parentId ?? null;
      const parentProv = parentId ? providers.find(pr => pr.id === parentId) : null;
      const eventosNuevo = eventosParaNuevo(eventoId, parentProv);
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
        // Uno nuevo queda en el evento activo; un subproveedor, en los de su
        // padre. Al editar no se tocan sus eventos.
        ...(!providerModal?.editing && eventosNuevo.length > 0 ? { eventIds: eventosNuevo } : {}),
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
      setProviderError(e instanceof Error ? e.message : t("Error al guardar"));
    } finally {
      setSavingProvider(false);
    }
  };

  const guardarEventos = (id: string, eventIds: string[]) =>
    apiFetch(`/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds }),
    });

  const removeProvider = (p: Provider) => {
    // Si además trabaja en otro evento, la papelera sólo lo saca de éste:
    // eliminarlo se llevaría a sus conductores también del otro evento.
    if (accionAlQuitar(p.eventIds, eventoId) === "QUITAR_DEL_EVENTO") {
      const otros = nombresDeEventos(otrosEventos(p.eventIds, eventoId), eventos);
      const subs = providers.filter(sp => sp.parentProviderId === p.id);
      setConfirmDialog({
        title: t("Quitar del evento"),
        confirmLabel: t("Quitar del evento"),
        danger: false,
        message: `"${p.name}" ${t("deja de verse en")} ${evento?.name ?? t("este evento")}. ${t("No se elimina: sigue en")} ${otros.join(", ") || t("otro evento")} ${t("con sus participantes y conductores.")}${subs.length > 0 ? ` ${t("Sus subproveedores también salen de este evento.")}` : ""}`,
        onConfirm: async () => {
          setConfirmDialog(null);
          try {
            const quedan = quitarEvento(p.eventIds, eventoId);
            if (quedan) await guardarEventos(p.id, quedan);
            // Sus subproveedores salen con él; uno que era sólo de este
            // evento pasa a los que le quedan al padre.
            for (const sub of subs) {
              const delSub = quitarEvento(sub.eventIds, eventoId, quedan ?? []);
              if (delSub) await guardarEventos(sub.id, delSub);
            }
            await loadProviders();
          } catch (e) {
            alert(e instanceof Error ? e.message : t("No se pudo quitar del evento"));
          }
        },
      });
      return;
    }
    setConfirmDialog({
      message: `${t("¿Eliminar proveedor")} "${p.name}"? ${t("Esta acción no se puede deshacer.")}`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiFetch(`/providers/${p.id}`, { method: "DELETE" });
          await loadProviders();
        } catch (e) {
          alert(e instanceof Error ? e.message : t("Error al eliminar"));
        }
      },
    });
  };

  const handleProviderClick = (p: Provider) => {
    setProviderFilter(p.id);
    setActiveTab("participantes");
  };

  // ── Traer de otro evento ─────────────────────────────────────────────────
  // BVAN trabaja en los Juegos Escolares y en World Rugby: se agrega el
  // evento al mismo proveedor y sus conductores vienen con él, sin duplicarlos.
  const abrirTraer = () => {
    setTraerBusqueda("");
    setPersonasTodas(null);
    setTraerAbierto(true);
    apiFetch<Participant[]>("/provider-participants")
      .then(d => setPersonasTodas(Array.isArray(d) ? d : []))
      .catch(() => setPersonasTodas("error"));
  };

  const paraTraer = useMemo(() => {
    const q = traerBusqueda.trim().toLowerCase();
    return proveedoresParaTraer(providers, eventoId).filter(({ proveedor, subproveedores }) => {
      if (!q) return true;
      return [proveedor, ...subproveedores].some(p =>
        p.name.toLowerCase().includes(q) ||
        (p.rut ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q));
    });
  }, [providers, eventoId, traerBusqueda]);

  /** Personas y conductores de cada proveedor, para decir qué se trae. */
  const personasPorProveedor = useMemo(() => {
    const cuenta = new Map<string, { personas: number; conductores: number }>();
    (Array.isArray(personasTodas) ? personasTodas : []).forEach(pa => {
      const c = cuenta.get(pa.providerId) ?? { personas: 0, conductores: 0 };
      c.personas += 1;
      if (ES_CONDUCTOR(pa)) c.conductores += 1;
      cuenta.set(pa.providerId, c);
    });
    return cuenta;
  }, [personasTodas]);

  const traerAlEvento = async (proveedor: Provider, subproveedores: Provider[]) => {
    if (!eventoId || trayendoId) return;
    setTrayendoId(proveedor.id);
    try {
      const nuevos = agregarEvento(proveedor.eventIds, eventoId);
      if (nuevos) await guardarEventos(proveedor.id, nuevos);
      for (const sub of subproveedores) {
        const delSub = agregarEvento(sub.eventIds, eventoId);
        if (delSub) await guardarEventos(sub.id, delSub);
      }
      await loadProviders();
      setMailToast({ ok: true, msg: `${proveedor.name} ${t("quedó en")} ${evento?.name ?? t("este evento")}` });
    } catch (e) {
      setMailToast({ ok: false, msg: e instanceof Error ? e.message : t("No se pudo agregar al evento") });
    } finally {
      setTrayendoId(null);
    }
  };

  // ── Participant logic ────────────────────────────────────────────────────
  const selectedProviderForParticipant = useMemo(() => {
    return providers.find(p => p.id === participantForm.providerId) ?? null;
  }, [providers, participantForm.providerId]);

  const isTransporteParticipant = selectedProviderForParticipant?.type === "TRANSPORTE";

  /**
   * Participantes de un proveedor, para descargar su nómina sin salir de la
   * pestaña de proveedores. Acá la lista de participantes no está cargada:
   * sólo se pide la de ese proveedor, no la del evento entero.
   */
  const conductoresDe = async (providerId: string): Promise<Participant[]> => {
    if (providerFilter === providerId && participants.length > 0) {
      return participants.filter(ES_CONDUCTOR);
    }
    try {
      const lista = await apiFetch<Participant[]>(
        `/provider-participants?providerId=${encodeURIComponent(providerId)}`,
      );
      return (lista || []).filter(ES_CONDUCTOR);
    } catch {
      return [];
    }
  };

  // Sólo las personas de proveedores del evento activo: los conductores de
  // los Juegos Escolares no son de World Rugby (salvo que su proveedor esté
  // en los dos). Filtros, contadores, fotos y descargas parten de aquí.
  const participantesEvento = useMemo(
    () => participantesDelEvento(participants, providers, eventoId),
    [participants, providers, eventoId],
  );

  /**
   * Proveedores que ofrece el formulario de participante: los del evento, y
   * el que ya tiene si se está editando a alguien de otro.
   */
  const opcionesProveedorForm = useMemo(() => {
    const actual = providers.find(p => p.id === participantForm.providerId);
    return actual && !proveedoresEvento.some(p => p.id === actual.id)
      ? [...proveedoresEvento, actual]
      : proveedoresEvento;
  }, [providers, proveedoresEvento, participantForm.providerId]);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    return participantesEvento.filter(p => {
      if (q && !p.fullName.toLowerCase().includes(q) &&
          !(p.rut ?? "").toLowerCase().includes(q) &&
          !(p.email ?? "").toLowerCase().includes(q)) return false;
      if (!cumpleFiltroTipo(p, participantTipo)) return false;
      if (participantDocs) {
        const tipoProveedor = providers.find(pr => pr.id === p.providerId)?.type;
        if (!cumpleFiltroDocumentacion(documentacionDe(p, tipoProveedor).estado, participantDocs)) return false;
      }
      return true;
    });
  }, [participantesEvento, participantSearch, participantTipo, participantDocs, providers]);

  /** Quitadas de este evento (su proveedor sigue en él): se pueden devolver. */
  const quitadosEvento = useMemo(
    () => quitadosDelEvento(participants, providers, eventoId),
    [participants, providers, eventoId],
  );

  // Otro evento, otro proveedor u otra pestaña: no queda nadie elegido que ya
  // no se ve.
  useEffect(() => {
    setSeleccion(new Set());
    setVerQuitados(false);
  }, [eventoId, providerFilter, activeTab]);

  /** Lo elegido que está a la vista (un filtro nuevo no arrastra ocultos). */
  const seleccionados = useMemo(
    () => filteredParticipants.filter(p => seleccion.has(p.id)),
    [filteredParticipants, seleccion],
  );
  const todosElegidos = filteredParticipants.length > 0 && seleccionados.length === filteredParticipants.length;

  const alternarSeleccion = (id: string) =>
    setSeleccion(prev => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  const alternarTodos = () =>
    setSeleccion(todosElegidos ? new Set() : new Set(filteredParticipants.map(p => p.id)));

  const cambiarEventoPersonas = async (personas: Participant[], ruta: "quitar-del-evento" | "devolver-al-evento") => {
    if (!eventoId || personas.length === 0) return;
    setProcesandoLote(true);
    try {
      const r = await apiFetch<{ cambiados: number; omitidos: Array<{ nombre: string; motivo: string }> }>(
        `/provider-participants/${ruta}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: personas.map(p => p.id), eventId: eventoId }),
        },
      );
      const hecho = ruta === "quitar-del-evento" ? t("quitadas de") : t("de vuelta en");
      const omitidos = r.omitidos?.length
        ? ` · ${r.omitidos.length} ${t("sin cambio")}: ${r.omitidos.slice(0, 3).map(o => `${o.nombre} (${o.motivo})`).join(", ")}`
        : "";
      setMailToast({
        ok: (r.omitidos?.length ?? 0) === 0,
        msg: `${r.cambiados} ${r.cambiados === 1 ? t("persona") : t("personas")} ${hecho} ${evento?.name ?? t("este evento")}${omitidos}`,
      });
      setSeleccion(new Set());
      await loadParticipants();
    } catch (e) {
      setMailToast({ ok: false, msg: e instanceof Error ? e.message : t("No se pudo cambiar el evento") });
    } finally {
      setProcesandoLote(false);
    }
  };

  const eliminarPersonas = async (personas: Participant[]) => {
    setProcesandoLote(true);
    const fallidos: string[] = [];
    try {
      for (const p of personas) {
        try {
          await apiFetch(`/provider-participants/${p.id}`, { method: "DELETE" });
        } catch {
          fallidos.push(p.fullName);
        }
      }
      const hechos = personas.length - fallidos.length;
      setMailToast({
        ok: fallidos.length === 0,
        msg: `${hechos} ${hechos === 1 ? t("persona eliminada") : t("personas eliminadas")}${fallidos.length ? ` · ${t("no se pudo con")} ${fallidos.slice(0, 3).join(", ")}` : ""}`,
      });
      setSeleccion(new Set());
      await loadParticipants();
    } finally {
      setProcesandoLote(false);
    }
  };

  const nombreEvento = evento?.name ?? t("este evento");

  /** "Quitar de este evento" en lote: sólo quienes siguen en otro evento. */
  const quitarSeleccionados = () => {
    const { quitables, soloDeEste, otros } = repartirSeleccion(seleccionados, providers, eventoId);
    if (quitables.length === 0) return;
    const enOtros = nombresDeEventos(otros, eventos).join(", ") || t("su otro evento");
    setConfirmDialog({
      title: t("Quitar de este evento"),
      confirmLabel: `${t("Quitar")} ${quitables.length}`,
      danger: false,
      message: `${quitables.length} ${quitables.length === 1 ? t("persona deja") : t("personas dejan")} ${t("de verse en")} ${nombreEvento}. ${t("No se eliminan: siguen en")} ${enOtros} ${t("con sus viajes y su código de app.")}${soloDeEste.length > 0 ? ` ${soloDeEste.length} ${t("de la selección son sólo de este evento y quedan igual: para sacarlas hay que eliminarlas.")}` : ""}`,
      onConfirm: () => {
        setConfirmDialog(null);
        void cambiarEventoPersonas(quitables, "quitar-del-evento");
      },
    });
  };

  /** Eliminar en lote: las borra de todos los eventos; se avisa quién estaba en otro. */
  const eliminarSeleccionados = () => {
    if (seleccionados.length === 0) return;
    const { quitables, otros } = repartirSeleccion(seleccionados, providers, eventoId);
    const enOtros = nombresDeEventos(otros, eventos).join(", ") || t("otro evento");
    setConfirmDialog({
      title: t("Eliminar personas"),
      confirmLabel: `${t("Eliminar")} ${seleccionados.length}`,
      message: `${t("Se eliminan")} ${seleccionados.length} ${seleccionados.length === 1 ? t("persona") : t("personas")} ${t("de todos los eventos, con su código de app. No se puede deshacer.")}${quitables.length > 0 ? ` ${quitables.length} ${t("también trabajan en")} ${enOtros}: ${t("para sacarlas sólo de aquí usa «Quitar de este evento».")}` : ""}`,
      onConfirm: () => {
        setConfirmDialog(null);
        void eliminarPersonas(seleccionados);
      },
    });
  };

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
      allowedClientTypes: Array.isArray(p.metadata?.allowedClientTypes) && (p.metadata!.allowedClientTypes as string[]).length > 0
        ? (p.metadata!.allowedClientTypes as string[]).map(String)
        : ["TA"],
      vehicleMarca: (p.metadata?.vehicleMarca as string) ?? "",
      vehicleModelo: (p.metadata?.vehicleModelo as string) ?? "",
      vehicleAno: (p.metadata?.vehicleAno as string) ?? "",
      vehiclePatente: (p.metadata?.vehiclePatente as string) ?? "",
      vehicleTipo: (p.metadata?.vehicleTipo as string) ?? "",
      vehicleCapacidad: capacidadDeMetadata(p.metadata),
      photoDataUrl: (p.metadata?.photoUrl as string) ?? "",
    });
    setParticipantDocFiles({});
    setParticipantError(null);
    setPlateError(null);
    setParticipantModal({ editing: p });
  };

  const saveParticipant = async () => {
    if (!participantForm.fullName.trim()) { setParticipantError(t("El nombre completo es requerido.")); return; }
    if (!participantForm.providerId) { setParticipantError(t("Debe seleccionar un proveedor.")); return; }
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
            allowedClientTypes: participantForm.allowedClientTypes.length > 0 ? participantForm.allowedClientTypes : ["TA"],
            vehicleMarca: participantForm.vehicleMarca || null,
            vehicleModelo: participantForm.vehicleModelo || null,
            vehicleAno: participantForm.vehicleAno || null,
            vehiclePatente: participantForm.vehiclePatente || null,
            vehicleTipo: participantForm.vehicleTipo || null,
            vehicleCapacity: participantForm.vehicleCapacidad
              ? Number(participantForm.vehicleCapacidad)
              : null,
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
      setParticipantError(e instanceof Error ? e.message : t("Error al guardar"));
    } finally {
      setSavingParticipant(false);
    }
  };

  // Reactiva una cuenta dada de baja desde el portal por el propio usuario.
  const reactivateParticipant = async (p: Participant) => {
    try {
      await apiFetch(`/provider-participants/${p.id}/reactivate`, { method: "POST" });
      await loadParticipants();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("Error al reactivar"));
    }
  };

  const removeParticipant = (p: Participant) => {
    // Si además trabaja en otro evento de su proveedor, la papelera sólo la
    // saca de éste: borrarla se la llevaba también del otro, con sus viajes.
    const eventosProv = providers.find(pr => pr.id === p.providerId)?.eventIds;
    if (accionAlQuitarPersona(eventosProv, p.metadata, eventoId) === "QUITAR_DEL_EVENTO") {
      const { otros } = repartirSeleccion([p], providers, eventoId);
      setConfirmDialog({
        title: t("Quitar de este evento"),
        confirmLabel: t("Quitar de este evento"),
        danger: false,
        message: `"${p.fullName}" ${t("deja de verse en")} ${nombreEvento}. ${t("No se elimina: sigue en")} ${nombresDeEventos(otros, eventos).join(", ") || t("su otro evento")} ${t("con sus viajes y su código de app.")}`,
        onConfirm: () => {
          setConfirmDialog(null);
          void cambiarEventoPersonas([p], "quitar-del-evento");
        },
      });
      return;
    }
    setConfirmDialog({
      message: `${t("¿Eliminar participante")} "${p.fullName}"? ${t("Esta acción no se puede deshacer.")}`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiFetch(`/provider-participants/${p.id}`, { method: "DELETE" });
          await loadParticipants();
        } catch (e) {
          alert(e instanceof Error ? e.message : t("Error al eliminar"));
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
        title={confirmDialog?.title ?? t("Confirmar eliminación")}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? t("Eliminar")}
        cancelLabel={t("Cancelar")}
        danger={confirmDialog?.danger ?? true}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* Header */}
      <section
        className="surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderTop: `2px solid ${BRAND.teal}`, boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}
      >
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>{t("Registro")}</p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.1 }}>{t("Proveedores")}</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            {t("Gestión de proveedores y sus participantes")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Un proveedor que ya trabaja en otro evento se trae, no se vuelve a crear. */}
          {activeTab === "proveedores" && eventoId && (
            <button
              className="btn btn-ghost"
              onClick={abrirTraer}
              title={t("Agregar a este evento un proveedor de otro evento, con sus participantes y conductores")}
            >
              {t("Traer de otro evento")}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={activeTab === "proveedores" ? openAddProvider : openAddParticipant}
          >
            {activeTab === "proveedores" ? t("+ Nuevo proveedor") : t("+ Nuevo participante")}
          </button>
        </div>
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
              borderBottom: activeTab === tab ? `2px solid ${BRAND.teal}` : "2px solid transparent",
              color: activeTab === tab ? BRAND.teal : "var(--text-muted)",
              cursor: "pointer",
              marginBottom: "-2px",
              textTransform: "capitalize",
              letterSpacing: "0.03em",
              transition: "color 0.15s",
            }}
          >
            {tab === "proveedores" ? t("Proveedores") : t("Participantes")}
          </button>
        ))}
      </div>

      {/* ── TAB: PROVEEDORES ─────────────────────────────────────────────── */}
      {activeTab === "proveedores" && (
        <>
          {/* Stats bar */}
          {!loadingProviders && proveedoresEvento.length > 0 && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div className="surface rounded-2xl px-5 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)", minWidth: "130px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(33,208,179,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BuildingIcon size={18} color={BRAND.teal} strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{proveedoresEvento.length}</p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{t("Proveedores")}</p>
                </div>
              </div>
              {Object.entries(tiposEvento)
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
                        <span style={{ fontSize: "14px", fontWeight: 800, color: entry?.color ?? BRAND.teal }}>{count}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{t(entry?.label ?? type)}</p>
                        <p style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "1px" }}>{count !== 1 ? t("proveedores") : t("proveedor")}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Filters */}
          <section className="surface rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
              <SearchIcon size={14} color="var(--text-faint)" strokeWidth={2} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                className="input"
                style={{ paddingLeft: "32px" }}
                placeholder={t("Buscar por nombre, email o RUT…")}
                value={providerSearch}
                onChange={e => setProviderSearch(e.target.value)}
              />
            </div>
            {/* Sólo los tipos que tienen proveedores en este evento, con cuántos. */}
            <StyledSelect wrapperStyle={FILTRO_ANCHO(200)} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">{t("Todos los tipos")}</option>
              {Object.entries(PROVIDER_TYPES)
                .filter(([key]) => tiposEvento[key] || key === filterType)
                .map(([key, { label }]) => (
                  <option key={key} value={key}>{`${t(label)} (${tiposEvento[key] ?? 0})`}</option>
                ))}
            </StyledSelect>
            <span style={{ fontSize: "12px", color: "var(--text-faint)", whiteSpace: "nowrap" }}>
              {filteredProviders.length} {t("de")} {proveedoresEvento.length}
            </span>
          </section>

          {loadingProviders ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-faint)" }}>
              {t("Cargando proveedores…")}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="surface rounded-2xl p-10 text-center" style={{ color: "var(--text-faint)" }}>
              <BuildingIcon size={40} strokeWidth={1.5} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: "14px", fontWeight: 600 }}>
                {proveedoresEvento.length === 0
                  ? (eventoId ? t("No hay proveedores en este evento") : t("No hay proveedores registrados"))
                  : t("Sin resultados")}
              </p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                {proveedoresEvento.length === 0
                  ? (eventoId && providers.length > 0 ? t("Agrega uno nuevo o tráelo de otro evento.") : t("Agrega un proveedor para comenzar."))
                  : t("Ajusta los filtros de búsqueda.")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupKeys.map(key => {
                const items = groupedProviders[key];
                const typeEntry = PROVIDER_TYPES[key];
                const typeLabel = key === "__none__" ? t("Sin tipo asignado") : t(typeEntry?.label ?? key);
                const typeColor = key === "__none__" ? SURFACE.textFaint : (typeEntry?.color ?? BRAND.teal);
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
                                  title={`${t("Ver participantes de")} ${p.name}`}
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

                                {/* Trabaja además en otro evento: por eso la papelera sólo lo saca de éste. */}
                                {(() => {
                                  if (!eventoId) return null;
                                  const otros = nombresDeEventos(otrosEventos(p.eventIds, eventoId), eventos);
                                  if (otros.length === 0) return null;
                                  return (
                                    <p
                                      title={`${t("También en:")} ${otros.join(" · ")}`}
                                      style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                    >
                                      {t("También en:")} {otros.map(n => recortar(n)).join(", ")}
                                    </p>
                                  );
                                })()}

                                {(p.email || p.rut) && (
                                  <div style={{ marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                    {p.email && (
                                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                                        <FolderIcon size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
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
                                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(31,205,255,0.1)"; el.style.color = BRAND.blue; }}
                                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "none"; el.style.color = "var(--text-faint)"; }}
                                  title={t("Editar")}
                                >
                                  <PencilIcon size={14} strokeWidth={2} />
                                </button>
                                <button
                                  onClick={() => removeProvider(p)}
                                  style={{ padding: "5px", borderRadius: "7px", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", transition: "all 0.15s" }}
                                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(244,63,94,0.1)"; el.style.color = STATE.danger; }}
                                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "none"; el.style.color = "var(--text-faint)"; }}
                                  title={accionAlQuitar(p.eventIds, eventoId) === "QUITAR_DEL_EVENTO" ? t("Quitar de este evento") : t("Eliminar")}
                                >
                                  <TrashIcon size={14} strokeWidth={2} />
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
                                <span style={{ fontSize: "11px", fontWeight: 600, color: typeColor }}>{t("Participantes")}</span>
                              </button>
                              {/* Descarga de la nómina de ese proveedor, sin
                                  tener que entrar a sus participantes y filtrar.
                                  Sólo aparece si tiene conductores cargados. */}
                              <button
                                onClick={async () => {
                                  const lista = await conductoresDe(p.id);
                                  if (lista.length === 0) {
                                    alert(t("Este proveedor no tiene conductores cargados."));
                                    return;
                                  }
                                  descargarConductores(lista, providers, p);
                                }}
                                style={{ padding: "8px 14px", background: typeBg, border: "none", borderLeft: `1px solid ${typeColor}20`, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "background 0.15s" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}18`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = typeBg; }}
                                title={`${t("Descargar conductores de")} ${p.name}`}
                              >
                                <DownloadIcon size={12} color={typeColor} strokeWidth={2} />
                                <span style={{ fontSize: "10px", fontWeight: 600, color: typeColor }}>{t("Conductores")}</span>
                              </button>
                              {!p.parentProviderId && (
                                <button
                                  onClick={() => setProviderModal({ editing: null, parentId: p.id })}
                                  style={{ padding: "8px 14px", background: typeBg, border: "none", borderLeft: `1px solid ${typeColor}20`, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "background 0.15s" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${typeColor}18`; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = typeBg; }}
                                  title={t("Crear subproveedor")}
                                >
                                  <PlusIcon size={12} color={typeColor} strokeWidth={2} />
                                  <span style={{ fontSize: "10px", fontWeight: 600, color: typeColor }}>{t("Sub")}</span>
                                </button>
                              )}
                            </div>

                            {/* Sub-providers */}
                            {(() => {
                              const subs = proveedoresEvento.filter(sp => sp.parentProviderId === p.id);
                              if (subs.length === 0) return null;
                              return (
                                <div style={{ padding: "8px 16px 12px", borderTop: `1px solid ${typeColor}15`, background: `${typeColor}05` }}>
                                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: typeColor, margin: "0 0 6px" }}>{t("Subproveedores")} ({subs.length})</p>
                                  {subs.map(sub => (
                                    <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: SURFACE.card, border: `1px solid ${SURFACE.borderMuted}`, marginBottom: 3 }}>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: SURFACE.text }}>{sub.name}</span>
                                      <div style={{ display: "flex", gap: 4 }}>
                                        <button onClick={() => openEditProvider(sub)} style={{ padding: 3, borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: SURFACE.textFaint }} title={t("Editar")}>
                                          <PencilIcon size={11} strokeWidth={2} />
                                        </button>
                                        <button onClick={() => removeProvider(sub)} style={{ padding: 3, borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: SURFACE.textFaint }} title={accionAlQuitar(sub.eventIds, eventoId) === "QUITAR_DEL_EVENTO" ? t("Quitar de este evento") : t("Eliminar")}>
                                          <TrashIcon size={11} strokeWidth={2} />
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
              placeholder={t("Buscar por nombre, RUT o email…")}
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
            />
            {/* Filtros con el selector del panel (StyledSelect), nunca el
                <select> nativo: Ariel lo pidió expresamente el 24-09-2026. */}
            <StyledSelect wrapperStyle={FILTRO_ANCHO(240)} value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
              <option value="">{t("Todos los proveedores")}</option>
              {proveedoresEvento.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </StyledSelect>
            {/* Quién es conductor y quién no ha subido documentos: la misma
                pregunta que responde el módulo Documentos, aquí en la nómina. */}
            <StyledSelect wrapperStyle={FILTRO_ANCHO(180)} value={participantTipo} onChange={e => setParticipantTipo(e.target.value as FiltroTipoPersona)}>
              <option value="">{t("Tipo: todos")}</option>
              <option value="CONDUCTOR">{t("Conductores")}</option>
              <option value="OTRO">{t("Otros participantes")}</option>
            </StyledSelect>
            <StyledSelect wrapperStyle={FILTRO_ANCHO(220)} value={participantDocs} onChange={e => setParticipantDocs(e.target.value as FiltroDocumentacion)}>
              {OPCIONES_FILTRO_DOCUMENTACION.map(o => (
                <option key={o.value} value={o.value}>{o.value ? t(o.label) : t("Documentos: todos")}</option>
              ))}
            </StyledSelect>
            {activeFilterProvider && (
              <button
                onClick={() => setProviderFilter("")}
                style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "99px",
                  background: "rgba(33,208,179,0.1)", border: "1px solid rgba(33,208,179,0.3)",
                  color: BRAND.teal, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {activeFilterProvider.name} <XIcon size={11} className="inline ml-1" />
              </button>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>
              {filteredParticipants.length} {filteredParticipants.length !== 1 ? t("resultados") : t("resultado")}
            </span>
            {/* Baja exactamente lo que se está viendo: con "Todos los
                proveedores" es la nómina completa, y con uno elegido es la de
                ese proveedor. Un solo botón para las dos preguntas. */}
            {(() => {
              const conductoresALaVista = filteredParticipants.filter(ES_CONDUCTOR);
              if (conductoresALaVista.length === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() =>
                    descargarConductores(conductoresALaVista, providers, activeFilterProvider ?? null)
                  }
                  title={t("Descarga nombre, contacto, vehículo, código de app y proveedor de cada conductor")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "99px",
                    background: SURFACE.card, border: `1px solid ${SURFACE.border}`,
                    color: SURFACE.textSecondary, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  <DownloadIcon size={13} strokeWidth={2} />
                  {t("Descargar conductores")} ({conductoresALaVista.length})
                </button>
              );
            })()}
          </section>

          {/* Bulk photo upload */}
          <section className="surface" style={{ borderRadius: "14px", padding: "14px 18px", borderTop: `2px solid ${ACCENT.violetLight}`, boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT.violetLight, marginBottom: "4px" }}>
                  {t("Carga masiva de fotos")}
                </p>
                <p style={{ fontSize: "12px", color: SURFACE.textMuted, margin: 0 }}>
                  {t("El nombre del archivo debe coincidir con el nombre completo del participante.")}
                </p>
              </div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "12px",
                background: `linear-gradient(135deg, ${ACCENT.violetLight}, ${ACCENT.violet})`, color: SURFACE.card, fontSize: "12px", fontWeight: 700,
                cursor: "pointer", boxShadow: "0 2px 10px rgba(167,139,250,0.35)",
              }}>
                <UploadIcon size={14} strokeWidth={2.5} />
                {t("Seleccionar fotos")}
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  let matched = 0, notFound = 0;
                  const notFoundNames: string[] = [];
                  for (const file of files) {
                    const baseName = file.name.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/[._-]/g, " ");
                    // Sólo entre las personas del evento: un homónimo de otro
                    // evento no debe recibir la foto.
                    const participant = participantesEvento.find(p => (p.fullName || "").toLowerCase() === baseName);
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
              <div style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: bulkPhotoResult.matched > 0 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  {bulkPhotoResult.matched > 0 ? (
                    <CheckIcon size={24} color={STATE.success} strokeWidth={2.5} />
                  ) : (
                    <AlertCircleIcon size={24} color={STATE.warning} strokeWidth={2} />
                  )}
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px" }}>{bulkPhotoResult.matched > 0 ? t("Carga completada") : t("Sin coincidencias")}</h3>
                <div style={{ display: "flex", justifyContent: "center", gap: "16px", margin: "12px 0 16px" }}>
                  <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p style={{ fontSize: "20px", fontWeight: 800, color: STATE.success, margin: 0 }}>{bulkPhotoResult.matched}</p>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#065f46", margin: 0 }}>{t("Exitosas")}</p>
                  </div>
                  <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p style={{ fontSize: "20px", fontWeight: 800, color: STATE.danger, margin: 0 }}>{bulkPhotoResult.notFound}</p>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: STATE.dangerText, margin: 0 }}>{t("Sin match")}</p>
                  </div>
                </div>
                {bulkPhotoResult.names.length > 0 && (
                  <div style={{ textAlign: "left", background: SURFACE.bg, borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", maxHeight: "120px", overflowY: "auto" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>{t("Archivos sin coincidencia")}</p>
                    {bulkPhotoResult.names.slice(0, 10).map(name => (
                      <p key={name} style={{ fontSize: "12px", color: SURFACE.textMuted, margin: "2px 0" }}>{name}</p>
                    ))}
                    {bulkPhotoResult.names.length > 10 && <p style={{ fontSize: "11px", color: SURFACE.textFaint, margin: "4px 0 0" }}>+{bulkPhotoResult.names.length - 10} {t("más...")}</p>}
                  </div>
                )}
                <button onClick={() => setBulkPhotoResult(null)}
                  style={{ padding: "10px 32px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.3)" }}>
                  {t("Entendido")}
                </button>
              </div>
            </div>
          )}

          {/* Sin la lista de proveedores no se sabe de qué evento es cada persona:
              se espera en vez de mostrar los dos eventos mezclados un momento. */}
          {loadingParticipants || (loadingProviders && providers.length === 0) ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-faint)" }}>
              {t("Cargando participantes…")}
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="surface rounded-2xl p-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              {participantesEvento.length === 0
                ? t("No hay participantes registrados para este proveedor.")
                : t("Sin resultados para el filtro actual.")}
            </div>
          ) : (
            <div className="surface rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              {/* Selección masiva: elegir a varios y quitarlos de este evento
                  (siguen en el otro) o eliminarlos. Las acciones van en una
                  barra fija abajo para no volver arriba en una lista larga. */}
              <div
                className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-2.5"
                style={{ borderBottom: "1px solid var(--border)", background: seleccionados.length > 0 ? "rgba(33,208,179,0.06)" : SURFACE.bg }}
              >
                <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={todosElegidos}
                    ref={el => { if (el) el.indeterminate = seleccionados.length > 0 && !todosElegidos; }}
                    onChange={alternarTodos}
                    style={{ width: 16, height: 16, accentColor: BRAND.teal, cursor: "pointer" }}
                  />
                  {seleccionados.length > 0
                    ? `${seleccionados.length} ${seleccionados.length === 1 ? t("elegida") : t("elegidas")}`
                    : `${t("Elegir todas")} (${filteredParticipants.length})`}
                </label>
              </div>
              {filteredParticipants.map((p, i) => {
                const provider = providers.find(pr => pr.id === p.providerId);
                const isTransporte = provider?.type === "TRANSPORTE";
                const docCount = isTransporte ? countUploadedDocs(p.metadata) : -1;
                // En teléfono los chips y las acciones bajan a una segunda línea:
                // con todo en una fila el nombre quedaba en un par de letras.
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 md:gap-4 px-4 md:px-5 py-3"
                    style={{
                      borderBottom: i < filteredParticipants.length - 1 ? "1px solid var(--border)" : "none",
                      background: seleccion.has(p.id) ? "rgba(33,208,179,0.05)" : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={seleccion.has(p.id)}
                      onChange={() => alternarSeleccion(p.id)}
                      aria-label={`${t("Elegir")} ${p.fullName}`}
                      style={{ width: 16, height: 16, accentColor: BRAND.teal, cursor: "pointer", flexShrink: 0 }}
                    />
                    {/* Photo */}
                    {(() => {
                      const photo = (p.metadata as any)?.photoUrl;
                      return photo && typeof photo === "string" && photo.startsWith("http") ? (
                        <img src={photo} alt="" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`2px solid ${BRAND.teal}` }} />
                      ) : (
                        <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:"rgba(33,208,179,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:BRAND.teal }}>
                          {(p.fullName || "?").split(" ").slice(0,2).map(w => w[0] ?? "").join("").toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="min-w-0" style={{ flex: "1 1 180px" }}>
                      <span className="block truncate" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{p.fullName}</span>
                      <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                        {provider && (
                          <span style={{ fontSize: "11px", color: BRAND.teal, fontWeight: 500 }}>{provider.name}</span>
                        )}
                        {p.userType && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.userType}</span>
                        )}
                        {p.countryCode && (
                          <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>{p.countryCode}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void copyAccessCode(p.id); }}
                          title={t("Código de acceso a la app — clic para copiar")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            color: copiedId === p.id ? STATE.success : BRAND.teal,
                            background: "rgba(33,208,179,0.08)",
                            border: "1px solid rgba(33,208,179,0.25)",
                            borderRadius: "6px",
                            padding: "1px 7px",
                            cursor: "pointer",
                            lineHeight: "16px",
                          }}
                        >
                          {/* El código iba sin etiqueta y se leía como un id
                              cualquiera: nadie lo reconocía como la clave de
                              acceso a la app. */}
                          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", opacity: 0.75 }}>
                            {t("CÓDIGO APP")}
                          </span>
                          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px" }}>
                            {copiedId === p.id ? t("copiado") : accessCode(p.id)}
                          </span>
                        </button>
                      </div>
                    </div>

                    {p.tripType && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                        background: p.tripType === "ARRIVAL" ? "rgba(31,205,255,0.1)" : p.tripType === "DEPARTURE" ? "rgba(168,85,247,0.1)" : "rgba(33,208,179,0.1)",
                        border: `1px solid ${p.tripType === "ARRIVAL" ? "rgba(31,205,255,0.3)" : p.tripType === "DEPARTURE" ? "rgba(168,85,247,0.3)" : "rgba(33,208,179,0.3)"}`,
                        color: p.tripType === "ARRIVAL" ? BRAND.blue : p.tripType === "DEPARTURE" ? "#a855f7" : BRAND.teal,
                        flexShrink: 0,
                      }}>
                        {t(TRIP_TYPE_LABELS[p.tripType] ?? p.tripType)}
                      </span>
                    )}

                    {docCount >= 0 && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                        padding: "2px 8px", borderRadius: "99px",
                        background: docCount === ALL_TRANSPORT_DOCS.length ? "rgba(16,185,129,0.1)" : "rgba(33,208,179,0.08)",
                        border: `1px solid ${docCount === ALL_TRANSPORT_DOCS.length ? "rgba(16,185,129,0.3)" : "rgba(33,208,179,0.25)"}`,
                        color: docCount === ALL_TRANSPORT_DOCS.length ? STATE.success : BRAND.teal,
                        flexShrink: 0,
                      }}>
                        {docCount}/{ALL_TRANSPORT_DOCS.length} {t("docs")}
                      </span>
                    )}

                    {p.rut && (
                      <span className="hidden md:block" style={{ fontSize: "12px", color: "var(--text-faint)" }}>{p.rut}</span>
                    )}

                    {(p.status ?? "").toUpperCase() === "DELETED" && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 8px",
                        borderRadius: "99px", background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)", color: STATE.dangerText, flexShrink: 0,
                      }}>
                        {t("ELIMINADA")}
                      </span>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(p.status ?? "").toUpperCase() === "DELETED" && (
                        <button
                          onClick={() => void reactivateParticipant(p)}
                          className="transition-colors p-1.5"
                          style={{ color: "var(--text-faint)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = STATE.success; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                          title={t("Reactivar cuenta")}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-4M20 14a8 8 0 01-14 4" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => void sendAccessEmail(p)}
                        disabled={!p.email || sendingMailId === p.id}
                        className="transition-colors p-1.5"
                        style={{ color: "var(--text-faint)", opacity: !p.email || sendingMailId === p.id ? 0.4 : 1, cursor: !p.email ? "not-allowed" : "pointer" }}
                        onMouseEnter={e => { if (p.email) (e.currentTarget as HTMLElement).style.color = BRAND.teal; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                        title={p.email ? t("Enviar código de acceso por correo") : t("Sin correo registrado")}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditParticipant(p)}
                        className="transition-colors p-1.5"
                        style={{ color: "var(--text-faint)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BRAND.blue; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                        title={t("Editar")}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeParticipant(p)}
                        className="transition-colors p-1.5"
                        style={{ color: "var(--text-faint)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = STATE.danger; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                        title={t("Eliminar")}
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

          {/* Quitadas de este evento: no se borraron, siguen en el otro evento
              de su proveedor. Desde aquí se devuelven. */}
          {!loadingParticipants && quitadosEvento.length > 0 && (
            <section className="surface rounded-2xl" style={{ padding: "12px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {quitadosEvento.length} {quitadosEvento.length === 1 ? t("persona quitada de") : t("personas quitadas de")} {nombreEvento}
                </span>
                <button type="button" onClick={() => setVerQuitados(v => !v)}
                  style={{ fontSize: "12px", fontWeight: 600, color: BRAND.teal, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {verQuitados ? t("Ocultar") : t("Ver")}
                </button>
                {verQuitados && quitadosEvento.length > 1 && (
                  <button type="button" disabled={procesandoLote}
                    onClick={() => void cambiarEventoPersonas(quitadosEvento, "devolver-al-evento")}
                    style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "10px", border: `1px solid ${BRAND.teal}`, background: "rgba(33,208,179,0.1)", color: BRAND.teal, cursor: "pointer" }}>
                    {t("Devolver todas")}
                  </button>
                )}
              </div>
              {verQuitados && (
                <div style={{ marginTop: 8 }}>
                  {quitadosEvento.map(p => (
                    <div key={p.id} className="flex items-center gap-3" style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                      <span className="truncate" style={{ fontSize: "13px", color: "var(--text)", flex: "1 1 auto", minWidth: 0 }}>
                        {p.fullName}
                        <span style={{ fontSize: "11px", color: "var(--text-faint)", marginLeft: 8 }}>
                          {providers.find(pr => pr.id === p.providerId)?.name ?? ""}
                        </span>
                      </span>
                      <button type="button" disabled={procesandoLote}
                        onClick={() => void cambiarEventoPersonas([p], "devolver-al-evento")}
                        style={{ fontSize: "12px", fontWeight: 600, color: BRAND.teal, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {t("Devolver a este evento")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {activeTab === "participantes" && seleccionados.length > 0 && (() => {
        const { quitables } = repartirSeleccion(seleccionados, providers, eventoId);
        const botonLote = (color: string, fondo: string): React.CSSProperties => ({
          fontSize: "12px", fontWeight: 700, padding: "7px 12px", borderRadius: "10px",
          border: `1px solid ${color}`, background: fondo, color,
          cursor: procesandoLote ? "wait" : "pointer", opacity: procesandoLote ? 0.6 : 1, whiteSpace: "nowrap",
        });
        return (
          <div
            role="toolbar"
            aria-label={t("Acciones para las personas elegidas")}
            className="flex flex-wrap items-center justify-center gap-2"
            style={{
              position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "20px", zIndex: 55,
              background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "14px",
              padding: "10px 14px", boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
              maxWidth: "calc(100vw - 32px)",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginRight: 4 }}>
              {procesandoLote ? t("Procesando…") : `${seleccionados.length} ${seleccionados.length === 1 ? t("elegida") : t("elegidas")}`}
            </span>
            {quitables.length > 0 && (
              <button type="button" disabled={procesandoLote} onClick={quitarSeleccionados}
                style={botonLote(BRAND.teal, "rgba(33,208,179,0.1)")}
                title={t("Dejan de verse en este evento y siguen en el otro, con sus viajes")}>
                {t("Quitar de este evento")} ({quitables.length})
              </button>
            )}
            <button type="button" disabled={procesandoLote} onClick={eliminarSeleccionados}
              style={botonLote(STATE.danger, "rgba(239,68,68,0.06)")}
              title={t("Se borran de todos los eventos")}>
              {t("Eliminar")} ({seleccionados.length})
            </button>
            <button type="button" disabled={procesandoLote} onClick={() => setSeleccion(new Set())}
              style={botonLote(SURFACE.textFaint, "transparent")}>
              {t("Cancelar")}
            </button>
          </div>
        );
      })()}

      {/* ── MODAL: PROVEEDOR ─────────────────────────────────────────────── */}
      {mailToast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 60,
          background: mailToast.ok ? "#ecfdf5" : STATE.dangerSoft,
          border: `1px solid ${mailToast.ok ? "#a7f3d0" : "#fecaca"}`,
          color: mailToast.ok ? "#047857" : STATE.dangerText,
          borderRadius: "12px", padding: "12px 18px", fontSize: "13px", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(15,23,42,0.15)", maxWidth: "min(360px, calc(100vw - 48px))",
        }}>
          {mailToast.ok ? <CheckIcon size={12} className="inline mr-1" /> : <XIcon size={12} className="inline mr-1" />}{mailToast.msg}
        </div>
      )}
      {providerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="surface rounded-3xl w-full flex flex-col"
            style={{
              maxWidth: isTransporteProvider ? "820px" : "448px",
              maxHeight: "min(90vh, calc(100dvh - 32px))",
              borderTop: `2px solid ${BRAND.teal}`,
              boxShadow: "0 8px 32px rgba(15,23,42,0.18)",
            }}
          >
            <div className="px-4 md:px-6 pt-5 md:pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>
                {providerModal.editing ? t("Editar") : t("Nuevo")}
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                {providerModal.editing ? t("Editar proveedor") : providerModal.parentId ? `${t("Nuevo subproveedor de")} ${providers.find(pr => pr.id === providerModal.parentId)?.name || ""}` : t("Nuevo proveedor")}
              </h2>
            </div>

            <div className="overflow-y-auto px-4 md:px-6 pb-2 flex-1 space-y-4">
              {/* Logo upload */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {(() => {
                  const logoUrl = providerDocFiles.logo
                    ? URL.createObjectURL(providerDocFiles.logo)
                    : typeof providerModal?.editing?.metadata?.logo === "string" ? (providerModal.editing.metadata.logo as string) : null;
                  return (
                    <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: `2px dashed ${SURFACE.border}`, background: SURFACE.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt={t("Logo")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SURFACE.borderStrong} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      )}
                    </div>
                  );
                })()}
                <div style={{ flex: 1 }}>
                  <DocRow
                    label={t("Logo del proveedor")}
                    docKey="logo"
                    file={providerDocFiles.logo ?? null}
                    url={typeof providerModal?.editing?.metadata?.logo === "string" ? (providerModal.editing.metadata.logo as string) : undefined}
                    onFile={(k, f) => setProviderDocFiles(prev => ({ ...prev, [k]: f }))}
                    disabled={savingProvider}
                  />
                </div>
              </div>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                {t("Nombre *")}
                <input className="input" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} placeholder={t("Nombre del proveedor")} autoFocus />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Tipo")}
                  <select className="input" value={providerForm.type} onChange={e => setProviderForm(f => ({ ...f, type: e.target.value, subtype: "" }))}>
                    <option value="">{t("— Sin tipo —")}</option>
                    {Object.entries(PROVIDER_TYPES).map(([key, { label }]) => (
                      <option key={key} value={key}>{t(label)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Sub-tipo")}
                  <select className="input" value={providerForm.subtype} onChange={e => setProviderForm(f => ({ ...f, subtype: e.target.value }))} disabled={availableSubtypes.length === 0}>
                    <option value="">—</option>
                    {availableSubtypes.map(s => <option key={s} value={s}>{t(s)}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Email")}
                  <input className="input" type="email" value={providerForm.email} onChange={e => setProviderForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@proveedor.com" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("RUT")}
                  <input className="input" value={providerForm.rut} onChange={e => setProviderForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Teléfono")}
                  <input className="input" value={providerForm.phone} onChange={e => setProviderForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Nombre de contacto")}
                  <input className="input" value={providerForm.contactName} onChange={e => setProviderForm(f => ({ ...f, contactName: e.target.value }))} placeholder={t("Nombre del contacto")} />
                </label>
              </div>

              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                {t("Dirección")}
                <input className="input" value={providerForm.address} onChange={e => setProviderForm(f => ({ ...f, address: e.target.value }))} placeholder={t("Dirección del proveedor")} />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Ciudad")}
                  <input className="input" value={providerForm.city} onChange={e => setProviderForm(f => ({ ...f, city: e.target.value }))} placeholder="Santiago" />
                </label>
                <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {t("Tipo de factura")}
                  <select className="input" value={providerForm.invoiceType} onChange={e => setProviderForm(f => ({ ...f, invoiceType: e.target.value }))}>
                    <option value="">{t("— Seleccionar —")}</option>
                    <option value="AFECTO">{t("Afecto")}</option>
                    <option value="EXENTO">{t("Exento")}</option>
                    <option value="MIXTO">{t("Mixto")}</option>
                  </select>
                </label>
              </div>

              {/* Bid amount + trip count for transport, hospitality, food */}
              {(providerForm.type === "TRANSPORTE" || providerForm.type === "HOTELERIA" || providerForm.type === "ALIMENTACION") && (
                <div className={providerForm.type === "TRANSPORTE" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : ""}>
                  <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {t("Monto licitado")}
                    <input className="input" type="text" inputMode="numeric" value={providerForm.bidAmount ? `$${Number(providerForm.bidAmount).toLocaleString("es-CL")}` : ""} onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setProviderForm(f => ({ ...f, bidAmount: raw })); }} placeholder="$0" />
                  </label>
                  {providerForm.type === "TRANSPORTE" && (
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Total viajes licitados")}
                      <input className="input" type="text" inputMode="numeric" value={providerForm.bidTripCount || ""} onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setProviderForm(f => ({ ...f, bidTripCount: raw })); }} placeholder="0" />
                    </label>
                  )}
                </div>
              )}

              {/* Rate table for transport providers */}
              {isTransporteProvider && (
                <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "rgba(33,208,179,0.06)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{t("Tabla de tarifas")}</p>
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
                    }} style={{ fontSize: 11, fontWeight: 600, color: BRAND.teal, background: "none", border: "1px solid rgba(33,208,179,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                      {providerRates.length === 0 ? t("Generar tabla") : t("Regenerar")}
                    </button>
                  </div>

                  {providerRates.length > 0 && (
                    <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: SURFACE.bg, position: "sticky", top: 0, zIndex: 1 }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: SURFACE.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>{t("Flota")}</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: SURFACE.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>{t("Pax")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: SURFACE.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>{t("Tipo servicio")}</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: SURFACE.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>{t("Valor cliente")}</th>
                            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: SURFACE.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)" }}>{t("Valor proveedor")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providerRates.map((rate, idx) => {
                            const fleet = FLEET_TYPES.find((f) => f.value === rate.fleetType);
                            const service = SERVICE_TYPES.find((s) => s.value === rate.tripType);
                            const isFirstOfFleet = idx === 0 || providerRates[idx - 1].fleetType !== rate.fleetType;
                            return (
                              <tr key={`${rate.fleetType}-${rate.tripType}`} style={{ borderBottom: `1px solid ${SURFACE.borderMuted}`, background: isFirstOfFleet ? SURFACE.bg : SURFACE.card }}>
                                <td style={{ padding: "6px 10px", fontWeight: isFirstOfFleet ? 700 : 400, color: SURFACE.text }}>
                                  {isFirstOfFleet ? t(fleet?.label || rate.fleetType) : ""}
                                </td>
                                <td style={{ padding: "6px", textAlign: "center", color: SURFACE.textMuted }}>
                                  {isFirstOfFleet ? (fleet?.passengers || "-") : ""}
                                </td>
                                <td style={{ padding: "6px 10px", color: SURFACE.textStrong }}>{t(service?.label || rate.tripType)}</td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <input type="text" inputMode="numeric" value={Number(rate.clientPrice) ? `$${Number(rate.clientPrice).toLocaleString("es-CL")}` : ""} onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    const next = [...providerRates];
                                    next[idx] = { ...next[idx], clientPrice: Number(raw) || 0 };
                                    setProviderRates(next);
                                  }} placeholder="$0" style={{ width: 95, padding: "4px 6px", borderRadius: 6, border: `1px solid ${SURFACE.border}`, fontSize: 12, textAlign: "right" }} />
                                </td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <input type="text" inputMode="numeric" value={Number(rate.providerPrice) ? `$${Number(rate.providerPrice).toLocaleString("es-CL")}` : ""} onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    const next = [...providerRates];
                                    next[idx] = { ...next[idx], providerPrice: Number(raw) || 0 };
                                    setProviderRates(next);
                                  }} placeholder="$0" style={{ width: 95, padding: "4px 6px", borderRadius: 6, border: `1px solid ${SURFACE.border}`, fontSize: 12, textAlign: "right" }} />
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

              {providerError && <p className="text-sm" style={{ color: STATE.danger }}>{providerError}</p>}
            </div>

            <div className="px-4 md:px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setProviderModal(null)} disabled={savingProvider}>{t("Cancelar")}</button>
              <button className="btn btn-primary" onClick={saveProvider} disabled={savingProvider}>
                {savingProvider ? t("Guardando…") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TRAER DE OTRO EVENTO ──────────────────────────────────── */}
      {traerAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="surface rounded-3xl w-full flex flex-col"
            style={{
              maxWidth: "620px",
              maxHeight: "min(90vh, calc(100dvh - 32px))",
              borderTop: `2px solid ${BRAND.teal}`,
              boxShadow: "0 8px 32px rgba(15,23,42,0.18)",
            }}
          >
            <div className="px-4 md:px-6 pt-5 md:pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {evento?.name ?? t("Evento activo")}
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>{t("Traer de otro evento")}</h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.5 }}>
                {t("El proveedor queda también en este evento, con sus participantes y conductores. No se duplica: lo que se cambie se ve en los dos.")}
              </p>
              <div style={{ position: "relative", marginTop: "12px" }}>
                <SearchIcon size={14} color="var(--text-faint)" strokeWidth={2} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  className="input"
                  style={{ paddingLeft: "32px" }}
                  placeholder={t("Buscar por nombre, email o RUT…")}
                  value={traerBusqueda}
                  onChange={e => setTraerBusqueda(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto px-4 md:px-6 pb-4 flex-1">
              {paraTraer.length === 0 ? (
                <div style={{ padding: "28px 8px", textAlign: "center", color: "var(--text-faint)" }}>
                  <BuildingIcon size={32} strokeWidth={1.5} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                  <p style={{ fontSize: "13px", fontWeight: 600 }}>
                    {traerBusqueda.trim() ? t("Sin resultados") : t("Los proveedores de los otros eventos ya están en éste.")}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {paraTraer.map(({ proveedor, subproveedores }) => {
                    const tipo = proveedor.type ? PROVIDER_TYPES[proveedor.type] : undefined;
                    const color = tipo?.color ?? SURFACE.textFaint;
                    // Se trae con sus subproveedores: se cuentan las personas de todos.
                    const conteo = [proveedor, ...subproveedores].reduce(
                      (acc, p) => {
                        const c = personasPorProveedor.get(p.id);
                        return c ? { personas: acc.personas + c.personas, conductores: acc.conductores + c.conductores } : acc;
                      },
                      { personas: 0, conductores: 0 },
                    );
                    const estaEn = nombresDeEventos(proveedor.eventIds ?? [], eventos);
                    const padre = proveedor.parentProviderId ? providers.find(pr => pr.id === proveedor.parentProviderId) : undefined;
                    return (
                      <div
                        key={proveedor.id}
                        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 12px", padding: "12px 14px", borderRadius: "14px", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, background: "var(--elevated)" }}
                      >
                        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{proveedor.name}</span>
                            {tipo && (
                              <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "99px", background: tipo.bg, color: tipo.color, border: `1px solid ${tipo.color}30` }}>
                                {t(tipo.label)}
                              </span>
                            )}
                          </div>
                          {padre && (
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                              {t("Subproveedor de")} {padre.name}
                            </p>
                          )}
                          {/* Sin la lista de personas no se dice "0": se omite el conteo. */}
                          {personasTodas !== "error" && (
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                              {personasTodas === null
                                ? t("Contando personas…")
                                : `${conteo.personas} ${conteo.personas === 1 ? t("participante") : t("participantes")} · ${conteo.conductores} ${conteo.conductores === 1 ? t("conductor") : t("conductores")}`}
                            </p>
                          )}
                          {subproveedores.length > 0 && (
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {t("Con sus subproveedores:")} {subproveedores.map(s => s.name).join(", ")}
                            </p>
                          )}
                          {estaEn.length > 0 && (
                            <p
                              title={estaEn.join(" · ")}
                              style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {t("Está en:")} {estaEn.map(n => recortar(n, 40)).join(", ")}
                            </p>
                          )}
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ flexShrink: 0 }}
                          disabled={!!trayendoId}
                          onClick={() => void traerAlEvento(proveedor, subproveedores)}
                        >
                          {trayendoId === proveedor.id ? t("Agregando…") : t("Agregar a este evento")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 md:px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setTraerAbierto(false)} disabled={!!trayendoId}>{t("Cerrar")}</button>
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
              maxHeight: "min(92vh, calc(100dvh - 32px))",
              borderTop: `2px solid ${BRAND.teal}`,
              boxShadow: "0 8px 32px rgba(15,23,42,0.18)",
            }}
          >
            <div className="px-4 md:px-6 pt-5 md:pt-6 pb-4 flex-shrink-0">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>
                {participantModal.editing ? t("Editar") : t("Nuevo")}
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                {participantModal.editing ? t("Editar participante") : t("Nuevo participante")}
              </h2>
            </div>

            <div className="overflow-y-auto px-4 md:px-6 pb-2 flex-1 space-y-4">
              {/* Proveedor */}
              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                {t("Proveedor *")}
                <select
                  className="input"
                  value={participantForm.providerId}
                  onChange={e => setParticipantForm(f => ({ ...f, providerId: e.target.value }))}
                >
                  <option value="">{t("— Seleccionar proveedor —")}</option>
                  {/* Sólo proveedores del evento activo (y el actual, si se edita). */}
                  {opcionesProveedorForm.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.type ? ` (${t(PROVIDER_TYPES[p.type]?.label ?? p.type)})` : ""}</option>
                  ))}
                </select>
              </label>

              {/* Foto */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0" }}>
                {participantForm.photoDataUrl ? (
                  <img src={participantForm.photoDataUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `3px solid ${BRAND.teal}` }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(33,208,179,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: BRAND.teal }}>
                    {(participantForm.fullName || "?").split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase()}
                  </div>
                )}
                <div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px",
                    background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, fontSize: "12px", fontWeight: 700,
                    cursor: "pointer", boxShadow: "0 2px 8px rgba(33,208,179,0.3)",
                  }}>
                    <CameraIcon size={12} strokeWidth={2.5} />
                    {participantForm.photoDataUrl ? t("Cambiar foto") : t("Subir foto")}
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
                      style={{ marginLeft: "8px", fontSize: "11px", color: STATE.danger, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      {t("Quitar")}
                    </button>
                  )}
                </div>
              </div>

              {/* Datos personales */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px" }}>{t("Datos personales")}</p>
                <div className="space-y-3">
                  <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {t("Nombre completo *")}
                    <input className="input" value={participantForm.fullName} onChange={e => setParticipantForm(f => ({ ...f, fullName: e.target.value }))} placeholder={t("Nombre y apellido")} autoFocus />
                  </label>

                  {/* <div> y no <label>: el selector de país tiene botón y
                      buscador; dentro de una etiqueta, Safari y el iPhone
                      mandan el toque del buscador al botón y no dejan
                      escribir (28-09-2026). */}
                  <div className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {t("País")}
                    <CountrySelect
                      value={participantForm.countryCode}
                      onChange={val => setParticipantForm(f => ({ ...f, countryCode: val, rut: val !== "CHL" ? "" : f.rut, passportNumber: val === "CHL" ? "" : f.passportNumber }))}
                    />
                  </div>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {participantForm.countryCode === "CHL" ? (
                      <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        {t("RUT")}
                        <input className="input" value={participantForm.rut} onChange={e => setParticipantForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" autoFocus />
                      </label>
                    ) : (
                      <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        {t("Pasaporte")}
                        <input className="input" value={participantForm.passportNumber} onChange={e => setParticipantForm(f => ({ ...f, passportNumber: e.target.value }))} placeholder="A12345678" />
                      </label>
                    )}
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Fecha de nacimiento")}
                      <input className="input" type="date" value={participantForm.dateOfBirth} onChange={e => setParticipantForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Email")}
                      <input className="input" type="email" value={participantForm.email} onChange={e => setParticipantForm(f => ({ ...f, email: e.target.value }))} placeholder="nombre@email.com" />
                    </label>
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Teléfono")}
                      <input className="input" value={participantForm.phone} onChange={e => setParticipantForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Rol / Tipo")}
                      <input className="input" value={participantForm.userType} onChange={e => setParticipantForm(f => ({ ...f, userType: e.target.value }))} placeholder={t("Conductor, Coordinador…")} />
                    </label>
                    <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("Requiere visa")}
                      <select className="input" value={participantForm.visaRequired} onChange={e => setParticipantForm(f => ({ ...f, visaRequired: e.target.value }))}>
                        <option value="">{t("— Sin especificar —")}</option>
                        <option value="true">{t("Sí")}</option>
                        <option value="false">{t("No")}</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                {t("Observaciones")}
                <textarea className="input" rows={2} value={participantForm.observations} onChange={e => setParticipantForm(f => ({ ...f, observations: e.target.value }))} placeholder={t("Notas adicionales…")} style={{ resize: "vertical" }} />
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={participantForm.isDriver ? BRAND.teal : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: participantForm.isDriver ? BRAND.teal : "var(--text-muted)" }}>
                        {t("Es conductor")}
                      </span>
                    </div>
                    {/* Toggle pill */}
                    <div style={{
                      width: "40px", height: "22px", borderRadius: "11px", position: "relative",
                      background: participantForm.isDriver ? BRAND.teal : "var(--border-strong)",
                      transition: "background 0.2s", flexShrink: 0,
                    }}>
                      <div style={{
                        position: "absolute", top: "3px",
                        left: participantForm.isDriver ? "21px" : "3px",
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: SURFACE.card, transition: "left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                  </button>

                  {participantForm.isDriver && (<>
                    {/* Tipos de cliente que puede transportar */}
                    <div style={{ marginTop: "16px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
                        {t("Tipos de cliente que puede transportar")}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
                        {t("La auto-asignación solo le entregará servicios de estos tipos. Por defecto: TA (Deportista).")}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {CLIENT_TYPE_OPTIONS.map(o => {
                          const sel = participantForm.allowedClientTypes.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => setParticipantForm(f => ({
                                ...f,
                                allowedClientTypes: sel
                                  ? f.allowedClientTypes.filter(v => v !== o.value)
                                  : [...f.allowedClientTypes, o.value],
                              }))}
                              style={{
                                fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "99px",
                                cursor: "pointer", transition: "all 0.15s",
                                background: sel ? BRAND.teal : "var(--elevated)",
                                color: sel ? SURFACE.card : "var(--text-muted)",
                                border: `1px solid ${sel ? "#21D0B3" : "var(--border)"}`,
                              }}
                            >
                              {sel ? <CheckIcon size={12} className="inline mr-1" /> : null}{t(o.label)}
                            </button>
                          );
                        })}
                      </div>
                      {participantForm.allowedClientTypes.length === 0 && (
                        <p style={{ fontSize: "11px", color: STATE.warning, marginTop: "8px" }}>
                          <AlertIcon size={11} className="inline mr-1" />{t("Sin tipos seleccionados se guardará con TA (Deportista) por defecto.")}
                        </p>
                      )}
                    </div>

                    {/* Vehículo */}
                    <div style={{ marginTop: "16px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" }}>
                        {t("Detalle del vehículo")}
                      </p>
                      <div className="space-y-3">
                        {/* Patente con lookup */}
                        <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {t("Patente")}
                            {lookingUpPlate && (
                              <span style={{ fontSize: "10px", color: BRAND.teal, fontWeight: 500, letterSpacing: "0.05em" }}>{t("Buscando…")}</span>
                            )}
                            {!lookingUpPlate && plateError && (
                              <span style={{ fontSize: "10px", color: "#f87171", fontWeight: 500 }}>{plateError}</span>
                            )}
                            {!lookingUpPlate && !plateError && participantForm.vehicleMarca && (
                              <span style={{ fontSize: "10px", color: BRAND.teal, fontWeight: 500 }}><CheckIcon size={10} className="inline mr-1" />{t("Datos encontrados")}</span>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("Marca")}
                            <input className="input" value={participantForm.vehicleMarca} onChange={e => setParticipantForm(f => ({ ...f, vehicleMarca: e.target.value }))} placeholder="Toyota" />
                          </label>
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("Modelo")}
                            <input className="input" value={participantForm.vehicleModelo} onChange={e => setParticipantForm(f => ({ ...f, vehicleModelo: e.target.value }))} placeholder="Corolla" />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("Año")}
                            <input className="input" value={participantForm.vehicleAno} onChange={e => setParticipantForm(f => ({ ...f, vehicleAno: e.target.value }))} placeholder="2022" maxLength={4} />
                          </label>
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("Tipo")}
                            <select
                              className="input"
                              value={participantForm.vehicleTipo}
                              onChange={e => {
                                const tipo = e.target.value;
                                setParticipantForm(f => ({
                                  ...f,
                                  vehicleTipo: tipo,
                                  // Propone la capacidad del tipo sólo si aún no
                                  // se escribió una (nunca pisa lo cargado).
                                  vehicleCapacidad: f.vehicleCapacidad || (CAPACIDAD_SUGERIDA[tipo] ? String(CAPACIDAD_SUGERIDA[tipo]) : ""),
                                }));
                              }}
                            >
                              <option value="">{t("— Tipo —")}</option>
                              <option value="SEDAN">{t("Sedán")}</option>
                              <option value="SUV">{t("SUV")}</option>
                              <option value="VAN_10">{t("Van 10")}</option>
                              <option value="VAN_15">{t("Van 15-17")}</option>
                              <option value="VAN_19">{t("Van 19")}</option>
                              <option value="MINIBUS">{t("Minibus")}</option>
                              <option value="BUS">{t("Bus")}</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("Capacidad (pasajeros)")}
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={80}
                              value={participantForm.vehicleCapacidad}
                              onChange={e => setParticipantForm(f => ({ ...f, vehicleCapacidad: e.target.value }))}
                              placeholder={participantForm.vehicleTipo && CAPACIDAD_SUGERIDA[participantForm.vehicleTipo] ? String(CAPACIDAD_SUGERIDA[participantForm.vehicleTipo]) : "0"}
                            />
                            <span style={{ fontSize: "10.5px", fontWeight: 500, letterSpacing: "0.01em", textTransform: "none", color: "var(--text-muted)" }}>
                              {t("Asientos disponibles para pasajeros. Con este dato el chofer aparece en los viajes según la cantidad de personas.")}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Documentación */}
                    <div style={{ marginTop: "20px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "2px" }}>
                        {t("Documentación requerida")}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                        {t("Documentos del participante y del vehículo. Formatos: imagen o PDF.")}
                      </p>

                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
                        {t("Documentos personales")}
                      </p>
                      {TRANSPORT_DOCS_PERSON.map(doc => (
                        <DocRow
                          key={doc.key}
                          label={t(doc.label)}
                          docKey={doc.key}
                          file={participantDocFiles[doc.key] ?? null}
                          url={typeof participantModal?.editing?.metadata?.[doc.key] === "string" ? (participantModal.editing.metadata![doc.key] as string) : undefined}
                          onFile={(k, f) => setParticipantDocFiles(prev => ({ ...prev, [k]: f }))}
                          disabled={savingParticipant}
                        />
                      ))}

                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: "16px", marginBottom: "4px" }}>
                        {t("Documentos del vehículo")}
                      </p>
                      {TRANSPORT_DOCS_VEHICLE.map(doc => (
                        <DocRow
                          key={doc.key}
                          label={t(doc.label)}
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

              {participantError && <p className="text-sm" style={{ color: STATE.danger }}>{participantError}</p>}
            </div>

            <div className="px-4 md:px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => setParticipantModal(null)} disabled={savingParticipant}>{t("Cancelar")}</button>
              <button className="btn btn-primary" onClick={saveParticipant} disabled={savingParticipant}>
                {savingParticipant ? t("Guardando…") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
