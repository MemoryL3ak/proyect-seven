-- Viajes: rescatar la región que la planilla escribió donde no correspondía.
--
-- La planilla de operatividad diaria NO tiene columna de delegación ni de
-- región. Tiene dos columnas de cliente:
--
--   "Acrónimo"        -> clientType -> se guarda en transport.trips.client_type
--   "Tipo de Cliente" -> clientName -> NO se guardaba en ninguna parte
--
-- En las cargas de los Juegos Escolares la región se escribió en una de esas
-- dos. De cuál haya sido depende si este script sirve:
--
--   * Si la escribieron en "Acrónimo", el nombre de la región quedó guardado
--     como client_type (el importador aceptaba cualquier texto) y este script
--     lo mueve a delegation_id, que es donde vive la delegación.
--
--   * Si la escribieron en "Tipo de Cliente", el dato se descartó al importar
--     y NO ESTÁ EN LA BASE: no hay nada que mover y el paso 2 no va a
--     devolver filas. La única forma de recuperarlo es volver a importar la
--     planilla con el importador corregido, que ya lee esa columna.
--
-- El PASO 1 dice en cuál de los dos casos estamos. Corré eso primero.
--
-- CÓMO CORRERLO: por pasos, leyendo el resultado de cada uno. El paso 3 es el
-- único que escribe. Los pasos 1 y 2 sólo muestran.

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Qué hay hoy en client_type.
-- Sirve para ver de un vistazo cuáles son tipos de cliente de verdad y
-- cuáles son regiones disfrazadas.
-- ─────────────────────────────────────────────────────────────────────────
select
  coalesce(nullif(btrim(client_type), ''), '(vacío)') as tipo_cliente,
  count(*)                                            as viajes,
  count(*) filter (where delegation_id is null)       as sin_delegacion
from transport.trips
group by 1
order by 2 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Vista previa: qué viaje se llevaría a qué delegación.
--
-- El calce normaliza a minúsculas, saca tildes y quita el prefijo
-- "Región de / del", de modo que "ÑUBLE", "Region de Ñuble" y
-- "Región de Ñuble" caen todos en la misma clave. También acepta el código
-- ISO ("CL-NB") escrito directo en la celda.
--
-- Sólo se tocan filas donde el valor NO es un tipo de cliente válido, así que
-- los viajes que traen TA, VIP, TF y compañía quedan intactos.
-- ─────────────────────────────────────────────────────────────────────────
with delegaciones as (
  select
    d.id,
    d.event_id,
    d.country_code,
    coalesce(d.metadata ->> 'name', '') as nombre,
    btrim(regexp_replace(
      translate(lower(coalesce(d.metadata ->> 'name', '')), 'áéíóúüñ', 'aeiouun'),
      '^region\s+(del\s+|de\s+)?', ''
    )) as clave
  from core.delegations d
),
viajes as (
  select
    t.id,
    t.event_id,
    btrim(t.client_type) as valor,
    btrim(regexp_replace(
      translate(lower(coalesce(t.client_type, '')), 'áéíóúüñ', 'aeiouun'),
      '^region\s+(del\s+|de\s+)?', ''
    )) as clave
  from transport.trips t
  where t.delegation_id is null
    and coalesce(btrim(t.client_type), '') <> ''
    and upper(btrim(t.client_type)) not in (
      'TF', 'TM', 'TA', 'VIP', 'T1', 'FAMILIA_PARAPAN', 'JEFE_MISION',
      'COORDINADOR_COMITE', 'COORDINADOR_TRANSPORTE', 'COORDINADOR_SEDE',
      'COMITE_ORGANIZADOR', 'PROVEEDORES'
    )
),
calces as (
  select
    v.id            as trip_id,
    v.valor         as valor_planilla,
    d.id            as delegation_id,
    d.nombre        as delegacion,
    count(*) over (partition by v.id) as candidatos
  from viajes v
  join delegaciones d
    on d.event_id = v.event_id
   and (
        d.clave = v.clave
        or lower(d.country_code) = lower(v.valor)
        -- "METROPOLITANA" contra "Región Metropolitana de Santiago"
        or (length(v.clave) >= 4 and d.clave like v.clave || '%')
        or (length(d.clave) >= 4 and v.clave like d.clave || '%')
        -- "O'Higgins" vive en medio de "Libertador General Bernardo O'Higgins"
        or (length(v.clave) >= 5 and d.clave like '%' || v.clave || '%')
        or (length(d.clave) >= 5 and v.clave like '%' || d.clave || '%')
       )
)
select
  valor_planilla,
  delegacion,
  count(*) as viajes,
  -- Un valor que calza con más de una delegación no se toca: hay que
  -- decidirlo a mano antes de escribir nada.
  max(candidatos) as delegaciones_candidatas
