-- ============================================================================
-- Notifications inbox — bandeja persistente de notificaciones por usuario.
-- ============================================================================
-- Cada vez que el backend dispara un push remoto (vía PushService.send) se
-- inserta también una row acá. La campanita del portal lee de esta tabla, así
-- que las notificaciones persisten entre reloads/sesiones y se sincronizan
-- entre web y app móvil.
--
-- También sirve como destino para "notificaciones puramente in-app" (ej:
-- broadcasts del staff a una delegación) que tal vez nunca disparen un push
-- remoto pero igual deben aparecer en la campanita.
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Destinatario.
  user_kind text NOT NULL,                 -- athlete | driver | admin | provider_participant
  user_id uuid NOT NULL,

  -- Contenido visible.
  title text NOT NULL,
  body text NOT NULL,
  emoji text,                              -- opcional para la campanita

  -- Clasificación / metadatos para deep-link.
  kind text,                               -- trip-assigned | trip-status | trip-chat | support-chat | broadcast | other
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- url, tripId, chatId, etc.

  -- Estado de lectura.
  read_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Listado descendente por usuario es la consulta principal de la campanita.
CREATE INDEX IF NOT EXISTS notifications_user_recent_idx
  ON core.notifications (user_kind, user_id, created_at DESC);

-- Conteo de no-leídas (para el badge) — partial index para que sea minúsculo.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON core.notifications (user_kind, user_id)
  WHERE read_at IS NULL;
