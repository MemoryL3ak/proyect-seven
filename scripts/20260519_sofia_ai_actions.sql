-- SofIA — capa de acciones operativas, auditoría y notificaciones.
-- Habilita que el asistente ejecute operaciones de escritura dejando rastro
-- auditable y permita deshacer las acciones reversibles.

create extension if not exists "pgcrypto";

-- ── Log de auditoría de todas las acciones ejecutadas por SofIA ──────────────
create table if not exists public.sofia_action_log (
  id          uuid primary key default gen_random_uuid(),
  tool        text not null,
  args        jsonb not null default '{}'::jsonb,
  result      jsonb,
  status      text not null default 'success',   -- success | error
  error       text,
  summary     text,
  undo_tool   text,                              -- tool inverso, si la acción es reversible
  undo_args   jsonb,
  undone      boolean not null default false,
  undone_at   timestamptz,
  actor       text default 'SofIA',
  created_at  timestamptz not null default now()
);

create index if not exists sofia_action_log_created_idx
  on public.sofia_action_log (created_at desc);

-- ── Notificaciones que SofIA dispara a conductores / usuarios ────────────────
create table if not exists public.sofia_notifications (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null,                     -- driver | user | all
  target_id   uuid,                              -- driver_id o athlete_id (null = broadcast)
  title       text not null,
  body        text not null,
  channel     text not null default 'inapp',     -- inapp | push
  priority    text not null default 'normal',    -- normal | high
  read        boolean not null default false,
  created_by  text default 'SofIA',
  created_at  timestamptz not null default now()
);

create index if not exists sofia_notifications_target_idx
  on public.sofia_notifications (target_id, read);
create index if not exists sofia_notifications_created_idx
  on public.sofia_notifications (created_at desc);
