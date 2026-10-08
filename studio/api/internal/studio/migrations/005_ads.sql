-- An ad is a stable item; each iteration remains an immutable item version.
CREATE TABLE ads (
 item_id uuid PRIMARY KEY REFERENCES items(id),
 product_id uuid NOT NULL REFERENCES products(id),
 external_key text NOT NULL CHECK(length(external_key) BETWEEN 1 AND 160),
 ad_type text NOT NULL DEFAULT 'Annet' CHECK(length(ad_type) BETWEEN 1 AND 80),
 brief text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,external_key)
);
CREATE TABLE ad_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 version_id uuid NOT NULL REFERENCES versions(id),
 status text NOT NULL CHECK(status IN ('approved','changes_requested')),
 body text NOT NULL DEFAULT '',author text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_reviews_version ON ad_reviews(version_id,created_at DESC);
CREATE INDEX versions_item_created ON versions(item_id,created_at);
CREATE INDEX jobs_artifact_queue ON jobs(kind,created_at) WHERE status='queued';
