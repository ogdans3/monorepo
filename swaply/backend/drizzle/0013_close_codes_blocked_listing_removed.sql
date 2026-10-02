-- Two more ways for a trade to end, each with its code.
--
-- `blocked`: one person in a trade blocked another. A block used to be only a
-- row, and the negotiation between them went on — the chat, the counter-offers
-- and the yes all still worked across it. Making a block now ends every trade
-- the two are both negotiating.
--
-- `listing_removed`: the owner removed a listing that was on the table. The
-- trades about it used to stay open around a thing that was no longer there.
--
-- Appended, which is all `ADD VALUE` can do, and nothing written before this
-- has either code. An app from before this does not know them and says
-- «Byttet er avsluttet» and the stored words (`trades/close.ts`).
ALTER TYPE "public"."trade_close_code" ADD VALUE 'blocked';--> statement-breakpoint
ALTER TYPE "public"."trade_close_code" ADD VALUE 'listing_removed';
