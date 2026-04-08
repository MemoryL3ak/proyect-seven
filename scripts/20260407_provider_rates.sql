-- Provider rate table: tariffs per fleet type + trip type
CREATE TABLE IF NOT EXISTS core.provider_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES core.providers(id) ON DELETE CASCADE,
  fleet_type varchar(30) NOT NULL,
  passenger_range varchar(30),
  trip_type varchar(40) NOT NULL,
  client_price numeric NOT NULL DEFAULT 0,
  provider_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_rates_provider_id ON core.provider_rates(provider_id);

-- Add bid_amount and bid_trip_count columns to providers if not exists
ALTER TABLE core.providers
  ADD COLUMN IF NOT EXISTS bid_amount numeric,
  ADD COLUMN IF NOT EXISTS bid_trip_count integer;
