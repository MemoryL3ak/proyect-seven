-- ============================================================================
-- DEMO — Viajes de muestra para poblar el Panel de Conductores (heatmap)
-- ============================================================================
-- Este script inserta 12 viajes para una fecha objetivo, distribuidos entre
-- los conductores existentes y diferentes horas del día, para que el "Mapa de
-- Calor & Rankings" muestre actividad.
--
-- IMPORTANTE: es data de demo. En producción los viajes se cargan vía
--   • el módulo Operatividad Diaria (importar planilla Excel), o
--   • la creación manual desde Tracking de Viajes, o
--   • la API /trips desde el portal del conductor.
--
-- Para deshacer: el bloque final tiene el DELETE filtrado por el marcador en
-- `notes`.
-- ============================================================================

-- Parámetros (editá si querés otra fecha u otro evento):
do $$
declare
  -- Hora Chile, NO UTC (el server de Supabase es UTC y current_date te puede
  -- dejar los viajes en una fecha que no es la que el usuario ve en el calendario).
  v_target_date date := (now() at time zone 'America/Santiago')::date;
  v_event_id    uuid;
  v_carlos      uuid;
  v_juan        uuid;
  v_ariel       uuid;
  v_nicolas     uuid;
  v_alex        uuid;
  v_marker      text := 'Seed demo heatmap';
