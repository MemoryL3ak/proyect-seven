-- ============================================================================
-- SA-BACKEND-01 · Requisito 1 — bucket privado para documentos médicos
-- ============================================================================
-- La revisión constató que athlete-health-docs no existe en storage.buckets
-- (nunca se creó en este entorno: la subida de fichas médicas fallaba y las
-- URLs públicas persistidas no eran operativas — escenario 1.5.2, sin
-- exposición efectiva).
--
-- Este script lo deja creado y PRIVADO, versionado en el repositorio (cierra
-- también la observación 1.2.2). Si existiera de una creación manual previa,
-- el ON CONFLICT lo fuerza a privado.
--
-- Los documentos se sirven desde ahora mediante URLs firmadas de vigencia
-- limitada: GET /athletes/:id/health-document-url (staff del panel o el
-- propio atleta con su sesión de portal). El código ya no usa getPublicUrl()
-- para este bucket.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('athlete-health-docs', 'athlete-health-docs', false)
on conflict (id) do update set public = false;

-- Verificación:
--   select id, public from storage.buckets where id = 'athlete-health-docs';
-- Debe devolver public = false.
