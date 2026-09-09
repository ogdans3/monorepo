# Swaply

A bartering platform where users trade items directly. Say you want something; when intent closes a loop, we connect people so a trade can happen.

**The name is "Swaply", one p** — decided 06.09.2026. Earlier drafts of this file said "Swappify"; the screen mockups have said Swaply from round 1. The folder `swappify/` and the `swapply-design` deployment slug are historical identifiers and are not being renamed.

This document is current as of round 5 (brief: `round-5-brief.md`, decisions: `meeting-notes-2026-09-06.md`) and the architecture decisions of 09.09.2026 (`ARCHITECTURE.md`, which holds the reasoning this file only states). Where it disagrees with the screen exports, the exports win and this file is behind.

## Scope (v1)

- **Mobile app only** (Flutter). Web is a landing page **plus a public page per item** — see *Sharing*.
- **Items and services.** A listing is a thing or a piece of work, and it may have no photo at all.
- **Invite-only** via deep links.
- **Anonymous-first**: no sign-up to add an item or express interest. Accounts are deferred until a match needs a stable identity.
- **We are not a party to the trade.** No shipping, no payment, no cut — see *Facilitation*.

## Facilitation

**Swaply does not facilitate trades.** Decided 06.09.2026, closing the question left open on 31.07: if money moves through us, are we liable for the shipping? It doesn't, so we aren't.

- The two parties agree on handover and any cash difference themselves.
- The trade agreement screen states it verbatim: *«Swaply er ikke part i byttet og fasiliterer ikke frakt eller betaling. Avtalen er mellom dere.»*
- The chat for a multi-party trade carries a fixed, non-dismissable banner saying the same.
- A **cash difference** (*mellomlegg*) is recorded as part of the agreement, not settled by us. It is a number both sides agreed on, never a transaction.

The consequence for revenue is real: a per-trade admin fee is off the table as long as this holds. See *Open questions*.

## Stack

- **App**: Flutter (iOS + Android)
- **Backend**: Node + TypeScript
- **Web**: SvelteKit (landing, invite handling, public item pages)
- **DB**: Postgres
- **Media**: OVH Object Storage. Item photos are personal data, so they stay inside the EEA along with everything else
- **Hosting**: our own boxes at OVH, EEA-owned, with the API on its own authenticated entrance
- **Push**: FCM + APNs
- **Repo**: monorepo — `app/`, `backend/`, `web/`, `shared/`

## UX

**Bottom nav, five slots:** Oppdag · Bytter · [ Legg ut ⇄ ] · Chats · Profil. `Legg ut` is the centred action button. `Chats` carries an unread count in coral; at zero it shows nothing, not a zero.

Discovery is a **collage you scroll**, not a swipe stack. Tinder-style swipe cards were the v1 interaction through round 3 and were cut in round 4.

**The directed edge is a visible heart on every card.** This is the single most important interaction in the product — a chain only forms when enough people have expressed enough wishes, so the signal has to be cheap and obvious. Round 4 had it behind a long-press with no affordance; round 5 puts it on the card face. Long-press keeps a context menu for the rare actions: hide similar, view profile, report.

## Discovery

**Oppdag and Søk are one page**, under Oppdag's name, with the search page's behaviour: a search field that is always visible, and a filter button opening advanced search.

Free-text search, Postgres-native, no extra infra: `tsvector` over title/description/tags (GIN index) + `pg_trgm` for typo tolerance, with category/location/condition filters on top.

Before the user has searched, the page shows **rows by interest** — the categories they picked at first run. This is the first personalisation in the product. It is a filter on a category field, not a ranking model; there is still no recommendation algorithm in v1, but this file no longer says there is nothing.

## Interests

New first-run screen: pick **3–5 categories** from a fixed list (Verktøy, Gaming, Sykkel, Klær, Sport, Båt og fritid, Møbler, Elektronikk, Barn, Hage, Musikk, Bil og MC). Below 3 the continue button is disabled; at 5 the selection locks with a calm message rather than an error.

Stored on `users`. It replaces the "how it works" onboarding slides, which were cut in round 4.

## Matching

A like = "I want *their* item" — a directed edge:

```
(user A) --wants--> (item b, owned by B)
```

A match is a **cycle** in this graph:

- **Direct (2-cycle)**: A wants B's item and B wants A's → mutual swap.
- **Chain (3-cycle)**: A→B→C→A. Each person gives the next what they want.

**Depth is capped at 3 hops.** The many-way flow was cut in round 4, so the earlier cap of 5 no longer describes anything we build. The two-cycle and the three-cycle are written as two explicit joins rather than a recursive CTE: at a cap of three, generality buys nothing and costs readability.

