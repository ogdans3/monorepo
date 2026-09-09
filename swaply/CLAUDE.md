# Working in Swaply

Read `README.md`, then `docs/DESIGN.md`. The design doc is the product contract,
not decoration — it records decisions that cost meetings to reach, and several of
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

**A conversation does not have to hang off a match.** Two users can talk about a
single item before any trade exists, so threads belong to either a match or an
item — never assume a match id is present.

## Open questions, which are open on purpose

Do not resolve these in code and call it a decision. They are in `docs/DESIGN.md`
under *Open questions*: the point of no return after acceptance, the revenue
model, whether a like carries the item you would give, and services as tradeable
things.

## Conventions

- Screen copy is Norwegian. Code, comments and commits are English.
- The Flutter app cannot import `shared/`. Anything both need is written twice
  and changed together.
- Comments explain *why*, especially where the code looks odd on purpose.
