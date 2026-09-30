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
- **Media**: OVH Object Storage — item photos are personal data, so they stay inside the EEA along with everything else. **Until that bucket exists they are on our own disk**, in a volume next to the database; see *Photos* under Architecture
- **Hosting**: our own boxes at OVH, EEA-owned, with the API on its own authenticated entrance
- **Push**: FCM + APNs
- **Repo**: monorepo — `app/`, `backend/`, `web/`, `shared/`

## UX

**Bottom nav, five slots:** Oppdag · Bytter · [ Legg ut ⇄ ] · Chats · Profil. `Legg ut` is the centred action button. `Chats` carries an unread count in coral; at zero it shows nothing, not a zero.

Discovery is a **collage you scroll**, not a swipe stack. Tinder-style swipe cards were the v1 interaction through round 3 and were cut in round 4.

**The directed edge is a visible heart on every card.** This is the single most important interaction in the product — a chain only forms when enough people have expressed enough wishes, so the signal has to be cheap and obvious. Round 4 had it behind a long-press with no affordance; round 5 puts it on the card face. Long-press keeps a context menu for the rare actions: hide similar, view profile, report.

**A heart is open until it is pressed and green all through once it is**, on the card and on the item page alike: more colour means on, as with any toggle, and green is the app's yes beside the ✕'s red. A heart pressed on pulses once. The export draws only the one heart, a filled one on the green button, and never the state after it; the product owner chose this on 30.09.2026 over a heart that turns coral, which is the app's no, so 04's golden differs from the export on purpose. The item page also says how many people have liked the thing, in the words the profile uses: «3 har likt denne», and once your own heart is pressed «Du og 3 andre har likt denne».

**«Ikke vis meg slike» hides a kind, not a card.** A kind is the category and the free-text subcategory under it, compared without regard to case because whoever listed the thing typed it; a listing with no subcategory says no more than its category, so then only that listing is hidden rather than a whole category for one card. It takes the listings out of Oppdag, its rows and its search for that account — and a hidden kind out of the subcategories 05b offers, where it could only lead to «Vis 0 treff» — and nothing else: an item page opened from a link or a notification still opens, nobody else is shown less, and the owner is not told. It is about looking, so a device may do it and it comes along when the device signs in. `DELETE /me/hidden` shows everything again, and every answer that carries the account's own profile counts what is hidden, because hiding is a choice somebody can forget having made; a listing hidden alone stops counting once it is retired or traded, since nothing could bring it back. The answer to a hide carries the count too, and the app offers «Angre» — which is showing everything again — only while that count is one. Built 26.09.2026.

## Discovery

**Oppdag and Søk are one page**, under Oppdag's name, with the search page's behaviour: a search field that is always visible, and a filter button opening advanced search.

Free-text search, Postgres-native, no extra infra: `tsvector` over title/description/tags (GIN index) + `pg_trgm` for typo tolerance, with category/location/condition filters on top.

Before the user has searched, the page shows **rows by interest** — the categories they picked at first run. This is the first personalisation in the product. It is a filter on a category field, not a ranking model; there is still no recommendation algorithm in v1, but this file no longer says there is nothing.

## Interests

New first-run screen: pick **any number of categories, none included**, each once, from the fixed twelve (Sykling, Gaming, Verktøy, Klær, Båt, Friluft, Barn, Hjem, Sport, Musikk, Bøker, Diverse). Round 5 held it to three to five, with the button disabled below three and the rest locked at five; the product owner took the limit away on 30.09.2026, so one is a choice and so are all twelve. The export's 02 still says «Velg 3 til 5 kategorier» and «3 av 5 valgt», so on this point the file is ahead of the export on purpose, and so is 02's golden. Nothing chosen is the same door as «Hopp over».

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

**A ring is opened once.** A pending trade reserves nothing, so a heart taken back and pressed again finds the ring the first press opened; it is answered with that trade — the same people giving the same things round the same way, in any state short of completed or cancelled — rather than a second trade over it. The answer says the trade is not new (`tradeIsNew`), and the app does not put 06a up for it: «Dere kan swappe!» is the moment a trade opens, and this one had its moment, so the heart just turns. A *different* ring through the same listing still opens: several trades may want one drill, and its owner's acceptance decides between them. The sweep's stricter rule, no new trade on a listing another pending trade already holds, stays the sweep's. Decided 26.09.2026.

