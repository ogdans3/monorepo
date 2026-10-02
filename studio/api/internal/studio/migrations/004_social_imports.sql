CREATE TABLE media_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES products(id),
 actor_id text NOT NULL, actor_name text NOT NULL, actor_agent boolean NOT NULL DEFAULT false,
 source_url text NOT NULL, platform text NOT NULL CHECK(platform IN ('instagram','tiktok','snapchat')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','downloading','completed','failed','cancelled')),
 stage text NOT NULL DEFAULT 'Venter på nedlasting', error_code text NOT NULL DEFAULT '',
 title text NOT NULL DEFAULT '', rights text NOT NULL DEFAULT 'reference_only' CHECK(rights IN ('reference_only','owned','licensed','unknown')),
 collection_id uuid REFERENCES collections(id), item_id uuid REFERENCES items(id),
 version_id uuid REFERENCES versions(id), duplicate boolean NOT NULL DEFAULT false,
 reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
 downloaded_bytes bigint NOT NULL DEFAULT 0, total_bytes bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz
);
CREATE UNIQUE INDEX active_import_url ON media_imports(product_id,source_url) WHERE status IN ('queued','downloading');
CREATE INDEX imports_product_created ON media_imports(product_id,created_at DESC);
