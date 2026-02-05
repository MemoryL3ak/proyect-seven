-- Schema updates for athletes, accommodations, trips, drivers, and providers.

-- Athletes: luggage type, user type, room/bed typing.
alter table core.athletes
  add column if not exists luggage_type text,
  add column if not exists luggage_notes text,
  add column if not exists user_type text,
  add column if not exists room_type text,
  add column if not exists bed_type text,
  add column if not exists is_delegation_lead boolean not null default false,
  add column if not exists discipline_id uuid references core.disciplines(id),
  add column if not exists departure_time timestamptz,
  add column if not exists departure_gate text,
  add column if not exists arrival_baggage text;

-- Events: country and city.
alter table core.events
  add column if not exists country text,
  add column if not exists city text;

-- Disciplines: event link, category, and gender.
alter table core.disciplines
  add column if not exists event_id uuid references core.events(id) on delete cascade,
  add column if not exists category text,
  add column if not exists gender text;

-- Accommodations: address and inventory by room/bed type.
alter table logistics.accommodations
  add column if not exists address text,
  add column if not exists room_inventory jsonb default '{}'::jsonb,
  add column if not exists bed_inventory jsonb default '{}'::jsonb;

-- Trips: trip type and client type.
alter table transport.trips
  add column if not exists trip_type text,
  add column if not exists client_type text,
  add column if not exists trip_cost numeric;

-- Vehicles: brand and model.
alter table transport.vehicles
  add column if not exists brand text,
  add column if not exists model text;

-- Drivers: vehicle link + photo.
alter table transport.drivers
  add column if not exists provider_id uuid references core.providers(id),
  add column if not exists vehicle_id uuid,
  add column if not exists photo_url text;

-- Providers table.
create table if not exists core.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  rut text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supabase storage bucket for driver photos (public).
insert into storage.buckets (id, name, public)
values ('driver-photos', 'driver-photos', true)
on conflict (id) do nothing;

-- Storage policies for driver photos.
do $$
begin
  create policy "driver_photos_insert"
    on storage.objects for insert
    with check (bucket_id = 'driver-photos');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "driver_photos_update"
    on storage.objects for update
    using (bucket_id = 'driver-photos');
exception when duplicate_object then null;
end $$;

-- Hotel rooms and bed-level tracking.
alter table logistics.hotel_rooms
  add column if not exists base_bed_type text;

create table if not exists logistics.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references logistics.accommodations(id) on delete cascade,
  room_number text not null,
  room_type text not null,
  beds_capacity int not null default 1,
  base_bed_type text,
  status text not null default 'AVAILABLE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists logistics.hotel_beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references logistics.hotel_rooms(id) on delete cascade,
  bed_type text not null,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists logistics.hotel_assignments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references core.athletes(id) on delete cascade,
  hotel_id uuid not null references logistics.accommodations(id) on delete cascade,
  room_id uuid references logistics.hotel_rooms(id) on delete set null,
  bed_id uuid references logistics.hotel_beds(id) on delete set null,
  checkin_at timestamptz,
  checkout_at timestamptz,
  status text not null default 'ASSIGNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table logistics.hotel_assignments
    add constraint hotel_assignments_participant_unique unique (participant_id);
exception when duplicate_object then null;
end $$;
