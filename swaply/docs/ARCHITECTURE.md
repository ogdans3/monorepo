# Architecture

The decisions behind the build, and why they went the way they did. `DESIGN.md`
says what the product is; this says how it stands up. Where a decision has a data
protection consequence it is written next to the decision rather than in a
chapter at the end, because that is the only way it survives.

Decided 09.09.2026.

## Hosting: OVH

Our own boxes at OVH, not a managed cloud.

OVH is French and EEA-owned, so there is **no third-country transfer to
document**: no standard contractual clauses, no transfer impact assessment, no
argument about the CLOUD Act. With a US-owned cloud that chapter has to be
written even when the data sits in Frankfurt. For a Norwegian consumer app that
verifies identity, an empty transfer chapter is worth more than elastic capacity
we will not use.

It is also where we already operate: Docker, a dashboard, Caddy. An invite-only
app launched into a few Facebook groups does not have the load profile that
justifies anything else.

**The API does not go behind the dashboard's public subdomains.** Those are
served without authentication, which is fine for drawings and not fine for
personal data. It gets its own entrance with its own TLS and its own auth.

One payoff worth naming: deciding not to facilitate payment removes PSD2 and
Finanstilsynet from the picture entirely. It is probably the most valuable
architectural decision already taken, and it was taken for other reasons.

## Database: self-hosted Postgres

In Docker, on the same box.

A managed database is a **processor** under Article 28: a data processing
agreement, a sub-processor list, an entry in the record of processing. Running it
ourselves removes all of that.

**The condition, and it is not optional:** Article 32(1)(c) requires being able
to restore access to personal data after an incident. Self-hosted Postgres with
an untested restore is the real risk here, far larger than the paperwork. That
means automated encrypted backups to a second location, and a restore that has
actually been performed. If that commitment is not kept, take OVH Managed
Databases instead and write the DPA. That is the honest trade.

Locally the database binds **5434**, because 5433 is already taken on the
development machine.

## Object storage: OVH, not Backblaze

`DESIGN.md` used to say Backblaze B2. Item photos are personal data — people
photograph their things at home, with faces, cars and addresses in the frame — so
storing them with a US provider reintroduces exactly the transfer chapter that
choosing OVH just closed. Object storage moves to OVH so the whole record of
processing stays inside the EEA.

### Until the bucket exists: our own disk

Built 09.09.2026, because a barter app whose listings have no photographs is not
the product. The bytes go in a Docker volume beside the database — same box, same
jurisdiction, and the same backup obligation Article 32(1)(c) already put on the
database.

**A row holds a path, never a URL.** `item_media.url` is `/media/<name>`, and the
origin is put in front of it when a client is served. That is what makes the move
to a bucket a migration rather than a rewrite, and it keeps a dump of the
development database from carrying production hostnames around.

**The name is sixteen random bytes**, not the client's filename and not a hash of
anything: a filename is a path traversal waiting to happen, and a guessable name
is an enumerable catalogue of other people's things. Reading needs no session,
because the photograph has to render on the public page behind a shared link and
in the chat client that drew the preview — the same posture as the invitation it
arrives with.

**Only what is a picture gets stored.** The format is sniffed from the bytes, not
read from the content-type the client claimed, and the list is JPEG, PNG and
WebP. No SVG: it is a document with scripts in it.

**The client shrinks the picture**, at 1600px and quality 82, so what arrives is
a few hundred kilobytes rather than the five megabytes a phone camera makes. The
ten-megabyte ceiling on the server is for the client that does not — the browser
build, where the picker cannot resize.

**Erasure reaches the bytes.** Anonymising somebody unlinks the photographs on
their listings, except one a completed trade snapshotted: that is the
counterparty's record of what they got, and it lives to the retention horizon
with the rest of the snapshot.

What moving to OVH costs: `backend/src/lib/media.ts`, a bucket name, and a
migration that rewrites the stored paths. Nothing else in the codebase knows
where the bytes are.

## Matching: ad-hoc, with room for batch later

A cycle search runs when something changes, not on a schedule.

1. With a depth cap of 3 the search is a two-hop join, not a graph walk.
2. The moment is the product. Round 5 has a celebration screen; "you matched 40
   minutes ago" is a dead screen.
3. Global optimisation is theoretical at this scale. The binding constraint is
   liquidity, not allocation.

The argument for batch is real but later: this is cycle packing, the same problem
as kidney exchange, and batch beats greedy matching there. That bites at
thousands of concurrent wishes, not hundreds. **So the matcher is a function over
the graph, invoked by an event — not code living inside the like endpoint.** A
batch sweep is then additive rather than a rewrite.

