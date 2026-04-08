-- Add round trip fields to transport.trips
ALTER TABLE transport.trips
  ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_trip_id uuid REFERENCES transport.trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leg_type varchar(20);

-- Index for quickly finding child trips by parent
CREATE INDEX IF NOT EXISTS idx_trips_parent_trip_id ON transport.trips(parent_trip_id) WHERE parent_trip_id IS NOT NULL;
