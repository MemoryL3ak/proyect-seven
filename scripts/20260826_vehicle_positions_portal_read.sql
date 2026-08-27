-- ============================================================================
-- Vehicle Positions — lectura Realtime para los portales de pasajero
-- ============================================================================
-- Los portales de usuario (atleta / VIP) no tienen sesión de Supabase Auth:
-- entran con código y hablan con la API Nest, así que el cliente Realtime se
-- conecta con el rol `anon`. La política existente solo cubre `authenticated`
-- (panel admin), por lo que el pasajero nunca recibía los INSERT de posiciones
-- y quedaba dependiendo del polling REST.
--
-- Exposición: GET /vehicle-positions* ya es público en la API Nest (sin guard),
-- de modo que permitir SELECT al rol anon no revela nada que la API no
-- entregue hoy. Si más adelante se protege la API, esta política debe
-- reemplazarse por una por-participación en el viaje (ver nota en
-- 20260418_vehicle_positions_realtime.sql).
-- ============================================================================

DROP POLICY IF EXISTS vehicle_positions_select_anon
  ON telemetry.vehicle_positions;

CREATE POLICY vehicle_positions_select_anon
  ON telemetry.vehicle_positions
  FOR SELECT
  TO anon
  USING (true);

GRANT USAGE ON SCHEMA telemetry TO anon;
GRANT SELECT ON telemetry.vehicle_positions TO anon;
