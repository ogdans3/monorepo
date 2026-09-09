# Swaply

A bartering platform where users trade items directly. Say you want something; when intent closes a loop, we connect people so a trade can happen.

**The name is "Swaply", one p** — decided 06.09.2026. Earlier drafts of this file said "Swappify"; the screen mockups have said Swaply from round 1. The folder `swappify/` and the `swapply-design` deployment slug are historical identifiers and are not being renamed.

This document is current as of round 5 (brief: `round-5-brief.md`, decisions: `meeting-notes-2026-09-06.md`). Where it disagrees with the screen exports, the exports win and this file is behind.

## Scope (v1)

- **Mobile app only** (Flutter). Web is a landing page **plus a public page per item** — see *Sharing*.
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
- **Media**: Backblaze B2, delivered via Cloudflare (`items.media` holds URLs)
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

**Depth is capped at 3 hops.** The many-way flow was cut in round 4, so the earlier cap of 5 no longer describes anything we build. On each new like, search for a cycle back to the liker (recursive CTE / BFS). On a hit, record a `pending` match and push-notify all participants.

### A trade is not one item against one item

Each side of a hop is a **list of 1–3 items**, with a total value per side and the difference between them recorded as *mellomlegg*: «Mellomlegg: du legger til 200 kr». The cycle search still works on single-item edges — the like is what closes the loop; the item lists are what the parties negotiate afterwards.

### Lifecycle

```
pending ⇄ countered → accepted → completed
   └──────────┴──────→ cancelled
```

- **pending** — cycle found. Involved items become `reserved` (hidden from discovery so they can't be double-matched). Each participant sees whose turn it is.
- **countered** — a participant proposed a different composition (other items, different *mellomlegg*) instead of accepting. This is a state, not just a button: a trade can go back into negotiation rather than only forward. The counterparty then faces the same three actions.
- Three actions are always available on your turn: **Avslå** · **Foreslå motbytte** · **Godta bytte**.
- Accepting goes through **the agreement screen** before it counts: a plain-language summary of who gives what to whom and where, a terms checkbox, the non-facilitation sentence, and a swipe-to-accept that stays disabled until the box is ticked. BankID is prompted after this, on first accept.
- **accepted** — everyone has accepted; items flip to `traded`.
- **De-accept** reverses your acceptance → back to `pending`, items back to `reserved`. Any single de-accept holds the whole trade. There is a point past which this stops being possible — see *Open questions*.

## Chat

Text-only in v1. Two kinds of thread, and this is a change: **a conversation no longer always hangs off a match.**

- **Per item, between two users** — started from the item detail page, before any trade exists. Header «Snakk med Ola», a text field, and three chips above it: `Jeg vil ha` · `Foreslå ting` · `Foreslå mellomlegg`.
- **Per match, all participants together** — a chain trade only works if everyone syncs. Confirmed 06.09 after wavering between rounds.

The same conversation component appears in the item detail, in the trade detail, and while waiting for the others to accept. You can always talk to the counterparty, at every stage.

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

## Data model (sketch)

- `users` — anonymous (device-scoped) until claimed. On claim: display_name, email *or* phone, location (town/county — coarse, no street address); `rating` (aggregate from reviews); `interests` (category list, 3–5, set at first run); `bankid_verified_at`
- `items` — owner, title, description, media (image URLs; video later), estimated_price (user-set), category/tags, condition, location (coarse), status (available/reserved/traded)
- `likes` — from_user, target_item. *(Was `swipes`. See open question 3 on whether it also carries an offered item.)*
- `matches` — ordered participants, state (pending/countered/accepted/completed/cancelled), depth
- `match_hops` — match, from_participant, to_participant, cash_difference (the *mellomlegg* for that hop, a recorded agreement — not a transaction)
- `match_hop_items` — hop, item, direction (given/received). 1–3 per direction; this is what replaces the old single give/get per hop
- `match_participants` — match, user, accepted (bool), accepted_at, terms_accepted_at
- `threads` — either `match_id` (group thread) *or* (`item_id` + two users) for a pre-trade conversation. Exactly one of the two.
- `messages` — thread, sender, body
- `message_reads` — thread, user, last_read_message_id (drives the unread badge)
- `reviews` — match, rater, ratee, score, comment (after a completed trade)
- `app_feedback` — user, score, comment (about Swaply, not the counterparty)
- `reports` / `blocks` — reporter/blocker, target (user or item), reason
- `invites` — deep-link token, inviter, optional `item_id` when the token came from a share link

## Screens

The screen-by-screen specification lives in `round-5-brief.md`; the exports are hosted separately (five rounds so far). Screen copy is Norwegian. This file describes the product, not the layouts.

Round 5 came back with 45 screens and departs from the brief in two places worth knowing: the three-way flow kept its old numbering (07i–07l) rather than moving up to 07a–07c, and the counter-offer grew from a button into a nine-screen flow (09a–09i), which is the clearest confirmation that it is a state and not an action.

## Open questions

1. **The point of no return.** Round 4 introduced a terminal state, «Ikke mulig, en ting er sendt»: past some moment you can no longer back out. Since we don't facilitate shipping, "sent" is self-reported, and nobody has defined who reports it, what it does to a three-way trade when one person has sent and another wants out, or what recourse the sender has. Left undecided on 06.09.
2. **Revenue.** Four ideas from 31.07, none of which has appeared in any of five rounds of screens. "An ad every 10th swipe" needs a swipe, which no longer exists. A per-trade admin fee needs facilitation, which we've now ruled out. That leaves ads in the collage and paying to unlock contact info — and the honest option of saying out loud that the MVP is free and unmonetised, so it stops resurfacing every round.
3. **Does a like carry the item you're offering?** The original model made a swipe an offer of a specific item of yours. With multi-item trades and counter-offers, composing the trade has moved to the negotiation screens, so a like is modelled above as just "I want this". If a like should still name what you'd give, the cycle search changes shape.
4. **Services.** Trading services for services, or services for items, was raised on 31.07 and has never appeared in a screen or in this file.

## Next steps

No code exists yet — this repo is five markdown files after six weeks and four design rounds. The build order, unchanged in shape:

1. Monorepo scaffold + Postgres schema + B2/Cloudflare media upload
2. Item CRUD + discovery search
3. Like endpoint + 2-cycle match
4. Trade composition, counter-offer and accept flow (incl. the agreement screen)
5. 3-cycle search
6. Chat (both thread kinds) + read state + push notifications
7. Invite deep link + share link + public item page + anonymous account flow
8. Report/block, reviews