### A trade is not one item against one item

Each side of a hop is a **list of 1–3 items**, with a total value per side and the difference between them recorded as *mellomlegg*: «Mellomlegg: du legger til 200 kr». The cycle search still works on single-item edges — the like is what closes the loop; the item lists are what the parties negotiate afterwards.

### Services, and listings without photos

A listing is either an item or a service. A service has no condition — "worn" says nothing about shovelling snow — and, more importantly, **it is never exclusive**: one person can paint three living rooms, so a service never holds a reservation the way a drill does.

Photos are optional for both. Discovery is a collage, so a listing without one needs a generated card rather than a hole: category mark and title on deep green.

### Where a listing is

**A listing shows a town, never a postcode.** 10b asks for a postcode and says «Kun by vises for andre», so the server looks it up in Bring's register and keeps only the town it belongs to, written the way a sentence writes it («Mo i Rana», not «MO I RANA»). The postcode wins over the owner's town, because a thing kept at the cabin is at the cabin; without one the listing takes the owner's town, and with neither it has none rather than an invented one. A postcode that belongs to no town is refused in words, not passed over — passing over it is how listings from a profile made on 10c, which asks for no place, went out with no town at all. The register is carried in the build (`backend/src/lib/postcode-register.ts`, rewritten by `pnpm postcodes` when Bring changes a postcode) rather than asked for per listing, which would tell a lookup service where people live.

The same lookup answers everywhere a postcode is typed. Signing up and editing the profile keep the town the postcode belongs to, over a town sent alongside it, and refuse one that belongs to none in the same words 10b uses; `GET /postcodes/:code` answers without a session, so a form can show the town while it is typed. It is reference data and says nothing about anybody.

**The register's licence is NLOD 2.0.** bring.no publishes the file with no terms beside it; Posten Bring AS has registered it in the national data catalogue (data.norge.no, «Postnummer i Norge») under the Norwegian licence for Open Government data 2.0, which allows copying and distributing it, commercially too, with attribution. Checked 26.09.2026. The attribution NLOD asks for — *Contains data under the Norwegian licence for Open Government data (NLOD) distributed by Posten Bring AS*, with links to the licence and the source and a note that we changed it (sentence case, postcode and place only) — is in the header of the generated file. The licence says it must not be hidden or hard to find, so since 27.09.2026 it is also on a page people can read: in the app, in small type at the foot of «Juridisk og personvern», which an account with a profile reaches from 16b and a device that is only looking around from its own 13. On the web it is at the foot of the page behind a shared listing, whenever the listing has a town, with the same words and links as the app; the landing page names no town and carries none.

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

A chain trade's thread holds all participants together — it only works if everyone syncs. The same conversation component appears in the item detail, in the trade detail, and while waiting for the others to accept. On the item page it is your conversation about that listing, the one a message from there goes into, opened on what was said last with «Åpne ›» to the rest; it starts empty only until there is one, and again once that trade has ended, because the next message opens a new one. The server decides which conversation that is in one place, so the box and «Send» cannot disagree. Built 30.09.2026, when the box still said «Meldingen er sendt» and showed nothing of what was sent.

**Read state is per participant**, which is what the unread badge on the Chats tab counts.

## Identity & trust

- Anonymous, device-scoped, until a match needs a stable identity.
- On claim: display name, email *or* phone (one contact channel), coarse location.
- **BankID** is prompted at the first accept and shows as a badge on the profile. It is a trust marker, not a login method.
- **Login is email only.** Every other sign-in method is off the login screen: one field, one button, and a line saying we send a link.
- **An address is one address whatever its case.** It is stored lower-cased and without the space autocomplete leaves, looked up the same way, and unique on `lower(email)` in the database. A mail server delivers «Ola@epost.no» and «ola@epost.no» to one mailbox, and a phone keyboard capitalises the first letter by itself; kept as typed, the same person had two accounts or a sign-in that said the password was wrong. The index keeps the old constraint's name, `users_email_unique`, so an image from before the change — a rollback — still answers a clash with «Det finnes allerede en konto med denne e-posten» instead of a 500. Decided 26.09.2026.

