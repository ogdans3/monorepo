CREATE TABLE "hidden_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "category" NOT NULL,
	"subcategory" text,
	"item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hidden_kind_or_listing" CHECK (num_nonnulls("hidden_listings"."subcategory", "hidden_listings"."item_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "hidden_listings" ADD CONSTRAINT "hidden_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_listings" ADD CONSTRAINT "hidden_listings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hidden_kind_once" ON "hidden_listings" USING btree ("user_id","category",lower("subcategory")) WHERE subcategory is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hidden_listing_once" ON "hidden_listings" USING btree ("user_id","item_id") WHERE item_id is not null;