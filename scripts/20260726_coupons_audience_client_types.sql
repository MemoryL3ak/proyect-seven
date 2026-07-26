-- Unifica la audiencia de los cupones con el catálogo de tipos de cliente.
--
-- Problema: la audiencia usaba un vocabulario propio (ATHLETE, STAFF,
-- DELEGATION_LEAD) que no coincide con el "Tipo de cliente" de los
-- participantes (TA, VIP, T1, TF, TM, FAMILIA_PARAPAN, COMITE_ORGANIZADOR,
-- PROVEEDORES). Como los deportistas son TA y los cupones apuntaban a ATHLETE,
-- el filtro nunca calzaba y no veían ningún beneficio.
--
-- Equivalencias aplicadas (mismas que frontend/lib/clientTypes.ts):
--   ATHLETE / ATLETA / DEPORTISTA -> TA
--   STAFF                         -> COMITE_ORGANIZADOR
--   COACH / DELEGATION            -> TF
--   DELEGATION_LEAD               -> TF
--   OTHER                         -> VIP
--   PROVIDER                      -> PROVEEDORES
--   VIP                           -> VIP (sin cambios)
--
-- Idempotente: los valores ya canónicos quedan igual. Sin pérdida de datos.

begin;

-- Respaldo por si se quiere revertir (se conserva como tabla aparte).
create table if not exists public.coupons_audience_backup_20260726 as
  select id, audience, now() as backed_up_at
  from public.coupons;

update public.coupons c
set audience = sub.nueva
from (
  select
    c2.id,
    (
      select coalesce(array_agg(distinct v order by v), '{}')
      from unnest(c2.audience) as a(valor),
      lateral (
        select case upper(trim(a.valor))
          when 'ATHLETE'         then 'TA'
          when 'ATLETA'          then 'TA'
          when 'DEPORTISTA'      then 'TA'
          when 'COACH'           then 'TF'
          when 'DELEGATION'      then 'TF'
          when 'DELEGATION_LEAD' then 'TF'
          when 'STAFF'           then 'COMITE_ORGANIZADOR'
          when 'OTHER'           then 'VIP'
          when 'PROVIDER'        then 'PROVEEDORES'
          else upper(trim(a.valor))
        end as v
      ) t
    ) as nueva
  from public.coupons c2
  where c2.audience is not null
    and array_length(c2.audience, 1) > 0
) sub
where c.id = sub.id
  and c.audience is distinct from sub.nueva;

commit;

-- Verificación: no debe quedar ningún valor del vocabulario antiguo.
-- select distinct unnest(audience) from public.coupons order by 1;