The search runs on three triggers — a new like, an item becoming available again, and a nightly sweep — because an incremental search only finds cycles through the new edge. On a hit, record a `pending` trade and push-notify all participants.

### A trade is not one item against one item

Each side of a hop is a **list of 1–3 items**, with a total value per side and the difference between them recorded as *mellomlegg*: «Mellomlegg: du legger til 200 kr». The cycle search still works on single-item edges — the like is what closes the loop; the item lists are what the parties negotiate afterwards.

### Services, and listings without photos

A listing is either an item or a service. A service has no condition — "worn" says nothing about shovelling snow — and, more importantly, **it is never exclusive**: one person can paint three living rooms, so a service never holds a reservation the way a drill does.

Photos are optional for both. Discovery is a collage, so a listing without one needs a generated card rather than a hole: category mark and title on deep green.

### Lifecycle

```
talking → pending ⇄ countered → accepted → completed
   └──────────┴──────────┴──────────────→ cancelled
```

- **talking** — someone wrote the first message. Participants exist, the offer is empty or half filled, and **nothing is reserved**. Several people can be in a `talking` trade about the same item at once, which is correct: three people may want the same drill.
- **pending** — a cycle was found, or a concrete offer is on the table. Each participant sees whose turn it is.
- **countered** — a participant proposed a different composition (other items, different *mellomlegg*) instead of accepting. This is a state, not just a button: a trade can go back into negotiation rather than only forward. The counterparty then faces the same three actions.
- Three actions are always available on your turn: **Avslå** · **Foreslå motbytte** · **Godta bytte**.
- Accepting goes through **the agreement screen** before it counts: a plain-language summary of who gives what to whom and where, a terms checkbox, the non-facilitation sentence, and a swipe-to-accept that stays disabled until the box is ticked. BankID is prompted after this, on first accept.
- **An acceptance belongs to a specific version of the offer**, not to the trade. A counter-offer creates a new version and leaves earlier acceptances on the version they were given for, which is the only way to avoid having accepted something else.
- **accepted** — everyone has accepted; items flip to `traded`, and the trade takes a snapshot of what was traded so the listings can be deleted without erasing anyone's history.
- **De-accept** reverses your acceptance → back to `pending`. Any single de-accept holds the whole trade. There is a point past which this stops being possible — see *Open questions*.

### Reservation

**An item is reserved when its own owner's acceptance lands on an offer containing it.** Not when a conversation starts, or anyone could freeze your things by saying hello; and not at `pending`, which freezes people's things on a maybe. Each party locks their own contribution by accepting.

One item is in at most one trade, and that is a column rather than a discipline. When an item is locked by one trade, every other trade holding it is closed with a reason in words — never a silent disappearance.

## Chat

Text-only in v1. **One thread per trade, always** — there is no free-floating conversation.

Which means writing the first message about an item *is* opening a negotiation, and it creates a trade in `talking`. That is what the chips above the field are: `Jeg vil ha` · `Foreslå ting` · `Foreslå mellomlegg` are actions on a trade, not on a conversation.

The four cases then follow from the model rather than needing rules of their own. No trade between you: an empty box that will create one. One trade: that thread. Several: a list of the trades with their items, opened from there. And on an item there is only ever your own conversation about it, so only the first two can happen.

A chain trade's thread holds all participants together — it only works if everyone syncs. The same conversation component appears in the item detail, in the trade detail, and while waiting for the others to accept.

**Read state is per participant**, which is what the unread badge on the Chats tab counts.

## Identity & trust

- Anonymous, device-scoped, until a match needs a stable identity.
- On claim: display name, email *or* phone (one contact channel), coarse location.
- **BankID** is prompted at the first accept and shows as a badge on the profile. It is a trust marker, not a login method.
- **Login is email only.** Every other sign-in method is off the login screen: one field, one button, and a line saying we send a link.

## Trust & safety

Invite-only limits abuse; on top of that, users can **report** a user or item and **block** a user (blocked users' items are hidden and can't match). Reports are reviewed manually for the MVP.

Report and block use a stronger red, `#E5484D`. Coral `#FF6B5E` stays the app's "no" colour, and the two must not be the same value.

## Sharing

An item has a **share button** that opens the system share sheet with a link and the line «Se denne på Swaply: Bosch drill 18V, verdi 600 kr.»

The app is invite-only, so a shared link almost always lands with someone who doesn't have it. The link therefore **carries an `invites` token** — the same mechanism as the existing invite deep links — which makes sharing our best growth channel rather than a dead end.

That requires a **public web page per item**: title, image, value, an open-in-app button, and Open Graph tags so the link looks like something in a chat. This is why web is no longer only a landing page.

