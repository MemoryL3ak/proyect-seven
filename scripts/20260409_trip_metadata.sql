-- Add metadata column to trips for trip log/bitácora
ALTER TABLE transport.trips
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
