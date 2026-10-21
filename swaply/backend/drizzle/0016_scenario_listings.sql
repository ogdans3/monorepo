-- The listings «Bygg et bytte» makes are marked, so the test ring is a column.
--
-- A scenario spends «[test] …» things it makes for the purpose, on the admin's
-- own account as well as on the test accounts'. The test accounts' are
-- hidden from everybody outside the admin's ring by who owns them; the
-- admin's were not, because the admin is a real person, and real people saw
-- them on Oppdag, hearted them and opened real trades with the admin over
-- them. `made_by_scenario` is what `trades/ring.ts` reads to put them in the
-- ring. Defaulted, so an image from before writes rows that are not marked
-- and reads the table as it did.
ALTER TABLE "items" ADD COLUMN "made_by_scenario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- The ones made before this, found by three things that are each true of
-- every one of them and that together nothing else has: the title is
-- «[test] » and a catalogue title (`admin/fixtures.ts`, unchanged since it was
-- written), which only `somethingToGive` writes; there is no idempotency key,
-- which every «Legg ut» from the app sends; and the ring's admin pressed
-- «Bygg et bytte» in the minute before the listing was made — `admin_actions`
-- has the row, written before the handler runs. A scenario from before
-- 20.09.2026 named its listings without the prefix, and nothing tells those
-- apart from a person's own; they are left as they are.
UPDATE "items" i SET "made_by_scenario" = true
WHERE NOT i."made_by_scenario"
  AND i."idempotency_key" IS NULL
  AND i."title" IN (
    '[test] Bosch drill 18V',
    '[test] Terrengsykkel 26"',
    '[test] Retro spillkonsoll',
    '[test] Fiskestang med snelle',
    '[test] Kajakk med åre',
    '[test] Ullgenser M',
    '[test] Skateboard',
    '[test] Barnesykkel 20"',
    '[test] Kaffekvern',
    '[test] Eske med LEGO',
    '[test] Klassisk gitar'
  )
  AND EXISTS (
    SELECT 1 FROM "users" o
    JOIN "admin_actions" a ON a."admin_id" = COALESCE(o."test_account_of", o."id")
    WHERE o."id" = i."owner_id"
      AND a."acting_as" IS NULL
      AND a."method" = 'POST'
      AND split_part(a."path", '?', 1) = '/admin/scenarios'
      AND i."created_at" >= a."created_at"
      AND i."created_at" < a."created_at" + interval '1 minute'
  );
