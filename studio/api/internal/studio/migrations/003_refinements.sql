ALTER TABLE media_artifacts ADD COLUMN bytes bigint NOT NULL DEFAULT 0;
CREATE INDEX publication_campaign ON publications(campaign_id);
CREATE INDEX conversion_order ON conversions(product_id,order_id,currency);
CREATE INDEX task_status_product ON tasks(product_id,status);
CREATE INDEX job_status ON jobs(status,created_at);
