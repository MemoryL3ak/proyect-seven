-- ============================================================================
-- Purga automática de telemetría GPS — retención 90 días
-- ============================================================================
-- Google Play exige declarar cuánto tiempo se conservan los datos de
-- ubicación, y la política de privacidad publicará 90 días. Este script deja
-- esa promesa funcionando: un job diario de pg_cron elimina los registros con
-- más de 90 días en telemetry.vehicle_positions (GPS de conductores) y
-- telemetry.user_positions (GPS de usuarios VIP).
--
-- Los datos derivados NO se tocan: transport.trips (origen, destino, horarios,
-- conductor, costo) se conserva y cubre auditoría/facturación sin el rastro
-- punto a punto.
--
-- Cómo ejecutar:
--   1. Correr este script completo en el SQL Editor de Supabase.
--      Si `create extension` falla por permisos, habilitar pg_cron desde
--      Dashboard → Database → Extensions y volver a correr el script.
--   2. Primera vez con backlog grande (meses de datos): cada ejecución borra
--      como máximo max_batches × batch_limit filas por tabla (1M por defecto).
--      Repetir `select telemetry.purge_old_positions();` a mano, idealmente en
--      horario valle, hasta que devuelva 0 en ambas tablas. El job diario
--      mantiene el régimen después.
--
-- Nota: vehicle_positions está en la publicación de Realtime con REPLICA
-- IDENTITY FULL, así que los DELETE generan WAL abundante — por eso el job
-- corre de madrugada (03:00/04:00 en Chile) y borra en lotes acotados.
-- ============================================================================

create extension if not exists pg_cron;

-- Índices para que la purga por fecha no recorra la tabla completa.
create index if not exists idx_vehicle_positions_created_at
  on telemetry.vehicle_positions (created_at);

create index if not exists idx_user_positions_created_at
  on telemetry.user_positions (created_at);

create or replace function telemetry.purge_old_positions(
  retention interval default interval '90 days',
  batch_limit int default 50000,
  max_batches int default 20
) returns jsonb
language plpgsql
as $$
declare
  cutoff timestamptz := now() - retention;
  deleted_vehicle bigint := 0;
  deleted_user bigint := 0;
  batch bigint;
begin
  -- Lotes con LIMIT: mantiene cada DELETE acotado (locks y WAL) aunque haya
  -- millones de filas vencidas acumuladas.
  for i in 1..max_batches loop
    delete from telemetry.vehicle_positions
     where id in (
       select id
         from telemetry.vehicle_positions
        where created_at < cutoff
        limit batch_limit
     );
    get diagnostics batch = row_count;
    deleted_vehicle := deleted_vehicle + batch;
    exit when batch = 0;
  end loop;

  for i in 1..max_batches loop
    delete from telemetry.user_positions
     where id in (
       select id
         from telemetry.user_positions
        where created_at < cutoff
        limit batch_limit
     );
    get diagnostics batch = row_count;
    deleted_user := deleted_user + batch;
    exit when batch = 0;
  end loop;

  return jsonb_build_object(
    'cutoff', cutoff,
    'vehicle_positions_deleted', deleted_vehicle,
    'user_positions_deleted', deleted_user
  );
end;
$$;

comment on function telemetry.purge_old_positions is
  'Elimina trazas GPS con más de `retention` (default 90 días) de vehicle_positions y user_positions, en lotes. La corre pg_cron a diario.';

-- 07:00 UTC = 03:00/04:00 América/Santiago según horario de verano.
-- cron.schedule con el mismo nombre actualiza el job si ya existe.
select cron.schedule(
  'telemetry-purge-daily',
  '0 7 * * *',
  $$select telemetry.purge_old_positions();$$
);

-- Verificación: el job debe aparecer aquí tras ejecutar el script.
--   select jobid, jobname, schedule, active from cron.job;
-- Historial de corridas:
--   select * from cron.job_run_details order by start_time desc limit 10;
