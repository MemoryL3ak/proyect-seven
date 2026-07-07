-- ============================================================================
-- Vehicle Positions — relax event_id to nullable
-- ============================================================================
-- The driver app now pushes GPS positions continuously while the driver is
-- logged in, regardless of whether they are currently servicing a trip. In
-- that case event_id may not be known. Make it nullable so positions can be
-- inserted without an event context.
-- ============================================================================

ALTER TABLE telemetry.vehicle_positions
  ALTER COLUMN event_id DROP NOT NULL;
