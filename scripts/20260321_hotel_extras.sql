-- Hotel Extras: catalog of extras available per hotel/villa
create table if not exists logistics.hotel_extras (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references logistics.accommodations(id) on delete cascade,
  name        text not null,
  price       numeric(10, 2) not null default 0,
  quantity    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hotel Extra Reservations: who requested which extra
create table if not exists logistics.hotel_extra_reservations (
  id              uuid primary key default gen_random_uuid(),
  extra_id        uuid not null references logistics.hotel_extras(id) on delete cascade,
  participant_id  uuid not null,
  quantity        integer not null default 1,
  notes           text,
  status          text not null default 'PENDING',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_hotel_extras_hotel_id on logistics.hotel_extras(hotel_id);
create index if not exists idx_hotel_extra_reservations_extra_id on logistics.hotel_extra_reservations(extra_id);
create index if not exists idx_hotel_extra_reservations_participant_id on logistics.hotel_extra_reservations(participant_id);
