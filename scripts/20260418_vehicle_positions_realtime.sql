-- ============================================================================
-- Vehicle Positions Realtime — Option B implementation
-- ============================================================================
-- Goal: enable Supabase Realtime on telemetry.vehicle_positions so any client
-- (admin web panel, React Native mobile apps) can subscribe to new GPS
-- positions as they are inserted, without polling the REST API.
--
-- Steps performed:
--   1. Add lat/lng generated columns (plain numerics) so JSON payloads from
--      Realtime are directly consumable. PostGIS geometry doesn't serialize
--      cleanly over logical replication.
--   2. Set REPLICA IDENTITY FULL so Realtime has the full row on every event.
--   3. Add the table to the supabase_realtime publication.
--   4. Enable RLS and create a permissive read policy for authenticated users
--      (admin + mobile app). Tighten later per trip participation if needed.
-- ============================================================================

-- 1. Generated lat/lng columns (PostGIS ST_X / ST_Y are IMMUTABLE, safe for
-- STORED generated columns)
ALTER TABLE telemetry.vehicle_positions
  ADD COLUMN IF NOT EXISTS lat double precision
    GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED;

ALTER TABLE telemetry.vehicle_positions
  ADD COLUMN IF NOT EXISTS lng double precision
    GENERATED ALWAYS AS (ST_X(location::geometry)) STORED;

-- 2. Replica identity full — required for Realtime to emit UPDATE/DELETE with
-- the full previous row. INSERT already emits the full row, but FULL is the
-- safest setting for a tracking table.
ALTER TABLE telemetry.vehicle_positions REPLICA IDENTITY FULL;

-- 3. Add table to the Supabase Realtime publication. Guard against re-adding.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'telemetry'
      AND tablename = 'vehicle_positions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE telemetry.vehicle_positions';
  END IF;
END $$;

-- 4. Row Level Security. Permissive read for any authenticated user — the
-- admin panel and the 4 portals all land here while a viewer holds a valid
-- Supabase session. The backend still writes with service role (bypasses RLS).
ALTER TABLE telemetry.vehicle_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_positions_select_authenticated
  ON telemetry.vehicle_positions;

CREATE POLICY vehicle_positions_select_authenticated
  ON telemetry.vehicle_positions
  FOR SELECT
  TO authenticated
  USING (true);

-- Grants: authenticated role needs USAGE on the schema and SELECT on the
-- table to let Realtime emit changes to the subscriber.
GRANT USAGE ON SCHEMA telemetry TO authenticated;
GRANT SELECT ON telemetry.vehicle_positions TO authenticated;
