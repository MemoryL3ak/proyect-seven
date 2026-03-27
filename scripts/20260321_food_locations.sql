-- Food Locations: dining venues with assigned client types, linked to a hotel/villa
create table if not exists logistics.food_locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  capacity     integer,
  client_types text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Add accommodation_id column if it was not created yet
alter table logistics.food_locations
  add column if not exists accommodation_id uuid references logistics.accommodations(id) on delete set null;

create index if not exists idx_food_locations_accommodation on logistics.food_locations(accommodation_id);
create index if not exists idx_food_locations_client_types on logistics.food_locations using gin(client_types);
