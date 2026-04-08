-- Committee validation fields for trips
ALTER TABLE transport.trips
  ADD COLUMN IF NOT EXISTS committee_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS committee_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS committee_validated_by varchar(150);