### Three triggers, not one

An incremental search only finds cycles *through the new edge*. A cycle can also
appear because an item became free again after a trade was cancelled. So:

- a new like,
- an item becoming available again,
- a nightly sweep that catches drift.

### Serialisation is not optional

Two concurrent likes can each find a cycle using the same item. Lock the involved
item rows with `SELECT … FOR UPDATE` **in sorted id order** — any other order
deadlocks — confirm they are all still available, then create the trade and set
the reservation in one transaction.

### The queries and the indexes

Write the two-cycle and the three-cycle as two explicit joins. **No recursive
CTE**: the cap is three, so generality buys nothing and costs readability.

```sql
create index on likes (target_item);                          -- who wants this
create index on likes (from_user);                            -- what this user wants
create index on items (owner_id) where status = 'available';  -- partial: the hot predicate
```

Every denormalisation, materialised view and cached result is another place the
right to erasure has to reach. That is a real argument for leaving the join
undenormalised longer than performance alone would suggest.

## A trade is a negotiation, not a proposal

Rounds 4 and 5 answered this without anyone writing it down: 09a–09i exists
because a counter-offer creates a **new proposal**, not an edit of the old one.

- `trades` is the negotiation: participants, state, whose turn.
- `trade_offers` is one immutable row per version. The current offer is the
  highest `seq` — no denormalised pointer to go stale.
- `trade_acceptances` hangs off **`offer_id`, not `trade_id`**. Hang it off the
  trade and a counter-offer silently invalidates what people already agreed to,
  which is how someone ends up having accepted something else.
- `terms_version` is stored with the acceptance. We are not a party to the
  agreement, but we are the one holding the record of it, so it has to be exact.

A trade starts in `talking`: participants exist, the offer is empty or half
filled, nothing is reserved.

## Reservation: the owner's acceptance is the lock

> An item is reserved when **its own owner's acceptance** lands on an offer
> containing it.

Not when a conversation starts — otherwise anyone could freeze your drill by
saying hello. Not at `pending` either, which is what `DESIGN.md` used to say:
that freezes people's things on a maybe. Each party locks their own contribution
by accepting, and in a chain that happens one participant at a time.

`items.active_trade_id` makes "one item, one trade" a column rather than a
discipline. Null means free.

**The loser needs a path.** When an item is locked by trade A, any other trade
holding it must be closed with a reason in words — `trades.close_reason` exists
for that, and the trade screen reads it: a cancelled trade says «Byttet er
avsluttet» and then why, rather than going quiet.

**A service is never reserved.** One person can paint three living rooms, so
exclusivity is wrong for it; a database constraint enforces that a service never
holds `active_trade_id`.

## Chat: one thread per trade, and the first message creates the trade

Threads belong to trades. There is no free-floating conversation.

Which means writing the first message to someone about an item **is** opening a
negotiation, and it creates a trade in `talking`. That matches the chips in round
5 — `Jeg vil ha`, `Foreslå ting`, `Foreslå mellomlegg` are all actions on a
trade, not on a conversation.

The four cases on a profile then fall out of the model instead of needing code:
no trade means an empty box that will create one; one trade means one thread;
several trades means a list of trades with their items; and on an item there is
only ever your own conversation about it, so only the first two can happen.

Several people can hold a `talking` trade about the same item at once. That is
correct — three people may want the same drill — and it is why reservation waits
for acceptance.

## Invitations, and the page behind a link

Decided in the building, 09.09.2026.

**An invitation is stored as a hash**, the same way a session token and a
password are. A stolen database should not hand out working keys to a closed app.
The raw token is 16 bytes of base64url: a person reads it, sometimes types it,
and 128 bits is already far past guessing.

**One URL for both kinds**, `/i/<token>`. The token carries the listing when
there is one, so the share button and the plain invitation are the same route and
the same page. It also means the catalogue cannot be walked by guessing item
ids — the key is the only way in — which is the same instinct as keeping the API
off the dashboard's unauthenticated subdomains.

**Reading is not redeeming.** The page renders for anyone holding the link,
including after somebody else has joined with it; only making an account spends
the invitation, and it is spent **inside the transaction that creates the
account**, so a lost race leaves nobody standing in an invite-only app who was
never invited.

**Server-rendered**, because a share link is read by chat clients building a
preview as often as by people, and they do not run our JavaScript. The web
service therefore talks to the API server-to-server, over the container network,
and no browser calls the API from these pages.

