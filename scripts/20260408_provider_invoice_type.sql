-- Add invoice_type and parent_provider_id to providers
ALTER TABLE core.providers ADD COLUMN IF NOT EXISTS invoice_type varchar(30);
ALTER TABLE core.providers ADD COLUMN IF NOT EXISTS parent_provider_id uuid REFERENCES core.providers(id) ON DELETE SET NULL;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('athlete-photos', 'athlete-photos', true)
ON CONFLICT (id) DO NOTHING;
