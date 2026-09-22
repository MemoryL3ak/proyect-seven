-- Horarios de servicio de alimentación.
--
-- Hasta ahora el sistema sabía *qué* se come (logistics.food_menus) pero no
-- *hasta qué hora se puede ir a comer*, que es la pregunta que llega al
-- comedor. El dato vivía en una planilla aparte y se resolvía preguntando.
--
-- Hay un bloque general por tipo de comida y, algunos días, una extensión
-- excepcional que lo reemplaza: el 24-09 el desayuno abre 06:30 en vez de
-- 07:00, el 22-09 la cena abre 18:30 y cierra 23:45. Por eso la fecha es
-- nullable: null = el bloque de todos los días, con fecha = el de ese día.
--
-- COLACIÓN entra acá y no en food_menus: es un bloque horario sin menú
-- propio, y el check de food_menus sólo admite DESAYUNO/ALMUERZO/CENA.

create table if not exists logistics.meal_time_blocks (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references core.events(id) on delete cascade,
  meal_type  text not null check (meal_type in ('DESAYUNO', 'ALMUERZO', 'COLACION', 'CENA')),
  -- null = bloque general del evento; con fecha = extensión de ese día.
  date       date,
  starts_at  time not null,
  ends_at    time not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table logistics.meal_time_blocks is
  'Horarios de servicio por tipo de comida. date null = bloque general; con fecha = extensión excepcional que manda sobre el general ese día.';

-- Un bloque general por comida, y una extensión por comida y día. En índices
-- parciales porque un unique común trata cada null como distinto y dejaría
-- meter dos generales de lo mismo.
create unique index if not exists meal_time_blocks_general_unico
  on logistics.meal_time_blocks (event_id, meal_type)
  where date is null;

create unique index if not exists meal_time_blocks_extension_unica
  on logistics.meal_time_blocks (event_id, meal_type, date)
  where date is not null;

create index if not exists meal_time_blocks_evento_fecha
  on logistics.meal_time_blocks (event_id, date);
