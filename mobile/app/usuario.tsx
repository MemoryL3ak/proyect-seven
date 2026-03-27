import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '@/lib/api';
import {
  Athlete,
  COUNTRY_LABELS,
  Driver,
  EventItem,
  Flight,
  HotelAssignment,
  HotelBed,
  HotelRoom,
  Hotel,
  LUGGAGE_LABELS,
  Trip,
  Vehicle,
  DelegationItem,
  formatDate,
  normalizeAssignment,
} from '@/lib/types';

export default function UsuarioPortal() {
  const [athleteId, setAthleteId] = useState('');
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [delegation, setDelegation] = useState<DelegationItem | null>(null);
  const [hotelAssignment, setHotelAssignment] = useState<HotelAssignment | null>(null);
  const [hotelRoom, setHotelRoom] = useState<HotelRoom | null>(null);
  const [hotelBed, setHotelBed] = useState<HotelBed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const resetData = () => {
    setFlight(null); setHotel(null); setVehicle(null);
    setDriver(null); setTrip(null); setEvent(null);
    setDelegation(null); setHotelAssignment(null);
    setHotelRoom(null); setHotelBed(null);
  };

  const loadAthlete = async () => {
    const normalized = athleteId.trim();
    if (normalized.length < 6) {
      setError('El código ingresado no es válido (mínimo 6 caracteres).');
      return;
    }
    setLoading(true);
    setError(null);
    resetData();
    try {
      const list = await apiFetch<Athlete[]>('/athletes');
      const match = (list || []).find((a) => a.id?.slice(-6) === normalized);
      if (!match) {
        setError('El código no corresponde a un usuario registrado.');
        setLoading(false);
        return;
      }
      const data = await apiFetch<Athlete>(`/athletes/${match.id}`);
      setAthlete(data);

      const [flightData, hotelData, vehicleData, tripData, tripsList, eventData, delegationData, assignmentRaw] =
        await Promise.all([
          data.arrivalFlightId ? apiFetch<Flight>(`/flights/${data.arrivalFlightId}`) : Promise.resolve(null),
          data.hotelAccommodationId ? apiFetch<Hotel>(`/accommodations/${data.hotelAccommodationId}`) : Promise.resolve(null),
          data.transportVehicleId ? apiFetch<Vehicle>(`/transports/${data.transportVehicleId}`) : Promise.resolve(null),
          data.transportTripId ? apiFetch<Trip>(`/trips/${data.transportTripId}`) : Promise.resolve(null),
          data.transportTripId ? Promise.resolve([]) : apiFetch<Trip[]>('/trips'),
          data.eventId ? apiFetch<EventItem>(`/events/${data.eventId}`) : Promise.resolve(null),
          data.delegationId ? apiFetch<DelegationItem>(`/delegations/${data.delegationId}`) : Promise.resolve(null),
          apiFetch<Record<string, unknown> | null>(`/hotel-assignments/by-participant/${match.id}`),
        ]);

      const assignment = assignmentRaw ? normalizeAssignment(assignmentRaw) : null;
      setFlight(flightData);
      setEvent(eventData);
      setDelegation(delegationData);
      setHotelAssignment(assignment);

      let resolvedHotel = hotelData;
      if (assignment?.hotelId && (!resolvedHotel || resolvedHotel.id !== assignment.hotelId)) {
        try { resolvedHotel = await apiFetch<Hotel>(`/accommodations/${assignment.hotelId}`); } catch { /* noop */ }
      }
      setHotel(resolvedHotel);

      const inferredTrip = tripData ?? (tripsList || []).find((t) => (t.athleteIds || []).includes(data.id)) ?? null;
      setTrip(inferredTrip);

      let resolvedVehicle = vehicleData;
      if (inferredTrip?.vehicleId && !vehicleData) {
        try { resolvedVehicle = await apiFetch<Vehicle>(`/transports/${inferredTrip.vehicleId}`); } catch { /* noop */ }
      }
      setVehicle(resolvedVehicle);

      if (inferredTrip?.driverId) {
        try {
          const drivers = await apiFetch<Driver[]>('/drivers');
          setDriver((drivers || []).find((d) => d.id === inferredTrip.driverId || d.userId === inferredTrip.driverId) ?? null);
        } catch { /* noop */ }
      }

      if (assignment?.roomId) {
        try { setHotelRoom(await apiFetch<HotelRoom>(`/hotel-rooms/${assignment.roomId}`)); } catch { /* noop */ }
      }
      if (assignment?.bedId) {
        try { setHotelBed(await apiFetch<HotelBed>(`/hotel-beds/${assignment.bedId}`)); } catch { /* noop */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  };

  const mark = async (field: 'airportCheckinAt' | 'hotelCheckinAt' | 'hotelCheckoutAt') => {
    if (!athlete) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      const updated = await apiFetch<Athlete>(`/athletes/${athlete.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: now }),
      });
      setAthlete(updated);
      if (hotelAssignment?.id && (field === 'hotelCheckinAt' || field === 'hotelCheckoutAt')) {
        const payload = field === 'hotelCheckinAt' ? { checkinAt: now } : { checkoutAt: now };
        try {
          await apiFetch(`/hotel-assignments/${hotelAssignment.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } catch { /* noop */ }
        setHotelAssignment((prev) => prev ? { ...prev, ...(field === 'hotelCheckinAt' ? { checkinAt: now } : { checkoutAt: now }) } : prev);
      }
      Alert.alert('Confirmado', 'El registro se guardó correctamente.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true);
    setRequestError(null);
    setRequestStatus(null);
    try {
      const res = await apiFetch<{ message?: string }>('/athletes/request-access', {
        method: 'POST',
        body: JSON.stringify({ email: requestEmail }),
      });
      setRequestStatus(res?.message || 'Código enviado al correo.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      let msg = raw;
      try { const p = JSON.parse(raw); if (p?.message) msg = p.message; } catch { /* noop */ }
      setRequestError(msg || 'No se pudo enviar el correo.');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* ── Login ───────────────────────────── */}
          {!athlete && (
            <View style={s.card}>
              <Text style={s.sectionLabel}>Solicita tu código</Text>
              <Text style={s.label}>Correo electrónico</Text>
              <TextInput
                style={s.input}
                value={requestEmail}
                onChangeText={setRequestEmail}
                placeholder="email@dominio.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.btnSecondary} onPress={requestAccess} disabled={requestLoading}>
                <Text style={s.btnSecondaryText}>{requestLoading ? 'Enviando...' : 'Solicitar código por correo'}</Text>
              </TouchableOpacity>
              {requestStatus && <Text style={s.successText}>{requestStatus}</Text>}
              {requestError && <Text style={s.errorText}>{requestError}</Text>}

              <View style={s.divider} />

              <Text style={s.label}>Tu código de acceso</Text>
              <TextInput
                style={s.input}
                value={athleteId}
                onChangeText={setAthleteId}
                placeholder="Ingresa las últimas 6 cifras"
                keyboardType="default"
                maxLength={12}
              />
              {error && <Text style={s.errorText}>{error}</Text>}
              <TouchableOpacity style={s.btnPrimary} onPress={loadAthlete} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Ver mi información</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Dashboard ───────────────────────── */}
          {athlete && (
            <>
              {/* Profile */}
              <View style={s.card}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionLabel}>Perfil</Text>
                    <Text style={s.nameText}>{athlete.fullName}</Text>
                    <Text style={s.metaText}>{COUNTRY_LABELS[athlete.countryCode ?? ''] || athlete.countryCode || '-'}</Text>
                    <Text style={s.metaText}>Tipo: {trip?.clientType || athlete.userType || '-'}</Text>
                    <Text style={s.metaText}>Evento: {event?.name || '-'}</Text>
                    <Text style={s.metaText}>
                      Delegación: {delegation ? COUNTRY_LABELS[delegation.countryCode ?? ''] || delegation.countryCode : '-'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.btnGhost}
                    onPress={() => { setAthlete(null); setAthleteId(''); resetData(); }}
                  >
                    <Text style={s.btnGhostText}>Salir</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Info cards */}
              <View style={s.grid}>
                <View style={s.infoCard}>
                  <Text style={s.infoLabel}>VUELO</Text>
                  <Text style={s.infoValue}>
                    {flight ? `${flight.airline} · ${flight.flightNumber}` : athlete.airline || '-'}
                  </Text>
                  <Text style={s.infoMeta}>Arribo: {formatDate(athlete.arrivalTime ?? flight?.arrivalTime)}</Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoLabel}>HOTEL</Text>
                  <Text style={s.infoValue}>{hotel?.name || '-'}</Text>
                  <Text style={s.infoMeta}>Hab: {hotelRoom?.roomNumber || athlete.roomNumber || '-'}</Text>
                  <Text style={s.infoMeta}>Tipo: {hotelRoom?.roomType || athlete.roomType || '-'}</Text>
                  <Text style={s.infoMeta}>Cama: {hotelBed?.bedType || athlete.bedType || '-'}</Text>
                  <Text style={s.infoMeta}>Equipaje: {LUGGAGE_LABELS[athlete.luggageType ?? ''] || '-'}</Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoLabel}>TRANSPORTE</Text>
                  <Text style={s.infoValue}>Conductor: {driver?.fullName || '-'}</Text>
                  <Text style={s.infoMeta}>
                    Vehículo: {vehicle ? `${vehicle.type || ''} · ${vehicle.plate || ''}`.trim() : '-'}
                  </Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoLabel}>CHECK-INS</Text>
                  <Text style={s.infoMeta}>Aeropuerto: {formatDate(athlete.airportCheckinAt)}</Text>
                  <Text style={s.infoMeta}>Hotel: {formatDate(athlete.hotelCheckinAt)}</Text>
                  <Text style={s.infoMeta}>Check-out: {formatDate(athlete.hotelCheckoutAt)}</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={s.card}>
                <Text style={s.sectionLabel}>Acciones</Text>
                {loading && <ActivityIndicator style={{ marginBottom: 12 }} color="#0ea5e9" />}
                <TouchableOpacity style={[s.btnPrimary, { marginBottom: 10 }]} onPress={() => mark('airportCheckinAt')}>
                  <Text style={s.btnPrimaryText}>✈️  Marcar llegada / embarque</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnPrimary, { marginBottom: 10 }]} onPress={() => mark('hotelCheckinAt')}>
                  <Text style={s.btnPrimaryText}>🏨  Marcar check-in hotel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSecondary} onPress={() => mark('hotelCheckoutAt')}>
                  <Text style={s.btnSecondaryText}>🚪  Marcar check-out hotel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  grid: { gap: 12 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  nameText: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  metaText: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  infoMeta: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  label: { fontSize: 14, color: '#475569', fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  btnPrimary: { backgroundColor: '#0ea5e9', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { borderWidth: 1.5, borderColor: '#0ea5e9', borderRadius: 12, padding: 13, alignItems: 'center' },
  btnSecondaryText: { color: '#0ea5e9', fontWeight: '700', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnGhostText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  successText: { color: '#10b981', fontSize: 13, marginTop: 6, marginBottom: 8 },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 4, marginBottom: 8 },
});
