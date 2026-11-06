CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, username text NOT NULL UNIQUE,
 display_name text NOT NULL, password_hash text NOT NULL, verified boolean NOT NULL DEFAULT false,
 age_band text NOT NULL CHECK(age_band IN ('minor','adult')),
 bio text NOT NULL DEFAULT '', status text NOT NULL DEFAULT '', discoverable boolean NOT NULL DEFAULT false,
 read_receipts boolean NOT NULL DEFAULT false, typing_indicators boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,access_hash text NOT NULL UNIQUE,refresh_hash text NOT NULL UNIQUE,access_until timestamptz NOT NULL,expires_at timestamptz NOT NULL,device text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_tokens(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,purpose text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE requests(id uuid PRIMARY KEY,sender_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,recipient_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,state text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),CHECK(sender_id<>recipient_id));
CREATE UNIQUE INDEX pending_request ON requests(LEAST(sender_id,recipient_id),GREATEST(sender_id,recipient_id)) WHERE state='pending';
CREATE TABLE contacts(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,other_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,PRIMARY KEY(user_id,other_id));
CREATE TABLE blocks(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,other_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,PRIMARY KEY(user_id,other_id));
CREATE TABLE conversations(id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('direct','group')),title text,direct_key text UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE participants(conversation_id uuid NOT NULL REFERENCES conversations ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,role text NOT NULL DEFAULT 'member',last_read timestamptz,pinned boolean NOT NULL DEFAULT false,muted boolean NOT NULL DEFAULT false,PRIMARY KEY(conversation_id,user_id));
CREATE INDEX participants_user ON participants(user_id);
CREATE TABLE messages(id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES conversations ON DELETE CASCADE,sender_id uuid REFERENCES users ON DELETE SET NULL,body text NOT NULL,reply_to uuid REFERENCES messages ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),edited_at timestamptz,deleted_at timestamptz);
CREATE INDEX messages_cursor ON messages(conversation_id,created_at DESC,id DESC);
CREATE TABLE reactions(message_id uuid NOT NULL REFERENCES messages ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,emoji text NOT NULL,PRIMARY KEY(message_id,user_id,emoji));
CREATE TABLE moments(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,message_id uuid NOT NULL REFERENCES messages ON DELETE CASCADE,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,message_id));
CREATE TABLE unmasked(conversation_id uuid PRIMARY KEY REFERENCES conversations ON DELETE CASCADE,inviter_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,state text NOT NULL CHECK(state IN ('pending','active','ended')));
CREATE TABLE disclosures(conversation_id uuid NOT NULL REFERENCES conversations ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,field text NOT NULL CHECK(field IN ('bio','status')),PRIMARY KEY(conversation_id,user_id,field));
CREATE TABLE reports(id uuid PRIMARY KEY,reporter_id uuid REFERENCES users ON DELETE SET NULL,subject_id uuid REFERENCES users ON DELETE SET NULL,message_id uuid REFERENCES messages ON DELETE SET NULL,reason text NOT NULL,submitted_content text NOT NULL DEFAULT '',state text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now());
