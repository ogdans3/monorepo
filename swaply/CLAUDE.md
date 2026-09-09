# Working in Swaply

Read `README.md`, then `docs/DESIGN.md` and `docs/ARCHITECTURE.md`. The design
doc is the product contract and the architecture doc is the reasoning behind the
build; neither is decoration — it records decisions that cost meetings to reach, and several of
them are counter-intuitive enough to be worth restating here.

## Decisions that get eroded first

**We do not facilitate the trade.** No shipping, no payment, no cut, ever. A
*mellomlegg* (cash difference) is a number both parties agreed on that we write
down; it is never a transaction we perform. Any feature that starts moving money
through us reopens a liability question that was deliberately closed.

**The heart on a discovery card is the whole product.** It is the directed edge
in the match graph, and a chain only forms when enough people express enough
wishes. It stays visible on the card face. Round 4 hid it behind a long-press and
that was the single biggest problem with the round.

**Chains cap at three participants.** The many-way flow was cut, so a deeper
cycle search would find matches no screen can show.

**A trade can go backwards.** `countered` is a real state: a counter-offer sends
the trade back into negotiation rather than only forward to `accepted`. Modelling
acceptance as a one-way boolean is wrong.

**Two reds, and they must never collapse into one value.** Coral `#FF6B5E` is the
"no" colour. `#E5484D` is reserved for report and block.

**Three files hold one palette:** `docs/DESIGN.md`, `web/src/app.css` and
`app/lib/design/tokens.dart`. Change them together.

**Every thread belongs to a trade, and the first message creates one.** Writing
to someone about an item opens a negotiation, so the trade exists in `talking`
before any offer does. There is no free-floating conversation to model.

**An item is reserved by its own owner's acceptance**, never earlier. Not when a
conversation starts, or anyone could freeze your things by saying hello; not at
`pending`, which freezes them on a maybe. `items.active_trade_id` makes "one
item, one trade" a column rather than a discipline, and the trade that loses the
race is closed with a reason in words.

**An acceptance belongs to an offer version, not to a trade.** `trade_offers`
rows are immutable; a counter-offer writes a new one. Move acceptance up to the
trade and a counter-offer silently invalidates what people already agreed to.

**A service is never exclusive.** One person can paint three living rooms, so a
service never holds a reservation. A check constraint enforces it.

**No fødselsnummer, anywhere.** BankID gives a pseudonymous subject and a
timestamp and that is all we store. If someone must be traced, the police take
the subject to the provider.

**Erasure is anonymisation plus a sealed record.** The profile is emptied at
once; a minimal identity survives in the `retained` schema for the claim window
(completed trade plus three years). The application must never read from
`retained`. A trade owns a snapshot of what was traded, which is what lets a
listing be deleted without erasing the counterparty's history.

## Open questions, which are open on purpose

Do not resolve these in code and call it a decision. They are in `docs/DESIGN.md`
under *Open questions*: the point of no return after acceptance, the revenue
model, whether a like carries the item you would give, and how long an ordinary
conversation that never became a trade should live.

## Testing

The backend suite runs against a **real Postgres**, not a mock: check
constraints, partial indexes and the reservation race are database behaviour, and
mocking them would only test the mock.

```sh
pnpm db:up && pnpm db:migrate && pnpm test
```

`backend/test/guard.ts` refuses to run against anything that is not a local host
or a database whose name says test, because the suite truncates tables. Do not
weaken it.

## Conventions

- Screen copy is Norwegian. Code, comments and commits are English.
- The Flutter app cannot import `shared/`. Anything both need is written twice
  and changed together.
- Comments explain *why*, especially where the code looks odd on purpose.
