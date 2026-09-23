-- Viajes de todas las regiones: inauguración, congresillo técnico, martillo.
--
-- En la planilla esas filas dicen "TODAS LAS REGIONES" en "Tipo de Cliente".
-- No es una región, así que el importador las dejaba sin delegación y en
-- silencio: 63 viajes que ningún Jefe de Misión veía y que el filtro por
-- región no encontraba. Ahora el viaje puede decir que es de todas
-- (all_delegations): entra para cualquier jefe y en cualquier región del
-- filtro. El importador ya lo marca al cargar; este script arregla lo cargado.
--
-- PASO 1 crea la columna. PASO 2 sólo muestra. PASO 3 escribe (reversible).

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Columna.
-- ─────────────────────────────────────────────────────────────────────────
alter table transport.trips
  add column if not exists all_delegations boolean not null default false;

create index if not exists idx_trips_all_delegations
  on transport.trips (all_delegations) where all_delegations;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Qué viajes se marcarían: los de planilla sin delegación. Se
-- verificó contra el archivo original: los 36 renglones sin región dicen
-- "TODAS (LAS) REGIONES" (martillo, congresillo e inauguración).
-- ─────────────────────────────────────────────────────────────────────────
select coalesce(nullif(btrim(client_type), ''), '(vacío)') as tipo_cliente,
       coalesce(nullif(btrim(discipline), ''), '(vacío)')  as disciplina,
       count(*)                                            as viajes
from transport.trips
where metadata ? 'importedAt' and delegation_id is null and not all_delegations
group by 1, 2 order by 3 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — Marcar. Deja el texto de la planilla en metadata, como haría hoy
-- el importador, y una marca para revertir.
-- ─────────────────────────────────────────────────────────────────────────
update transport.trips
set all_delegations = true,
    metadata        = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                        'regionTexto', 'TODAS LAS REGIONES',
                        'allDelegationsFrom', 'planilla: Tipo de Cliente (20260923)',
                        'allDelegationsFixedAt', now()
                      ),
    updated_at      = now()
where metadata ? 'importedAt' and delegation_id is null and not all_delegations;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 4 — Verificación: ya no debería quedar ningún viaje de planilla sin
-- región ni marca.
-- ─────────────────────────────────────────────────────────────────────────
select count(*) filter (where all_delegations)                              as de_todas_las_regiones,
       count(*) filter (where delegation_id is not null)                    as con_region,
       count(*) filter (where delegation_id is null and not all_delegations) as sin_nada
from transport.trips where metadata ? 'importedAt';

-- ─────────────────────────────────────────────────────────────────────────
-- CÓMO REVERTIR:
--
--   update transport.trips
--   set all_delegations = false,
--       metadata = metadata - 'regionTexto' - 'allDelegationsFrom' - 'allDelegationsFixedAt'
--   where metadata ? 'allDelegationsFrom';
-- ─────────────────────────────────────────────────────────────────────────
