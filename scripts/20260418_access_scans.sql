-- ============================================================================
-- Access Control — QR scan registry
-- ============================================================================
-- Stores every QR scan performed by staff at access control checkpoints
-- (venues, hotels, food areas, restricted zones).
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.access_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_by_id uuid NOT NULL,           -- provider_participant.id (staff)
  scanned_by_name text,
  target_type text NOT NULL,             -- 'athlete' | 'driver' | 'provider_participant'
  target_id uuid,
  target_name text,
  target_code text NOT NULL,             -- last 6 chars from the QR
  location text,                         -- checkpoint / venue / gate
  authorized boolean NOT NULL DEFAULT false,
  reason text,                           -- 'OK' | 'NOT_FOUND' | 'CREDENTIAL_INVALID' | ...
  metadata jsonb DEFAULT '{}'::jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_scans_scanned_at
  ON core.access_scans (scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_scans_target
  ON core.access_scans (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_access_scans_scanned_by
  ON core.access_scans (scanned_by_id);
