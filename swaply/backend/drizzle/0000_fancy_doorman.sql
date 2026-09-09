-- pg_trgm backs the typo-tolerant search index. drizzle-kit does not emit
-- extensions, so this line is added by hand and must stay at the top.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE SCHEMA "retained";
--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('verktoy', 'gaming', 'sykkel', 'klaer', 'sport', 'bat_og_fritid', 'mobler', 'elektronikk', 'barn', 'hage', 'musikk', 'bil_og_mc');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('new', 'good', 'worn');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('available', 'reserved', 'traded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('item', 'service');--> statement-breakpoint
CREATE TYPE "public"."trade_state" AS ENUM('talking', 'pending', 'countered', 'accepted', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "app_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"score" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_score" CHECK ("app_feedback"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker" uuid NOT NULL,
	"blocked" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_blocked_pk" PRIMARY KEY("blocker","blocked"),
	CONSTRAINT "no_self_block" CHECK ("blocks"."blocker" <> "blocks"."blocked")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"push_token" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_push_token_unique" UNIQUE("push_token")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"inviter_id" uuid,
	"item_id" uuid,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "item_media_position" UNIQUE("item_id","position")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "listing_kind" DEFAULT 'item' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "category" NOT NULL,
	"condition" "condition",
	"estimated_value_nok" integer,
	"town" text,
	"county" text,
	"status" "item_status" DEFAULT 'available' NOT NULL,
	"active_trade_id" uuid,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('norwegian', coalesce(title, '')), 'A') || setweight(to_tsvector('norwegian', coalesce(description, '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "condition_for_items" CHECK ("items"."kind" = 'service' or "items"."condition" is not null),
	CONSTRAINT "exclusive_only_for_items" CHECK ("items"."kind" = 'item' or "items"."active_trade_id" is null)
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user" uuid NOT NULL,
	"target_item" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "like_once" UNIQUE("from_user","target_item")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter" uuid NOT NULL,
	"target_user" uuid,
	"target_item" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	CONSTRAINT "report_one_target" CHECK (num_nonnulls("reports"."target_user", "reports"."target_item") = 1)
);
--> statement-breakpoint
CREATE TABLE "retained"."blocked_subjects" (
	"subject_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"permanent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retained"."identities" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"bankid_subject" text,
	"email" text,
	"phone" text,
	"display_name" text,
	"reason" text DEFAULT 'legal_claims' NOT NULL,
	"sealed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"trade_id" uuid NOT NULL,
	"rater" uuid NOT NULL,
	"ratee" uuid NOT NULL,
	"score" smallint NOT NULL,
	"comment" text,
	"chips" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_trade_id_rater_ratee_pk" PRIMARY KEY("trade_id","rater","ratee"),
	CONSTRAINT "review_score" CHECK ("reviews"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "thread_participants" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	CONSTRAINT "thread_participants_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "trade_acceptances" (
	"offer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terms_version" text NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trade_acceptances_offer_id_user_id_pk" PRIMARY KEY("offer_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trade_item_snapshots" (
	"trade_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"giver_position" smallint NOT NULL,
	"title" text NOT NULL,
	"kind" "listing_kind" NOT NULL,
	"category" "category" NOT NULL,
	"estimated_value_nok" integer,
	"cover_url" text,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_item_snapshots_trade_id_item_id_pk" PRIMARY KEY("trade_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "trade_offer_cash" (
	"offer_id" uuid NOT NULL,
	"payer_position" smallint NOT NULL,
	"payee_position" smallint NOT NULL,
	"amount_nok" integer NOT NULL,
	CONSTRAINT "trade_offer_cash_offer_id_payer_position_payee_position_pk" PRIMARY KEY("offer_id","payer_position","payee_position"),
	CONSTRAINT "cash_positive" CHECK ("trade_offer_cash"."amount_nok" > 0),
	CONSTRAINT "cash_two_parties" CHECK ("trade_offer_cash"."payer_position" <> "trade_offer_cash"."payee_position")
);
--> statement-breakpoint
CREATE TABLE "trade_offer_items" (
	"offer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"giver_position" smallint NOT NULL,
	CONSTRAINT "trade_offer_items_offer_id_item_id_pk" PRIMARY KEY("offer_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "trade_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"proposed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_seq" UNIQUE("trade_id","seq")
);
--> statement-breakpoint
CREATE TABLE "trade_participants" (
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "trade_participants_trade_id_user_id_pk" PRIMARY KEY("trade_id","user_id"),
	CONSTRAINT "trade_participant_position" UNIQUE("trade_id","position")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" "trade_state" DEFAULT 'talking' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text,
	"display_name" text,
	"email" text,
	"phone" text,
	"town" text,
	"county" text,
	"interests" "category"[] DEFAULT '{}' NOT NULL,
	"bankid_subject" text,
	"bankid_verified_at" timestamp with time zone,
	"rating_avg" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymised_at" timestamp with time zone,
	CONSTRAINT "users_device_id_unique" UNIQUE("device_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_bankid_subject_unique" UNIQUE("bankid_subject"),
	CONSTRAINT "interests_bounds" CHECK (cardinality("users"."interests") = 0 or cardinality("users"."interests") between 3 and 5)
);
--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_users_id_fk" FOREIGN KEY ("blocker") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_users_id_fk" FOREIGN KEY ("blocked") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_media" ADD CONSTRAINT "item_media_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_active_trade_id_trades_id_fk" FOREIGN KEY ("active_trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_target_item_items_id_fk" FOREIGN KEY ("target_item") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_users_id_fk" FOREIGN KEY ("reporter") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_users_id_fk" FOREIGN KEY ("target_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_item_items_id_fk" FOREIGN KEY ("target_item") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rater_users_id_fk" FOREIGN KEY ("rater") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ratee_users_id_fk" FOREIGN KEY ("ratee") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_acceptances" ADD CONSTRAINT "trade_acceptances_offer_id_trade_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."trade_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_acceptances" ADD CONSTRAINT "trade_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_item_snapshots" ADD CONSTRAINT "trade_item_snapshots_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offer_cash" ADD CONSTRAINT "trade_offer_cash_offer_id_trade_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."trade_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offer_items" ADD CONSTRAINT "trade_offer_items_offer_id_trade_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."trade_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offer_items" ADD CONSTRAINT "trade_offer_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_owner_available" ON "items" USING btree ("owner_id") WHERE status = 'available';--> statement-breakpoint
CREATE INDEX "items_search" ON "items" USING gin ("search");--> statement-breakpoint
CREATE INDEX "items_title_trgm" ON "items" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "likes_target" ON "likes" USING btree ("target_item");--> statement-breakpoint
CREATE INDEX "likes_from" ON "likes" USING btree ("from_user");--> statement-breakpoint
CREATE INDEX "messages_thread" ON "messages" USING btree ("thread_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE read_at is null;--> statement-breakpoint
CREATE INDEX "trade_participants_user" ON "trade_participants" USING btree ("user_id");