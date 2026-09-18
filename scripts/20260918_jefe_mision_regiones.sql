-- Juegos Deportivos Escolares 2026: delegaciones por región y vista del Jefe de Misión.
--
-- Decisiones de producto (Ariel, 18-09-2026):
--  * Las delegaciones son las regiones de Chile; cada una tiene un Jefe de Misión.
--  * La flota (vehículos y choferes) se asigna fija a una región durante todo el evento.
--  * El Jefe de Misión ve y reporta incidencias; ve las sedes con su coordinador,
--    la alimentación de su delegación, el cuaderno de cargo (PDF) y el calendario
--    de su región.

-- 1. Código de delegación: admite ISO 3166-2 ("CL-VS") además de países ("CHL").
alter table core.delegations alter column country_code type varchar(8);

-- 2. Flota fija por delegación.
alter table core.provider_participants
  add column if not exists delegation_id uuid references core.delegations(id) on delete set null;
create index if not exists idx_provider_participants_delegation
  on core.provider_participants (delegation_id);

alter table transport.vehicles
  add column if not exists delegation_id uuid references core.delegations(id) on delete set null;
create index if not exists idx_vehicles_delegation on transport.vehicles (delegation_id);

-- 3. Coordinador de sede (el Coordinador General sale del rol de usuario).
alter table logistics.venues
  add column if not exists coordinator_name text,
  add column if not exists coordinator_phone text;

-- 4. Incidencias (antes solo existía una pantalla sin persistencia).
create table if not exists core.incidents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references core.events(id) on delete cascade,
  delegation_id uuid references core.delegations(id) on delete set null,
  venue_id uuid references logistics.venues(id) on delete set null,
  trip_id uuid references transport.trips(id) on delete set null,
  category text not null default 'OTRO',        -- TRANSPORTE | SEDE | ALIMENTACION | ALOJAMIENTO | SALUD | SEGURIDAD | OTRO
  severity text not null default 'MEDIA',       -- BAJA | MEDIA | ALTA | CRITICA
  status text not null default 'ABIERTA',       -- ABIERTA | EN_CURSO | RESUELTA | CERRADA
  title text not null,
  description text,
  reported_by_id text,                          -- uid de Supabase Auth (staff) o id de portal
  reported_by_name text,
  reported_by_role text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_incidents_event_created on core.incidents (event_id, created_at desc);
create index if not exists idx_incidents_delegation on core.incidents (delegation_id);

-- 5. Calendario por región: regiones que participan en cada fila del calendario.
alter table core.sports_calendar_events
  add column if not exists delegation_ids uuid[] not null default '{}'::uuid[];
create index if not exists idx_sports_calendar_delegations
  on core.sports_calendar_events using gin (delegation_ids);

-- 6. Alimentación por delegación: hoteles donde se aloja y come cada región.
create table if not exists core.delegation_accommodations (
  delegation_id uuid not null references core.delegations(id) on delete cascade,
  accommodation_id uuid not null references logistics.accommodations(id) on delete cascade,
  primary key (delegation_id, accommodation_id)
);

-- 2b. Los choferes también viven en transport.drivers (además de
-- core.provider_participants): la flota fija necesita la columna en ambas.
-- Faltaba en la primera versión de este script y GET /delegations y GET /drivers
-- respondían 500 ("column delegation_id does not exist").
alter table transport.drivers
  add column if not exists delegation_id uuid references core.delegations(id) on delete set null;
create index if not exists idx_drivers_delegation on transport.drivers (delegation_id);
