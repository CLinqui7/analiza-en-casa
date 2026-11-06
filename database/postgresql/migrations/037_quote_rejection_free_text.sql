ALTER TABLE analiza.quote_decisions
  DROP CONSTRAINT IF EXISTS quote_decisions_reason_check;

ALTER TABLE analiza.quote_decisions
  DROP CONSTRAINT IF EXISTS quote_decisions_reason_length_check;

ALTER TABLE analiza.quote_decisions
  ADD CONSTRAINT quote_decisions_reason_length_check
  CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 1000);
