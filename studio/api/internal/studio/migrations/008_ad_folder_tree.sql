ALTER TABLE ad_folders ADD COLUMN parent_id uuid;
ALTER TABLE ad_folders ADD CONSTRAINT ad_folders_parent_product
 FOREIGN KEY(parent_id,product_id) REFERENCES ad_folders(id,product_id);
ALTER TABLE ad_folders ADD CONSTRAINT ad_folders_not_own_parent CHECK(parent_id<>id);
CREATE INDEX ad_folders_parent ON ad_folders(parent_id);

-- Existing folders remain at the root. Names are unique among siblings only.
DROP INDEX ad_folders_name;
CREATE UNIQUE INDEX ad_folders_root_name ON ad_folders(product_id,lower(name)) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX ad_folders_sibling_name ON ad_folders(product_id,parent_id,lower(name)) WHERE parent_id IS NOT NULL;
