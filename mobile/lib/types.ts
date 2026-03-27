// ─── Shared types across portals ───────────────────────────────────────────

export type Athlete = {
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
};

export type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  arrivalTime: string | null;
};

export type Hotel = {
  id: string;
  name: string;
};

export type HotelAssignment = {
  id: string;
  participantId?: string;
  hotelId?: string;
  roomId?: string | null;
  bedId?: string | null;
  checkinAt?: string | null;
  checkoutAt?: string | null;
};

export type HotelRoom = {
  id: string;
  roomNumber: string;
  roomType: string;
};

export type HotelBed = {
  id: string;
  bedType: string;
};

export type Vehicle = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type Trip = {
  id: string;
  driverId?: string | null;
  eventId?: string | null;
  vehicleId?: string | null;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  destinationVenueId?: string | null;
  tripType?: string | null;
  tripCost?: number | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  status?: string | null;
  scheduledAt?: string | null;
  requestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  notes?: string | null;
  clientType?: string | null;
};

export type Driver = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  vehicleId?: string | null;
  providerId?: string | null;
  phone?: string | null;
};

export type EventItem = {
  id: string;
  name?: string | null;
};

export type DelegationItem = {
  id: string;
  countryCode?: string | null;
};

export type Venue = {
  id: string;
  name?: string | null;
  address?: string | null;
  eventId?: string | null;
};

export type ProviderItem = {
  id: string;
  name: string;
  rut?: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  EN_ROUTE: 'En ruta',
  PICKED_UP: 'En curso',
  DROPPED_OFF: 'Dejado',
  COMPLETED: 'Completado',
  REQUESTED: 'Solicitado',
  CANCELLED: 'Cancelado',
};

export const COUNTRY_LABELS: Record<string, string> = {
  ARG: 'Argentina', BOL: 'Bolivia', BRA: 'Brasil', CHL: 'Chile',
  COL: 'Colombia', ECU: 'Ecuador', PRY: 'Paraguay', PER: 'Perú',
  URY: 'Uruguay', VEN: 'Venezuela', MEX: 'México', USA: 'EE.UU.',
  CAN: 'Canadá', ESP: 'España', FRA: 'Francia', DEU: 'Alemania',
  ITA: 'Italia', PRT: 'Portugal', GBR: 'Reino Unido',
};

export const LUGGAGE_LABELS: Record<string, string> = {
  BAG: 'Bolso',
  SUITCASE_8: 'Maleta 8kg',
  SUITCASE_15: 'Maleta 15kg',
  SUITCASE_23: 'Maleta 23kg',
  EXTRA_BAGGAGE: 'Sobreequipaje',
};

export function formatDate(value?: string | null): string {
  if (!value || value === 'null' || value === 'undefined') return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-CL');
}

export function normalizeAssignment(raw: Record<string, unknown>): HotelAssignment {
  return {
    id: raw.id as string,
    participantId: (raw.participantId ?? raw.participant_id ?? '') as string,
    hotelId: (raw.hotelId ?? raw.hotel_id ?? '') as string,
    roomId: (raw.roomId ?? raw.room_id ?? null) as string | null,
    bedId: (raw.bedId ?? raw.bed_id ?? null) as string | null,
    checkinAt: (raw.checkinAt ?? raw.checkin_at ?? null) as string | null,
    checkoutAt: (raw.checkoutAt ?? raw.checkout_at ?? null) as string | null,
  };
}
