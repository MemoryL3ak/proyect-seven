-- ============================================================================
-- DEMO — Menús del día de hoy y mañana para el portal de participantes/VIP
-- ============================================================================
-- Inserta 8 menús (Desayuno, Almuerzo×2, Cena × 2 días) para poblar la
-- pestaña "Comida" en /portal/user y /portal/vehicle-request.
--
-- NOTA: la tabla logistics.food_menus tiene un check constraint que solo
-- permite meal_type IN ('DESAYUNO','ALMUERZO','CENA'). Si querés agregar
-- 'ONCE' necesitás alterar el constraint primero.
--
-- Las fechas se calculan desde la zona horaria de Chile (-04:00) para que
-- "hoy" coincida con lo que ve el frontend, aunque el server esté en UTC.
--
-- Idempotente: borra primero los registros marcados con "[Seed demo food menus]"
-- en `description`, luego inserta los nuevos.
-- ============================================================================

-- Limpieza de seeds previos
delete from logistics.food_menus
where description like '%[Seed demo food menus]%';

-- Hoy (zona Chile)
insert into logistics.food_menus (date, meal_type, title, description, dietary_type)
values
  ((now() at time zone 'America/Santiago')::date,
   'DESAYUNO',
   'Buffet americano',
   'Huevos revueltos, tostadas integrales, palta, fruta de la estación, café, té y jugo natural de naranja. [Seed demo food menus]',
   'ESTANDAR'),

  ((now() at time zone 'America/Santiago')::date,
   'ALMUERZO',
   'Pollo al limón con quínoa',
   'Pechuga de pollo grillada con salsa de limón y hierbas, quínoa con vegetales salteados, ensalada mixta y postre de frutas. [Seed demo food menus]',
   'ESTANDAR'),

  ((now() at time zone 'America/Santiago')::date,
   'ALMUERZO',
   'Risotto de hongos',
   'Risotto cremoso de hongos shiitake y portobello, espárragos al grill y ensalada verde. Opción vegetariana del día. [Seed demo food menus]',
   'VEGETARIANO'),

  ((now() at time zone 'America/Santiago')::date,
   'CENA',
   'Salmón con puré rústico',
   'Salmón a la plancha, puré rústico de papas con perejil, vegetales asados y postre de tres leches. [Seed demo food menus]',
   'ESTANDAR'),

-- Mañana (zona Chile)
  ((now() at time zone 'America/Santiago')::date + interval '1 day',
   'DESAYUNO',
   'Bowl proteico de avena',
   'Avena cocida con leche descremada, plátano, frutos secos, semillas de chía y miel. Acompaña café o té. [Seed demo food menus]',
   'ESTANDAR'),

  ((now() at time zone 'America/Santiago')::date + interval '1 day',
   'ALMUERZO',
   'Lomo a lo pobre saludable',
   'Lomo vetado a la plancha, papas al horno con romero, huevo pochado, cebolla caramelizada y ensalada chilena. [Seed demo food menus]',
   'ESTANDAR'),

  ((now() at time zone 'America/Santiago')::date + interval '1 day',
   'ALMUERZO',
   'Bowl vegano del huerto',
   'Quínoa, garbanzos crocantes, palta, kale masajeado, tomates cherry, betarraga y aliño de tahini-limón. [Seed demo food menus]',
   'VEGANO'),

  ((now() at time zone 'America/Santiago')::date + interval '1 day',
   'CENA',
   'Pasta primavera',
   'Penne integral con vegetales de la estación, pesto de albahaca casero, queso parmesano y pan de masa madre. [Seed demo food menus]',
   'VEGETARIANO');

-- Verificación: deberían aparecer 8 filas con el marcador
select date, meal_type, title, dietary_type
from logistics.food_menus
where description like '%[Seed demo food menus]%'
order by date, meal_type;
