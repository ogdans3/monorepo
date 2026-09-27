// Trades, and the one order their locks are taken in.
//
// Everything that changes a trade or what it holds takes its row locks in
// this order, and in no other:
//
//   1. trades, lowest id first — every trade the transaction will write,
//      before any listing;
//   2. listings, lowest id first, in one batch.
//
// `locks.ts` is the two halves (`lockTrades`, `lockItems`), and every caller
// goes through it: `acceptOffer`, `revokeAcceptance`, `completeTrade`,
// `endTrade` — and so `cancelTrade`, «Avslå», «Trekk deg», a yes to a
// withdrawal, the tool's «Nullstill → bytter» and a trade pushed out by
// somebody else's yes — every answer to a withdrawal question
// (`openTradeFor`), erasure (`anonymiseUser`), and the tool's «Nullstill →
// gjenstander», which takes listings alone.
//
// Two transactions that take the rows they share in the same order queue.
// Two that take them in different orders can each end up holding what the
// other needs next, and Postgres settles that by killing one of them: a 500
// under somebody's button, or «Slett kontoen» failing. Before this was one
// order, an acceptance took its own listings, then the trades it pushed out,
// then its own trade; erasure took each trade's listings and then that trade,
// one trade at a time; and two acceptances took the trades they pushed out in
// whatever order their own listings sorted in. `lock-order.test.ts` races the
// pairs that used to meet halfway.
//
// Why trades before listings. A trade's row is the lock on what the trade
// holds: every write of `items.active_trade_id` — a reservation, a release, a
// completion — happens with that trade held. So once a transaction holds a
// trade, the listings it holds are a fixed set, and one sorted statement can
// take them all. The other way round cannot be kept by an acceptance: it
// cannot know which listings it lets go until it knows which trades it pushes
// out, and cannot trust that list until those trades are held — a yes landing
// in one of them at that moment reserves a listing nobody then frees.
//
// Every lock is `for no key update`, the lock an UPDATE takes on its own. It
// queues writers and nothing else: the key-share lock a new offer, message,
// like or reservation takes on the row it points at does not wait for it, so
// the inserts that open trades and put things on the table (`startTalking`,
// `openTradeFromCycle`, `proposeCounterOffer`) stand outside the order
// without breaking it — the only row lock any of them takes is its own
// trade's.
//
// Inside one transaction a lock already held costs nothing, so a helper may
// lock what its caller has locked (`endTrade` under an acceptance or an
// answer). What it may not do is reach for a trade after the caller has taken
// listings. The account's row is outside the order: erasure takes it first
// only for an account in no trade (a device, through `onlyIf`), and writes the
// tombstone last, after the trades and listings are done.
export * from './cycles.js'
export * from './erasure.js'
export * from './offer.js'
export * from './trades.js'
