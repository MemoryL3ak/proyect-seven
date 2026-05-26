-- Presencia de conductores — registra cada sesión de uso de la app del Portal
-- Conductor (independiente de si el chofer inicia o no un viaje).
-- El Portal Conductor envía un "heartbeat" periódico mientras la app está abierta.

create extension if not exists "pgcrypto";

create table if not exists transport.driver_sessions (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null,
  event_id      uuid,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,                       -- null = sesión potencialmente activa
  heartbeats    integer not null default 1,
  app_version   text,
  platform      text,                              -- web | android | ios
  user_agent    text
);

create index if not exists driver_sessions_driver_idx
  on transport.driver_sessions (driver_id, last_seen_at desc);

create index if not exists driver_sessions_active_idx
  on transport.driver_sessions (last_seen_at desc)
  where ended_at is null;
