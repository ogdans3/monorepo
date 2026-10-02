import { sql, type SQL } from 'drizzle-orm'

/**
 * Why a trade was cancelled — `trades.close_code`, and `closeCode` on the
 * trade view. The schema's enum is the list; this is the same list for the
 * type checker.
 */
export type CloseCode =
  | 'displaced'
  | 'declined'
  | 'withdrawn_early'
  | 'withdrawal_approved'
  | 'account_deleted'
  | 'ended_by_admin'

/**
 * The words each code is stored with in `close_reason`.
 *
 * One sentence is read by everybody in the trade, so it has to be true for
 * each of them: for the one who ended it as much as for the others, and in a
 * ring of three as much as in a pair. Where no one sentence is, the words
 * depend on how many are in the trade. The app does not read these — it picks
 * its own from the code, and can say «du» to the one who did it — so they are
 * the record, and what a client that has not learnt a new code falls back on.
 */
const REASONS: Record<CloseCode, string | { pair: string; ring: string }> = {
  displaced: 'En gjenstand i byttet ble reservert av et annet bytte',
  declined: 'Byttet ble avslått',
  // Read by the one who pulled out too, which «Den andre parten trakk seg»,
  // what this used to say, was not true for.
  withdrawn_early: 'En av dere trakk seg før byttet var godtatt',
  withdrawal_approved: 'Byttet ble avbrutt etter avtale mellom partene',
  // Never read by the one who deleted — a tombstone has no list — so in a pair
  // there is exactly one other party. In a ring of three there are two, and
  // «Den andre parten» named one of them.
  account_deleted: {
    pair: 'Den andre parten slettet kontoen sin',
    ring: 'En av de andre slettet kontoen sin',
  },
  ended_by_admin: 'Byttet ble avsluttet fra testverktøyet',
}

/**
 * Whether `endTrade` tells the others in the trade, with a `trade_cancelled`
 * notification carrying the trade and the code — never the words, which are
 * the app's to write and must not travel through Google or Apple in a push.
 *
 * Every ending a person decides is told to everybody else in it, which is
 * what the sheets behind «Avslå» and «Trekk deg» promise («… får beskjed»).
 * Two are not told here: erasure tells the others itself, in the same
 * transaction, and the test tooling's «Nullstill» only ends trades inside its
 * own ring. A record rather than a list, so a new code cannot arrive without
 * somebody deciding this for it.
 */
export const TOLD: Record<CloseCode, boolean> = {
  displaced: true,
  declined: true,
  withdrawn_early: true,
  withdrawal_approved: true,
  account_deleted: false,
  ended_by_admin: false,
}

/**
 * The `close_reason` for a code, as an expression over the `trades` row being
 * updated, so a sentence that depends on the size of the trade is chosen by
 * the statement that writes it.
 */
export function closeReasonSql(code: CloseCode): SQL {
  const words = REASONS[code]
  if (typeof words === 'string') return sql`${words}`
  return sql`case when (select count(*) from trade_participants p where p.trade_id = trades.id) > 2
                  then ${words.ring} else ${words.pair} end`
}
