-- Add scheduling fields to disciplines (for sports calendar)
ALTER TABLE core.disciplines
  ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_name    TEXT;
