"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  type IconComponent,
  PinIcon,
  PhoneIcon,
  MailIcon,
  PlaneIcon,
  HotelIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  XIcon,
  CameraIcon,
  CheckIcon,
  StarIcon,
  TrophyIcon,
  ArrowRightIcon,
  DumbbellIcon,
  MedalIcon,
  HeartPulseIcon,
  BedIcon,
  CarIcon,
  LogOutIcon,
  TruckIcon,
  CoffeeIcon,
  UsersIcon,
  TicketIcon,
  FileTextIcon,
  HeadphonesIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  SearchIcon,
  GlobeIcon,
  ShieldIcon,
  LockIcon,
  ActivityIcon,
  DownloadIcon,
} from "@/components/ui/Icons";
import { buildDisciplineLabelMap } from "@/lib/discipline-filters";
import { pruebaVisiblePara } from "@/lib/pruebas";
import { getMobileSession, mobileAwareLogout } from "@/lib/mobile-auth";
import { filterValidatedAthletes } from "@/lib/athletes";
import { canContactDrivers, isEventCoordinator, normalizeClientType } from "@/lib/clientTypes";
import { catalogoConCache } from "@/lib/catalog-cache";
import { mapaDeLugares, lugaresDeViajes, type LugarConCarga } from "@/lib/lugares";
import VenueMap from "@/components/VenueMap";
import CredentialQrCard from "@/components/CredentialQrCard";
import { useI18n } from "@/lib/i18n";
import TripMap from "@/components/TripMap";
import { ensurePortalRealtimeAuth, getSupabase } from "@/lib/supabase";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";
import AssistanceChat from "@/components/AssistanceChat";
import DevicePermissionsSection from "@/components/DevicePermissionsSection";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import EventDocumentsSection from "@/components/EventDocumentsSection";
import PortalSkeleton from "@/components/PortalSkeleton";
import { deletePortalAccount } from "@/lib/account-deletion";
import SofiaWidget from "@/components/SofiaWidget";
import BannerCoordinador from "@/components/portal/BannerCoordinador";
import HorariosComida from "@/components/portal/HorariosComida";
import MenuDelDia from "@/components/portal/MenuDelDia";
import { contactosDeHotel, type CoordinadorHotel } from "@/lib/hotel-coordinadores";
import { prepararFoto } from "@/lib/imagen";
import MissionFleet from "@/components/portal/MissionFleet";
import MissionTrips from "@/components/portal/MissionTrips";
import MissionLiveTrips from "@/components/portal/MissionLiveTrips";
import MissionLiveMap from "@/components/portal/MissionLiveMap";
import FiltrosComite, { nombreRegionCorto } from "@/components/portal/FiltrosComite";
import HotelesComite from "@/components/portal/HotelesComite";
import { ChipFilter, SegmentedFilter } from "@/components/ui/FilterControls";
import SelectorFiltro, { BotonQuitarFiltros } from "@/components/portal/SelectorFiltro";
import TarjetaLugar from "@/components/portal/TarjetaLugar";
import { openExternal, whatsappHref } from "@/lib/external-link";
import EmergencyNumbersSection from "@/components/EmergencyNumbersSection";
import PushTokenSync from "@/components/PushTokenSync";
import { buildCredentialHtml } from "@/lib/credential-template";
import { downloadCredentialPdf, saveCredentialPdf, type CredentialPdfData } from "@/lib/credential-pdf";
import { isAvailable as isNativeShell } from "@/lib/native-bridge";
import { clearPersistedTabs, persistTab, restoreOnReload, startTabHeartbeat } from "@/lib/portal-tab";
import { claimPortalSession, clearPortalSession, ensurePortalIdentity, portalLogin, releasePortalSession, usarIdentidadLocal, SESSION_ACTIVE_ELSEWHERE_MSG } from "@/lib/portal-session";
import { guardarPerfil, leerPerfil } from "@/lib/portal-perfil";
import PortalSessionGuard from "@/components/PortalSessionGuard";
import PdfViewerOverlay from "@/components/PdfViewerOverlay";
import QrFullscreenOverlay from "@/components/QrFullscreenOverlay";
import QRCode from "qrcode";
import { BRAND, tripStatusMeta, STATE, SURFACE, ACCENT } from "@/lib/design";
import { diaLargoEvento, fechaCortaEvento, fechaHoraAnioEvento, horaEvento } from "@/lib/hora-evento";

type Athlete = {
  id: string;
  fullName: string;
  userType?: string | null;
  countryCode?: string | null;
  status?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  arrivalFlightId?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  origin?: string | null;
  arrivalTime?: string | null;
  airportCheckinAt?: string | null;
  hotelAccommodationId?: string | null;
  roomNumber?: string | null;
  roomType?: string | null;
  bedType?: string | null;
  luggageType?: string | null;
  hotelCheckinAt?: string | null;
  hotelCheckoutAt?: string | null;
  transportTripId?: string | null;
  transportVehicleId?: string | null;
  isDelegationLead?: boolean | null;
  disciplineId?: string | null;
  accreditationStatus?: string | null;
  credentialCode?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Flight = { id: string; flightNumber: string; airline: string; arrivalTime: string | null };
type Hotel = { id: string; name: string };
type HotelAssignment = {
  id: string;
  participantId?: string; participant_id?: string;
  hotelId?: string; hotel_id?: string;
  roomId?: string | null; room_id?: string | null;
  bedId?: string | null; bed_id?: string | null;
  checkinAt?: string | null; checkin_at?: string | null;
  checkoutAt?: string | null; checkout_at?: string | null;
  createdAt?: string; created_at?: string;
  updatedAt?: string; updated_at?: string;
};
type HotelRoom = { id: string; roomNumber: string; roomType: string };
type HotelBed = { id: string; bedType: string };
type Vehicle = { id: string; plate: string; type: string };
type Trip = { id: string; driverId: string; delegationId?: string | null; allDelegations?: boolean; disciplineId?: string | null; originVenueId?: string | null; originHotelId?: string | null; destinationVenueId?: string | null; destinationHotelId?: string | null; originFoodLocationId?: string | null; destinationFoodLocationId?: string | null; vehicleId?: string | null; athleteIds?: string[]; athleteNames?: string[]; requesterAthleteId?: string | null; clientType?: string | null; origin?: string | null; destination?: string | null; status?: string | null; scheduledAt?: string | null; startedAt?: string | null; completedAt?: string | null; tripType?: string | null; legType?: string | null; discipline?: string | null; notes?: string | null; driverRating?: number | null; ratingComment?: string | null; ratedAt?: string | null; passengerLat?: number | null; passengerLng?: number | null; vehiclePlate?: string | null };
type Driver = { id: string; fullName: string; userId?: string | null };
type Event = { id: string; name: string };
// name: las delegaciones de los Juegos Escolares son regiones con nombre visible.
type Delegation = { id: string; countryCode: string; name?: string | null };
// La ficha del participante ya trae estos nombres resueltos.
type AthleteConNombres = Athlete & {
  eventName?: string | null;
  delegationName?: string | null;
  delegationCountryCode?: string | null;
};
type CalendarEvent = {
  id: string;
  name?: string | null;
  eventId?: string | null;
  parentId?: string | null;
  scheduledAt?: string | null;
  venueName?: string | null;
  category?: string | null;
  gender?: string | null;
  /** Regiones que participan (partido: las dos). Vacío = prueba general. */
  delegationIds?: string[] | null;
};
type DisciplineParent = { id: string; name?: string | null; category?: string | null; gender?: string | null };
/**
 * Región del evento. `/delegations` adjunta las disciplinas de cada una
 * (core.delegation_disciplines), que es lo que permite filtrar el calendario
 * por región sin pedir nada más.
 */
type DelegacionEvento = {
  id: string;
  eventId?: string | null;
  countryCode?: string | null;
  name?: string | null;
  disciplineIds?: string[] | null;
  disciplineNames?: string[] | null;
};
type Venue = { id: string; eventId?: string | null; name?: string | null; address?: string | null; region?: string | null; commune?: string | null; photoUrl?: string | null; coordinatorName?: string | null; coordinatorPhone?: string | null; venueType?: string | null; disciplineIds?: string[] | null };
// disciplineIds: los deportes que la planilla de distribución aloja en el
// hotel. Los calcula GET /accommodations, no son una columna del alojamiento.
// coordinators: quién responde por el hotel, con su teléfono.
type Accommodation = { id: string; eventId?: string | null; name?: string | null; address?: string | null; city?: string | null; country?: string | null; checkIn?: string | null; checkOut?: string | null; roomType?: string | null; photoUrl?: string | null; disciplineIds?: string[] | null; coordinators?: CoordinadorHotel[] | null };
type FoodLocation = { id: string; accommodationId?: string | null; name: string; description?: string | null; capacity?: number | null; clientTypes: string[] };
type FoodMenu = { id: string; date: string; mealType: string; title: string; description?: string | null; dietaryType?: string | null; accommodationId?: string | null; clientTypes?: string[] | null; locationDetail?: string | null };
type PremAwarder = {
  id?: string;
  athleteId: string;
  role?: string | null;
  confirmedAt?: string | null;
  declinedAt?: string | null;
};
type Premiacion = {
  id: string;
  title: string;
  discipline?: string | null;
  disciplineId?: string | null;
  scheduledAt: string;
  venueName?: string | null;
  locationDetail?: string | null;
  status: "PROGRAMADA" | "REALIZADA" | string;
  notes?: string | null;
  awarders?: PremAwarder[] | null;
};
// flota: sólo para el Jefe de Misión (participante encargado de su delegación).
type PortalTab = "itinerario" | "flota" | "actividades" | "calendario" | "premiaciones" | "sedes" | "hoteles" | "alimentacion" | "delegacion" | "cupones" | "documentos" | "cuenta";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  category: string;
  discountType?: string;
  discountValue?: number | null;
  termsAndConditions?: string | null;
  partnerName?: string | null;
  partnerLogoUrl?: string | null;
  partnerAddress?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  perUserLimit?: number | null;
  imageUrl?: string | null;
};

type CouponClaim = {
  id: string;
  couponId: string;
  uniqueCode: string;
  qrToken: string;
  status: "CLAIMED" | "REDEEMED" | "EXPIRED" | "REVOKED";
  claimedAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
  redemptionLocation?: string | null;
  coupon?: Coupon;
};

const COUPON_CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  COMIDA: { label: "Comida", color: STATE.warningText, bg: STATE.warningSoft },
  ENTRETENIMIENTO: { label: "Entretenimiento", color: ACCENT.violet, bg: "#f4f0fb" },
  TIENDA: { label: "Tienda", color: STATE.successText, bg: STATE.successSoft },
  OTHER: { label: "Otros", color: SURFACE.textMuted, bg: SURFACE.borderMuted },
};

const COUPON_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  CLAIMED: { label: "Activo", color: STATE.infoText, bg: "#e3edfa" },
  REDEEMED: { label: "Canjeado", color: STATE.successText, bg: STATE.successSoft },
  EXPIRED: { label: "Expirado", color: STATE.dangerText, bg: STATE.dangerSoft },
  REVOKED: { label: "Anulado", color: SURFACE.textMuted, bg: SURFACE.borderMuted },
};

function couponDiscountDisplay(c: Coupon) {
  switch (c.discountType) {
    case "PERCENTAGE":
      return c.discountValue ? `${c.discountValue}% OFF` : "Descuento";
    case "AMOUNT":
      return c.discountValue
        ? `$${Number(c.discountValue).toLocaleString("es-CL")}`
        : "Descuento";
    case "FREE":
      return "GRATIS";
    default:
      return c.discountValue?.toString() || "Beneficio";
  }
}

/**
 * Hora y fecha del traslado, en el mismo formato que la lista de viajes de la
 * delegación. La tarjeta mostraba "18-09-2026, 11:00 p.m." mientras la lista
 * de abajo, para el mismo viaje, decía "23:00 · 18-SEPT": dos maneras de
 * escribir la misma hora en una sola pantalla.
 */
// Hora del evento (America/Santiago), no la del aparato: ver lib/hora-evento.
const horaViaje = (iso?: string | null) => horaEvento(iso);
const fechaViaje = (iso?: string | null) => fechaCortaEvento(iso);

const fmtCouponDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "-";

const fmtCouponFull = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }) : "-";

function couponTimeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const countryLabels: Record<string, string> = {
  ARG:"Argentina",BOL:"Bolivia",BRA:"Brasil",CHL:"Chile",COL:"Colombia",
  ECU:"Ecuador",PRY:"Paraguay",PER:"Perú",URY:"Uruguay",VEN:"Venezuela",
  MEX:"México",USA:"Estados Unidos",CAN:"Canadá",ESP:"España",FRA:"Francia",
  DEU:"Alemania",ITA:"Italia",PRT:"Portugal",GBR:"Reino Unido"
};
const luggageLabels: Record<string, string> = {
  BAG:"Bolso",SUITCASE_8:"Maleta 8kg",SUITCASE_15:"Maleta 15kg",
  SUITCASE_23:"Maleta 23kg",EXTRA_BAGGAGE:"Sobreequipaje"
};

const fmt = (v?: string | null) => fechaHoraAnioEvento(v);

/**
 * Viaje que la tarjeta "En curso" debe mostrar entre los del participante.
 *
 * Antes se tomaba el viaje fijado en su ficha (transportTripId) o, si no
 * había, el primero que devolviera la API — sin mirar estado ni hora. Por eso
 * la tarjeta podía mostrar un traslado de las 23:00 mientras otro estaba En
 * ruta y un tercero salía antes.
 *
 * El orden que espera quien lo mira: lo que está pasando ahora manda; si no
 * hay nada en curso, el próximo que sale.
 */
const VIAJE_EN_CURSO = ["EN_ROUTE", "PICKED_UP"];
const VIAJE_PENDIENTE = ["SCHEDULED", "REQUESTED"];

function elegirViajeActual(candidatos: (Trip | null | undefined)[]): Trip | null {
  // La ficha y el listado pueden traer el mismo viaje: se deduplica por id.
  const porId = new Map<string, Trip>();
  candidatos.forEach((t) => { if (t?.id) porId.set(t.id, t); });
  const viajes = [...porId.values()];
  if (!viajes.length) return null;

  const porHora = (a: Trip, b: Trip) =>
    new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime();

  const enCurso = viajes.filter((t) => VIAJE_EN_CURSO.includes(t.status ?? "")).sort(porHora);
  if (enCurso.length) return enCurso[0];

  const pendientes = viajes.filter((t) => VIAJE_PENDIENTE.includes(t.status ?? "")).sort(porHora);
  if (pendientes.length) return pendientes[0];

  return viajes[0];
}

const normalizeHA = (item: HotelAssignment) => ({
  id: item.id,
  participantId: item.participantId ?? item.participant_id ?? "",
  hotelId: item.hotelId ?? item.hotel_id ?? "",
  roomId: item.roomId ?? item.room_id ?? null,
  bedId: item.bedId ?? item.bed_id ?? null,
  checkinAt: item.checkinAt === "null" || item.checkin_at === "null" ? null : (item.checkinAt ?? item.checkin_at ?? null),
  checkoutAt: item.checkoutAt === "null" || item.checkout_at === "null" ? null : (item.checkoutAt ?? item.checkout_at ?? null),
  createdAt: item.createdAt ?? item.created_at ?? "",
  updatedAt: item.updatedAt ?? item.updated_at ?? ""
});

/* ── Icons ── */
const IcoPlane = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 5.2 5.3c.4.4.9.4 1.3.3l.5-.3c.4-.3.6-.7.5-1.1z"/>
  </svg>
);
const IcoHotel = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"/><path d="M3 21h18"/><path d="M9 21V12h6v9"/><rect x="9" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/>
  </svg>
);
const IcoCar = () => (
  <CarIcon size={20} strokeWidth={1.8} />
);
const IcoCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const IcoLogout = () => (
  <LogOutIcon size={16} strokeWidth={1.8} />
);
const IcoBag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

