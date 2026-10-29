CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  purpose text,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar', 'zh')),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 365),
  views integer NOT NULL DEFAULT 0,
  owner_id text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sessions_owner_id_idx ON sessions (owner_id);
--> statement-breakpoint
ALTER TABLE consents ALTER COLUMN link_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE consents ADD COLUMN IF NOT EXISTS session_id text REFERENCES sessions(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE photos ALTER COLUMN link_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN IF NOT EXISTS session_id text REFERENCES sessions(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS consents_session_id_idx ON consents (session_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS photos_session_id_idx ON photos (session_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS videos (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  photo_id text NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  title text,
  background text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 2 AND 10),
  size integer NOT NULL,
  share_token text UNIQUE,
  share_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS videos_session_id_idx ON videos (session_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos (created_at);
