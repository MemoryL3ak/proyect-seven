-- Venues master + trip requests stored in transport.trips.

create schema if not exists logistics;

create table if not exists logistics.venues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references core.events(id) on delete cascade,
  name text not null,
  address text,
  region text,
  commune text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists logistics.venues
  add column if not exists address text;

alter table if exists logistics.venues
  add column if not exists region text;

alter table if exists logistics.venues
  add column if not exists commune text;

alter table if exists logistics.venues
  add column if not exists created_at timestamptz not null default now();

alter table if exists logistics.venues
  add column if not exists updated_at timestamptz not null default now();

create index if not exists venues_event_idx on logistics.venues (event_id);

alter table transport.trips
  alter column driver_id drop not null;

alter table transport.trips
  alter column vehicle_id drop not null;

do $$
declare
  status_type_name text;
  status_type_schema text;
  status_type_kind "char";
begin
  select t.typname, n.nspname, t.typtype
  into status_type_name, status_type_schema, status_type_kind
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'transport'
    and c.relname = 'trips'
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if status_type_kind = 'e' then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'REQUESTED'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'REQUESTED');
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'EN_ROUTE'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'EN_ROUTE');
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'PICKED_UP'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'PICKED_UP');
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'DROPPED_OFF'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'DROPPED_OFF');
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'COMPLETED'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'COMPLETED');
    end if;
  end if;
end $$;

alter table transport.trips
  add column if not exists requester_athlete_id uuid references core.athletes(id) on delete set null,
  add column if not exists destination_venue_id uuid references logistics.venues(id) on delete set null,
  add column if not exists requested_vehicle_type text,
  add column if not exists passenger_count integer,
  add column if not exists notes text,
  add column if not exists requested_at timestamptz not null default now();

create index if not exists trips_requester_athlete_idx on transport.trips (requester_athlete_id);
create index if not exists trips_destination_venue_idx on transport.trips (destination_venue_id);
