-- Status de casos: tablas auxiliares en la base del portal (clientes/filings viven ahí)
CREATE TABLE IF NOT EXISTS case_meta (
  filing_id        uuid PRIMARY KEY REFERENCES filings(id) ON DELETE CASCADE,
  waiting_on       text CHECK (waiting_on IN ('client','authority','us')),
  next_step        text,
  key_date         date,
  key_date_label   text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  closed_reason    text CHECK (closed_reason IN ('completed','cancelled','no_response')),
  closed_at        timestamptz,
  closed_by        text,
  reopened_at      timestamptz,
  survey_token     text UNIQUE,
  survey_score     smallint CHECK (survey_score BETWEEN 1 AND 3),
  survey_at        timestamptz,
  last_notified_stage_id uuid,
  inactivity_alerted_at  timestamptz,
  renewal_alerted_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id    uuid NOT NULL REFERENCES filings(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  author_name  text NOT NULL,
  kind         text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','call','system')),
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_comments_filing_idx ON case_comments(filing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS case_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id   uuid NOT NULL REFERENCES filings(id) ON DELETE CASCADE,
  actor_email text,
  actor_name  text,
  action      text NOT NULL,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_events_filing_idx ON case_events(filing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS case_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id  uuid NOT NULL REFERENCES filings(id) ON DELETE CASCADE,
  channel    text NOT NULL CHECK (channel IN ('whatsapp','email')),
  kind       text NOT NULL,
  recipient  text NOT NULL,
  payload    jsonb,
  status     text NOT NULL DEFAULT 'sent',
  error      text,
  sent_by    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_notifications_filing_idx ON case_notifications(filing_id, created_at DESC);

-- Backfill: una fila de case_meta por filing, last_activity_at = último movimiento conocido
INSERT INTO case_meta (filing_id, last_activity_at, closed_reason, closed_at)
SELECT f.id,
       GREATEST(f.created_at,
                COALESCE((SELECT MAX(GREATEST(COALESCE(s.started_at,'epoch'),COALESCE(s.completed_at,'epoch'))) FROM filing_stages s WHERE s.filing_id=f.id),'epoch'),
                COALESCE((SELECT MAX(d.created_at) FROM filing_deliverables d WHERE d.filing_id=f.id),'epoch'),
                COALESCE(f.actual_end_date,'epoch')),
       CASE f.status WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' END,
       CASE WHEN f.status IN ('completed','cancelled') THEN COALESCE(f.actual_end_date, f.created_at) END
FROM filings f
ON CONFLICT (filing_id) DO NOTHING;
