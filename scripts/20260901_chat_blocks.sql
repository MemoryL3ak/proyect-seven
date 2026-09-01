-- ============================================================================
-- SA-BACKEND-04 · 2 — Bloqueo de chat de viaje persistido en BD (2026-09-01)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Reemplaza el registro en localStorage: el bloqueo queda asociado a usuario
-- y viaje y acompaña al usuario en cualquier dispositivo. El caso de soporte
-- que se abre al bloquear sigue siendo el registro auditable del hecho.
-- ============================================================================

create table if not exists core.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  -- Identidad del que bloquea, tal como la resuelve el guard de la API:
  -- 'athlete' | 'driver' | 'staff' + id del participante (o usuario de panel).
  user_kind text not null check (user_kind in ('athlete', 'driver', 'staff')),
  user_id uuid not null,
  trip_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_kind, user_id, trip_id)
);

create index if not exists chat_blocks_trip_idx on core.chat_blocks (trip_id);

-- Verificación:
--   select * from core.chat_blocks limit 5;
