-- Viajes devueltos a Programado / Solicitado que conservan inicio y cierre de
-- cuando se iniciaron por error (23-09-2026: dos viajes de Ernesto Stuardo con
-- started_at del 22-09 18:55 arrancaban su jornada desde la tarde anterior).
-- Desde hoy el backend los limpia al retroceder; esto arregla los que ya quedaron.

-- 1. Revisar qué se va a tocar
select id, driver_id, status, scheduled_at, started_at, completed_at
  from transport.trips
 where status in ('SCHEDULED', 'REQUESTED')
   and (started_at is not null or completed_at is not null);

-- 2. Aplicar
update transport.trips
   set started_at = null, completed_at = null
 where status in ('SCHEDULED', 'REQUESTED')
   and (started_at is not null or completed_at is not null);