## Feedback

Two separate things after a completed trade, and they are not the same screen:

- **Review of the counterparty** — five stars, optional text, quick chips (`Kom som avtalt` · `God kommunikasjon` · `Møtte ikke opp`). Feeds the profile rating.
- **Feedback about Swaply** — a 1–5 scale and one free-text field, shown far less often.

## Data model

The schema is code now: `backend/src/db/schema.ts`, with the migration in
`backend/drizzle/`. That file is the authority; this is the shape of it.

- `users` — anonymous (device-scoped) until claimed, then display name, email
  *or* phone, coarse location, 3–5 interests, and a **pseudonymous BankID
  subject**. Never a fødselsnummer.
- `items` — a listing, item or service, with an optional photo set and an
  `active_trade_id` that is the reservation.
- `likes` — the directed edge, and nothing else.
- `trades` / `trade_participants` — the negotiation and who is in it, in cycle
  order.
- `trade_offers` / `trade_offer_items` / `trade_offer_cash` — one immutable row
  per version of the deal. The current offer is the highest `seq`.
- `trade_acceptances` — keyed on the **offer**, with the terms version that was
  ticked.
- `trade_item_snapshots` — what was actually traded, copied at completion.
- `threads` / `thread_participants` / `messages` — one thread per trade, with
  read state per participant.
- `reviews`, `app_feedback`, `reports`, `blocks`, `notifications`, `invites`,
  `devices`.
- `retained.identities` and `retained.blocked_subjects` — the sealed record, in
  its own schema with its own grants. See *Erasure and retention*.

## Erasure and retention

Deleting an account happens in two layers, because Article 17 is not absolute:
17(3)(e) preserves what is needed to establish or defend a legal claim, which is
the case where someone has been defrauded.

1. **The profile is anonymised immediately** — name, contact details, interests,
   likes, push tokens. The user becomes a tombstone everywhere in the app.
2. **A sealed record survives** in the `retained` schema, holding only enough to
   identify a person to a court: the BankID subject, contact channel and display
   name. The running app does not read from it.

**Retention is the completed trade plus three years**, the general limitation
period in foreldelsesloven § 2. Messages follow the same window, because the
evidence in a dispute is almost always in the chat.

Reports and blocks outlive the reported user, or delete-and-re-register is a free
wash of the record. Deleting an account cancels its active trades first, with a
reason to the other side.

`ARCHITECTURE.md` has the rest, including the legal bases and why the photos
moved to OVH.

## Screens

The screen-by-screen specification lives in `round-5-brief.md`; the exports are hosted separately (five rounds so far). Screen copy is Norwegian. This file describes the product, not the layouts.

Round 5 came back with 45 screens and departs from the brief in two places worth knowing: the three-way flow kept its old numbering (07i–07l) rather than moving up to 07a–07c, and the counter-offer grew from a button into a nine-screen flow (09a–09i), which is the clearest confirmation that it is a state and not an action.

## Open questions

1. **The point of no return.** Round 4 introduced a terminal state, «Ikke mulig, en ting er sendt»: past some moment you can no longer back out. Since we don't facilitate shipping, "sent" is self-reported, and nobody has defined who reports it, what it does to a three-way trade when one person has sent and another wants out, or what recourse the sender has. Left undecided on 06.09.
2. **Revenue.** Four ideas from 31.07, none of which has appeared in any of five rounds of screens. "An ad every 10th swipe" needs a swipe, which no longer exists. A per-trade admin fee needs facilitation, which we've now ruled out. That leaves ads in the collage and paying to unlock contact info — and the honest option of saying out loud that the MVP is free and unmonetised, so it stops resurfacing every round.
3. **Does a like carry the item you're offering?** The original model made a swipe an offer of a specific item of yours. With multi-item trades and counter-offers, composing the trade has moved to the negotiation screens, so a like is modelled above as just "I want this". If a like should still name what you'd give, the cycle search changes shape.
4. **How long do we keep messages beyond a dispute?** Three years is set by the claim window above. Whether an ordinary conversation that never became a trade should live that long is a separate, unanswered question.

## Next steps

Scaffold and schema are done. What is left, in order:

1. ~~Scaffold + Postgres schema~~ — done 09.09.2026
2. Media upload to OVH Object Storage
3. Item CRUD + discovery search
4. Like endpoint + 2-cycle match, with the reservation lock and the loser path
5. Trade composition, counter-offer and accept flow (incl. the agreement screen)
6. 3-cycle search + the nightly sweep
7. Chat + read state + push notifications
8. Invite deep link + share link + public item page + anonymous account flow
9. Report/block, reviews
10. Erasure: anonymisation, the sealed record, and the purge job
