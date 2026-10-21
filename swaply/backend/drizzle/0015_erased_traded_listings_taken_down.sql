-- What an erased account traded away is taken down, and its words go.
--
-- Erasure withdrew and emptied every listing of the person's except the ones
-- they had traded away, which stayed up: `GET /items/:id` answered anybody
-- holding the id, without a session, with the title and the whole description
-- under «Slettet bruker». `anonymiseUser` takes those down now (deleted_at,
-- no description, status still `traded` so they never come back on the
-- market); this does the same for the accounts erased before it did.
--
-- The counterparty's history is the trade's snapshot, which has the title and
-- never had the description, so nothing anybody is shown depends on these
-- rows' words. The photographs went at the erasure already.
UPDATE "items" SET
  "deleted_at" = COALESCE("deleted_at", now()),
  "description" = NULL
WHERE "status" = 'traded'
  AND "owner_id" IN (SELECT "id" FROM "users" WHERE "anonymised_at" IS NOT NULL)
  AND ("deleted_at" IS NULL OR "description" IS NOT NULL);
