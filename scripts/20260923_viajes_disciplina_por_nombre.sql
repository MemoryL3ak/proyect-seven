-- Viajes: darles el id del deporte, por nombre y género de la planilla.
--
-- Los 330 viajes de la primera planilla traen la disciplina sólo como texto
-- ("ATLETISMO", "Voleibol", "PARATLETISMO") y el género aparte
-- (metadata.gender: "Femenino", "Masculino", "DAMAS Y VARONES"). Sin id, el
-- filtro de deporte del portal calzaba por nombre y no distinguía Femenino
-- de Masculino. El importador ya resuelve el id al cargar; este script
-- arregla lo cargado.
--
-- Regla: nombre exacto (sin tildes ni mayúsculas) contra los deportes padre
-- del evento; "PARA…" es la variante paralímpica; si el nombre existe en más
-- de un género, decide el género de la planilla. Lo que siga ambiguo
-- —Voleibol "General" de la inauguración, que es de los dos— queda sin id,
-- con su texto, a propósito.
--
-- CÓMO CORRERLO: paso 1 muestra, paso 2 escribe, paso 3 verifica.

create or replace function pg_temp.clave_deporte(txt text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(
    translate(coalesce(txt, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
    '[^a-zA-Z0-9]+', ' ', 'g')))
$$;

create or replace function pg_temp.genero_planilla(txt text) returns text
language sql immutable as $$
  select case
    when g ~ '(mixt|damas y varones|varones y damas)' then 'MIXED'
    when g ~ '^(femenin[oa]|damas|mujeres|f)$'          then 'FEMALE'
    when g ~ '^(masculin[oa]|varones|hombres|m)$'       then 'MALE'
  end
  from (select pg_temp.clave_deporte(txt) as g) x
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Qué recibiría cada combinación disciplina + género.
-- ─────────────────────────────────────────────────────────────────────────
with deportes as (
  select id, event_id, name, upper(coalesce(gender, '')) as gender,
         upper(coalesce(category, '')) = 'PARALYMPIC' as paralimpica,
         pg_temp.clave_deporte(name) as clave
  from core.disciplines where parent_id is null
),
viajes as (
  select t.id, t.event_id, t.discipline, t.metadata->>'gender' as genero,
         pg_temp.clave_deporte(t.discipline) as clave,
         pg_temp.genero_planilla(t.metadata->>'gender') as genero_norm
  from transport.trips t
  where t.metadata ? 'importedAt' and t.discipline_id is null and coalesce(btrim(t.discipline), '') <> ''
),
por_nombre as (
  select v.id as trip_id, d.id as discipline_id, d.gender, d.name, d.paralimpica,
         count(*) over (partition by v.id) as candidatos
  from viajes v
  join deportes d on d.event_id = v.event_id and (
       (v.clave = d.clave and (not d.paralimpica or v.clave like 'para%'))
    or (d.paralimpica and v.clave in ('para ' || d.clave, 'para' || d.clave,
                                       case when left(d.clave, 1) = 'a' then 'par' || d.clave end)))
),
calce as (
  select p.trip_id, p.discipline_id, p.name, p.gender, p.paralimpica
  from por_nombre p join viajes v on v.id = p.trip_id
  where p.candidatos = 1 or p.gender = v.genero_norm
),
unico as (
  select trip_id, (array_agg(discipline_id))[1] as discipline_id, (array_agg(name || ' · ' || gender || case when paralimpica then ' · Paralímpica' else '' end))[1] as deporte
  from calce group by trip_id having count(*) = 1
)
select v.discipline as texto, coalesce(v.genero, '(vacío)') as genero, u.deporte as recibe, count(*) as viajes
from viajes v left join unico u on u.trip_id = v.id
group by 1, 2, 3 order by 4 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — La actualización (mismas CTE), con marca para revertir.
-- ─────────────────────────────────────────────────────────────────────────
with deportes as (
  select id, event_id, name, upper(coalesce(gender, '')) as gender,
         upper(coalesce(category, '')) = 'PARALYMPIC' as paralimpica,
         pg_temp.clave_deporte(name) as clave
  from core.disciplines where parent_id is null
),
viajes as (
  select t.id, t.event_id, pg_temp.clave_deporte(t.discipline) as clave,
         pg_temp.genero_planilla(t.metadata->>'gender') as genero_norm
  from transport.trips t
  where t.metadata ? 'importedAt' and t.discipline_id is null and coalesce(btrim(t.discipline), '') <> ''
),
por_nombre as (
  select v.id as trip_id, d.id as discipline_id, d.gender,
         count(*) over (partition by v.id) as candidatos
  from viajes v
  join deportes d on d.event_id = v.event_id and (
       (v.clave = d.clave and (not d.paralimpica or v.clave like 'para%'))
    or (d.paralimpica and v.clave in ('para ' || d.clave, 'para' || d.clave,
                                       case when left(d.clave, 1) = 'a' then 'par' || d.clave end)))
),
calce as (
  select p.trip_id, p.discipline_id
  from por_nombre p join viajes v on v.id = p.trip_id
  where p.candidatos = 1 or p.gender = v.genero_norm
),
unico as (
  select trip_id, (array_agg(discipline_id))[1] as discipline_id from calce group by trip_id having count(*) = 1
)
update transport.trips t
set discipline_id = u.discipline_id,
    metadata      = coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object(
                      'disciplineFrom', 'nombre + género de la planilla (20260923)',
                      'disciplineFixedAt', now()),
    updated_at    = now()
from unico u where u.trip_id = t.id;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — Verificación.
-- ─────────────────────────────────────────────────────────────────────────
select count(*) as viajes_planilla, count(discipline_id) as con_deporte_id,
       count(*) filter (where metadata ? 'disciplineFrom') as corregidos
from transport.trips where metadata ? 'importedAt';

-- CÓMO REVERTIR:
--   update transport.trips set discipline_id = null,
--     metadata = metadata - 'disciplineFrom' - 'disciplineFixedAt'
--   where metadata ? 'disciplineFrom';
