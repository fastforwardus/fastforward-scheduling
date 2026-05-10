CREATE TABLE IF NOT EXISTS adriana_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  wa_phone text NOT NULL UNIQUE,
  wa_profile_name text,
  language language,
  timezone text,
  lead_name text,
  lead_email text,
  lead_company text,
  lead_country text,
  lead_product_type text,
  lead_channel text,
  lead_timeline text,
  zoho_lead_id text,
  appointment_id text,
  booked_at timestamp with time zone,
  survey_asked_at timestamp with time zone,
  survey_done_at timestamp with time zone,
  status text DEFAULT 'active' NOT NULL,
  last_user_msg_at timestamp with time zone,
  last_assistant_msg_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS adriana_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL REFERENCES adriana_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content jsonb NOT NULL,
  wa_message_id text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS adriana_satisfaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL REFERENCES adriana_conversations(id) ON DELETE CASCADE,
  score integer NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adriana_messages_conv ON adriana_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_adriana_conv_phone ON adriana_conversations(wa_phone);
CREATE INDEX IF NOT EXISTS idx_adriana_conv_status ON adriana_conversations(status);
