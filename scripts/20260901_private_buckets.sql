-- ============================================================================
-- SA-BACKEND-04 · 1 — Buckets privados con URLs firmadas (2026-09-01)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Pasa a privados los buckets con datos personales. Las URLs persistidas en
-- metadata (forma pública) dejan de ser accesibles directamente; la API las
-- convierte en URLs firmadas de vigencia limitada al responder
-- (SignedStorageUrlInterceptor, global). `venue-photos` (fotos de hoteles y
-- recintos, sin datos personales) queda público deliberadamente.
-- ============================================================================

update storage.buckets
   set public = false
 where id in (
   'driver-documents',
   'provider-documents',
   'athlete-photos',
   'driver-photos',
   'event-documents'
 );

-- Policies heredadas que quedan obsoletas o eran inseguras:
--  · provider_documents_public_read: lectura pública del bucket (objetivo de
--    esta migración eliminarla).
--  · driver_photos_insert / driver_photos_update / provider_documents_service_insert:
--    sin restricción de rol, permitían a CUALQUIER rol (incluido anon) subir o
--    modificar archivos vía la API de Storage. Las subidas reales van por el
--    backend con service role, que no pasa por RLS: no se necesitan policies.
drop policy if exists "provider_documents_public_read" on storage.objects;
drop policy if exists "provider_documents_service_insert" on storage.objects;
drop policy if exists "driver_photos_insert" on storage.objects;
drop policy if exists "driver_photos_update" on storage.objects;

-- Verificación:
--   select id, public from storage.buckets order by id;
--   → public = false en los cinco buckets de arriba (y en athlete-health-docs);
--     public = true solo en venue-photos.
--   select policyname from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
--   → no deben aparecer las cuatro policies eliminadas.
