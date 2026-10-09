-- Equipos GPS de vehículo (rastreadores OBD, protocolo GT06). 09-10-2026.
-- Correr en Supabase → SQL Editor. Una fila por equipo (IMEI, el número de la
-- etiqueta); la asignación al vehículo se hace desde el panel o acá.
--
-- El receptor (src/gps-trackers) crea la fila sola la primera vez que el
-- equipo se conecta (vehicle_id vacío); las posiciones se guardan recién
-- cuando el IMEI tiene vehículo.

create table if not exists telemetry.gps_devices (
  imei          text primary key,
  vehicle_id    uuid references transport.vehicles (id) on delete set null,
  label         text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists gps_devices_vehicle_idx on telemetry.gps_devices (vehicle_id);

-- PostgREST (lo que usa el backend) tiene que ver la tabla nueva.
notify pgrst, 'reload schema';

-- Asignar un equipo a un vehículo por patente (ejemplo):
-- update telemetry.gps_devices set vehicle_id = (select id from transport.vehicles where plate = 'KBGB58' limit 1) where imei = '865701681737500';
