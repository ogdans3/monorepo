-- Why a trade was cancelled, as a code as well as in words.
--
-- `close_reason` was one sentence for every reader, and one of them was wrong:
-- erasure wrote «Den andre parten slettet kontoen sin», which in a ring of
-- three names one other party where there are two. The words stay, as the
-- record of what the trade was closed with; the code is what the app picks its
-- own words from.
--
-- The generated statements add the type and the column. The update is
-- hand-written and gives the rows closed before this their code, from the
-- sentences the code wrote — every one of them was a fixed string. A reason in
-- any other words (a hand-edited row, a test's) is left without a code rather
-- than guessed at. The words themselves are not rewritten: they are history.
CREATE TYPE "public"."trade_close_code" AS ENUM('displaced', 'declined', 'withdrawn_early', 'withdrawal_approved', 'account_deleted', 'ended_by_admin');--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "close_code" "trade_close_code";--> statement-breakpoint
UPDATE "trades" SET "close_code" = CASE "close_reason"
    WHEN 'En gjenstand i byttet ble reservert av et annet bytte' THEN 'displaced'
    WHEN 'Byttet ble avslått' THEN 'declined'
    WHEN 'Den andre parten trakk seg før byttet var godtatt' THEN 'withdrawn_early'
    WHEN 'Byttet ble avbrutt etter avtale mellom partene' THEN 'withdrawal_approved'
    WHEN 'Den andre parten slettet kontoen sin' THEN 'account_deleted'
    WHEN 'Byttet ble avsluttet fra testverktøyet' THEN 'ended_by_admin'
  END::"trade_close_code"
WHERE "state" = 'cancelled' AND "close_reason" IS NOT NULL AND "close_code" IS NULL;
