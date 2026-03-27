import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
  COUNTRY_LABELS,
  Driver,
  DelegationItem,
  EventItem,
  ProviderItem,
  Trip,
  Vehicle,
  formatDate,
} from '@/lib/types';

type AthleteItem = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
  email?: string | null;
  isDelegationLead?: boolean | null;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  EN_ROUTE: 'En ruta a recoger',
  PICKED_UP: 'En curso',
  DROPPED_OFF: 'Dejado',
  COMPLETED: 'Completado',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#f59e0b',
  EN_ROUTE: '#3b82f6',
  PICKED_UP: '#8b5cf6',
  DROPPED_OFF: '#6b7280',
  COMPLETED: '#10b981',
};

export default function ConductorPortal() {
  const [driverId, setDriverId] = useState('');
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [providers, setProviders] = useState<Record<string, ProviderItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [destinationFilter, setDestinationFilter] = useState('');
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [pickupTrip, setPickupTrip] = useState<Trip | null>(null);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const trackingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── GPS tracking ────────────────────────────────────────────────────────
  const sendPosition = async (trip: Trip, lat: number, lng: number, speed?: number | null) => {
    if (!trip.eventId) return;
    try {
      await apiFetch('/vehicle-positions', {
        method: 'POST',
        body: JSON.stringify({
          eventId: trip.eventId,
          vehicleId: trip.vehicleId,
          timestamp: new Date().toISOString(),
          location: { type: 'Point', coordinates: [lng, lat] },
          speed: speed ?? null,
        }),
      });
    } catch { /* non-blocking */ }
  };

  useEffect(() => {
    if (!trackingTripId) {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      return;
    }
    const trip = trips.find((t) => t.id === trackingTripId);
    if (!trip) return;

    const tick = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        sendPosition(trip, pos.coords.latitude, pos.coords.longitude, pos.coords.speed);
      } catch { /* noop */ }
    };

    tick();
    trackingInterval.current = setInterval(tick, 5000);
    return () => { if (trackingInterval.current) clearInterval(trackingInterval.current); };
  }, [trackingTripId, trips]);

  // ── Load driver data ─────────────────────────────────────────────────────
  const loadDriver = async () => {
    const normalized = driverId.trim();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    setIdError(null);
    try {
      const [tripsData, driversData, eventsData, vehiclesData, delegationsData, athletesData, providersData] =
        await Promise.all([
          apiFetch<Trip[]>('/trips'),
          apiFetch<Driver[]>('/drivers'),
          apiFetch<EventItem[]>('/events'),
          apiFetch<Vehicle[]>('/transports'),
          apiFetch<DelegationItem[]>('/delegations'),
          apiFetch<AthleteItem[]>('/athletes'),
          apiFetch<ProviderItem[]>('/providers'),
        ]);

      const driverMatch = (driversData || []).find((d) => {
        const last6 = (d.id ?? '').slice(-6);
        const last6u = (d.userId ?? '').slice(-6);
        return normalized === last6 || normalized === last6u;
      });

      if (!driverMatch) {
        setIdError('El ID no corresponde a un conductor registrado.');
        setLoading(false);
        return;
      }

      setDriverProfile(driverMatch);

      const driverKeys = new Set([driverMatch.id, driverMatch.userId].filter(Boolean) as string[]);
      setTrips((tripsData || []).filter((t) => t.driverId != null && driverKeys.has(t.driverId)));

      const toMap = <T extends { id: string }>(arr: T[]) =>
        (arr || []).reduce<Record<string, T>>((acc, item) => { acc[item.id] = item; return acc; }, {});

      setEvents(toMap(eventsData || []));
      setVehicles(toMap(vehiclesData || []));
      setDelegations(toMap(delegationsData || []));
      setAthletes(toMap(athletesData || []));
      setProviders(toMap(providersData || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  };

  const updateTrip = async (tripId: string, status: string) => {
    setLoading(true);
    try {
      const payload: Record<string, string> = { status };
      if (status === 'PICKED_UP') payload.startedAt = new Date().toISOString();
      if (status === 'DROPPED_OFF' || status === 'COMPLETED') payload.completedAt = new Date().toISOString();

      const updated = await apiFetch<Trip>(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (status === 'EN_ROUTE' || status === 'PICKED_UP') setTrackingTripId(updated.id);
      if (status === 'DROPPED_OFF' || status === 'COMPLETED') setTrackingTripId((curr) => curr === updated.id ? null : curr);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setLoading(false);
    }
  };

  const getPickupCandidates = (trip: Trip) => {
    const candidates = new Set<string>();
    if (trip.requesterAthleteId) candidates.add(trip.requesterAthleteId.slice(-6));
    (trip.athleteIds || []).forEach((id) => candidates.add(id.slice(-6)));
    const delegIds = Array.from(new Set((trip.athleteIds || []).map((id) => athletes[id]?.delegationId).filter(Boolean) as string[]));
    delegIds.forEach((dId) => {
      const lead = Object.values(athletes).find((a) => a.delegationId === dId && a.isDelegationLead);
      if (lead?.id) candidates.add(lead.id.slice(-6));
    });
    return candidates;
  };

  const submitPickup = async () => {
    if (!pickupTrip) return;
    const last6 = pickupCode.trim().slice(-6);
    if (last6.length < 6) { setPickupError('El código no es válido.'); return; }
    if (!getPickupCandidates(pickupTrip).has(last6)) { setPickupError('El código no coincide con el usuario del viaje.'); return; }
    setPickupTrip(null);
    setPickupCode('');
    setPickupError(null);
    await updateTrip(pickupTrip.id, 'PICKED_UP');
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true);
    setRequestError(null);
    setRequestStatus(null);
    try {
      const res = await apiFetch<{ message?: string }>('/drivers/request-access', {
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

  const resolveDelegations = (trip: Trip) => {
    const ids = Array.from(new Set((trip.athleteIds || []).map((id) => athletes[id]?.delegationId).filter(Boolean) as string[]));
    return ids.map((id) => COUNTRY_LABELS[delegations[id]?.countryCode ?? ''] || delegations[id]?.countryCode || id).join(', ') || '-';
  };

  const resolveAthletes = (trip: Trip) => {
    if (trip.athleteNames?.length) return trip.athleteNames.join(', ');
    const names = (trip.athleteIds || []).map((id) => athletes[id]?.fullName).filter(Boolean);
    return names.join(', ') || '-';
  };

  const openMaps = (address?: string | null) => {
    if (!address) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const filteredTrips = trips.filter((t) => {
    const dest = (t.destination || '').toLowerCase();
    return !destinationFilter || dest.includes(destinationFilter.toLowerCase());
  });

  const vehicle = driverProfile?.vehicleId ? vehicles[driverProfile.vehicleId] : null;
  const provider = driverProfile?.providerId ? providers[driverProfile.providerId] : null;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* ── Login ─────────────────────────────── */}
          {!driverProfile && (
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
                value={driverId}
                onChangeText={setDriverId}
                placeholder="Últimas 6 cifras"
                keyboardType="default"
                maxLength={12}
              />
              {idError && <Text style={s.errorText}>{idError}</Text>}
              {error && <Text style={s.errorText}>{error}</Text>}
              <TouchableOpacity style={s.btnPrimary} onPress={loadDriver} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Ver mis viajes</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Driver profile ─────────────────── */}
          {driverProfile && (
            <View style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionLabel}>Perfil</Text>
                  <Text style={s.nameText}>{driverProfile.fullName || 'Conductor'}</Text>
                  <Text style={s.metaText}>RUT: {driverProfile.rut || '-'}</Text>
                  <Text style={s.metaText}>{driverProfile.email || '-'}</Text>
                </View>
                <TouchableOpacity style={s.btnGhost} onPress={() => { setDriverProfile(null); setDriverId(''); setTrips([]); }}>
                  <Text style={s.btnGhostText}>Salir</Text>
                </TouchableOpacity>
              </View>

              <View style={s.grid2}>
                <View style={s.metaBlock}>
                  <Text style={s.infoLabel}>VEHÍCULO</Text>
                  <Text style={s.infoValue}>
                    {vehicle ? [vehicle.plate, vehicle.type, vehicle.brand, vehicle.model].filter(Boolean).join(' · ') : '-'}
                  </Text>
                </View>
                <View style={s.metaBlock}>
                  <Text style={s.infoLabel}>PROVEEDOR</Text>
                  <Text style={s.infoValue}>
                    {provider ? `${provider.name}${provider.rut ? ' · ' + provider.rut : ''}` : '-'}
                  </Text>
                </View>
              </View>

              {trackingTripId && (
                <View style={s.trackingBanner}>
                  <Text style={s.trackingText}>📡 GPS activo — enviando posición cada 5 seg</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Trips ─────────────────────────────── */}
          {driverProfile && (
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.sectionLabel}>Viajes asignados ({filteredTrips.length})</Text>
              </View>

              <TextInput
                style={[s.input, { marginTop: 8 }]}
                value={destinationFilter}
                onChangeText={setDestinationFilter}
                placeholder="Filtrar por destino..."
              />

              {loading && <ActivityIndicator color="#10b981" style={{ marginVertical: 12 }} />}

              {filteredTrips.length === 0 && !loading && (
                <Text style={s.emptyText}>No hay viajes asignados.</Text>
              )}

              {filteredTrips.map((trip) => {
                const ev = trip.eventId ? events[trip.eventId] : null;
                const veh = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                const statusColor = STATUS_COLORS[trip.status || ''] || '#94a3b8';
                const isPortalReq = trip.tripType === 'PORTAL_REQUEST';

                return (
                  <View key={trip.id} style={s.tripCard}>
                    {/* Header */}
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={s.tripId} numberOfLines={1}>#{trip.id.slice(-8)}</Text>
                        <Text style={s.metaText}>{ev?.name || '-'}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[s.badgeText, { color: statusColor }]}>
                          {STATUS_LABELS[trip.status || ''] || trip.status}
                        </Text>
                      </View>
                    </View>

                    {/* Info */}
                    <View style={s.tripInfo}>
                      <Text style={s.infoMeta}>🕒 {formatDate(trip.scheduledAt)}</Text>
                      <Text style={s.infoMeta}>🚐 {veh ? [veh.plate, veh.type].filter(Boolean).join(' · ') : '-'}</Text>
                      <Text style={s.infoMeta}>👥 {(trip.athleteIds || []).length} pasajero(s)</Text>
                      <Text style={s.infoMeta}>🏁 Delegación: {resolveDelegations(trip)}</Text>
                    </View>

                    {/* Origin / Destination */}
                    <View style={s.locationRow}>
                      <TouchableOpacity style={s.locationBtn} onPress={() => openMaps(trip.origin)}>
                        <Text style={s.locationLabel}>Origen</Text>
                        <Text style={s.locationValue} numberOfLines={2}>{trip.origin || '-'}</Text>
                      </TouchableOpacity>
                      <Text style={s.locationArrow}>→</Text>
                      <TouchableOpacity style={s.locationBtn} onPress={() => openMaps(trip.destination)}>
                        <Text style={s.locationLabel}>Destino</Text>
                        <Text style={s.locationValue} numberOfLines={2}>{trip.destination || '-'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Actions */}
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => updateTrip(trip.id, 'EN_ROUTE')}>
                        <Text style={s.actionBtnText}>En ruta</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => { setPickupTrip(trip); setPickupCode(''); setPickupError(null); }}>
                        <Text style={[s.actionBtnText, { color: '#fff' }]}>{isPortalReq ? 'En curso' : 'Recogido'}</Text>
                      </TouchableOpacity>
                      {!isPortalReq && trip.tripType !== 'SERVICE' && (
                        <TouchableOpacity style={s.actionBtn} onPress={() => updateTrip(trip.id, 'DROPPED_OFF')}>
                          <Text style={s.actionBtnText}>Dejado</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.actionBtn} onPress={() => updateTrip(trip.id, 'COMPLETED')}>
                        <Text style={s.actionBtnText}>Completado</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Pickup code modal ──────────────────── */}
      <Modal visible={!!pickupTrip} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.sectionLabel}>Código de verificación</Text>
            <Text style={s.nameText}>{pickupTrip?.tripType === 'PORTAL_REQUEST' ? 'En curso' : 'Recogido'}</Text>
            <Text style={[s.metaText, { marginBottom: 12 }]}>Ingresa el código de usuario del pasajero.</Text>
            <TextInput
              style={s.input}
              value={pickupCode}
              onChangeText={setPickupCode}
              placeholder="000000"
              keyboardType="numeric"
              maxLength={12}
            />
            {pickupError && <Text style={s.errorText}>{pickupError}</Text>}
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={submitPickup}>
                <Text style={[s.actionBtnText, { color: '#fff' }]}>Validar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => { setPickupTrip(null); setPickupCode(''); setPickupError(null); }}>
                <Text style={s.actionBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 8 },
  tripCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  grid2: { flexDirection: 'row', gap: 10 },
  metaBlock: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  metaText: { fontSize: 13, color: '#64748b' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  infoMeta: { fontSize: 13, color: '#64748b' },
  label: { fontSize: 14, color: '#475569', fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  btnPrimary: { backgroundColor: '#10b981', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { borderWidth: 1.5, borderColor: '#10b981', borderRadius: 12, padding: 13, alignItems: 'center', marginBottom: 4 },
  btnSecondaryText: { color: '#10b981', fontWeight: '700', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  btnGhostText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  successText: { color: '#10b981', fontSize: 13, marginBottom: 8 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  tripId: { fontSize: 14, fontWeight: '600', color: '#334155' },
  tripInfo: { gap: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  locationBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10 },
  locationLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  locationValue: { fontSize: 13, color: '#0ea5e9', fontWeight: '500' },
  locationArrow: { marginTop: 18, color: '#94a3b8', fontSize: 16 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnPrimary: { backgroundColor: '#10b981', borderColor: '#10b981' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  trackingBanner: { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },
  trackingText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 8 },
});
