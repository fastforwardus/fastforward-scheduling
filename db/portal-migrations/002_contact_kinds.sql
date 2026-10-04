ALTER TABLE case_comments DROP CONSTRAINT IF EXISTS case_comments_kind_check;
ALTER TABLE case_comments ADD CONSTRAINT case_comments_kind_check
  CHECK (kind IN ('comment','call','whatsapp','email','meeting','system'));
