CREATE TABLE IF NOT EXISTS links (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  destination text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  active boolean NOT NULL DEFAULT true,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS links_created_at_idx ON links (created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS consents (
  id text PRIMARY KEY,
  link_id text NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('granted', 'denied')),
  locale text NOT NULL CHECK (locale IN ('en', 'ar', 'zh')),
  created_at timestamptz NOT NULL DEFAULT now(),
  policy_version text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS consents_link_id_idx ON consents (link_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS photos (
  id text PRIMARY KEY,
  link_id text NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  consent_id text NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos (created_at);
