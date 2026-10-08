-- Private account avatar; never exposed through a public storage URL.
ALTER TABLE analiza.users
  ADD COLUMN avatar_bytes bytea,
  ADD COLUMN avatar_mime text,
  ADD COLUMN avatar_version bigint NOT NULL DEFAULT 0;
ALTER TABLE analiza.users
  ADD CONSTRAINT users_avatar_pair CHECK ((avatar_bytes IS NULL) = (avatar_mime IS NULL)),
  ADD CONSTRAINT users_avatar_mime CHECK (avatar_mime IS NULL OR avatar_mime IN ('image/png','image/jpeg','image/webp')),
  ADD CONSTRAINT users_avatar_size CHECK (avatar_bytes IS NULL OR octet_length(avatar_bytes) BETWEEN 16 AND 1048576);
