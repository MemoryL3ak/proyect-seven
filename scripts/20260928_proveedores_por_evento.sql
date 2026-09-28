-- Proveedores por evento (28-09-2026).
--
-- Hasta hoy los proveedores (y sus conductores) eran una sola lista para
-- todos los eventos: al crear World Rugby U20, Proveedores mostraba los de
-- los Juegos Escolares y el desplegable de conductor de AND ofrecía los 80
-- conductores de los Juegos. Ahora cada proveedor guarda los eventos en que
-- trabaja; uno puede estar en varios (BVAN en los Juegos y en Rugby) sin
-- duplicar a sus conductores, que siguen colgando del proveedor.
--
-- Los 19 proveedores existentes se crearon para los Juegos Escolares (todos
-- antes de crear Rugby y con viajes sólo en los Juegos).

alter table core.providers
  add column if not exists event_ids uuid[] not null default '{}';

update core.providers
   set event_ids = array['0e168c10-a7d1-47ae-9784-265a5fc25d9d']::uuid[]
 where cardinality(event_ids) = 0;

create index if not exists providers_event_ids_idx
  on core.providers using gin (event_ids);
