-- ============================================================================
-- ROLLBACK de las migraciones del 2026-09-01 (SA-BACKEND-04)
-- SOLO PARA EMERGENCIAS: revierte al estado anterior a
-- 20260901_private_buckets.sql y 20260901_chat_blocks.sql.
--
-- ANTES de correr las migraciones, guarda el estado previo (captura):
--   select id, public from storage.buckets order by id;
--   select policyname from pg_policies
--    where schemaname = 'storage' and tablename = 'objects' order by 1;
-- ============================================================================

-- 1 · Reabrir los buckets (vuelve exactamente al estado previo; no toca archivos).
-- update storage.buckets
--    set public = true
--  where id in ('driver-documents','provider-documents','athlete-photos',
--               'driver-photos','event-documents');

-- 2 · Re-crear las policies eliminadas (definiciones originales en
--     scripts/20260326_provider_documents_bucket.sql y
--     scripts/20260129_schema_updates.sql). Normalmente NO hace falta:
--     las subidas van por service role y no dependen de policies.
-- create policy "provider_documents_public_read"
--   on storage.objects for select using (bucket_id = 'provider-documents');

-- 3 · Eliminar la tabla de bloqueos de chat (aditiva; sin dependencias).
-- drop table if exists core.chat_blocks;

-- Nota: todo está comentado a propósito — descomenta solo lo que necesites
-- revertir. El backend con el interceptor de firmas funciona igual con los
-- buckets públicos o privados, así que revertir buckets NO exige revertir código.
