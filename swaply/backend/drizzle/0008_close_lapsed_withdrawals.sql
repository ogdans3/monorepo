-- A withdrawal question left waiting on a trade that has already ended.
--
-- Until this change only erasure closed the question when it ended a trade;
-- the test tooling's «Nullstill → bytter» and a handover finished while the
-- question waited left it open, and an answer to it put the ended trade back
-- to `accepted`. The code now closes it wherever a trade ends and refuses
-- every answer to an ended trade. This brings rows written before that into
-- line, as lapsed — the state erasure has always used for the same case.
--
-- Nothing else moves: a trade's state is not touched, and a question on a
-- trade still going on is left for its deadline or its answer.
UPDATE "trade_withdrawals" SET "state" = 'expired', "resolved_at" = now()
WHERE "state" = 'waiting'
  AND "trade_id" IN (SELECT "id" FROM "trades" WHERE "state" IN ('completed', 'cancelled'));
