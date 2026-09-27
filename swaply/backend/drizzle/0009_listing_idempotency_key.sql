-- «Legg ut» pressed twice makes one listing.
--
-- The app makes a key once per draft and sends it with POST /items. When the
-- answer is lost after the listing was written, the draft is still on the
-- phone and pressing again sends the same key; the route finds this column
-- and answers with the first listing instead of writing a second one.
--
-- Unique per owner and only where a key was sent: listings from before this,
-- from the seed and from the test tooling have none, and two people's phones
-- may make the same key. The 48 hours a key answers for are not in the index —
-- the route checks them when it looks the key up, and lets go of an expired
-- key before it lists the same draft again.
ALTER TABLE "items" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "items_owner_idempotency_key" ON "items" USING btree ("owner_id","idempotency_key") WHERE idempotency_key is not null;