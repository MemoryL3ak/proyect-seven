-- ============================================================================
-- Premiaciones — ceremonies of award and VIP award teams
-- ============================================================================
-- Each sports event (prueba) in the calendar may have an associated award
-- ceremony. A ceremony has date/time/venue and a team of VIP participants
-- assigned as awarders (gold/silver/bronze/authority).
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.premiaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  sports_event_id uuid,                  -- FK sports_calendar_events (soft)
  discipline_id uuid,                    -- FK disciplines (soft) — prueba asociada
  title text NOT NULL,                   -- e.g. "Premiación 100m Planos Femenino"
  discipline text,
  scheduled_at timestamptz NOT NULL,
  venue_id uuid,                         -- FK venues (soft)
  venue_name text,
  location_detail text,                  -- "Zona central — Tarima 1"
  status text NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premiaciones_scheduled_at
  ON core.premiaciones (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_premiaciones_sports_event
  ON core.premiaciones (sports_event_id);

-- Si la tabla ya existía sin discipline_id, añadirla antes de indexar
ALTER TABLE core.premiaciones
  ADD COLUMN IF NOT EXISTS discipline_id uuid;

CREATE INDEX IF NOT EXISTS idx_premiaciones_discipline
  ON core.premiaciones (discipline_id);

CREATE TABLE IF NOT EXISTS core.premiacion_awarders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  premiacion_id uuid NOT NULL REFERENCES core.premiaciones(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL,              -- VIP athlete
  role text NOT NULL DEFAULT 'AWARDER',  -- GOLD | SILVER | BRONZE | AUTHORITY | AWARDER
  confirmed_at timestamptz,
  declined_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_premiacion_awarders_pair
  ON core.premiacion_awarders (premiacion_id, athlete_id);

CREATE INDEX IF NOT EXISTS idx_premiacion_awarders_athlete
  ON core.premiacion_awarders (athlete_id);
