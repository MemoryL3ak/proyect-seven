-- Trip Requests: solicitudes de viaje T1/VIP generadas desde la app.
-- Tabla independiente para gestionar estas solicitudes por separado de transport.trips.
create extension if not exists pgcrypto;   -- para gen_random_uuid()
create schema if not exists transport;     -- por si el schema aún no existe

create table if not exists transport.trip_requests (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null,
  client_type            varchar(10) not null check (client_type in ('T1', 'VIP')),
  status                 varchar(32) not null default 'REQUESTED',
  requester_athlete_id   uuid,
  origin                 varchar(150),
  destination            varchar(150),
  destination_venue_id   uuid,
  destination_hotel_id   uuid,
  requested_vehicle_type varchar(60),
  passenger_count        integer,
  notes                  text,
  passenger_lat          double precision,
  passenger_lng          double precision,
  scheduled_at           timestamptz,
  requested_at           timestamptz not null default now(),
  driver_id              uuid,
  vehicle_id             uuid,
  vehicle_plate          varchar(20),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_trip_requests_event on transport.trip_requests(event_id);
create index if not exists idx_trip_requests_status on transport.trip_requests(status);
create index if not exists idx_trip_requests_client_type on transport.trip_requests(client_type);
