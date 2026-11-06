CREATE TABLE access_tokens(token_hash text PRIMARY KEY,session_id uuid NOT NULL REFERENCES sessions ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE INDEX access_tokens_session ON access_tokens(session_id);
INSERT INTO access_tokens(token_hash,session_id,expires_at) SELECT access_hash,id,access_until FROM sessions;
