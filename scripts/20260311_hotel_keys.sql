create table if not exists logistics.hotel_keys (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references logistics.accommodations(id) on delete cascade,
  room_id uuid not null references logistics.hotel_rooms(id) on delete cascade,
  bed_id uuid references logistics.hotel_beds(id) on delete set null,
  key_number text not null,
  copy_number int not null default 1,
  label text,
  status text not null default 'AVAILABLE',
  holder_name text,
  holder_type text,
  holder_participant_id uuid references core.athletes(id) on delete set null,
  issued_at timestamptz,
  returned_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table logistics.hotel_keys
    add constraint hotel_keys_room_key_copy_unique
    unique (room_id, key_number, copy_number);
exception when duplicate_object then null;
end $$;

create index if not exists idx_hotel_keys_hotel_id on logistics.hotel_keys(hotel_id);
create index if not exists idx_hotel_keys_room_id on logistics.hotel_keys(room_id);
create index if not exists idx_hotel_keys_status on logistics.hotel_keys(status);

create table if not exists logistics.hotel_key_movements (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references logistics.hotel_keys(id) on delete cascade,
  action text not null,
  holder_name text,
  holder_type text,
  holder_participant_id uuid references core.athletes(id) on delete set null,
  actor_name text,
  notes text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_hotel_key_movements_key_id
  on logistics.hotel_key_movements(key_id);

create index if not exists idx_hotel_key_movements_happened_at
  on logistics.hotel_key_movements(happened_at desc);

alter table logistics.hotel_keys enable row level security;
alter table logistics.hotel_key_movements enable row level security;

do $$
begin
  create policy "hotel_keys_select" on logistics.hotel_keys
    for select
    using (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "hotel_keys_insert" on logistics.hotel_keys
    for insert
    with check (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "hotel_keys_update" on logistics.hotel_keys
    for update
    using (auth.role() in ('authenticated', 'service_role'))
    with check (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "hotel_keys_delete" on logistics.hotel_keys
    for delete
    using (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "hotel_key_movements_select" on logistics.hotel_key_movements
    for select
    using (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "hotel_key_movements_insert" on logistics.hotel_key_movements
    for insert
    with check (auth.role() in ('authenticated', 'service_role'));
exception when duplicate_object then null;
end $$;
