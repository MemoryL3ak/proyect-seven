-- ============================================================================
-- Asistencia / Incidencias — support chat rooms between portal users and
-- operations agents.
-- ============================================================================
-- Any portal user (conductor, VIP, jefe de delegación, atleta) can open a
-- chat room to request help or raise an incident. Admin agents attend these
-- rooms from the web operations panel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.support_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,

  -- who opened the chat
  origin_type text NOT NULL,             -- driver | athlete | provider_participant
  origin_id uuid NOT NULL,
  origin_name text NOT NULL,

  -- classification
  category text NOT NULL DEFAULT 'QUERY', -- QUERY | LOST_ITEM | INCIDENT | EMERGENCY | OTHER
  priority text NOT NULL DEFAULT 'NORMAL', -- LOW | NORMAL | HIGH | CRITICAL
  subject text,

  -- attention
  status text NOT NULL DEFAULT 'OPEN',   -- OPEN | IN_ATTENTION | ESCALATED | RESOLVED | CLOSED
  agent_id uuid,                         -- admin user id
  agent_name text,
  first_response_at timestamptz,
  resolved_at timestamptz,

  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- fast unread badges
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text
);

CREATE INDEX IF NOT EXISTS idx_support_chats_status
  ON core.support_chats (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chats_origin
  ON core.support_chats (origin_type, origin_id);

CREATE INDEX IF NOT EXISTS idx_support_chats_agent
  ON core.support_chats (agent_id);

CREATE TABLE IF NOT EXISTS core.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES core.support_chats(id) ON DELETE CASCADE,
  sender_type text NOT NULL,             -- origin | agent | system
  sender_id uuid,
  sender_name text,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_chat_created
  ON core.support_messages (chat_id, created_at ASC);

-- Keep support_chats.last_message_* in sync via trigger
CREATE OR REPLACE FUNCTION core.update_support_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_internal_note = false THEN
    UPDATE core.support_chats
      SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.content, ''), 120),
        updated_at = NEW.created_at
      WHERE id = NEW.chat_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_messages_after_insert ON core.support_messages;

CREATE TRIGGER trg_support_messages_after_insert
  AFTER INSERT ON core.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION core.update_support_chat_last_message();
