-- 20260707_trip_status_cancelled.sql
-- Agrega el valor 'CANCELLED' al enum de estado de viajes (transport.trip_status).
--
-- Contexto: la columna transport.trips.status es un enum que hasta ahora incluía
--   SCHEDULED | REQUESTED | EN_ROUTE | PICKED_UP | DROPPED_OFF | COMPLETED
-- pero NO 'CANCELLED'. Sin este valor, cualquier intento de cancelar un viaje
-- (desde el panel de operaciones, el portal o SofIA) falla con:
--   invalid input value for enum trip_status: "CANCELLED"
--
-- Idempotente: solo agrega el valor si la columna es un enum y el valor no existe.
-- Si en algún entorno la columna fuese text/varchar, no hace nada.
do $$
declare
  status_type_name text;
  status_type_schema text;
  status_type_kind "char";
begin
  select t.typname, n.nspname, t.typtype
  into status_type_name, status_type_schema, status_type_kind
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'transport'
    and c.relname = 'trips'
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if status_type_kind = 'e' then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = status_type_name
        and n.nspname = status_type_schema
        and e.enumlabel = 'CANCELLED'
    ) then
      execute format('alter type %I.%I add value %L', status_type_schema, status_type_name, 'CANCELLED');
    end if;
  end if;
end
$$;