export default function UserPortalPage() {
  const { t } = useI18n();
  const [athleteId, setAthleteId] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [hotelAssignment, setHotelAssignment] = useState<HotelAssignment | null>(null);
  const [hotelRoom, setHotelRoom] = useState<HotelRoom | null>(null);
  const [hotelBed, setHotelBed] = useState<HotelBed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [markLoading, setMarkLoading] = useState<string | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [driverEta, setDriverEta] = useState<{ distance: string; duration: string } | null>(null);
  const [rastreoCaido, setRastreoCaido] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [disciplineParents, setDisciplineParents] = useState<DisciplineParent[]>([]);
  // Todas las disciplinas del evento, con hora o sin ella. Hace falta para
  // saber de qué deporte cuelga la prueba de cada participante: calendarEvents
  // sólo guarda las pruebas CON hora, así que resolver el padre por ahí fallaba
  // para casi todas y el calendario del jefe salía vacío.
  const [disciplinasTodas, setDisciplinasTodas] = useState<CalendarEvent[]>([]);
  // Etiquetas desambiguadas por variante ("Atletismo · Femenino"): el mismo
  // deporte existe una vez por género/categoría y mostrar solo `name`
  // producía opciones y filas duplicadas en el calendario.
  const discLabelMap = useMemo(() => buildDisciplineLabelMap(disciplineParents), [disciplineParents]);
  /**
   * Fichas de deporte de un recinto. En la sede son las que el módulo Sede
   * tiene asignadas —antes se deducían calzando `venue_name` con el nombre de
   * la sede, un calce por texto que se perdía al renombrarla—; en el hotel son
   * las que la planilla de distribución aloja ahí. Los dos listados las pintan
   * igual, así que la vuelta es una sola.
   */
  const etiquetasDeDisciplinas = useCallback(
    (lugar: { disciplineIds?: string[] | null }) => {
      const ids = lugar.disciplineIds ?? [];
      if (ids.length === 0) return [] as string[];
      return ids
        .map((id) => discLabelMap.get(id) ?? disciplinasTodas.find((d) => d.id === id)?.name ?? "")
        .filter((etiqueta): etiqueta is string => Boolean(etiqueta))
        .sort((a, b) => a.localeCompare(b));
    },
    [discLabelMap, disciplinasTodas],
  );
  const [healthRecord, setHealthRecord] = useState<Record<string, any> | null>(null);
  const [delegationMembers, setDelegationMembers] = useState<Athlete[]>([]);
  const [delegationTrips, setDelegationTrips] = useState<Trip[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  // Sedes y hoteles son cosas distintas: se ven por separado, no en una lista.
  const [sedesVista, setSedesVista] = useState<"sedes" | "comedores" | "hoteles">("sedes");
  const [allAccommodations, setAllAccommodations] = useState<Accommodation[]>([]);
  // Nombre de TODOS los hoteles del evento. El listado de arriba viene acotado
  // a los de la delegación, así que el hotel al que va un bus de otra región
  // aparecía como una dirección suelta.
  const [nombresHoteles, setNombresHoteles] = useState<{ id: string; name?: string | null }[]>([]);
  // Coordinador de Comité: la lista de regiones y los dos filtros que manda
  // sobre todos sus módulos.
  const [delegacionesEvento, setDelegacionesEvento] = useState<DelegacionEvento[]>([]);
  const [comiteDelegacion, setComiteDelegacion] = useState("");
  const [comiteDisciplina, setComiteDisciplina] = useState("");
  // Hotel y sede que tocan los traslados (texto de la planilla). Sólo acotan
  // la lista de traslados, que es la única pestaña donde la pregunta tiene
  // sentido.
  const [comiteHotel, setComiteHotel] = useState("");
  const [comiteSede, setComiteSede] = useState("");
  const [foodLocations, setFoodLocations] = useState<FoodLocation[]>([]);
  const [foodMenus, setFoodMenus] = useState<FoodMenu[]>([]);
  // El home del portal es siempre Itinerario; sólo un refresh (F5) restaura
  // la sección donde estaba el usuario.
  const [activeTab, setActiveTab] = useState<PortalTab>(() =>
    restoreOnReload<PortalTab>(
      "portal_user_tab",
      ["itinerario", "flota", "actividades", "calendario", "premiaciones", "sedes", "hoteles", "alimentacion", "delegacion", "cupones", "documentos", "cuenta"],
      "itinerario",
    ),
  );
  useEffect(() => {
    persistTab("portal_user_tab", activeTab);
  }, [activeTab]);
  // Mientras el portal está abierto, marca que sigue vivo: así una recarga
  // (F5 o botón actualizar de la app) se distingue de un login/apertura fría.
  useEffect(() => startTabHeartbeat(), []);
  const [moreOpen, setMoreOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  // Categoría con la que se abre la sala de asistencia. El botón de auriculares
  // la deja en null (el usuario elige); el banner del jefe la fija para que
  // contactar al coordinador sea un solo toque.
  const [assistCategoria, setAssistCategoria] = useState<string | null>(null);
  const [actSubTab, setActSubTab] = useState<"curso" | "historial">("curso");
  const [calMonthCursor, setCalMonthCursor] = useState(() => new Date());
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);
  const [calView, setCalView] = useState<"agenda" | "mes" | "gantt" | "semana" | "dia">("agenda");
  const [calCursor, setCalCursor] = useState(() => new Date());
  const [calTypeFilter, setCalTypeFilter] = useState<string>("");
  const [calDiscFilter, setCalDiscFilter] = useState<string>("");
  /** Tope de actividades visibles al desplegar un día de la semana. */
  const SEMANA_TOPE = 12;
  /** Región elegida en el calendario. "" = todas. */
  const [calDelegacionFilter, setCalDelegacionFilter] = useState<string>("");
  /**
   * Actividad abierta en la ficha de detalle. Los títulos del calendario se
   * cortan —"Lanzamiento Bala PARA Atle…"— y no había forma de leerlos
   * completos ni de ver dónde ni a qué hora exacta.
   */
  /**
   * Días desplegados en la vista agenda. Abrir los treinta días del mes de
   * golpe la hace ilegible: se pliega y cada encabezado lleva su resumen
   * —cuántas, entre qué horas y en qué sedes— para que plegar ordene en vez
   * de esconder.
   */
  const [semanaAbiertos, setSemanaAbiertos] = useState<Set<string>>(() => {
    // Hoy arranca desplegado: es el día que se viene a mirar. El resto se abre
    // tocándolo, para que la semana entre de una pantalla.
    const d = new Date();
    return new Set([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`]);
  });
  /** Día abierto en la tira de la semana. null = hoy, o el primero con carga. */
  const [semanaDiaSel, setSemanaDiaSel] = useState<string | null>(null);
  /** Días donde se pidió ver la lista completa, más allá del tope. */
  const [semanaVerTodo, setSemanaVerTodo] = useState<Set<string>>(new Set());
  const alternarDiaSemana = (clave: string) =>
    setSemanaAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  const marcarVerTodo = (clave: string) =>
    setSemanaVerTodo((prev) => new Set(prev).add(clave));

  const [calDetalle, setCalDetalle] = useState<{
    id: string;
    titulo: string;
    subtitulo?: string;
    sede?: string;
    fecha: Date;
    tipoLabel: string;
    color: string;
    soft: string;
  } | null>(null);
  const calAutoJumped = useRef(false);
  const calDiscAutoSet = useRef(false);
  const ganttScrollKey = useRef("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  // Premiaciones tab state
  const [premiaciones, setPremiaciones] = useState<Premiacion[]>([]);
  const [premStatusFilter, setPremStatusFilter] = useState<"" | "PROGRAMADA" | "REALIZADA">("");
  const [premDisciplineFilter, setPremDisciplineFilter] = useState("");
  const [premVenueFilter, setPremVenueFilter] = useState("");
  const [premSearchQuery, setPremSearchQuery] = useState("");
  const [premView, setPremView] = useState<"list" | "calendar">("calendar");
  // Premiación destacada al llegar desde una notificación (?premiacionId=).
  const [premFocusId, setPremFocusId] = useState<string | null>(null);
  // Secciones colapsables de la vista lista de premiaciones.
  const [premPendingOpen, setPremPendingOpen] = useState(true);
  const [premDoneOpen, setPremDoneOpen] = useState(true);
  const [premCalCursor, setPremCalCursor] = useState(() => new Date());
  const [premCalSelectedKey, setPremCalSelectedKey] = useState<string | null>(null);
  // Coupons tab state
  const [couponTab, setCouponTab] = useState<"available" | "mine">("available");
  const [couponsAvailable, setCouponsAvailable] = useState<Coupon[]>([]);
  const [couponClaims, setCouponClaims] = useState<CouponClaim[]>([]);
  const [couponClaiming, setCouponClaiming] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<CouponClaim | null>(null);
  const [couponQrDataUrl, setCouponQrDataUrl] = useState<string>("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [credentialHtml, setCredentialHtml] = useState<string | null>(null);
  const [credentialPdf, setCredentialPdf] = useState<CredentialPdfData | null>(null);
  const [credentialPdfView, setCredentialPdfView] = useState<string | null>(null);
  // QR de la credencial para validar en los lugares de comida.
  const [mealQrDataUrl, setMealQrDataUrl] = useState<string>("");
  const [mealQrZoom, setMealQrZoom] = useState(false);
  useEffect(() => {
    if (!athlete) { setMealQrDataUrl(""); return; }
    const qrData = `Participante: ${athlete.fullName}\nID: ${athlete.id.slice(-6)}\nDelegación: ${delegation?.countryCode || "—"}`;
    QRCode.toDataURL(qrData, { width: 220, margin: 1, color: { dark: BRAND.navyLight, light: SURFACE.card } })
      .then(setMealQrDataUrl)
      .catch(() => setMealQrDataUrl(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id]);

  // Deep-link desde notificaciones de premiación: ?premiacionId= abre el tab
  // y destaca la premiación específica (vista lista + scroll + resaltado).
  useEffect(() => {
    if (!athlete) return;
    const params = new URLSearchParams(window.location.search);
    const premId = params.get("premiacionId");
    if (!premId) return;
    setActiveTab("premiaciones");
    setPremView("list");
    setPremFocusId(premId);
    // La premiación notificada debe ser visible: abre ambas secciones.
    setPremPendingOpen(true);
    setPremDoneOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("premiacionId");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id]);

  // Con los datos ya cargados, hace scroll hasta la premiación notificada y
  // la deja resaltada unos segundos.
  useEffect(() => {
    if (!premFocusId || activeTab !== "premiaciones" || premiaciones.length === 0) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`prem-${premFocusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    const clearTimer = window.setTimeout(() => setPremFocusId(null), 8000);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer); };
  }, [premFocusId, activeTab, premiaciones.length]);

  // Deep-link desde notificaciones de viaje: ?tripId= abre Actividades (y el
  // detalle si es el viaje propio). Antes el parámetro se ignoraba y el
  // usuario aterrizaba en el home sin ver nada.
  const tripDeepLinkId = useRef<string | null>(null);
  useEffect(() => {
    if (!athlete) return;
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("tripId");
    if (!tripId) return;
    tripDeepLinkId.current = tripId;
    setActiveTab("actividades");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tripId");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id]);
  useEffect(() => {
    if (!tripDeepLinkId.current || !trip) return;
    if (trip.id === tripDeepLinkId.current) setShowTripModal(true);
    tripDeepLinkId.current = null;
  }, [trip?.id]);
  const notify = useNotifications({ userKind: "athlete", userId: athlete?.id ?? null });

  // Al cargar las actividades por primera vez, posiciona el calendario en el mes
  // de la próxima actividad (o la más cercana) para no abrir en un mes vacío.
  useEffect(() => {
    if (calAutoJumped.current) return;
    // Los no-jefes ven su propia disciplina por defecto: saltamos a un mes que
    // tenga actividades de ESA disciplina, para no abrir en un mes vacío.
    const chief = athlete?.isDelegationLead === true;
    const discId = athlete?.disciplineId;
    const dates: number[] = [];
    calendarEvents.forEach((e) => {
      if (!chief && discId && e.parentId !== discId) return;
      if (e.scheduledAt) { const t = new Date(e.scheduledAt).getTime(); if (!Number.isNaN(t)) dates.push(t); }
    });
    premiaciones.forEach((p) => {
      if (!chief && discId && p.disciplineId !== discId) return;
      if (p.scheduledAt) { const t = new Date(p.scheduledAt).getTime(); if (!Number.isNaN(t)) dates.push(t); }
    });
    if (dates.length === 0) return;
    const now = Date.now();
    const future = dates.filter((t) => t >= now).sort((a, b) => a - b);
    const target = future.length ? future[0] : Math.max(...dates);
    const td = new Date(target);
    setCalMonthCursor(new Date(td.getFullYear(), td.getMonth(), 1));
    calAutoJumped.current = true;
  }, [calendarEvents, premiaciones, athlete?.isDelegationLead, athlete?.disciplineId]);

  // Por defecto, el atleta ve solo su disciplina (evita el "scroll infinito"
  // con todas las disciplinas). Se puede cambiar a "Todas" desde el filtro.
  // El jefe de delegación está asociado al país: ve TODAS las disciplinas de
  // su delegación por defecto (no se auto-filtra a la suya).
  useEffect(() => {
    if (calDiscAutoSet.current) return;
    if (athlete?.isDelegationLead === true) {
      calDiscAutoSet.current = true; // jefe: sin auto-filtro → todas las disciplinas
      return;
    }
    if (athlete?.disciplineId) {
      setCalDiscFilter(athlete.disciplineId);
      calDiscAutoSet.current = true;
    }
  }, [athlete?.disciplineId, athlete?.isDelegationLead]);

  // El VIP entregador confirma o rechaza su asistencia a una premiación.
  const confirmAwarder = async (premiacionId: string, awarderId: string, decision: "CONFIRM" | "DECLINE") => {
    try {
      const endpoint = decision === "CONFIRM" ? "confirm" : "decline";
      await apiFetch(`/premiaciones/${premiacionId}/awarders/${awarderId}/${endpoint}`, { method: "PATCH" });
      const data = await apiFetch<Premiacion[]>("/premiaciones");
      setPremiaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo actualizar la confirmación.");
    }
  };

  // Jefe de Misión: por tipo de cliente (JEFE_MISION) o por estar designado
  // como encargado de su delegación en Registro → Delegaciones.
  // Nombre del recinto de un viaje, con lo que es delante: "Comedor LRH (ex
  // Gala)", "Sede Elías Figueroa (Martillo)", "Hotel Mahía". Sin recinto
  // asignado sólo queda la dirección escrita a mano.
  const nombreRecinto = useMemo(
    () => mapaDeLugares(venues, nombresHoteles.length ? nombresHoteles : allAccommodations, foodLocations),
    [venues, nombresHoteles, allAccommodations, foodLocations],
  );
  /**
   * Hoteles y sedes para los filtros del Coordinador, sacados de los propios
   * viajes: los de la planilla traen origen y destino como texto y sin id, y
   * cruzar por id dejaba tres hoteles de 330 viajes mientras el tracking del
   * panel los mostraba todos. Misma regla que el panel (lib/lugares): cada
   * opción existe porque algún viaje la toca, con su cuenta en la etiqueta.
   */
  const lugaresComite = useMemo(() => {
    const crudo = new Map<string, string>();
    for (const v of venues) if (v.id && v.name) crudo.set(v.id, v.name);
    for (const h of allAccommodations) if (h.id && h.name) crudo.set(h.id, h.name);
    for (const f of foodLocations) if (f.id && f.name) crudo.set(f.id, f.name);
    const lugares = lugaresDeViajes(delegationTrips, allAccommodations, (id) => crudo.get(id));
    const opcion = (l: LugarConCarga) => ({ value: l.texto, label: `${l.texto} · ${l.total}` });
    return {
      hoteles: lugares.filter((l) => l.esHotel).map(opcion),
      sedes: lugares.filter((l) => !l.esHotel).map(opcion),
    };
  }, [delegationTrips, venues, allAccommodations, foodLocations]);
  const puntoViaje = (
    t: { originVenueId?: string | null; originHotelId?: string | null; originFoodLocationId?: string | null; destinationVenueId?: string | null; destinationHotelId?: string | null; destinationFoodLocationId?: string | null; origin?: string | null; destination?: string | null },
    extremo: "origin" | "destination",
  ) => {
    const id = extremo === "origin"
      ? (t.originVenueId ?? t.originHotelId ?? t.originFoodLocationId)
      : (t.destinationVenueId ?? t.destinationHotelId ?? t.destinationFoodLocationId);
    const direccion = (extremo === "origin" ? t.origin : t.destination) ?? "";
    const nombre = id ? nombreRecinto.get(id) ?? null : null;
    return { nombre, direccion };
  };

  const isChief =
    athlete?.isDelegationLead === true ||
    normalizeClientType(athlete?.userType) === "JEFE_MISION";
  /**
   * Coordinador de Comité: mira el evento completo, no una región. Sus cuatro
   * módulos son actividades, calendario, sedes y hoteles, y en todos filtra
   * por delegación y disciplina, que es como trabaja: "muéstrame lo de Ñuble
   * en vóleibol". En actividades tiene además el hotel de destino, para leer
   * la otra pregunta que se hace: hacia qué hotel van los conductores.
   *
   * El Coordinador de Transporte usa esos mismos módulos —por eso comparte
   * esta bandera— y se separa en una sola cosa: puede escribirle al chofer
   * de cada traslado. Ver `puedeContactarChoferes`.
   */
  const isComite = isEventCoordinator(athlete?.userType);
  const puedeContactarChoferes = canContactDrivers(athlete?.userType);

  // El deporte que el Coordinador de Comité elige arriba manda también en el
  // calendario, que tiene su propio filtro de disciplina.
  useEffect(() => {
    if (!isComite) return;
    setCalDiscFilter(comiteDisciplina);
  }, [isComite, comiteDisciplina]);

  // Nombre visible de la delegación: región ("Región de Valparaíso") o país.
  const delegationName = delegation ? (delegation.name || countryLabels[delegation.countryCode] || delegation.countryCode) : "";
  // TA (deportistas): vista simplificada — sin premiaciones, sin asistencia,
  // sin historial de viajes y con el calendario fijo en su disciplina.
  // El jefe de delegación conserva la vista completa aunque sea TA.
  const isTA = !isChief && normalizeClientType(athlete?.userType) === "TA";
  const portalTabs = useMemo(() => {
    const all: { key: PortalTab; label: string; icon: React.ReactNode }[] = [
      { key:"itinerario", label:"Itinerario", icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="16"/><circle cx="12" cy="19" r="3"/></svg> },
      { key:"flota", label:"Flota", icon:<CarIcon size={16} strokeWidth={1.8} /> },
      { key:"actividades", label:"Actividades", icon:<TruckIcon size={16} strokeWidth={1.8} /> },
      { key:"calendario", label:"Calendario", icon:<CalendarIcon size={16} strokeWidth={1.8} /> },
      { key:"premiaciones", label:"Premiaciones", icon:<TrophyIcon size={16} strokeWidth={1.8} /> },
      { key:"sedes", label:"Sedes", icon:<PinIcon size={16} strokeWidth={1.8} /> },
      { key:"hoteles", label:"Hoteles", icon:<BedIcon size={16} strokeWidth={1.8} /> },
      { key:"alimentacion", label:"Alimentación", icon:<CoffeeIcon size={16} strokeWidth={1.8} /> },
      { key:"delegacion", label:"Delegación", icon:<UsersIcon size={16} strokeWidth={1.8} /> },
      { key:"cupones", label:"Beneficios", icon:<TicketIcon size={16} strokeWidth={1.8} /> },
      { key:"documentos", label:"Documentos", icon:<FileTextIcon size={16} strokeWidth={1.8} /> },
      { key:"cuenta", label:"Cuenta", icon:<UserIcon size={16} strokeWidth={1.8} /> },
    ];
    if (isComite) {
      // Alimentación y Documentos entran también para el comité: el informativo
      // del evento y los comedores son parte de lo que coordina.
      const ORDEN_COMITE: PortalTab[] = ["actividades", "calendario", "sedes", "hoteles", "alimentacion", "documentos", "cuenta"];
      return ORDEN_COMITE.map(key => all.find(t => t.key === key)).filter((t): t is typeof all[number] => Boolean(t));
    }
    if (isTA) return all.filter(t => ["actividades","calendario","sedes","alimentacion","cupones","documentos","cuenta"].includes(t.key));
    if (!isChief) return all.filter(t => ["actividades","calendario","premiaciones","sedes","alimentacion","cupones","documentos","cuenta"].includes(t.key));
    // Jefe de Misión: sólo su trabajo, y en el orden en que lo usa —
    // actividades (viajes de su delegación) primero, después flota de su
    // región, calendario, sedes, alimentación y cuaderno de
    // cargo. Sin itinerario personal, premiaciones ni beneficios.
    const ORDEN_JEFE: PortalTab[] = ["actividades","flota","calendario","sedes","alimentacion","documentos","cuenta"];
    return ORDEN_JEFE.map(key => all.find(t => t.key === key)).filter((t): t is typeof all[number] => Boolean(t));
  }, [isChief, isTA, isComite]);

  // La barra inferior muestra hasta 4 pestañas fijas + "Más"; el resto se agrupa
  // en una hoja inferior. Orden de prioridad para elegir cuáles quedan fijas.
  const { primaryTabs, overflowTabs } = useMemo(() => {
    const MAX_PRIMARY = 4;
    const PRIORITY = isComite
      ? ["actividades", "calendario", "sedes", "hoteles", "alimentacion", "documentos", "cuenta"]
      : isChief
      ? ["actividades", "flota", "calendario", "sedes", "alimentacion", "documentos", "cuenta"]
      : ["itinerario", "actividades", "calendario", "delegacion", "alimentacion", "sedes", "cuenta", "documentos", "premiaciones", "cupones"];
    if (portalTabs.length <= MAX_PRIMARY + 1) {
      return { primaryTabs: portalTabs, overflowTabs: [] as typeof portalTabs };
    }
    const ranked = [...portalTabs].sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
    const primaryKeys = new Set(ranked.slice(0, MAX_PRIMARY).map((t) => t.key));
    return {
      primaryTabs: portalTabs.filter((t) => primaryKeys.has(t.key)),
      overflowTabs: portalTabs.filter((t) => !primaryKeys.has(t.key)),
    };
  }, [portalTabs, isChief, isComite]);

  /**
   * Un solo arranque. Habia dos efectos que cargaban al participante por su
   * cuenta: uno con la sesion guardada en la pestana y otro con la sesion de
   * la app. Dentro de la app los dos daban en el blanco y toda la apertura se
   * pedia por duplicado.
   */
  const arranqueHecho = useRef(false);
  useEffect(() => {
    if (arranqueHecho.current) return;
    arranqueHecho.current = true;
    const listo = () => { setSessionChecked(true); setBootCheckDone(true); };
    let id: string | null = null;
    try {
      // La sesion de la app manda sobre la de la pestana.
      const sesionApp = getMobileSession();
      id =
        sesionApp?.kind === "athlete" && sesionApp.athleteId
          ? sesionApp.athleteId
          : sessionStorage.getItem("portal_user_id");
    } catch { id = null; }
    if (!id || athlete) { listo(); return; }
    void loadAthlete(id).finally(listo);
  }, []);

  // Set default tab based on profile
  // Nada de forzar la pestaña al cargar: al actualizar, portal-tab restaura
  // el módulo donde estaba el usuario. Sólo se corrige si no le corresponde.

  // Cada rol tiene su propia barra, y la pestaña recordada puede no existir en
  // ella: el jefe no tiene premiaciones, el Coordinador de Comité sólo tiene
  // cuatro módulos, y el valor inicial ("itinerario") no está en ninguna. Sin
  // esto la entrada quedaba en una pantalla en blanco. La primera pestaña de
  // la barra es el inicio del rol — actividades en todos ellos.
  useEffect(() => {
    if (!athlete || portalTabs.length === 0) return;
    if (!portalTabs.some((tab) => tab.key === activeTab)) setActiveTab(portalTabs[0].key);
  }, [athlete?.id, activeTab, portalTabs]);

  const DAY_NAMES = ["L","M","M","J","V","S","D"];
  function getMonthGrid(cursor: Date) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }
  const prevTripStatus = useRef<string | null>(null);
  const arrivedNotified = useRef<string | null>(null); // tracks which segment was already notified
  // Último cálculo de ETA (throttle de DistanceMatrix) y último fix recibido
  // por Realtime (para saltar el fetch REST de posición cuando el WebSocket
  // está entregando).
  const lastEtaCalcRef = useRef<{ at: number; pos: { lat: number; lng: number }; segment: string } | null>(null);
  const lastRealtimeFixRef = useRef(0);
  // Rondas seguidas en que la consulta de posición falló, para avisar en el
  // mapa en vez de dejarlo vacío sin explicación.
  const fallosRastreoRef = useRef(0);
  const [bootCheckDone, setBootCheckDone] = useState(false);
  // Filtro de la lista de viajes de la delegación. Vive aquí porque el banner
  // "En curso ahora" lo cambia al tocar "ver los N en curso".
  const [filtroViajes, setFiltroViajes] = useState("ACTIVOS");
  const listaViajesRef = useRef<HTMLDivElement | null>(null);
  // Traslado que el jefe fue a mirar en vivo desde el banner "Ahora mismo".
  const [focoViajeId, setFocoViajeId] = useState<string | null>(null);
  // Mapa en vivo dentro del banner: abierto o no, y en qué bus está centrado.
  const [mapaVivo, setMapaVivo] = useState<{ abierto: boolean; tripId: string | null }>({ abierto: false, tripId: null });
  const mapaVivoRef = useRef<HTMLDivElement | null>(null);

  /**
   * Todo lo que se puede pedir sabiendo sólo quién es el usuario, pedido de
   * una vez. Antes esto salía en cascada: la ficha, y recién cuando llegaba,
   * sus viajes; y recién cuando llegaban, los de su delegación. Tres esperas
   * seguidas contra un servidor que está a 300 ms.
   *
   * Lo de la delegación se pide con lo que se recordaba de la vez anterior;
   * si la ficha dice otra cosa, se descarta y se vuelve a pedir.
   */
  const pedirTandaInicial = (id: string) => {
    const perfil = leerPerfil(id);
    const comoJefe = perfil?.esJefe === true && !!perfil.delegationId;
    const delegacionPedida = comoJefe ? perfil!.delegationId! : null;
    return {
      delegacionPedida,
      ficha: apiFetch<Athlete>(`/athletes/${id}`),
      viajes: apiFetch<Trip[]>(`/trips?requesterAthleteId=${id}`).catch(() => [] as Trip[]),
      asignacion: apiFetch<HotelAssignment | null>(`/hotel-assignments/by-participant/${id}`).catch(() => null),
      viajesDelegacion: delegacionPedida
        ? apiFetch<Trip[]>("/trips").catch(() => [] as Trip[])
        : Promise.resolve(null),
      miembros: delegacionPedida
        ? apiFetch<Athlete[]>(`/athletes?delegationId=${encodeURIComponent(delegacionPedida)}`).catch(() => [] as Athlete[])
        : Promise.resolve(null),
    };
  };

  const loadAthlete = async (directId?: string) => {
    if (!directId && !athleteId) return;
    setLoading(true);
    setError(null);
    try {
      let data: Athlete;
      let tanda: ReturnType<typeof pedirTandaInicial> | null = null;
      if (directId) {
        // Auto-login por id (app / deep link). La credencial guardada se usa
        // de inmediato y las peticiones salen todas juntas. Si la sesión
        // había muerto, la primera respuesta es 401: ahí se reclama una
        // nueva y se reintenta una vez.
        const hayCredencial = usarIdentidadLocal("athlete", directId);
        if (!hayCredencial) await ensurePortalIdentity("athlete", directId);
        tanda = pedirTandaInicial(directId);
        try {
          data = await tanda.ficha;
        } catch (err) {
          if (!hayCredencial || (err as { status?: number })?.status !== 401) throw err;
          await ensurePortalIdentity("athlete", directId);
          tanda = pedirTandaInicial(directId);
          data = await tanda.ficha;
        }
        if (!data?.id) { setError("Sesión expirada."); return; }
      } else {
        const normalizedInput = athleteId.trim().toLowerCase();
        if (normalizedInput.length < 6) { setError(t("El código ingresado no es válido.")); return; }
        // Login server-side (SA-BACKEND-03): el backend resuelve el código.
        // Ya no se descarga el listado de participantes para matchear.
        let login: Awaited<ReturnType<typeof portalLogin>>;
        try {
          login = await portalLogin(normalizedInput);
        } catch {
          setError(t("El código ingresado no corresponde a un usuario registrado."));
          return;
        }
        if (login.kind !== "athlete") { setError(t("El código ingresado no corresponde a un usuario registrado.")); return; }
        // Sesión única: la sesión existente manda — si otro dispositivo tiene
        // la sesión viva, este login se rechaza con un mensaje.
        const claim = await claimPortalSession("athlete", login.athleteId);
        if (claim.activeElsewhere) { setError(SESSION_ACTIVE_ELSEWHERE_MSG); return; }
        data = await apiFetch<Athlete>(`/athletes/${login.athleteId}`);
        if (!data?.id || filterValidatedAthletes([data]).length === 0) {
          setError(t("El código ingresado no corresponde a un usuario registrado."));
          return;
        }
      }

      if (data.userType === "VIP") {
        // Conservar el contexto de la notificación (?tripId=) en el redirect.
        const extra = new URLSearchParams(window.location.search).get("tripId");
        window.location.href = `/portal/vehicle-request?athleteId=${data.id}${extra ? `&tripId=${encodeURIComponent(extra)}` : ""}`;
        return;
      }

      setAthlete(data);
      // La pantalla se pinta con la ficha del participante; el resto (sedes,
      // alimentación, viajes de la delegación) llega después y va llenando la
      // vista. Antes el esqueleto seguía hasta que terminaba la última
      // petición, y eran varios segundos mirando una pantalla gris.
      setLoading(false);
      try { sessionStorage.setItem("portal_user_id", data.id); } catch {}
      if (!directId) {
        // Login manual: siempre parte en el home.
        clearPersistedTabs();
        setActiveTab("actividades");
      }

      const conNombres = data as AthleteConNombres;
      const [flightData, hotelData, vehicleData, tripData, tripsList, assignmentData] = await Promise.all([
        data.arrivalFlightId ? apiFetch<Flight>(`/flights/${data.arrivalFlightId}`) : Promise.resolve(null),
        data.hotelAccommodationId ? apiFetch<Hotel>(`/accommodations/${data.hotelAccommodationId}`) : Promise.resolve(null),
        data.transportVehicleId ? apiFetch<Vehicle>(`/transports/${data.transportVehicleId}`) : Promise.resolve(null),
        data.transportTripId ? apiFetch<Trip>(`/trips/${data.transportTripId}`) : Promise.resolve(null),
        // Siempre se pide la lista, también cuando la ficha trae un viaje
        // fijado: ese puede ser antiguo y elegirlo a ciegas dejaba la tarjeta
        // mostrando un traslado posterior mientras otro estaba en ruta.
        // Al entrar por id ya salieron con la ficha: aquí sólo se recogen.
        tanda ? tanda.viajes : apiFetch<Trip[]>(`/trips?requesterAthleteId=${data.id}`).catch(() => [] as Trip[]),
        tanda ? tanda.asignacion : apiFetch<HotelAssignment | null>(`/hotel-assignments/by-participant/${data.id}`)
      ]);

      const assignment = assignmentData ? normalizeHA(assignmentData) : null;
      setFlight(flightData); setHotelAssignment(assignment);
      setEvent(conNombres.eventName ? ({ id: data.eventId ?? "", name: conNombres.eventName } as Event) : null);
      setDelegation(
        data.delegationId
          ? ({
              id: data.delegationId,
              countryCode: conNombres.delegationCountryCode ?? "",
              name: conNombres.delegationName ?? null,
            } as Delegation)
          : null,
      );

      const inferredTrip = elegirViajeActual([
        tripData,
        ...(tripsList || []).filter(
          (t) => t.requesterAthleteId === data.id || (t.athleteIds || []).includes(data.id),
        ),
      ]);
      setTrip(inferredTrip);

      // Hotel, vehículo, conductor, habitación y cama se pedían uno detrás de
      // otro: cinco esperas seguidas por datos que no dependen entre sí.
      const [hotelPorAsignacion, vehiculoDelViaje, listaConductores, habitacion, cama] = await Promise.all([
        assignment?.hotelId && (!hotelData || hotelData.id !== assignment.hotelId)
          ? apiFetch<Hotel>(`/accommodations/${assignment.hotelId}`).catch(() => null)
          : Promise.resolve(null),
        inferredTrip?.vehicleId && !vehicleData
          ? apiFetch<Vehicle>(`/transports/${inferredTrip.vehicleId}`).catch(() => null)
          : Promise.resolve(null),
        // /drivers ya incluye a los choferes de proveedor: sobraba el
        // segundo pedido y su busqueda de respaldo.
        inferredTrip?.driverId
          ? apiFetch<Driver[]>(`/drivers`).catch(() => [] as Driver[])
          : Promise.resolve([] as Driver[]),
        assignment?.roomId
          ? apiFetch<HotelRoom>(`/hotel-rooms/${assignment.roomId}`).catch(() => null)
          : Promise.resolve(null),
        assignment?.bedId
          ? apiFetch<HotelBed>(`/hotel-beds/${assignment.bedId}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      setHotel(hotelPorAsignacion ?? hotelData);
      setVehicle(vehiculoDelViaje ?? vehicleData);
      setDriver(
        inferredTrip?.driverId
          ? (listaConductores || []).find(
              (d) => d.id === inferredTrip.driverId || d.userId === inferredTrip.driverId,
            ) ?? null
          : null,
      );
      setHotelRoom(habitacion);
      setHotelBed(cama);

      const esJefe =
        data.isDelegationLead === true ||
        normalizeClientType(data.userType) === "JEFE_MISION";

      // Todo el resto de la pantalla en una sola tanda: en cascada eran seis
      // idas y vueltas más, que en el teléfono se notan al abrir la app.
      // Catálogos del evento: se pintan con lo último que se vio y se
      // refrescan por detrás. No bloquean la apertura de la app.
      const aplicarDisciplinas = (lista: CalendarEvent[]) => {
        const todas = Array.isArray(lista) ? lista : [];
        // Sin filtrar: hace falta para saber cómo se llama la disciplina de un
        // participante aunque esté registrada en otro evento (pasa: hay
        // deportes repetidos entre eventos y fichas que apuntan al de al lado).
        setDisciplinasTodas(todas);
        // El calendario es el de SU evento. El listado trae las disciplinas de
        // todos los eventos de la plataforma y se colaban actividades ajenas.
        const suyas = todas.filter((d) => !data.eventId || d.eventId === data.eventId);
        setDisciplineParents(suyas.filter((d) => !d.parentId));
        setCalendarEvents(
          suyas
            .filter((d) => d.parentId && d.scheduledAt)
            .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
        );
      };
      void catalogoConCache<CalendarEvent[]>("disciplines", () => apiFetch<CalendarEvent[]>("/disciplines"), aplicarDisciplinas);
      void catalogoConCache<Venue[]>("venues", () => apiFetch<Venue[]>("/venues"), (lista) =>
        setVenues((lista || []).filter(v => !data.eventId || v.eventId === data.eventId)));
      void catalogoConCache<Accommodation[]>("accommodations", () => apiFetch<Accommodation[]>("/accommodations"), (lista) =>
        setAllAccommodations(lista || []));
      void catalogoConCache<{ id: string; name?: string | null }[]>(
        "accommodation-names",
        () => apiFetch<{ id: string; name?: string | null }[]>("/accommodations/names"),
        (lista) => setNombresHoteles(lista || []),
      );
      // Alimentación visible para todos — sin filtrar por clientType
      void catalogoConCache<FoodLocation[]>("food-locations", () => apiFetch<FoodLocation[]>("/food-locations"), (lista) =>
        setFoodLocations(lista || []));
      void catalogoConCache<FoodMenu[]>("food-menus", () => apiFetch<FoodMenu[]>("/food-menus"), (lista) =>
        setFoodMenus(lista || []));

      // Para la próxima apertura: con esto, los viajes y la nómina de la
      // delegación salen junto con la ficha en vez de esperarla.
      guardarPerfil({ id: data.id, esJefe, delegationId: data.delegationId ?? null });

      // Si la tanda inicial ya pidió lo de la delegación correcta, se recoge;
      // si el usuario cambió de delegación desde la última vez, se descarta.
      const sirveLoPedido = !!tanda && tanda.delegacionPedida === (data.delegationId ?? null);

      const esComiteAhora = isEventCoordinator(data.userType);
      // Las regiones las usa el comité en su barra de filtros y ahora también
      // el calendario de cualquier perfil, así que se cargan siempre. Va por
      // el mismo caché de catálogos: no agrega una ida y vuelta al abrir.
      void catalogoConCache<DelegacionEvento[]>(
        "delegations",
        () => apiFetch<DelegacionEvento[]>("/delegations"),
        (lista) => setDelegacionesEvento((lista || []).filter((d) => !data.eventId || d.eventId === data.eventId)),
      );

      // Lo que sí es propio del usuario se espera: es lo que se ve primero.
      const [prems, miembros, viajesDelegacion] = await Promise.all([
        // Premiaciones: el Jefe de Misión no tiene esa pestaña.
        esJefe ? Promise.resolve([] as Premiacion[]) : apiFetch<Premiacion[]>("/premiaciones").catch(() => [] as Premiacion[]),
        // Sólo los participantes de su delegación, filtrados en el servidor.
        esJefe && data.delegationId
          ? (sirveLoPedido && tanda
              ? tanda.miembros
              : apiFetch<Athlete[]>(`/athletes?delegationId=${encodeURIComponent(data.delegationId)}`).catch(() => [] as Athlete[]))
          : Promise.resolve([] as Athlete[]),
        // Viajes: el backend los acota a la delegación del jefe, y al
        // Coordinador de Comité le entrega los del evento entero.
        esComiteAhora
          ? apiFetch<Trip[]>("/trips").catch(() => [] as Trip[])
          : esJefe && data.delegationId
          ? (sirveLoPedido && tanda ? tanda.viajesDelegacion : apiFetch<Trip[]>("/trips").catch(() => [] as Trip[]))
          : Promise.resolve([] as Trip[]),
      ]);
      setPremiaciones(Array.isArray(prems) ? prems : []);
      setDelegationMembers((miembros || []).filter(a => a.id !== data.id));
      setDelegationTrips(Array.isArray(viajesDelegacion) ? viajesDelegacion : []);

      // Load health record from athlete metadata
      const hr = (data as any).metadata?.healthRecord ?? null;
      setHealthRecord(hr);

    } catch (err) {
      const status = (err as { status?: number })?.status;
      let message = err instanceof Error ? err.message : "";
      try { const p = JSON.parse(message); if (p?.message) message = p.message; } catch {}
      if (status === 404 || /not found/i.test(message)) {
        // El participante ya no existe: fue dado de baja o purgado después de
        // que este dispositivo entró. Antes se mostraba el error del backend
        // tal cual ("Athlete with id … not found") y la sesión guardada
        // volvía a fallar en cada apertura. Se olvida y se pide el código.
        if (directId) {
          clearPortalSession("athlete", directId);
          try { sessionStorage.removeItem("portal_user_id"); } catch {}
          setAthleteId("");
          setError(t("Tu acceso anterior ya no está vigente. Ingresa tu código para volver a entrar."));
          const sesionApp = getMobileSession();
          if (sesionApp?.kind === "athlete" && sesionApp.athleteId === directId) mobileAwareLogout();
        } else {
          setError(t("El código ingresado no corresponde a un usuario registrado."));
        }
      } else {
        setError(message || t("No se pudo cargar"));
      }
      setFlight(null); setHotel(null); setVehicle(null); setDriver(null); setTrip(null);
      setEvent(null); setDelegation(null); setHotelAssignment(null); setHotelRoom(null); setHotelBed(null);
    } finally { setLoading(false); }
  };

  const mark = async (field: "airportCheckinAt" | "hotelCheckinAt" | "hotelCheckoutAt") => {
    if (!athlete) return;
    setMarkLoading(field);
    setError(null);
    try {
      const now = new Date().toISOString();
      const updated = await apiFetch<Athlete>(`/athletes/${athlete.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: now })
      });
      setAthlete(updated);
      if (hotelAssignment?.id && (field === "hotelCheckinAt" || field === "hotelCheckoutAt")) {
        const ap = field === "hotelCheckinAt" ? { checkinAt: now } : { checkoutAt: now };
        try { await apiFetch(`/hotel-assignments/${hotelAssignment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ap) }); } catch {}
        setHotelAssignment((prev) => prev ? { ...prev, ...(field === "hotelCheckinAt" ? { checkinAt: now } : { checkoutAt: now }) } : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally { setMarkLoading(null); }
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true); setRequestError(null); setRequestStatus(null);
    try {
      const response = await apiFetch<{ message?: string }>(`/athletes/request-access`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: requestEmail })
      });
      setRequestStatus(response?.message || t("Código enviado al correo"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      let message = raw;
      try { const p = JSON.parse(raw); if (p?.message) message = p.message; } catch {}
      if (message.includes("encargado de delegación") || message.includes("participante registrado")) {
        message = t("El correo ingresado no está autorizado para solicitar el código.");
      }
      setRequestError(message || t("No se pudo actualizar"));
    } finally { setRequestLoading(false); }
  };

  // ── Coupons: load available + claims when athlete is known ──
  const loadCoupons = async (athleteId: string, userType: string) => {
    setCouponError(null);
    try {
      const [list, claims] = await Promise.all([
        apiFetch<Coupon[]>(`/coupons/for-user?userType=${encodeURIComponent(userType || "ATHLETE")}`),
        apiFetch<CouponClaim[]>(`/coupons/claims/mine?userId=${encodeURIComponent(athleteId)}`),
      ]);
      setCouponsAvailable(Array.isArray(list) ? list : []);
      setCouponClaims(Array.isArray(claims) ? claims : []);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "No se pudieron cargar los beneficios");
    }
  };

  useEffect(() => {
    if (!athlete?.id) return;
    loadCoupons(athlete.id, athlete.userType || "ATHLETE");
  }, [athlete?.id, athlete?.userType]);

  const visibleCouponsAvailable = useMemo(() => {
    return couponsAvailable.map((c) => {
      const activeClaims = couponClaims.filter(
        (m) => m.couponId === c.id && (m.status === "CLAIMED" || m.status === "REDEEMED"),
      );
      const limit = c.perUserLimit || 1;
      return { ...c, _used: activeClaims.length, _exhausted: activeClaims.length >= limit };
    });
  }, [couponsAvailable, couponClaims]);

  const claimCoupon = async (couponId: string) => {
    if (!athlete?.id) return;
    setCouponClaiming(couponId);
    setCouponError(null);
    try {
      const result = await apiFetch<CouponClaim>(`/coupons/${couponId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: athlete.id,
          userType: athlete.userType || "ATHLETE",
          userName: athlete.fullName || undefined,
        }),
      });
      const coupon = couponsAvailable.find((c) => c.id === couponId);
      setActiveClaim({ ...result, coupon });
      await loadCoupons(athlete.id, athlete.userType || "ATHLETE");
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Error reclamando");
    } finally {
      setCouponClaiming(null);
    }
  };

  useEffect(() => {
    if (!activeClaim) {
      setCouponQrDataUrl("");
      return;
    }
    QRCode.toDataURL(activeClaim.qrToken, {
      width: 320,
      margin: 2,
      color: { dark: "#1f2937", light: SURFACE.card },
      errorCorrectionLevel: "M",
    }).then(setCouponQrDataUrl).catch(() => setCouponQrDataUrl(""));
  }, [activeClaim]);

  const submitRating = async () => {
    if (!trip || ratingStars === 0) return;
    setRatingLoading(true);
    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverRating: ratingStars,
          ratingComment: ratingComment.trim() || undefined,
          ratedAt: new Date().toISOString(),
        }),
      });
      setTrip({ ...trip, driverRating: ratingStars });
      notify.push("¡Gracias por tu evaluación!", "star");
      setShowRating(false);
      setRatingStars(0);
      setRatingComment("");
    } catch {
      notify.push("No se pudo enviar la evaluación", "error");
    } finally {
      setRatingLoading(false);
    }
  };

  /* ─── trip polling + driver ETA + notifications ─── */
  const notifyStatusChange = (status: string) => {
    const msgs: Record<string, { message: string; emoji: string }> = {
      EN_ROUTE:    { message: "El conductor está en camino a recogerte", emoji: "car" },
      PICKED_UP:   { message: "¡Estás en ruta a tu destino!", emoji: "ok" },
      DROPPED_OFF: { message: "Has llegado a tu destino", emoji: "pin" },
      COMPLETED:   { message: "Viaje completado", emoji: "ok" },
      SCHEDULED:   { message: "Tu traslado fue programado", emoji: "cal" },
    };
    const info = msgs[status];
    if (!info) return;
    notify.push(info.message, info.emoji);
  };

  const fixMetersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const calculateEta = (
    driverLatLng: { lat: number; lng: number },
    tripStatus: string | null | undefined,
    tripOrigin: string | null | undefined,
    tripDestination: string | null | undefined,
  ) => {
    const google = (window as any).google;
    if (!google?.maps?.DistanceMatrixService) return;

    // EN_ROUTE → conductor va al punto de recogida (origin)
    // PICKED_UP → conductor va al destino final
    const target = tripStatus === "EN_ROUTE" ? tripOrigin : tripDestination;
    if (!target) return;

    const segmentKey = `${tripStatus}`;

    // Throttle: con Realtime llegan fixes cada ~5 s y DistanceMatrix se cobra
    // por consulta — recalcular solo si cambió el tramo, pasaron 20 s o el
    // conductor se movió más de 150 m.
    const last = lastEtaCalcRef.current;
    if (
      last &&
      last.segment === segmentKey &&
      Date.now() - last.at < 20000 &&
      fixMetersBetween(last.pos, driverLatLng) < 150
    ) {
      return;
    }
    lastEtaCalcRef.current = { at: Date.now(), pos: driverLatLng, segment: segmentKey };

    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      { origins: [driverLatLng], destinations: [target], travelMode: "DRIVING" },
      (response: any, status: string) => {
        if (status !== "OK") return;
        const el = response?.rows?.[0]?.elements?.[0];
        if (el?.status !== "OK") return;
        setDriverEta({ distance: el.distance.text, duration: el.duration.text });

        // Notificación de proximidad: < 3 minutos y aún no notificamos este tramo
        const durationSecs: number = el.duration.value;
        if (durationSecs <= 180 && arrivedNotified.current !== segmentKey) {
          arrivedNotified.current = segmentKey;
          if (tripStatus === "EN_ROUTE") {
            notify.push("El conductor está llegando a recogerte", "car");
          } else if (tripStatus === "PICKED_UP") {
            notify.push("Estás llegando a tu destino", "pin");
          }
        }
      }
    );
  };

  // Acepta las tres formas en que llega una posición: lat/lng al tope (REST
  // nuevo y payload Realtime), GeoJSON Point en location, o lat/lng anidados.
  const parseFixLatLng = (pos: any): { lat: number; lng: number } | null => {
    if (!pos) return null;
    if (typeof pos.lat === "number" && typeof pos.lng === "number") {
      return { lat: pos.lat, lng: pos.lng };
    }
    const loc = pos.location as any;
    if (
      Array.isArray(loc?.coordinates) &&
      loc.coordinates.length >= 2 &&
      typeof loc.coordinates[0] === "number" &&
      typeof loc.coordinates[1] === "number"
    ) {
      return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
    if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number") {
      return { lat: loc.latitude, lng: loc.longitude };
    }
    return null;
  };

  const handleDriverFix = (
    latLng: { lat: number; lng: number },
    tripStatus: string | null | undefined,
    tripOrigin: string | null | undefined,
    tripDestination: string | null | undefined,
  ) => {
    setDriverPos(latLng);
    if (tripStatus === "EN_ROUTE" || tripStatus === "PICKED_UP") {
      calculateEta(latLng, tripStatus, tripOrigin, tripDestination);
    } else {
      setDriverEta(null);
    }
  };

  // Show rating when trip completes (outside polling, catches any missed state)
  useEffect(() => {
    if (!trip) return;
    if ((trip.status === "COMPLETED" || trip.status === "DROPPED_OFF") && !trip.driverRating) {
      setShowRating(true);
    }
  }, [trip?.status]);

  useEffect(() => {
    if (!trip) return;
    const activeStatuses = ["SCHEDULED", "EN_ROUTE", "PICKED_UP"];
    if (!activeStatuses.includes(trip.status ?? "")) return;

    // Request browser notification permission once
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    prevTripStatus.current = trip.status ?? null;
    arrivedNotified.current = null;

    const poll = async () => {
      try {
        const updated = await apiFetch<Trip>(`/trips/${trip.id}`);
        if (updated.status !== prevTripStatus.current) {
          const prev = prevTripStatus.current;
          prevTripStatus.current = updated.status ?? null;
          arrivedNotified.current = null; // reset proximity alert for the new segment
          notifyStatusChange(updated.status ?? "");
          setTrip(updated);
          // Show rating popup when trip completes (and hasn't been rated yet)
          if ((updated.status === "COMPLETED" || updated.status === "DROPPED_OFF") && !updated.driverRating) {
            setShowRating(true);
          }
        }

        if (["EN_ROUTE", "PICKED_UP"].includes(updated.status ?? "")) {
          // Respaldo REST: solo si Realtime no entregó un fix hace poco.
          if (Date.now() - lastRealtimeFixRef.current > 12000) {
            // El fix se etiqueta con el viaje activo al ingresar, así que la
            // clave más confiable es el viaje; driver y vehículo son respaldo
            // (muchos viajes no tienen vehicle_id).
            // Un catch vacío hacía indistinguibles dos casos muy distintos:
            // que aún no haya posición (normal al inicio del viaje) y que la
            // consulta falle (403, backend caído, pool de conexiones lleno).
            // En ambos el mapa quedaba sin ícono y nadie se enteraba del error.
            let falloConsulta = false;
            const pedirFix = async (ruta: string) => {
              try {
                return await apiFetch<any>(ruta);
              } catch (err) {
                falloConsulta = true;
                console.warn(`[rastreo] no se pudo leer la posición en ${ruta}:`, err);
                return null;
              }
            };

            let pos = await pedirFix(`/vehicle-positions/by-trip/${trip.id}/latest`);
            if (!parseFixLatLng(pos)) {
              const driverId = updated.driverId ?? trip.driverId;
              if (driverId) {
                pos = await pedirFix(`/vehicle-positions/by-driver/${driverId}`);
              }
            }
            if (!parseFixLatLng(pos)) {
              const vehicleId = updated.vehicleId ?? trip.vehicleId;
              if (vehicleId) {
                pos = await pedirFix(`/vehicle-positions/by-vehicle/${vehicleId}`);
              }
            }
            const latLng = parseFixLatLng(pos);
            if (latLng) {
              fallosRastreoRef.current = 0;
              setRastreoCaido(false);
              handleDriverFix(
                latLng,
                updated.status,
                updated.origin ?? trip.origin,
                updated.destination ?? trip.destination,
              );
            } else if (falloConsulta) {
              // Tres rondas seguidas fallando (~15 s) antes de avisar: así un
              // corte puntual de red no alarma al jefe de misión.
              fallosRastreoRef.current += 1;
              if (fallosRastreoRef.current >= 3) setRastreoCaido(true);
            }
          }
        } else {
          setDriverEta(null);
        }
      } catch {
        // non-blocking
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.status]);

  /* ─── Supabase Realtime: posición del conductor en vivo ───
     Cada INSERT en telemetry.vehicle_positions del conductor del viaje llega
     por WebSocket (50–200 ms) y mueve el auto en el mapa al instante. El
     polling de arriba queda como respaldo si el canal no conecta. */
  useEffect(() => {
    if (!trip?.id || !trip.driverId) return;
    if (!["EN_ROUTE", "PICKED_UP"].includes(trip.status ?? "")) return;

    let channel: any = null;
    let supabase: any = null;
    let cancelled = false;
    (async () => {
      try {
        supabase = getSupabase();
      } catch {
        // Sin credenciales de Supabase en el build: seguimos solo con polling.
        return;
      }
      // RLS por participación (SA-BACKEND-02): sin este token el canal no
      // entrega filas y el portal queda en el polling REST autenticado.
      await ensurePortalRealtimeAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`trip-tracking-${trip.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "telemetry",
            table: "vehicle_positions",
            filter: `driver_id=eq.${trip.driverId}`,
          },
          (payload: any) => {
            const latLng = parseFixLatLng(payload?.new);
            if (!latLng) return;
            lastRealtimeFixRef.current = Date.now();
            handleDriverFix(latLng, trip.status, trip.origin, trip.destination);
          },
        )
        .subscribe();
    })();

    // El JWT de portal dura 1 h: refrescarlo mantiene viva la suscripción.
    const tokenTimer = window.setInterval(() => {
      void ensurePortalRealtimeAuth();
    }, 40 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(tokenTimer);
      if (channel && supabase) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.status, trip?.driverId]);

  /* ─── user geolocation + send to backend (Safari-friendly) ─── */
  useEffect(() => {
    if (!athlete || !navigator.geolocation) return;
    let cleared = false;
    let watchId: number | null = null;
    let fallbackInterval: number | null = null;
    let gotPosition = false;

    const onPos = (pos: GeolocationPosition) => {
      gotPosition = true;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserPos(coords);
      if (trip?.id && ["EN_ROUTE", "PICKED_UP"].includes(trip.status ?? "")) {
        apiFetch(`/trips/${trip.id}/passenger-position`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
        }).catch(() => {});
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 };

    navigator.geolocation.getCurrentPosition(onPos, () => {}, opts);
    watchId = navigator.geolocation.watchPosition(onPos, () => {}, opts);

    // Safari fallback: poll if watchPosition doesn't fire
    setTimeout(() => {
      if (!gotPosition && !cleared) {
        fallbackInterval = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 });
        }, 5000);
      }
    }, 10000);

    return () => {
      cleared = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackInterval) window.clearInterval(fallbackInterval);
    };
  }, [athlete?.id]);

  /* ─── helpers ─── */
  const initials = athlete?.fullName
    ? athlete.fullName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()
    : "?";

  /**
   * Foto del participante, desde su propio portal.
   *
   * Hasta ahora sólo la cargaba el staff desde el panel —de a una en la ficha
   * o en masa calzando el nombre del archivo—, así que quien no aparecía en
   * esa carga se quedaba sin foto y sacaba su credencial con iniciales. El
   * conductor ya podía subirla desde su portal; el participante no.
   *
   * Se actualiza sólo `metadata.photoUrl` y no la ficha entera: la respuesta
   * del endpoint no trae el nombre del evento ni el de la delegación, que el
   * portal resuelve aparte y perdería la tarjeta de perfil.
   */
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  /**
   * Lo que se acaba de elegir, para mostrarlo de inmediato mientras sube.
   * Sin esto la pantalla no cambiaba hasta que la respuesta volvía del
   * servidor, y parecía que el botón no había hecho nada.
   */
  const [fotoPrevia, setFotoPrevia] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  /**
   * Sirve tanto la del servidor (https) como la recién elegida, que es un
   * data: URL. Mirar sólo "http" dejaba la vista previa sin dibujar y había
   * que recargar la app para ver la foto nueva.
   */
  const fotoMostrable = (valor: unknown): string | null => {
    const url = typeof valor === "string" ? valor.trim() : "";
    return url.startsWith("http") || url.startsWith("data:image") ? url : null;
  };
  const fotoActual = fotoPrevia ?? fotoMostrable(athlete?.metadata?.photoUrl);

  /**
   * El <input> vive en el JSX y no se crea al vuelo con createElement: al
   * abrir la cámara, Android puede descartar la vista web para liberar
   * memoria y, al volver, un elemento suelto —y su onchange— ya no existen.
   * Era por qué la segunda foto no subía.
   */
  const alElegirFoto = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    // Se limpia siempre: si no, volver a elegir el mismo archivo no dispara
    // el evento y el botón queda mudo.
    evento.target.value = "";
    if (!archivo || !athlete?.id) return;

    setSubiendoFoto(true);
    try {
      const dataUrl = await prepararFoto(archivo);
      setFotoPrevia(dataUrl);
      const actualizado = await apiFetch<{ metadata?: Record<string, unknown> }>(
        `/athletes/${athlete.id}/photo`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) },
      );
      const nueva = actualizado?.metadata?.photoUrl;
      if (typeof nueva === "string" && nueva) {
        setAthlete((previo) =>
          previo ? { ...previo, metadata: { ...(previo.metadata ?? {}), photoUrl: nueva } } : previo,
        );
      }
      // La previa se queda puesta: es la misma foto y ya está en pantalla.
      // Cambiarla por la del servidor obligaría a descargarla de nuevo y la
      // imagen parpadearía por nada. Se suelta sola al recargar la ficha.
      notify.push("Foto actualizada", "camera");
    } catch {
      // La previa se descarta: dejarla puesta haría creer que quedó guardada.
      setFotoPrevia(null);
      notify.push("No se pudo subir la foto", "error");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const checkins = [
    { key: "airportCheckinAt" as const, label: t("Aeropuerto"), ts: athlete?.airportCheckinAt },
    { key: "hotelCheckinAt" as const, label: t("Hotel check-in"), ts: athlete?.hotelCheckinAt },
    { key: "hotelCheckoutAt" as const, label: t("Hotel check-out"), ts: athlete?.hotelCheckoutAt },
  ];

  /* ══════════════════════════════════════════════════════════
     BOOT LOADER (mobile auto-login in progress)
  ══════════════════════════════════════════════════════════ */
  // Al restaurar sesión (refresh o auto-login móvil) NO se muestra la pantalla
  // de marca: solo un fondo neutro con un spinner discreto, para que la
  // recarga se sienta como una actualización y no como un arranque de la app.
  if ((!athlete && !bootCheckDone) || !sessionChecked) {
    return (
      <PortalSkeleton tabs={6} cards={4} />
    );
  }

  if (!athlete) return (
    <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes pu-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
        @keyframes pu-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
        @keyframes pu-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
        @keyframes pu-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes pu-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .pu-form{animation:pu-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
        .pu-input:focus{border-color:rgba(33,208,179,0.6)!important;box-shadow:0 0 0 3px rgba(33,208,179,0.12)!important;}
        @media(max-width:640px){
          .pu-form{padding:0 4px;}
          .pu-input{padding:14px!important;font-size:16px!important;}
        }
      `}</style>

      {/* Left branding */}
      <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
        style={{ background: `linear-gradient(160deg,#020c18 0%,${BRAND.navy} 40%,${BRAND.navyLight} 70%,#030f1e 100%)`, position: "relative", overflow: "hidden", minHeight: "180px" }}>
        <div style={{ position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`,backgroundSize:"60px 60px" }} />
        <div style={{ position:"absolute",top:"-60px",left:"-60px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)",animation:"pu-f1 12s ease-in-out infinite",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:"60px",right:"-40px",width:"320px",height:"320px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)",animation:"pu-f2 16s ease-in-out infinite",pointerEvents:"none" }} />
        {[480,340,200].map((size,i) => (
          <div key={i} style={{ position:"absolute",top:"50%",left:"50%",marginTop:-size/2,marginLeft:-size/2,width:size,height:size,borderRadius:"50%",border:`1px solid rgba(33,208,179,${0.04+i*0.04})`,animation:`pu-pulse 6s ease-in-out infinite ${i*2}s`,pointerEvents:"none" }} />
        ))}
        <div style={{ position:"relative",zIndex:1 }}>
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
        </div>
        <div style={{ position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:"16px",padding:"24px 0" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:"8px",width:"fit-content" }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:BRAND.teal,boxShadow:`0 0 10px ${BRAND.teal}`,display:"inline-block",animation:"pu-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.teal }}>Portal de Participantes</span>
          </div>
          <h1 style={{ fontSize:"clamp(28px,3vw,44px)",fontWeight:800,lineHeight:1.1,color:SURFACE.bg,letterSpacing:"-0.02em",margin:0 }}>
            Tu itinerario<br />
            <span style={{ background:`linear-gradient(90deg,${BRAND.teal} 0%,${BRAND.tealLight} 40%,${BRAND.teal} 80%)`,backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"pu-shimmer 4s linear infinite" }}>en tiempo real</span>
          </h1>
          <p className="hidden sm:block" style={{ fontSize:"14px",color:"rgba(255,255,255,0.45)",maxWidth:"340px",lineHeight:1.7,margin:0 }}>
            Accede a tu vuelo, hotel y transporte asignado. Confirma cada etapa de tu llegada al evento.
          </p>
          <div className="hidden lg:flex flex-col" style={{ gap:"10px",marginTop:"8px" }}>
            {([
              [<IcoPlane key="p"/>, "Información de vuelo"],
              [<IcoHotel key="h"/>, "Hotel y habitación"],
              [<IcoCar key="c"/>, "Transporte asignado"],
            ] as [React.ReactNode, string][]).map(([icon, label]) => (
              <div key={label} style={{ display:"flex",alignItems:"center",gap:"10px",color:"rgba(33,208,179,0.8)" }}>
                {icon}
                <span style={{ fontSize:"13px",color:"rgba(255,255,255,0.6)",fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:flex" style={{ position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"20px" }}>
          {[["Acceso seguro","SSL / HTTPS"],["Datos live","Tiempo real"],["Multi-evento","Global"]].map(([title,sub],i,arr) => (
            <div key={title} style={{ flex:1,paddingRight:i<arr.length-1?"20px":"0",borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.06)":"none",paddingLeft:i>0?"20px":"0" }}>
              <p style={{ fontSize:"14px",fontWeight:800,color:BRAND.teal,margin:0,lineHeight:1 }}>{title}</p>
              <p style={{ fontSize:"10px",color:"rgba(255,255,255,0.32)",margin:"3px 0 0",letterSpacing:"0.05em",textTransform:"uppercase" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-16"
        style={{ background:`linear-gradient(160deg,#030f1e 0%,${BRAND.navy} 50%,#020c18 100%)`,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(6,34,64,0.4) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:"-50px",right:"-50px",width:"280px",height:"280px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.08) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div className="pu-form relative z-10 w-full" style={{ maxWidth:"420px" }}>
          <h2 style={{ fontSize:"24px",fontWeight:700,color:"rgba(255,255,255,0.95)",marginBottom:"6px" }}>{t("Acceder al portal")}</h2>
          <p style={{ fontSize:"13px",color:"rgba(255,255,255,0.4)",marginBottom:"28px",lineHeight:1.6 }}>
            {t("Ingresa tu código de participante para ver tu información asignada.")}
          </p>
          <div style={{ display:"grid",gap:"12px" }}>
            <div>
              <span style={{ fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",display:"block",marginBottom:"8px" }}>{t("Código de acceso")}</span>
              <input className="pu-input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} onKeyDown={(e) => e.key==="Enter" && loadAthlete()}
                placeholder={t("Ingresa tu código")}
                inputMode="text" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(33,208,179,0.2)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.9)",fontSize:"15px",outline:"none",fontWeight:500,boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s" }} />
            </div>
            <button type="button" onClick={() => loadAthlete()} disabled={loading}
              style={{ width:"100%",padding:"17px",borderRadius:"14px",border:"none",background:`linear-gradient(135deg,${BRAND.tealLight} 0%,${BRAND.teal} 50%,#15B09A 100%)`,color:SURFACE.text,fontSize:"16px",fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,letterSpacing:"0.03em",boxShadow:"0 4px 20px rgba(33,208,179,0.35)",transition:"opacity .2s,transform .1s" }}>
              {loading ? t("Cargando...") : t("Ver mi información")}
            </button>
            {error && <p style={{ color:STATE.dangerBorder,fontSize:"13px",textAlign:"center",margin:0 }}>{error}</p>}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"12px",margin:"24px 0" }}>
            <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize:"11px",color:"rgba(255,255,255,0.25)",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{t("¿NO TIENES CÓDIGO?")}</span>
            <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.08)" }} />
          </div>
          <div style={{ display:"grid",gap:"12px" }}>
            <div>
              <span style={{ fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",display:"block",marginBottom:"8px" }}>{t("Correo electrónico")}</span>
              <input className="pu-input" type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} onKeyDown={(e) => e.key==="Enter" && requestAccess()}
                placeholder="email@dominio.com"
                style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.9)",fontSize:"15px",outline:"none",fontWeight:500,boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s" }} />
            </div>
            <button type="button" onClick={requestAccess} disabled={requestLoading}
              style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(33,208,179,0.25)",background:"rgba(33,208,179,0.06)",color:"rgba(255,255,255,0.8)",fontSize:"15px",fontWeight:500,cursor:requestLoading?"not-allowed":"pointer",opacity:requestLoading?0.7:1,transition:"opacity .2s" }}>
              {requestLoading ? t("Enviando...") : t("Solicitar código")}
            </button>
            {requestStatus && <p style={{ color:"#6ee7b7",fontSize:"13px",margin:0 }}>{requestStatus}</p>}
            {requestError && <p style={{ color:STATE.dangerBorder,fontSize:"13px",margin:0 }}>{requestError}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════════════════════════ */
  const flightLabel = flight
    ? `${flight.airline} · ${flight.flightNumber}`
    : athlete.airline || athlete.flightNumber
    ? `${athlete.airline || "—"} · ${athlete.flightNumber || "—"}`
    : null;

  const hotelRoom_ = hotelRoom?.roomNumber || athlete.roomNumber;
  const hotelBed_ = hotelBed?.bedType || athlete.bedType;
  const luggage_ = luggageLabels[athlete.luggageType ?? ""] || athlete.luggageType;
  const vehicleLabel = vehicle ? `${vehicle.type} · ${vehicle.plate}` : null;
  const checkinsDone = checkins.filter(c => !!fmt(c.ts)).length;

  return (
    <div style={{ minHeight:"100vh", background:"#eef1f8", position:"relative", overflow:"hidden" }}>
      <PushTokenSync userKind="athlete" userId={athlete?.id || null} />
      {athlete && (
        <PortalSessionGuard
          kind="athlete"
          userId={athlete.id}
          onInvalid={() => {
            clearPortalSession("athlete", athlete.id);
            try { sessionStorage.removeItem("portal_user_id"); } catch {}
            clearPersistedTabs();
            setAthlete(null);
            setAthleteId("");
            setActiveTab("itinerario");
            setError("Tu sesión expiró y esta cuenta inició sesión en otro dispositivo.");
          }}
        />
      )}
      {/* SofIA en modo consulta: sólo para el Jefe de Misión y sólo su región. */}
      {/* Un solo soporte flotante a la vez: con la sala de asistencia abierta
          la burbuja de SofIA quedaba encima del botón de enviar. */}
      {athlete && isChief && !assistOpen && <SofiaWidget compact />}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes db-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes db-badge{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes db-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes db-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes db-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        .db-card{
          animation:db-in .5s cubic-bezier(0.16,1,0.3,1) both;
          background:#fff;
          border:1px solid rgba(226,232,240,0.8);
          border-radius:24px;
          padding:24px;
          position:relative;
          overflow:hidden;
          box-shadow:0 2px 16px rgba(0,0,0,0.05);
          transition:box-shadow .3s,border-color .3s,transform .3s;
        }
        .db-card:nth-child(1){animation-delay:0.07s}
        .db-card:nth-child(2){animation-delay:0.14s}
        .db-card:nth-child(3){animation-delay:0.21s}
        .db-card:nth-child(4){animation-delay:0.28s}
        .db-card:hover{
          box-shadow:0 8px 32px rgba(33,208,179,0.14);
          border-color:rgba(33,208,179,0.28);
          transform:translateY(-2px);
        }
        .db-action-btn{
          transition:all .25s cubic-bezier(0.16,1,0.3,1);
          position:relative;
          overflow:hidden;
          width:100%;
        }
        .db-action-btn::after{
          content:'';
          position:absolute;
          inset:0;
          background:linear-gradient(rgba(255,255,255,0.15),transparent);
          opacity:0;
          transition:opacity .2s;
        }
        .db-action-btn:hover:not(:disabled)::after{opacity:1;}
        .db-action-btn:hover:not(:disabled){transform:translateY(-2px);}
        .db-action-btn:active:not(:disabled){transform:translateY(0);}
        .db-logout:hover{background:#f1f5f9!important;border-color:#cbd5e1!important;color:#334155!important;}
        .db-banner-glow{animation:db-glow 3s ease-in-out infinite;}

        /* ── Responsive ── */
        .db-banner-inner{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;max-width:960px;margin:0 auto;position:relative;z-index:1;}
        .db-banner-logo{height:52px;width:auto;object-fit:contain;filter:drop-shadow(0 0 18px rgba(33,208,179,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.8));}
        .db-banner-tag{display:flex;align-items:center;gap:8px;}
        .db-banner-tag span{font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(33,208,179,0.9);}
        .db-content{max-width:920px;margin:0 auto;padding:24px 16px 72px;position:relative;z-index:1;}
        .db-profile-card{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;animation:db-in .4s cubic-bezier(0.16,1,0.3,1) both;box-shadow:0 4px 24px rgba(0,0,0,0.06);position:relative;overflow:hidden;}
        .db-profile-body{display:flex;align-items:center;gap:20px;min-width:0;}
        .db-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${BRAND.teal} 0%,${BRAND.navyLight} 100%);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;box-shadow:0 6px 24px rgba(33,208,179,0.4);letter-spacing:-0.02em;flex-shrink:0;}
        .db-profile-name{font-size:clamp(18px,2.5vw,26px);font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.15;word-break:break-word;}
        .db-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;}
        .db-actions-card{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;margin-bottom:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);animation:db-in .5s cubic-bezier(0.16,1,0.3,1) both;animation-delay:.32s;position:relative;overflow:hidden;}
        .db-actions-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}
        .db-logout-label{display:inline;}

        @media(max-width:640px){
          .db-banner-inner{padding:8px 14px;}
          .db-banner-logo{height:30px!important;}
          .db-banner-tag span{font-size:8px;letter-spacing:0.1em;}
          .db-content{padding:10px 10px 40px;}
          .db-profile-card{padding:14px 14px 10px;gap:0;flex-direction:column;align-items:stretch;border-radius:18px;margin-bottom:10px;}
          .db-profile-body{gap:12px;margin-bottom:10px;}
          .db-avatar{width:42px!important;height:42px!important;font-size:14px!important;box-shadow:0 3px 12px rgba(33,208,179,0.3)!important;}
          .db-profile-name{font-size:17px!important;margin-bottom:5px!important;}
          .db-profile-btns{display:flex!important;gap:6px;width:100%;}
          .db-profile-btns .db-logout-btn{flex:1;justify-content:center;padding:8px 10px!important;font-size:11px!important;border-radius:10px!important;}
          .db-logout-label{display:inline!important;}
          .db-cards-grid{grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
          .db-card{padding:12px;border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,0.04);}
          .db-card .db-card-icon{width:28px!important;height:28px!important;border-radius:8px!important;}
          .db-card .db-card-header{margin-bottom:8px!important;gap:8px!important;}
          .db-card .db-card-title{font-size:14px!important;}
          .db-card .db-card-subtitle{font-size:11px!important;}
          .db-actions-card{padding:12px;border-radius:14px;margin-bottom:10px;}
          .db-actions-grid{grid-template-columns:1fr;gap:8px;}
          .db-action-btn{padding:13px 14px!important;border-radius:12px!important;font-size:13px!important;min-height:44px!important;}
        }

        @media(max-width:400px){
          .db-banner-tag{display:none;}
          .db-cards-grid{grid-template-columns:1fr 1fr;gap:8px;}
        }
      ` }} />

      {/* Decorative background shapes */}
      <div style={{ position:"fixed",top:"-120px",right:"-120px",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.07) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />
      <div style={{ position:"fixed",bottom:"-80px",left:"-80px",width:"380px",height:"380px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.06) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />

      {/* ── Top banner ── */}
      <div style={{ position:"relative",background:`linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyLight} 45%,#0a3356 80%,${BRAND.navy} 100%)`,overflow:"hidden",zIndex:1 }}>
        {/* Banner grid lines */}
        <div style={{ position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)`,backgroundSize:"48px 48px",pointerEvents:"none" }} />
        {/* Banner glow accent */}
        <div className="db-banner-glow" style={{ position:"absolute",bottom:"-1px",left:"0",right:"0",height:"2px",background:`linear-gradient(90deg,transparent,${BRAND.teal} 30%,${BRAND.tealLight} 50%,${BRAND.teal} 70%,transparent)`,pointerEvents:"none" }} />
        <div className="db-banner-inner">
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="db-banner-logo" />
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <NotificationBell
              notifications={notify.notifications}
              unreadCount={notify.unreadCount}
              onMarkAllRead={notify.markAllRead}
              onClear={notify.clear}
            />
            {!isTA && (
              <button type="button" onClick={() => { setAssistCategoria(null); setAssistOpen((p) => !p); }} title="Asistencia"
                style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:`1px solid ${assistOpen ? "rgba(52,243,198,0.7)" : "rgba(33,208,179,0.4)"}`,background: assistOpen ? "linear-gradient(135deg,rgba(52,243,198,0.28),rgba(33,208,179,0.18))" : "rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,transition:"all .15s" }}>
                <HeadphonesIcon size={15} color={BRAND.teal} strokeWidth={2} />
              </button>
            )}
            <button type="button" onClick={() => { if (athlete) void loadAthlete(athlete.id); }} disabled={loading} title="Actualizar"
              style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,opacity:loading?0.5:1 }}>
              <RefreshIcon size={14} color={BRAND.teal} strokeWidth={2} />
            </button>
            <button type="button" onClick={async () => { try { sessionStorage.removeItem("portal_user_id"); } catch {} clearPersistedTabs(); setActiveTab("itinerario"); if (athlete) await releasePortalSession("athlete", athlete.id); mobileAwareLogout(); }}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",cursor:"pointer",flexShrink:0 }}>
              <LogOutIcon size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="db-content" style={{ paddingBottom:"calc(70px + env(safe-area-inset-bottom))" }}>

        {/* ── Profile card (compact) ── */}
        <div className="db-profile-card" style={{ marginBottom:10 }}>
          {/* Left accent bar */}
          <div style={{ position:"absolute",left:0,top:0,bottom:0,width:"4px",background:`linear-gradient(180deg,${BRAND.teal},${BRAND.blue},${BRAND.teal})` }} />
          {/* Subtle corner glow */}
          <div style={{ position:"absolute",top:0,right:0,width:"200px",height:"200px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 65%)",transform:"translate(60px,-60px)",pointerEvents:"none" }} />
          <div className="db-profile-body">
            <div style={{ position:"relative",flexShrink:0 }}>
              {/* La misma foto que la tarjeta de Cuenta, vista previa
                  incluida: el avatar de arriba está visible en todas las
                  pestañas y era raro que cambiara en una y en la otra no. */}
              {fotoActual ? (
                <img src={fotoActual} alt={athlete.fullName} className="db-avatar" style={{ objectFit:"cover" }} />
              ) : (
                <div className="db-avatar">{initials}</div>
              )}
              <div style={{ position:"absolute",bottom:2,right:2,width:12,height:12,borderRadius:"50%",background:BRAND.teal,border:"2px solid #fff",boxShadow:"0 0 8px rgba(33,208,179,0.8)" }} />
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.teal,margin:"0 0 5px" }}>Perfil</p>
              <h1 className="db-profile-name">{athlete.fullName}</h1>
              <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                {event?.name && (
                  <span style={{ fontSize:"11px",fontWeight:700,padding:"4px 12px",borderRadius:"20px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:BRAND.tealInk,border:"1px solid rgba(33,208,179,0.3)",animation:"db-badge .4s cubic-bezier(0.16,1,0.3,1) both",animationDelay:".2s",letterSpacing:"0.01em" }}>
                    {event.name}
                  </span>
                )}
                {delegation && (
                  <span style={{ fontSize:"11px",fontWeight:600,padding:"4px 12px",borderRadius:"20px",background:SURFACE.borderMuted,color:SURFACE.textStrong,border:"1px solid #dde3ed",animation:"db-badge .4s cubic-bezier(0.16,1,0.3,1) both",animationDelay:".3s" }}>
                    {delegationName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>

        {/* ═══ Banner de viaje en curso ═══
            Sólo para quien viaja en un traslado propio: su conductor va en
            camino. El jefe de delegación no lo ve —sus buses en ruta ya los
            lista "Ahora mismo" dentro de Actividades, con su propio mapa—, y
            en su lugar arriba tiene el acceso al coordinador general. */}
        {!isChief && !!trip && ["EN_ROUTE","PICKED_UP"].includes(trip.status ?? "") && (
          <div style={{ position:"relative",overflow:"hidden",borderRadius:16,padding:"14px 16px",
            background:`linear-gradient(135deg,${BRAND.navyLight} 0%,#0a3356 55%,${BRAND.navyLight} 100%)`,
            border:"1px solid rgba(33,208,179,0.35)",boxShadow:"0 6px 24px rgba(6,34,64,0.35)" }}>
            <div style={{ position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${BRAND.teal} 40%,${BRAND.tealLight} 50%,${BRAND.teal} 60%,transparent)` }} />
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <span style={{ position:"relative",flexShrink:0,width:40,height:40,borderRadius:12,background:"rgba(33,208,179,0.15)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <span style={{ position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:BRAND.tealLight,boxShadow:`0 0 8px ${BRAND.tealLight}` }} />
                <TruckIcon size={20} color={BRAND.tealLight} strokeWidth={1.8} />
              </span>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:9.5,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:BRAND.tealLight,margin:0 }}>
                  {trip?.status==="EN_ROUTE" ? "En ruta a recogerte" : `Rumbo a ${trip?.destination || "tu destino"}`}
                </p>
                <p style={{ fontSize:14.5,fontWeight:800,color:SURFACE.card,margin:"1px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {trip?.status==="EN_ROUTE" ? "Tu conductor está en camino" : "Viaje en curso"}
                </p>
                {driverEta && (
                  <p style={{ fontSize:12,fontWeight:700,color:BRAND.tealLight,margin:"3px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {trip?.status==="EN_ROUTE" ? "Llega en" : "Llegas en"} ~{driverEta.duration} · {driverEta.distance}
                  </p>
                )}
                {driver && (
                  <p style={{ fontSize:11.5,color:"rgba(255,255,255,0.7)",margin:"3px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    <UserIcon size={12} className="inline mr-1" />{driver.fullName || "Conductor"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowTripModal(true)}
                style={{ flexShrink:0,padding:"9px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:`linear-gradient(135deg,${BRAND.tealLight},${BRAND.teal})`,color:BRAND.navyLight,whiteSpace:"nowrap" }}>
                Ver viaje
              </button>
            </div>
          </div>
        )}

        {/* ─── Itinerario tab (chief only) ─── */}
        {activeTab === "itinerario" && isChief && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {/* Flight info */}
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden" }}>
              <div style={{ padding:"12px 14px",borderBottom:`1px solid ${SURFACE.borderMuted}`,display:"flex",alignItems:"center",gap:10 }}>
                <IcoPlane />
                <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:BRAND.teal }}>Vuelo</span>
              </div>
              <div style={{ padding:"12px 14px" }}>
                {flightLabel ? (
                  <>
                    <p style={{ fontSize:15,fontWeight:700,color:SURFACE.text,margin:"0 0 4px" }}>{flightLabel}</p>
                    {(athlete.arrivalTime || flight?.arrivalTime) && <p style={{ fontSize:12,color:SURFACE.textMuted,margin:"0 0 2px" }}>Arribo: {fmt(athlete.arrivalTime || flight?.arrivalTime)}</p>}
                    {athlete.origin && <p style={{ fontSize:12,color:SURFACE.textMuted,margin:0 }}>Origen: {athlete.origin}</p>}
                  </>
                ) : <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin vuelo asignado</p>}
              </div>
            </div>
            {/* Hotel info */}
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden" }}>
              <div style={{ padding:"12px 14px",borderBottom:`1px solid ${SURFACE.borderMuted}`,display:"flex",alignItems:"center",gap:10 }}>
                <IcoHotel />
                <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:BRAND.tealDark }}>Hotel</span>
              </div>
              <div style={{ padding:"12px 14px" }}>
                {hotel?.name ? (
                  <>
                    <p style={{ fontSize:15,fontWeight:700,color:SURFACE.text,margin:"0 0 6px" }}>{hotel.name}</p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                      {hotelRoom_ && <span style={{ fontSize:10,padding:"3px 8px",borderRadius:6,background:"#f0fdf8",color:BRAND.tealInk,border:"1px solid rgba(33,208,179,0.2)",fontWeight:600 }}>Hab. {hotelRoom_}</span>}
                      {hotelBed_ && <span style={{ fontSize:10,padding:"3px 8px",borderRadius:6,background:SURFACE.borderMuted,color:SURFACE.textSecondary,border:`1px solid ${SURFACE.border}` }}>Cama {hotelBed_}</span>}
                    </div>
                    {/* Info de check-in / check-out */}
                    <div style={{ marginTop:10,display:"flex",flexDirection:"column",gap:4,borderTop:`1px solid ${SURFACE.borderMuted}`,paddingTop:8 }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <span style={{ fontSize:11,color:SURFACE.textMuted }}>Check-in</span>
                        <span style={{ fontSize:11.5,fontWeight:700,color: hotelAssignment?.checkinAt ? BRAND.tealInk : SURFACE.textFaint }}>{hotelAssignment?.checkinAt ? fmt(hotelAssignment.checkinAt) : "Pendiente"}</span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <span style={{ fontSize:11,color:SURFACE.textMuted }}>Check-out</span>
                        <span style={{ fontSize:11.5,fontWeight:700,color: hotelAssignment?.checkoutAt ? STATE.warningText : SURFACE.textFaint }}>
                          {hotelAssignment?.checkoutAt ? fmt(hotelAssignment.checkoutAt) : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin hotel asignado</p>}
              </div>
            </div>
            {/* Check-ins */}
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px 14px" }}>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:SURFACE.textSecondary,margin:"0 0 10px" }}>Check-ins · {checkinsDone}/{checkins.length}</p>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {checkins.map(({ label, ts }) => {
                  const done = !!fmt(ts);
                  return (
                    <div key={label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:10,background:done?"rgba(33,208,179,0.04)":SURFACE.bg,border:`1px solid ${done?"rgba(33,208,179,0.2)":"#f1f5f9"}` }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:done?BRAND.teal:SURFACE.borderStrong }} />
                        <span style={{ fontSize:12,color:done?SURFACE.text:SURFACE.textFaint,fontWeight:done?600:400 }}>{label}</span>
                      </div>
                      {done ? <CheckIcon size={14} color={BRAND.teal} strokeWidth={2.5} /> : <span style={{ fontSize:9,color:SURFACE.borderStrong }}>Pendiente</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Los botones de check-in/check-out se retiraron del portal del
                jefe: esos registros los marca el personal de hotelería y
                operaciones desde el módulo administrativo. */}
            {/* Vuelos de la delegación */}
            {(() => {
              const everyone = [athlete, ...delegationMembers];
              const byFlight = new Map<string, { label: string; arrival?: string | null; origin?: string | null; names: string[] }>();
              const noFlight: string[] = [];
              everyone.forEach(p => {
                if (!p.flightNumber) { noFlight.push(p.fullName); return; }
                const label = `${p.airline ? `${p.airline} · ` : ""}${p.flightNumber}`;
                const cur = byFlight.get(label) || { label, arrival: null, origin: null, names: [] };
                if (!cur.arrival && p.arrivalTime) cur.arrival = p.arrivalTime;
                if (!cur.origin && p.origin) cur.origin = p.origin;
                cur.names.push(p.fullName);
                byFlight.set(label, cur);
              });
              const flights = Array.from(byFlight.values()).sort((a, b) => new Date(a.arrival || 0).getTime() - new Date(b.arrival || 0).getTime());
              return (
                <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px",borderBottom:`1px solid ${SURFACE.borderMuted}`,display:"flex",alignItems:"center",gap:10 }}>
                    <IcoPlane />
                    <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:BRAND.teal }}>Vuelos de la delegación</span>
                  </div>
                  <div style={{ padding:"12px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                    {flights.length === 0 && <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin vuelos asignados a la delegación</p>}
                    {flights.map(f => (
                      <div key={f.label} style={{ padding:"10px 12px",borderRadius:10,background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}` }}>
                        <p style={{ fontSize:13,fontWeight:700,color:SURFACE.text,margin:0 }}>{f.label}</p>
                        <p style={{ fontSize:11,color:SURFACE.textMuted,margin:"2px 0 6px" }}>
                          {f.arrival ? `Arribo: ${fmt(f.arrival)}` : "Sin horario"}{f.origin ? ` · Origen: ${f.origin}` : ""}
                        </p>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                          {f.names.map(n => <span key={n} style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"rgba(33,208,179,0.1)",color:BRAND.tealInk }}>{n}</span>)}
                        </div>
                      </div>
                    ))}
                    {noFlight.length > 0 && (
                      <p style={{ fontSize:11,color:SURFACE.textFaint,margin:0 }}>Sin vuelo asignado: {noFlight.join(", ")}</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Hoteles de la delegación */}
            {(() => {
              const everyone = [athlete, ...delegationMembers];
              const byHotel = new Map<string, { name: string; members: { name: string; room?: string | null }[] }>();
              const noHotel: string[] = [];
              everyone.forEach(p => {
                if (!p.hotelAccommodationId) { noHotel.push(p.fullName); return; }
                const name = allAccommodations.find(a => a.id === p.hotelAccommodationId)?.name || "Hotel asignado";
                const cur = byHotel.get(p.hotelAccommodationId) || { name, members: [] };
                cur.members.push({ name: p.fullName, room: p.roomNumber });
                byHotel.set(p.hotelAccommodationId, cur);
              });
              const hotels = Array.from(byHotel.values()).sort((a, b) => a.name.localeCompare(b.name));
              return (
                <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px",borderBottom:`1px solid ${SURFACE.borderMuted}`,display:"flex",alignItems:"center",gap:10 }}>
                    <IcoHotel />
                    <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:BRAND.tealDark }}>Hoteles de la delegación</span>
                  </div>
                  <div style={{ padding:"12px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                    {hotels.length === 0 && <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin hoteles asignados a la delegación</p>}
                    {hotels.map(h => (
                      <div key={h.name} style={{ padding:"10px 12px",borderRadius:10,background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}` }}>
                        <p style={{ fontSize:13,fontWeight:700,color:SURFACE.text,margin:"0 0 6px" }}>{h.name} <span style={{ fontSize:11,fontWeight:600,color:SURFACE.textMuted }}>· {h.members.length} persona(s)</span></p>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                          {h.members.map(mm => (
                            <span key={mm.name} style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"#f0fdf8",color:BRAND.tealInk,border:"1px solid rgba(33,208,179,0.2)" }}>
                              {mm.name}{mm.room ? ` · Hab. ${mm.room}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {noHotel.length > 0 && (
                      <p style={{ fontSize:11,color:SURFACE.textFaint,margin:0 }}>Sin hotel asignado: {noHotel.join(", ")}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── Actividades: la pantalla de inicio de todos los roles ─── */}
        {activeTab === "actividades" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {/* ═══ Contacto con el Coordinador General ═══
                Ocupa el lugar del banner de "bus en ruta": el estado de los
                buses ya lo cuenta "Ahora mismo" aquí abajo, con su propio
                mapa, así que arriba va lo que de verdad necesita a mano. El
                contacto es por WhatsApp, igual que en Sedes.

                Lo ven el Jefe de Misión y el Coordinador de Comité: los dos
                coordinan, y al comité le faltaba el mismo atajo que el jefe ya
                tenía. La diferencia es el saludo: el comité no escribe desde
                una región, así que el mensaje no la nombra. */}
            {(isChief || isComite) && (
              <BannerCoordinador
                delegacion={delegationName}
                nombreRemitente={athlete.fullName}
                onSinWhatsapp={() => { setAssistCategoria("COORDINATOR_CONTACT"); setAssistOpen(true); }}
              />
            )}
            {/* Coordinador de Comité: los filtros mandan sobre el módulo. */}
            {isComite && (
              <FiltrosComite
                delegaciones={delegacionesEvento}
                disciplinas={disciplineParents}
                delegacionId={comiteDelegacion}
                disciplinaId={comiteDisciplina}
                onDelegacion={setComiteDelegacion}
                onDisciplina={setComiteDisciplina}
                hoteles={lugaresComite.hoteles}
                hotel={comiteHotel}
                onHotel={setComiteHotel}
                sedes={lugaresComite.sedes}
                sede={comiteSede}
                onSede={setComiteSede}
              />
            )}
            {isComite && (
              <MissionTrips
                todas
                titulo="Traslados del evento"
                contactoChofer={puedeContactarChoferes}
                nombreContacto={athlete.fullName}
                delegacionFiltro={comiteDelegacion}
                disciplinaExterna={comiteDisciplina}
                hotelFiltro={comiteHotel}
                sedeFiltro={comiteSede}
                nombreDelegacion={(id) => {
                  const d = delegacionesEvento.find((x) => x.id === id);
                  return d ? nombreRegionCorto(d) : null;
                }}
                trips={delegationTrips}
                delegationId={null}
                delegationName=""
                memberIds={[]}
                disciplines={disciplineParents}
                venues={venues}
                accommodations={nombresHoteles.length ? nombresHoteles : allAccommodations}
                comedores={foodLocations}
              />
            )}
            {/* El jefe de misión ve arriba lo que está andando en su
                delegación; el conmutador y la tarjeta de abajo son para quien
                viaja en un traslado propio. */}
            {isChief && (
              <MissionLiveTrips
                trips={delegationTrips}
                delegationId={athlete.delegationId}
                memberIds={[athlete.id, ...delegationMembers.map((m) => m.id)]}
                venues={venues}
                accommodations={nombresHoteles.length ? nombresHoteles : allAccommodations}
                comedores={foodLocations}
                onVerEnVivo={(tripId) => {
                  // El mapa se abre aquí mismo, justo debajo, centrado en ese
                  // bus. Antes esto saltaba al módulo Flota y sacaba a la
                  // persona de la pantalla donde estaba mirando.
                  setMapaVivo({ abierto: true, tripId: tripId ?? null });
                  setFocoViajeId(tripId ?? null);
                  requestAnimationFrame(() =>
                    mapaVivoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  );
                }}
              />
            )}
            {/* Mapa en vivo del jefe. Vivía dentro del banner de "bus en ruta";
                al retirarlo se queda aquí, que es donde nace el "Ver en vivo"
                de cada traslado, con su propio botón para cerrarlo. */}
            {isChief && mapaVivo.abierto && (
              <div ref={mapaVivoRef} style={{ position:"relative" }}>
                <MissionLiveMap
                  eventId={athlete.eventId}
                  trips={delegationTrips}
                  focoTripId={mapaVivo.tripId}
                  venues={venues}
                  accommodations={nombresHoteles.length ? nombresHoteles : allAccommodations}
                  comedores={foodLocations}
                />
                <button type="button" onClick={() => setMapaVivo({ abierto:false, tripId:null })}
                  style={{ position:"absolute",top:8,right:8,zIndex:2,padding:"6px 11px",borderRadius:9,border:"none",cursor:"pointer",
                    fontSize:11,fontWeight:700,background:BRAND.navyLight,color:BRAND.tealLight,boxShadow:"0 2px 8px rgba(0,0,0,0.25)" }}>
                  Ocultar mapa
                </button>
              </div>
            )}
            {/* TA: sólo viajes programados/en curso, sin historial */}
            {!isTA && !isChief && !isComite && (
              <div style={{ display:"flex",gap:6 }}>
                {(["curso","historial"] as const).map(sub => (
                  <button key={sub} type="button" onClick={() => setActSubTab(sub)}
                    style={{ flex:1,padding:"8px 0",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
                      background:actSubTab===sub?`linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`:SURFACE.card,
                      color:actSubTab===sub?BRAND.teal:SURFACE.textMuted,
                      boxShadow:actSubTab===sub?"0 2px 8px rgba(33,208,179,0.2)":"0 1px 4px rgba(0,0,0,0.04)" }}>
                    {sub === "curso" ? "En curso" : "Historial"}
                  </button>
                ))}
              </div>
            )}
            {!isChief && !isComite && (actSubTab === "curso" || isTA) && (
              trip && ["SCHEDULED","EN_ROUTE","PICKED_UP"].includes(trip.status ?? "") ? (
                /* Este traslado es el del propio usuario. Para un Jefe de
                   Misión aparece además en la lista de su delegación, justo
                   debajo: con dos diseños distintos parecían dos cosas
                   distintas. Ahora usa el mismo lenguaje que esa lista (hora
                   grande a la izquierda, estado en chip, chofer con patente) y
                   lleva un encabezado que dice de quién es el traslado. */
                <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden",cursor:"pointer" }} onClick={() => setShowTripModal(true)}>
                  <div style={{ padding:"10px 14px",borderBottom:`1px solid ${SURFACE.borderMuted}`,display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:BRAND.tealDark }}>{t("Tu traslado")}</span>
                    <span style={{ marginLeft:"auto",display:"flex",color:SURFACE.textFaint }}><ChevronRightIcon size={15} strokeWidth={2.2} /></span>
                  </div>
                  <div style={{ padding:"12px 14px",display:"flex",gap:12 }}>
                    {/* La hora es lo primero que se busca; estaba en un
                        renglón gris al final de la tarjeta. */}
                    <div style={{ width:52,flexShrink:0,textAlign:"center" }}>
                      <p style={{ fontSize:15,fontWeight:800,color:SURFACE.text,margin:0,fontVariantNumeric:"tabular-nums",lineHeight:1.1 }}>{horaViaje(trip.scheduledAt)}</p>
                      <p style={{ fontSize:10.5,color:SURFACE.textFaint,margin:"2px 0 0",textTransform:"uppercase" }}>{fechaViaje(trip.scheduledAt)}</p>
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      {trip.status && (
                        <span style={{ display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10.5,fontWeight:700,marginBottom:6,
                          background:tripStatusMeta(trip.status).bg,
                          color:tripStatusMeta(trip.status).color }}>
                          {t(tripStatusMeta(trip.status).label)}
                        </span>
                      )}
                      {/* Origen y destino con su dirección, recortados: las
                          direcciones largas ya no llenan la tarjeta. */}
                      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                        {(["origin","destination"] as const).map((extremo) => {
                          const punto = puntoViaje(trip, extremo);
                          return (
                            <div key={extremo} style={{ minWidth:0 }}>
                              <span style={{ display:"block",fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:SURFACE.textFaint }}>
                                {extremo === "origin" ? t("ORIGEN") : t("DESTINO")}
                              </span>
                              <span style={{ display:"block",fontSize:13,fontWeight:700,color:SURFACE.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {punto.nombre || punto.direccion || "–"}
                              </span>
                              {punto.nombre && punto.direccion && (
                                <span style={{ display:"block",fontSize:11,color:SURFACE.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                  {punto.direccion}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {(driver?.fullName || trip.vehiclePlate || vehicle?.plate) && (
                        <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:SURFACE.textMuted,marginTop:6 }}>
                          <CarIcon size={11} /> {driver?.fullName ?? t("Sin chofer")}{trip.vehiclePlate ?? vehicle?.plate ? ` · ${trip.vehiclePlate ?? vehicle?.plate}` : ""}
                        </span>
                      )}
                      {driverEta && trip.status === "EN_ROUTE" && (
                        <p style={{ fontSize:12,fontWeight:700,color:"#0ea5c8",margin:"6px 0 0" }}>~{driverEta.duration} · {driverEta.distance}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : <p style={{ fontSize:13,color:SURFACE.textFaint,textAlign:"center",padding:20 }}>Sin viajes activos</p>
            )}
            {!isTA && !isChief && !isComite && actSubTab === "historial" && (() => {
              const completed = trip && ["COMPLETED","DROPPED_OFF"].includes(trip.status ?? "") ? [trip] : [];
              return completed.length > 0 ? (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {completed.map(t => (
                    <div key={t.id} style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px 14px" }}>
                      <div style={{ display:"flex",flexDirection:"column",gap:2,margin:"0 0 4px" }}>
                        {(["origin","destination"] as const).map((extremo) => {
                          const punto = puntoViaje(t, extremo);
                          return (
                            <div key={extremo} style={{ display:"flex",alignItems:"baseline",gap:6,minWidth:0 }}>
                              <span style={{ fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:SURFACE.textFaint,flexShrink:0,minWidth:48 }}>{extremo === "origin" ? "ORIGEN" : "DESTINO"}</span>
                              <span style={{ minWidth:0 }}>
                                <span style={{ display:"block",fontSize:12.5,fontWeight:700,color:SURFACE.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                  {punto.nombre || punto.direccion || "–"}
                                </span>
                                {punto.nombre && punto.direccion && (
                                  <span style={{ display:"block",fontSize:10.5,color:SURFACE.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                    {punto.direccion}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ fontSize:11,color:SURFACE.textMuted,margin:"0 0 4px" }}>Completado: {fmt(t.completedAt)}</p>
                      {t.driverRating && <p style={{ fontSize:11,color:STATE.warning,margin:0 }}><span style={{ display:"inline-flex",gap:1,verticalAlign:"-1px" }}>{Array.from({ length: t.driverRating }, (_, k) => <StarIcon key={k} size={11} fill={STATE.warning} />)}</span> {t.ratingComment && `"${t.ratingComment}"`}</p>}
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontSize:13,color:SURFACE.textFaint,textAlign:"center",padding:20 }}>Sin viajes completados</p>;
            })()}
            {/* Jefe de Misión: viajes asignados a su delegación */}
            {isChief && (
              <div ref={listaViajesRef}>
              <MissionTrips
                estado={filtroViajes}
                onEstado={setFiltroViajes}
                trips={delegationTrips}
                delegationId={athlete.delegationId}
                delegationName={delegationName}
                memberIds={[athlete.id, ...delegationMembers.map((m) => m.id)]}
                disciplines={disciplineParents}
                venues={venues}
                accommodations={nombresHoteles.length ? nombresHoteles : allAccommodations}
                comedores={foodLocations}
              />
              </div>
            )}
          </div>
        )}

        {/* ─── Calendario tab (chief only) ─── */}
        {/* El calendario es el mismo para todos: Gantt, Semana, Día, Agenda y
            Mes. Al jefe de misión se le había puesto en su lugar una lista
            simple del calendario deportivo, que además muestra lo mismo (esas
            filas se generan desde las pruebas: external_id "prueba:<id>"), y
            perdió las cinco vistas. El propio calendario ya acota al jefe a
            las disciplinas en las que compite su delegación. */}
        {activeTab === "calendario" && isComite && (
          <div style={{ marginBottom: 10 }}>
            <FiltrosComite
              delegaciones={delegacionesEvento}
              disciplinas={disciplineParents}
              delegacionId={comiteDelegacion}
              disciplinaId={comiteDisciplina}
              onDelegacion={setComiteDelegacion}
              onDisciplina={setComiteDisciplina}
              resumen="El deporte elegido acota el calendario."
            />
          </div>
        )}
        {activeTab === "calendario" && (() => {
          const y = calMonthCursor.getFullYear(), m = calMonthCursor.getMonth();
          const cells = getMonthGrid(calMonthCursor);
          const monthLabel = calMonthCursor.toLocaleDateString("es-CL",{month:"long",year:"numeric"});

          // ── Tipos de actividad (paleta como leyenda de referencia)
          type CalType = "ENTRENAMIENTO" | "COMPETENCIA" | "MEDICO" | "VIAJE" | "CEREMONIA" | "DESCANSO";
          const TYPE_CFG: Record<CalType,{ label:string; color:string; soft:string; icon:IconComponent }> = {
            ENTRENAMIENTO: { label:"Entrenamiento", color:STATE.success, soft:STATE.successSoft, icon:DumbbellIcon },
            COMPETENCIA:   { label:"Competencia",   color:STATE.dangerText, soft:STATE.dangerSoft, icon:MedalIcon },
            MEDICO:        { label:"Médico",        color:ACCENT.violet, soft:ACCENT.violetSoft, icon:HeartPulseIcon },
            VIAJE:         { label:"Viaje",         color:"#ea580c", soft:"#ffedd5", icon:PlaneIcon },
            CEREMONIA:     { label:"Ceremonia",     color:"#eab308", soft:STATE.warningSoft, icon:TrophyIcon },
            DESCANSO:      { label:"Descanso",      color:STATE.infoText, soft:STATE.infoSoft, icon:BedIcon },
          };
          const classifyEvent = (name?: string | null): CalType => {
            const t = (name || "").toLowerCase();
            if (/(entrenamiento|práctica|practica|activación|activacion|reconocimiento)/.test(t)) return "ENTRENAMIENTO";
            if (/(descanso|libre)/.test(t)) return "DESCANSO";
            if (/(médic|medic|control|evaluación|evaluacion)/.test(t)) return "MEDICO";
            if (/(viaje|traslado|regreso|llegada)/.test(t)) return "VIAJE";
            if (/(ceremon|premiac|inaugur|clausura)/.test(t)) return "CEREMONIA";
            return "COMPETENCIA";
          };

          // ── Universo de actividades: competencias/calendario + premiaciones
          type CalItem = { id:string; type:CalType; date:Date; title:string; subtitle?:string; venue?:string; discId?:string|null; delegIds?:string[] };
          /** Abre la ficha de una actividad. Misma ficha en las cuatro vistas. */
          const abrirDetalle = (it: CalItem) => {
            const cfg = TYPE_CFG[it.type];
            setCalDetalle({
              id: it.id,
              titulo: it.title,
              subtitulo: it.subtitle,
              sede: it.venue,
              fecha: it.date,
              tipoLabel: cfg.label,
              color: cfg.color,
              soft: cfg.soft,
            });
          };
          /**
           * Actividades por bloque horario. Una jornada de atletismo son
           * cincuenta pruebas que arrancan de a varias a la misma hora: en
           * lista corrida hay que leer la hora de cada fila para ubicarse.
           */
          const bloquesPorHora = (lista: CalItem[]): [string, CalItem[]][] => {
            const bloques = new Map<string, CalItem[]>();
            lista.forEach((it) => {
              const clave = `${String(it.date.getHours()).padStart(2, "0")}:00`;
              const enLaHora = bloques.get(clave) ?? [];
              enLaHora.push(it);
              bloques.set(clave, enLaHora);
            });
            return Array.from(bloques.entries());
          };

          /** Hora en 24 h: "10:00 a. m." ocupa el doble y se corta el título. */
          const hhmm = (d: Date) =>
            d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });

          const items: CalItem[] = [];
          calendarEvents.forEach(ev => {
            if (!ev.scheduledAt) return;
            const d = new Date(ev.scheduledAt); if (Number.isNaN(d.getTime())) return;
            const parent = disciplineParents.find(p => p.id===ev.parentId);
            const parentLabel = ev.parentId ? discLabelMap.get(ev.parentId) : undefined;
            items.push({
              id:`ce-${ev.id}`, type:classifyEvent(ev.name),
              date:d, title:ev.name || parentLabel || "Actividad",
              subtitle: parent?.name && ev.name!==parent.name ? parentLabel : undefined,
              venue: ev.venueName || undefined,
              discId: ev.parentId || null,
              delegIds: ev.delegationIds ?? [],
            });
          });
          premiaciones.forEach(p => {
            if (!p.scheduledAt) return;
            const d = new Date(p.scheduledAt); if (Number.isNaN(d.getTime())) return;
            items.push({
              id:`pr-${p.id}`, type:"CEREMONIA",
              date:d, title:p.title || "Ceremonia de premiación",
              subtitle: p.discipline || undefined,
              venue: p.venueName || p.locationDetail || undefined,
              discId: p.disciplineId || null,
            });
          });

          // El jefe de delegación ve solo las disciplinas (deportes padre) en
          // las que compite su delegación — antes veía el calendario global
          // del evento completo. Se resuelve el padre de la prueba de cada
          // miembro (member.disciplineId suele ser la prueba/hija).
          /**
           * Deportes en los que compite la delegación. Se guardan el id y el
           * NOMBRE porque los deportes están repetidos entre eventos (hay seis
           * filas "Atletismo") y la ficha de un participante puede apuntar a
           * la copia de otro evento. Comparando sólo por id, el calendario del
           * jefe salía vacío teniendo actividades.
           */
          const norma = (v?: string | null) => String(v ?? "").trim().toLowerCase();
          const chiefDisc = (() => {
            if (!isChief) return null;
            const ids = new Set<string>();
            const nombres = new Set<string>();
            [athlete, ...delegationMembers].forEach(p => {
              if (!p?.disciplineId) return;
              // Contra TODAS las disciplinas, no sólo las que tienen hora.
              const suya = disciplinasTodas.find(c => c.id === p.disciplineId);
              const padreId = suya?.parentId || p.disciplineId;
              ids.add(padreId);
              const padre = disciplinasTodas.find(c => c.id === padreId);
              if (padre?.name) nombres.add(norma(padre.name));
            });
            return ids.size > 0 ? { ids, nombres } : null;
          })();
          /**
           * Disciplinas de la región elegida en el filtro. Vienen adjuntas a
           * la delegación, y se guarda también el nombre normalizado porque el
           * mismo deporte está repetido entre eventos y una prueba puede
           * colgar de la copia de al lado.
           */
          const regionElegida = calDelegacionFilter
            ? delegacionesEvento.find((d) => d.id === calDelegacionFilter) ?? null
            : null;
          const discRegion = (() => {
            if (!regionElegida) return null;
            const ids = new Set<string>(regionElegida.disciplineIds ?? []);
            const nombres = new Set<string>();
            (regionElegida.disciplineIds ?? []).forEach((id) => {
              const d = disciplinasTodas.find((c) => c.id === id);
              if (d?.name) nombres.add(norma(d.name));
            });
            (regionElegida.disciplineNames ?? []).forEach((n) => nombres.add(norma(n)));
            return { ids, nombres };
          })();

          const esDeLaRegion = (discId?: string | null) => {
            if (!discRegion) return true;
            // Las ceremonias generales no cuelgan de un deporte: valen para
            // todas las regiones.
            if (!discId) return true;
            const suya = disciplinasTodas.find((c) => c.id === discId);
            const padreId = suya?.parentId || discId;
            if (discRegion.ids.has(padreId) || discRegion.ids.has(discId)) return true;
            const nombre = norma(disciplinasTodas.find((c) => c.id === padreId)?.name);
            return nombre ? discRegion.nombres.has(nombre) : false;
          };

          const esDeLaDelegacion = (discId?: string | null) => {
            if (!chiefDisc) return true;
            if (!discId) return true; // ceremonias generales
            if (chiefDisc.ids.has(discId)) return true;
            const nombre = norma(disciplineParents.find(p => p.id === discId)?.name);
            return nombre ? chiefDisc.nombres.has(nombre) : false;
          };

          // Opciones de disciplina (deportes con actividades) para el filtro
          const discOptions = Array.from(
            new Map(
              items
                .filter(i => i.discId)
                .filter(i => esDeLaDelegacion(i.discId))
                .map(i => {
                  const name = discLabelMap.get(i.discId as string)
                    || calendarEvents.find(c => c.id===i.discId)?.name
                    || i.subtitle || "Disciplina";
                  return [i.discId as string, name] as const;
                }),
            ).entries(),
          ).sort((a,b) => a[1].localeCompare(b[1]));

          const typed = items.filter(i =>
            (!calTypeFilter || i.type===calTypeFilter) &&
            (!calDiscFilter || i.discId===calDiscFilter) &&
            esDeLaRegion(i.discId) &&
            // Jefe: por defecto sólo las disciplinas de su delegación (las sin
            // disciplina —ceremonias generales— se mantienen visibles). Si
            // elige una región en el filtro, esa elección manda: pidió ver
            // otra cosa a propósito.
            (regionElegida ? true : esDeLaDelegacion(i.discId)) &&
            // Un partido lo ven sólo las dos regiones que juegan (o la región
            // elegida en el filtro); las pruebas sin delegaciones, todas.
            pruebaVisiblePara({ delegationIds: i.delegIds }, regionElegida ? regionElegida.id : athlete?.delegationId ?? null),
          );
          const inMonth = typed.filter(i => i.date.getFullYear()===y && i.date.getMonth()===m);
          const daysWithEvents = new Set(inMonth.map(i => i.date.getDate()));
          const agenda = (calSelectedDay ? inMonth.filter(i => i.date.getDate()===calSelectedDay) : inMonth)
            .sort((a,b) => a.date.getTime()-b.date.getTime());

          // Agrupar por día para la columna de agenda
          const byDay = new Map<number, CalItem[]>();
          agenda.forEach(i => { const k=i.date.getDate(); byDay.set(k,[...(byDay.get(k)??[]),i]); });
          const agendaDays = Array.from(byDay.keys()).sort((a,b)=>a-b);

          // ── Datos para vistas Semana / Día / Gantt (respetan los filtros activos) ──
          const keyOf = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          const dayEvents = (d:Date) => typed.filter(i => keyOf(i.date)===keyOf(d)).sort((a,b)=>a.date.getTime()-b.date.getTime());
          const cursorDayItems = dayEvents(calCursor);
          const weekStart = (() => { const x=new Date(calCursor.getFullYear(),calCursor.getMonth(),calCursor.getDate()); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; })();
          const weekDays = Array.from({length:7},(_,i)=>{ const day=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+i); return { day, events: dayEvents(day) }; });
          const gN = new Date(y,m+1,0).getDate();
          const gDays = Array.from({length:gN},(_,i)=>new Date(y,m,i+1));
          const gRowMap = new Map<string,{ name:string; byDay:Map<number,CalItem[]> }>();
          typed.filter(i => i.date.getFullYear()===y && i.date.getMonth()===m).forEach(i => {
            const pid = i.discId || "—";
            const pname = discLabelMap.get(pid) || i.subtitle || i.title || "Actividad";
            if(!gRowMap.has(pid)) gRowMap.set(pid,{ name:pname, byDay:new Map() });
            const bd = gRowMap.get(pid)!.byDay; const dd=i.date.getDate();
            bd.set(dd,[...(bd.get(dd)??[]),i]);
          });
          const gRows = Array.from(gRowMap.values()).sort((a,b)=>a.name.localeCompare(b.name));

          // Próxima competencia (a futuro)
          const now = new Date();
          const nextComp = items
            .filter(i => i.type==="COMPETENCIA" && i.date.getTime()>=now.getTime())
            .sort((a,b)=>a.date.getTime()-b.date.getTime())[0];

          const fmtDow = (d:Date) => d.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").toUpperCase();
          const fmtMon = (d:Date) => d.toLocaleDateString("es-CL",{month:"short"}).replace(".","").toUpperCase();
          // Capitaliza solo la primera letra ("abril de 2026" → "Abril de 2026");
          // el textTransform:capitalize producía "Abril De 2026".
          const cap1 = (s:string) => s.charAt(0).toUpperCase()+s.slice(1);

          return (
            <div style={{ display:"flex",flexWrap:"wrap",gap:14,alignItems:"flex-start" }}>
              {/* ════ Columna principal: agenda ════ */}
              <div style={{ flex:"1 1 340px",minWidth:0,display:"flex",flexDirection:"column",gap:12 }}>
                {/* Barra de control: navegación mes + toggle vista */}
                <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px 14px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:10 }}>
                  {(() => {
                    const dayWeek = calView==="semana" || calView==="dia";
                    const step = calView==="semana" ? 7 : 1;
                    // Toda la navegación mantiene sincronizados AMBOS cursores
                    // (mes y día): antes la agenda podía quedar en julio con el
                    // mini calendario en abril y la vista se volvía confusa.
                    const goToDate = (x:Date) => { setCalCursor(x); setCalMonthCursor(new Date(x.getFullYear(),x.getMonth(),1)); };
                    const shift = (dir:number) => { const x=new Date(calCursor); x.setDate(x.getDate()+dir*step); goToDate(x); };
                    const shiftMonth = (dir:number) => { goToDate(new Date(y,m+dir,1)); setCalSelectedDay(null); };
                    const label = !dayWeek ? cap1(monthLabel)
                      : calView==="semana"
                        ? `${weekDays[0].day.toLocaleDateString("es-CL",{day:"2-digit",month:"short"})} – ${weekDays[6].day.toLocaleDateString("es-CL",{day:"2-digit",month:"short"})}`
                        : cap1(calCursor.toLocaleDateString("es-CL",{weekday:"long",day:"2-digit",month:"long"}));
                    return (
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <button type="button" onClick={() => { const t=new Date(); goToDate(t); setCalSelectedDay(null); }} style={{ fontSize:12,fontWeight:700,color:SURFACE.text,background:SURFACE.borderMuted,border:`1px solid ${SURFACE.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer" }}>Hoy</button>
                        <button type="button" onClick={() => { if(dayWeek){ shift(-1); } else { shiftMonth(-1); } }} style={{ background:SURFACE.card,border:`1px solid ${SURFACE.border}`,borderRadius:8,cursor:"pointer",padding:6,display:"inline-flex" }}>
                          <ChevronLeftIcon size={16} color={SURFACE.textMuted} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => { if(dayWeek){ shift(1); } else { shiftMonth(1); } }} style={{ background:SURFACE.card,border:`1px solid ${SURFACE.border}`,borderRadius:8,cursor:"pointer",padding:6,display:"inline-flex" }}>
                          <ChevronRightIcon size={16} color={SURFACE.textMuted} strokeWidth={2} />
                        </button>
                        <span style={{ fontSize:14,fontWeight:800,color:SURFACE.text }}>{label}</span>
                      </div>
                    );
                  })()}
                  <div style={{ display:"flex",flexWrap:"wrap",background:SURFACE.borderMuted,borderRadius:10,padding:3,gap:2 }}>
                    {/* Mes primero: es la vista con la que se mira el calendario del
                        evento. El Gantt queda al final, que es donde se busca. */}
                    {([["mes","Mes"],["semana","Semana"],["dia","Día"],["agenda","Agenda"],["gantt","Gantt"]] as const).map(([v,label]) => (
                      <button key={v} type="button" onClick={() => setCalView(v)}
                        style={{ fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:8,border:"none",cursor:"pointer",
                          background: calView===v ? BRAND.teal : "transparent", color: calView===v ? SURFACE.card : SURFACE.textSecondary }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtros — ocultos para TA: su calendario queda fijo en su
                    disciplina. Van aquí arriba, junto a la navegación, porque
                    abajo del todo había que bajar la pantalla entera para
                    alcanzarlos. Cada uno abre su hoja inferior. */}
                {!isTA && (
                  <div style={{ display:"flex",gap:6,alignItems:"stretch" }}>
                    <SelectorFiltro
                      rotulo={t("Tipo")}
                      titulo={t("Tipo de evento")}
                      opciones={(Object.keys(TYPE_CFG) as CalType[]).map(tp => ({ value: tp, label: TYPE_CFG[tp].label }))}
                      etiquetaTodos={t("Todos los tipos")}
                      valor={calTypeFilter}
                      onChange={setCalTypeFilter}
                    />
                    {/* Región: el calendario completo es del evento, y sin
                        esto no había forma de ver la jornada de una delegación
                        en particular. El comité la elige en su propia barra. */}
                    {!isComite && delegacionesEvento.length > 0 && (
                      <SelectorFiltro
                        rotulo={t("Delegación")}
                        titulo={t("Delegación")}
                        opciones={[...delegacionesEvento]
                          .map((d) => ({ value: d.id, label: nombreRegionCorto(d) }))
                          .sort((a, b) => a.label.localeCompare(b.label, "es"))}
                        etiquetaTodos={t("Todas las delegaciones")}
                        valor={calDelegacionFilter}
                        onChange={setCalDelegacionFilter}
                      />
                    )}
                    {/* El Coordinador de Comité elige deporte en su propia
                        barra, arriba: dos controles para lo mismo confunden. */}
                    {!isComite && discOptions.length > 0 && (
                      <SelectorFiltro
                        rotulo={t("Disciplina")}
                        opciones={discOptions.map(([id,name]) => ({ value: id, label: name }))}
                        etiquetaTodos={t("Todas las disciplinas")}
                        valor={calDiscFilter}
                        onChange={setCalDiscFilter}
                      />
                    )}
                    {(calTypeFilter || calDiscFilter || calDelegacionFilter || calSelectedDay) && (
                      <BotonQuitarFiltros
                        titulo={t("Ver todo")}
                        onClick={()=>{ setCalTypeFilter(""); setCalDiscFilter(""); setCalDelegacionFilter(""); setCalSelectedDay(null); }}
                      />
                    )}
                  </div>
                )}

                {/* Vista MES: cuadrícula */}
                {calView==="mes" && (
                  <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center" }}>
                      {["L","M","M","J","V","S","D"].map((d,i) => <div key={i} style={{ fontSize:10,fontWeight:700,color:SURFACE.textFaint,padding:4 }}>{d}</div>)}
                      {cells.map((day,i) => {
                        const dayItems = day ? inMonth.filter(it => it.date.getDate()===day) : [];
                        const isSel = day !== null && calSelectedDay===day;
                        const isTodayCell = day !== null && new Date(y,m,day).toDateString()===now.toDateString();
                        return (
                          <button key={i} type="button" disabled={!day}
                            onClick={() => { if(!day) return; setCalSelectedDay(isSel?null:day); setCalCursor(new Date(y,m,day)); }}
                            style={{ minHeight:64,padding:"4px",borderRadius:10,
                              border: isSel?`2px solid ${BRAND.teal}`:isTodayCell?`1px solid ${BRAND.teal}`:`1px solid ${SURFACE.borderMuted}`,
                              cursor:day?"pointer":"default",
                              // Tinte proporcional a la carga: de un vistazo
                              // se ve dónde se concentra el evento en el mes.
                              background: isSel
                                ? "#f0fdfa"
                                : day
                                  ? (dayItems.length
                                      ? `rgba(33,208,179,${Math.min(0.2, 0.05 + dayItems.length * 0.012)})`
                                      : SURFACE.card)
                                  : "transparent",
                              display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3 }}>
                            <span style={{ fontSize:12,fontWeight:(isSel||isTodayCell)?800:600,color:day?(isTodayCell?BRAND.tealDark:SURFACE.text):"transparent" }}>{day||""}</span>
                            {/* Un punto por TIPO presente, no por actividad:
                                tres puntos rojos iguales sólo decían "hay
                                competencias", y el conteo real quedaba en un
                                "+25" al lado. Ahora el color dice qué clase de
                                día es y el número, cuánto hay. */}
                            <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:3 }}>
                              {Array.from(new Set(dayItems.map(it=>it.type))).slice(0,4).map(tp => (
                                <span key={tp} style={{ width:6,height:6,borderRadius:"50%",background:TYPE_CFG[tp as CalType].color }} />
                              ))}
                              {dayItems.length>0 && (
                                <span style={{ fontSize:9,fontWeight:800,color:SURFACE.textMuted,fontVariantNumeric:"tabular-nums" }}>{dayItems.length}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Detalle del día seleccionado, sin salir de la vista Mes */}
                    {calSelectedDay !== null && (() => {
                      const selItems = inMonth.filter(it => it.date.getDate()===calSelectedDay).sort((a,b)=>a.date.getTime()-b.date.getTime());
                      return (
                        <div style={{ marginTop:12,borderTop:`1px solid ${SURFACE.borderMuted}`,paddingTop:10 }}>
                          <div style={{ display:"flex",alignItems:"baseline",gap:8,margin:"0 0 10px" }}>
                            <p style={{ fontSize:11,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:BRAND.tealDark,margin:0 }}>
                              {cap1(new Date(y,m,calSelectedDay).toLocaleDateString("es-CL",{weekday:"long",day:"2-digit",month:"long"}))}
                            </p>
                            {selItems.length>0 && (
                              <span style={{ fontSize:11,fontWeight:700,color:SURFACE.textFaint }}>
                                {selItems.length} {selItems.length===1?"actividad":"actividades"}
                              </span>
                            )}
                          </div>
                          {selItems.length===0 ? (
                            <p style={{ fontSize:12,color:SURFACE.textFaint,margin:0 }}>Sin actividades este día.</p>
                          ) : (() => {
                            return (
                              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                                {bloquesPorHora(selItems).map(([bloque, items]) => (
                                  <div key={bloque}>
                                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                                      <span style={{ fontSize:12,fontWeight:800,color:SURFACE.text,fontVariantNumeric:"tabular-nums" }}>{bloque}</span>
                                      <span style={{ flex:1,height:1,background:SURFACE.borderMuted }} />
                                      <span style={{ fontSize:10,fontWeight:700,color:SURFACE.textFaint }}>
                                        {items.length} {items.length===1?"actividad":"actividades"}
                                      </span>
                                    </div>
                                    <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                                      {items.map(it=>{ const cfg=TYPE_CFG[it.type]; return (
                                        <button key={it.id} type="button" onClick={()=>abrirDetalle(it)}
                                          style={{ width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:9,
                                            background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}`,borderLeft:`3px solid ${cfg.color}`,borderRadius:9,padding:"8px 10px" }}>
                                          <span style={{ fontSize:11.5,fontWeight:800,color:SURFACE.text,flexShrink:0,fontVariantNumeric:"tabular-nums" }}>{hhmm(it.date)}</span>
                                          <span style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column" }}>
                                            <span style={{ fontSize:11.5,fontWeight:600,color:SURFACE.textStrong,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{it.title}</span>
                                            {(it.subtitle || it.venue) && (
                                              <span style={{ fontSize:10.5,color:SURFACE.textFaint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                                {[it.subtitle, it.venue].filter(Boolean).join(" · ")}
                                              </span>
                                            )}
                                          </span>
                                          <ChevronRightIcon size={13} color={SURFACE.borderStrong} strokeWidth={2} />
                                        </button>
                                      ); })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Vista AGENDA: lista por día con chip de fecha */}
                {calView==="agenda" && (
                  <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden auto",maxHeight:"calc(100vh - 240px)" }}>
                    {agendaDays.length===0 ? (
                      <div style={{ padding:"40px 16px",textAlign:"center" }}>
                        <p style={{ margin:0,color:SURFACE.borderStrong,display:"flex",justifyContent:"center" }}><CalendarIcon size={34} /></p>
                        <p style={{ fontSize:14,fontWeight:700,color:SURFACE.textSecondary,margin:"8px 0 0" }}>Sin actividades {calSelectedDay?"este día":"este mes"}</p>
                        <p style={{ fontSize:12,color:SURFACE.textFaint,margin:"4px 0 0" }}>{calTypeFilter?"Prueba quitando el filtro de tipo.":"Navega entre los meses para ver más."}</p>
                      </div>
                    ) : agendaDays.map((dayNum, di) => {
                      const dayDate = new Date(y,m,dayNum);
                      const clave = keyOf(dayDate);
                      const isToday = dayDate.toDateString()===now.toDateString();
                      const delDia = byDay.get(dayNum)!.slice().sort((a,b)=>a.date.getTime()-b.date.getTime());
                      const abierto = semanaAbiertos.has(clave);
                      const rango = delDia.length===1
                        ? hhmm(delDia[0].date)
                        : `${hhmm(delDia[0].date)}–${hhmm(delDia[delDia.length-1].date)}`;
                      const sedes = Array.from(new Set(delDia.map(e=>e.venue).filter(Boolean))) as string[];
                      const verTodo = semanaVerTodo.has(clave);
                      const visibles = verTodo ? delDia : delDia.slice(0, SEMANA_TOPE);
                      const ocultos = delDia.length - visibles.length;
                      return (
                        <div key={dayNum} style={{ borderTop: di===0?"none":`1px solid ${SURFACE.borderMuted}` }}>
                          <button
                            type="button"
                            onClick={()=>alternarDiaSemana(clave)}
                            style={{
                              width:"100%",textAlign:"left",border:"none",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:0,padding:0,
                              background:isToday?"#f0fdfa":"transparent",
                            }}
                          >
                            {/* Chip de fecha */}
                            <span style={{ flex:"0 0 64px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 0",background:isToday?"#f0fdfa":SURFACE.bg,borderRight:`1px solid ${SURFACE.borderMuted}` }}>
                              <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.08em",color:isToday?BRAND.tealDark:SURFACE.textFaint }}>{fmtDow(dayDate)}</span>
                              <span style={{ fontSize:22,fontWeight:800,color:isToday?BRAND.tealDark:SURFACE.text,lineHeight:1.1 }}>{dayNum}</span>
                              <span style={{ fontSize:9,fontWeight:700,color:SURFACE.textFaint }}>{fmtMon(dayDate)}</span>
                            </span>
                            {/* Resumen: plegado tiene que informar, no esconder. */}
                            <span style={{ flex:1,minWidth:0,padding:"10px 12px" }}>
                              <span style={{ display:"block",fontSize:12.5,fontWeight:700,color:isToday?BRAND.tealDark:SURFACE.text }}>
                                {cap1(dayDate.toLocaleDateString("es-CL",{weekday:"long"}))}
                              </span>
                              <span style={{ display:"block",fontSize:10.5,color:SURFACE.textFaint,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {rango}
                                {sedes.length>0 && ` · ${sedes.slice(0,2).join(" · ")}`}
                                {sedes.length>2 && ` +${sedes.length-2}`}
                              </span>
                            </span>
                            <span style={{ flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"0 12px" }}>
                              <span style={{ fontSize:10,fontWeight:800,color:BRAND.tealDark,background:"rgba(33,208,179,0.12)",borderRadius:20,padding:"2px 9px" }}>{delDia.length}</span>
                              <ChevronDownIcon size={14} color={SURFACE.textFaint} strokeWidth={2}
                                style={{ transition:"transform .15s",transform:abierto?"rotate(180deg)":"rotate(0)" }} />
                            </span>
                          </button>

                          {abierto && (
                            <div style={{ padding:"4px 12px 12px 64px",display:"flex",flexDirection:"column",gap:12 }}>
                              {bloquesPorHora(visibles).map(([bloque, deLaHora]) => (
                                <div key={bloque}>
                                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                                    <span style={{ fontSize:12,fontWeight:800,color:SURFACE.text,fontVariantNumeric:"tabular-nums" }}>{bloque}</span>
                                    <span style={{ flex:1,height:1,background:SURFACE.borderMuted }} />
                                    <span style={{ fontSize:10,fontWeight:700,color:SURFACE.textFaint }}>
                                      {deLaHora.length} {deLaHora.length===1?"actividad":"actividades"}
                                    </span>
                                  </div>
                                  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                                    {deLaHora.map(it=>{ const cfg=TYPE_CFG[it.type]; return (
                                      <button key={it.id} type="button" onClick={()=>abrirDetalle(it)}
                                        style={{ width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:9,
                                          background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}`,borderLeft:`3px solid ${cfg.color}`,borderRadius:9,padding:"8px 10px" }}>
                                        <span style={{ fontSize:11.5,fontWeight:800,color:SURFACE.text,flexShrink:0,fontVariantNumeric:"tabular-nums" }}>{hhmm(it.date)}</span>
                                        <span style={{ flexShrink:0,width:26,height:26,borderRadius:8,background:cfg.soft,display:"inline-flex",alignItems:"center",justifyContent:"center" }}><cfg.icon size={14} /></span>
                                        <span style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column" }}>
                                          <span style={{ fontSize:11.5,fontWeight:600,color:SURFACE.textStrong,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{it.title}</span>
                                          {(it.subtitle || it.venue) && (
                                            <span style={{ fontSize:10.5,color:SURFACE.textFaint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                              {[it.subtitle, it.venue].filter(Boolean).join(" · ")}
                                            </span>
                                          )}
                                        </span>
                                        <ChevronRightIcon size={13} color={SURFACE.borderStrong} strokeWidth={2} />
                                      </button>
                                    ); })}
                                  </div>
                                </div>
                              ))}
                              {ocultos>0 && (
                                <button type="button" onClick={()=>marcarVerTodo(clave)}
                                  style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 0",fontSize:11.5,fontWeight:700,color:BRAND.tealDark,textAlign:"center" }}>
                                  Ver las {ocultos} restantes
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Vista GANTT: disciplinas × días del mes */}
                {calView==="gantt" && (
                  gRows.length===0 ? (
                    <div style={{ background:SURFACE.card,borderRadius:14,border:`1px dashed ${SURFACE.border}`,padding:"32px 16px",textAlign:"center" }}>
                      <p style={{ margin:0,color:SURFACE.borderStrong,display:"flex",justifyContent:"center" }}><CalendarIcon size={28} /></p>
                      <p style={{ fontSize:13,fontWeight:700,color:SURFACE.textSecondary,margin:"6px 0 0" }}>Sin actividades este mes</p>
                    </div>
                  ) : (
                    <div style={{ display:"flex",background:SURFACE.card,border:`1px solid ${SURFACE.border}`,borderRadius:14,overflow:"hidden" }}>
                      <div style={{ flex:"0 0 128px",borderRight:`1px solid ${SURFACE.border}`,boxShadow:"2px 0 6px rgba(15,23,42,0.04)",zIndex:1 }}>
                        <div style={{ height:40,borderBottom:`1px solid ${SURFACE.border}`,background:SURFACE.bg,display:"flex",alignItems:"center",padding:"0 10px" }}>
                          <span style={{ fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:SURFACE.textFaint }}>Disciplina</span>
                        </div>
                        {gRows.map((r,i)=>{
                          const total = Array.from(r.byDay.values()).reduce((a,evs)=>a+evs.length,0);
                          return (
                            <div key={i} style={{ height:44,display:"flex",alignItems:"center",gap:6,padding:"0 10px",borderBottom: i<gRows.length-1?`1px solid ${SURFACE.borderMuted}`:"none" }}>
                              <span style={{ flex:1,minWidth:0,fontSize:11.5,fontWeight:700,color:SURFACE.textStrong,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.name}</span>
                              <span style={{ flexShrink:0,fontSize:10,fontWeight:800,color:SURFACE.textMuted,background:SURFACE.borderMuted,borderRadius:99,padding:"2px 6px" }}>{total}</span>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        // Auto-scroll al primer día con actividad (una vez por mes)
                        const CELL = 36;
                        const firstActiveDay = gRows.reduce((min, r) => {
                          const ks = Array.from(r.byDay.keys());
                          return ks.length ? Math.min(min, ...ks) : min;
                        }, Infinity);
                        return (
                          // minWidth:0 — sin esto el flex item crece con la banda del mes
                          // (31 días × 36 px) y descuadra toda la pantalla.
                          <div style={{ flex:1,minWidth:0,overflowX:"auto",WebkitOverflowScrolling:"touch" as any }}
                            ref={(el) => {
                              if (!el) return;
                              const key = `${y}-${m}`;
                              if (ganttScrollKey.current === key) return;
                              ganttScrollKey.current = key;
                              if (Number.isFinite(firstActiveDay)) el.scrollLeft = Math.max(0, (firstActiveDay - 2) * CELL);
                            }}>
                            <div style={{ minWidth:gN*CELL }}>
                              <div style={{ height:40,display:"grid",gridTemplateColumns:`repeat(${gN},${CELL}px)`,borderBottom:`1px solid ${SURFACE.border}`,background:SURFACE.bg }}>
                                {gDays.map(d=>{ const isToday=keyOf(d)===keyOf(now); const wknd=d.getDay()===0||d.getDay()===6; return (
                                  <div key={d.getDate()} style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,
                                    background:isToday?"rgba(33,208,179,0.14)":wknd?SURFACE.borderMuted:"transparent",
                                    borderBottom:isToday?`2px solid ${BRAND.teal}`:"none" }}>
                                    <span style={{ fontSize:8,fontWeight:700,color:isToday?BRAND.tealDark:SURFACE.textFaint }}>{["DO","LU","MA","MI","JU","VI","SA"][d.getDay()]}</span>
                                    <span style={{ fontSize:12,fontWeight:800,color:isToday?BRAND.tealDark:SURFACE.textStrong }}>{d.getDate()}</span>
                                  </div>
                                ); })}
                              </div>
                              {gRows.map((r,ri)=>(
                                <div key={ri} style={{ height:44,display:"grid",gridTemplateColumns:`repeat(${gN},${CELL}px)`,borderBottom: ri<gRows.length-1?`1px solid ${SURFACE.borderMuted}`:"none",alignItems:"center" }}>
                                  {gDays.map(d=>{
                                    const wknd=d.getDay()===0||d.getDay()===6;
                                    const evs=r.byDay.get(d.getDate());
                                    if(!evs||!evs.length) return <div key={d.getDate()} style={{ height:"100%",background:wknd?SURFACE.bg:"transparent" }} />;
                                    const cfg=TYPE_CFG[evs[0].type];
                                    return (
                                      <div key={d.getDate()} style={{ height:"100%",display:"flex",alignItems:"center",background:wknd?SURFACE.bg:"transparent" }}>
                                        <button type="button"
                                          onClick={()=>{ setCalCursor(new Date(d)); setCalMonthCursor(new Date(d.getFullYear(),d.getMonth(),1)); setCalView("dia"); }}
                                          title={`${evs.length} actividad(es) · ${d.toLocaleDateString("es-CL",{day:"2-digit",month:"short"})}`}
                                          style={{ flex:1,height:28,margin:"0 3px",borderRadius:8,border:"none",cursor:"pointer",
                                            background:`linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,color:SURFACE.card,
                                            fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:2,padding:0,
                                            boxShadow:`0 2px 5px ${cfg.color}55` }}>
                                          {evs.length>1?evs.length:""}
                                          {evs.length===1 && <span style={{ display:"inline-flex" }}><cfg.icon size={10} /></span>}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )
                )}

                {/* Vista SEMANA: un solo contenedor; los días sin actividad quedan
                    como fila compacta en vez de tarjetas vacías con "—". */}
                {calView==="semana" && (() => {
                  // Tira de la semana + un día a la vez. El acordeón mostraba
                  // los siete días apilados: para llegar al viernes había que
                  // pasar por el miércoles entero. Acá la semana se lee de un
                  // vistazo —qué días están cargados y cuánto— y el detalle es
                  // de uno solo.
                  const conEventos = weekDays.filter(d => d.events.length > 0);
                  const maxCarga = Math.max(1, ...weekDays.map(d => d.events.length));
                  const claveSel = semanaDiaSel
                    ?? (weekDays.find(d => keyOf(d.day) === keyOf(now) && d.events.length)?.day
                      ? keyOf(now)
                      : conEventos.length ? keyOf(conEventos[0].day) : keyOf(now));
                  const diaSel = weekDays.find(d => keyOf(d.day) === claveSel) ?? weekDays[0];
                  const items = (diaSel?.events ?? []).slice().sort((a,b)=>a.date.getTime()-b.date.getTime());
                  const verTodo = semanaVerTodo.has(claveSel);
                  const visibles = verTodo ? items : items.slice(0, SEMANA_TOPE);
                  const ocultos = items.length - visibles.length;
                  const sedes = Array.from(new Set(items.map(e=>e.venue).filter(Boolean))) as string[];

                  return (
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      {/* Tira de la semana: la carga de cada día como barra,
                          para saber dónde está el trabajo antes de abrir. */}
                      <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"10px 8px" }}>
                        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 }}>
                          {weekDays.map(({day,events}) => {
                            const clave = keyOf(day);
                            const sel = clave===claveSel;
                            const hoy = clave===keyOf(now);
                            const alto = events.length ? Math.max(4, Math.round((events.length/maxCarga)*26)) : 0;
                            return (
                              <button key={clave} type="button"
                                onClick={()=>{ setSemanaDiaSel(clave); setCalCursor(day); }}
                                style={{
                                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                                  padding:"7px 2px 6px",borderRadius:12,cursor:"pointer",
                                  border: sel?`1.5px solid ${BRAND.teal}`:`1px solid transparent`,
                                  background: sel?"rgba(33,208,179,0.10)":"transparent",
                                }}>
                                <span style={{ fontSize:9,fontWeight:800,letterSpacing:"0.06em",color: hoy?BRAND.tealDark:SURFACE.textFaint }}>{fmtDow(day)}</span>
                                <span style={{
                                  display:"inline-flex",alignItems:"center",justifyContent:"center",
                                  width:26,height:26,borderRadius:"50%",fontSize:13,fontWeight:800,
                                  background: hoy?BRAND.teal:"transparent",
                                  color: hoy?SURFACE.card:(sel?BRAND.tealDark:SURFACE.text),
                                }}>{day.getDate()}</span>
                                {/* Barra proporcional: la forma de la semana. */}
                                <span style={{ height:26,display:"flex",alignItems:"flex-end" }}>
                                  {events.length>0 ? (
                                    <span style={{ width:6,height:alto,borderRadius:3,background: sel?BRAND.teal:"rgba(33,208,179,0.45)" }} />
                                  ) : (
                                    <span style={{ width:6,height:3,borderRadius:3,background:SURFACE.borderMuted }} />
                                  )}
                                </span>
                                <span style={{ fontSize:9.5,fontWeight:700,color: events.length?SURFACE.textMuted:SURFACE.borderStrong,fontVariantNumeric:"tabular-nums" }}>
                                  {events.length || "–"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Día elegido */}
                      <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px 14px 14px" }}>
                        <div style={{ display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:10 }}>
                          <p style={{ fontSize:11,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:BRAND.tealDark,margin:0 }}>
                            {cap1(diaSel!.day.toLocaleDateString("es-CL",{weekday:"long",day:"2-digit",month:"long"}))}
                          </p>
                          {items.length>0 && (
                            <span style={{ fontSize:11,fontWeight:700,color:SURFACE.textFaint }}>
                              {items.length} {items.length===1?"actividad":"actividades"}
                              {sedes.length>0 && ` · ${sedes.slice(0,2).join(" · ")}`}
                              {sedes.length>2 && ` +${sedes.length-2}`}
                            </span>
                          )}
                        </div>

                        {items.length===0 ? (
                          <p style={{ fontSize:12.5,color:SURFACE.textFaint,margin:0,padding:"18px 0",textAlign:"center" }}>
                            Sin actividades este día.
                          </p>
                        ) : (
                          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                            {bloquesPorHora(visibles).map(([bloque, deLaHora]) => (
                              <div key={bloque}>
                                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                                  <span style={{ fontSize:12,fontWeight:800,color:SURFACE.text,fontVariantNumeric:"tabular-nums" }}>{bloque}</span>
                                  <span style={{ flex:1,height:1,background:SURFACE.borderMuted }} />
                                  <span style={{ fontSize:10,fontWeight:700,color:SURFACE.textFaint }}>
                                    {deLaHora.length} {deLaHora.length===1?"actividad":"actividades"}
                                  </span>
                                </div>
                                <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                                  {deLaHora.map(it=>{ const cfg=TYPE_CFG[it.type]; return (
                                    <button key={it.id} type="button" onClick={()=>abrirDetalle(it)}
                                      style={{ width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:9,
                                        background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}`,borderLeft:`3px solid ${cfg.color}`,borderRadius:9,padding:"8px 10px" }}>
                                      <span style={{ fontSize:11.5,fontWeight:800,color:SURFACE.text,flexShrink:0,fontVariantNumeric:"tabular-nums" }}>{hhmm(it.date)}</span>
                                      <span style={{ flexShrink:0,width:26,height:26,borderRadius:8,background:cfg.soft,display:"inline-flex",alignItems:"center",justifyContent:"center" }}><cfg.icon size={14} /></span>
                                      <span style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column" }}>
                                        <span style={{ fontSize:11.5,fontWeight:600,color:SURFACE.textStrong,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{it.title}</span>
                                        {(it.subtitle || it.venue) && (
                                          <span style={{ fontSize:10.5,color:SURFACE.textFaint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                            {[it.subtitle, it.venue].filter(Boolean).join(" · ")}
                                          </span>
                                        )}
                                      </span>
                                      <ChevronRightIcon size={13} color={SURFACE.borderStrong} strokeWidth={2} />
                                    </button>
                                  ); })}
                                </div>
                              </div>
                            ))}
                            {ocultos>0 && (
                              <button type="button" onClick={()=>marcarVerTodo(claveSel)}
                                style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 0",fontSize:11.5,fontWeight:700,color:BRAND.tealDark,textAlign:"center" }}>
                                Ver las {ocultos} restantes
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Vista DÍA */}
                {calView==="dia" && (
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {cursorDayItems.length===0 ? (
                      <div style={{ background:SURFACE.card,borderRadius:14,border:`1px dashed ${SURFACE.border}`,padding:"28px 16px",textAlign:"center" }}>
                        <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin actividades este día</p>
                      </div>
                    ) : cursorDayItems.map(it=>{ const cfg=TYPE_CFG[it.type]; return (
                      <button key={it.id} type="button" onClick={()=>abrirDetalle(it)}
                        style={{ width:"100%",textAlign:"left",cursor:"pointer",display:"flex",gap:10,padding:"10px 12px",borderRadius:12,
                          background:SURFACE.card,border:`1px solid ${SURFACE.border}`,borderLeft:`4px solid ${cfg.color}` }}>
                        <span style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,minWidth:44 }}>
                          <span style={{ fontSize:13.5,fontWeight:800,color:SURFACE.text,fontVariantNumeric:"tabular-nums" }}>{hhmm(it.date)}</span>
                          <span style={{ display:"inline-flex",marginTop:3 }}><cfg.icon size={15} /></span>
                        </span>
                        <span style={{ flex:1,minWidth:0 }}>
                          <span style={{ display:"block",fontSize:13,fontWeight:600,color:SURFACE.text }}>{it.title}</span>
                          {(it.subtitle||it.venue) && (
                            <span style={{ display:"block",fontSize:11,color:SURFACE.textMuted,marginTop:2 }}>{[it.subtitle,it.venue].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                        <ChevronRightIcon size={14} color={SURFACE.borderStrong} strokeWidth={2} style={{ flexShrink:0,alignSelf:"center" }} />
                      </button>
                    ); })}
                  </div>
                )}
              </div>

              {/* ── Ficha de una actividad ──
          Las cuatro vistas del calendario cortan el título para que quepa;
          acá se lee completo, con su hora, su sede y su disciplina. */}
      {calDetalle && (
        <div
          onClick={() => setCalDetalle(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520, background: SURFACE.card,
              borderRadius: "20px 20px 0 0", padding: "18px 18px 24px",
              boxShadow: "0 -8px 40px rgba(15,23,42,0.25)",
              maxHeight: "80vh", overflowY: "auto",
            }}
          >
            {/* Tirador: en el teléfono la hoja se lee como algo que se cierra
                arrastrando, aunque también se cierre tocando fuera. */}
            <div style={{ width: 38, height: 4, borderRadius: 99, background: SURFACE.border, margin: "0 auto 14px" }} />

            <span style={{
              display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
              textTransform: "uppercase", padding: "3px 10px", borderRadius: 99,
              background: calDetalle.soft, color: calDetalle.color,
            }}>
              {calDetalle.tipoLabel}
            </span>

            <p style={{ fontSize: 18, fontWeight: 800, color: SURFACE.text, margin: "10px 0 0", lineHeight: 1.25 }}>
              {calDetalle.titulo}
            </p>
            {calDetalle.subtitulo && (
              <p style={{ fontSize: 13, color: SURFACE.textMuted, margin: "4px 0 0" }}>{calDetalle.subtitulo}</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}` }}>
                <CalendarIcon size={16} color={BRAND.teal} strokeWidth={2} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SURFACE.textFaint }}>
                    Cuándo
                  </span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: SURFACE.text, textTransform: "capitalize" }}>
                    {calDetalle.fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                    {" · "}
                    {calDetalle.fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })} h
                  </span>
                </span>
              </div>

              {calDetalle.sede && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}` }}>
                  <PinIcon size={16} color={BRAND.teal} strokeWidth={2} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SURFACE.textFaint }}>
                      Dónde
                    </span>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: SURFACE.text }}>{calDetalle.sede}</span>
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {calDetalle.sede && (
                <button
                  type="button"
                  onClick={() => openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(calDetalle.sede as string)}`)}
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.textSecondary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cómo llegar
                </button>
              )}
              <button
                type="button"
                onClick={() => setCalDetalle(null)}
                style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "none", background: BRAND.teal, color: SURFACE.card, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Columna lateral ════ */}
              <div className="cal-lateral" style={{ flex:"0 1 260px",minWidth:230,display:"flex",flexDirection:"column",gap:12 }}>
                {/* Leyenda: qué significa cada punto de la cuadrícula. Una
                    línea envolvente en vez de la lista de cinco filas que
                    ocupaba una tarjeta entera; tocar un color sigue filtrando
                    por ese tipo. */}
                {!isTA && (
                <div style={{ display:"flex",flexWrap:"wrap",gap:"6px 12px",padding:"2px 2px 0" }}>
                  {(Object.keys(TYPE_CFG) as CalType[]).map(tp => (
                    <button key={tp} type="button" onClick={()=>setCalTypeFilter(calTypeFilter===tp?"":tp)}
                      style={{ display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:0,opacity: calTypeFilter && calTypeFilter!==tp ? 0.35 : 1 }}>
                      <span style={{ width:8,height:8,borderRadius:"50%",background:TYPE_CFG[tp].color,flexShrink:0 }} />
                      <span style={{ fontSize:11.5,fontWeight:600,color:SURFACE.textMuted }}>{TYPE_CFG[tp].label}</span>
                    </button>
                  ))}
                </div>
                )}

                {/* Próxima competencia — lo más valioso, primero (clave en móvil) */}
                {nextComp && (
                  <div style={{ background:`linear-gradient(135deg,#fff1f2,${SURFACE.card})`,borderRadius:14,border:"1px solid #fecdd3",padding:"14px" }}>
                    <p style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"#e11d48",margin:0 }}>Próxima competencia</p>
                    <p style={{ fontSize:14,fontWeight:800,color:SURFACE.text,margin:"6px 0 2px" }}>{nextComp.title}</p>
                    <p style={{ fontSize:12,color:SURFACE.textMuted,margin:0 }}>
                      {nextComp.date.toLocaleDateString("es-CL",{day:"2-digit",month:"long"})} · {nextComp.date.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                    {nextComp.venue && <p style={{ fontSize:12,color:SURFACE.textMuted,margin:"2px 0 0" }}><PinIcon size={11} className="inline mr-1" />{nextComp.venue}</p>}
                  </div>
                )}

                {/* Mini calendario — solo escritorio: en móvil duplica la vista Mes */}
                <div className="hidden lg:block" style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"12px" }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                    <button type="button" onClick={() => { setCalMonthCursor(new Date(y,m-1,1)); setCalCursor(new Date(y,m-1,1)); setCalSelectedDay(null); }} style={{ background:"none",border:"none",cursor:"pointer",padding:2 }}>
                      <ChevronLeftIcon size={15} color={SURFACE.textMuted} strokeWidth={2} />
                    </button>
                    <span style={{ fontSize:13,fontWeight:700,color:SURFACE.text }}>{cap1(monthLabel)}</span>
                    <button type="button" onClick={() => { setCalMonthCursor(new Date(y,m+1,1)); setCalCursor(new Date(y,m+1,1)); setCalSelectedDay(null); }} style={{ background:"none",border:"none",cursor:"pointer",padding:2 }}>
                      <ChevronRightIcon size={15} color={SURFACE.textMuted} strokeWidth={2} />
                    </button>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center" }}>
                    {["L","M","M","J","V","S","D"].map((d,i) => <div key={i} style={{ fontSize:9,fontWeight:700,color:SURFACE.textFaint,padding:3 }}>{d}</div>)}
                    {cells.map((day,i) => {
                      const isSel = day !== null && calSelectedDay===day;
                      const dayItems = day ? inMonth.filter(it => it.date.getDate()===day) : [];
                      return (
                        <button key={i} type="button" disabled={!day}
                          onClick={() => { if(!day) return; setCalSelectedDay(isSel?null:day); setCalCursor(new Date(y,m,day)); }}
                          style={{ padding:"5px 0",borderRadius:8,border:"none",cursor:day?"pointer":"default",fontSize:12,fontWeight:isSel?800:500,
                            background:isSel?BRAND.teal:day?SURFACE.card:"transparent",color:isSel?SURFACE.card:day?SURFACE.text:"transparent",position:"relative" }}>
                          {day || ""}
                          {day && daysWithEvents.has(day) && !isSel && (
                            <div style={{ position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",display:"flex",gap:1 }}>
                              {Array.from(new Set(dayItems.map(it=>it.type))).slice(0,3).map(tp => <span key={tp} style={{ width:4,height:4,borderRadius:"50%",background:TYPE_CFG[tp].color }} />)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ─── Premiaciones tab ─── */}
        {activeTab === "premiaciones" && !isChief && (() => {
          const fmtKey = (iso?: string | null) => iso ? new Date(iso).toISOString().slice(0,10) : "";
          const fmtTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}) : "";
          const fmtDateLong = (iso?: string | null) => {
            if (!iso) return "";
            const d = new Date(iso + "T00:00:00");
            return d.toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
          };
          const q = premSearchQuery.trim().toLowerCase();
          const visible = premiaciones
            .filter(p => premStatusFilter ? p.status === premStatusFilter : true)
            .filter(p => premDisciplineFilter ? String(p.discipline||"").toLowerCase() === premDisciplineFilter.toLowerCase() : true)
            .filter(p => premVenueFilter ? String(p.venueName||"").toLowerCase() === premVenueFilter.toLowerCase() : true)
            .filter(p => {
              if (!q) return true;
              return (
                String(p.title||"").toLowerCase().includes(q) ||
                String(p.discipline||"").toLowerCase().includes(q) ||
                String(p.venueName||"").toLowerCase().includes(q) ||
                String(p.locationDetail||"").toLowerCase().includes(q) ||
                String(p.notes||"").toLowerCase().includes(q)
              );
            })
            .sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
          const totalProg = premiaciones.filter(p => p.status === "PROGRAMADA").length;
          const totalReal = premiaciones.filter(p => p.status === "REALIZADA").length;
          const disciplineOpts = Array.from(new Set(premiaciones.map(p => p.discipline).filter(Boolean) as string[])).sort();
          const venueOpts = Array.from(new Set(premiaciones.map(p => p.venueName).filter(Boolean) as string[])).sort();
          // Programadas (por realizar) SIEMPRE primero — la más próxima arriba
          // y con estilo destacado; realizadas al final, apagadas.
          const groupByDay = (arr: Premiacion[]) => {
            const m = new Map<string, Premiacion[]>();
            arr.forEach(p => {
              const k = fmtKey(p.scheduledAt);
              if (!m.has(k)) m.set(k, []);
              m.get(k)!.push(p);
            });
            return m;
          };
          const pendingDays = Array.from(groupByDay(visible.filter(p => p.status !== "REALIZADA")).entries())
            .sort(([a],[b]) => a.localeCompare(b));
          const doneDays = Array.from(groupByDay(visible.filter(p => p.status === "REALIZADA")).entries())
            .sort(([a],[b]) => b.localeCompare(a));
          const hasFilters = !!(premStatusFilter || premDisciplineFilter || premVenueFilter || premSearchQuery);
          const clearAll = () => { setPremStatusFilter(""); setPremDisciplineFilter(""); setPremVenueFilter(""); setPremSearchQuery(""); };

          // Calendar view data
          const calY = premCalCursor.getFullYear();
          const calM = premCalCursor.getMonth();
          const monthLabel = premCalCursor.toLocaleDateString("es-CL",{month:"long",year:"numeric"});
          const firstDayOfMonth = new Date(calY, calM, 1).getDay();
          const daysInMonth = new Date(calY, calM + 1, 0).getDate();
          const offset = (firstDayOfMonth + 6) % 7; // Monday-first
          const calCells: (number | null)[] = Array(offset).fill(null);
          for (let dd = 1; dd <= daysInMonth; dd++) calCells.push(dd);
          while (calCells.length % 7 !== 0) calCells.push(null);
          const itemsByDay = new Map<number, Premiacion[]>();
          visible.forEach(p => {
            const d = new Date(p.scheduledAt);
            if (d.getFullYear() === calY && d.getMonth() === calM) {
              const dn = d.getDate();
              if (!itemsByDay.has(dn)) itemsByDay.set(dn, []);
              itemsByDay.get(dn)!.push(p);
            }
          });
          const monthKey = `${calY}-${String(calM+1).padStart(2,"0")}`;
          const selectedDayNum = premCalSelectedKey && premCalSelectedKey.startsWith(monthKey + "-")
            ? parseInt(premCalSelectedKey.split("-")[2], 10) : null;
          const selectedItems = selectedDayNum ? (itemsByDay.get(selectedDayNum) || []) : [];
          const today = new Date();
          const isCurrentMonth = today.getFullYear() === calY && today.getMonth() === calM;
          const todayNum = isCurrentMonth ? today.getDate() : null;
          const calDayNames = ["L","M","M","J","V","S","D"];

          const renderPremCard = (p: Premiacion) => {
            const isDone = p.status === "REALIZADA";
            const accent = isDone ? STATE.successText : STATE.warningText;
            const cnt = (p.awarders||[]).length;
            const focused = p.id === premFocusId;
            return (
              <article key={p.id} id={`prem-${p.id}`}
                style={{ background:isDone ? SURFACE.bg : `linear-gradient(135deg,#fffbeb 0%,${SURFACE.card} 70%)`,
                  borderRadius:14,border:`1px solid ${focused ? BRAND.teal : isDone?"#e2e8f0":"#f2d98a"}`,borderLeft:`4px solid ${focused ? BRAND.teal : isDone ? "#cbd5e1" : "#e3a808"}`,padding:"12px 14px",
                  boxShadow: focused ? "0 0 0 3px rgba(33,208,179,0.4), 0 8px 24px rgba(33,208,179,0.25)" : isDone ? undefined : "0 2px 10px rgba(199,140,0,0.14)",
                  opacity: isDone ? 0.82 : 1,transition:"box-shadow .4s,border-color .4s" }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                  <div style={{ width:38,height:38,borderRadius:11,flexShrink:0,
                    background: isDone ? `linear-gradient(135deg,${STATE.successSoft} 0%,#cfe9d6 100%)` : `linear-gradient(135deg,${STATE.warningSoft} 0%,rgba(245,200,66,0.5) 100%)`,
                    color: isDone ? STATE.successText : STATE.warningText,
                    border:`1px solid ${isDone?"#2e7d3233":"#c78c0033"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:`0 2px 8px ${isDone?"rgba(46,125,50,0.18)":"rgba(199,140,0,0.22)"}` }}>
                    <TrophyIcon size={18} strokeWidth={2} />
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:14,fontWeight:700,color:SURFACE.text,margin:0,lineHeight:1.3 }}>{p.title}</p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:4 }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:SURFACE.textStrong,fontWeight:600 }}>
                        <ClockIcon size={11} strokeWidth={2} />
                        {fmtTime(p.scheduledAt)}
                      </span>
                      {p.discipline && (
                        <span style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:SURFACE.textMuted }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 0 12 0H6z"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
                          {p.discipline}
                        </span>
                      )}
                      {p.venueName && (
                        <span style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:SURFACE.textMuted }}>
                          <PinIcon size={11} strokeWidth={2} />
                          {p.venueName}{p.locationDetail ? ` · ${p.locationDetail}` : ""}
                        </span>
                      )}
                    </div>
                    {p.notes && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:"6px 0 0",fontStyle:"italic",lineHeight:1.4 }}>{p.notes}</p>}
                  </div>
                  <span style={{ flexShrink:0,display:"inline-flex",alignItems:"center",gap:5,fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",
                    background:isDone?STATE.successSoft:STATE.warningSoft,
                    color:isDone?"#1e5125":STATE.warningText,
                    border:`1px solid ${isDone?"#2e7d3233":"#c78c0033"}` }}>
                    <span style={{ width:5,height:5,borderRadius:"50%",background:accent,animation:isDone?"none":"pulse 1.8s infinite" }} />
                    {isDone?"Realizada":"Programada"}
                  </span>
                </div>
                {cnt > 0 && (
                  <div style={{ marginTop:10,paddingTop:10,borderTop:`1px dashed ${SURFACE.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                    <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:SURFACE.textFaint }}>Entregadores</span>
                    {(() => {
                      const counts: Record<string, number> = {};
                      (p.awarders||[]).forEach(a => { const r = String(a.role||"AWARDER").toUpperCase(); counts[r] = (counts[r]||0)+1; });
                      const roleMeta: Record<string,{label:string;color:string;bg:string}> = {
                        GOLD:{label:"Oro",color:STATE.warningText,bg:STATE.warningSoft},
                        SILVER:{label:"Plata",color:SURFACE.textSecondary,bg:SURFACE.borderMuted},
                        BRONZE:{label:"Bronce",color:"#7c2d12",bg:"#fed7aa"},
                        AUTHORITY:{label:"Autoridad",color:STATE.infoText,bg:STATE.infoSoft},
                        AWARDER:{label:"Entregador",color:SURFACE.textSecondary,bg:SURFACE.borderMuted},
                      };
                      return Object.entries(counts).map(([r,n]) => {
                        const m = roleMeta[r] || roleMeta.AWARDER;
                        return (
                          <span key={r} style={{ fontSize:10,padding:"3px 8px",borderRadius:10,background:m.bg,color:m.color,fontWeight:700 }}>{m.label} · {n}</span>
                        );
                      });
                    })()}
                  </div>
                )}
                {/* Confirmación de asistencia — solo si soy entregador de esta premiación */}
                {(() => {
                  const mine = (p.awarders||[]).find(a => a.athleteId === athlete?.id && a.id);
                  if (!mine) return null;
                  if (mine.confirmedAt) {
                    return (
                      <div style={{ marginTop:10,paddingTop:10,borderTop:`1px dashed ${SURFACE.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" }}>
                        <span style={{ fontSize:12.5,fontWeight:700,color:STATE.successText,display:"inline-flex",alignItems:"center",gap:6 }}><CheckIcon size={13} />Confirmaste tu asistencia</span>
                        <button type="button" onClick={()=>confirmAwarder(p.id, mine.id!, "DECLINE")}
                          style={{ fontSize:11,fontWeight:600,color:STATE.dangerText,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0 }}>Ya no puedo asistir</button>
                      </div>
                    );
                  }
                  if (mine.declinedAt) {
                    return (
                      <div style={{ marginTop:10,paddingTop:10,borderTop:`1px dashed ${SURFACE.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" }}>
                        <span style={{ fontSize:12.5,fontWeight:700,color:STATE.dangerText,display:"inline-flex",alignItems:"center",gap:6 }}><XIcon size={13} />Rechazaste la asistencia</span>
                        <button type="button" onClick={()=>confirmAwarder(p.id, mine.id!, "CONFIRM")}
                          style={{ fontSize:11,fontWeight:600,color:STATE.successText,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0 }}>Confirmar asistencia</button>
                      </div>
                    );
                  }
                  return (
                    <div style={{ marginTop:10,paddingTop:10,borderTop:`1px dashed ${SURFACE.border}` }}>
                      <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:STATE.warningText }}>Confirma tu asistencia</span>
                      <div style={{ display:"flex",gap:8,marginTop:6 }}>
                        <button type="button" onClick={()=>confirmAwarder(p.id, mine.id!, "CONFIRM")}
                          style={{ flex:1,padding:"9px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:SURFACE.card,background:`linear-gradient(135deg,${BRAND.teal},#15B09A)` }}>Confirmar</button>
                        <button type="button" onClick={()=>confirmAwarder(p.id, mine.id!, "DECLINE")}
                          style={{ flex:1,padding:"9px",borderRadius:10,border:`1px solid ${STATE.dangerBorder}`,cursor:"pointer",fontSize:13,fontWeight:700,color:STATE.dangerText,background:STATE.dangerSoft }}>No puedo</button>
                      </div>
                    </div>
                  );
                })()}
              </article>
            );
          };

          return (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <div style={{ background:`linear-gradient(135deg,#fffbf2 0%,${SURFACE.card} 70%)`,borderRadius:14,border:`1px solid ${STATE.warningBorder}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:42,height:42,borderRadius:12,background:`linear-gradient(135deg,${STATE.warningText} 0%,#f5c842 50%,#e3a808 100%)`,display:"flex",alignItems:"center",justifyContent:"center",color:SURFACE.card,flexShrink:0,boxShadow:"0 4px 12px rgba(199,140,0,0.35)" }}>
                  <TrophyIcon size={22} strokeWidth={2} />
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:STATE.warningText,margin:0 }}>Premiaciones</p>
                  <p style={{ fontSize:13,color:STATE.warningText,margin:"2px 0 0",fontWeight:600 }}>{premiaciones.length} ceremonias · {totalProg} programadas · {totalReal} realizadas</p>
                </div>
              </div>

              <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"10px",display:"flex",flexDirection:"column",gap:8 }}>
                {/* View toggle */}
                <div style={{ display:"flex",gap:0,background:SURFACE.borderMuted,borderRadius:10,padding:3 }}>
                  {([
                    { v:"calendar" as const, label:"Calendario", icon:(
                      <CalendarIcon size={13} strokeWidth={2} />
                    )},
                    { v:"list" as const, label:"Lista", icon:(
                      <ListIcon size={13} strokeWidth={2} />
                    )},
                  ]).map(opt => {
                    const active = premView === opt.v;
                    return (
                      <button key={opt.v} type="button" onClick={() => setPremView(opt.v)}
                        style={{ flex:1,padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",
                          background:active ? SURFACE.card : "transparent",
                          color:active ? STATE.warningText : SURFACE.textMuted,
                          fontSize:12,fontWeight:700,
                          boxShadow:active ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
                          display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,
                          transition:"all .15s" }}>
                        {opt.icon}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ position:"relative" }}>
                  <SearchIcon size={14} color={SURFACE.textFaint} strokeWidth={2} style={{ position:"absolute",top:"50%",left:10,transform:"translateY(-50%)",pointerEvents:"none" }} />
                  <input type="text" value={premSearchQuery} onChange={e => setPremSearchQuery(e.target.value)} placeholder="Buscar premiación, disciplina, sede..."
                    style={{ width:"100%",padding:"9px 10px 9px 32px",borderRadius:10,border:`1px solid ${SURFACE.border}`,fontSize:13,outline:"none",background:SURFACE.bg,boxSizing:"border-box" }} />
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {([
                    { v:"" as const, label:"Todas", count:premiaciones.length },
                    { v:"PROGRAMADA" as const, label:"Programadas", count:totalProg },
                    { v:"REALIZADA" as const, label:"Realizadas", count:totalReal },
                  ]).map(opt => {
                    const active = premStatusFilter === opt.v;
                    const isDone = opt.v === "REALIZADA";
                    const isProg = opt.v === "PROGRAMADA";
                    return (
                      <button key={opt.v||"all"} type="button" onClick={() => setPremStatusFilter(opt.v)}
                        style={{ padding:"6px 11px",borderRadius:20,border:active ? `1px solid ${isDone?"#2e7d32":isProg?"#c78c00":BRAND.teal}` : `1px solid ${SURFACE.border}`,
                          background:active ? (isDone?STATE.successSoft:isProg?STATE.warningSoft:"rgba(33,208,179,0.12)") : SURFACE.card,
                          color:active ? (isDone?"#1e5125":isProg?STATE.warningText:BRAND.tealInk) : SURFACE.textSecondary,
                          fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,letterSpacing:"0.02em" }}>
                        {opt.label}
                        <span style={{ fontSize:10,padding:"1px 6px",borderRadius:10,background:active?"rgba(255,255,255,0.6)":SURFACE.borderMuted,color:active ? (isDone?"#1e5125":isProg?STATE.warningText:BRAND.tealInk) : SURFACE.textMuted }}>{opt.count}</span>
                      </button>
                    );
                  })}
                </div>
                {(disciplineOpts.length > 0 || venueOpts.length > 0) && (
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {disciplineOpts.length > 0 && (
                      <ChipFilter
                        value={premDisciplineFilter}
                        onChange={setPremDisciplineFilter}
                        allLabel={t("Todas las disciplinas")}
                        options={disciplineOpts.map(d => ({ value: d, label: d }))}
                      />
                    )}
                    {venueOpts.length > 0 && (
                      <ChipFilter
                        value={premVenueFilter}
                        onChange={setPremVenueFilter}
                        allLabel={t("Todas las sedes")}
                        options={venueOpts.map(v => ({ value: v, label: v }))}
                      />
                    )}
                  </div>
                )}
                {hasFilters && (
                  <button type="button" onClick={clearAll}
                    style={{ alignSelf:"flex-start",padding:"4px 10px",borderRadius:8,border:`1px solid ${STATE.dangerBorder}`,background:STATE.dangerSoft,color:STATE.dangerText,fontSize:11,fontWeight:600,cursor:"pointer" }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              {/* Calendar view */}
              {premView === "calendar" && (
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${STATE.warningBorder}`,padding:"12px",boxShadow:"0 1px 3px rgba(199,140,0,0.06)" }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                      <button type="button" onClick={() => { setPremCalCursor(new Date(calY, calM - 1, 1)); setPremCalSelectedKey(null); }}
                        style={{ width:30,height:30,borderRadius:8,border:`1px solid ${STATE.warningBorder}`,background:"#fffbf2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <ChevronLeftIcon size={14} color={STATE.warningText} strokeWidth={2.5} />
                      </button>
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
                        <span style={{ fontSize:14,fontWeight:800,color:STATE.warningText,textTransform:"capitalize",letterSpacing:"-0.01em" }}>{monthLabel}</span>
                        <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:STATE.warningText,marginTop:2 }}>{itemsByDay.size} día{itemsByDay.size === 1 ? "" : "s"} con premiaciones</span>
                      </div>
                      <button type="button" onClick={() => { setPremCalCursor(new Date(calY, calM + 1, 1)); setPremCalSelectedKey(null); }}
                        style={{ width:30,height:30,borderRadius:8,border:`1px solid ${STATE.warningBorder}`,background:"#fffbf2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <ChevronRightIcon size={14} color={STATE.warningText} strokeWidth={2.5} />
                      </button>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,textAlign:"center" }}>
                      {calDayNames.map((dn,i) => <div key={i} style={{ fontSize:9,fontWeight:800,color:SURFACE.textFaint,letterSpacing:"0.1em",padding:"4px 0" }}>{dn}</div>)}
                      {calCells.map((dn,i) => {
                        if (!dn) return <div key={`empty-${i}`} />;
                        const dayKey = `${calY}-${String(calM+1).padStart(2,"0")}-${String(dn).padStart(2,"0")}`;
                        const dayItems = itemsByDay.get(dn) || [];
                        const hasItems = dayItems.length > 0;
                        const isSelected = premCalSelectedKey === dayKey;
                        const isToday = todayNum === dn;
                        const anyDone = dayItems.some(p => p.status === "REALIZADA");
                        const anyProg = dayItems.some(p => p.status === "PROGRAMADA");
                        return (
                          <button key={dayKey} type="button" onClick={() => setPremCalSelectedKey(isSelected ? null : dayKey)}
                            style={{ aspectRatio:"1",borderRadius:8,border:isSelected ? `2px solid ${STATE.warningText}` : isToday ? `1.5px solid ${STATE.warningText}` : "1px solid transparent",
                              background:isSelected ? `linear-gradient(135deg,${STATE.warningText} 0%,#f5c842 100%)`
                                : hasItems ? `linear-gradient(135deg,${STATE.warningSoft} 0%,#fffbf2 100%)`
                                : SURFACE.card,
                              color:isSelected ? SURFACE.card : isToday ? STATE.warningText : hasItems ? SURFACE.text : SURFACE.text,
                              fontSize:12,fontWeight:isSelected||isToday?800:hasItems?700:500,cursor:"pointer",position:"relative",
                              boxShadow:isSelected ? "0 3px 8px rgba(199,140,0,0.35)" : hasItems ? "0 1px 2px rgba(199,140,0,0.1)" : "none",
                              transition:"all .15s",padding:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2 }}>
                            <span>{dn}</span>
                            {hasItems && !isSelected && (
                              <div style={{ display:"flex",gap:2,alignItems:"center" }}>
                                {anyProg && <span style={{ width:4,height:4,borderRadius:"50%",background:STATE.warningText }} />}
                                {anyDone && <span style={{ width:4,height:4,borderRadius:"50%",background:STATE.successText }} />}
                                {dayItems.length > 2 && <span style={{ fontSize:8,fontWeight:800,color:STATE.warningText,marginLeft:1 }}>+{dayItems.length-2}</span>}
                              </div>
                            )}
                            {isSelected && hasItems && (
                              <span style={{ fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:8,background:"rgba(255,255,255,0.3)",color:SURFACE.card }}>{dayItems.length}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div style={{ display:"flex",alignItems:"center",gap:14,marginTop:10,paddingTop:10,borderTop:`1px dashed ${STATE.warningBorder}`,justifyContent:"center" }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:STATE.warningText,fontWeight:600 }}>
                        <span style={{ width:6,height:6,borderRadius:"50%",background:STATE.warningText }} />Programada
                      </span>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#1e5125",fontWeight:600 }}>
                        <span style={{ width:6,height:6,borderRadius:"50%",background:STATE.successText }} />Realizada
                      </span>
                      {todayNum && (
                        <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:STATE.warningText,fontWeight:600 }}>
                          <span style={{ width:8,height:8,borderRadius:4,border:`1.5px solid ${STATE.warningText}`,background:SURFACE.card }} />Hoy
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected day items */}
                  {selectedDayNum ? (
                    selectedItems.length > 0 ? (
                      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        <div style={{ padding:"6px 10px",borderRadius:10,background:`linear-gradient(135deg,${STATE.warningSoft} 0%,#fffbf2 100%)`,display:"flex",alignItems:"center",gap:8,border:`1px solid ${STATE.warningBorder}` }}>
                          <div style={{ width:6,height:6,borderRadius:"50%",background:STATE.warningText,boxShadow:`0 0 6px ${STATE.warningText}` }} />
                          <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:STATE.warningText,margin:0 }}>{fmtDateLong(premCalSelectedKey!)}</p>
                          <span style={{ marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:SURFACE.card,color:STATE.warningText,border:`1px solid ${STATE.warningBorder}` }}>{selectedItems.length}</span>
                        </div>
                        {selectedItems.map(p => renderPremCard(p))}
                      </div>
                    ) : (
                      <div style={{ background:SURFACE.card,borderRadius:14,border:`1px dashed ${SURFACE.border}`,padding:"20px",textAlign:"center" }}>
                        <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Sin premiaciones este día</p>
                      </div>
                    )
                  ) : (
                    <div style={{ background:SURFACE.card,borderRadius:14,border:`1px dashed ${SURFACE.border}`,padding:"20px",textAlign:"center" }}>
                      <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>Selecciona un día para ver sus premiaciones</p>
                    </div>
                  )}
                </div>
              )}

              {/* List view */}
              {premView === "list" && (
                visible.length === 0 ? (
                  <div style={{ background:SURFACE.card,borderRadius:14,border:`1px dashed ${SURFACE.border}`,padding:"28px 20px",textAlign:"center" }}>
                    <p style={{ margin:"0 0 8px",color:SURFACE.borderStrong,display:"flex",justifyContent:"center" }}><TrophyIcon size={32} /></p>
                    <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>
                      {hasFilters ? "No hay premiaciones con esos filtros" : "Sin premiaciones cargadas"}
                    </p>
                  </div>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                    {pendingDays.length > 0 && (
                      <button type="button" onClick={() => setPremPendingOpen(v => !v)}
                        style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:12,background:`linear-gradient(135deg,${STATE.warningSoft} 0%,${STATE.warningSoft} 100%)`,border:"1px solid #f2d98a",cursor:"pointer",width:"100%",textAlign:"left" }}>
                        <span style={{ width:8,height:8,borderRadius:"50%",background:"#e3a808",boxShadow:"0 0 8px #e3a808",flexShrink:0 }} />
                        <p style={{ fontSize:11.5,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:STATE.warningText,margin:0 }}>Por realizar</p>
                        <span style={{ marginLeft:"auto",fontSize:10,fontWeight:800,padding:"2px 9px",borderRadius:99,background:SURFACE.card,color:STATE.warningText,border:`1px solid ${STATE.warningBorder}` }}>
                          {pendingDays.reduce((s,[,items]) => s + items.length, 0)}
                        </span>
                        <ChevronDownIcon size={14} color={STATE.warningText} strokeWidth={2.5} style={{ flexShrink:0,transform:premPendingOpen?"rotate(180deg)":"none",transition:"transform .2s" }} />
                      </button>
                    )}
                    {premPendingOpen && pendingDays.map(([day, items]) => (
                      <div key={day} style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        <div style={{ position:"sticky",top:0,zIndex:2,background:`linear-gradient(180deg,${STATE.warningSoft} 0%,rgba(255,251,235,0.92) 100%)`,backdropFilter:"blur(6px)",padding:"6px 10px",borderRadius:10,display:"flex",alignItems:"center",gap:8,border:"1px solid #f2d98a" }}>
                          <div style={{ width:6,height:6,borderRadius:"50%",background:STATE.warningText,boxShadow:`0 0 6px ${STATE.warningText}` }} />
                          <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:STATE.warningText,margin:0 }}>{fmtDateLong(day)}</p>
                          <span style={{ marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:SURFACE.card,color:STATE.warningText,border:`1px solid ${STATE.warningBorder}` }}>{items.length}</span>
                        </div>
                        {items.map(p => renderPremCard(p))}
                      </div>
                    ))}
                    {doneDays.length > 0 && (
                      <button type="button" onClick={() => setPremDoneOpen(v => !v)}
                        style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:12,background:SURFACE.borderMuted,border:`1px solid ${SURFACE.border}`,marginTop: pendingDays.length > 0 ? 6 : 0,cursor:"pointer",width:"100%",textAlign:"left" }}>
                        <span style={{ width:8,height:8,borderRadius:"50%",background:STATE.successText,flexShrink:0 }} />
                        <p style={{ fontSize:11.5,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:SURFACE.textMuted,margin:0 }}>Realizadas</p>
                        <span style={{ marginLeft:"auto",fontSize:10,fontWeight:800,padding:"2px 9px",borderRadius:99,background:SURFACE.card,color:SURFACE.textMuted,border:`1px solid ${SURFACE.border}` }}>
                          {doneDays.reduce((s,[,items]) => s + items.length, 0)}
                        </span>
                        <ChevronDownIcon size={14} color={SURFACE.textMuted} strokeWidth={2.5} style={{ flexShrink:0,transform:premDoneOpen?"rotate(180deg)":"none",transition:"transform .2s" }} />
                      </button>
                    )}
                    {premDoneOpen && doneDays.map(([day, items]) => (
                      <div key={day} style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        <div style={{ position:"sticky",top:0,zIndex:2,background:`linear-gradient(180deg,${SURFACE.bg} 0%,rgba(248,250,252,0.92) 100%)`,backdropFilter:"blur(6px)",padding:"6px 10px",borderRadius:10,display:"flex",alignItems:"center",gap:8,border:`1px solid ${SURFACE.border}` }}>
                          <div style={{ width:6,height:6,borderRadius:"50%",background:SURFACE.textFaint }} />
                          <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SURFACE.textMuted,margin:0 }}>{fmtDateLong(day)}</p>
                          <span style={{ marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:SURFACE.card,color:SURFACE.textMuted,border:`1px solid ${SURFACE.border}` }}>{items.length}</span>
                        </div>
                        {items.map(p => renderPremCard(p))}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })()}

        {/* ─── Sedes tab ─── */}
        {activeTab === "sedes" && isComite && (
          <div style={{ marginBottom: 10 }}>
            <FiltrosComite
              delegaciones={delegacionesEvento}
              disciplinas={disciplineParents}
              delegacionId={comiteDelegacion}
              disciplinaId={comiteDisciplina}
              onDelegacion={setComiteDelegacion}
              onDisciplina={setComiteDisciplina}
              resumen="Las sedes y comedores del evento son los mismos para todas las regiones."
            />
          </div>
        )}
        {activeTab === "sedes" && (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {(() => {
              // Sedes de competencia y comedores son recintos distintos.
              const sedes = venues.filter(v => (v.venueType ?? "SEDE") !== "COMEDOR");
              const comedores = venues.filter(v => (v.venueType ?? "SEDE") === "COMEDOR");
              const visibles = sedesVista === "comedores" ? comedores : sedes;
              return (
                <>
                  <SegmentedFilter
                    value={sedesVista}
                    onChange={(value) => setSedesVista(value as "sedes" | "comedores" | "hoteles")}
                    options={[
                      { value: "sedes", label: t("Sedes"), count: sedes.length },
                      ...(comedores.length > 0 ? [{ value: "comedores", label: t("Comedores"), count: comedores.length }] : []),
                      { value: "hoteles", label: t("Hoteles"), count: allAccommodations.length },
                    ]}
                  />
                  {sedesVista !== "hoteles" && visibles.length === 0 && (
                    <p style={{ fontSize:13,color:SURFACE.textFaint,textAlign:"center",padding:20 }}>
                      {sedesVista === "comedores" ? t("No hay comedores registrados") : t("No hay sedes registradas")}
                    </p>
                  )}
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {sedesVista !== "hoteles" && visibles.map(v => (
                    <TarjetaLugar
                      key={v.id}
                      nombre={v.name || "–"}
                      direccion={v.address}
                      lugar={[v.commune, v.region].filter(Boolean).join(", ") || null}
                      foto={v.photoUrl}
                      tipo={(v.venueType ?? "SEDE") === "COMEDOR" ? "comedor" : "sede"}
                      etiquetas={etiquetasDeDisciplinas(v)}
                      // El coordinador de sede es el contacto operativo del
                      // recinto, como el del hotel: lo ve cualquiera que llegue
                      // ahí, no sólo el jefe de misión.
                      coordinador={(v.coordinatorName || v.coordinatorPhone)
                        ? { nombre: v.coordinatorName, telefono: v.coordinatorPhone, rotulo: t("Coordinador de sede") }
                        : null}
                      abierta={expandedItemId === `venue-${v.id}`}
                      onToggle={() => setExpandedItemId(expandedItemId === `venue-${v.id}` ? null : `venue-${v.id}`)}
                    />
                  ))}
                  </div>
                </>
              );
            })()}
            {/* Hoteles: para el Jefe de Misión, sólo donde se aloja su delegación. */}
            {sedesVista === "hoteles" && isChief && allAccommodations.length > 0 && (
              <p style={{ fontSize:11.5,color:SURFACE.textMuted,margin:0,padding:"8px 12px",borderRadius:10,background:SURFACE.borderMuted }}>
                {t("Hoteles donde se aloja tu delegación.")}
              </p>
            )}
            {sedesVista === "hoteles" && allAccommodations.length === 0 && (
              <p style={{ fontSize:13,color:SURFACE.textFaint,textAlign:"center",padding:20 }}>
                {isChief ? t("Tu delegación aún no tiene hotel asignado.") : t("No hay hoteles registrados")}
              </p>
            )}
            {sedesVista === "hoteles" && allAccommodations.map(h => (
              <TarjetaLugar
                key={h.id}
                nombre={h.name || "–"}
                direccion={h.address}
                lugar={[h.city, h.country].filter(Boolean).join(", ") || null}
                foto={h.photoUrl}
                tipo="hotel"
                // Los deportes que duermen acá, como las disciplinas de una
                // sede: saber qué hotel es el del vóleibol se preguntaba a
                // mano y la tarjeta ya tenía dónde decirlo.
                etiquetas={etiquetasDeDisciplinas(h)}
                // Los coordinadores del hotel, con llamada y WhatsApp. Antes
                // esto leía un `contactPhone` que la API nunca entregó, así
                // que el bloque no se dibujaba nunca.
                contactos={contactosDeHotel(h.coordinators, t)}
                datos={[
                  ...(h.checkIn ? [{ etiqueta: "Check-in", valor: new Date(h.checkIn).toLocaleDateString("es-CL") }] : []),
                  ...(h.checkOut ? [{ etiqueta: "Check-out", valor: new Date(h.checkOut).toLocaleDateString("es-CL") }] : []),
                  ...(h.roomType ? [{ etiqueta: t("Habitación"), valor: h.roomType }] : []),
                ]}
                abierta={expandedItemId === `hotel-${h.id}`}
                onToggle={() => setExpandedItemId(expandedItemId === `hotel-${h.id}` ? null : `hotel-${h.id}`)}
              />
            ))}
          </div>
        )}

        {/* ─── Alimentación tab ─── */}
        {/* ─── Hoteles (Coordinador de Comité) ───
            No es un listado de hoteles: es quién duerme en cada uno, según la
            distribución por región y deporte. */}
        {activeTab === "hoteles" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FiltrosComite
              delegaciones={delegacionesEvento}
              disciplinas={disciplineParents}
              delegacionId={comiteDelegacion}
              disciplinaId={comiteDisciplina}
              onDelegacion={setComiteDelegacion}
              onDisciplina={setComiteDisciplina}
              resumen="Con un filtro puesto se muestran sólo los hoteles que alojan esa selección."
            />
            <HotelesComite
              eventId={athlete.eventId}
              hoteles={allAccommodations}
              delegaciones={delegacionesEvento}
              disciplinas={disciplineParents}
              delegacionFiltro={comiteDelegacion}
              disciplinaFiltro={comiteDisciplina}
            />
          </div>
        )}

        {activeTab === "alimentacion" && (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {isChief && (
              <p style={{ fontSize:12,color:SURFACE.textMuted,margin:0,padding:"8px 12px",borderRadius:10,background:SURFACE.borderMuted }}>
                {t("Alimentación de tu delegación: lugares y menús de sus hoteles, más los puntos generales.")}
              </p>
            )}

            {/* Arriba de todo: hasta qué hora se puede ir a comer es lo que se
                pregunta con el comedor cerrando, antes que qué hay de postre. */}
            <HorariosComida eventId={athlete.eventId} />

            {/* Credencial QR para validar en el comedor */}
            {mealQrDataUrl && (
              <div style={{ background:`linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14 }}>
                <button type="button" onClick={() => setMealQrZoom(true)} title="Ver QR más grande"
                  style={{ background:SURFACE.card,borderRadius:12,padding:6,flexShrink:0,border:"none",cursor:"pointer" }}>
                  <img src={mealQrDataUrl} alt="QR credencial" style={{ width:96,height:96,display:"block" }} />
                </button>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:10,fontWeight:800,letterSpacing:"0.18em",textTransform:"uppercase",color:BRAND.tealLight,margin:0 }}>Tu credencial</p>
                  <p style={{ fontSize:14,fontWeight:700,color:SURFACE.card,margin:"4px 0 0",lineHeight:1.3 }}>
                    Muestra este QR al ingresar al lugar de comida
                  </p>
                  <p style={{ fontSize:11.5,color:"rgba(255,255,255,0.65)",margin:"4px 0 0" }}>
                    Código: <span style={{ fontFamily:"monospace",fontWeight:700,color:BRAND.tealLight,letterSpacing:"0.15em" }}>{(athlete.credentialCode || athlete.id.slice(-6)).toUpperCase()}</span>
                  </p>
                  <p style={{ fontSize:10.5,color:"rgba(255,255,255,0.45)",margin:"4px 0 0" }}>
                    Toca el QR para verlo más grande
                  </p>
                </div>
              </div>
            )}
            {mealQrZoom && mealQrDataUrl && (
              <QrFullscreenOverlay
                qrDataUrl={mealQrDataUrl}
                code={athlete.credentialCode || athlete.id.slice(-6)}
                title="Credencial de alimentación"
                subtitle="Muestra este QR al ingresar al lugar de comida."
                onClose={() => setMealQrZoom(false)}
              />
            )}

            {/* Menú de hoy y de mañana.
                Cada fila de food_menus es una categoría, así que un día
                cargado son doce: MenuDelDia las agrupa por comida en vez de
                apilarlas con la insignia repetida. Los dos bloques eran el
                mismo código escrito dos veces. */}
            {(() => {
              const miTipo = normalizeClientType(athlete.userType);
              const delDia = (clave: string) =>
                foodMenus
                  .filter((fm) => fm.date === clave)
                  .filter((fm) => {
                    const tipos = (fm.clientTypes || []).map((valor) => normalizeClientType(valor));
                    return tipos.length === 0 || tipos.includes(miTipo);
                  });
              // En hora local: en UTC, de noche en Chile "hoy" ya es mañana y
              // el menú saltaba de día antes de tiempo.
              const claveDe = (fecha: Date) =>
                `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
              const hoy = new Date();
              const manana = new Date();
              manana.setDate(manana.getDate() + 1);
              const comoFecha = (fecha: Date) =>
                fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
              return (
                <>
                  <MenuDelDia
                    menus={delDia(claveDe(hoy))}
                    titulo={t("Menú de hoy")}
                    fecha={comoFecha(hoy)}
                    vacio={t("No hay menú programado para hoy")}
                  />
                  <MenuDelDia
                    atenuado
                    menus={delDia(claveDe(manana))}
                    titulo={t("Menú de mañana")}
                    fecha={comoFecha(manana)}
                    vacio={t("Menú pendiente de programar")}
                  />
                </>
              );
            })()}

            {/* Food locations — filtrados por tipo de cliente y hotel asignado */}
            {(() => {
              const userType = normalizeClientType(athlete.userType);
              const myHotelId = hotelAssignment?.hotelId || athlete.hotelAccommodationId || null;
              const myLocations = foodLocations.filter((fl) => {
                const types = (fl.clientTypes || []).map((t) => normalizeClientType(t));
                const typeOk = types.length === 0 || types.includes(userType);
                const hotelOk = !fl.accommodationId || !myHotelId || fl.accommodationId === myHotelId;
                return typeOk && hotelOk;
              });
              return (
              <>
              {myLocations.length > 0 && (
              <div style={{ background:SURFACE.card,borderRadius:16,border:`1px solid ${SURFACE.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)" }}>
                <div style={{ padding:"14px 16px",background:"linear-gradient(135deg,rgba(33,208,179,0.06),rgba(31,205,255,0.04))",borderBottom:`1px solid ${SURFACE.border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <PinIcon size={16} color={BRAND.teal} strokeWidth={2} />
                    <p style={{ fontSize:13,fontWeight:700,color:SURFACE.text,margin:0 }}>Tus lugares de comida</p>
                  </div>
                </div>
                {myLocations.map((fl, i) => {
                  const acc = fl.accommodationId ? allAccommodations.find((a) => a.id === fl.accommodationId) : null;
                  const mapQuery = [acc?.name || fl.name, acc?.address].filter(Boolean).join(", ");
                  const isOpen = expandedItemId === `food-${fl.id}`;
                  return (
                  <div key={fl.id} style={{ borderTop:i>0?`1px solid ${SURFACE.borderMuted}`:"none" }}>
                    <div style={{ padding:"12px 16px",display:"flex",alignItems:"center",gap:12 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:"rgba(33,208,179,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <CoffeeIcon size={16} color={BRAND.teal} strokeWidth={2} />
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:14,fontWeight:700,color:SURFACE.text,margin:0 }}>{fl.name}</p>
                        {fl.description && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:"2px 0 0",lineHeight:1.3 }}>{fl.description}</p>}
                        {acc?.address && <p style={{ fontSize:11,color:SURFACE.textFaint,margin:"2px 0 0",lineHeight:1.3 }}><PinIcon size={11} className="inline mr-1" />{acc.address}</p>}
                      </div>
                      {fl.capacity && <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8,background:SURFACE.borderMuted,color:SURFACE.textSecondary,flexShrink:0 }}>{fl.capacity} pax</span>}
                      <button type="button" onClick={() => setExpandedItemId(isOpen ? null : `food-${fl.id}`)}
                        style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:9,border:`1px solid ${isOpen ? BRAND.teal : "rgba(33,208,179,0.35)"}`,background:isOpen?"rgba(33,208,179,0.14)":"rgba(33,208,179,0.06)",color:BRAND.tealInk,fontSize:11,fontWeight:800,cursor:"pointer",flexShrink:0 }}>
                        <PinIcon size={12} strokeWidth={2} />
                        {isOpen ? "Cerrar" : "Mapa"}
                      </button>
                    </div>
                    {isOpen && (
                      <div style={{ padding:"0 16px 12px" }}>
                        <VenueMap title={fl.name} query={mapQuery} />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              )}
              {myLocations.length === 0 && (
              <div style={{ background:SURFACE.card,borderRadius:16,border:`1px dashed ${SURFACE.border}`,padding:24,textAlign:"center" }}>
                <CoffeeIcon size={28} color={SURFACE.borderStrong} strokeWidth={1.5} style={{ margin:"0 auto 8px" }} />
                <p style={{ fontSize:13,fontWeight:600,color:SURFACE.textFaint,margin:0 }}>{loading ? "Cargando lugares de comida…" : "No hay lugares asignados a tu perfil"}</p>
              </div>
              )}
              </>
              );
            })()}

          </div>
        )}

        {/* ─── Mi Delegación tab ─── */}
        {activeTab === "delegacion" && isChief && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"14px",borderLeft:`4px solid ${STATE.warning}` }}>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:STATE.warning,margin:"0 0 6px" }}>Mi Delegación</p>
              <p style={{ fontSize:13,fontWeight:700,color:SURFACE.text,margin:0 }}>{delegationName || "—"}</p>
              <p style={{ fontSize:12,color:SURFACE.textMuted,margin:"3px 0 0" }}>{delegationMembers.length} deportista(s) registrado(s)</p>
            </div>
            {delegationMembers.length === 0 ? (
              <div style={{ padding:20,textAlign:"center",background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}` }}>
                <p style={{ fontSize:13,color:SURFACE.textFaint,margin:0 }}>No hay otros participantes en tu delegación.</p>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {delegationMembers.map((m) => {
                  const disc = m.disciplineId ? ([...disciplineParents, ...calendarEvents] as any[]).find((d: any) => d.id === m.disciplineId) : null;
                  const discParent = disc?.parentId ? disciplineParents.find(p => p.id === disc.parentId) : null;
                  const discLabel = discParent ? `${discParent.name} — ${disc?.name}` : disc?.name;
                  const memberHotel = m.hotelAccommodationId ? allAccommodations.find(a => a.id === m.hotelAccommodationId)?.name : null;
                  const memberFlight = m.flightNumber ? `${m.airline ? `${m.airline} · ` : ""}${m.flightNumber}` : null;
                  const accreditation = (m.accreditationStatus || "").toUpperCase();
                  const accLabel = accreditation === "APPROVED" || accreditation === "ISSUED" ? "Acreditado"
                    : accreditation === "REJECTED" ? "Acreditación rechazada"
                    : accreditation ? "Acreditación pendiente" : null;
                  return (
                    <div key={m.id} style={{ background:SURFACE.card,borderRadius:12,border:`1px solid ${SURFACE.border}`,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10 }}>
                      <div style={{ width:36,height:36,borderRadius:"50%",background:SURFACE.borderMuted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:SURFACE.textMuted,flexShrink:0 }}>
                        {(m.fullName || "?").split(" ").slice(0,2).map(w => w[0] || "").join("").toUpperCase()}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:13,fontWeight:600,color:SURFACE.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.fullName}</p>
                        <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginTop:3 }}>
                          {m.userType && <span style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:SURFACE.borderMuted,color:SURFACE.textMuted }}>{m.userType}</span>}
                          {discLabel && <span style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"rgba(33,208,179,0.1)",color:BRAND.tealInk }}>{discLabel}</span>}
                          {m.countryCode && <span style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"rgba(99,102,241,0.08)",color:ACCENT.indigo }}>{m.countryCode}</span>}
                          {accLabel && <span style={{ fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,
                            background: accLabel === "Acreditado" ? "rgba(16,185,129,0.1)" : accLabel === "Acreditación rechazada" ? "rgba(239,68,68,0.1)" : STATE.warningSoft,
                            color: accLabel === "Acreditado" ? STATE.successText : accLabel === "Acreditación rechazada" ? STATE.dangerText : STATE.warningText }}>{accLabel}</span>}
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:2,marginTop:6 }}>
                          {m.email && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}><MailIcon size={11} className="inline mr-1" />{m.email}</p>}
                          {m.phone && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:0 }}><PhoneIcon size={11} className="inline mr-1" />{m.phone}</p>}
                          {memberFlight && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:0 }}><PlaneIcon size={11} className="inline mr-1" />{memberFlight}{m.arrivalTime ? ` · ${fmt(m.arrivalTime)}` : ""}</p>}
                          {memberHotel && <p style={{ fontSize:11,color:SURFACE.textMuted,margin:0 }}><HotelIcon size={11} className="inline mr-1" />{memberHotel}{m.roomNumber ? ` · Hab. ${m.roomNumber}` : ""}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Flota (Jefe de Misión) ─── */}
        {activeTab === "flota" && isChief && (
          <MissionFleet
            focoTripId={focoViajeId}
            eventId={athlete.eventId}
            delegationName={delegationName}
            trips={delegationTrips.filter((tr) => tr.allDelegations || (tr.delegationId && tr.delegationId === athlete.delegationId))}
            venues={venues}
            accommodations={nombresHoteles.length ? nombresHoteles : allAccommodations}
            comedores={foodLocations}
          />
        )}

        {/* ─── Cupones tab ─── */}
        {activeTab === "cupones" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {/* Sub-tabs */}
            <div className="rounded-2xl p-1 flex gap-1" style={{ background:SURFACE.card, border:`1px solid ${SURFACE.border}`, boxShadow:"0 1px 4px rgba(15,23,42,0.05)" }}>
              <button type="button" onClick={() => setCouponTab("available")}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-2"
                style={{
                  background: couponTab === "available" ? `linear-gradient(135deg,${BRAND.teal} 0%,#15B09A 100%)` : "transparent",
                  color: couponTab === "available" ? SURFACE.card : SURFACE.textMuted,
                  boxShadow: couponTab === "available" ? "0 4px 14px rgba(33,208,179,0.32)" : "none",
                  border: "none", cursor: "pointer", letterSpacing: "0.01em",
                }}>
                Disponibles
                <span className="text-[10px] rounded-full font-bold px-2 py-0.5"
                  style={{
                    background: couponTab === "available" ? "rgba(255,255,255,0.25)" : SURFACE.borderMuted,
                    color: couponTab === "available" ? SURFACE.card : SURFACE.textMuted,
                  }}>
                  {visibleCouponsAvailable.filter((c) => !c._exhausted).length}
                </span>
              </button>
              <button type="button" onClick={() => setCouponTab("mine")}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-2"
                style={{
                  background: couponTab === "mine" ? `linear-gradient(135deg,${BRAND.teal} 0%,#15B09A 100%)` : "transparent",
                  color: couponTab === "mine" ? SURFACE.card : SURFACE.textMuted,
                  boxShadow: couponTab === "mine" ? "0 4px 14px rgba(33,208,179,0.32)" : "none",
                  border: "none", cursor: "pointer", letterSpacing: "0.01em",
                }}>
                Mis beneficios
                <span className="text-[10px] rounded-full font-bold px-2 py-0.5"
                  style={{
                    background: couponTab === "mine" ? "rgba(255,255,255,0.25)" : SURFACE.borderMuted,
                    color: couponTab === "mine" ? SURFACE.card : SURFACE.textMuted,
                  }}>
                  {couponClaims.filter((m) => m.status === "CLAIMED").length}
                </span>
              </button>
            </div>

            {couponError && (
              <div style={{ borderRadius:14, padding:"10px 14px", background:STATE.dangerSoft, border:`1px solid ${STATE.dangerBorder}`, color:"#7a1313", fontSize:13 }}>
                {couponError}
              </div>
            )}

            {couponTab === "available" ? (
              visibleCouponsAvailable.length === 0 ? (
                <div style={{ padding:24, textAlign:"center", background:SURFACE.card, borderRadius:14, border:`1px solid ${SURFACE.border}` }}>
                  <p style={{ fontSize:14, fontWeight:600, color:SURFACE.text, margin:0 }}>No hay beneficios disponibles</p>
                  <p style={{ fontSize:12, color:SURFACE.textFaint, margin:"6px 0 0" }}>Vuelve a chequear más tarde, vamos a estar agregando beneficios durante el evento.</p>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
                  {visibleCouponsAvailable.map((c) => {
                    const cat = COUPON_CATEGORIES[c.category] || COUPON_CATEGORIES.OTHER;
                    const exhausted = c._exhausted;
                    return (
                      <article key={c.id}
                        style={{
                          background:SURFACE.card, borderRadius:18, overflow:"hidden",
                          border:"1px solid rgba(15,23,42,0.06)",
                          boxShadow: exhausted ? "0 1px 4px rgba(15,23,42,0.06)" : "0 4px 16px rgba(15,23,42,0.08)",
                          opacity: exhausted ? 0.6 : 1,
                        }}>
                        <div style={{ position:"relative", width:"100%", aspectRatio:"16/9", background:`linear-gradient(135deg, ${cat.color}30 0%, ${cat.color}60 100%)` }}>
                          {c.imageUrl && (
                            <img src={c.imageUrl} alt={c.title} loading="lazy"
                              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(to top, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.2) 35%, transparent 60%)" }} />
                          <span style={{
                            position:"absolute", top:10, left:10,
                            display:"inline-flex", alignItems:"center", gap:5,
                            background:"rgba(255,255,255,0.92)", color:cat.color,
                            padding:"3px 9px", borderRadius:99, fontSize:10, fontWeight:800,
                            textTransform:"uppercase", letterSpacing:"0.05em",
                            boxShadow:"0 2px 6px rgba(0,0,0,0.12)",
                          }}>
                            <span style={{ width:5, height:5, borderRadius:"50%", background:cat.color }} />
                            {cat.label}
                          </span>
                          <div style={{
                            position:"absolute", top:10, right:10,
                            background:`linear-gradient(135deg, ${cat.color} 0%, ${cat.color}d0 100%)`,
                            color:SURFACE.card, padding:"6px 12px", borderRadius:14, fontSize:15, fontWeight:800,
                            boxShadow:`0 6px 18px ${cat.color}66`,
                          }}>
                            {couponDiscountDisplay(c)}
                          </div>
                          {c.partnerName && (
                            <div style={{ position:"absolute", bottom:10, left:10, right:10, display:"flex", alignItems:"center", gap:8 }}>
                              {c.partnerLogoUrl ? (
                                <img src={c.partnerLogoUrl} alt={c.partnerName} loading="lazy"
                                  style={{ width:28, height:28, borderRadius:"50%", background:SURFACE.card, padding:2, border:"2px solid rgba(255,255,255,0.95)", boxShadow:"0 3px 8px rgba(0,0,0,0.22)", objectFit:"contain" }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div style={{ width:28, height:28, borderRadius:"50%", background:SURFACE.card, color:cat.color, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid rgba(255,255,255,0.95)", boxShadow:"0 3px 8px rgba(0,0,0,0.22)" }}>
                                  {c.partnerName.slice(0,2).toUpperCase()}
                                </div>
                              )}
                              <span style={{ color:SURFACE.card, fontWeight:700, fontSize:13, textShadow:"0 1px 3px rgba(0,0,0,0.55)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {c.partnerName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={{ padding:"12px 14px 4px" }}>
                          <p style={{ fontSize:14, fontWeight:700, color:SURFACE.text, margin:0, lineHeight:1.25 }}>{c.title}</p>
                          {c.description && (
                            <p style={{ fontSize:11.5, color:SURFACE.textMuted, margin:"6px 0 0", lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as any, overflow:"hidden" }}>
                              {c.description}
                            </p>
                          )}
                          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
                            {c.validUntil && (
                              <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10.5, color:SURFACE.textMuted, fontWeight:500 }}>
                                <CalendarIcon size={11} strokeWidth={2} />
                                Hasta {fmtCouponDate(c.validUntil)}
                              </span>
                            )}
                            {c.partnerAddress && (
                              <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10.5, color:SURFACE.textMuted, fontWeight:500, maxWidth:170, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                <PinIcon size={11} strokeWidth={2} />
                                {c.partnerAddress}
                              </span>
                            )}
                          </div>
                        </div>
                        <button type="button" disabled={exhausted || couponClaiming === c.id} onClick={() => claimCoupon(c.id)}
                          style={{
                            width:"100%", marginTop:10, padding:"12px 0", border:"none", fontSize:13, fontWeight:800, color:SURFACE.card,
                            background: exhausted ? `linear-gradient(135deg,${SURFACE.textFaint} 0%,${SURFACE.textMuted} 100%)` : `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
                            cursor: exhausted ? "not-allowed" : "pointer", letterSpacing:"0.02em",
                            display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
                          }}>
                          {exhausted ? (
                            <>
                              <CheckIcon size={13} strokeWidth={2.5} />
                              Ya lo reclamaste
                            </>
                          ) : couponClaiming === c.id ? (
                            <>Reclamando…</>
                          ) : (
                            <>
                              Reclamar beneficio
                              <ArrowRightIcon size={13} strokeWidth={2.5} />
                            </>
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )
            ) : couponClaims.length === 0 ? (
              <div style={{ padding:24, textAlign:"center", background:SURFACE.card, borderRadius:14, border:`1px solid ${SURFACE.border}` }}>
                <p style={{ fontSize:14, fontWeight:600, color:SURFACE.text, margin:0 }}>Todavía no reclamaste ningún beneficio</p>
                <p style={{ fontSize:12, color:SURFACE.textFaint, margin:"6px 0 0" }}>Ve a la pestaña Disponibles y reclama los que quieras.</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {couponClaims.map((c) => {
                  const coupon = c.coupon;
                  const cat = coupon ? (COUPON_CATEGORIES[coupon.category] || COUPON_CATEGORIES.OTHER) : COUPON_CATEGORIES.OTHER;
                  const statusMeta = COUPON_STATUS_META[c.status];
                  return (
                    <article key={c.id} style={{ background:SURFACE.card, borderRadius:14, overflow:"hidden", border:`1px solid ${SURFACE.border}`, borderLeft:`5px solid ${cat.color}` }}>
                      <button type="button" onClick={() => c.status === "CLAIMED" && setActiveClaim(c)}
                        style={{ width:"100%", textAlign:"left", padding:"12px 14px", background:"none", border:"none", cursor: c.status === "CLAIMED" ? "pointer" : "default" }}>
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:99, fontWeight:700, background: statusMeta.bg, color: statusMeta.color }}>
                                {statusMeta.label}
                              </span>
                              {coupon?.partnerName && (
                                <span style={{ fontSize:11, color:SURFACE.textMuted }}>{coupon.partnerName}</span>
                              )}
                            </div>
                            <p style={{ fontSize:13.5, fontWeight:700, color:SURFACE.text, margin:0, lineHeight:1.25 }}>{coupon?.title || "Beneficio"}</p>
                            <p style={{ fontSize:11, fontFamily:"ui-monospace, SFMono-Regular, monospace", color:SURFACE.textMuted, margin:"4px 0 0", letterSpacing:"0.04em" }}>
                              {c.uniqueCode}
                            </p>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <p style={{ fontSize:18, fontWeight:800, color:cat.color, margin:0 }}>
                              {coupon ? couponDiscountDisplay(coupon) : "—"}
                            </p>
                            {c.status === "CLAIMED" && (
                              <p style={{ fontSize:10.5, fontWeight:600, color:STATE.warningText, margin:"2px 0 0" }}>
                                Expira en {couponTimeLeft(c.expiresAt)}
                              </p>
                            )}
                            {c.status === "REDEEMED" && c.redeemedAt && (
                              <p style={{ fontSize:10.5, color:SURFACE.textMuted, margin:"2px 0 0" }}>
                                Canjeado {fmtCouponDate(c.redeemedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                        {c.status === "CLAIMED" && (
                          <p style={{ fontSize:11, fontWeight:600, color:STATE.infoText, margin:"8px 0 0" }}>Toca para mostrar el QR</p>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Documentos tab ─── */}
        {activeTab === "documentos" && (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <EventDocumentsSection audience="PARTICIPANTE" eventId={athlete.eventId} />
          </div>
        )}

        {/* ─── Cuenta tab ─── */}
        {activeTab === "cuenta" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {/* Foto. Va primero y dice para qué sirve: es la que sale en la
                credencial, y esa es la razón por la que alguien la cambia. */}
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14 }}>
              {fotoActual ? (
                <img src={fotoActual} alt={athlete.fullName} style={{ width:58,height:58,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`2px solid ${BRAND.teal}`,opacity:subiendoFoto?0.6:1,transition:"opacity .15s" }} />
              ) : (
                <div style={{ width:58,height:58,borderRadius:"50%",flexShrink:0,background:"rgba(33,208,179,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:BRAND.tealInk }}>
                  {initials}
                </div>
              )}
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13.5,fontWeight:700,color:SURFACE.text,margin:0 }}>{t("Tu foto")}</p>
                <p style={{ fontSize:11.5,color:SURFACE.textMuted,margin:"2px 0 0",lineHeight:1.35 }}>
                  {fotoActual
                    ? t("Es la que aparece en tu credencial.")
                    : t("Sin foto, tu credencial sale con tus iniciales.")}
                </p>
              </div>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                onChange={alElegirFoto}
                style={{ display:"none" }}
              />
              <button
                type="button"
                onClick={() => inputFotoRef.current?.click()}
                disabled={subiendoFoto}
                style={{ flexShrink:0,display:"inline-flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:11,border:`1px solid ${BRAND.teal}`,background:"rgba(33,208,179,0.10)",color:BRAND.tealInk,fontSize:12,fontWeight:700,cursor:subiendoFoto?"default":"pointer",opacity:subiendoFoto?0.6:1 }}
              >
                <CameraIcon size={14} strokeWidth={2.2} />
                {subiendoFoto ? t("Subiendo…") : fotoActual ? t("Cambiar") : t("Subir")}
              </button>
            </div>

            {/* Info rows */}
            <div style={{ background:SURFACE.card,borderRadius:14,border:`1px solid ${SURFACE.border}`,overflow:"hidden" }}>
              {([
                { icon:<UserIcon size={14} color={BRAND.teal} strokeWidth={2} />, label:"Nombre", value:athlete.fullName },
                { icon:<MailIcon size={14} color={BRAND.teal} strokeWidth={2} />, label:"Correo", value:athlete.email || "—" },
                { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.67.29 1.33.49 1.97"/></svg>, label:"Teléfono", value:athlete.phone || "—" },
                { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>, label:"Evento", value:event?.name || "—" },
                { icon:<GlobeIcon size={14} color={BRAND.teal} strokeWidth={2} />, label:"Delegación", value:delegation ? (countryLabels[delegation.countryCode]||delegation.countryCode) : "—" },
                { icon:<ShieldIcon size={14} color={BRAND.teal} strokeWidth={2} />, label:"Tipo", value:athlete.userType || "—" },
                { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>, label:"Disciplina", value: (() => { if (!athlete.disciplineId) return "—"; const disc = ([...disciplineParents, ...calendarEvents] as any[]).find((d: any) => d.id === athlete.disciplineId); if (!disc) return "—"; const parent = disc.parentId ? disciplineParents.find(p => p.id === disc.parentId) : null; return parent ? `${parent.name} — ${disc.name}` : (disc.name || "—"); })() },
                { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isChief ? STATE.warning : BRAND.teal} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, label:"Rol", value:isChief ? "Jefe de Misión" : "Participante" },
                { icon:<LockIcon size={14} color={BRAND.teal} strokeWidth={2} />, label:"ID", value:athlete.id.slice(-6).toUpperCase() },
              ]).map((r,i) => (
                <div key={r.label} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:i>0?`1px solid ${SURFACE.borderMuted}`:"none" }}>
                  <span style={{ flexShrink:0 }}>{r.icon}</span>
                  <div style={{ flex:1,minWidth:0,display:"flex",alignItems:"baseline",gap:6 }}>
                    <span style={{ fontSize:10,fontWeight:700,color:SURFACE.textFaint,textTransform:"uppercase",flexShrink:0 }}>{r.label}</span>
                    <span style={{ fontSize:13,fontWeight:600,color:SURFACE.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.value}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Credencial digital con QR a la vista */}
            <CredentialQrCard
              qrData={`Participante: ${athlete.fullName}\nID: ${athlete.id.slice(-6)}\nDelegación: ${delegation?.countryCode || "—"}`}
              name={athlete.fullName || athlete.id}
              roleLabel={isChief ? "Jefe de Misión" : athlete.userType || "Participante"}
              code={athlete.credentialCode || athlete.id.slice(-6)}
              countryTag={athlete.countryCode || delegation?.countryCode || null}
              eventName={event?.name || null}
              onOpenFull={async () => {
                try {
                  const evName = event?.name || "Seven Arena";
                  const qrData = `Participante: ${athlete.fullName}\nID: ${athlete.id.slice(-6)}\nDelegación: ${delegation?.countryCode || "—"}`;
                  const qrDataUrl = await QRCode.toDataURL(qrData, { width:200, margin:1 });
                  // Los accesos (y el código/estado vigentes) viven en la
                  // acreditación, no en el atleta: se consultan al abrir la
                  // credencial para reflejar cambios hechos por operaciones.
                  type AccSummary = { eventId?: string | null; status?: string | null; credentialCode?: string | null; accessTypes?: string[] | null };
                  let acc: AccSummary | null = null;
                  try {
                    const accs = await apiFetch<AccSummary[]>(`/accreditations?athleteId=${athlete.id}&subjectType=PARTICIPANT`);
                    acc = (accs || []).find((a) => !athlete.eventId || a.eventId === athlete.eventId) ?? (accs || [])[0] ?? null;
                  } catch { /* sin acreditación consultable: credencial sin accesos */ }
                  const meta = (athlete.metadata || {}) as Record<string, unknown>;
                  const photoKeys = ["photoUrl","photo_url","avatar","avatarUrl","imageUrl","image_url"];
                  let photoUrl: string | null = null;
                  for (const k of photoKeys) {
                    const v = meta[k];
                    if (typeof v === "string" && v.trim()) { photoUrl = v.trim(); break; }
                  }
                  const accessTypes = Array.isArray(acc?.accessTypes) ? acc.accessTypes : [];
                  const html = buildCredentialHtml({
                    eventName: evName,
                    fullName: athlete.fullName,
                    roleLabel: isChief ? "JEFE DE MISIÓN" : "PARTICIPANTE",
                    credentialCode: acc?.credentialCode || athlete.credentialCode || athlete.id.slice(-6).toUpperCase(),
                    statusLabel: acc?.status || athlete.accreditationStatus || "PENDING",
                    issuedAtLabel: new Date().toLocaleDateString("es-CL"),
                    issuerLabel: "Seven Arena",
                    subjectId: athlete.id,
                    countryTag: athlete.countryCode || delegation?.countryCode || "",
                    accessTypes,
                    photoUrl,
                    qrDataUrl,
                  });
                  setCredentialPdf({
                    eventName: evName,
                    fullName: athlete.fullName,
                    roleLabel: isChief ? "JEFE DE MISIÓN" : "PARTICIPANTE",
                    code: acc?.credentialCode || athlete.credentialCode || athlete.id.slice(-6),
                    countryTag: athlete.countryCode || delegation?.countryCode || undefined,
                    qrDataUrl,
                    qrContent: qrData,
                    organization: "Seven Arena",
                    issuedAtLabel: new Date().toLocaleDateString("es-CL"),
                    accessTypes,
                    photoUrl,
                  });
                  setCredentialHtml(html);
                } catch { notify.push("No se pudo generar la credencial","error"); }
              }}
            />
            {/* Health form link */}
            <a href={`/portal/athlete/salud?id=${athlete.id}`}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:14,borderRadius:12,background:SURFACE.card,border:`1px solid ${SURFACE.border}`,color:SURFACE.text,fontSize:13,fontWeight:700,textDecoration:"none" }}>
              <ActivityIcon size={16} color={BRAND.teal} strokeWidth={2} />
              Ficha de salud
              {healthRecord ? <span style={{ fontSize:10,padding:"2px 8px",borderRadius:6,background:"rgba(33,208,179,0.1)",color:BRAND.tealInk }}>Completada</span> : <span style={{ fontSize:10,padding:"2px 8px",borderRadius:6,background:STATE.warningSoft,color:STATE.warningText }}>Pendiente</span>}
            </a>
            {/* Números de emergencia */}
            <EmergencyNumbersSection />
            {/* Device permissions (only visible inside the mobile app) */}
            <DevicePermissionsSection />
            {/* Logout */}
            <button type="button" onClick={() => { if (athlete) clearPortalSession("athlete", athlete.id); setAthlete(null); setAthleteId(""); try { sessionStorage.removeItem("portal_user_id"); } catch {} clearPersistedTabs(); setActiveTab("itinerario"); }}
              style={{ width:"100%",padding:12,borderRadius:12,border:`1px solid ${SURFACE.border}`,background:SURFACE.card,color:STATE.danger,fontSize:13,fontWeight:600,cursor:"pointer" }}>
              Cerrar sesión
            </button>
            {/* Eliminar cuenta */}
            <DeleteAccountSection
              onDelete={() => deletePortalAccount("athlete", athlete.id)}
              onDeleted={async () => {
                try { sessionStorage.removeItem("portal_user_id"); } catch {}
                clearPersistedTabs();
                await releasePortalSession("athlete", athlete.id);
                mobileAwareLogout();
              }}
            />
          </div>
        )}

        </div>{/* end tab content */}

        {/* ── Bottom tab bar ── */}
        <div style={{ position:"fixed",bottom:0,left:0,right:0,display:"flex",background:SURFACE.card,borderTop:`1px solid ${SURFACE.border}`,zIndex:100,paddingTop:6,paddingBottom:6,boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
          {primaryTabs.map(tab => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              style={{ flex:1,padding:"4px 0 2px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
                color:activeTab===tab.key?BRAND.teal:SURFACE.textFaint }}>
              <span style={{ display:"flex" }}>{tab.icon}</span>
              <span style={{ fontSize:9.5,fontWeight:activeTab===tab.key?700:500,letterSpacing:"-0.005em" }}>{tab.label}</span>
            </button>
          ))}
          {overflowTabs.length > 0 && (() => {
            const activeOverflow = overflowTabs.find(tp => tp.key === activeTab);
            const on = !!activeOverflow || moreOpen;
            return (
              <button type="button" onClick={() => setMoreOpen(true)}
                style={{ flex:1,padding:"4px 0 2px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
                  color: on ? BRAND.teal : SURFACE.textFaint }}>
                <span style={{ display:"flex" }}>
                  {activeOverflow ? activeOverflow.icon : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                  )}
                </span>
                <span style={{ fontSize:9.5,fontWeight: on ? 700 : 500,letterSpacing:"-0.005em" }}>{activeOverflow ? activeOverflow.label : "Más"}</span>
              </button>
            );
          })()}
        </div>

        {/* ── Hoja "Más" (secciones agrupadas) ── */}
        {moreOpen && (
          <div onClick={() => setMoreOpen(false)}
            style={{ position:"fixed",inset:0,zIndex:120,display:"flex",alignItems:"flex-end",background:"rgba(2,12,24,0.5)",backdropFilter:"blur(4px)" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width:"100%",background:SURFACE.card,borderRadius:"22px 22px 0 0",padding:"10px 16px calc(20px + env(safe-area-inset-bottom,0px))",boxShadow:"0 -10px 40px rgba(0,0,0,0.25)",animation:"pu-sheet .25s cubic-bezier(0.16,1,0.3,1) both" }}>
              <div style={{ width:40,height:4,borderRadius:99,background:SURFACE.border,margin:"0 auto 12px" }} />
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:SURFACE.textFaint,margin:"0 0 12px" }}>Más secciones</p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                {overflowTabs.map(tab => {
                  const on = activeTab === tab.key;
                  return (
                    <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                      style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 8px",borderRadius:16,cursor:"pointer",
                        background: on ? "rgba(33,208,179,0.1)" : SURFACE.bg,
                        border:`1px solid ${on ? "rgba(33,208,179,0.4)" : "#eef2f7"}` }}>
                      <span style={{ width:44,height:44,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",
                        background: on ? `linear-gradient(135deg,${BRAND.tealLight},${BRAND.teal})` : SURFACE.card,
                        color: on ? SURFACE.card : SURFACE.textMuted,
                        border:`1px solid ${on ? "transparent" : "#e2e8f0"}` }}>{tab.icon}</span>
                      <span style={{ fontSize:12,fontWeight: on ? 700 : 600,color: on ? BRAND.tealInk : SURFACE.textStrong }}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <style>{`@keyframes pu-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          </div>
        )}

        {/* KEEP EXISTING: old info cards grid removed, but keep modals/chat below */}
        <div style={{ display:"none" }}>
        <div className="db-cards-grid">

          {/* Vuelo */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.09) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(33,208,179,0.18),rgba(33,208,179,0.06))",border:"1px solid rgba(33,208,179,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:BRAND.teal,flexShrink:0,boxShadow:"0 2px 8px rgba(33,208,179,0.15)" }}>
                <IcoPlane />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.teal }}>{t("Vuelo")}</span>
            </div>
            {flightLabel ? (
              <>
                <p className="db-card-title" style={{ fontSize:"17px",fontWeight:800,color:SURFACE.text,margin:"0 0 8px",letterSpacing:"-0.01em" }}>{flightLabel}</p>
                {(athlete.arrivalTime || flight?.arrivalTime) && (
                  <p className="db-card-subtitle" style={{ fontSize:"12px",color:SURFACE.textMuted,margin:"0 0 4px",display:"flex",alignItems:"center",gap:"5px" }}>
                    <span style={{ color:BRAND.teal,fontWeight:600 }}>Arribo</span> · {fmt(athlete.arrivalTime || flight?.arrivalTime)}
                  </p>
                )}
                {athlete.origin && <p className="db-card-subtitle" style={{ fontSize:"12px",color:SURFACE.textMuted,margin:0 }}><span style={{ color:BRAND.teal,fontWeight:600 }}>Origen</span> · {athlete.origin}</p>}
              </>
            ) : (
              <p style={{ fontSize:"13px",color:SURFACE.textFaint,margin:0,fontStyle:"italic" }}>Sin vuelo asignado</p>
            )}
          </div>

          {/* Hotel */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(52,243,198,0.08) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(52,243,198,0.18),rgba(52,243,198,0.06))",border:"1px solid rgba(52,243,198,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:BRAND.tealDark,flexShrink:0,boxShadow:"0 2px 8px rgba(52,243,198,0.15)" }}>
                <IcoHotel />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.tealDark }}>{t("Hotel")}</span>
            </div>
            {hotel?.name ? (
              <>
                <p className="db-card-title" style={{ fontSize:"17px",fontWeight:800,color:SURFACE.text,margin:"0 0 8px",letterSpacing:"-0.01em" }}>{hotel.name}</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"4px" }}>
                  {hotelRoom_ && <span style={{ fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:"#f0fdf8",color:BRAND.tealInk,border:"1px solid rgba(33,208,179,0.2)",fontWeight:600 }}>Hab. {hotelRoom_}</span>}
                  {hotelBed_ && <span style={{ fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:SURFACE.borderMuted,color:SURFACE.textSecondary,border:`1px solid ${SURFACE.border}`,fontWeight:500 }}>Cama {hotelBed_}</span>}
                  {luggage_ && <span style={{ display:"inline-flex",alignItems:"center",gap:"3px",fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:SURFACE.borderMuted,color:SURFACE.textSecondary,border:`1px solid ${SURFACE.border}`,fontWeight:500 }}><IcoBag />{luggage_}</span>}
                </div>
              </>
            ) : (
              <p style={{ fontSize:"13px",color:SURFACE.textFaint,margin:0,fontStyle:"italic" }}>Sin hotel asignado</p>
            )}
          </div>

          {/* Transporte */}
          <div className="db-card" onClick={async () => {
            if (!trip) return;
            // Refresh trip before opening modal to always show current status
            try {
              const fresh = await apiFetch<Trip>(`/trips/${trip.id}`);
              setTrip(fresh);
            } catch { /* keep stale if fetch fails */ }
            setShowTripModal(true);
          }} style={{ cursor: trip ? "pointer" : undefined }}>
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.07) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(31,205,255,0.15),rgba(31,205,255,0.05))",border:"1px solid rgba(31,205,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0ea5c8",flexShrink:0,boxShadow:"0 2px 8px rgba(31,205,255,0.12)" }}>
                <IcoCar />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#0ea5c8" }}>{t("Viajes")}</span>
            </div>
            {trip ? (() => {
              const tripStatusColors: Record<string, { bg: string; color: string; label: string }> = {
                REQUESTED:  { bg:"rgba(251,191,36,0.12)",  color:STATE.warningText, label:"Solicitado" },
                SCHEDULED:  { bg:"rgba(33,208,179,0.12)",  color:BRAND.tealDark, label:"Programado" },
                EN_ROUTE:   { bg:"rgba(59,130,246,0.12)",  color:STATE.infoText, label:"En ruta" },
                PICKED_UP:  { bg:"rgba(139,92,246,0.12)",  color:ACCENT.violet, label:"En curso" },
                DROPPED_OFF:{ bg:"rgba(33,208,179,0.12)",  color:BRAND.tealDark, label:"Llegado al destino" },
                COMPLETED:  { bg:"rgba(100,116,139,0.1)",  color:SURFACE.textSecondary, label:"Completado" },
              };
              const statusInfo = trip.status ? (tripStatusColors[trip.status] ?? { bg:"rgba(100,116,139,0.1)", color:SURFACE.textMuted, label: trip.status }) : null;
              const scheduledFmt = trip.scheduledAt ? fmt(trip.scheduledAt) : null;
              return (
                <>
                  {statusInfo && (
                    <span style={{ display:"inline-block",padding:"3px 10px",borderRadius:"20px",background:statusInfo.bg,color:statusInfo.color,fontSize:"11px",fontWeight:700,letterSpacing:"0.06em",marginBottom:"12px" }}>
                      {statusInfo.label}
                    </span>
                  )}
                  {(trip.origin || trip.destination) && (
                    <p style={{ fontSize:"13px",fontWeight:700,color:SURFACE.text,margin:"0 0 10px",lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical" as any }}>
                      {trip.origin || "–"} <span style={{ color:"#0ea5c8",display:"inline-flex",verticalAlign:"middle" }}><ArrowRightIcon size={12} /></span> {trip.destination || "–"}
                    </p>
                  )}
                  {scheduledFmt && (
                    <p style={{ fontSize:"12px",color:SURFACE.textMuted,margin:"0 0 10px",display:"flex",alignItems:"center",gap:"5px" }}>
                      <ClockIcon size={12} strokeWidth={2} />
                      {scheduledFmt}
                    </p>
                  )}
                  <div style={{ borderTop:`1px solid ${SURFACE.borderMuted}`,paddingTop:"10px",display:"flex",flexDirection:"column",gap:"5px" }}>
                    {driver?.fullName && (
                      <p style={{ fontSize:"13px",color:SURFACE.textStrong,margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <UserIcon size={13} color="#0ea5c8" strokeWidth={2} />
                        <span style={{ fontWeight:600 }}>{driver.fullName}</span>
                      </p>
                    )}
                    {vehicleLabel && (
                      <p style={{ fontSize:"12px",color:SURFACE.textMuted,margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <CarIcon size={12} color={SURFACE.textFaint} strokeWidth={2} />
                        {vehicleLabel.toUpperCase()}
                      </p>
                    )}
                    {driverEta && trip.status === "EN_ROUTE" && (
                      <p style={{ fontSize:"12px",fontWeight:700,color:"#0ea5c8",margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <ClockIcon size={12} strokeWidth={2} />
                        ~{driverEta.duration} · {driverEta.distance}
                      </p>
                    )}
                  </div>
                </>
              );
            })() : (
              <p style={{ fontSize:"14px",color:SURFACE.textFaint,margin:0,fontStyle:"italic" }}>{t("Sin viaje asignado")}</p>
            )}
          </div>

          {/* Check-ins */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:`linear-gradient(135deg,${SURFACE.bg},${SURFACE.borderMuted})`,border:`1px solid ${SURFACE.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:SURFACE.textMuted,flexShrink:0 }}>
                  <IcoCheck />
                </div>
                <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:SURFACE.textSecondary }}>{t("Check-ins")}</span>
              </div>
              <span style={{ fontSize:"12px",fontWeight:700,color:checkinsDone===checkins.length?BRAND.teal:SURFACE.textFaint }}>{checkinsDone}/{checkins.length}</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
              {checkins.map(({ label, ts }) => {
                const done = !!fmt(ts);
                return (
                  <div key={label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"8px 10px",borderRadius:"10px",background:done?"linear-gradient(135deg,rgba(33,208,179,0.06),rgba(33,208,179,0.02))":SURFACE.bg,border:`1px solid ${done?"rgba(33,208,179,0.2)":"#f1f5f9"}`,transition:"all .3s" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,background:done?BRAND.teal:SURFACE.borderStrong,boxShadow:done?"0 0 6px rgba(33,208,179,0.7)":"none",transition:"all .3s" }} />
                      <span style={{ fontSize:"12px",color:done?SURFACE.text:SURFACE.textFaint,fontWeight:done?600:400 }}>{label}</span>
                    </div>
                    {done
                      ? <CheckIcon size={14} color={BRAND.teal} strokeWidth={2.5} />
                      : <span style={{ fontSize:"9px",color:SURFACE.borderStrong,fontWeight:500 }}>Pendiente</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="db-actions-card">
          {/* Subtle glow in corner */}
          <div style={{ position:"absolute",bottom:0,right:0,width:"220px",height:"220px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.06) 0%,transparent 65%)",transform:"translate(60px,60px)",pointerEvents:"none" }} />
          <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:SURFACE.textFaint,margin:"0 0 16px" }}>Acciones</p>
          <div className="db-actions-grid">
            {[
              {
                field:"airportCheckinAt" as const,
                label: t("Marcar embarque / llegada"),
                doneLabel: t("Embarque confirmado"),
                icon: <IcoPlane />,
                done: !!athlete.airportCheckinAt,
                gradient: `linear-gradient(135deg,${BRAND.teal} 0%,#17a68e 100%)`,
                glow: "0 6px 24px rgba(33,208,179,0.4)",
                doneGlow: "0 4px 16px rgba(33,208,179,0.2)",
              },
              {
                field:"hotelCheckinAt" as const,
                label: t("Marcar check-in hotel"),
                doneLabel: t("Check-in confirmado"),
                icon: <IcoHotel />,
                done: !!athlete.hotelCheckinAt,
                gradient: `linear-gradient(135deg,${BRAND.tealLight} 0%,${BRAND.teal} 100%)`,
                glow: "0 6px 24px rgba(52,243,198,0.4)",
                doneGlow: "0 4px 16px rgba(52,243,198,0.2)",
              },
              {
                field:"hotelCheckoutAt" as const,
                label: t("Marcar check-out hotel"),
                doneLabel: t("Check-out confirmado"),
                icon: <IcoCheck />,
                done: !!athlete.hotelCheckoutAt,
                gradient: null,
                glow: null,
                doneGlow: null,
              },
            ].map(({ field, label, doneLabel, icon, done, gradient, glow, doneGlow }) => {
              const busy = markLoading === field;
              return (
                <button key={field} className="db-action-btn" type="button" onClick={() => mark(field)}
                  disabled={!!markLoading || done}
                  style={{
                    padding:"16px 20px",
                    borderRadius:"16px",
                    fontSize:"14px",
                    fontWeight:700,
                    cursor:(!!markLoading||done)?"not-allowed":"pointer",
                    border: done
                      ? "1px solid rgba(33,208,179,0.25)"
                      : gradient
                        ? "none"
                        : "1.5px solid #dde3ed",
                    background: done
                      ? "linear-gradient(135deg,rgba(33,208,179,0.08),rgba(33,208,179,0.03))"
                      : gradient ?? SURFACE.bg,
                    color: done ? BRAND.tealInk : gradient ? "#062B22" : SURFACE.textSecondary,
                    opacity: busy ? 0.7 : 1,
                    boxShadow: done ? doneGlow ?? "none" : glow ?? "0 2px 8px rgba(0,0,0,0.06)",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:"10px",
                    letterSpacing:"0.01em",
                  }}>
                  <span style={{ opacity: done ? 0.8 : 1, display:"flex", alignItems:"center" }}>
                    {done
                      ? <CheckIcon size={16} strokeWidth={2.5} />
                      : icon
                    }
                  </span>
                  {busy ? "..." : done ? doneLabel : label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ color:STATE.dangerText,fontSize:"13px",textAlign:"center",background:STATE.dangerSoft,border:`1px solid ${STATE.dangerBorder}`,borderRadius:"14px",padding:"12px 20px",marginBottom:"16px" }}>{error}</div>
        )}

        {/* ── Sports Calendar ── */}
        <div className="db-card" style={{ marginBottom:16 }}>
          <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.09) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,rgba(33,208,179,0.18),rgba(33,208,179,0.06))",border:"1px solid rgba(33,208,179,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:BRAND.teal,flexShrink:0 }}>
              <CalendarIcon size={20} strokeWidth={1.8} />
            </div>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.teal }}>Calendario deportivo</span>
          </div>
          {calendarEvents.length === 0 ? (
            <p style={{ fontSize:12.5,color:SURFACE.textFaint,margin:0,textAlign:"center",padding:"8px 0" }}>Sin actividades programadas</p>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {calendarEvents.map((ce) => {
                const parentName = ce.parentId ? (discLabelMap.get(ce.parentId) || "") : "";
                const isPast = new Date(ce.scheduledAt!) < new Date();
                return (
                  <div key={ce.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:SURFACE.bg,border:`1px solid ${SURFACE.borderMuted}`,opacity:isPast ? 0.5 : 1 }}>
                    <span style={{ width:8,height:8,borderRadius:"50%",background:isPast ? SURFACE.textFaint : BRAND.teal,flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:12.5,fontWeight:600,color:SURFACE.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {ce.name}{parentName ? ` · ${parentName}` : ""}
                      </p>
                      <p style={{ fontSize:10.5,color:SURFACE.textMuted,margin:"1px 0 0" }}>
                        {diaLargoEvento(ce.scheduledAt)} · {horaEvento(ce.scheduledAt)}
                        {ce.venueName ? ` · ${ce.venueName}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Health Form ── */}
        <div className="db-card" style={{ marginBottom:16 }}>
          <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.09) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,rgba(33,208,179,0.18),rgba(33,208,179,0.06))",border:"1px solid rgba(33,208,179,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:BRAND.teal,flexShrink:0 }}>
              <ActivityIcon size={20} strokeWidth={1.8} />
            </div>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:BRAND.teal }}>Ficha de Salud</span>
          </div>
          {healthRecord?.participantSignature ? (
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                <span style={{ width:8,height:8,borderRadius:"50%",background:STATE.success }} />
                <p style={{ fontSize:13,color:SURFACE.text,margin:0,fontWeight:600 }}>Ficha completada y firmada</p>
              </div>
              <a href={`/portal/athlete/salud?id=${athlete.id}`}
                style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:BRAND.teal,textDecoration:"none" }}>
                Ver o editar ficha →
              </a>
            </div>
          ) : (
            <>
              <p style={{ fontSize:12.5,color:SURFACE.textMuted,margin:"0 0 12px",lineHeight:1.5 }}>
                Completa tu ficha de salud con datos médicos, alergias, contacto de emergencia y firma digital.
              </p>
              <a href={`/portal/athlete/salud?id=${athlete.id}`}
                style={{ display:"block",width:"100%",padding:12,borderRadius:12,border:"none",background:`linear-gradient(135deg,${BRAND.teal},#14AE98)`,color:SURFACE.card,fontSize:13,fontWeight:700,textAlign:"center",textDecoration:"none",boxShadow:"0 2px 10px rgba(33,208,179,0.3)",boxSizing:"border-box" }}>
                Completar ficha de salud
              </a>
            </>
          )}
        </div>

        </div>{/* end hidden old content */}

        {/* ── Trip detail modal ── */}
        {showTripModal && trip && (
          <div
            onClick={() => setShowTripModal(false)}
            style={{ position:"fixed",inset:0,background:"rgba(2,12,24,0.65)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(4px)" }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:SURFACE.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:"680px",maxHeight:"90vh",overflowY:"auto",padding:"0 0 32px" }}>
              {/* Handle */}
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}>
                <div style={{ width:40,height:4,borderRadius:4,background:SURFACE.border }} />
              </div>
              {/* Header */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px 16px" }}>
                <div>
                  <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#0ea5c8",margin:"0 0 4px" }}>Detalle del viaje</p>
                  {(trip.origin || trip.destination) && (
                    <h2 style={{ fontSize:"20px",fontWeight:800,color:SURFACE.text,margin:0,letterSpacing:"-0.02em" }}>
                      {trip.origin || "–"} <span style={{ color:"#0ea5c8",display:"inline-flex",verticalAlign:"middle" }}><ArrowRightIcon size={12} /></span> {trip.destination || "–"}
                    </h2>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${SURFACE.border}`,background:SURFACE.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
                  <XIcon size={16} color={SURFACE.textMuted} strokeWidth={2} />
                </button>
              </div>
              {/* Map */}
              <div style={{ margin:"0 0 20px" }}>
                <TripMap origin={trip.origin} destination={trip.destination} driverPosition={driverPos} userPosition={userPos} phase={trip.status} height={260} />
                {rastreoCaido && !driverPos && (
                  <p style={{ margin:"8px 24px 0",fontSize:12,color:"#92400E",background:"#FEF3C7",border:"1px solid #fcd34d",borderRadius:8,padding:"7px 10px" }}>
                    {t("No estamos recibiendo la ubicación del conductor. El viaje sigue en curso.")}
                  </p>
                )}
              </div>
              {/* Details */}
              <div style={{ padding:"0 24px",display:"flex",flexDirection:"column",gap:"12px" }}>
                {/* Status */}
                {(() => {
                  const tripStatusColors: Record<string, { bg: string; color: string; label: string }> = {
                    REQUESTED:  { bg:"rgba(251,191,36,0.12)",  color:STATE.warningText, label:"Solicitado" },
                    SCHEDULED:  { bg:"rgba(33,208,179,0.12)",  color:BRAND.tealDark, label:"Programado" },
                    EN_ROUTE:   { bg:"rgba(59,130,246,0.12)",  color:STATE.infoText, label:"En ruta" },
                    PICKED_UP:  { bg:"rgba(139,92,246,0.12)",  color:ACCENT.violet, label:"En curso" },
                    DROPPED_OFF:{ bg:"rgba(33,208,179,0.12)",  color:BRAND.tealDark, label:"Llegado al destino" },
                    COMPLETED:  { bg:"rgba(100,116,139,0.1)",  color:SURFACE.textSecondary, label:"Completado" },
                  };
                  const s = trip.status ? (tripStatusColors[trip.status] ?? { bg:"rgba(100,116,139,0.1)", color:SURFACE.textMuted, label: trip.status }) : null;
                  return s ? (
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <span style={{ padding:"4px 14px",borderRadius:"20px",background:s.bg,color:s.color,fontSize:"12px",fontWeight:700,letterSpacing:"0.06em" }}>{s.label}</span>
                    </div>
                  ) : null;
                })()}
                {/* Scheduled */}
                {trip.scheduledAt && fmt(trip.scheduledAt) && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:SURFACE.textSecondary }}>
                    <ClockIcon size={14} color="#0ea5c8" strokeWidth={2} />
                    <span><strong style={{ color:SURFACE.text }}>Hora programada:</strong> {fmt(trip.scheduledAt)}</span>
                  </div>
                )}
                {/* ETA */}
                {driverEta && trip.status === "EN_ROUTE" && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 16px",borderRadius:"12px",background:"rgba(14,165,200,0.08)",border:"1px solid rgba(14,165,200,0.2)" }}>
                    <ClockIcon size={16} color="#0ea5c8" strokeWidth={2} />
                    <span style={{ fontSize:"14px",fontWeight:700,color:"#0ea5c8" }}>~{driverEta.duration}</span>
                    <span style={{ fontSize:"13px",color:SURFACE.textSecondary }}>· {driverEta.distance}</span>
                  </div>
                )}
                {/* Driver */}
                {driver?.fullName && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:SURFACE.textSecondary }}>
                    <UserIcon size={14} color="#0ea5c8" strokeWidth={2} />
                    <span><strong style={{ color:SURFACE.text }}>Conductor:</strong> {driver.fullName}</span>
                  </div>
                )}
                {/* Vehicle */}
                {vehicleLabel && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:SURFACE.textSecondary }}>
                    <CarIcon size={14} color={SURFACE.textFaint} strokeWidth={2} />
                    <span><strong style={{ color:SURFACE.text }}>Vehículo:</strong> {vehicleLabel.toUpperCase()}</span>
                  </div>
                )}
                {/* Notes */}
                {trip.notes && (
                  <div style={{ padding:"12px 16px",borderRadius:"12px",background:SURFACE.bg,border:`1px solid ${SURFACE.border}`,fontSize:"13px",color:SURFACE.textSecondary }}>
                    <strong style={{ color:SURFACE.text }}>Notas:</strong> {trip.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Rating popup ── */}
        {showRating && trip && (
          <div
            onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
            style={{ position:"fixed",inset:0,background:"rgba(2,12,24,0.7)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",padding:16 }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:SURFACE.card,borderRadius:24,width:"100%",maxWidth:380,padding:"32px 24px",textAlign:"center",animation:"db-in .4s cubic-bezier(0.16,1,0.3,1) both",position:"relative" }}>
              {/* Close button */}
              <button type="button" onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
                style={{ position:"absolute",top:12,right:12,width:36,height:36,borderRadius:"50%",border:"none",background:SURFACE.borderMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <XIcon size={16} color={SURFACE.textMuted} strokeWidth={2} />
              </button>
              {/* Emoji */}
              <div style={{ marginBottom:12,display:"flex",justifyContent:"center" }}>
                <StarIcon size={48} color={ratingStars === 0 ? SURFACE.borderStrong : STATE.warning} />
              </div>
              <h3 style={{ fontSize:20,fontWeight:800,color:SURFACE.text,margin:"0 0 4px" }}>¿Cómo fue tu viaje?</h3>
              <p style={{ fontSize:13,color:SURFACE.textMuted,margin:"0 0 20px" }}>Evalúa a tu conductor</p>
              {/* Stars */}
              <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:20 }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  // Las estrellas elegidas se rellenan. Antes todas se
                  // dibujaban iguales y sin color: el único indicio de la
                  // selección era un escalado de 1.15 que no se percibe, así
                  // que parecía que tocarlas no hacía nada.
                  const elegida = ratingStars >= star;
                  return (
                    <button key={star} type="button" onClick={() => setRatingStars(star)}
                      aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
                      style={{ background:"none",border:"none",cursor:"pointer",padding:4,transition:"transform .15s",transform: elegida ? "scale(1.15)" : "scale(1)" }}>
                      <StarIcon
                        size={40}
                        color={elegida ? STATE.warning : SURFACE.borderStrong}
                        fill={elegida ? STATE.warning : "none"}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Comment */}
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Comentario opcional..."
                rows={2}
                style={{ width:"100%",padding:12,borderRadius:12,border:`1px solid ${SURFACE.border}`,fontSize:14,resize:"none",outline:"none",boxSizing:"border-box",marginBottom:16,fontFamily:"inherit" }}
              />
              {/* Submit */}
              <button type="button" onClick={submitRating} disabled={ratingStars === 0 || ratingLoading}
                style={{ width:"100%",padding:16,borderRadius:14,border:"none",background: ratingStars > 0 ? `linear-gradient(135deg,${BRAND.tealLight},${BRAND.teal})` : SURFACE.border,color: ratingStars > 0 ? SURFACE.text : SURFACE.textFaint,fontSize:16,fontWeight:700,cursor: ratingStars > 0 ? "pointer" : "not-allowed",opacity: ratingLoading ? 0.7 : 1 }}>
                {ratingLoading ? "Enviando..." : "Enviar evaluación"}
              </button>
              <button type="button" onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
                style={{ marginTop:8,background:"none",border:"none",color:SURFACE.textFaint,fontSize:13,cursor:"pointer",padding:8 }}>
                Omitir
              </button>
            </div>
          </div>
        )}

        {/* ── Coupon QR modal ── */}
        {activeClaim && (
          <div style={{ position:"fixed", inset:0, zIndex:150, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:0, background:"rgba(0,0,0,0.65)" }}
            onClick={() => setActiveClaim(null)}>
            <div style={{ background:SURFACE.card, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, maxHeight:"95vh", overflowY:"auto" }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
                <div style={{ width:40, height:4, borderRadius:4, background:SURFACE.border }} />
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"8px 20px 12px", borderBottom:`1px solid ${SURFACE.borderMuted}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", color:SURFACE.textMuted, margin:0 }}>Tu beneficio</p>
                  <h2 style={{ fontSize:18, fontWeight:800, color:SURFACE.text, margin:"2px 0 0", lineHeight:1.2 }}>{activeClaim.coupon?.title}</h2>
                  {activeClaim.coupon?.partnerName && (
                    <p style={{ fontSize:12, color:SURFACE.textMuted, margin:"3px 0 0" }}>{activeClaim.coupon.partnerName}</p>
                  )}
                </div>
                <button type="button" onClick={() => setActiveClaim(null)}
                  style={{ width:32, height:32, borderRadius:"50%", border:`1px solid ${SURFACE.border}`, background:SURFACE.bg, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, fontSize:18, lineHeight:1 }}>×</button>
              </div>
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"flex", justifyContent:"center" }}>
                  {couponQrDataUrl ? (
                    <div style={{ padding:16, background:SURFACE.card, borderRadius:16, boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
                      <img src={couponQrDataUrl} alt="QR del beneficio" style={{ width:240, height:240 }} />
                    </div>
                  ) : (
                    <div style={{ width:264, height:264, background:SURFACE.borderMuted, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:13, color:SURFACE.textFaint }}>Generando QR…</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:SURFACE.textMuted, margin:"0 0 4px" }}>Código de respaldo</p>
                  <p style={{ fontSize:22, fontFamily:"ui-monospace, SFMono-Regular, monospace", fontWeight:800, letterSpacing:"0.1em", color:STATE.infoText, margin:0 }}>{activeClaim.uniqueCode}</p>
                  <p style={{ fontSize:11, color:SURFACE.textFaint, margin:"4px 0 0" }}>Si el QR no escanea, dictá este código al comercio.</p>
                </div>
                <div style={{ padding:12, borderRadius:12, background:`linear-gradient(135deg,#fff8e1 0%,${STATE.warningSoft} 100%)` }}>
                  <p style={{ fontSize:12, fontWeight:700, color:STATE.warningText, margin:"0 0 4px" }}>Cómo canjearlo</p>
                  <ol style={{ fontSize:12, color:"#7a5800", margin:0, paddingLeft:18, lineHeight:1.5 }}>
                    <li>Ve al local del comercio.</li>
                    <li>Muestra esta pantalla con el QR.</li>
                    <li>El comercio lo escaneará y aplicará el descuento.</li>
                  </ol>
                </div>
                <div style={{ fontSize:12, color:SURFACE.textMuted, display:"flex", flexDirection:"column", gap:3 }}>
                  <p style={{ margin:0 }}><CalendarIcon size={11} className="inline mr-1" />Reclamado el {fmtCouponFull(activeClaim.claimedAt)}</p>
                  <p style={{ margin:0 }}><ClockIcon size={11} className="inline mr-1" />Expira el {fmtCouponFull(activeClaim.expiresAt)} <strong>({couponTimeLeft(activeClaim.expiresAt)} restantes)</strong></p>
                  {activeClaim.coupon?.partnerAddress && (
                    <p style={{ margin:0 }}><PinIcon size={11} className="inline mr-1" />{activeClaim.coupon.partnerAddress}</p>
                  )}
                </div>
                {activeClaim.coupon?.termsAndConditions && (
                  <details style={{ fontSize:12 }}>
                    <summary style={{ cursor:"pointer", fontWeight:600, color:SURFACE.textMuted }}>Términos y condiciones</summary>
                    <p style={{ marginTop:6, lineHeight:1.5, color:SURFACE.textMuted }}>{activeClaim.coupon.termsAndConditions}</p>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Credential modal (inline iframe) */}
        {credentialHtml && (
          <div onClick={() => setCredentialHtml(null)}
            style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(2,12,24,0.78)",backdropFilter:"blur(6px)" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background:SURFACE.card,borderRadius:20,width:"100%",maxWidth:480,maxHeight:"95vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${SURFACE.border}`,background:`linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`,color:SURFACE.card }}>
                <div>
                  <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:BRAND.teal,margin:0 }}>Credencial digital</p>
                  <p style={{ fontSize:14,fontWeight:700,margin:"2px 0 0" }}>{athlete?.fullName || "Participante"}</p>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <button type="button" onClick={() => {
                    if (!credentialPdf) return;
                    try {
                      // Dentro de la app se abre la credencial COMPLETA en un
                      // visor propio (con Volver y Guardar).
                      if (isNativeShell() && credentialHtml) setCredentialPdfView(credentialHtml);
                      else downloadCredentialPdf(credentialPdf);
                    } catch { notify.push("No se pudo generar el PDF", "error"); }
                  }}
                    title="Descargar PDF"
                    style={{ width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",color:BRAND.teal,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <DownloadIcon size={16} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => setCredentialHtml(null)}
                    style={{ height:34,padding:"0 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.08)",color:SURFACE.card,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:700,lineHeight:1 }}>
                    <XIcon size={15} /> Volver
                  </button>
                </div>
              </div>
              <iframe srcDoc={credentialHtml} title="Credencial"
                style={{ flex:1,width:"100%",minHeight:"60vh",border:"none",background:SURFACE.card }} />
            </div>
          </div>
        )}

        {/* Visor de la credencial completa (app nativa) con Volver y Guardar */}
        {credentialPdfView && (
          <PdfViewerOverlay
            srcDoc={credentialPdfView}
            title="Credencial completa"
            onClose={() => setCredentialPdfView(null)}
            onDownload={() => { if (credentialPdf) { try { saveCredentialPdf(credentialPdf); } catch {} } }}
          />
        )}

        {/* ── Trip Chat (active trips only) ──
            El jefe de delegación no habla con el conductor: coordina por la
            sala de asistencia con su coordinador, que es quien resuelve. Para
            el resto de pasajeros el chat del traslado sigue igual. */}
        {!isChief && trip && ["EN_ROUTE", "PICKED_UP"].includes(trip.status ?? "") && (
          <TripChat
            tripId={trip.id}
            senderType="PASSENGER"
            senderName={athlete.fullName}
            tripStatus={trip.status}
            reporterOriginType="athlete"
            reporterOriginId={athlete.id}
            eventId={athlete.eventId || null}
            onNewMessage={(name, content) => notify.push(`${name}: ${content.slice(0, 80)}`, "chat")}
          />
        )}

        {athlete && !isTA && (
          <AssistanceChat
            originType="athlete"
            originId={athlete.id}
            originName={athlete.fullName || "Participante"}
            eventId={athlete.eventId || null}
            showLauncher={false}
            open={assistOpen}
            initialCategory={assistCategoria}
            onOpenChange={(v) => { setAssistOpen(v); if (!v) setAssistCategoria(null); }}
          />
        )}

      </div>
    </div>
  );
}
