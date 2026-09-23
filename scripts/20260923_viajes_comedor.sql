-- Viajes: origen y destino pueden ser un comedor.
--
-- Un traslado al almuerzo no va a una sede ni a un hotel: va al comedor, que
-- vive en Alimentación (logistics.food_locations). Sin estas columnas la
-- planilla dejaba "Comedor LRH (EX GALA)" sólo como texto y ningún filtro por
-- lugar lo encontraba; el formulario ofrecía "Comedor" como tipo, pero sin
-- nada a lo que apuntar. Correr ANTES de 20260923_viajes_lugares_por_nombre.sql.

alter table transport.trips
  add column if not exists origin_food_location_id uuid
    references logistics.food_locations(id) on delete set null;

alter table transport.trips
  add column if not exists destination_food_location_id uuid
    references logistics.food_locations(id) on delete set null;

create index if not exists idx_trips_origin_food_location on transport.trips (origin_food_location_id);
create index if not exists idx_trips_destination_food_location on transport.trips (destination_food_location_id);
