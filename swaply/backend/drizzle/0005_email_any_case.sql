-- One account per address, whatever the case it was typed in.
--
-- The generated statements drop the case-sensitive key and put a unique index
-- on lower(email) in its place. The update between them is hand-written: the
-- routes now store an address lower-cased, and the rows written before them
-- are brought into line so a lookup by lower(email) and the stored value agree.
--
-- If two accounts differ only in case, the index cannot be built and the whole
-- migration rolls back. That is on purpose: which of the two is the person's
-- is a question for a human, and no statement here should guess.
--
-- The index keeps the dropped constraint's name. An image from before this
-- migration maps that name to 409 email_taken, and a rollback runs such an
-- image against a database this migration has already changed: under a new
-- name, a sign-up in another case than an existing address answered 500.
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));
