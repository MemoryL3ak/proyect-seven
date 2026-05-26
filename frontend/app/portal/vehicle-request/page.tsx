"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PlacesAutocompleteInput from "@/components/PlacesAutocompleteInput";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";
import AssistanceChat from "@/components/AssistanceChat";
import { buildCredentialHtml } from "@/lib/credential-template";
import QRCode from "qrcode";
import dynamic from "next/dynamic";

const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => <div style={{ height: 200, background: "#eef2f6", borderRadius: 12 }} />,
});

type Athlete = {
  id: string;
  fullName?: string | null;
  userType?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Venue = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  address?: string | null;
  region?: string | null;
  commune?: string | null;
  photoUrl?: string | null;
};

type Driver = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
};

type Vehicle = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};

type Trip = {
  id: string;
  eventId?: string | null;
  requesterAthleteId?: string | null;
  destinationVenueId?: string | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  driverId?: string | null;
  vehicleId?: string | null;
  status?: string | null;
  tripType?: string | null;
  notes?: string | null;
  requestedAt?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  origin?: string | null;
  destination?: string | null;
  athleteIds?: string[];
  createdAt?: string | null;
  passengerLat?: number | null;
  passengerLng?: number | null;
  driverRating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  isRoundTrip?: boolean;
  parentTripId?: string | null;
  legType?: string | null;
  childTrips?: Trip[];
  metadata?: Record<string, unknown> | null;
};

type Accommodation = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  roomType?: string | null;
  contactPhone?: string | null;
};

type EventItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null };
type AccessRequestResponse = { message?: string };
type PortalTab = "solicitud" | "actividades" | "premiaciones" | "cupones" | "sedes" | "hoteles" | "alimentacion" | "calendario" | "cuenta";

type FoodLocation = { id: string; accommodationId?: string | null; name: string; description?: string | null; capacity?: number | null; clientTypes?: string[] };
type FoodMenu = { id: string; date: string; mealType: string; title: string; description?: string | null; dietaryType?: string | null; accommodationId?: string | null };

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
  COMIDA: { label: "Comida", color: "#c78c00", bg: "#fff4d6" },
  ENTRETENIMIENTO: { label: "Entretenimiento", color: "#5e3aab", bg: "#f4f0fb" },
  TIENDA: { label: "Tienda", color: "#2e7d32", bg: "#e7f5ec" },
  OTHER: { label: "Otros", color: "#5e6b7a", bg: "#eef1f6" },
};
const COUPON_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  CLAIMED: { label: "Activo", color: "#1f4e8c", bg: "#e3edfa" },
  REDEEMED: { label: "Canjeado", color: "#2e7d32", bg: "#e7f5ec" },
  EXPIRED: { label: "Expirado", color: "#b3231b", bg: "#fde2e2" },
  REVOKED: { label: "Anulado", color: "#5e6b7a", bg: "#eef1f6" },
};
function couponDiscountDisplay(c: Coupon) {
  switch (c.discountType) {
    case "PERCENTAGE": return c.discountValue ? `${c.discountValue}% OFF` : "Descuento";
    case "AMOUNT":     return c.discountValue ? `$${Number(c.discountValue).toLocaleString("es-CL")}` : "Descuento";
    case "FREE":       return "GRATIS";
    default:           return c.discountValue?.toString() || "Beneficio";
  }
}
const fmtCouponDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "-";
const fmtCouponFull = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
function couponTimeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type PremiacionAwarder = {
  id: string;
  premiacion_id: string;
  athlete_id: string;
  role: string;
  confirmed_at: string | null;
  declined_at: string | null;
};

type PremiacionVIP = {
  id: string;
  title: string;
  discipline?: string | null;
  scheduled_at: string;
  venue_name?: string | null;
  location_detail?: string | null;
  status: string;
  notes?: string | null;
  myAssignment?: PremiacionAwarder;
};
type ActividadesSubTab = "en_curso" | "historial" | "pendientes";

type CalendarEvent = {
  id: string;
  name?: string | null;
  parentId?: string | null;
  scheduledAt?: string | null;
  venueName?: string | null;
  category?: string | null;
  gender?: string | null;
};
type DisciplineParent = { id: string; name?: string | null };
type PositionItem = {
  id: string;
  vehicleId: string;
  timestamp: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
  speed?: number | null;
  heading?: number | null;
};

const VEHICLE_TYPES = [
  { label: "Sedán — 4 Pasajeros", value: "SEDAN", maxPax: 4 },
  { label: "SUV — 6 Pasajeros", value: "SUV", maxPax: 6 },
  { label: "Van 10 — 10 Pasajeros", value: "VAN_10", maxPax: 10 },
  { label: "Van 15-17 — 17 Pasajeros", value: "VAN_15", maxPax: 17 },
  { label: "Van 19 — 19 Pasajeros", value: "VAN_19", maxPax: 19 },
  { label: "Minibus — 33 Pasajeros", value: "MINIBUS", maxPax: 33 },
  { label: "Bus — 64 Pasajeros", value: "BUS", maxPax: 64 },
] as const;

const statusMeta: Record<string, { label: string; tone: string; panel: string }> = {
  REQUESTED: {
    label: "Solicitado",
    tone: "border-amber-400 bg-amber-50 text-amber-700",
    panel: "",
  },
  SCHEDULED: {
    label: "Programado",
    tone: "border-sky-400 bg-sky-50 text-sky-700",
    panel: "",
  },
  EN_ROUTE: {
    label: "En ruta a recoger",
    tone: "border-indigo-400 bg-indigo-50 text-indigo-700",
    panel: "",
  },
  PICKED_UP: {
    label: "En curso",
    tone: "border-violet-400 bg-violet-50 text-violet-700",
    panel: "",
  },
  DROPPED_OFF: {
    label: "Finalizado en destino",
    tone: "border-cyan-500 bg-cyan-50 text-cyan-700",
    panel: "",
  },
  COMPLETED: {
    label: "Viaje completado",
    tone: "border-emerald-500 bg-emerald-50 text-emerald-700",
    panel: "",
  },
};

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

function toDateTimeLocalInput(value?: string | Date | null) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function vehicleTypeLabel(value?: string | null) {
  return VEHICLE_TYPES.find((item) => item.value === value)?.label || value || "-";
}

function normalizeOriginAddress(value?: string | null) {
  if (!value) return "";
  if (/^delegacion\s+[a-z]{2,4}$/i.test(value.trim())) {
    return "";
  }
  return value;
}

