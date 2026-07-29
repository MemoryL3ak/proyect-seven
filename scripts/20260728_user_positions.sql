-- Tracking permanente de usuarios VIP: el portal reporta la ubicación del
-- teléfono en forma periódica (no sólo durante un viaje). La lee el
-- monitoreo en /operations/vip-monitoring vía GET /vip-monitoring/snapshot.
create table if not exists telemetry.user_positions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  "timestamp" timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_positions_athlete_ts
  on telemetry.user_positions (athlete_id, "timestamp" desc);

comment on table telemetry.user_positions is
  'Posiciones GPS reportadas por el portal del usuario (tracking VIP permanente).';
