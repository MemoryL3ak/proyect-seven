-- ⚠ SUPERSEDIDO (2026-09-01): NO RE-EJECUTAR las policies de este script.
-- Los buckets con datos personales son PRIVADOS desde 20260901_private_buckets.sql;
-- re-crear "provider_documents_public_read" reabriria la lectura del bucket via
-- la API de Storage con la anon key. Ver scripts/20260901_private_buckets.sql.

-- Create Supabase Storage bucket for provider documents (transport type)
-- Run this via the Supabase SQL editor or storage API

insert into storage.buckets (id, name, public)
values ('provider-documents', 'provider-documents', true)
on conflict (id) do nothing;

-- Allow authenticated and anon read access (public bucket)
create policy "provider_documents_public_read"
  on storage.objects for select
  using (bucket_id = 'provider-documents');

-- Allow service role full access (uploads done server-side via service role key)
create policy "provider_documents_service_insert"
  on storage.objects for insert
  with check (bucket_id = 'provider-documents');