**The web font is served from our own origin.** A stylesheet from a font CDN
hands every visitor's IP address to a third party before the page has drawn,
which would reopen the transfer chapter that choosing OVH closed for the sake of
two fewer files in the repository.

**`INVITE_ONLY` is a deployment flag, not a product question.** The product is
invite-only; the flag exists because this repository is also deployed as a demo
whose whole point is that anyone can open all forty-five screens. A redemption is
recorded whichever way it is set — the flag only decides whether an account may
be made *without* a token. `pnpm invite` mints the first one, which is why
`invites.inviter_id` is nullable.

## Anonymous, and why a wish waits

A device id is an identity until a trade needs a stable one. `POST /auth/anonymous`
takes a client-generated secret and returns a session; the account has a
`device_id` and nothing else.

**It may look and wish, and nothing more.** Listing, writing the first message
and accepting all require a claimed account, because each of them puts a person
in front of another person. A device that has been claimed is never let back in
by device id either: after 10c the password is the credential, and a leaked
device id must not be a way around it.

**An unclaimed wish does not close a loop.** It is kept, and counts from the
moment there is a profile. In practice the cycle search cannot reach an
unclaimed user anyway — everyone else in a ring is giving away a listing, and
listing requires an account — so the check in `findCyclesThrough` is the place
that keeps it true if that ever changes.

**Making a profile claims the row**, rather than creating a second one, so every
like survives. The session is reissued at the same moment: the account has just
gained a password, and the token that belonged to a device should not outlive
that change.

## Data protection

Norway is in the EEA, so the GDPR applies in full. This is our reading and not a
legal opinion; someone should look at it before launch.

**Legal bases.** Contract for the service itself, consent for push, legitimate
interest for abuse prevention and for the retention described below.

**No national identity number.** BankID gives a pseudonymous subject and a
timestamp, and that is all we keep. Personopplysningsloven § 12 only permits
storing a fødselsnummer where there is an objective need for certain
identification, and a barter app does not have one. If someone must genuinely be
traced, the police take the subject to the provider, who holds the link. We hold
the key without holding the person.

**Erasure happens in two layers**, because Article 17 is not absolute: 17(3)(e)
preserves what is needed to establish, exercise or defend legal claims, which is
exactly the case where someone has been defrauded.

1. **The profile is anonymised immediately.** Name, avatar, contact details,
   interests, likes, push tokens: gone. The user becomes a tombstone everywhere
   in the app. This is what the user asked for and it happens at once.
2. **A sealed record**, in its own `retained` schema with its own grants, which
   the running application does not read from. It holds the BankID subject,
   contact channel and display name — enough to identify a person to a court, and
   no more — and it is reached through a documented process, not by a service.

**Retention: the completed trade plus three years**, which is the general
limitation period in foreldelsesloven § 2. When a claim can no longer be brought
the purpose is spent and the row goes. Messages follow the same window, because
the evidence in a dispute is almost always in the chat.

**Reports and blocks survive the reported user's deletion**, or
delete-and-re-register is a free wash of the record. For the same reason a
**hash** of the BankID subject stays on a block list: it recognises a banned
person without storing who they are.

**A trade owns a copy of what was traded.** On completion the trade snapshots
title, category, value and one cover image. The listing can then be deleted
freely while the counterparty keeps their own history — and, incidentally, nobody
can edit an item after a trade and quietly rewrite the record. One image, not
ten; at the retention horizon the image goes and the text stays, which is what a
history actually needs.

**Deleting an account cancels its active trades first**, with a clear reason to
the other side. You cannot anonymise someone the counterparty is waiting on.

**Push payloads carry ids, never finished text.** "Ola liked your Bosch drill"
carries a name through Google and Apple; the app fetches the words itself.

**Anonymous users have rights too.** A device id is personal data, so there has
to be a route to access and erasure that does not require an account.

**Age.** Norway set the digital age of consent at 13. Unless we intend to write
the chapter on children's data, the terms say 16 or over.

A one-page DPIA is cheap insurance given that we combine identity verification
with interest-based personalisation.

## Still open

These are open on purpose. Do not settle them in code and call it a decision.

1. **The point of no return.** From what moment can you no longer withdraw? Now
   that we do not facilitate shipping, "sent" is self-reported and we have
   nothing to check it against.
2. **Revenue.** Not facilitating removes the per-trade fee. What remains is ads
   in the collage, paying to unlock contact details, or saying out loud that the
   MVP is free.
3. **Does a like carry the item you would give?** The schema says no. If it
   should, the cycle search changes shape.
