CREATE TABLE IF NOT EXISTS call_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  script      text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS call_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid NOT NULL REFERENCES call_lists(id) ON DELETE CASCADE,
  name          text,
  company       text,
  phone         text NOT NULL,
  phone_e164    text NOT NULL,
  email         text,
  country       text,
  industry      text,
  notes         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','callback','done','invalid','skipped')),
  last_outcome  text,
  outcome_note  text,
  callback_at   timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  last_called_at timestamptz,
  called_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  context       jsonb,
  appointment_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_contacts_list_status_idx ON call_contacts(list_id, status, callback_at);
CREATE UNIQUE INDEX IF NOT EXISTS call_contacts_list_phone_idx ON call_contacts(list_id, phone_e164);
