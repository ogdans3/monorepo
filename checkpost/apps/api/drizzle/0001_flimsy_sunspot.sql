DROP INDEX "share_links_one_active_per_list";--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "access" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "share_links_list_live_idx" ON "share_links" USING btree ("list_id") WHERE "share_links"."revoked_at" is null;