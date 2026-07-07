-- ============================================================================
-- Device tokens — registro de dispositivos para envío de push notifications.
-- ============================================================================
-- Cada vez que la app móvil obtiene un Expo push token tras conceder permiso
-- de notificaciones, lo registra acá asociado al usuario logueado del portal
-- (atleta, conductor, etc.). El backend usa esta tabla para resolver "a qué
-- dispositivos hay que mandar el push de tal evento".
--
-- Un mismo dispositivo puede asociarse a varios usuarios a lo largo del
-- tiempo (login/logout), pero el token es único por instalación: cuando el
-- mismo token aparece para otro usuario, simplemente actualizamos las
-- columnas user_kind/user_id (upsert por token).
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A quién está asociado el dispositivo en este momento.
  user_kind text NOT NULL,                 -- athlete | driver | admin | provider_participant
  user_id uuid NOT NULL,                   -- id del registro correspondiente

  -- Información del dispositivo / instalación.
  platform text NOT NULL,                  -- ios | android
  expo_token text NOT NULL,                -- ExponentPushToken[xxxxxx]
  app_version text,                        -- versión semver de la app (opcional)
  device_name text,                        -- nombre legible del dispositivo (opcional)

  -- Auditoría.
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un mismo expo_token solo puede existir una vez (clave de upsert).
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_expo_token_key
  ON core.device_tokens (expo_token);

-- Lookup rápido por usuario al momento de enviar push.
CREATE INDEX IF NOT EXISTS device_tokens_user_idx
  ON core.device_tokens (user_kind, user_id);

-- updated_at se actualiza solo en cada UPDATE.
CREATE OR REPLACE FUNCTION core.device_tokens_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_tokens_set_updated_at ON core.device_tokens;
CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON core.device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION core.device_tokens_set_updated_at();
