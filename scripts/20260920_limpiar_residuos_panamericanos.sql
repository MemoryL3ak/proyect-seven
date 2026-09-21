-- Complemento de 20260920_eliminar_evento_panamericanos.sql
--
-- Tras borrar el evento "Juegos Panamericanos 2026" quedaron filas con su
-- event_id colgando, porque estas tablas tienen la columna event_id pero NO
-- una FK hacia core.events, así que la cascada no las alcanzó:
--
--   transport.flights               10 vuelos de prueba (LATAM/Avianca)
--   public.workforce_persons         6 personas ficticias (Camila Fuentes…)
--   public.workforce_products        4 productos de prueba (camiseta Bvan…)
--   transport.driver_assignment_runs 15 corridas de auto-asignación
--   core.support_chats                4 chats de prueba ("asdasd", "consultas")
--
-- Este script es idempotente: volver a ejecutarlo no hace daño. Las tres
-- primeras ya se limpiaron en la primera pasada; las dos últimas se detectaron
-- después, en un barrido de event_id inexistentes sobre las 12 tablas con esa
-- columna y sin FK.

begin;

delete from transport.flights
 where event_id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

delete from public.workforce_persons
 where event_id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

delete from public.workforce_products
 where event_id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

delete from transport.driver_assignment_runs
 where event_id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

delete from core.support_chats
 where event_id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

commit;

-- Verificación general: busca CUALQUIER fila cuyo event_id ya no exista, en
-- todas las tablas que tienen esa columna. Debe devolver 0 filas.
select c.table_schema, c.table_name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name  = c.table_name
   and t.table_type  = 'BASE TABLE'
 where c.column_name = 'event_id'
   and c.table_schema not in ('pg_catalog', 'information_schema');
-- (correrla tabla por tabla con:
--    select count(*) from <tabla> x
--     where x.event_id is not null
--       and not exists (select 1 from core.events e where e.id = x.event_id);)

-- ---------------------------------------------------------------------------
-- Opcional: las 12 tablas que tienen event_id SIN FK a core.events. Agregarla
-- evita que el próximo evento eliminado deje el mismo reguero. Hacerlo aparte
-- y con calma: si alguna tiene filas con event_id inválido, el ALTER falla.
--
--   core.event_documents              logistics.salon_reservations
--   core.premiaciones                 public.coupon_partners
--   core.support_chats                public.coupons
--   transport.driver_assignment_runs  public.workforce_persons
--   transport.driver_sessions         public.workforce_products
--   transport.flights                 transport.trip_requests
--
-- Patrón:
--   alter table <tabla>
--     add constraint <tabla>_event_id_fkey foreign key (event_id)
--     references core.events(id) on delete cascade;
--
-- Ojo con transport.driver_sessions: sus filas son historial operativo real
-- (44 solo de Alex Arevalo), así que ahí conviene decidir si el borrado en
-- cascada es lo que se quiere, o mejor on delete set null.
