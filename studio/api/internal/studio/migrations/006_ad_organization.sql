CREATE TABLE ad_folders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES products(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,product_id)
);
CREATE UNIQUE INDEX ad_folders_name ON ad_folders(product_id,lower(name));
ALTER TABLE ads ADD COLUMN folder_id uuid;
ALTER TABLE ads ADD COLUMN channels text[] NOT NULL DEFAULT '{}';
ALTER TABLE ads ADD CONSTRAINT ads_folder_product FOREIGN KEY(folder_id,product_id) REFERENCES ad_folders(id,product_id);
CREATE INDEX ads_folder ON ads(folder_id);
-- Organization is editable metadata; immutable render files and reviews are untouched.
CREATE TABLE ad_version_channels (
 version_id uuid PRIMARY KEY REFERENCES versions(id) ON DELETE CASCADE,
 channels text[] NOT NULL DEFAULT '{}'
);
