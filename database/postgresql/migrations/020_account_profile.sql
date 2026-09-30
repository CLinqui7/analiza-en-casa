-- Temporary operator-provisioned credentials must be replaced at first login.
ALTER TABLE analiza.users
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
