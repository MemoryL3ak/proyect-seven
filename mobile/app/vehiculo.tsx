import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  DelegationItem,
  EventItem,
  Driver,
  formatDate,
  STATUS_LABELS,
  Trip,
  Vehicle,
  Venue,
} from '@/lib/types';

type PortalTab = 'request' | 'status';

const VEHICLE_TYPES = [
  { value: 'SEDAN', label: 'Sedán' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINI_BUS', label: 'Mini bus' },
  { value: 'BUS', label: 'Bus' },
];

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: '#f59e0b',
  SCHEDULED: '#3b82f6',
  EN_ROUTE: '#8b5cf6',
  PICKED_UP: '#10b981',
  DROPPED_OFF: '#6b7280',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

export default function VehiculoPortal() {
  // ── Auth ─────────────────────────────────────────────────────────────
  const [userCode, setUserCode] = useState('');
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────
  const [trips, setTrips] = useState<Trip[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [drivers, setDrivers] = useState<Record<string, Driver>>({});
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [events, setEvents] = useState<EventItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);

  // ── Form ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PortalTab>('request');
  const [vehicleType, setVehicleType] = useState('SEDAN');
  const [origin, setOrigin] = useState('');
  const [destinationVenueId, setDestinationVenueId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [passengerCount, setPassengerCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Position polling ─────────────────────────────────────────────────
  const [positionsByVehicle, setPositionsByVehicle] = useState<Record<string, { lat: number; lng: number }>>({});
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const myTrips = useMemo(() => {
    if (!athlete) return [];
    return trips.filter((t) => t.requesterAthleteId === athlete.id || (t.athleteIds || []).includes(athlete.id));
  }, [trips, athlete]);

  const stats = useMemo(() => ({
    requested: myTrips.filter((t) => t.status === 'REQUESTED').length,
    scheduled: myTrips.filter((t) => t.status === 'SCHEDULED').length,
    active: myTrips.filter((t) => t.status === 'EN_ROUTE' || t.status === 'PICKED_UP').length,
    closed: myTrips.filter((t) => t.status === 'DROPPED_OFF' || t.status === 'COMPLETED').length,
  }), [myTrips]);

  const activeVehicleIds = useMemo(() =>
    myTrips
      .filter((t) => t.status === 'EN_ROUTE' || t.status === 'PICKED_UP')
      .map((t) => t.vehicleId)
      .filter(Boolean) as string[],
    [myTrips]
  );

  // Poll positions for active trips
  useEffect(() => {
    if (!athlete || activeVehicleIds.length === 0) {
      if (pollInterval.current) clearInterval(pollInterval.current);
      return;
    }
    const fetchPositions = async () => {
      try {
        const all = await apiFetch<Array<{ vehicleId: string; location?: { coordinates?: [number, number] } }>>('/vehicle-positions');
        const map: Record<string, { lat: number; lng: number }> = {};
        for (const p of all || []) {
          if (activeVehicleIds.includes(p.vehicleId) && p.location?.coordinates) {
            map[p.vehicleId] = { lng: p.location.coordinates[0], lat: p.location.coordinates[1] };
          }
        }
        setPositionsByVehicle(map);
      } catch { /* noop */ }
    };
    fetchPositions();
    pollInterval.current = setInterval(fetchPositions, 10000);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [athlete, activeVehicleIds.join(',')]);

  // ── Load athlete + catalog data ───────────────────────────────────────
  const loadData = async (athleteObj: Athlete) => {
    try {
      const [tripsData, venuesData, driversData, vehiclesData, eventsData, delegsData] =
        await Promise.all([
          apiFetch<Trip[]>('/trips'),
          apiFetch<Venue[]>('/venues'),
          apiFetch<Driver[]>('/drivers'),
          apiFetch<Vehicle[]>('/transports'),
          apiFetch<EventItem[]>('/events'),
          apiFetch<DelegationItem[]>('/delegations'),
        ]);

      setTrips(tripsData || []);
      setVenues((venuesData || []).filter((v) => !athleteObj.eventId || !v.eventId || v.eventId === athleteObj.eventId));
      setDrivers(Object.fromEntries((driversData || []).map((d) => [d.id, d])));
      setVehicles(Object.fromEntries((vehiclesData || []).map((v) => [v.id, v])));
      setEvents(eventsData || []);
      setDelegations(delegsData || []);
    } catch { /* noop */ }
  };

  const login = async () => {
    const normalized = userCode.trim();
    if (normalized.length < 6) { setError('Código inválido.'); return; }
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<Athlete[]>('/athletes');
      const match = (list || []).find((a) => a.id?.slice(-6) === normalized);
      if (!match) { setError('El código no corresponde a un usuario registrado.'); setLoading(false); return; }
      setAthlete(match);
      await loadData(match);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.');
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

  // ── Trip CRUD ─────────────────────────────────────────────────────────
  const submitRequest = async () => {
    if (!athlete) return;
    if (!origin.trim()) { Alert.alert('Error', 'Ingresa el origen del viaje.'); return; }
    if (!destinationVenueId) { Alert.alert('Error', 'Selecciona el destino.'); return; }
    if (!scheduledAt.trim()) { Alert.alert('Error', 'Indica la fecha y hora del servicio.'); return; }

    const venue = venues.find((v) => v.id === destinationVenueId);
    setSubmitting(true);
    try {
      const payload = {
        eventId: athlete.eventId,
        requesterAthleteId: athlete.id,
        athleteIds: [athlete.id],
        tripType: 'PORTAL_REQUEST',
        clientType: athlete.userType,
        requestedVehicleType: vehicleType,
        passengerCount: parseInt(passengerCount, 10) || 1,
        destinationVenueId,
        destination: venue ? [venue.name, venue.address].filter(Boolean).join(' - ') : destinationVenueId,
        origin: origin.trim(),
        status: 'REQUESTED',
        requestedAt: new Date().toISOString(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes.trim() || undefined,
      };

      if (editingTripId) {
        const updated = await apiFetch<Trip>(`/trips/${editingTripId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        Alert.alert('Actualizado', 'La solicitud fue modificada.');
      } else {
        const created = await apiFetch<Trip>('/trips', { method: 'POST', body: JSON.stringify(payload) });
        setTrips((prev) => [created, ...prev]);
        Alert.alert('Solicitud enviada', 'Tu traslado ha sido solicitado correctamente.');
      }

      setOrigin(''); setDestinationVenueId(''); setScheduledAt(''); setPassengerCount('1'); setNotes('');
      setEditingTripId(null);
      setTab('status');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelTrip = (tripId: string) => {
    Alert.alert('Cancelar viaje', '¿Seguro que deseas cancelar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/trips/${tripId}`, { method: 'DELETE' });
            setTrips((prev) => prev.filter((t) => t.id !== tripId));
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cancelar.');
          }
        },
      },
    ]);
  };

  const startEdit = (trip: Trip) => {
    setEditingTripId(trip.id);
    setVehicleType(trip.requestedVehicleType || 'SEDAN');
    setOrigin(trip.origin || '');
    setDestinationVenueId(trip.destinationVenueId || '');
    setScheduledAt(trip.scheduledAt ? new Date(trip.scheduledAt).toISOString().slice(0, 16) : '');
    setPassengerCount(String(trip.passengerCount || 1));
    setNotes(trip.notes || '');
    setTab('request');
  };

  const canEdit = (trip: Trip) => {
    const editable = ['REQUESTED', 'SCHEDULED'];
    if (!editable.includes(trip.status || '')) return false;
    if (!trip.scheduledAt) return true;
    const diff = new Date(trip.scheduledAt).getTime() - Date.now();
    return diff > 2 * 60 * 60 * 1000; // 2 hours
  };

  const openMaps = (lat: number, lng: number) =>
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);

  // ── Render ────────────────────────────────────────────────────────────
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
                style={s.input} value={requestEmail} onChangeText={setRequestEmail}
                placeholder="email@dominio.com" keyboardType="email-address" autoCapitalize="none"
              />
              <TouchableOpacity style={s.btnSecondary} onPress={requestAccess} disabled={requestLoading}>
                <Text style={s.btnSecondaryText}>{requestLoading ? 'Enviando...' : 'Solicitar código por correo'}</Text>
              </TouchableOpacity>
              {requestStatus && <Text style={s.successText}>{requestStatus}</Text>}
              {requestError && <Text style={s.errorText}>{requestError}</Text>}
              <View style={s.divider} />
              <Text style={s.label}>Tu código de acceso</Text>
              <TextInput
                style={s.input} value={userCode} onChangeText={setUserCode}
                placeholder="Últimas 6 cifras" maxLength={12}
              />
              {error && <Text style={s.errorText}>{error}</Text>}
              <TouchableOpacity style={s.btnPrimary} onPress={login} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Entrar</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Dashboard ───────────────────────── */}
          {athlete && (
            <>
              {/* Profile + stats */}
              <View style={s.card}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionLabel}>Bienvenido</Text>
                    <Text style={s.nameText}>{athlete.fullName}</Text>
                    <Text style={s.metaText}>{athlete.userType || '-'}</Text>
                  </View>
                  <TouchableOpacity style={s.btnGhost} onPress={() => { setAthlete(null); setUserCode(''); setTrips([]); }}>
                    <Text style={s.btnGhostText}>Salir</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.statsRow}>
                  <StatBox label="Solicitadas" value={stats.requested} color="#f59e0b" />
                  <StatBox label="Programadas" value={stats.scheduled} color="#3b82f6" />
                  <StatBox label="En curso" value={stats.active} color="#10b981" />
                  <StatBox label="Cerradas" value={stats.closed} color="#94a3b8" />
                </View>
              </View>

              {/* Tab selector */}
              <View style={s.tabRow}>
                <TouchableOpacity style={[s.tabBtn, tab === 'request' && s.tabBtnActive]} onPress={() => setTab('request')}>
                  <Text style={[s.tabText, tab === 'request' && s.tabTextActive]}>Nueva solicitud</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tabBtn, tab === 'status' && s.tabBtnActive]} onPress={() => setTab('status')}>
                  <Text style={[s.tabText, tab === 'status' && s.tabTextActive]}>Estado de servicio</Text>
                </TouchableOpacity>
              </View>

              {/* ── Request form ────────────────── */}
              {tab === 'request' && (
                <View style={s.card}>
                  {editingTripId && <Text style={s.editBanner}>✏️ Editando solicitud</Text>}

                  <Text style={s.label}>Tipo de vehículo</Text>
                  <View style={s.vehicleTypes}>
                    {VEHICLE_TYPES.map((vt) => (
                      <TouchableOpacity
                        key={vt.value}
                        style={[s.vtBtn, vehicleType === vt.value && s.vtBtnActive]}
                        onPress={() => setVehicleType(vt.value)}
                      >
                        <Text style={[s.vtBtnText, vehicleType === vt.value && s.vtBtnTextActive]}>{vt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Origen</Text>
                  <TextInput style={s.input} value={origin} onChangeText={setOrigin} placeholder="Ej: Hotel Marriott" />

                  <Text style={s.label}>Destino (sede)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.venueScroll}>
                    {venues.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[s.venueChip, destinationVenueId === v.id && s.venueChipActive]}
                        onPress={() => setDestinationVenueId(v.id)}
                      >
                        <Text style={[s.venueChipText, destinationVenueId === v.id && s.venueChipTextActive]}>
                          {v.name || v.id}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {venues.length === 0 && <Text style={s.metaText}>No hay sedes disponibles.</Text>}

                  <Text style={s.label}>Fecha y hora del servicio</Text>
                  <TextInput
                    style={s.input} value={scheduledAt} onChangeText={setScheduledAt}
                    placeholder="YYYY-MM-DD HH:MM" keyboardType="numbers-and-punctuation"
                  />
                  <Text style={s.hint}>Formato: 2026-03-20 14:30</Text>

                  <Text style={s.label}>Cantidad de pasajeros</Text>
                  <TextInput
                    style={s.input} value={passengerCount} onChangeText={setPassengerCount}
                    keyboardType="numeric" maxLength={3}
                  />

                  <Text style={s.label}>Notas operacionales (opcional)</Text>
                  <TextInput
                    style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={notes} onChangeText={setNotes}
                    placeholder="Indica cualquier detalle relevante..."
                    multiline
                  />

                  <TouchableOpacity style={s.btnPrimary} onPress={submitRequest} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : (
                      <Text style={s.btnPrimaryText}>{editingTripId ? 'Guardar cambios' : 'Enviar solicitud'}</Text>
                    )}
                  </TouchableOpacity>

                  {editingTripId && (
                    <TouchableOpacity style={[s.btnSecondary, { marginTop: 8 }]} onPress={() => { setEditingTripId(null); setOrigin(''); setDestinationVenueId(''); setScheduledAt(''); setPassengerCount('1'); setNotes(''); }}>
                      <Text style={s.btnSecondaryText}>Cancelar edición</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ── Status tab ──────────────────── */}
              {tab === 'status' && (
                <View style={s.card}>
                  <Text style={s.sectionLabel}>Mis viajes ({myTrips.length})</Text>

                  {myTrips.length === 0 && (
                    <Text style={s.emptyText}>No tienes solicitudes aún. Ve a "Nueva solicitud" para pedir un traslado.</Text>
                  )}

                  {myTrips.map((trip) => {
                    const statusColor = STATUS_COLORS[trip.status || ''] || '#94a3b8';
                    const drv = trip.driverId ? drivers[trip.driverId] : null;
                    const veh = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                    const pos = veh ? positionsByVehicle[veh.id] : null;

                    return (
                      <View key={trip.id} style={s.tripCard}>
                        <View style={s.rowBetween}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.tripDest}>{venues.find((v) => v.id === trip.destinationVenueId)?.name || trip.destination || '-'}</Text>
                            <Text style={s.infoMeta}>🕒 {formatDate(trip.scheduledAt)}</Text>
                            <Text style={s.infoMeta}>📍 {trip.origin || '-'}</Text>
                            <Text style={s.infoMeta}>👥 {trip.passengerCount || '-'} pasajero(s)</Text>
                          </View>
                          <View style={[s.badge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[s.badgeText, { color: statusColor }]}>
                              {STATUS_LABELS[trip.status || ''] || trip.status}
                            </Text>
                          </View>
                        </View>

                        {/* Driver / vehicle */}
                        {(drv || veh) && (
                          <View style={s.driverBox}>
                            {drv && <Text style={s.infoMeta}>🧑 Conductor: {drv.fullName || '-'}{drv.phone ? ` · ${drv.phone}` : ''}</Text>}
                            {veh && <Text style={s.infoMeta}>🚐 Vehículo: {[veh.plate, veh.type, veh.brand, veh.model].filter(Boolean).join(' · ')}</Text>}
                          </View>
                        )}

                        {/* Live position */}
                        {pos && (
                          <TouchableOpacity style={s.liveMapBtn} onPress={() => openMaps(pos.lat, pos.lng)}>
                            <Text style={s.liveMapText}>📡 Ver posición en tiempo real → {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</Text>
                          </TouchableOpacity>
                        )}

                        {/* Timestamps */}
                        <View style={s.timestamps}>
                          {trip.requestedAt && <Text style={s.tsText}>Solicitado: {formatDate(trip.requestedAt)}</Text>}
                          {trip.scheduledAt && <Text style={s.tsText}>Programado: {formatDate(trip.scheduledAt)}</Text>}
                          {trip.startedAt && <Text style={s.tsText}>Inicio: {formatDate(trip.startedAt)}</Text>}
                          {trip.completedAt && <Text style={s.tsText}>Cierre: {formatDate(trip.completedAt)}</Text>}
                        </View>

                        {/* Edit / cancel */}
                        {canEdit(trip) && (
                          <View style={s.actionRow}>
                            <TouchableOpacity style={s.actionBtn} onPress={() => startEdit(trip)}>
                              <Text style={s.actionBtnText}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => cancelTrip(trip.id)}>
                              <Text style={[s.actionBtnText, { color: '#ef4444' }]}>✕ Cancelar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[ss.statBox, { borderTopColor: color }]}>
      <Text style={[ss.statValue, { color }]}>{value}</Text>
      <Text style={ss.statLabel}>{label}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  statBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textAlign: 'center', marginTop: 2 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 8 },
  tripCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  metaText: { fontSize: 13, color: '#64748b' },
  infoMeta: { fontSize: 13, color: '#64748b' },
  label: { fontSize: 14, color: '#475569', fontWeight: '500', marginBottom: 4 },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: -8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  btnPrimary: { backgroundColor: '#f59e0b', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { borderWidth: 1.5, borderColor: '#f59e0b', borderRadius: 12, padding: 13, alignItems: 'center' },
  btnSecondaryText: { color: '#f59e0b', fontWeight: '700', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  btnGhostText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  successText: { color: '#10b981', fontSize: 13, marginBottom: 8 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 20, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 14, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#0f172a' },
  vehicleTypes: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  vtBtn: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  vtBtnActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  vtBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  vtBtnTextActive: { color: '#fff' },
  venueScroll: { marginBottom: 12 },
  venueChip: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#f8fafc' },
  venueChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  venueChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  venueChipTextActive: { color: '#fff' },
  editBanner: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, color: '#92400e', fontWeight: '600', fontSize: 13 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  tripDest: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  driverBox: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, gap: 3 },
  liveMapBtn: { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10 },
  liveMapText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  timestamps: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, gap: 2 },
  tsText: { fontSize: 12, color: '#94a3b8' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnDanger: { borderColor: '#fecaca' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },
});