begin
  -- Evento activo o más reciente
  select id into v_event_id
  from core.events
  order by case when status = 'ACTIVE' then 0 else 1 end, created_at desc
  limit 1;

  -- Conductores: provider_participants con metadata.isDriver = true (el panel
  -- los toma desde ahí). Si no existen con esos nombres, ajustá manualmente.
  select id into v_carlos  from core.provider_participants where full_name = 'Carlos Perez'      limit 1;
  select id into v_juan    from core.provider_participants where full_name = 'Juan Díaz'         limit 1;
  select id into v_ariel   from core.provider_participants where full_name = 'Ariel Beroiza'     limit 1;
  select id into v_nicolas from core.provider_participants where full_name = 'Nicolas Rodriguez' limit 1;
  select id into v_alex    from core.provider_participants where full_name = 'Alex Arevalo'      limit 1;

  if v_event_id is null then
    raise exception 'No hay un evento en core.events. Crealo antes de correr este script.';
  end if;

  -- Idempotencia: si ya hay viajes con este marcador para la fecha, los borra
  -- primero. Así correr el script dos veces no duplica.
  delete from transport.trips where notes = v_marker and scheduled_at::date = v_target_date;

  -- Estado válido del enum: SCHEDULED, REQUESTED, EN_ROUTE, PICKED_UP, DROPPED_OFF, COMPLETED
  -- (no existe CANCELLED). Timestamps en zona Chile (-04:00).

  -- ── Carlos Perez ── 4 viajes (alta carga)
  insert into transport.trips
    (event_id, driver_id, origin, destination,
     scheduled_at, started_at, completed_at,
     status, passenger_count, trip_type, client_type, requested_vehicle_type,
     driver_rating, rated_at, notes)
  values
    (v_event_id, v_carlos, 'Villa Panamericana',   'Estadio Nacional',
     (v_target_date || ' 08:00:00-04:00')::timestamptz,
     (v_target_date || ' 08:00:00-04:00')::timestamptz,
     (v_target_date || ' 08:45:00-04:00')::timestamptz,
     'COMPLETED', 4, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', 5,
     (v_target_date || ' 08:45:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_carlos, 'Hotel Sheraton',       'Parque O''Higgins',
     (v_target_date || ' 10:30:00-04:00')::timestamptz,
     (v_target_date || ' 10:30:00-04:00')::timestamptz,
     (v_target_date || ' 11:15:00-04:00')::timestamptz,
     'COMPLETED', 2, 'TRANSFER_IN_OUT', 'VIP', 'M2', 4,
     (v_target_date || ' 11:15:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_carlos, 'Parque Peñalolén',     'Hotel Mandarin Oriental',
     (v_target_date || ' 13:15:00-04:00')::timestamptz,
     (v_target_date || ' 13:15:00-04:00')::timestamptz,
     null, 'EN_ROUTE', 3, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', null, null, v_marker),
    (v_event_id, v_carlos, 'Villa Panamericana',   'Centro de Bowling La Florida',
     (v_target_date || ' 16:00:00-04:00')::timestamptz,
     null, null, 'SCHEDULED', 6, 'TRANSFER_IN_OUT', 'ATHLETE', 'M4', null, null, v_marker);

  -- ── Juan Díaz ── 3 viajes
  insert into transport.trips
    (event_id, driver_id, origin, destination,
     scheduled_at, started_at, completed_at,
     status, passenger_count, trip_type, client_type, requested_vehicle_type,
     driver_rating, rated_at, notes)
  values
    (v_event_id, v_juan, 'Hotel Almacruz',         'Estadio Nacional',
     (v_target_date || ' 07:30:00-04:00')::timestamptz,
     (v_target_date || ' 07:30:00-04:00')::timestamptz,
     (v_target_date || ' 08:15:00-04:00')::timestamptz,
     'COMPLETED', 8, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', 5,
     (v_target_date || ' 08:15:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_juan, 'Aeropuerto SCL',         'Hotel Sheraton',
     (v_target_date || ' 12:00:00-04:00')::timestamptz,
     (v_target_date || ' 12:00:00-04:00')::timestamptz,
     (v_target_date || ' 12:45:00-04:00')::timestamptz,
     'COMPLETED', 2, 'TRANSFER_IN_OUT', 'VIP', 'M2', 4,
     (v_target_date || ' 12:45:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_juan, 'Estadio Español',        'Villa Panamericana',
     (v_target_date || ' 18:00:00-04:00')::timestamptz,
     null, null, 'SCHEDULED', 5, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', null, null, v_marker);

  -- ── Ariel Beroiza ── 2 viajes
  insert into transport.trips
    (event_id, driver_id, origin, destination,
     scheduled_at, started_at, completed_at,
     status, passenger_count, trip_type, client_type, requested_vehicle_type,
     driver_rating, rated_at, notes)
  values
    (v_event_id, v_ariel, 'Hotel Mercure',         'Parque Bicentenario Cerrillos',
     (v_target_date || ' 09:00:00-04:00')::timestamptz,
     (v_target_date || ' 09:00:00-04:00')::timestamptz,
     (v_target_date || ' 09:45:00-04:00')::timestamptz,
     'COMPLETED', 3, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', 5,
     (v_target_date || ' 09:45:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_ariel, 'Centro de Entrenamiento Olímpico', 'Hotel Pullman',
     (v_target_date || ' 14:30:00-04:00')::timestamptz,
     (v_target_date || ' 14:30:00-04:00')::timestamptz,
     null, 'EN_ROUTE', 4, 'TRANSFER_IN_OUT', 'STAFF', 'M3', null, null, v_marker);

  -- ── Nicolas Rodriguez ── 2 viajes
  insert into transport.trips
    (event_id, driver_id, origin, destination,
     scheduled_at, started_at, completed_at,
     status, passenger_count, trip_type, client_type, requested_vehicle_type,
     driver_rating, rated_at, notes)
  values
    (v_event_id, v_nicolas, 'Villa Panamericana',  'Polígono de Tiro Pudahuel',
     (v_target_date || ' 11:00:00-04:00')::timestamptz,
     (v_target_date || ' 11:00:00-04:00')::timestamptz,
     (v_target_date || ' 11:50:00-04:00')::timestamptz,
     'COMPLETED', 6, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', 4,
     (v_target_date || ' 11:50:00-04:00')::timestamptz, v_marker),
    (v_event_id, v_nicolas, 'Hotel Icon',          'Prince of Wales Country Club',
     (v_target_date || ' 15:00:00-04:00')::timestamptz,
     (v_target_date || ' 15:00:00-04:00')::timestamptz,
     null, 'EN_ROUTE', 4, 'TRANSFER_IN_OUT', 'VIP', 'M2', null, null, v_marker);

  -- ── Alex Arevalo ── 1 viaje
  insert into transport.trips
    (event_id, driver_id, origin, destination,
     scheduled_at, started_at, completed_at,
     status, passenger_count, trip_type, client_type, requested_vehicle_type,
     driver_rating, rated_at, notes)
  values
    (v_event_id, v_alex, 'Villa Panamericana',     'Hotel Marriott',
     (v_target_date || ' 17:30:00-04:00')::timestamptz,
     null, null, 'SCHEDULED', 2, 'TRANSFER_IN_OUT', 'ATHLETE', 'M3', null, null, v_marker);

  raise notice 'OK: 12 viajes demo insertados para %', v_target_date;
end$$;

-- ============================================================================
-- LIMPIEZA — borrar todos los viajes generados por este script
-- ============================================================================
-- Descomentá y ejecutá si querés deshacer:
--   delete from transport.trips where notes = 'Seed demo heatmap';
