CREATE TABLE IF NOT EXISTS core.provider_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      UUID NOT NULL REFERENCES core.providers(id) ON DELETE CASCADE,
  full_name        VARCHAR(150) NOT NULL,
  rut              VARCHAR(30),
  country_code     CHAR(3),
  passport_number  TEXT,
  date_of_birth    DATE,
  email            TEXT,
  phone            TEXT,
  user_type        TEXT,
  visa_required    BOOLEAN,
  trip_type        TEXT,
  flight_number    TEXT,
  airline          TEXT,
  origin           TEXT,
  arrival_time     TIMESTAMPTZ,
  departure_time   TIMESTAMPTZ,
  observations     TEXT,
  status           VARCHAR(32) NOT NULL DEFAULT 'REGISTERED',
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON core.provider_participants TO anon, authenticated, service_role;
