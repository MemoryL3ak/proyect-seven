-- Drop from wrong schema if it was created
DROP TABLE IF EXISTS logistics.flights;

-- Create flights table in transport schema (same schema as trips)
CREATE TABLE IF NOT EXISTS transport.flights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL,
  flight_number VARCHAR(20) NOT NULL,
  airline       VARCHAR(100) NOT NULL,
  arrival_time  TIMESTAMPTZ NOT NULL,
  origin        VARCHAR(100) NOT NULL,
  terminal      VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
