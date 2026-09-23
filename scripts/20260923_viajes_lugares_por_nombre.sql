-- Viajes: darles el id de la sede o el hotel al que apuntan, por nombre.
--
-- Los 330 viajes de la primera planilla de operatividad entraron con origen y
-- destino sólo como texto ("Estadio Elías Figueroa Brander", "Hotel Ankara"):
-- el importador no los cruzaba con el catálogo. Sin id, los filtros por lugar
-- del portal no tenían con qué calzar y el detalle mostraba la dirección en
-- vez del recinto. El importador ya resuelve el id al cargar; este script
-- arregla lo que ya está cargado.
--
-- Regla: nombre EXACTO contra logistics.venues y logistics.accommodations del
-- mismo evento, comparando sin tildes, sin mayúsculas y sin dobles espacios.
-- No se adivinan parecidos: un texto que calza con cero o con dos lugares se
-- deja como está. Los comedores ("Comedor LRH (EX GALA)") viven en
-- Alimentación y el viaje no tiene columna para eso: quedan sin id a propósito.
--
-- Sólo toca viajes de planilla (metadata ? 'importedAt'), que son los que no
-- traían ningún id; los cargados a mano ya vienen con el suyo. Deja marca en
-- metadata para poder revertir.
--
-- CÓMO CORRERLO: por pasos. Los pasos 1 y 2 sólo muestran; el 3 escribe.

-- ─────────────────────────────────────────────────────────────────────────
-- Normalización compartida por todos los pasos (como función temporal).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function pg_temp.clave_lugar(txt text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(
    translate(coalesce(txt, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
    '\s+', ' ', 'g')))
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Qué texto calza con qué lugar, y cuáles quedan sin calce.
-- ─────────────────────────────────────────────────────────────────────────
with lugares as (
  select event_id, id, name, 'SEDE'  as tipo, pg_temp.clave_lugar(name) as clave from logistics.venues
  union all
  select event_id, id, name, 'HOTEL' as tipo, pg_temp.clave_lugar(name) as clave from logistics.accommodations
),
textos as (
  select t.event_id, x.texto, count(*) as viajes
  from transport.trips t
  cross join lateral (values (t.origin), (t.destination)) as x(texto)
  where t.metadata ? 'importedAt' and coalesce(btrim(x.texto), '') <> ''
  group by 1, 2
)
select
  x.texto                                         as texto_planilla,
  x.viajes                                        as extremos,
  string_agg(l.tipo || ': ' || l.name, ' | ')     as calza_con,
  count(l.id)                                     as candidatos
from textos x
left join lugares l on l.event_id = x.event_id and l.clave = pg_temp.clave_lugar(x.texto)
group by 1, 2
order by 4 desc, 2 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Cuántos viajes recibirían id en cada extremo.
-- ─────────────────────────────────────────────────────────────────────────
with lugares as (
  select event_id, id, 'SEDE'  as tipo, pg_temp.clave_lugar(name) as clave from logistics.venues
  union all
  select event_id, id, 'HOTEL' as tipo, pg_temp.clave_lugar(name) as clave from logistics.accommodations
),
unicos as (
  -- Postgres no tiene min(uuid); con count(*) = 1 el array trae uno solo.
  select event_id, clave, (array_agg(id))[1] as id, (array_agg(tipo))[1] as tipo
  from lugares group by 1, 2 having count(*) = 1
)
select
  count(*)                                                        as viajes_planilla,
  count(o.id)                                                     as origen_con_id,
  count(d.id)                                                     as destino_con_id,
  count(*) filter (where o.id is null and d.id is null)           as sin_ningun_calce
from transport.trips t
left join unicos o on o.event_id = t.event_id and o.clave = pg_temp.clave_lugar(t.origin)
left join unicos d on d.event_id = t.event_id and d.clave = pg_temp.clave_lugar(t.destination)
where t.metadata ? 'importedAt';

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — La actualización. Sólo viajes de planilla; sólo extremos con calce
-- único; deja marca en metadata.
-- ─────────────────────────────────────────────────────────────────────────
with lugares as (
  select event_id, id, 'SEDE'  as tipo, pg_temp.clave_lugar(name) as clave from logistics.venues
  union all
  select event_id, id, 'HOTEL' as tipo, pg_temp.clave_lugar(name) as clave from logistics.accommodations
),
unicos as (
  -- Postgres no tiene min(uuid); con count(*) = 1 el array trae uno solo.
  select event_id, clave, (array_agg(id))[1] as id, (array_agg(tipo))[1] as tipo
  from lugares group by 1, 2 having count(*) = 1
),
calces as (
  select t.id as trip_id,
         case when o.tipo = 'SEDE'  then o.id end as origin_venue_id,
         case when o.tipo = 'HOTEL' then o.id end as origin_hotel_id,
         case when d.tipo = 'SEDE'  then d.id end as destination_venue_id,
         case when d.tipo = 'HOTEL' then d.id end as destination_hotel_id
  from transport.trips t
  left join unicos o on o.event_id = t.event_id and o.clave = pg_temp.clave_lugar(t.origin)
  left join unicos d on d.event_id = t.event_id and d.clave = pg_temp.clave_lugar(t.destination)
  where t.metadata ? 'importedAt'
    and (o.id is not null or d.id is not null)
)
update transport.trips t
set origin_venue_id      = coalesce(t.origin_venue_id, c.origin_venue_id),
    origin_hotel_id      = coalesce(t.origin_hotel_id, c.origin_hotel_id),
    destination_venue_id = coalesce(t.destination_venue_id, c.destination_venue_id),
    destination_hotel_id = coalesce(t.destination_hotel_id, c.destination_hotel_id),
    metadata             = coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object(
                             'lugaresFrom', 'nombre exacto contra el catálogo (20260923)',
                             'lugaresFixedAt', now()
                           ),
    updated_at           = now()
from calces c
where c.trip_id = t.id;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 4 — Verificación.
-- ─────────────────────────────────────────────────────────────────────────
select
  count(*)                                   as viajes_planilla,
  count(*) filter (where metadata ? 'lugaresFrom') as corregidos,
  count(origin_venue_id) + count(origin_hotel_id)           as origen_con_id,
  count(destination_venue_id) + count(destination_hotel_id) as destino_con_id
from transport.trips where metadata ? 'importedAt';

-- ─────────────────────────────────────────────────────────────────────────
-- CÓMO REVERTIR. Los viajes de planilla no traían ningún id, así que vaciar
-- los cuatro en los marcados los deja exactamente como estaban.
--
--   update transport.trips
--   set origin_venue_id = null, origin_hotel_id = null,
--       destination_venue_id = null, destination_hotel_id = null,
--       metadata = metadata - 'lugaresFrom' - 'lugaresFixedAt'
--   where metadata ? 'lugaresFrom';
-- ─────────────────────────────────────────────────────────────────────────