from calces
group by 1, 2
order by 3 desc;

-- Filas que quedan afuera por ambigüedad (revisar antes del paso 3):
--   ... repetir el WITH de arriba y filtrar `where candidatos > 1`.

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — La actualización.
--
-- Escribe delegation_id, vacía client_type (queda "—" en el detalle, que es
-- la verdad: ese viaje no tiene tipo de cliente cargado) y guarda el valor
-- original en metadata.clientTypeOriginal para poder revertir o auditar.
-- ─────────────────────────────────────────────────────────────────────────
with delegaciones as (
  select
    d.id,
    d.event_id,
    d.country_code,
    btrim(regexp_replace(
      translate(lower(coalesce(d.metadata ->> 'name', '')), 'áéíóúüñ', 'aeiouun'),
      '^region\s+(del\s+|de\s+)?', ''
    )) as clave
  from core.delegations d
),
viajes as (
  select
    t.id,
    t.event_id,
    btrim(t.client_type) as valor,
    btrim(regexp_replace(
      translate(lower(coalesce(t.client_type, '')), 'áéíóúüñ', 'aeiouun'),
      '^region\s+(del\s+|de\s+)?', ''
    )) as clave
  from transport.trips t
  where t.delegation_id is null
    and coalesce(btrim(t.client_type), '') <> ''
    and upper(btrim(t.client_type)) not in (
      'TF', 'TM', 'TA', 'VIP', 'T1', 'FAMILIA_PARAPAN', 'JEFE_MISION',
      'COORDINADOR_COMITE', 'COORDINADOR_TRANSPORTE', 'COORDINADOR_SEDE',
      'COMITE_ORGANIZADOR', 'PROVEEDORES'
    )
),
calces as (
  select
    v.id    as trip_id,
    v.valor as valor_planilla,
    d.id    as delegation_id,
    count(*) over (partition by v.id) as candidatos
  from viajes v
  join delegaciones d
    on d.event_id = v.event_id
   and (
        d.clave = v.clave
        or lower(d.country_code) = lower(v.valor)
        or (length(v.clave) >= 4 and d.clave like v.clave || '%')
        or (length(d.clave) >= 4 and v.clave like d.clave || '%')
        -- "O'Higgins" vive en medio de "Libertador General Bernardo O'Higgins"
        or (length(v.clave) >= 5 and d.clave like '%' || v.clave || '%')
        or (length(d.clave) >= 5 and v.clave like '%' || d.clave || '%')
       )
)
update transport.trips t
set delegation_id = c.delegation_id,
    client_type   = null,
    metadata      = coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object(
                      'clientTypeOriginal', c.valor_planilla,
                      'delegationFrom', 'client_type (planilla de operatividad)',
                      'delegationFixedAt', now()
                    ),
    updated_at    = now()
from calces c
where c.trip_id = t.id
  and c.candidatos = 1;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 4 — Verificación: cuántos viajes quedaron con región.
-- ─────────────────────────────────────────────────────────────────────────
select
  coalesce(d.metadata ->> 'name', '(sin delegación)') as region,
  count(*)                                            as viajes
from transport.trips t
left join core.delegations d on d.id = t.delegation_id
group by 1
order by 2 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- CÓMO REVERTIR, si algo calzó mal:
--
--   update transport.trips
--   set client_type   = metadata ->> 'clientTypeOriginal',
--       delegation_id = null,
--       metadata      = metadata - 'clientTypeOriginal' - 'delegationFrom' - 'delegationFixedAt'
--   where metadata ? 'clientTypeOriginal';
-- ─────────────────────────────────────────────────────────────────────────