function canEditTrip(trip: Trip) {
  const editableStatuses = new Set(["REQUESTED", "SCHEDULED"]);
  if (!editableStatuses.has(trip.status ?? "")) return false;
  if (!trip.scheduledAt) return trip.status === "REQUESTED";
  const scheduled = new Date(trip.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled.getTime() - Date.now() > 2 * 60 * 60 * 1000;
}

function getEditDeadline(trip: Trip) {
  if (!trip.scheduledAt) return null;
  const scheduled = new Date(trip.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return null;
  return new Date(scheduled.getTime() - 2 * 60 * 60 * 1000);
}

function extractCoords(position?: PositionItem | null) {
  if (!position?.location) return null;
  const coordinates = (position.location as { coordinates?: [number, number] }).coordinates;
  const lat = coordinates ? coordinates[1] : (position.location as { lat?: number }).lat;
  const lng = coordinates ? coordinates[0] : (position.location as { lng?: number }).lng;
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
}

function buildDirectionsLink(lat: number, lng: number, destination?: string | null) {
  if (!destination) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

const DAY_NAMES = ["L", "M", "M", "J", "V", "S", "D"];

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function VehicleRequestPortalPage() {
  const autoLoginRef = useRef(false);
  const [userCode, setUserCode] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [accessRequestStatus, setAccessRequestStatus] = useState<string | null>(null);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(null);
  const [requestAccessLoading, setRequestAccessLoading] = useState(false);

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const notify = useNotifications();
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [foodLocations, setFoodLocations] = useState<FoodLocation[]>([]);
  const [foodMenus, setFoodMenus] = useState<FoodMenu[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Record<string, Driver>>({});
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [positionsByVehicle, setPositionsByVehicle] = useState<Record<string, PositionItem>>({});
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [disciplineParents, setDisciplineParents] = useState<DisciplineParent[]>([]);

  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("SEDAN");
  const [originAddress, setOriginAddress] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnTime, setReturnTime] = useState("");
  const [returnVenueId, setReturnVenueId] = useState("");
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<"granted" | "prompt" | "denied" | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("solicitud");
  const [actividadesSubTab, setActividadesSubTab] = useState<ActividadesSubTab>("en_curso");
  const [premiaciones, setPremiaciones] = useState<PremiacionVIP[]>([]);
  const [premView, setPremView] = useState<"calendar" | "list">("calendar");
  const [premCalCursor, setPremCalCursor] = useState(() => new Date());
  const [premCalSelectedKey, setPremCalSelectedKey] = useState<string | null>(null);
  const [premStatusFilter, setPremStatusFilter] = useState<"" | "PROGRAMADA" | "REALIZADA">("");
  const [premRoleFilter, setPremRoleFilter] = useState<string>("");
  const [premAttendanceFilter, setPremAttendanceFilter] = useState<"" | "CONFIRMED" | "PENDING" | "DECLINED">("");
  // Coupons tab state
  const [couponTab, setCouponTab] = useState<"available" | "mine">("available");
  const [couponsAvailable, setCouponsAvailable] = useState<Coupon[]>([]);
  const [couponClaims, setCouponClaims] = useState<CouponClaim[]>([]);
  const [couponClaiming, setCouponClaiming] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<CouponClaim | null>(null);
  const [couponQrDataUrl, setCouponQrDataUrl] = useState<string>("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [credentialHtml, setCredentialHtml] = useState<string | null>(null);
  const [visibleTripsCount, setVisibleTripsCount] = useState(5);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ratingTripId, setRatingTripId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Calendar state
  const [calMonthCursor, setCalMonthCursor] = useState(() => new Date());
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);

  const loadPortal = async (matchedAthlete: Athlete) => {
    const [tripData, venueData, driverData, vehicleData, eventData, delegationData, accommodationData, foodLocData, foodMenuData] = await Promise.all([
      apiFetch<Trip[]>("/trips"),
      apiFetch<Venue[]>("/venues"),
      apiFetch<Driver[]>("/drivers"),
      apiFetch<Vehicle[]>("/transports"),
      apiFetch<EventItem[]>("/events"),
      apiFetch<DelegationItem[]>("/delegations"),
      apiFetch<Accommodation[]>("/accommodations").catch(() => [] as Accommodation[]),
      apiFetch<FoodLocation[]>("/food-locations").catch(() => [] as FoodLocation[]),
      apiFetch<FoodMenu[]>("/food-menus").catch(() => [] as FoodMenu[]),
    ]);
    // Alimentación visible para todos — sin filtrar por clientType
    setFoodLocations(foodLocData || []);
    setFoodMenus(foodMenuData || []);

    setTrips(
      (tripData || [])
        .filter(
          (trip) =>
            (trip.requesterAthleteId && trip.requesterAthleteId === matchedAthlete.id) ||
            (trip.athleteIds || []).includes(matchedAthlete.id),
        )
        .sort(
          (a, b) =>
            new Date(b.requestedAt || b.createdAt || 0).getTime() -
            new Date(a.requestedAt || a.createdAt || 0).getTime(),
        ),
    );
    setVenues(
      (venueData || []).filter(
        (venue) => !matchedAthlete.eventId || venue.eventId === matchedAthlete.eventId,
      ),
    );
    setDrivers(
      (driverData || []).reduce<Record<string, Driver>>((acc, item) => {
        acc[item.id] = item;
        if (item.userId) acc[item.userId] = item;
        return acc;
      }, {}),
    );
    setVehicles(
      (vehicleData || []).reduce<Record<string, Vehicle>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
    setEvents(
      (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
    setDelegations(
      (delegationData || []).reduce<Record<string, DelegationItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
    setAccommodations(Array.isArray(accommodationData) ? accommodationData : []);

    // Load disciplines for calendar
    try {
      const discData = await apiFetch<CalendarEvent[]>("/disciplines");
      const allDiscs = Array.isArray(discData) ? discData : [];
      setDisciplineParents(allDiscs.filter((d) => !d.parentId));
      setCalendarEvents(
        allDiscs
          .filter((d) => d.parentId && d.scheduledAt)
          .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
      );
    } catch { setCalendarEvents([]); setDisciplineParents([]); }
  };

  const login = async () => {
    const normalized = userCode.trim();
    if (normalized.length < 6) {
      setError("Ingresa un codigo de usuario valido.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const athleteList = await apiFetch<Athlete[]>("/athletes");
      const validatedAthletes = filterValidatedAthletes(athleteList || []);
      const match = validatedAthletes.find((item) => item.id?.slice(-6) === normalized);
      if (!match) {
        setError("No encontramos un usuario con ese codigo.");
        setAthlete(null);
        return;
      }
      setAthlete(match);
      setActiveTab("solicitud");
      try { sessionStorage.setItem("portal_vr_id", match.id); } catch {}
      await loadPortal(match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el portal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoginRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const athleteId = params.get("athleteId");
    if (!athleteId) return;
    autoLoginRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Athlete>(`/athletes/${athleteId}`);
        if (data) {
          setAthlete(data);
          setActiveTab("solicitud");
          try { sessionStorage.setItem("portal_vr_id", data.id); } catch {}
          await loadPortal(data);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (autoLoginRef.current || athlete) return;
    try {
      const saved = sessionStorage.getItem("portal_vr_id");
      if (!saved) { setSessionChecked(true); return; }
      autoLoginRef.current = true;
      (async () => {
        setLoading(true);
        try {
          const data = await apiFetch<Athlete>(`/athletes/${saved}`);
          if (data?.id) {
            setAthlete(data);
            setActiveTab("solicitud");
            await loadPortal(data);
          } else { sessionStorage.removeItem("portal_vr_id"); }
        } catch { sessionStorage.removeItem("portal_vr_id"); }
        setLoading(false);
        setSessionChecked(true);
      })();
    } catch { setSessionChecked(true); }
  }, []);

  const requestAccess = async () => {
    if (!requestEmail.trim()) return;
    setRequestAccessLoading(true);
    setAccessRequestError(null);
    setAccessRequestStatus(null);
    try {
      const response = await apiFetch<AccessRequestResponse>("/athletes/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail.trim() }),
      });
      setAccessRequestStatus(response?.message || "Codigo enviado al correo.");
    } catch (err) {
      setAccessRequestError(err instanceof Error ? err.message : "No se pudo solicitar el codigo.");
    } finally {
      setRequestAccessLoading(false);
    }
  };

  const logout = () => {
    try { sessionStorage.removeItem("portal_vr_id"); } catch {}
    setAthlete(null);
    setTrips([]);
    setVenues([]);
    setFoodLocations([]);
    setFoodMenus([]);
    setDrivers({});
    setVehicles({});
    setAccommodations([]);
    setSelectedVenueId("");
    setRequestedTime("");
    setPassengerCount("1");
    setNotes("");
    setEditingTripId(null);
    setMessage(null);
    setError(null);
    setUserCode("");
  };

  const resetRequestForm = () => {
    setSelectedVehicleType("SEDAN");
    setOriginAddress("");
    setSelectedVenueId("");
    setRequestedTime("");
    setPassengerCount("1");
    setNotes("");
    setIsRoundTrip(false);
    setReturnTime("");
    setReturnVenueId("");
    setEditingTripId(null);
  };

  const cancelTrip = async (trip: Trip) => {
    if (!athlete) return;
    if (!canEditTrip(trip)) {
      setError("La solicitud ya no puede cancelarse porque esta dentro de las 2 horas previas al viaje.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          metadata: {
            log: [{ action: "CANCELLED", by: athlete.fullName ?? "usuario", at: new Date().toISOString() }],
          },
        }),
      });
      if (editingTripId === trip.id) {
        resetRequestForm();
      }
      setMessage("Solicitud cancelada correctamente.");
      await loadPortal(athlete);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const startEditingTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    setSelectedVehicleType(trip.requestedVehicleType || "SEDAN");
    setOriginAddress(normalizeOriginAddress(trip.origin));
    setSelectedVenueId(trip.destinationVenueId || "");
    setRequestedTime(
      trip.scheduledAt && !Number.isNaN(new Date(trip.scheduledAt).getTime())
        ? toDateTimeLocalInput(trip.scheduledAt)
        : "",
    );
    setPassengerCount(String(trip.passengerCount || 1));
    setNotes(trip.notes || "");
    setIsRoundTrip(trip.isRoundTrip || false);
    const returnChild = (trip.childTrips || []).find((c) => c.legType === "RETURN");
    setReturnTime(
      returnChild?.scheduledAt && !Number.isNaN(new Date(returnChild.scheduledAt).getTime())
        ? toDateTimeLocalInput(returnChild.scheduledAt)
        : "",
    );
    setReturnVenueId(returnChild?.destinationVenueId || "");
    setActiveTab("solicitud");
    setError(null);
    setMessage(null);
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!athlete) return;
    if (!selectedVenueId) {
      setError("Selecciona la sede destino.");
      return;
    }
    if (!originAddress.trim()) {
      setError("Ingresa la direccion de origen.");
      return;
    }
    if (!requestedTime) {
      setError("Indica la hora del servicio.");
      return;
    }
    const normalizedPassengerCount = Number(passengerCount);
    if (!Number.isFinite(normalizedPassengerCount) || normalizedPassengerCount < 1) {
      setError("Indica una cantidad de personas valida.");
      return;
    }
    const vehicleSpec = VEHICLE_TYPES.find((v) => v.value === selectedVehicleType);
    if (vehicleSpec && normalizedPassengerCount > vehicleSpec.maxPax) {
      setError(`El vehículo ${vehicleSpec.label} permite máximo ${vehicleSpec.maxPax} pasajeros.`);
      return;
    }
    if (isRoundTrip && !returnTime) {
      setError("Indica la fecha y hora del viaje de regreso.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const venue = venues.find((item) => item.id === selectedVenueId);
      const payload = {
        eventId: athlete.eventId,
        requesterAthleteId: athlete.id,
        athleteIds: [athlete.id],
        tripType: isRoundTrip ? "VIAJE_IDA_REGRESO" : "VIAJE_IDA",
        clientType: athlete.userType || "ATHLETE",
        requestedVehicleType: selectedVehicleType,
        passengerCount: normalizedPassengerCount,
        destinationVenueId: selectedVenueId,
        destination: [venue?.address, venue?.commune, venue?.region, "Chile"].filter(Boolean).join(", ") || venue?.name || "Sede solicitada",
        origin: originAddress.trim(),
        status: "REQUESTED",
        requestedAt: editingTripId ? undefined : new Date().toISOString(),
        scheduledAt: new Date(requestedTime).toISOString(),
        notes: notes.trim() ? `[Portal] ${notes.trim()}` : "[Portal] Solicitud desde portal VIP",
        ...(editingTripId ? {
          metadata: {
            log: [{ action: "MODIFIED", by: athlete.fullName ?? "usuario", at: new Date().toISOString() }],
          },
        } : {
          metadata: {
            log: [{ action: "CREATED", by: athlete.fullName ?? "usuario", at: new Date().toISOString() }],
          },
        }),
        isRoundTrip,
        ...(isRoundTrip ? {
          returnScheduledAt: new Date(returnTime).toISOString(),
          returnOrigin: [venue?.address, venue?.commune, venue?.region, "Chile"].filter(Boolean).join(", ") || venue?.name || "Sede solicitada",
          returnDestination: returnVenueId
            ? (() => { const rv = venues.find((v) => v.id === returnVenueId); return [rv?.address, rv?.commune, rv?.region, "Chile"].filter(Boolean).join(", ") || rv?.name || "Destino regreso"; })()
            : originAddress.trim(),
          returnDestinationVenueId: returnVenueId || undefined,
        } : {}),
      };

      await apiFetch(editingTripId ? `/trips/${editingTripId}` : "/trips", {
        method: editingTripId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(
        editingTripId
          ? "Solicitud actualizada correctamente."
          : "SOLICITUD_ENVIADA",
      );
      resetRequestForm();
      await loadPortal(athlete);
      setActiveTab("solicitud");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVenue = useMemo(() => venues.find((item) => item.id === selectedVenueId) || null, [venues, selectedVenueId]);
  const editingTrip = useMemo(() => trips.find((trip) => trip.id === editingTripId) || null, [editingTripId, trips]);

  // Trips grouped by sub-tab for Actividades
  const enCursoTrips = useMemo(() => trips.filter((t) => t.status === "EN_ROUTE" || t.status === "PICKED_UP"), [trips]);
  const historialTrips = useMemo(() => trips.filter((t) => t.status === "COMPLETED" || t.status === "DROPPED_OFF"), [trips]);
  const pendientesTrips = useMemo(() => trips.filter((t) => t.status === "REQUESTED" || t.status === "SCHEDULED"), [trips]);

  const dismissRating = () => {
    if (ratingTripId) ratingDismissed.current.add(ratingTripId);
    setRatingTripId(null);
    setRatingStars(0);
    setRatingComment("");
  };

  const submitRating = async (tripId: string) => {
    if (ratingStars === 0) return;
    setRatingLoading(true);
    try {
      await apiFetch(`/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverRating: ratingStars,
          ratingComment: ratingComment.trim() || undefined,
          ratedAt: new Date().toISOString(),
        }),
      });
      setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, driverRating: ratingStars } : t));
      notify.push("Gracias por tu evaluacion!", "⭐");
      setRatingTripId(null);
      setRatingStars(0);
      setRatingComment("");
    } catch {
      notify.push("No se pudo enviar la evaluacion", "❌");
    } finally {
      setRatingLoading(false);
    }
  };

  const activeChatTrip = useMemo(() =>
    trips.find((trip) => ["EN_ROUTE", "PICKED_UP"].includes(trip.status || "")) || null,
  [trips]);

  const requestStats = useMemo(() => {
    const requested = trips.filter((trip) => trip.status === "REQUESTED").length;
    const scheduled = trips.filter((trip) => trip.status === "SCHEDULED").length;
    const active = trips.filter((trip) => ["EN_ROUTE", "PICKED_UP"].includes(trip.status || "")).length;
    const completed = trips.filter((trip) => ["DROPPED_OFF", "COMPLETED"].includes(trip.status || "")).length;
    return { requested, scheduled, active, completed };
  }, [trips]);

  useEffect(() => {
    if (!athlete) return;
    const activeTrips = trips.filter((trip) => trip.status === "EN_ROUTE" && trip.vehicleId);
    if (activeTrips.length === 0) {
      setPositionsByVehicle({});
      return;
    }

    let cancelled = false;
    const loadPositions = async () => {
      try {
        const positionData = await apiFetch<PositionItem[]>("/vehicle-positions");
        if (cancelled) return;
        const latestByVehicle: Record<string, PositionItem> = {};
        (positionData || []).forEach((pos) => {
          if (!activeTrips.some((trip) => trip.vehicleId === pos.vehicleId)) return;
          const current = latestByVehicle[pos.vehicleId];
          if (!current || new Date(pos.timestamp).getTime() > new Date(current.timestamp).getTime()) {
            latestByVehicle[pos.vehicleId] = pos;
          }
        });
        setPositionsByVehicle(latestByVehicle);
      } catch {
        // non-blocking
      }
    };

    loadPositions();
    const timer = window.setInterval(loadPositions, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [athlete, trips]);

  // Load premiaciones assigned to this VIP (athlete as awarder)
  useEffect(() => {
    if (!athlete?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiFetch<PremiacionVIP[]>(`/premiaciones/by-athlete/${athlete.id}`);
        if (!cancelled) setPremiaciones(data || []);
      } catch {
        // non-blocking
      }
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [athlete?.id]);

  const confirmAwarder = async (premiacionId: string, awarderId: string, decision: "CONFIRM" | "DECLINE") => {
    try {
      const endpoint = decision === "CONFIRM" ? "confirm" : "decline";
      await apiFetch(`/premiaciones/${premiacionId}/awarders/${awarderId}/${endpoint}`, {
        method: "PATCH",
      });
      const data = await apiFetch<PremiacionVIP[]>(`/premiaciones/by-athlete/${athlete!.id}`);
      setPremiaciones(data || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  };

  // ── Coupons: load available + claims when athlete is known ──
  const loadCoupons = async (athleteId: string, userType: string) => {
    setCouponError(null);
    try {
      const [list, claims] = await Promise.all([
        apiFetch<Coupon[]>(`/coupons/for-user?userType=${encodeURIComponent(userType || "VIP")}`),
        apiFetch<CouponClaim[]>(`/coupons/claims/mine?userId=${encodeURIComponent(athleteId)}`),
      ]);
      setCouponsAvailable(Array.isArray(list) ? list : []);
      setCouponClaims(Array.isArray(claims) ? claims : []);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "No se pudieron cargar los cupones");
    }
  };
  useEffect(() => {
    if (!athlete?.id) return;
    loadCoupons(athlete.id, athlete.userType || "VIP");
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
          userType: athlete.userType || "VIP",
          userName: athlete.fullName || undefined,
        }),
      });
      const coupon = couponsAvailable.find((c) => c.id === couponId);
      setActiveClaim({ ...result, coupon });
      await loadCoupons(athlete.id, athlete.userType || "VIP");
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Error reclamando");
    } finally {
      setCouponClaiming(null);
    }
  };

  useEffect(() => {
    if (!activeClaim) { setCouponQrDataUrl(""); return; }
    QRCode.toDataURL(activeClaim.qrToken, {
      width: 320, margin: 2,
      color: { dark: "#1f2937", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setCouponQrDataUrl).catch(() => setCouponQrDataUrl(""));
  }, [activeClaim]);

  // Auto-show rating popup when a trip transitions to completed
  const ratingDismissed = useRef<Set<string>>(new Set());
  const prevTripStatuses = useRef<Record<string, string>>({});
  useEffect(() => {
    trips.forEach((t) => {
      const prev = prevTripStatuses.current[t.id];
      const isNewCompletion = prev && prev !== t.status && (t.status === "COMPLETED" || t.status === "DROPPED_OFF");
      if (isNewCompletion && !t.driverRating && t.driverId && !ratingDismissed.current.has(t.id)) {
        setRatingTripId(t.id);
      }
      if (t.id && t.status) prevTripStatuses.current[t.id] = t.status;
    });
  }, [trips]);

  // Poll active trips every 5s for status changes + notifications
  const prevStatuses = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!athlete) return;
    // Initialize status tracking
    trips.forEach((t) => {
      if (t.id && t.status) prevStatuses.current[t.id] = t.status;
    });

    const pollTrips = async () => {
      try {
        const tripData = await apiFetch<Trip[]>("/trips");
        const myTrips = (tripData || [])
          .filter(
            (trip) =>
              (trip.requesterAthleteId && trip.requesterAthleteId === athlete.id) ||
              (trip.athleteIds || []).includes(athlete.id),
          )
          .sort(
            (a, b) =>
              new Date(b.requestedAt || b.createdAt || 0).getTime() -
              new Date(a.requestedAt || a.createdAt || 0).getTime(),
          );

        // Detect status changes and notify
        myTrips.forEach((t) => {
          const prev = prevStatuses.current[t.id];
          if (prev && t.status && prev !== t.status) {
            const msgs: Record<string, { message: string; emoji: string }> = {
              SCHEDULED: { message: "Tu traslado fue programado", emoji: "cal" },
              EN_ROUTE: { message: "El conductor esta en camino", emoji: "car" },
              PICKED_UP: { message: "Estas en ruta a tu destino", emoji: "ok" },
              COMPLETED: { message: "Viaje completado", emoji: "done" },
            };
            const info = msgs[t.status];
            if (info) notify.push(info.message, info.emoji);
            // Auto-open rating when trip completes
            if ((t.status === "COMPLETED" || t.status === "DROPPED_OFF") && !t.driverRating && t.driverId) {
              setRatingTripId(t.id);
              setExpandedTripId(t.id);
            }
          }
          if (t.id && t.status) prevStatuses.current[t.id] = t.status;
        });

        setTrips(myTrips);
      } catch { /* silent */ }
    };

    const timer = window.setInterval(pollTrips, 5000);
    return () => window.clearInterval(timer);
  }, [athlete?.id]);

  // Check & monitor location permission
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      setLocationPermission(result.state as "granted" | "prompt" | "denied");
      result.onchange = () => setLocationPermission(result.state as "granted" | "prompt" | "denied");
    }).catch(() => {});
  }, []);

  // Wake Lock: keep screen awake during active trips
  useEffect(() => {
    if (!activeChatTrip || !["EN_ROUTE", "PICKED_UP"].includes(activeChatTrip.status ?? "")) return;
    let wakeLock: any = null;
    const request = async () => {
      try { if ("wakeLock" in navigator) { wakeLock = await (navigator as any).wakeLock.request("screen"); } } catch {}
    };
    request();
    const onVis = () => { if (document.visibilityState === "visible" && !wakeLock) request(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { if (wakeLock) { try { wakeLock.release(); } catch {} } document.removeEventListener("visibilitychange", onVis); };
  }, [activeChatTrip?.id, activeChatTrip?.status]);

  // User geolocation + send to backend (Safari-friendly + background resume)
  useEffect(() => {
    if (!athlete || !navigator.geolocation) return;
    let watchId: number | null = null;
    let interval: number | null = null;

    const onPos = (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserPos(coords);
      if (activeChatTrip?.id && ["EN_ROUTE", "PICKED_UP"].includes(activeChatTrip.status ?? "")) {
        apiFetch(`/trips/${activeChatTrip.id}/passenger-position`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
        }).catch(() => {});
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 };

    navigator.geolocation.getCurrentPosition(onPos, () => {}, opts);
    watchId = navigator.geolocation.watchPosition(onPos, () => {}, opts);

    // Polling backup every 5s
    interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 });
    }, 5000);

    // Resume on visibility change (mobile background)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        navigator.geolocation.getCurrentPosition(onPos, () => {}, opts);
        if (interval) window.clearInterval(interval);
        interval = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 });
        }, 5000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [athlete?.id, activeChatTrip?.id, activeChatTrip?.status]);

  // Calendar helpers
  const calYear = calMonthCursor.getFullYear();
  const calMonth = calMonthCursor.getMonth();
  const calGrid = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const calMonthLabel = calMonthCursor.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  const calDaysWithEvents = useMemo(() => {
    const set = new Set<number>();
    calendarEvents.forEach((ce) => {
      if (!ce.scheduledAt) return;
      const d = new Date(ce.scheduledAt);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        set.add(d.getDate());
      }
    });
    return set;
  }, [calendarEvents, calYear, calMonth]);

  const calSelectedDayEvents = useMemo(() => {
    if (calSelectedDay === null) return [];
    return calendarEvents.filter((ce) => {
      if (!ce.scheduledAt) return false;
      const d = new Date(ce.scheduledAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === calSelectedDay;
    });
  }, [calendarEvents, calYear, calMonth, calSelectedDay]);

  // ── Trip card renderer (shared between sub-tabs) ──
  const renderTripCard = (trip: Trip) => {
    const venue = venues.find((item) => item.id === trip.destinationVenueId);
    const driver = trip.driverId ? drivers[trip.driverId] : null;
    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
    const status = statusMeta[trip.status || "REQUESTED"] || statusMeta.REQUESTED;
    const editable = canEditTrip(trip);
    const isExpanded = expandedTripId === trip.id;
    const isActive = trip.status === "EN_ROUTE" || trip.status === "PICKED_UP";
    const isCompleted = trip.status === "COMPLETED" || trip.status === "DROPPED_OFF";
    const canRate = isCompleted && !trip.driverRating && trip.driverId;
    const livePosition = trip.vehicleId ? positionsByVehicle[trip.vehicleId] : null;
    const coords = extractCoords(livePosition);

    return (
      <div key={trip.id} style={{
        borderRadius:16,border:"1px solid #e2e8f0",background:"#fff",
        overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)",
      }}>
        {/* Compact header */}
        <button
          type="button"
          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
          style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,
            padding:"12px 14px",background:"none",border:"none",cursor:"pointer",
            textAlign:"left",
          }}
        >
          <span style={{
            width:10,height:10,borderRadius:"50%",flexShrink:0,
            background: isActive ? "#7c3aed" : isCompleted ? "#21D0B3" : trip.status === "SCHEDULED" ? "#0ea5e9" : "#f59e0b",
            boxShadow: isActive ? "0 0 8px rgba(124,58,237,0.4)" : "none",
          }} />
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:13.5,fontWeight:700,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {venue?.name || trip.destination || "Destino pendiente"}
            </p>
            <p style={{ fontSize:11,color:"#94a3b8",margin:"2px 0 0" }}>
              {formatDateTime(trip.scheduledAt || trip.requestedAt)} · {status.label}
              {trip.isRoundTrip && <span style={{ marginLeft:6,padding:"1px 6px",borderRadius:6,background:"#f0fdfa",border:"1px solid #99f6e4",fontSize:10,fontWeight:600,color:"#0a7a6b" }}>Ida y vuelta</span>}
            </p>
          </div>
          {driver && (
            <span style={{ fontSize:10.5,fontWeight:600,padding:"3px 8px",borderRadius:8,background:"#f1f5f9",color:"#334155",whiteSpace:"nowrap",flexShrink:0 }}>
              {driver.fullName}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,transition:"transform .2s",transform:isExpanded?"rotate(180deg)":"rotate(0)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Active trip banner */}
        {isActive && !isExpanded && (
          <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#7c3aed",animation:"vrPulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize:12,fontWeight:600,color:"#7c3aed" }}>
              {trip.status === "PICKED_UP" ? "Viaje en curso" : trip.status === "EN_ROUTE" ? "Conductor en camino" : ""}
            </span>
          </div>
        )}

        {/* Rate prompt */}
        {canRate && !isExpanded && ratingTripId !== trip.id && (
          <div style={{ padding:"0 14px 10px" }}>
            <button type="button" onClick={() => setRatingTripId(trip.id)} style={{
              display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:10,
              border:"1px solid rgba(33,208,179,0.3)",background:"rgba(33,208,179,0.06)",
              color:"#0a7a6b",fontSize:12,fontWeight:600,cursor:"pointer",
            }}>
              Evaluar conductor
            </button>
          </div>
        )}

        {/* Inline rating */}
        {isCompleted && !trip.driverRating && ratingTripId === trip.id && (
          <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:10 }}>
            <p style={{ fontSize:13,fontWeight:600,color:"#0f172a",margin:0 }}>Como fue tu viaje?</p>
            <div style={{ display:"flex",gap:4 }}>
              {[1,2,3,4,5].map((star) => (
                <button key={star} type="button" onClick={() => setRatingStars(star)} style={{ background:"none",border:"none",cursor:"pointer",padding:2 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={ratingStars >= star ? "#FBBF24" : "none"} stroke={ratingStars >= star ? "#F59E0B" : "#CBD5E1"} strokeWidth="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Comentario opcional..."
              rows={2}
              style={{ width:"100%",padding:10,borderRadius:10,border:"1px solid #e2e8f0",fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit" }}
            />
            <div style={{ display:"flex",gap:8,width:"100%" }}>
              <button type="button" onClick={() => submitRating(trip.id)} disabled={ratingStars === 0 || ratingLoading}
                style={{ flex:1,padding:10,borderRadius:10,border:"none",background:ratingStars > 0 ? "linear-gradient(135deg,#34F3C6,#21D0B3)" : "#e2e8f0",color:ratingStars > 0 ? "#0d1b3e" : "#94a3b8",fontSize:13,fontWeight:700,cursor:ratingStars > 0 ? "pointer" : "not-allowed" }}>
                {ratingLoading ? "..." : "Enviar"}
              </button>
              <button type="button" onClick={() => { setRatingTripId(null); setRatingStars(0); setRatingComment(""); }}
                style={{ padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                Omitir
              </button>
            </div>
          </div>
        )}

        {/* Rating already given */}
        {trip.driverRating && !isExpanded && (
          <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4 }}>
            {Array.from({ length: trip.driverRating }, (_, i) => (
              <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
            <span style={{ fontSize:11,color:"#94a3b8",marginLeft:4 }}>Evaluado</span>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Origen</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{trip.origin || "Pendiente"}</p>
              </div>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Destino</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{trip.destination || venue?.name || "Pendiente"}</p>
              </div>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Conductor</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{driver?.fullName || "Pendiente"}</p>
                {driver?.phone && <p style={{ fontSize:11,color:"#64748b",margin:"2px 0 0" }}>{driver.phone}</p>}
              </div>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Vehiculo</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{vehicle?.plate || "Pendiente"}</p>
                {vehicle && <p style={{ fontSize:11,color:"#64748b",margin:"2px 0 0" }}>{[vehicle.type, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}</p>}
              </div>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Personas</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{trip.passengerCount || "-"}</p>
              </div>
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Tipo</p>
                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{vehicleTypeLabel(trip.requestedVehicleType)}</p>
              </div>
            </div>
            {trip.notes && (
              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Notas</p>
                <p style={{ fontSize:12.5,color:"#334155",margin:"3px 0 0",lineHeight:1.4 }}>{trip.notes}</p>
              </div>
            )}

            {trip.isRoundTrip && trip.childTrips && trip.childTrips.length > 0 && (
              <div style={{ padding:"10px 12px",borderRadius:12,background:"#f0fdfa",border:"1px solid #99f6e4" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#0a7a6b",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.1em" }}>Viaje de regreso</p>
                {trip.childTrips.map((child) => {
                  const returnVenue = child.destinationVenueId ? venues.find((v) => v.id === child.destinationVenueId) : null;
                  const returnDriver = child.driverId ? drivers[child.driverId] : null;
                  const childStatusMeta = statusMeta[child.status || "REQUESTED"] || statusMeta.REQUESTED;
                  const childStatus = { label: childStatusMeta.label, color: child.status === "COMPLETED" || child.status === "DROPPED_OFF" ? "#10b981" : child.status === "EN_ROUTE" || child.status === "PICKED_UP" ? "#6366f1" : "#f59e0b" };
                  return (
                    <div key={child.id} style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                        <span style={{ display:"inline-block",width:8,height:8,borderRadius:4,background:childStatus.color }} />
                        <span style={{ fontSize:11,fontWeight:700,color:childStatus.color }}>{childStatus.label}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                        <div style={{ padding:"6px 8px",borderRadius:8,background:"#fff",border:"1px solid #e2e8f0" }}>
                          <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Fecha regreso</p>
                          <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{formatDateTime(child.scheduledAt)}</p>
                        </div>
                        <div style={{ padding:"6px 8px",borderRadius:8,background:"#fff",border:"1px solid #e2e8f0" }}>
                          <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Destino</p>
                          <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>
                            {returnVenue?.name || child.destination || child.origin || "Pendiente"}
                          </p>
                        </div>
                        <div style={{ padding:"6px 8px",borderRadius:8,background:"#fff",border:"1px solid #e2e8f0" }}>
                          <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Conductor</p>
                          <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{returnDriver?.fullName || "Pendiente"}</p>
                        </div>
                        <div style={{ padding:"6px 8px",borderRadius:8,background:"#fff",border:"1px solid #e2e8f0" }}>
                          <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Origen</p>
                          <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{child.origin || "Pendiente"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Map for active/scheduled trips */}
            {(isActive || trip.status === "SCHEDULED") && (
              <div style={{ borderRadius:12,overflow:"hidden",border:"1px solid rgba(33,208,179,0.25)" }}>
                <TripMap
                  origin={trip.origin}
                  destination={trip.destination || venue?.name}
                  driverPosition={coords ? { lat: coords.lat, lng: coords.lng } : null}
                  userPosition={userPos || (trip.passengerLat && trip.passengerLng ? { lat: trip.passengerLat, lng: trip.passengerLng } : null)}
                  height={200}
                />
                <div style={{ padding:"8px 10px",background:"rgba(33,208,179,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#0a7a6b" }}>
                    {trip.status === "PICKED_UP" ? "Viaje en curso" : trip.status === "EN_ROUTE" ? "Conductor en camino" : "Ruta programada"}
                  </span>
                  {coords && (
                    <a
                      href={buildDirectionsLink(coords.lat, coords.lng, trip.origin)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize:11,color:"#21D0B3",fontWeight:600 }}
                    >
                      Abrir en Maps
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Completed trip times */}
            {isCompleted && (
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                {trip.startedAt && (
                  <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                    <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Inicio</p>
                    <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{formatDateTime(trip.startedAt)}</p>
                  </div>
                )}
                {trip.completedAt && (
                  <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                    <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Fin</p>
                    <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{formatDateTime(trip.completedAt)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Rating in expanded */}
            {trip.driverRating && (
              <div style={{ display:"flex",alignItems:"center",gap:4,padding:"4px 0" }}>
                {Array.from({ length: trip.driverRating }, (_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
                <span style={{ fontSize:11,color:"#94a3b8",marginLeft:4 }}>Tu evaluacion</span>
              </div>
            )}

            {/* Action buttons */}
            {editable && (
              <div style={{ display:"flex",gap:8,marginTop:4 }}>
                <button type="button" onClick={() => startEditingTrip(trip)}
                  style={{ flex:1,padding:"8px 12px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#334155",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                  Modificar
                </button>
                <button type="button" onClick={() => cancelTrip(trip)}
                  style={{ padding:"8px 12px",borderRadius:10,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Google Maps embed for venues/hotels
  const renderMapEmbed = (address: string | null | undefined, extra?: string | null) => {
    if (!address) return null;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const query = [address, extra].filter(Boolean).join(" ");
    if (apiKey) {
      return (
        <iframe
          src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}`}
          style={{ width:"100%",height:180,border:"none",borderRadius:10 }}
          allowFullScreen
          loading="lazy"
        />
      );
    }
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
        style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"rgba(33,208,179,0.08)",border:"1px solid rgba(33,208,179,0.25)",color:"#0a7a6b",fontSize:12,fontWeight:600,textDecoration:"none",cursor:"pointer" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Ver en Google Maps
      </a>
    );
  };

  return (
    <>
      {!sessionChecked && !athlete && (
        <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#020c18 0%,#0a1628 50%,#041220 100%)",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:"-20%",right:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(33,208,179,0.08) 0%,transparent 70%)",pointerEvents:"none" }} />
          <div style={{ position:"absolute",bottom:"-15%",left:"-10%",width:"40vw",height:"40vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(31,205,255,0.06) 0%,transparent 70%)",pointerEvents:"none" }} />
          <div style={{ position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
            <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height:48,width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 24px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.6))",marginBottom:8 }} />
            <div style={{ width:44,height:44,position:"relative" }}>
              <div style={{ position:"absolute",inset:0,border:"3px solid rgba(33,208,179,0.15)",borderRadius:"50%" }} />
              <div style={{ position:"absolute",inset:0,border:"3px solid transparent",borderTopColor:"#21D0B3",borderRadius:"50%",animation:"sa-spin 0.9s cubic-bezier(0.4,0,0.2,1) infinite" }} />
            </div>
            <p style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:0,letterSpacing:"0.03em" }}>Cargando portal...</p>
          </div>
          <style>{`@keyframes sa-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {sessionChecked && !athlete && (
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes pvr-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
            @keyframes pvr-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
            @keyframes pvr-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
            @keyframes pvr-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes pvr-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
            .pvr-form{animation:pvr-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
          `}</style>

          {/* Left branding panel */}
          <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
            style={{ background: "linear-gradient(160deg,#020c18 0%,#041a2e 40%,#062240 70%,#030f1e 100%)", position: "relative", overflow: "hidden", minHeight: "180px" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)", animation: "pvr-f1 12s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "60px", right: "-40px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)", animation: "pvr-f2 16s ease-in-out infinite", pointerEvents: "none" }} />
            {[480, 340, 200].map((size, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2, width: size, height: size, borderRadius: "50%", border: `1px solid rgba(33,208,179,${0.04 + i * 0.04})`, animation: `pvr-pulse 6s ease-in-out infinite ${i * 2}s`, pointerEvents: "none" }} />
            ))}
            <div style={{ position: "relative", zIndex: 1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", padding: "24px 0" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 8px #21D0B3" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Portal de Movilidad</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 700, lineHeight: 1.1, color: "#ffffff", margin: 0 }}>
                Solicita tu<br />
                <span style={{ background: "linear-gradient(90deg,#21D0B3,#34F3C6,#21D0B3)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pvr-shimmer 4s linear infinite" }}>
                  vehiculo
                </span>
              </h1>
              <p className="hidden sm:block" style={{ fontSize: "15px", lineHeight: 1.6, color: "rgba(255,255,255,0.55)", maxWidth: "340px", margin: 0 }}>
                Registra, modifica y haz seguimiento en tiempo real de tus solicitudes de transporte hacia las sedes del evento.
              </p>
              <div className="hidden lg:flex flex-col" style={{ gap: "10px", marginTop: "8px" }}>
                {([
                  [<svg key="car" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, "Solicita tu traslado"],
                  [<svg key="clock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, "Seguimiento en tiempo real"],
                  [<svg key="pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, "Hacia las sedes del evento"],
                ] as [React.ReactNode, string][]).map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block" style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>Seven Arena - Portal seguro</p>
            </div>
          </div>

          {/* Right login panel */}
          <div className="pvr-form flex flex-1 flex-col justify-center px-5 py-8 sm:px-6 sm:py-12 lg:px-14" style={{ background: "linear-gradient(160deg,#030f1e 0%,#041a2e 50%,#020c18 100%)" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto" }}>
              <div style={{ marginBottom: "32px" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "8px" }}>Acceso</p>
                <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>Ingresa con tu codigo</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: 0 }}>Usa el codigo corto del portal de usuario para acceder a tu panel de movilidad.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "28px" }}>
                <input
                  className="input h-12 text-base"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="Codigo de usuario"
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(33,208,179,0.2)", color: "#ffffff", borderRadius: "12px" }}
                />
                <button
                  type="button"
                  onClick={login}
                  disabled={loading}
                  style={{ height: "48px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg,#34F3C6 0%,#21D0B3 50%,#15B09A 100%)", color: "#0d1b3e", border: "none", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 20px rgba(33,208,179,0.35)" }}
                >
                  {loading ? "Ingresando..." : "Abrir portal"}
                </button>
                {error && <p style={{ fontSize: "13px", color: "#f87171", margin: 0 }}>{error}</p>}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "28px" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "8px" }}>Recuperacion de acceso</p>
                <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff", margin: "0 0 6px" }}>Solicita tu codigo</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
                  Si no tienes tu codigo, ingresalo con tu correo registrado y te lo enviamos.
                </p>
                <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                  <input
                    className="input h-11 text-sm"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    type="email"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#ffffff", borderRadius: "10px" }}
                  />
                  <button
                    type="button"
                    onClick={requestAccess}
                    disabled={requestAccessLoading}
                    style={{ width: "100%", height: "44px", padding: "0 20px", borderRadius: "10px", fontWeight: 500, fontSize: "13px", cursor: requestAccessLoading ? "not-allowed" : "pointer", background: "rgba(33,208,179,0.1)", color: "#21D0B3", border: "1px solid rgba(33,208,179,0.3)", opacity: requestAccessLoading ? 0.7 : 1 }}
                  >
                    {requestAccessLoading ? "Enviando..." : "Solicitar codigo"}
                  </button>
                </div>
                {accessRequestStatus && <p style={{ fontSize: "13px", color: "#34d399", marginTop: "10px" }}>{accessRequestStatus}</p>}
                {accessRequestError && <p style={{ fontSize: "13px", color: "#f87171", marginTop: "10px" }}>{accessRequestError}</p>}

                <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                  {[["Paso 1", "Solicita tu codigo"], ["Paso 2", "Ingresa al portal"], ["Paso 3", "Sigue el viaje"]].map(([step, label]) => (
                    <div key={step} style={{ borderRadius: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(33,208,179,0.12)" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(33,208,179,0.7)", marginBottom: "6px" }}>{step}</div>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.7)", margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {athlete && (
        <div style={{ minHeight:"100vh",background:"#eef1f8",position:"relative",overflow:"hidden" }}>
          <style>{`
            @keyframes vr-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
            @keyframes vr-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
            @keyframes vrPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
            .vr-card{animation:vr-in .5s cubic-bezier(0.16,1,0.3,1) both;background:#fff;border:1px solid rgba(226,232,240,0.8);border-radius:18px;padding:16px;position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);}
            .vr-card:hover{box-shadow:0 6px 24px rgba(33,208,179,0.12);border-color:rgba(33,208,179,0.25);}
            @media(min-width:641px){.vr-card{border-radius:24px;padding:24px;}}
          `}</style>
          {/* Decorative bg */}
          <div style={{ position:"fixed",top:"-100px",right:"-100px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.06) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />

          {/* Banner */}
          <div style={{ position:"relative",background:"linear-gradient(135deg,#041a2e 0%,#062240 45%,#0a3356 80%,#041a2e 100%)",overflow:"hidden",zIndex:1 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none" }} />
            <div style={{ position:"absolute",bottom:"-1px",left:0,right:0,height:"2px",background:"linear-gradient(90deg,transparent,#21D0B3 30%,#34F3C6 50%,#21D0B3 70%,transparent)",pointerEvents:"none",animation:"vr-glow 3s ease-in-out infinite" }} />
            <div style={{ padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:"960px",margin:"0 auto",position:"relative",zIndex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height:"34px",width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 18px rgba(33,208,179,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.8))" }} />
                <span style={{ fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160 }}>{athlete.fullName || ""}</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <NotificationBell
                  notifications={notify.notifications}
                  unreadCount={notify.unreadCount}
                  onMarkAllRead={notify.markAllRead}
                  onClear={notify.clear}
                />
                <button type="button" onClick={() => athlete && loadPortal(athlete)} disabled={loading}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,opacity:loading?0.5:1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                </button>
                <button type="button" onClick={logout}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",cursor:"pointer",flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth:"960px",margin:"0 auto",padding:"14px 10px calc(70px + env(safe-area-inset-bottom))",position:"relative",zIndex:1 }}>

          <section style={{ display:"flex",flexDirection:"column",gap:"12px" }}>

            {message && message !== "SOLICITUD_ENVIADA" ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            {/* Success modal */}
            {message === "SOLICITUD_ENVIADA" && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div style={{ background:"#fff",borderRadius:"24px",width:"100%",maxWidth:"380px",padding:"32px 28px",boxShadow:"0 8px 40px rgba(15,23,42,0.2)",textAlign:"center" }}>
                  <div style={{ width:"56px",height:"56px",borderRadius:"50%",background:"rgba(33,208,179,0.12)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 style={{ fontSize:"18px",fontWeight:800,color:"#0f172a",margin:"0 0 8px" }}>Solicitud enviada</h3>
                  <p style={{ fontSize:"13px",color:"#64748b",lineHeight:1.5,margin:"0 0 24px" }}>
                    Transporte la revisará y asignará un chofer.<br/>
                    Podrás ver el estado en la pestaña <strong style={{ color:"#0f172a" }}>Actividades</strong>.
                  </p>
                  <button
                    onClick={() => setMessage(null)}
                    style={{ width:"100%",padding:"12px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#21D0B3,#14AE98)",color:"#fff",fontSize:"14px",fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(33,208,179,0.35)" }}
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════ SOLICITUD TAB ═══════════════════ */}
            {activeTab === "solicitud" && (
              <section style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
              <section>
                <div style={{ borderRadius:16,border:"1px solid #e2e8f0",background:"#fff",padding:"16px 14px",boxShadow:"0 1px 4px rgba(15,23,42,0.04)" }}>
                  <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:"0 0 12px" }}>
                    {editingTripId ? "Modificar solicitud" : "Solicitar vehiculo"}
                  </p>
                  {editingTrip ? (
                    <div style={{ padding:"8px 10px",borderRadius:10,background:"#fffbeb",border:"1px solid #fde68a",color:"#92400e",fontSize:12,marginBottom:12 }}>
                      Editable hasta <strong>{formatDateTime(getEditDeadline(editingTrip)?.toISOString() || null)}</strong>
                    </div>
                  ) : null}

                  <form onSubmit={submitRequest} style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 90px",gap:8 }}>
                      <div>
                        <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Tipo de vehiculo</label>
                        <select className="input" value={selectedVehicleType} onChange={(e) => setSelectedVehicleType(e.target.value)}
                          style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }}>
                          {VEHICLE_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Personas</label>
                        <input className="input" type="number" min={1} max={VEHICLE_TYPES.find((v) => v.value === selectedVehicleType)?.maxPax ?? 64} step={1} value={passengerCount}
                          onChange={(e) => setPassengerCount(e.target.value)}
                          style={{ width:"100%",height:40,fontSize:13,borderRadius:10,textAlign:"center", borderColor: Number(passengerCount) > (VEHICLE_TYPES.find((v) => v.value === selectedVehicleType)?.maxPax ?? 64) ? "#ef4444" : undefined }} />
                      </div>
                    </div>
                    {(() => {
                      const maxPax = VEHICLE_TYPES.find((v) => v.value === selectedVehicleType)?.maxPax ?? 64;
                      const vehicleLabel = VEHICLE_TYPES.find((v) => v.value === selectedVehicleType)?.label ?? "";
                      if (Number(passengerCount) > maxPax) return (
                        <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <span style={{ fontSize:12,fontWeight:600,color:"#dc2626" }}>El vehículo {vehicleLabel.split("—")[0].trim()} permite máximo {maxPax} pasajeros</span>
                        </div>
                      );
                      return null;
                    })()}

                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Origen</label>
                      <PlacesAutocompleteInput
                        className="input"
                        value={originAddress}
                        onChange={setOriginAddress}
                        placeholder="Direccion de recogida"
                        style={{ height:40,fontSize:13,borderRadius:10 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Sede destino</label>
                      <select className="input" value={selectedVenueId} onChange={(e) => setSelectedVenueId(e.target.value)}
                        style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }}>
                        <option value="">Selecciona una sede</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}{venue.address ? ` — ${venue.address}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Fecha y hora</label>
                      <input className="input" type="datetime-local" value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }} />
                    </div>

                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Notas (opcional)</label>
                      <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Equipamiento, prioridad, indicaciones..."
                        rows={2}
                        style={{ width:"100%",fontSize:13,borderRadius:10,resize:"none",padding:"8px 10px",boxSizing:"border-box",fontFamily:"inherit" }} />
                    </div>

                    {/* Round trip toggle */}
                    <div style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0" }}>
                      <button type="button" onClick={() => setIsRoundTrip(!isRoundTrip)}
                        style={{
                          width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",position:"relative",
                          background: isRoundTrip ? "#21D0B3" : "#cbd5e1",
                          transition:"background 0.2s",
                        }}>
                        <span style={{
                          position:"absolute",top:2,left: isRoundTrip ? 22 : 2,
                          width:20,height:20,borderRadius:10,background:"#fff",
                          boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s",
                        }} />
                      </button>
                      <span style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>Ida y vuelta</span>
                    </div>

                    {isRoundTrip && (
                      <div style={{ display:"flex",flexDirection:"column",gap:10,padding:"10px 12px",borderRadius:12,background:"#f0fdfa",border:"1px solid #99f6e4" }}>
                        <p style={{ fontSize:12,fontWeight:700,color:"#0a7a6b",margin:0 }}>Datos del regreso</p>
                        <div>
                          <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Fecha y hora de regreso</label>
                          <input className="input" type="datetime-local" value={returnTime}
                            onChange={(e) => setReturnTime(e.target.value)}
                            style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Destino de regreso (opcional)</label>
                          <select className="input" value={returnVenueId} onChange={(e) => setReturnVenueId(e.target.value)}
                            style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }}>
                            <option value="">Volver a dirección de recogida</option>
                            {venues.map((venue) => (
                              <option key={venue.id} value={venue.id}>
                                {venue.name}{venue.address ? ` — ${venue.address}` : ""}
                              </option>
                            ))}
                          </select>
                          <p style={{ fontSize:10.5,color:"#64748b",margin:"4px 0 0" }}>
                            Si no seleccionas una sede, el regreso será a tu dirección de recogida.
                          </p>
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={submitting}
                      style={{
                        width:"100%",height:42,borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",
                        background: submitting ? "#e2e8f0" : "linear-gradient(135deg,#21D0B3,#14AE98)",
                        color: submitting ? "#94a3b8" : "#fff",
                        boxShadow: submitting ? "none" : "0 2px 10px rgba(33,208,179,0.3)",
                      }}>
                      {submitting
                        ? (editingTripId ? "Guardando..." : "Enviando...")
                        : (editingTripId ? "Guardar cambios" : "Enviar solicitud")}
                    </button>
                    {editingTripId && (
                      <button type="button" onClick={resetRequestForm}
                        style={{ width:"100%",height:38,borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
              </section>
              </section>
            )}

            {/* ═══════════════════ ACTIVIDADES TAB ═══════════════════ */}
            {activeTab === "actividades" && (
              <section style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Mis viajes</p>

                {/* Sub-tabs */}
                <div style={{ display:"flex",gap:0,background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden" }}>
                  {([
                    { key: "en_curso" as ActividadesSubTab, label: "En curso", count: enCursoTrips.length },
                    { key: "historial" as ActividadesSubTab, label: "Historial", count: historialTrips.length },
                    { key: "pendientes" as ActividadesSubTab, label: "Pendientes", count: pendientesTrips.length },
                  ]).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => { setActividadesSubTab(st.key); setExpandedTripId(null); }}
                      style={{
                        flex:1,padding:"10px 4px",border:"none",cursor:"pointer",fontSize:12,fontWeight:actividadesSubTab === st.key ? 700 : 500,
                        background: actividadesSubTab === st.key ? "rgba(33,208,179,0.1)" : "transparent",
                        color: actividadesSubTab === st.key ? "#0a7a6b" : "#64748b",
                        borderBottom: actividadesSubTab === st.key ? "2px solid #21D0B3" : "2px solid transparent",
                      }}
                    >
                      {st.label} {st.count > 0 && <span style={{ fontSize:10,fontWeight:700,background:actividadesSubTab === st.key ? "#21D0B3" : "#e2e8f0",color:actividadesSubTab === st.key ? "#fff" : "#64748b",borderRadius:10,padding:"1px 6px",marginLeft:3 }}>{st.count}</span>}
                    </button>
                  ))}
                </div>

                {/* En curso */}
                {actividadesSubTab === "en_curso" && (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {enCursoTrips.length === 0 ? (
                      <div style={{ textAlign:"center",padding:"28px 16px",borderRadius:16,border:"1px dashed rgba(33,208,179,0.3)",background:"#fafcfb" }}>
                        <p style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>Sin viajes en curso</p>
                        <p style={{ fontSize:12.5,color:"#64748b",margin:0 }}>Los viajes activos apareceran aqui.</p>
                      </div>
                    ) : enCursoTrips.map(renderTripCard)}
                  </div>
                )}

                {/* Historial */}
                {actividadesSubTab === "historial" && (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {historialTrips.length === 0 ? (
                      <div style={{ textAlign:"center",padding:"28px 16px",borderRadius:16,border:"1px dashed rgba(33,208,179,0.3)",background:"#fafcfb" }}>
                        <p style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>Sin viajes completados</p>
                        <p style={{ fontSize:12.5,color:"#64748b",margin:0 }}>Tu historial aparecera aqui.</p>
                      </div>
                    ) : historialTrips.map(renderTripCard)}
                  </div>
                )}

                {/* Pendientes */}
                {actividadesSubTab === "pendientes" && (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {pendientesTrips.length === 0 ? (
                      <div style={{ textAlign:"center",padding:"28px 16px",borderRadius:16,border:"1px dashed rgba(33,208,179,0.3)",background:"#fafcfb" }}>
                        <p style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>Sin solicitudes pendientes</p>
                        <p style={{ fontSize:12.5,color:"#64748b",margin:0 }}>Tus solicitudes pendientes apareceran aqui.</p>
                      </div>
                    ) : pendientesTrips.map(renderTripCard)}
                  </div>
                )}
              </section>
            )}

            {/* ═══════════════════ PREMIACIONES TAB ═══════════════════ */}
            {activeTab === "premiaciones" && (() => {
              const ROLE_META: Record<string, { label: string; color: string; bg: string; ring: string }> = {
                GOLD:      { label: "Medalla de Oro",   color: "#a87800", bg: "linear-gradient(135deg,#fff4d6 0%,#fde68a 100%)", ring: "#eab308" },
                SILVER:    { label: "Medalla de Plata", color: "#475569", bg: "linear-gradient(135deg,#f1f5f9 0%,#cbd5e1 100%)", ring: "#94a3b8" },
                BRONZE:    { label: "Medalla de Bronce",color: "#7c2d12", bg: "linear-gradient(135deg,#fed7aa 0%,#fdba74 100%)", ring: "#b45309" },
                AUTHORITY: { label: "Autoridad",        color: "#5b21b6", bg: "linear-gradient(135deg,#ede9fe 0%,#c4b5fd 100%)", ring: "#8b5cf6" },
                AWARDER:   { label: "Premiador",        color: "#0f766e", bg: "linear-gradient(135deg,#ccfbf1 0%,#5eead4 100%)", ring: "#14b8a6" },
              };
              const fmtKey = (iso?: string | null) => iso ? new Date(iso).toISOString().slice(0,10) : "";
              const fmtTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}) : "";
              const fmtDateLong = (key?: string | null) => {
                if (!key) return "";
                const d = new Date(key + "T00:00:00");
                return d.toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
              };
              const calY = premCalCursor.getFullYear();
              const calM = premCalCursor.getMonth();
              const monthLabel = premCalCursor.toLocaleDateString("es-CL",{month:"long",year:"numeric"});
              const firstDayOfMonth = new Date(calY, calM, 1).getDay();
              const daysInMonth = new Date(calY, calM + 1, 0).getDate();
              const offset = (firstDayOfMonth + 6) % 7;
              const calCells: (number | null)[] = Array(offset).fill(null);
              for (let dd = 1; dd <= daysInMonth; dd++) calCells.push(dd);
              while (calCells.length % 7 !== 0) calCells.push(null);
              const today = new Date();
              const isCurrentMonth = today.getFullYear() === calY && today.getMonth() === calM;
              const todayNum = isCurrentMonth ? today.getDate() : null;
              const calDayNames = ["L","M","M","J","V","S","D"];

              // Apply filters
              const visible = premiaciones.filter(p => {
                if (premStatusFilter && p.status !== premStatusFilter) return false;
                const role = (p.myAssignment?.role || "AWARDER").toUpperCase();
                if (premRoleFilter && role !== premRoleFilter) return false;
                if (premAttendanceFilter) {
                  const a = p.myAssignment;
                  const attendance = a?.confirmed_at ? "CONFIRMED" : a?.declined_at ? "DECLINED" : "PENDING";
                  if (premAttendanceFilter !== attendance) return false;
                }
                return true;
              });

              const totalProg = premiaciones.filter(p => p.status === "PROGRAMADA").length;
              const totalReal = premiaciones.filter(p => p.status === "REALIZADA").length;
              const countConfirmed = premiaciones.filter(p => p.myAssignment?.confirmed_at).length;
              const countPending = premiaciones.filter(p => p.myAssignment && !p.myAssignment.confirmed_at && !p.myAssignment.declined_at).length;
              const roleOptions = Array.from(new Set(premiaciones.map(p => (p.myAssignment?.role || "AWARDER").toUpperCase())));

              const itemsByDay = new Map<number, PremiacionVIP[]>();
              visible.forEach(p => {
                const d = new Date(p.scheduled_at);
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

              const grouped = new Map<string, PremiacionVIP[]>();
              visible.forEach(p => {
                const k = fmtKey(p.scheduled_at);
                if (!grouped.has(k)) grouped.set(k, []);
                grouped.get(k)!.push(p);
              });
              const days = Array.from(grouped.entries()).sort(([a],[b]) => a.localeCompare(b));

              const hasFilters = !!(premStatusFilter || premRoleFilter || premAttendanceFilter);
              const clearAll = () => { setPremStatusFilter(""); setPremRoleFilter(""); setPremAttendanceFilter(""); };

              const renderPremCard = (p: PremiacionVIP) => {
                const a = p.myAssignment;
                const role = (a?.role || "AWARDER").toUpperCase();
                const r = ROLE_META[role] || ROLE_META.AWARDER;
                const isDone = p.status === "REALIZADA";
                const attendance: "CONFIRMED" | "DECLINED" | "PENDING" = a?.confirmed_at ? "CONFIRMED" : a?.declined_at ? "DECLINED" : "PENDING";
                return (
                  <article key={p.id}
                    style={{ position:"relative",background:"#fff",border:"1px solid #e2e8f0",borderLeft:`4px solid ${r.ring}`,borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(15,23,42,0.06)",overflow:"hidden" }}>
                    {/* Decorative glow */}
                    <div style={{ position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:r.bg,opacity:0.25,pointerEvents:"none" }} />
                    <div style={{ position:"relative",display:"flex",alignItems:"flex-start",gap:12 }}>
                      <div style={{ width:42,height:42,borderRadius:12,flexShrink:0,background:r.bg,border:`1.5px solid ${r.ring}40`,display:"flex",alignItems:"center",justifyContent:"center",color:r.ring,boxShadow:`0 4px 12px ${r.ring}30` }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8 }}>
                          <p style={{ fontSize:14.5,fontWeight:800,color:"#0f172a",margin:0,lineHeight:1.3 }}>{p.title}</p>
                          <span style={{ flexShrink:0,display:"inline-flex",alignItems:"center",gap:4,fontSize:10,padding:"3px 9px",borderRadius:99,background:r.bg,color:r.color,fontWeight:800,letterSpacing:"0.02em",border:`1px solid ${r.ring}40` }}>{r.label}</span>
                        </div>
                        {p.discipline && <p style={{ fontSize:11.5,color:"#0ea5c8",margin:"2px 0 0",fontWeight:600 }}>{p.discipline}</p>}
                        <div style={{ display:"flex",flexWrap:"wrap",gap:"4px 12px",marginTop:6 }}>
                          <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11.5,color:"#334155",fontWeight:600 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {fmtTime(p.scheduled_at)}
                          </span>
                          {(p.venue_name || p.location_detail) && (
                            <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"#64748b" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              {[p.venue_name, p.location_detail].filter(Boolean).join(" — ")}
                            </span>
                          )}
                          <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:99,letterSpacing:"0.06em",textTransform:"uppercase",
                            background:isDone?"#e7f5ec":"#fff4d6",color:isDone?"#1e5125":"#7a4a00",border:`1px solid ${isDone?"#2e7d3233":"#c78c0033"}` }}>
                            <span style={{ width:5,height:5,borderRadius:"50%",background:isDone?"#2e7d32":"#c78c00",animation:isDone?"none":"pulse 1.8s infinite" }} />
                            {isDone?"Realizada":"Programada"}
                          </span>
                        </div>
                        {p.notes && <p style={{ margin:"8px 0 0",fontSize:11.5,color:"#64748b",fontStyle:"italic",lineHeight:1.45,padding:"6px 10px",background:"#f8fafc",borderRadius:8,borderLeft:"2px solid #cbd5e1" }}>{p.notes}</p>}
                      </div>
                    </div>
                    {/* Attendance row */}
                    {a && (
                      <div style={{ position:"relative",marginTop:12,paddingTop:10,borderTop:"1px dashed #e2e8f0" }}>
                        {attendance === "CONFIRMED" ? (
                          <div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:99,background:"linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%)",color:"#166534",fontSize:11.5,fontWeight:800,border:"1px solid #86efac" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Asistencia confirmada
                          </div>
                        ) : attendance === "DECLINED" ? (
                          <div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:99,background:"#fee2e2",color:"#991b1b",fontSize:11.5,fontWeight:800,border:"1px solid #fca5a5" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Declinaste
                          </div>
                        ) : (
                          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                            <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"#a87800" }}>Confirmá tu asistencia</span>
                            <div style={{ display:"flex",gap:6,marginLeft:"auto" }}>
                              <button type="button" onClick={() => confirmAwarder(p.id, a.id, "CONFIRM")}
                                style={{ padding:"7px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#10b981 0%,#059669 100%)",color:"#fff",fontSize:11.5,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 8px rgba(16,185,129,0.3)",display:"inline-flex",alignItems:"center",gap:5 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Confirmar
                              </button>
                              <button type="button" onClick={() => confirmAwarder(p.id, a.id, "DECLINE")}
                                style={{ padding:"7px 14px",borderRadius:10,border:"1px solid #fca5a5",background:"#fff",color:"#b91c1c",fontSize:11.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5 }}>
                                Declinar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              };

              return (
                <section style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {/* Premium header with stats */}
                  <div style={{ position:"relative",background:"linear-gradient(135deg,#fffbf2 0%,#fff4d6 50%,#ffffff 100%)",borderRadius:16,border:"1px solid #f0deb0",padding:"14px 16px",overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"radial-gradient(circle,rgba(245,200,66,0.25),transparent 70%)",pointerEvents:"none" }} />
                    <div style={{ position:"relative",display:"flex",alignItems:"center",gap:12 }}>
                      <div style={{ width:46,height:46,borderRadius:13,background:"linear-gradient(135deg,#d4a017 0%,#f5c842 50%,#e3a808 100%)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0,boxShadow:"0 6px 16px rgba(199,140,0,0.4)" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:10,fontWeight:800,letterSpacing:"0.2em",textTransform:"uppercase",color:"#a87800",margin:0 }}>Tus premiaciones</p>
                        <p style={{ fontSize:14,color:"#7a4a00",margin:"2px 0 0",fontWeight:700 }}>{premiaciones.length} asignacion{premiaciones.length===1?"":"es"}</p>
                      </div>
                    </div>
                    {premiaciones.length > 0 && (
                      <div style={{ position:"relative",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:12 }}>
                        {[
                          { label:"Programadas", value:totalProg, color:"#c78c00", bg:"#fff4d6" },
                          { label:"Realizadas",  value:totalReal, color:"#1e5125", bg:"#e7f5ec" },
                          { label:"Confirmadas", value:countConfirmed, color:"#166534", bg:"#dcfce7" },
                          { label:"Pendientes",  value:countPending, color:"#9a3412", bg:"#fed7aa" },
                        ].map(s => (
                          <div key={s.label} style={{ background:s.bg,borderRadius:10,padding:"8px 6px",textAlign:"center",border:`1px solid ${s.color}22` }}>
                            <p style={{ fontSize:18,fontWeight:900,color:s.color,margin:0,lineHeight:1 }}>{s.value}</p>
                            <p style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:s.color,margin:"3px 0 0",opacity:0.85 }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {premiaciones.length === 0 ? (
                    <div style={{ textAlign:"center",padding:"36px 20px",borderRadius:16,border:"1px dashed #f0deb0",background:"linear-gradient(135deg,#fffbf2 0%,#ffffff 100%)" }}>
                      <p style={{ fontSize:36,margin:"0 0 8px" }}>🏆</p>
                      <p style={{ fontSize:14,fontWeight:800,color:"#7a4a00",margin:"0 0 4px" }}>Sin premiaciones asignadas</p>
                      <p style={{ fontSize:12,color:"#a87800",margin:0 }}>Cuando te designemos como premiador de una ceremonia aparecerá aquí.</p>
                    </div>
                  ) : (
                    <>
                      {/* View toggle + filters */}
                      <div style={{ background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",padding:"10px",display:"flex",flexDirection:"column",gap:8 }}>
                        <div style={{ display:"flex",gap:0,background:"#f1f5f9",borderRadius:10,padding:3 }}>
                          {([
                            { v:"calendar" as const, label:"Calendario", icon:(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>)},
                            { v:"list" as const, label:"Lista", icon:(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)},
                          ]).map(opt => {
                            const active = premView === opt.v;
                            return (
                              <button key={opt.v} type="button" onClick={() => setPremView(opt.v)}
                                style={{ flex:1,padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",
                                  background:active ? "#fff" : "transparent",
                                  color:active ? "#7a4a00" : "#64748b",
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
                        {/* Status chips */}
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          {([
                            { v:"" as const, label:"Estado", count:premiaciones.length },
                            { v:"PROGRAMADA" as const, label:"Prog.", count:totalProg },
                            { v:"REALIZADA" as const, label:"Real.", count:totalReal },
                          ]).map(opt => {
                            const active = premStatusFilter === opt.v;
                            const isDone = opt.v === "REALIZADA";
                            const isProg = opt.v === "PROGRAMADA";
                            return (
                              <button key={opt.v||"all-st"} type="button" onClick={() => setPremStatusFilter(opt.v)}
                                style={{ padding:"5px 10px",borderRadius:20,border:active ? `1px solid ${isDone?"#2e7d32":isProg?"#c78c00":"#21D0B3"}` : "1px solid #e2e8f0",
                                  background:active ? (isDone?"#e7f5ec":isProg?"#fff4d6":"rgba(33,208,179,0.12)") : "#fff",
                                  color:active ? (isDone?"#1e5125":isProg?"#7a4a00":"#0a7a6b") : "#475569",
                                  fontSize:10.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5 }}>
                                {opt.label} <span style={{ fontSize:9,padding:"1px 5px",borderRadius:10,background:active?"rgba(255,255,255,0.6)":"#f1f5f9",color:active ? (isDone?"#1e5125":isProg?"#7a4a00":"#0a7a6b") : "#64748b" }}>{opt.count}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Attendance chips */}
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          {([
                            { v:"" as const, label:"Asistencia", count:premiaciones.length },
                            { v:"CONFIRMED" as const, label:"Confirmadas", count:countConfirmed },
                            { v:"PENDING" as const, label:"Pendientes", count:countPending },
                            { v:"DECLINED" as const, label:"Declinadas", count:premiaciones.filter(p => p.myAssignment?.declined_at).length },
                          ]).map(opt => {
                            const active = premAttendanceFilter === opt.v;
                            const cMap: Record<string, [string,string,string]> = {
                              CONFIRMED: ["#dcfce7","#166534","#86efac"],
                              PENDING:   ["#fed7aa","#9a3412","#fdba74"],
                              DECLINED:  ["#fee2e2","#991b1b","#fca5a5"],
                            };
                            const [bg,fg,br] = cMap[opt.v] || ["rgba(33,208,179,0.12)","#0a7a6b","#21D0B3"];
                            return (
                              <button key={opt.v||"all-at"} type="button" onClick={() => setPremAttendanceFilter(opt.v)}
                                style={{ padding:"5px 10px",borderRadius:20,border:active ? `1px solid ${br}` : "1px solid #e2e8f0",
                                  background:active ? bg : "#fff",
                                  color:active ? fg : "#475569",
                                  fontSize:10.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5 }}>
                                {opt.label} <span style={{ fontSize:9,padding:"1px 5px",borderRadius:10,background:active?"rgba(255,255,255,0.6)":"#f1f5f9",color:active ? fg : "#64748b" }}>{opt.count}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Role filter */}
                        {roleOptions.length > 1 && (
                          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                            {[{ v:"", label:"Todos los roles" } as { v:string; label:string }, ...roleOptions.map(r => ({ v:r, label:(ROLE_META[r]||ROLE_META.AWARDER).label }))].map(opt => {
                              const active = premRoleFilter === opt.v;
                              const meta = opt.v ? (ROLE_META[opt.v]||ROLE_META.AWARDER) : null;
                              return (
                                <button key={opt.v||"all-r"} type="button" onClick={() => setPremRoleFilter(opt.v)}
                                  style={{ padding:"5px 10px",borderRadius:20,border:active && meta ? `1px solid ${meta.ring}` : "1px solid #e2e8f0",
                                    background:active && meta ? meta.bg : active ? "rgba(33,208,179,0.12)" : "#fff",
                                    color:active && meta ? meta.color : active ? "#0a7a6b" : "#475569",
                                    fontSize:10.5,fontWeight:700,cursor:"pointer" }}>
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {hasFilters && (
                          <button type="button" onClick={clearAll}
                            style={{ alignSelf:"flex-start",padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#b91c1c",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                            Limpiar filtros
                          </button>
                        )}
                      </div>

                      {/* Calendar view */}
                      {premView === "calendar" && (
                        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                          <div style={{ background:"#fff",borderRadius:14,border:"1px solid #f0deb0",padding:"12px",boxShadow:"0 1px 3px rgba(199,140,0,0.06)" }}>
                            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                              <button type="button" onClick={() => { setPremCalCursor(new Date(calY, calM - 1, 1)); setPremCalSelectedKey(null); }}
                                style={{ width:30,height:30,borderRadius:8,border:"1px solid #f0deb0",background:"#fffbf2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a87800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                              </button>
                              <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
                                <span style={{ fontSize:14,fontWeight:800,color:"#7a4a00",textTransform:"capitalize",letterSpacing:"-0.01em" }}>{monthLabel}</span>
                                <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#c78c00",marginTop:2 }}>{itemsByDay.size} día{itemsByDay.size===1?"":"s"} con premiaciones</span>
                              </div>
                              <button type="button" onClick={() => { setPremCalCursor(new Date(calY, calM + 1, 1)); setPremCalSelectedKey(null); }}
                                style={{ width:30,height:30,borderRadius:8,border:"1px solid #f0deb0",background:"#fffbf2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a87800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,textAlign:"center" }}>
                              {calDayNames.map((dn,i) => <div key={i} style={{ fontSize:9,fontWeight:800,color:"#94a3b8",letterSpacing:"0.1em",padding:"4px 0" }}>{dn}</div>)}
                              {calCells.map((dn,i) => {
                                if (!dn) return <div key={`empty-${i}`} />;
                                const dayKey = `${calY}-${String(calM+1).padStart(2,"0")}-${String(dn).padStart(2,"0")}`;
                                const dayItems = itemsByDay.get(dn) || [];
                                const hasItems = dayItems.length > 0;
                                const isSelected = premCalSelectedKey === dayKey;
                                const isToday = todayNum === dn;
                                const anyConfirmed = dayItems.some(p => p.myAssignment?.confirmed_at);
                                const anyPending = dayItems.some(p => p.myAssignment && !p.myAssignment.confirmed_at && !p.myAssignment.declined_at);
                                return (
                                  <button key={dayKey} type="button" onClick={() => setPremCalSelectedKey(isSelected ? null : dayKey)}
                                    style={{ aspectRatio:"1",borderRadius:8,border:isSelected ? "2px solid #d4a017" : isToday ? "1.5px solid #d4a017" : "1px solid transparent",
                                      background:isSelected ? "linear-gradient(135deg,#d4a017 0%,#f5c842 100%)"
                                        : hasItems ? "linear-gradient(135deg,#fff4d6 0%,#fffbf2 100%)"
                                        : "#fff",
                                      color:isSelected ? "#fff" : isToday ? "#7a4a00" : "#0f172a",
                                      fontSize:12,fontWeight:isSelected||isToday?800:hasItems?700:500,cursor:"pointer",position:"relative",
                                      boxShadow:isSelected ? "0 3px 8px rgba(199,140,0,0.35)" : hasItems ? "0 1px 2px rgba(199,140,0,0.1)" : "none",
                                      transition:"all .15s",padding:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2 }}>
                                    <span>{dn}</span>
                                    {hasItems && !isSelected && (
                                      <div style={{ display:"flex",gap:2,alignItems:"center" }}>
                                        {anyPending && <span style={{ width:4,height:4,borderRadius:"50%",background:"#c78c00" }} />}
                                        {anyConfirmed && <span style={{ width:4,height:4,borderRadius:"50%",background:"#10b981" }} />}
                                        {dayItems.length > 2 && <span style={{ fontSize:8,fontWeight:800,color:"#c78c00",marginLeft:1 }}>+{dayItems.length-2}</span>}
                                      </div>
                                    )}
                                    {isSelected && hasItems && (
                                      <span style={{ fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:8,background:"rgba(255,255,255,0.3)",color:"#fff" }}>{dayItems.length}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ display:"flex",alignItems:"center",gap:14,marginTop:10,paddingTop:10,borderTop:"1px dashed #f0deb0",justifyContent:"center" }}>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:"#7a4a00",fontWeight:600 }}>
                                <span style={{ width:6,height:6,borderRadius:"50%",background:"#c78c00" }} />Pendiente
                              </span>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:"#166534",fontWeight:600 }}>
                                <span style={{ width:6,height:6,borderRadius:"50%",background:"#10b981" }} />Confirmada
                              </span>
                              {todayNum && (
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:"#7a4a00",fontWeight:600 }}>
                                  <span style={{ width:8,height:8,borderRadius:4,border:"1.5px solid #d4a017",background:"#fff" }} />Hoy
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedDayNum ? (
                            selectedItems.length > 0 ? (
                              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                                <div style={{ padding:"6px 10px",borderRadius:10,background:"linear-gradient(135deg,#fff4d6 0%,#fffbf2 100%)",display:"flex",alignItems:"center",gap:8,border:"1px solid #f0deb0" }}>
                                  <div style={{ width:6,height:6,borderRadius:"50%",background:"#d4a017",boxShadow:"0 0 6px #d4a017" }} />
                                  <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#7a4a00",margin:0 }}>{fmtDateLong(premCalSelectedKey!)}</p>
                                  <span style={{ marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#fff",color:"#a87800",border:"1px solid #f0deb0" }}>{selectedItems.length}</span>
                                </div>
                                {selectedItems.map(renderPremCard)}
                              </div>
                            ) : (
                              <div style={{ background:"#fff",borderRadius:14,border:"1px dashed #e2e8f0",padding:"20px",textAlign:"center" }}>
                                <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>Sin premiaciones este día</p>
                              </div>
                            )
                          ) : (
                            <div style={{ background:"#fff",borderRadius:14,border:"1px dashed #e2e8f0",padding:"20px",textAlign:"center" }}>
                              <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>Seleccioná un día para ver tus premiaciones</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* List view */}
                      {premView === "list" && (
                        visible.length === 0 ? (
                          <div style={{ background:"#fff",borderRadius:14,border:"1px dashed #e2e8f0",padding:"28px 20px",textAlign:"center" }}>
                            <p style={{ fontSize:32,margin:"0 0 8px" }}>🔍</p>
                            <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>No hay premiaciones con esos filtros</p>
                          </div>
                        ) : (
                          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                            {days.map(([day, items]) => (
                              <div key={day} style={{ display:"flex",flexDirection:"column",gap:6 }}>
                                <div style={{ position:"sticky",top:0,zIndex:2,background:"linear-gradient(180deg,#f8fafc 0%,rgba(248,250,252,0.92) 100%)",backdropFilter:"blur(6px)",padding:"6px 10px",borderRadius:10,display:"flex",alignItems:"center",gap:8,border:"1px solid #e2e8f0" }}>
                                  <div style={{ width:6,height:6,borderRadius:"50%",background:"#d4a017",boxShadow:"0 0 6px #d4a017" }} />
                                  <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#7a4a00",margin:0 }}>{fmtDateLong(day)}</p>
                                  <span style={{ marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#fff",color:"#a87800",border:"1px solid #f0deb0" }}>{items.length}</span>
                                </div>
                                {items.map(renderPremCard)}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  )}
                </section>
              );
            })()}

            {/* ═══════════════════ CUPONES TAB ═══════════════════ */}
            {activeTab === "cupones" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {/* Sub-tabs */}
                <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:4,display:"flex",gap:4,boxShadow:"0 1px 4px rgba(15,23,42,0.05)" }}>
                  <button type="button" onClick={() => setCouponTab("available")}
                    style={{ flex:1,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,letterSpacing:"0.01em",
                      background:couponTab==="available"?"linear-gradient(135deg,#21D0B3 0%,#15B09A 100%)":"transparent",
                      color:couponTab==="available"?"#fff":"#64748b",
                      boxShadow:couponTab==="available"?"0 4px 14px rgba(33,208,179,0.32)":"none",
                      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                    Disponibles
                    <span style={{ fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:800,
                      background:couponTab==="available"?"rgba(255,255,255,0.25)":"#f1f5f9",
                      color:couponTab==="available"?"#fff":"#64748b" }}>
                      {visibleCouponsAvailable.filter(c => !c._exhausted).length}
                    </span>
                  </button>
                  <button type="button" onClick={() => setCouponTab("mine")}
                    style={{ flex:1,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,
                      background:couponTab==="mine"?"linear-gradient(135deg,#21D0B3 0%,#15B09A 100%)":"transparent",
                      color:couponTab==="mine"?"#fff":"#64748b",
                      boxShadow:couponTab==="mine"?"0 4px 14px rgba(33,208,179,0.32)":"none",
                      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                    Mis cupones
                    <span style={{ fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:800,
                      background:couponTab==="mine"?"rgba(255,255,255,0.25)":"#f1f5f9",
                      color:couponTab==="mine"?"#fff":"#64748b" }}>
                      {couponClaims.filter(m => m.status === "CLAIMED").length}
                    </span>
                  </button>
                </div>

                {couponError && (
                  <div style={{ borderRadius:14,padding:"10px 14px",background:"#fde2e2",border:"1px solid #fca5a5",color:"#7a1313",fontSize:13 }}>
                    {couponError}
                  </div>
                )}

                {couponTab === "available" ? (
                  visibleCouponsAvailable.length === 0 ? (
                    <div style={{ padding:24,textAlign:"center",background:"#fff",borderRadius:14,border:"1px solid #e2e8f0" }}>
                      <p style={{ fontSize:32,margin:"0 0 8px" }}>🎟️</p>
                      <p style={{ fontSize:14,fontWeight:600,color:"#0f172a",margin:0 }}>No hay cupones disponibles</p>
                      <p style={{ fontSize:12,color:"#94a3b8",margin:"6px 0 0" }}>Volvé a chequear más tarde, vamos a estar agregando beneficios.</p>
                    </div>
                  ) : (
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12 }}>
                      {visibleCouponsAvailable.map((c) => {
                        const cat = COUPON_CATEGORIES[c.category] || COUPON_CATEGORIES.OTHER;
                        const exhausted = c._exhausted;
                        return (
                          <article key={c.id}
                            style={{ background:"#fff",borderRadius:18,overflow:"hidden",border:"1px solid rgba(15,23,42,0.06)",
                              boxShadow: exhausted ? "0 1px 4px rgba(15,23,42,0.06)" : "0 4px 16px rgba(15,23,42,0.08)",
                              opacity: exhausted ? 0.6 : 1 }}>
                            <div style={{ position:"relative",width:"100%",aspectRatio:"16/9",background:`linear-gradient(135deg, ${cat.color}30 0%, ${cat.color}60 100%)` }}>
                              {c.imageUrl && (
                                <img src={c.imageUrl} alt={c.title} loading="lazy"
                                  style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover" }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                              )}
                              <div style={{ position:"absolute",inset:0,pointerEvents:"none",background:"linear-gradient(to top, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.2) 35%, transparent 60%)" }} />
                              <span style={{ position:"absolute",top:10,left:10,display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.92)",color:cat.color,padding:"3px 9px",borderRadius:99,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",boxShadow:"0 2px 6px rgba(0,0,0,0.12)" }}>
                                <span style={{ width:5,height:5,borderRadius:"50%",background:cat.color }} />
                                {cat.label}
                              </span>
                              <div style={{ position:"absolute",top:10,right:10,background:`linear-gradient(135deg, ${cat.color} 0%, ${cat.color}d0 100%)`,color:"#fff",padding:"6px 12px",borderRadius:14,fontSize:15,fontWeight:800,boxShadow:`0 6px 18px ${cat.color}66` }}>
                                {couponDiscountDisplay(c)}
                              </div>
                              {c.partnerName && (
                                <div style={{ position:"absolute",bottom:10,left:10,right:10,display:"flex",alignItems:"center",gap:8 }}>
                                  {c.partnerLogoUrl ? (
                                    <img src={c.partnerLogoUrl} alt={c.partnerName} loading="lazy"
                                      style={{ width:28,height:28,borderRadius:"50%",background:"#fff",padding:2,border:"2px solid rgba(255,255,255,0.95)",boxShadow:"0 3px 8px rgba(0,0,0,0.22)",objectFit:"contain" }}
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                  ) : (
                                    <div style={{ width:28,height:28,borderRadius:"50%",background:"#fff",color:cat.color,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.95)",boxShadow:"0 3px 8px rgba(0,0,0,0.22)" }}>
                                      {c.partnerName.slice(0,2).toUpperCase()}
                                    </div>
                                  )}
                                  <span style={{ color:"#fff",fontWeight:700,fontSize:13,textShadow:"0 1px 3px rgba(0,0,0,0.55)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                    {c.partnerName}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div style={{ padding:"12px 14px 4px" }}>
                              <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0,lineHeight:1.25 }}>{c.title}</p>
                              {c.description && (
                                <p style={{ fontSize:11.5,color:"#64748b",margin:"6px 0 0",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" as any,overflow:"hidden" }}>
                                  {c.description}
                                </p>
                              )}
                              <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
                                {c.validUntil && (
                                  <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,color:"#64748b",fontWeight:500 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    Hasta {fmtCouponDate(c.validUntil)}
                                  </span>
                                )}
                                {c.partnerAddress && (
                                  <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,color:"#64748b",fontWeight:500,maxWidth:170,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {c.partnerAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button type="button" disabled={exhausted || couponClaiming === c.id} onClick={() => claimCoupon(c.id)}
                              style={{ width:"100%",marginTop:10,padding:"12px 0",border:"none",fontSize:13,fontWeight:800,color:"#fff",
                                background: exhausted ? "linear-gradient(135deg,#94a3b8 0%,#64748b 100%)" : `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
                                cursor: exhausted ? "not-allowed" : "pointer",letterSpacing:"0.02em",
                                display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                              {exhausted ? (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                  Ya lo reclamaste
                                </>
                              ) : couponClaiming === c.id ? (
                                <>Reclamando…</>
                              ) : (
                                <>
                                  Reclamar cupón
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </>
                              )}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )
                ) : couponClaims.length === 0 ? (
                  <div style={{ padding:24,textAlign:"center",background:"#fff",borderRadius:14,border:"1px solid #e2e8f0" }}>
                    <p style={{ fontSize:32,margin:"0 0 8px" }}>🎟️</p>
                    <p style={{ fontSize:14,fontWeight:600,color:"#0f172a",margin:0 }}>Todavía no reclamaste ningún cupón</p>
                    <p style={{ fontSize:12,color:"#94a3b8",margin:"6px 0 0" }}>Andá a la pestaña Disponibles y reclamá los que quieras.</p>
                  </div>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {couponClaims.map((c) => {
                      const coupon = c.coupon;
                      const cat = coupon ? (COUPON_CATEGORIES[coupon.category] || COUPON_CATEGORIES.OTHER) : COUPON_CATEGORIES.OTHER;
                      const statusMeta = COUPON_STATUS_META[c.status];
                      return (
                        <article key={c.id} style={{ background:"#fff",borderRadius:14,overflow:"hidden",border:"1px solid #e2e8f0",borderLeft:`5px solid ${cat.color}` }}>
                          <button type="button" onClick={() => c.status === "CLAIMED" && setActiveClaim(c)}
                            style={{ width:"100%",textAlign:"left",padding:"12px 14px",background:"none",border:"none",cursor: c.status === "CLAIMED" ? "pointer" : "default" }}>
                            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                                  <span style={{ fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:700,background:statusMeta.bg,color:statusMeta.color }}>
                                    {statusMeta.label}
                                  </span>
                                  {coupon?.partnerName && (
                                    <span style={{ fontSize:11,color:"#64748b" }}>{coupon.partnerName}</span>
                                  )}
                                </div>
                                <p style={{ fontSize:13.5,fontWeight:700,color:"#0f172a",margin:0,lineHeight:1.25 }}>{coupon?.title || "Cupón"}</p>
                                <p style={{ fontSize:11,fontFamily:"ui-monospace, SFMono-Regular, monospace",color:"#64748b",margin:"4px 0 0",letterSpacing:"0.04em" }}>
                                  {c.uniqueCode}
                                </p>
                              </div>
                              <div style={{ textAlign:"right",flexShrink:0 }}>
                                <p style={{ fontSize:18,fontWeight:800,color:cat.color,margin:0 }}>
                                  {coupon ? couponDiscountDisplay(coupon) : "—"}
                                </p>
                                {c.status === "CLAIMED" && (
                                  <p style={{ fontSize:10.5,fontWeight:600,color:"#c78c00",margin:"2px 0 0" }}>
                                    Expira en {couponTimeLeft(c.expiresAt)}
                                  </p>
                                )}
                                {c.status === "REDEEMED" && c.redeemedAt && (
                                  <p style={{ fontSize:10.5,color:"#64748b",margin:"2px 0 0" }}>
                                    Canjeado {fmtCouponDate(c.redeemedAt)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {c.status === "CLAIMED" && (
                              <p style={{ fontSize:11,fontWeight:600,color:"#1f4e8c",margin:"8px 0 0" }}>Tocá para mostrar el QR</p>
                            )}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════ SEDES TAB ═══════════════════ */}
            {activeTab === "sedes" && (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Sedes del evento</p>
                {venues.map(v => {
                  const isOpen = expandedItemId === `venue-${v.id}`;
                  return (
                    <div key={v.id} style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isOpen ? null : `venue-${v.id}`)}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0 }}>{v.name}</p>
                          {v.address && <p style={{ fontSize:12,color:"#64748b",margin:"2px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.address}</p>}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"rotate(0)" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                          {v.photoUrl && (
                            <img src={v.photoUrl} alt={v.name || "Sede"} style={{ width:"100%",height:140,objectFit:"cover",borderRadius:10 }} />
                          )}
                          {v.address && (
                            <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                              <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Direccion</p>
                              <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{v.address}</p>
                            </div>
                          )}
                          {(v.commune || v.region) && (
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                              {v.commune && (
                                <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                  <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Comuna</p>
                                  <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{v.commune}</p>
                                </div>
                              )}
                              {v.region && (
                                <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                  <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Region</p>
                                  <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{v.region}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {renderMapEmbed(v.address, v.commune)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {venues.length === 0 && <p style={{ fontSize:13,color:"#94a3b8",textAlign:"center",padding:20 }}>No hay sedes registradas</p>}
              </div>
            )}

            {/* ═══════════════════ HOTELES TAB ═══════════════════ */}
            {activeTab === "hoteles" && (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Alojamientos</p>
                {accommodations.map(acc => {
                  const isOpen = expandedItemId === `acc-${acc.id}`;
                  return (
                    <div key={acc.id} style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isOpen ? null : `acc-${acc.id}`)}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                          <path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/>
                        </svg>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0 }}>{acc.name || "Hotel"}</p>
                          {acc.city && <p style={{ fontSize:12,color:"#64748b",margin:"2px 0 0" }}>{[acc.city, acc.country].filter(Boolean).join(", ")}</p>}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"rotate(0)" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                          {acc.address && (
                            <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                              <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Direccion</p>
                              <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{acc.address}</p>
                            </div>
                          )}
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                            {acc.city && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Ciudad</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{acc.city}</p>
                              </div>
                            )}
                            {acc.country && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Pais</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{acc.country}</p>
                              </div>
                            )}
                            {acc.checkIn && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Check-in</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{formatDateTime(acc.checkIn)}</p>
                              </div>
                            )}
                            {acc.checkOut && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Check-out</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{formatDateTime(acc.checkOut)}</p>
                              </div>
                            )}
                            {acc.roomType && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Habitacion</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{acc.roomType}</p>
                              </div>
                            )}
                            {acc.contactPhone && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Telefono</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{acc.contactPhone}</p>
                              </div>
                            )}
                          </div>
                          {renderMapEmbed(acc.address, acc.city)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {accommodations.length === 0 && <p style={{ fontSize:13,color:"#94a3b8",textAlign:"center",padding:20 }}>No hay alojamientos registrados</p>}
              </div>
            )}

            {/* ═══════════════════ ALIMENTACIÓN TAB ═══════════════════ */}
            {activeTab === "alimentacion" && (
              <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                {/* Today's menu */}
                {(() => {
                  const today = new Date().toISOString().slice(0,10);
                  const todayMenus = foodMenus.filter(fm => fm.date === today);
                  const mealOrder = ["DESAYUNO","ALMUERZO","CENA","ONCE"];
                  const sorted = todayMenus.sort((a,b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType));
                  const mealStyle = (type: string) => {
                    if (type === "DESAYUNO") return { bg:"#FEF3C7", color:"#92400E", border:"#FDE68A", icon:"☀️", label:"Desayuno" };
                    if (type === "ALMUERZO") return { bg:"#DBEAFE", color:"#1E40AF", border:"#BFDBFE", icon:"🍽️", label:"Almuerzo" };
                    if (type === "CENA") return { bg:"#E0E7FF", color:"#3730A3", border:"#C7D2FE", icon:"🌙", label:"Cena" };
                    return { bg:"#F1F5F9", color:"#475569", border:"#E2E8F0", icon:"🍴", label:type };
                  };
                  return (
                    <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)" }}>
                      <div style={{ padding:"14px 16px",background:"linear-gradient(135deg,rgba(33,208,179,0.08),rgba(33,208,179,0.02))",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <div style={{ width:32,height:32,borderRadius:10,background:"rgba(33,208,179,0.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                          </div>
                          <div>
                            <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0 }}>Menú de hoy</p>
                            <p style={{ fontSize:11,color:"#64748b",margin:0,textTransform:"capitalize" }}>{new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</p>
                          </div>
                        </div>
                      </div>
                      {sorted.length > 0 ? sorted.map((fm, i) => {
                        const m = mealStyle(fm.mealType);
                        return (
                          <div key={fm.id} style={{ padding:"14px 16px",borderTop:i>0?"1px solid #f1f5f9":"none",display:"flex",gap:12,alignItems:"flex-start" }}>
                            <div style={{ width:40,height:40,borderRadius:10,background:m.bg,border:`1px solid ${m.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{m.icon}</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                                <span style={{ fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6,textTransform:"uppercase",letterSpacing:"0.05em",background:m.bg,color:m.color }}>{m.label}</span>
                                {fm.dietaryType && fm.dietaryType !== "ESTANDAR" && (
                                  <span style={{ fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:6,background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0" }}>{fm.dietaryType}</span>
                                )}
                              </div>
                              <p style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"5px 0 0" }}>{fm.title}</p>
                              {fm.description && <p style={{ fontSize:12,color:"#64748b",margin:"3px 0 0",lineHeight:1.4 }}>{fm.description}</p>}
                            </div>
                          </div>
                        );
                      }) : (
                        <div style={{ padding:20,textAlign:"center" }}>
                          <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>No hay menú programado para hoy</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Tomorrow's menu */}
                {(() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const tKey = tomorrow.toISOString().slice(0,10);
                  const tMenus = foodMenus.filter(fm => fm.date === tKey);
                  const mealOrder = ["DESAYUNO","ALMUERZO","CENA","ONCE"];
                  const sorted = tMenus.sort((a,b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType));
                  const mealStyle = (type: string) => {
                    if (type === "DESAYUNO") return { bg:"#FEF3C7", color:"#92400E", border:"#FDE68A", icon:"☀️", label:"Desayuno" };
                    if (type === "ALMUERZO") return { bg:"#DBEAFE", color:"#1E40AF", border:"#BFDBFE", icon:"🍽️", label:"Almuerzo" };
                    if (type === "CENA") return { bg:"#E0E7FF", color:"#3730A3", border:"#C7D2FE", icon:"🌙", label:"Cena" };
                    return { bg:"#F1F5F9", color:"#475569", border:"#E2E8F0", icon:"🍴", label:type };
                  };
                  return (
                    <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)",opacity:0.85 }}>
                      <div style={{ padding:"12px 16px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <div>
                          <p style={{ fontSize:13,fontWeight:700,color:"#0f172a",margin:0 }}>Menú de mañana</p>
                          <p style={{ fontSize:11,color:"#94a3b8",margin:0,textTransform:"capitalize" }}>{tomorrow.toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</p>
                        </div>
                      </div>
                      {sorted.length > 0 ? sorted.map((fm, i) => {
                        const m = mealStyle(fm.mealType);
                        return (
                          <div key={fm.id} style={{ padding:"12px 16px",borderTop:i>0?"1px solid #f1f5f9":"none",display:"flex",gap:12,alignItems:"flex-start" }}>
                            <div style={{ width:36,height:36,borderRadius:8,background:m.bg,border:`1px solid ${m.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>{m.icon}</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <span style={{ fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:6,textTransform:"uppercase",letterSpacing:"0.05em",background:m.bg,color:m.color }}>{m.label}</span>
                              <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:"4px 0 0" }}>{fm.title}</p>
                              {fm.description && <p style={{ fontSize:12,color:"#64748b",margin:"2px 0 0",lineHeight:1.4 }}>{fm.description}</p>}
                            </div>
                          </div>
                        );
                      }) : (
                        <div style={{ padding:16,textAlign:"center" }}>
                          <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>Menú pendiente de programar</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Food locations */}
                {foodLocations.length > 0 ? (
                  <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)" }}>
                    <div style={{ padding:"14px 16px",background:"linear-gradient(135deg,rgba(33,208,179,0.06),rgba(31,205,255,0.04))",borderBottom:"1px solid #e2e8f0" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <p style={{ fontSize:13,fontWeight:700,color:"#0f172a",margin:0 }}>Lugares de comida</p>
                      </div>
                    </div>
                    {foodLocations.map((fl, i) => (
                      <div key={fl.id} style={{ padding:"12px 16px",borderTop:i>0?"1px solid #f1f5f9":"none",display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:36,height:36,borderRadius:10,background:"rgba(33,208,179,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0 }}>{fl.name}</p>
                          {fl.description && <p style={{ fontSize:11,color:"#64748b",margin:"2px 0 0",lineHeight:1.3 }}>{fl.description}</p>}
                        </div>
                        {fl.capacity && <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8,background:"#f1f5f9",color:"#475569",flexShrink:0 }}>{fl.capacity} pax</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background:"#fff",borderRadius:16,border:"1px dashed #e2e8f0",padding:24,textAlign:"center" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" style={{ margin:"0 auto 8px" }}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                    <p style={{ fontSize:13,fontWeight:600,color:"#94a3b8",margin:0 }}>No hay lugares de comida cargados</p>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════ CALENDARIO TAB ═══════════════════ */}
            {activeTab === "calendario" && (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Calendario deportivo</p>

                {/* Month nav */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"10px 14px" }}>
                  <button type="button" onClick={() => setCalMonthCursor(new Date(calYear, calMonth - 1, 1))}
                    style={{ background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span style={{ fontSize:14,fontWeight:700,color:"#0f172a",textTransform:"capitalize" }}>{calMonthLabel}</span>
                  <button type="button" onClick={() => setCalMonthCursor(new Date(calYear, calMonth + 1, 1))}
                    style={{ background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* Day grid */}
                <div style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"10px 8px" }}>
                  {/* Header */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
                    {DAY_NAMES.map((d, i) => (
                      <div key={i} style={{ textAlign:"center",fontSize:10,fontWeight:700,color:"#94a3b8",padding:"4px 0",textTransform:"uppercase" }}>{d}</div>
                    ))}
                  </div>
                  {/* Cells */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
                    {calGrid.map((day, i) => {
                      if (day === null) return <div key={i} />;
                      const hasEvent = calDaysWithEvents.has(day);
                      const isSelected = calSelectedDay === day;
                      const today = new Date();
                      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCalSelectedDay(isSelected ? null : day)}
                          style={{
                            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
                            padding:"6px 0",borderRadius:8,border:"none",cursor:"pointer",
                            background: isSelected ? "#21D0B3" : isToday ? "rgba(33,208,179,0.1)" : "transparent",
                            color: isSelected ? "#fff" : "#0f172a",
                            fontWeight: isToday ? 800 : 500,fontSize:13,
                          }}
                        >
                          {day}
                          {hasEvent && (
                            <span style={{ width:5,height:5,borderRadius:"50%",background: isSelected ? "#fff" : "#21D0B3" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected day events */}
                {calSelectedDay !== null && (
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <p style={{ fontSize:11,fontWeight:700,color:"#64748b",margin:0 }}>
                      {calSelectedDay} de {calMonthCursor.toLocaleDateString("es-CL", { month: "long" })}
                    </p>
                    {calSelectedDayEvents.length === 0 ? (
                      <p style={{ fontSize:12.5,color:"#94a3b8",margin:0,padding:"10px 0" }}>Sin actividades este dia</p>
                    ) : (
                      calSelectedDayEvents.map((ce) => {
                        const parentName = ce.parentId ? (disciplineParents.find((p) => p.id === ce.parentId)?.name || "") : "";
                        return (
                          <div key={ce.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:"#fff",border:"1px solid #e2e8f0" }}>
                            <span style={{ width:8,height:8,borderRadius:"50%",background:"#21D0B3",flexShrink:0 }} />
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {ce.name}{parentName ? ` · ${parentName}` : ""}
                              </p>
                              <p style={{ fontSize:10.5,color:"#64748b",margin:"1px 0 0" }}>
                                {new Date(ce.scheduledAt!).toLocaleTimeString("es-CL",{ hour:"2-digit",minute:"2-digit" })}
                                {ce.venueName ? ` · ${ce.venueName}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════ CUENTA TAB ═══════════════════ */}
            {activeTab === "cuenta" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {/* Profile card */}
                <div className="vr-card" style={{ display:"flex",flexDirection:"column",gap:"10px",borderLeft:"4px solid #21D0B3" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                    {(athlete.metadata?.photoUrl as string)?.startsWith("http") ? (
                      <img src={athlete.metadata!.photoUrl as string} alt={athlete.fullName || ""} style={{ width:48,height:48,borderRadius:"50%",objectFit:"cover",flexShrink:0,boxShadow:"0 3px 12px rgba(33,208,179,0.3)",border:"2px solid #21D0B3" }} />
                    ) : (
                      <div style={{ width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#21D0B3,#062240)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:900,color:"#fff",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",flexShrink:0 }}>
                        {(athlete.fullName || "?").split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth:0,flex:1 }}>
                      <h2 style={{ fontSize:"17px",fontWeight:800,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{athlete.fullName || athlete.id}</h2>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:"4px",marginTop:4 }}>
                        <span style={{ fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"10px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.3)" }}>
                          {events[athlete.eventId || ""]?.name || "-"}
                        </span>
                        <span style={{ fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"10px",background:"#f1f5f9",color:"#334155",border:"1px solid #dde3ed" }}>
                          {delegations[athlete.delegationId || ""]?.countryCode || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div style={{ display:"flex",flexDirection:"column",gap:6,marginTop:4 }}>
                    {([
                      ["Nombre completo", athlete.fullName || "-"],
                      ["Evento", events[athlete.eventId || ""]?.name || "-"],
                      ["Delegacion", delegations[athlete.delegationId || ""]?.countryCode || "-"],
                      ["Tipo de usuario", athlete.userType || "-"],
                      ["ID", athlete.id?.slice(-6) || "-"],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                        <span style={{ fontSize:11,fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em" }}>{label}</span>
                        <span style={{ fontSize:12.5,fontWeight:600,color:"#0f172a" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stats row */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px",marginTop:4 }}>
                    {([
                      { label:"Solicit.", value:requestStats.requested, color:"#0f172a" },
                      { label:"Program.", value:requestStats.scheduled, color:"#21D0B3" },
                      { label:"Activas", value:requestStats.active, color:"#f59e0b" },
                      { label:"Cerradas", value:requestStats.completed, color:"#10b981" },
                    ] as const).map(s => (
                      <div key={s.label} style={{ textAlign:"center",padding:"8px 4px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                        <div style={{ fontSize:"8px",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#94a3b8" }}>{s.label}</div>
                        <div style={{ fontSize:"20px",fontWeight:700,color:s.color,marginTop:"2px" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Credential button */}
                <button type="button" onClick={async () => {
                  try {
                    const evName = events[athlete.eventId || ""]?.name || "Seven Arena";
                    const qrData = `Participante: ${athlete.fullName}\nID: ${athlete.id.slice(-6)}\nDelegación: ${delegations[athlete.delegationId || ""]?.countryCode || "—"}`;
                    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
                    const meta = (athlete.metadata || {}) as Record<string, unknown>;
                    const photoKeys = ["photoUrl","photo_url","avatar","avatarUrl","imageUrl","image_url"];
                    let photoUrl: string | null = null;
                    for (const k of photoKeys) {
                      const v = meta[k];
                      if (typeof v === "string" && v.trim()) { photoUrl = v.trim(); break; }
                    }
                    const html = buildCredentialHtml({
                      eventName: evName,
                      fullName: athlete.fullName || "",
                      roleLabel: athlete.userType || "PARTICIPANTE",
                      credentialCode: athlete.id.slice(-6).toUpperCase(),
                      statusLabel: "ACTIVE",
                      issuedAtLabel: new Date().toLocaleDateString("es-CL"),
                      issuerLabel: "Seven Arena",
                      subjectId: athlete.id,
                      countryTag: delegations[athlete.delegationId || ""]?.countryCode || "",
                      photoUrl,
                      qrDataUrl,
                    });
                    setCredentialHtml(html);
                  } catch { notify.push("No se pudo generar la credencial", "❌"); }
                }}
                  style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#041a2e,#062240)",color:"#21D0B3",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
                  Ver credencial digital
                </button>

                {/* Logout button */}
                <button type="button" onClick={logout}
                  style={{ width:"100%",padding:"14px",borderRadius:14,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Cerrar sesion
                </button>
              </div>
            )}

          </section>
          </div>

          {/* Bottom tab bar — 6 tabs */}
          <div style={{ position:"fixed",bottom:0,left:0,right:0,display:"flex",background:"#fff",borderTop:"1px solid #e2e8f0",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)" }}>
            {([
              { key: "solicitud" as PortalTab, label: "Solicitud", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
              { key: "actividades" as PortalTab, label: "Actividades", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              { key: "premiaciones" as PortalTab, label: "Premios", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> },
              { key: "cupones" as PortalTab, label: "Cupones", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v2a3 3 0 010 6v2a2 2 0 002 2h14a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H5a2 2 0 00-2 2z"/><line x1="13" y1="5" x2="13" y2="7"/><line x1="13" y1="11" x2="13" y2="13"/><line x1="13" y1="17" x2="13" y2="19"/></svg> },
              { key: "sedes" as PortalTab, label: "Sedes", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              { key: "hoteles" as PortalTab, label: "Hoteles", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/></svg> },
              { key: "alimentacion" as PortalTab, label: "Comida", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
              { key: "calendario" as PortalTab, label: "Calendario", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { key: "cuenta" as PortalTab, label: "Cuenta", icon: (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex:1,padding:"6px 0 4px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}>
                {tab.icon(activeTab===tab.key ? "#21D0B3" : "#94a3b8")}
                <span style={{ fontSize:9,fontWeight:activeTab===tab.key?700:500,color:activeTab===tab.key?"#21D0B3":"#94a3b8" }}>{tab.label}</span>
              </button>
            ))}
          </div>

          {athlete && (
            <AssistanceChat
              originType="athlete"
              originId={athlete.id}
              originName={athlete.fullName || "Participante VIP"}
              eventId={athlete.eventId || null}
            />
          )}
        </div>
      )}

      {/* Rating popup modal */}
      {ratingTripId && (() => {
        const rTrip = trips.find((t) => t.id === ratingTripId);
        if (!rTrip || rTrip.driverRating) return null;
        const rDriver = rTrip.driverId ? drivers[rTrip.driverId] : null;
        return (
          <div
            onClick={dismissRating}
            style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:"#fff",borderRadius:20,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            >
              <p style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>Como fue tu viaje?</p>
              {rDriver?.fullName && <p style={{ fontSize:13,color:"#64748b",margin:"0 0 16px" }}>Conductor: {rDriver.fullName}</p>}

              <div style={{ display:"flex",justifyContent:"center",gap:6,marginBottom:16 }}>
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setRatingStars(star)}
                    style={{ background:"none",border:"none",cursor:"pointer",padding:3,transition:"transform .15s",transform:ratingStars >= star ? "scale(1.15)" : "scale(1)" }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={ratingStars >= star ? "#FBBF24" : "none"} stroke={ratingStars >= star ? "#F59E0B" : "#CBD5E1"} strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Comentario opcional..."
                rows={2}
                style={{ width:"100%",padding:10,borderRadius:12,border:"1px solid #e2e8f0",fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14 }}
              />

              <button type="button" onClick={() => submitRating(rTrip.id)} disabled={ratingStars === 0 || ratingLoading}
                style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:ratingStars > 0 ? "linear-gradient(135deg,#34F3C6,#21D0B3)" : "#e2e8f0",color:ratingStars > 0 ? "#0d1b3e" : "#94a3b8",fontSize:15,fontWeight:700,cursor:ratingStars > 0 ? "pointer" : "not-allowed",opacity:ratingLoading ? 0.7 : 1 }}>
                {ratingLoading ? "Enviando..." : "Enviar evaluacion"}
              </button>
              <button type="button" onClick={dismissRating}
                style={{ marginTop:8,background:"none",border:"none",color:"#94a3b8",fontSize:13,cursor:"pointer",padding:8 }}>
                Omitir
              </button>
            </div>
          </div>
        );
      })()}

      {/* Trip Chat */}
      {athlete && activeChatTrip && (
        <TripChat
          tripId={activeChatTrip.id}
          senderType="PASSENGER"
          senderName={athlete.fullName || "Pasajero"}
          tripStatus={activeChatTrip.status}
          onNewMessage={(name, content) => notify.push(`${name}: ${content.slice(0, 80)}`, "💬")}
        />
      )}

      {/* Credential modal (inline iframe) */}
      {credentialHtml && (
        <div onClick={() => setCredentialHtml(null)}
          style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(2,12,24,0.78)",backdropFilter:"blur(6px)" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background:"#fff",borderRadius:20,width:"100%",maxWidth:480,maxHeight:"95vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid #e2e8f0",background:"linear-gradient(135deg,#041a2e,#062240)",color:"#fff" }}>
              <div>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Credencial digital</p>
                <p style={{ fontSize:14,fontWeight:700,margin:"2px 0 0" }}>{athlete?.fullName || "Participante"}</p>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button type="button" onClick={() => {
                  const w = window.open("", "_blank", "width=480,height=760");
                  if (w) { w.document.write(credentialHtml); w.document.close(); }
                }}
                  title="Abrir en ventana / Imprimir"
                  style={{ width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",color:"#21D0B3",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
                <button type="button" onClick={() => setCredentialHtml(null)}
                  style={{ width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,lineHeight:1 }}>×</button>
              </div>
            </div>
            <iframe srcDoc={credentialHtml} title="Credencial"
              style={{ flex:1,width:"100%",minHeight:"60vh",border:"none",background:"#fff" }} />
          </div>
        </div>
      )}

      {/* Coupon QR modal */}
      {activeClaim && (
        <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0,background:"rgba(0,0,0,0.65)" }}
          onClick={() => setActiveClaim(null)}>
          <div style={{ background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,maxHeight:"95vh",overflowY:"auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}>
              <div style={{ width:40,height:4,borderRadius:4,background:"#e2e8f0" }} />
            </div>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"8px 20px 12px",borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#64748b",margin:0 }}>Tu cupón</p>
                <h2 style={{ fontSize:18,fontWeight:800,color:"#0f172a",margin:"2px 0 0",lineHeight:1.2 }}>{activeClaim.coupon?.title}</h2>
                {activeClaim.coupon?.partnerName && (
                  <p style={{ fontSize:12,color:"#64748b",margin:"3px 0 0" }}>{activeClaim.coupon.partnerName}</p>
                )}
              </div>
              <button type="button" onClick={() => setActiveClaim(null)}
                style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #e2e8f0",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:18,lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:20,display:"flex",flexDirection:"column",gap:16 }}>
              <div style={{ display:"flex",justifyContent:"center" }}>
                {couponQrDataUrl ? (
                  <div style={{ padding:16,background:"#fff",borderRadius:16,boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
                    <img src={couponQrDataUrl} alt="QR del cupón" style={{ width:240,height:240 }} />
                  </div>
                ) : (
                  <div style={{ width:264,height:264,background:"#f1f5f9",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <span style={{ fontSize:13,color:"#94a3b8" }}>Generando QR…</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#64748b",margin:"0 0 4px" }}>Código de respaldo</p>
                <p style={{ fontSize:22,fontFamily:"ui-monospace, SFMono-Regular, monospace",fontWeight:800,letterSpacing:"0.1em",color:"#1f4e8c",margin:0 }}>{activeClaim.uniqueCode}</p>
                <p style={{ fontSize:11,color:"#94a3b8",margin:"4px 0 0" }}>Si el QR no escanea, dictá este código al comercio.</p>
              </div>
              <div style={{ padding:12,borderRadius:12,background:"linear-gradient(135deg,#fff8e1 0%,#fff4d6 100%)" }}>
                <p style={{ fontSize:12,fontWeight:700,color:"#c78c00",margin:"0 0 4px" }}>Cómo canjearlo</p>
                <ol style={{ fontSize:12,color:"#7a5800",margin:0,paddingLeft:18,lineHeight:1.5 }}>
                  <li>Andá al local del comercio.</li>
                  <li>Mostrá esta pantalla con el QR.</li>
                  <li>El comercio lo escaneará y aplicará el descuento.</li>
                </ol>
              </div>
              <div style={{ fontSize:12,color:"#64748b",display:"flex",flexDirection:"column",gap:3 }}>
                <p style={{ margin:0 }}>📅 Reclamado el {fmtCouponFull(activeClaim.claimedAt)}</p>
                <p style={{ margin:0 }}>⏱️ Expira el {fmtCouponFull(activeClaim.expiresAt)} <strong>({couponTimeLeft(activeClaim.expiresAt)} restantes)</strong></p>
                {activeClaim.coupon?.partnerAddress && (
                  <p style={{ margin:0 }}>📍 {activeClaim.coupon.partnerAddress}</p>
                )}
              </div>
              {activeClaim.coupon?.termsAndConditions && (
                <details style={{ fontSize:12 }}>
                  <summary style={{ cursor:"pointer",fontWeight:600,color:"#64748b" }}>Términos y condiciones</summary>
                  <p style={{ marginTop:6,lineHeight:1.5,color:"#64748b" }}>{activeClaim.coupon.termsAndConditions}</p>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
