CREATE TABLE IF NOT EXISTS adriana_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES adriana_conversations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  summary TEXT NOT NULL,
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_conv ON adriana_handoffs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_pending ON adriana_handoffs(resolved_at) WHERE resolved_at IS NULL;
