-- Alimentación por evento (28-09-2026).
--
-- Los menús y los comedores no decían de qué evento eran: la Coordinadora de
-- Transporte de World Rugby veía en la app los menús de los Juegos Escolares
-- en Viña. Ahora cada menú y cada comedor guarda su evento; los que no tienen
-- (null) se ven en todos, como los documentos generales.
--
-- Los 141 menús (22-09-2026) y los 2 comedores (Marina del Rey, LRH) se
-- crearon antes de World Rugby (27-09-2026): son de los Juegos Escolares.

alter table logistics.food_menus
  add column if not exists event_id uuid references core.events(id) on delete set null;

alter table logistics.food_locations
  add column if not exists event_id uuid references core.events(id) on delete set null;

update logistics.food_menus
   set event_id = '0e168c10-a7d1-47ae-9784-265a5fc25d9d'
 where event_id is null
   and created_at < '2026-09-27T06:52:52Z';

update logistics.food_locations
   set event_id = '0e168c10-a7d1-47ae-9784-265a5fc25d9d'
 where event_id is null
   and created_at < '2026-09-27T06:52:52Z';

create index if not exists food_menus_event_id_idx on logistics.food_menus (event_id);
create index if not exists food_locations_event_id_idx on logistics.food_locations (event_id);
