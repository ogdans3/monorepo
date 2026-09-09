CREATE TYPE "public"."withdrawal_state" AS ENUM('waiting', 'approved', 'rejected', 'expired', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."trade_state" ADD VALUE 'paused' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "trade_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responds_by" timestamp with time zone NOT NULL,
	"state" "withdrawal_state" DEFAULT 'waiting' NOT NULL,
	"resolved_at" timestamp with time zone,
	"blocked_by_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_item_snapshots" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- drizzle-kit emits a scalar type for the array column here, and the check
-- constraint calls cardinality() on it, so both need a hand: drop the check,
-- swap through text[], and put the check back once the enum is the new one.
ALTER TABLE "users" DROP CONSTRAINT "interests_bounds";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" SET DATA TYPE text[] USING "interests"::text[];--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('sykling', 'gaming', 'verktoy', 'klaer', 'bat', 'friluft', 'barn', 'hjem', 'sport', 'musikk', 'boker', 'diverse');--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";--> statement-breakpoint
ALTER TABLE "trade_item_snapshots" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" SET DATA TYPE "public"."category"[] USING "interests"::"public"."category"[];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" SET DEFAULT '{}'::"public"."category"[];--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "interests_bounds" CHECK (cardinality("users"."interests") = 0 or cardinality("users"."interests") between 3 and 5);--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "chips" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "trade_withdrawals" ADD CONSTRAINT "trade_withdrawals_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_withdrawals" ADD CONSTRAINT "trade_withdrawals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "withdrawals_trade" ON "trade_withdrawals" USING btree ("trade_id");