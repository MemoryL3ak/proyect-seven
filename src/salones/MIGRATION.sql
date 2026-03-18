-- Run this in Supabase SQL Editor

create table if not exists logistics.salones (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references logistics.accommodations(id) on delete cascade,
  name        text not null,
  type        text not null default 'SALA_REUNION',
  capacity    integer not null default 0,
  status      text not null default 'ACTIVE',
  floor       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists logistics.salon_reservations (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references logistics.salones(id) on delete cascade,
  title            text not null,
  organizer_name   text,
  organizer_email  text,
  event_id         uuid,
  start_date       date not null,
  end_date         date not null,
  start_time       time not null,
  end_time         time not null,
  attendees        integer,
  status           text not null default 'CONFIRMED',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
