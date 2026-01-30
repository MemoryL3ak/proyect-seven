-- Schema updates for athletes, accommodations, trips, drivers, and providers.

-- Athletes: luggage type, user type, room/bed typing.
alter table core.athletes
  add column if not exists luggage_type text,
  add column if not exists user_type text,
  add column if not exists room_type text,
  add column if not exists bed_type text,
  add column if not exists is_delegation_lead boolean not null default false;

-- Accommodations: address and inventory by room/bed type.
alter table logistics.accommodations
  add column if not exists address text,
  add column if not exists room_inventory jsonb default '{}'::jsonb,
  add column if not exists bed_inventory jsonb default '{}'::jsonb;

-- Trips: trip type and client type.
alter table transport.trips
  add column if not exists trip_type text,
  add column if not exists client_type text;

-- Vehicles: brand and model.
alter table transport.vehicles
  add column if not exists brand text,
  add column if not exists model text;

-- Drivers: vehicle link + photo.
alter table transport.drivers
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
