CREATE TABLE IF NOT EXISTS case_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_id   uuid REFERENCES filings(id) ON DELETE SET NULL,
  label       text NOT NULL,
  due_date    date NOT NULL,
  kind        text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','dismissed')),
  alerted_at  timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_milestones_due_idx ON case_milestones(status, due_date);
