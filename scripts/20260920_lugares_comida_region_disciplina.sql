-- Lugares de comida: dirección, y a quién sirven.
--
-- Un comedor no se llena con todo el evento: el Marina del Rey da almuerzo y
-- cena al atletismo de cuatro regiones, el LRH al resto. Hasta ahora el único
-- recorte era el tipo de cliente (TA, TF, Jefe de Misión…), que no distingue
-- región ni deporte, y la dirección no existía aunque el comedor esté en otra
-- comuna que el hotel.
--
-- Los arreglos vacíos significan "sin restricción": el lugar sirve a todas las
-- regiones o a todos los deportes, que es como se comportaban hasta hoy.

alter table logistics.food_locations
  add column if not exists address text,
  add column if not exists delegation_ids uuid[] not null default '{}',
  add column if not exists discipline_ids uuid[] not null default '{}';

comment on column logistics.food_locations.address is
  'Calle y número del comedor; puede diferir del hotel asociado.';
comment on column logistics.food_locations.delegation_ids is
  'Regiones que comen aquí. Vacío = todas.';
comment on column logistics.food_locations.discipline_ids is
  'Deportes que comen aquí. Vacío = todos.';
