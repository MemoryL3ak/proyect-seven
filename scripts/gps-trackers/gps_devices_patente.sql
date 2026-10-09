-- 09-10-2026 (segunda parte): los equipos GPS se asignan a una PATENTE, no a
-- transport.vehicles (esa tabla está vacía; los viajes y las fichas de los
-- conductores llevan la patente como texto). La tabla también guarda la
-- última posición del equipo, para que se vea aunque el servidor reinicie.
-- Correr en Supabase → SQL Editor después de gps_devices.sql.

alter table telemetry.gps_devices
  add column if not exists plate        text,
  add column if not exists last_lat     double precision,
  add column if not exists last_lng     double precision,
  add column if not exists last_fix_at  timestamptz,
  add column if not exists last_speed   double precision,
  add column if not exists last_heading double precision;

create index if not exists gps_devices_plate_idx on telemetry.gps_devices (plate);

notify pgrst, 'reload schema';

-- Asignar un equipo a una patente (también se puede desde Monitoreo de conductores):
-- update telemetry.gps_devices set plate = 'KBGB58' where imei = '862667088669224';