## Trust & safety

Invite-only limits abuse; on top of that, users can **report** a user or item and **block** a user (blocked users' items are hidden and can't match). Reports are reviewed manually for the MVP.

Report and block use a stronger red, `#E5484D`. Coral `#FF6B5E` stays the app's "no" colour, and the two must not be the same value.

## Sharing

An item has a **share button** that hands over a link and the line «Se denne på Swaply: Bosch drill 18V, verdi 600 kr.» The server writes that line, so it reads the same on every client and the kroner are formatted once.

The app is invite-only, so a shared link almost always lands with someone who doesn't have it. The link therefore **carries an `invites` token** — the same mechanism as the invite deep links — which makes sharing our best growth channel rather than a dead end.

Built 09.09.2026. What was decided in the building:

- **One URL shape for both kinds of invitation**, `/i/<token>`: the token carries the listing when there is one, so the page behind a share and the page behind a plain invitation are the same route. It also means listings cannot be walked by guessing ids — the key is the only way in.
- **Looking is not joining.** Reading the page never spends the invitation, and the page keeps working after somebody has used it. Only making an account spends it.
- **An invitation is used once**, which is what the schema says: `used_by` and `used_at` are single columns. The consequence is deliberate — a link posted in a group admits the first person who takes it, and the next one is told plainly that it is spent and who to ask. If that turns out to be the wrong trade, the change is a use count, not a redesign.
- **The page is rendered on the server**, because a share link is read by chat clients building a preview as often as by people, and they do not run our JavaScript.
- **The listing page is `noindex`.** It was sent to someone; it was not published. The landing page is the one we want found.
- **A retired listing leaves the page standing.** The invitation still works, and the page says there is nothing to show rather than 404-ing on somebody who did nothing wrong.

### Anonymous, and what it may do

The token also opens the door without an account, which is where *anonymous-first* above becomes real: **a device may look and wish.** Discovery, the item pages and the heart are open to it, and the wishes are kept.

Everything that puts you in front of another person waits for 10c: **listing, writing the first message, and accepting.** A trade has two named people in it, so an unclaimed wish does not close a loop either — it is held, and counts from the moment the profile exists.

**Wishes with nothing to give are a dead end, and 10a says so.** While somebody has listed nothing, the heart that brings their likes to five offers to put something out, and after that every tenth one — fifteen, twenty-five, and on — so that «Senere» is taken at its word. Only a heart that made a like counts: pressed on something already liked it asks nothing, tells the owner nothing and searches for no loop. Two hearts pressed at once are counted one after the other, so the count that asks is never skipped, and a heart stands even when the loop search behind it fails — the owner is told with the like, and the sweep finds the loop. The app never shows 10a twice at the same count. The export titles 10a «Prompt etter 10 likes»; the product owner moved it to five and then every ten on 26.09.2026, so on this point the file is ahead of the export on purpose.

Making the profile **claims the account the device already has**, rather than starting a second one. Nothing that was liked is lost, and the session is reissued because the account has just gained a password.

**The app starts here without asking.** On a first start with no invitation link it makes the device's account behind 01 and goes straight on to 02; nobody meets a sign-in before they have seen anything. With a link, the invitation page is still the first screen, and only a server that is invite-only and refuses a start without a key puts the sign-in first. Signing out forgets the device id as well as the session, so the next person on the phone starts as a new stranger.

Which means somebody with an account on another phone arrives as a stranger first. **Signing in from there folds the device's account into theirs**: in one transaction, and only after the password, the wishes move across, blocks and reports follow them, so does what it asked not to be shown, the invitation the device took names the account, and the device's account is deleted. A wish the account could not have made itself — for its own listing, one it already has, one across a block — stays behind, and each wish that moves gets the same loop search a heart gets, because it now belongs to somebody with something to give. Test accounts are never folded, in either direction.

