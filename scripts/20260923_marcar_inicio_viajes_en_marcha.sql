-- Viajes en marcha o cerrados sin hora de inicio (o sin cierre). Hasta el
-- 23-09-2026 el portal del conductor sólo marcaba el inicio al poner
-- "Pasajero a bordo", y el panel no marcaba nada al cambiar el estado a mano:
-- 24 de los 25 viajes "En ruta" de esa mañana no tenían inicio y el Control
-- de jornada los mostraba "Sin iniciar" con el bus andando. Desde hoy el
-- backend estampa inicio y cierre al cambiar de estado; esto arregla los que
-- ya quedaron.
--
-- Inicio: la marca más temprana entre la última modificación (para un viaje
-- "En ruta" es cuando salió) y la hora programada. Cierre: la última
-- modificación, sólo en los ya cerrados.

-- 1. Revisar qué se va a tocar
select id, driver_id, status, scheduled_at, started_at, completed_at, updated_at,
       least(updated_at, scheduled_at) as inicio_propuesto
  from transport.trips
 where status in ('EN_ROUTE', 'PICKED_UP', 'DROPPED_OFF', 'COMPLETED')
   and (started_at is null or (status in ('DROPPED_OFF', 'COMPLETED') and completed_at is null))
 order by updated_at;

-- 2. Aplicar
update transport.trips
   set started_at = coalesce(started_at, least(updated_at, scheduled_at)),
       completed_at = case
         when status in ('DROPPED_OFF', 'COMPLETED') then coalesce(completed_at, updated_at)
         else completed_at
       end
 where status in ('EN_ROUTE', 'PICKED_UP', 'DROPPED_OFF', 'COMPLETED')
   and (started_at is null or (status in ('DROPPED_OFF', 'COMPLETED') and completed_at is null));
