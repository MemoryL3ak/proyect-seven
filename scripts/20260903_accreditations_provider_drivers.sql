-- ============================================================================
-- Acreditación de choferes de proveedor (2026-09-03)
-- Ejecutar en el SQL Editor de Supabase.
--
-- core.accreditations.driver_id tenía FK a transport.drivers, por lo que
-- acreditar a un conductor de proveedor (core.provider_participants) fallaba:
--   "violates foreign key constraint accreditations_driver_id_fkey"
-- Se elimina la FK: driver_id puede apuntar a cualquiera de las dos tablas.
-- La existencia se valida en el backend (accreditations.service) y la
-- limpieza al borrar un conductor/participante la hacen sus servicios
-- (antes la hacía el cascade de la FK).
-- ============================================================================

alter table core.accreditations
  drop constraint if exists accreditations_driver_id_fkey;

-- Verificación:
--   select conname from pg_constraint
--    where conrelid = 'core.accreditations'::regclass;
--   → no debe aparecer accreditations_driver_id_fkey.