**A device nobody uses is erased after twelve months, and strictly.** An account that never made a profile, and has not made a single request with its own token for more than twelve months, is erased by a daily job. Opening the app counts: the app asks the server who it is when it starts and when it comes back from the background, and that request is activity, so a phone opened once a year keeps its wishes. *Activity* means an authenticated request made with the account's own token, or a sign-in with its own credential — its device id coming back without a token is one — and nothing else. Somebody liking what it liked, the owner of a listing it wished for looking at who wants it, an admin reading its profile, the cycle sweep passing over its wish: none of that is the account doing anything, and none of it keeps it. Twelve months is the calendar's, in the database's clock, and «more than» means more than. It is erased the way anybody is — its wishes, what it hid and its interests go, and so does the device id, so the phone that comes back is a stranger — and it leaves no sealed record, because it never had anything to seal. A claimed account and a test account are never swept, however quiet. Decided by the product owner 27.09.2026. The app says so to the device, on the one screen of its own a device has — its 13, «Du ser deg rundt» — which also says the likes are kept on an account for the device and not on the phone, and links to «Juridisk og personvern», where the rule is written out.

## Feedback

Two separate things after a completed trade, and they are not the same screen:

- **Review of the counterparty** — five stars, optional text, quick chips (`Kom som avtalt` · `God kommunikasjon` · `Møtte ikke opp`). Feeds the profile rating.
- **Feedback about Swaply** — a 1–5 scale and one free-text field, shown far less often.

## Data model

The schema is code now: `backend/src/db/schema.ts`, with the migration in
`backend/drizzle/`. That file is the authority; this is the shape of it.

- `users` — anonymous (device-scoped) until claimed, then display name, email
  *or* phone, coarse location, the interests picked on 02, and a **pseudonymous BankID
  subject**. Never a fødselsnummer.
- `items` — a listing, item or service, with an optional photo set and an
  `active_trade_id` that is the reservation.
- `likes` — the directed edge, and nothing else.
- `hidden_listings` — «Ikke vis meg slike»: a kind (category and subcategory)
  or one listing that an account does not want put in front of it.
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

**Retention is the last completed trade plus three years**, the general limitation
period in foreldelsesloven § 2 — **or the deletion plus three years for somebody
who never completed one.** The second half is not a default: a trade that went
wrong, where one side sent and the other deleted their account, is by its nature
one that never completed, and it is the case the record exists for. (This file
said only the first half until 27.09.2026; `anonymiseUser` has always done
both.) Messages follow the same window, because the evidence in a dispute is
almost always in the chat.

**The record goes when the window closes.** A daily job deletes every sealed
identity whose last day has passed; the day itself is still inside. Until
27.09.2026 nothing did, and a record meant to last three years lasted for
ever. Deleting by date is not reading: the purge compares the date the row was
sealed with and hands nothing back, and the application still never reads
`retained`.

**A device that never made a profile leaves no sealed record.** It had no name,
contact channel or BankID subject — those come with a profile — and it could
not have been in a trade, so there is nothing a court could use and no claim to
use it in. It used to leave a row of nothing but nulls, kept three years.

Reports and blocks outlive the reported user, or delete-and-re-register is a free
wash of the record. Deleting an account cancels its active trades first, with a
reason to the other side and a notification that tells them so — a trade paused
on a withdrawal question included, and the question closes with it — and
whatever of theirs those trades held goes back on the market and into the cycle
search. A question that outlives its trade in any other way closes too, and an
answer to one on a trade that has ended is refused in words rather than putting
the trade back to `accepted`.

**A half-written listing is kept on the phone, and only there.** 10b as it was
left — the words, and the pictures, which are of somebody's things and often of
their home — is kept per account in the app's own storage, so closing the app,
or the phone killing it with 10c open, loses nothing. It goes when the listing
is published, when the form is emptied (there is no «Forkast»: emptying the form
is how a draft is thrown away), on «Logg ut», which takes every draft on the
phone and not only the account's, on «Slett kontoen», and when the phone is made
a new stranger because the account it had is gone. A picture already uploaded
for a draft is the server's for a day only unless a listing takes it up, so the
phone keeps the bytes too and sends it again when the draft is finished later.
Asked for by the product owner 27.09.2026.

