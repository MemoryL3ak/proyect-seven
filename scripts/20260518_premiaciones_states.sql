-- Premiaciones: simplificar estados a solo 2 (PROGRAMADA / REALIZADA).
--
-- Antes:  SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
-- Ahora:  PROGRAMADA | REALIZADA
--
-- Mapeo de datos existentes:
--   SCHEDULED, IN_PROGRESS   → PROGRAMADA
--   COMPLETED                → REALIZADA
--   CANCELLED                → eliminadas (se borran las filas)

-- 1) Eliminar las canceladas (ya no aplican)
delete from core.premiaciones where upper(status) = 'CANCELLED';

-- 2) Renombrar los estados restantes
update core.premiaciones
   set status = case
     when upper(status) = 'COMPLETED' then 'REALIZADA'
     else 'PROGRAMADA'
   end;

-- 3) Cambiar el default
alter table core.premiaciones
  alter column status set default 'PROGRAMADA';

-- 4) CHECK constraint para impedir valores inválidos
alter table core.premiaciones
  drop constraint if exists premiaciones_status_check;
alter table core.premiaciones
  add constraint premiaciones_status_check
    check (status in ('PROGRAMADA', 'REALIZADA'));

comment on column core.premiaciones.status
  is 'Estado de la ceremonia: PROGRAMADA (pendiente de realizar) | REALIZADA (ya entregada).';
