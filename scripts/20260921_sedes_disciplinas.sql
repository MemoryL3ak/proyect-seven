-- Disciplinas de una sede: ahora se asignan, no se adivinan.
--
-- Hasta hoy el portal deducía qué deportes se ven en un recinto recorriendo
-- las pruebas y mirando su `venue_name`, un calce por texto: si alguien
-- corregía el nombre de la sede en el módulo Sede, los deportes desaparecían
-- sin aviso, y una sede sin pruebas cargadas nunca mostraba nada aunque se
-- supiera de antemano qué se compite ahí.
--
-- La asignación pasa a ser un dato propio de la sede, editable en Sede.
-- Mismo patrón que logistics.food_locations.discipline_ids.

alter table logistics.venues
  add column if not exists discipline_ids uuid[] not null default '{}';

comment on column logistics.venues.discipline_ids is
  'Deportes que se compiten en esta sede. Se asignan al editar la sede; vacío = sin disciplinas declaradas.';

-- ---------------------------------------------------------------------------
-- OPCIONAL — arrastre desde el calce viejo por nombre.
--
-- Deshabilitado a propósito: reponer lo que se dedujo del texto vuelve a meter
-- los mismos errores que motivaron el cambio (el Elías Figueroa aparecía con
-- Atletismo cuando el cuaderno de cargo lo tiene como sede de Fútbol). Correlo
-- sólo si preferís partir de esa base y corregir a mano después.
-- ---------------------------------------------------------------------------
-- update logistics.venues v
--    set discipline_ids = sub.ids
--   from (
--     select vv.id as venue_id, array_agg(distinct coalesce(d.parent_id, d.id)) as ids
--       from logistics.venues vv
--       join core.disciplines d
--         on lower(btrim(regexp_replace(d.venue_name, '\s+', ' ', 'g')))
--          = lower(btrim(regexp_replace(vv.name,      '\s+', ' ', 'g')))
--      where d.venue_name is not null
--      group by vv.id
--   ) sub
--  where v.id = sub.venue_id
--    and v.discipline_ids = '{}';