**A person deletes their own account with `DELETE /me`** («Slett kontoen»), built
26.09.2026. An account with a password gives the password, because a phone left
unlocked on a table is not the person; a device that never made a profile has only
its token, and that is enough. Every session dies, and the e-mail and phone are
free to make a new account with. Two refusals, both in words: the account holding
the key to the test tooling is erased only after `pnpm admin revoke`, or a
tombstone would hold the key and a ring nobody can reach; and a test account is
retired through the tool — pressed while acting as one, «Slett kontoen» is the
tool, and the tool never ends a trade a real person is standing in.

`ARCHITECTURE.md` has the rest, including the legal bases and why the photos
moved to OVH.

## Screens

The screen-by-screen specification lives in `round-5-brief.md`; the exports are hosted separately (five rounds so far). Screen copy is Norwegian. This file describes the product, not the layouts.

Round 5 came back with 45 screens and departs from the brief in two places worth knowing: the three-way flow kept its old numbering (07i–07l) rather than moving up to 07a–07c, and the counter-offer grew from a button into a nine-screen flow (09a–09i), which is the clearest confirmation that it is a state and not an action.

**The app has an icon**, the product owner's, since 30.09.2026: a two-part «S», white over green, on deep green. The same S is the launch screen on every platform and stands in the middle of 01, with the wordmark moved under it. The export draws 01 as the wordmark alone, so on this point the app is ahead of the export on purpose. `app/README.md` has how it is made.

## Open questions

1. **The point of no return.** Round 4 introduced a terminal state, «Ikke mulig, en ting er sendt»: past some moment you can no longer back out. Since we don't facilitate shipping, "sent" is self-reported, and nobody has defined who reports it, what it does to a three-way trade when one person has sent and another wants out, or what recourse the sender has. Left undecided on 06.09. One consequence to weigh with it, as built on 26.09: backing out through a withdrawal is refused once somebody else has marked their side sent (08c), but deleting the account is not — `DELETE /me` ends an accepted or paused trade like any other, with the close code `account_deleted` («Den andre parten slettet kontoen sin»; «En av de andre …» in a ring of three), and a trade that ends cancelled gets no snapshot of what was traded. What the sender keeps is the sealed record, three years from the deletion, and the chat.
2. **Revenue.** Four ideas from 31.07, none of which has appeared in any of five rounds of screens. "An ad every 10th swipe" needs a swipe, which no longer exists. A per-trade admin fee needs facilitation, which we've now ruled out. That leaves ads in the collage and paying to unlock contact info — and the honest option of saying out loud that the MVP is free and unmonetised, so it stops resurfacing every round.
3. **Does a like carry the item you're offering?** The original model made a swipe an offer of a specific item of yours. With multi-item trades and counter-offers, composing the trade has moved to the negotiation screens, so a like is modelled above as just "I want this". If a like should still name what you'd give, the cycle search changes shape.
4. **How long do we keep messages beyond a dispute?** Three years is set by the claim window above. Whether an ordinary conversation that never became a trade should live that long is a separate, unanswered question.

## Next steps

The list as it stood on 09.09.2026, with what has since been built struck out.
What is left is held up by an account we do not have.

1. ~~Scaffold + Postgres schema~~ — done 09.09.2026
2. ~~Photo upload~~ — done 09.09.2026, on our own disk. `POST /media` takes one picture, the row holds a path and never a URL, and moving to the OVH bucket is then this one file plus a migration that rewrites the paths. **The bucket is still the destination**: a volume does not survive the machine.
3. ~~Item CRUD + discovery search~~
4. ~~Like endpoint + 2-cycle match, with the reservation lock and the loser path~~
5. ~~Trade composition, counter-offer and accept flow (incl. the agreement screen)~~
6. ~~3-cycle search + the nightly sweep~~
7. ~~Chat + read state~~ — push notifications still need the FCM and APNs accounts
8. ~~Invite deep link + share link + public item page + anonymous account flow~~ — done 09.09.2026
9. ~~Report/block, reviews~~
10. ~~Erasure~~ — done 26.09.2026. `DELETE /me` runs `anonymiseUser` for the person themselves, with the password for an account that has one and the token alone for a device; see *Erasure and retention*. The screen that asks is the app's «Slett kontoen», at the foot of «Juridisk og personvern» in settings. The daily job that erases devices idle for twelve months and purges sealed records past their window followed on 27.09.2026. Access — handing a person a copy of what we hold — still has no door of its own.
