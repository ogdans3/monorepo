CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"text" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_events" (
	"list_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"type" text NOT NULL,
	"actor" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_events_list_id_revision_pk" PRIMARY KEY("list_id","revision")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_events" ADD CONSTRAINT "list_events_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_list_position_idx" ON "items" USING btree ("list_id","position" COLLATE "C");--> statement-breakpoint
CREATE UNIQUE INDEX "items_list_position_key" ON "items" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_events_created_at_idx" ON "list_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_one_active_per_list" ON "share_links" USING btree ("list_id") WHERE "share_links"."revoked_at" is null;