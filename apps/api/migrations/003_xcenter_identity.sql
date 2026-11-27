CREATE TABLE xcenter_identities (
 issuer text NOT NULL,
 subject text NOT NULL,
 user_id uuid NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
 PRIMARY KEY(issuer, subject)
);
CREATE TABLE xcenter_login_attempts (
 state_hash text PRIMARY KEY,
 browser_hash text NOT NULL,
 transaction jsonb NOT NULL,
 link_session uuid REFERENCES sessions ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX xcenter_attempts_expiry ON xcenter_login_attempts(expires_at);
