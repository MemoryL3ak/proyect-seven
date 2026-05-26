-- Operatividad diaria de transporte:
--   1) Tipos de cliente permitidos por chofer (para auto-asignación).
--   2) Campos enriquecidos en viajes (CSV con horarios deportivos).
--   3) Auditoría de corridas de auto-asignación.
--
-- Tipos de cliente válidos:
--   TF  — Oficiales Técnicos
--   TM  — Medios (prensa)
--   TA  — Team Atleta
--   VIP — VIPs/Autoridades
--   T1
--   FAMILIA_PARAPAN
--   COMITE_ORGANIZADOR
--   PROVEEDORES

-- 1) Drivers
alter table transport.drivers
  add column if not exists allowed_client_types text[] default '{}';

create index if not exists idx_drivers_allowed_client_types
  on transport.drivers using gin (allowed_client_types);

comment on column transport.drivers.allowed_client_types
  is 'Lista de tipos de cliente que este chofer está autorizado a transportar (TF/TM/TA/VIP/T1/...).';

-- 2) Trips: campos enriquecidos del CSV de operación diaria
alter table transport.trips
  add column if not exists presentation_at  timestamptz,
  add column if not exists return_at        timestamptz,
  add column if not exists travel_time_minutes int,
  add column if not exists fleet_acronym    text,
  add column if not exists wheelchair_count int default 0,
  add column if not exists discipline       text,
  add column if not exists activity         text,
  add column if not exists trip_date        date;

create index if not exists idx_trips_trip_date
  on transport.trips (trip_date);

create index if not exists idx_trips_scheduled_at
  on transport.trips (scheduled_at);

create index if not exists idx_trips_driver_scheduled
  on transport.trips (driver_id, scheduled_at) where driver_id is not null;

comment on column transport.trips.presentation_at
  is 'Hora de presentación del bus en el origen (CSV columna "Presentación").';

comment on column transport.trips.return_at
  is 'Hora estimada de regreso, si el viaje genera retorno (CSV columna "Regresar a las").';

comment on column transport.trips.travel_time_minutes
  is 'Tiempo de traslado estimado en minutos (CSV columna "T° Traslado").';

comment on column transport.trips.fleet_acronym
  is 'Acrónimo de flota requerido (M1=Van, M4=Bus 44, M5=Van Adaptada). CSV columna "Acronimo flota".';

comment on column transport.trips.wheelchair_count
  is 'Cantidad de pasajeros que requieren silla de ruedas (CSV columna "Sillas de rueda").';

comment on column transport.trips.discipline
  is 'Disciplina deportiva asociada al viaje (CSV columna "Disciplina").';

comment on column transport.trips.activity
  is 'Tipo de actividad: Competencia, Entrenamiento, Ceremonia (CSV columna "Actividad").';

comment on column transport.trips.trip_date
  is 'Fecha del viaje (CSV columna "Fecha") — denormalizado para indexado eficiente del dashboard diario.';

-- 3) Auditoría de corridas de auto-asignación
create table if not exists transport.driver_assignment_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  run_at timestamptz not null default now(),
  date_filter date,
  params jsonb not null default '{}'::jsonb,
  assigned_count int not null default 0,
  unassigned_count int not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_by text
);

create index if not exists idx_driver_assignment_runs_date
  on transport.driver_assignment_runs (date_filter);

comment on table transport.driver_assignment_runs
  is 'Registro histórico de cada ejecución del motor de auto-asignación de choferes a viajes.';
