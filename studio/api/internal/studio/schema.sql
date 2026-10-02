CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('admin','editor','reader')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE NOT NULL, email text NOT NULL, role text NOT NULL CHECK(role IN ('admin','editor','reader')), expires_at timestamptz NOT NULL, used_at timestamptz, created_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', brand text NOT NULL DEFAULT '', audience text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now());
INSERT INTO products(name,description,audience) VALUES ('Teorimester','Innhold og kampanjer for Teorimester.','Elever som skal ta teoriprøven, og foreldrene deres.') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id),
 title text NOT NULL, kind text NOT NULL CHECK(kind IN ('video','image','audio','hook','script','copy','brief','reference','template','knowledge','carousel')),
 body text NOT NULL DEFAULT '', source_url text NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','archived')),
 rights text NOT NULL DEFAULT 'unknown' CHECK(rights IN ('unknown','owned','licensed','reference_only')),
 current_version_id uuid, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('norwegian',title),'A') || setweight(to_tsvector('norwegian',body),'B')) STORED
);
CREATE INDEX IF NOT EXISTS items_search ON items USING gin(search_vector);
CREATE INDEX IF NOT EXISTS items_title_trgm ON items USING gin(title gin_trgm_ops);
CREATE TABLE IF NOT EXISTS versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id), number int NOT NULL,
 title text NOT NULL, body text NOT NULL DEFAULT '', file_key text NOT NULL DEFAULT '', file_name text NOT NULL DEFAULT '', mime text NOT NULL DEFAULT '',
 created_by text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(item_id,number)
);
CREATE TABLE IF NOT EXISTS notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id), version_id uuid REFERENCES versions(id), body text NOT NULL, at_seconds numeric, author text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), title text NOT NULL, brief text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'idea' CHECK(status IN ('idea','ready','running','review','done')),
 executor text NOT NULL DEFAULT 'external' CHECK(executor IN ('external','human')),
 assignee text NOT NULL DEFAULT '', due_at timestamptz, item_id uuid REFERENCES items(id), delivery_version_id uuid REFERENCES versions(id),
 claimed_by uuid, lease_id uuid, lease_until timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), title text NOT NULL,
 channel text NOT NULL, scheduled_at timestamptz NOT NULL, caption text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','ready','published')),
 item_id uuid REFERENCES items(id), version_id uuid REFERENCES versions(id), task_id uuid REFERENCES tasks(id),
 url text NOT NULL DEFAULT '', published_at timestamptz, assignee text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), title text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id), role text NOT NULL, body text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS model_settings (
 role text PRIMARY KEY, provider text NOT NULL CHECK(provider IN ('openrouter','typesafe','external')),
 model text NOT NULL DEFAULT '', max_steps int NOT NULL DEFAULT 6 CHECK(max_steps BETWEEN 1 AND 12),
 max_tokens int NOT NULL DEFAULT 2048 CHECK(max_tokens BETWEEN 128 AND 8192), timeout_seconds int NOT NULL DEFAULT 120 CHECK(timeout_seconds BETWEEN 10 AND 300),
 max_cost_usd numeric NOT NULL DEFAULT 0.10 CHECK(max_cost_usd > 0 AND max_cost_usd <= 5)
);
INSERT INTO model_settings(role,provider) VALUES ('chat','openrouter'),('script','openrouter'),('analysis','openrouter'),('ranking','typesafe'),('video','external'),('design','external') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id), user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled','limited')),
 model text NOT NULL, max_steps int NOT NULL, max_tokens int NOT NULL, timeout_seconds int NOT NULL, max_cost_usd numeric NOT NULL,
 steps int NOT NULL DEFAULT 0, cost_usd numeric NOT NULL DEFAULT 0, stop_reason text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now(), started_at timestamptz, finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs(conversation_id) WHERE status IN ('queued','running');
CREATE TABLE IF NOT EXISTS run_events (id bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES runs(id), kind text NOT NULL, detail jsonb NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS agent_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, product_id uuid NOT NULL REFERENCES products(id), token_hash text UNIQUE NOT NULL, revoked_at timestamptz, expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS audit (id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, entity_id text NOT NULL, created_at timestamptz DEFAULT now());
