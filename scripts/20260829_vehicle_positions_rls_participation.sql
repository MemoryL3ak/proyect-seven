-- ============================================================================
-- SA-BACKEND-02 · 4.3.3 — RLS por participación en telemetry.vehicle_positions
-- ============================================================================
-- Reemplaza las políticas permisivas (anon USING(true) y authenticated
-- USING(true)) por una única política acotada:
--
--   · Personal del panel (sesión Supabase real, sin claim `portal`): ve todo.
--   · Conductor de portal (JWT del backend con portal='driver'): ve sólo sus
--     propias posiciones (drivers.id y drivers.user_id cuentan como la misma
--     persona — viajes y posiciones referencian ambas indistintamente).
--   · Pasajero de portal (portal='athlete'): sólo las posiciones del
--     conductor con quien tiene un viaje activo (EN_ROUTE / PICKED_UP) como
--     solicitante o pasajero.
--
-- Los JWT de portal los firma el backend (POST /m/auth/realtime-token) con el
-- JWT secret del proyecto, previa validación de la sesión única del portal.
-- Requiere el env SUPABASE_JWT_SECRET en el backend (Railway).
--
-- La participación se evalúa en una función SECURITY DEFINER: corre con los
-- privilegios de su dueño, así que NO hay que otorgar SELECT sobre
-- transport.* al rol authenticated (cero exposición extra aunque el esquema
-- se publicara en PostgREST algún día).
--
-- El acceso REST del portal NO pasa por aquí (va por la API Nest, que ahora
-- exige sesión y autoriza por participación); esta política gobierna el canal
-- Realtime y cualquier acceso directo con la anon key.
-- ============================================================================

-- 1. Fuera la lectura anónima (política de 20260826_vehicle_positions_portal_read.sql).
DROP POLICY IF EXISTS vehicle_positions_select_anon
  ON telemetry.vehicle_positions;
REVOKE SELECT ON telemetry.vehicle_positions FROM anon;
REVOKE USAGE ON SCHEMA telemetry FROM anon;

-- 2. Fuera la lectura total para cualquier authenticated.
DROP POLICY IF EXISTS vehicle_positions_select_authenticated
  ON telemetry.vehicle_positions;

-- 3. Evaluador de participación (SECURITY DEFINER, search_path fijo).
CREATE OR REPLACE FUNCTION telemetry.vehicle_positions_visible(
  claims jsonb,
  target_driver_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- Personal del panel: sesión Supabase real, sin claim de portal.
    coalesce(claims->>'portal', '') = ''
    OR (
      claims->>'portal' = 'driver'
      AND (
        target_driver_id::text = claims->>'sub'
        OR EXISTS (
          SELECT 1
            FROM transport.drivers d
           WHERE (d.id::text = claims->>'sub' OR d.user_id::text = claims->>'sub')
             AND (d.id = target_driver_id OR d.user_id = target_driver_id)
        )
      )
    )
    OR (
      claims->>'portal' = 'athlete'
      AND EXISTS (
        SELECT 1
          FROM transport.trips t
         WHERE t.driver_id = target_driver_id
           AND t.status IN ('EN_ROUTE', 'PICKED_UP')
           AND (
             t.requester_athlete_id::text = claims->>'sub'
             OR EXISTS (
               SELECT 1
                 FROM transport.trip_athletes ta
                WHERE ta.trip_id = t.id
                  AND ta.athlete_id::text = claims->>'sub'
             )
           )
      )
    )
$$;

REVOKE ALL ON FUNCTION telemetry.vehicle_positions_visible(jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION telemetry.vehicle_positions_visible(jsonb, uuid) TO authenticated;

-- 4. Política única por participación.
DROP POLICY IF EXISTS vehicle_positions_select_participant
  ON telemetry.vehicle_positions;

CREATE POLICY vehicle_positions_select_participant
  ON telemetry.vehicle_positions
  FOR SELECT
  TO authenticated
  USING (telemetry.vehicle_positions_visible(auth.jwt(), driver_id));

-- Verificación (evidencia 4.4.2):
--   select policyname, roles, qual from pg_policies
--    where tablename = 'vehicle_positions';
-- Debe listar únicamente vehicle_positions_select_participant ({authenticated}).
