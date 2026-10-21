# Testverktøy — the admin section

Swaply is a two-sided marketplace and it is built by one person. Almost every
interesting state in it needs two or three people who want each other's things:
`countered` needs two accounts, two listings, two wishes pointing the right way
and then somebody else's move. Reaching it by hand was Innstillinger → Logg ut →
type `kari@epost.no` → find your own drill in her Oppdag → act → log out → log
back in, per step, per state.

This section collapses that. It is a tool, not a feature: round 5 drew
forty-five screens and none of them is this, and nothing here decides anything
the product has left open.

## The key

`users.is_admin`, and the point of it is that **nothing reachable over HTTP can
cut another one.** `backend/drizzle/0004_admin.sql` puts a trigger in front of
the column that refuses every write unless the transaction has set
`swaply.admin_grant`, and the only thing in the repository that sets that GUC is
`backend/src/db/admin.ts` — no route, no plugin, no job. A careless
`update users set …` in a handler written a year from now still cannot grant
admin, and neither can an injection into one.

```sh
pnpm admin list
pnpm admin grant  gabrielbhansen@gmail.com
pnpm admin revoke gabrielbhansen@gmail.com
pnpm admin adopt  kari@epost.no --owner gabrielbhansen@gmail.com
pnpm admin release kari@epost.no
```

On the deployed box the CLI runs inside the container, because the database is
not published to the internet:

```sh
docker compose exec api node dist/db/admin.js grant gabrielbhansen@gmail.com
```

Revoking is deliberately **not** guarded. Taking the key away must never need a
ceremony.

## What the key opens

A ring: **yourself, and accounts that were born as your test accounts.** Every
admin write goes through `ownedTestAccount`, and the set cannot grow sideways —
the same trigger refuses adoption, so an account may be *born* a test account
(`POST /admin/accounts` inserts it that way) and never *made* one by a request.
Without that, the tool could take ownership of a real person's account and then
act as them.

The ring cannot be orphaned either. `test_account_of` is a foreign key with
`ON DELETE RESTRICT` (`backend/drizzle/0011_test_account_owner_restrict.sql`):
an admin is anonymised and never deleted, so it should never fire, but had a
delete ever reached an admin's row, the `SET NULL` it used to be would have made
every account in the ring an ordinary one without anybody deciding it — shown to
everybody, out of the switcher's reach, and an unclaimed one fair game for the
idle-device sweep. Now the delete is refused for as long as any account, a
retired tombstone included, points at the owner.

There is no endpoint that enumerates the userbase, and no way to mint a session
for an account you did not make. An ordinary account gets **404** from every
admin route — whether this deployment has an admin section is not something the
API volunteers.

## Being somebody else

`POST /admin/accounts/:id/session` mints an *ordinary* session for the target
with `sessions.issued_by` set to you. Ordinary on purpose: every other route
behaves identically and there is nothing for a future route to remember.

Two consequences, both deliberate:

- **A switched session is never admin.** `requireAdmin` refuses one, so acting
  as Kari is not a way of being an admin called Kari.
- **«Du er Kari N. — ikke deg selv» is server truth.** `GET /me` reports
  `actingAs` off the session row, so a refresh, a restored token or a cold start
  cannot lose it. The app draws it as a floor under every screen on every route,
  wired into the `MaterialApp` builder rather than into the screens that
  remembered to ask.

The way back is a token the app parked in `SharedPreferences` when it switched,
so closing the app cannot strand you as somebody else. If that token is ever
missing the floor offers «Logg ut» instead, which is the honest fallback.

## The levers

| | What it removes |
|---|---|
| **Lag testkonto** | An invented e-mail, a postal code, the interest picker and two listings — about two minutes, per account. Born claimed, born furnished, and with **no password**, so the switcher is the only door into it. |
| **Bli denne** | Log out, type, log back in. Twice, per move. |
| **Bygg et bytte** | Nine named states, each otherwise a multi-account journey: `talking` `pending` `countered` `accepted` `handover` `paused` `completed` `declined` `displaced`, two-way or three-way. One trade per press, over the scenario's own ring, and it leaves no hearts behind (below). |
| **Som motparten** | Switch, act, switch back, look — four switches to watch one counter-offer land on 09e. Chips at the foot of the trade screen do the other side's move without leaving it. |
| **Få noen til å ville ha denne** | The heart, pressed on your own real listing by one of your test accounts. If it closes a loop a real trade opens and a real notification lands. Pressed on a listing the account already wants, it names the ring already open over that wish — agreed or not — rather than «Ingen sirkel ennå». |
| **Nullstill** | Two one-way doors in the product: 02 is shown once, and a listing cannot be unmade back into an empty profile. Emptying the interests brings 02 back the next time you switch into the account. «Nullstill likes» also makes this phone forget the count it last showed 10a at for that account, so 10a can be walked again from five. «→ bytter» is a no to every ring it ends, so they stay ended (bound #1). |
| **Slett testkonto** | Accounts piling up, and the device id that `/auth/anonymous` refuses a second time. Goes through the real `anonymiseUser`, sealed as `reason = 'test_account'` — or not sealed at all for one born unclaimed, which like any device has nothing to seal. The daily sweep of idle devices never takes a test account, so a ring left alone for a year is still there. |
| **Kjør sweepen nå** | Up to an hour of waiting for the second matching trigger. |
| **Forfall fristen nå** | Three days. `WITHDRAWAL_RESPONSE_HOURS` is 72, so 08b's expiry branch is otherwise a calendar problem. |
| **Tilstand** | Opening psql against the production box to answer «which invariant moved». |
| **Glem denne enheten** | Forgetting the device id by hand. Rarely needed now: signing out forgets it, and a start the server refuses as `device_claimed` makes a new one, so the next start on the machine is a new stranger either way. |

## What bounds the damage

Beyond the ring, three things:

1. **Every lever that moves a negotiation refuses a trade a real person is
   standing in**, by name and in words: «En Fremmed er med i dette byttet.»
   «Som motparten» and «Forfall fristen nå» refuse outright; «Nullstill →
   avslutt bytter» leaves those trades standing and says which ones it left;
   «Slett testkonto» refuses an account somebody real has ever traded or
   negotiated with. And «Få noen til å ville ha denne» only works on a listing
   inside the ring — pressed on a stranger's it is bound #2 arriving from the
   other direction.

   What «Nullstill → avslutt bytter» does end — a trade with nobody in it
   but you and your test accounts — ends as `ended_by_admin`, and the cycle
   search counts that as a no, there and only there (`decidedRing` in
   `trades/sweep.ts`): the tool is everybody in such a ring. Without it the
   sweep the reset runs on the way out found the same rings, whose hearts
   were all still there, and opened them again in the same second — «12
   bytter avsluttet» said about trades that were open — and the hourly job
   did the same. As after any no, a heart taken back and pressed again is a
   new wish and opens the ring anew. A trade a real person is in is never
   ended by the tool, so its ring is never decided by it either.
2. **A test account and a real person never meet.** A test account's listings
   are invisible on Oppdag to everybody outside its own admin's ring, and a
   test account's own Oppdag shows only its ring. They are real rows in the
   database a deployment serves — without this a stranger hearts a test drill,
   a real trade opens, and from that moment the account can neither be reset
   nor deleted, because it is somebody's history. Hiding is not enough on its
   own, because a link or a long-press reaches a listing too, so the product
   refuses the meeting itself (`trades/ring.ts`, 403 `test_ring`): a heart or
   a first message between a test account and somebody outside its ring, and
   any ring the cycle search would close through both. «Likt» (12) and the
   count on 04 leave the other side's likers out, and «Nullstill →
   gjenstander» spares a listing a stranger is negotiating about. The admin is a real person and trades with
   real people as anybody does.

   **Nor do the things a scenario makes.** The «[test] …» listings
   «Bygg et bytte» spends are the ring's, on the admin's own account as much
   as on a test account's: `items.made_by_scenario` marks them when they are
   made, and `listingOpenTo` (`trades/ring.ts`) puts each in the ring of the
   admin it was made for. By owner alone the admin's were everybody's — real
   people saw them on Oppdag and in 09a's «DU FÅR», hearted them, and opened
   real trades with the admin over things that exist to be spent by the tool.
   Now nobody outside the ring is shown one: not on Oppdag, in its rows, its
   search or 05b; not on the admin's 13b, nor in the count of things beside
   the admin's name there and on 04; not among the pictures on 10a, or in
   what 09a offers either side of a trade. A like from outside on one, pressed
   before this, is not shown on 12 or counted on 04. The page behind a
   shared link never shows one, and sharing one is refused, the admin's own
   included — that page is for somebody in no ring. A link to the listing
   itself still opens, as a test account's does, and what would make a
   meeting of it is refused as `test_ring` in words about the listing («Dette
   er en testannonse, og den er ikke til bytte.»): the heart, the first
   message, and a counter-offer that puts one on the table; the cycle search
   never closes a ring that puts one in front of anybody outside. A trade
   opened over one before this stands as it is, and what is on its table stays
   offerable in it. `drizzle/0016` marked the ones made before the column, by
   the «[test] » catalogue title only `somethingToGive` writes, no idempotency
   key, and a «Bygg et bytte» press in `admin_actions` the minute before; a
   scenario from before 20.09.2026 named its listings without the prefix and
   is not found.
3. **Every admin change and every write made while acting as somebody leaves a
   row in `admin_actions`**, written by the hook that authorises the request rather
   than by a route, so a route cannot forget it. A wrong tap is only survivable
   if it can be found afterwards. Reads are not logged — the tool screen loads
   its own overview every time it opens. The last twenty show up on `GET
   /admin/overview`; there is no screen for the rest, on purpose.

## What it does not do

- **A scenario spends listings it made, never the ones already there.** An
  `accepted` scenario reserves what it is given and a `completed` one marks it
  `traded` for good, so reaching for the nearest available listing would spend
  the owner's real inventory — and displace anybody whose open offer happened
  to hold it. They are titled «[test] …», are kept inside the ring (bound #2),
  and Nullstill → gjenstander clears them. Never a service, either: a service
  is never exclusive, so a scenario built on one silently means something else.
- **No scenario writes a trade, a like, an offer or an acceptance directly.**
  Everything is built by pressing the product's own buttons in order —
  `expressWish`, `acceptOffer`, `proposeCounterOffer`, `declineTrade`,
  `markHandover`, `requestWithdrawal`, `completeTrade` — and the hearts are
  taken back through «ta tilbake hjertet» (`takeBackWish`). `db/seed.ts` took
  that shortcut once and advertised a three-way ring the cycle search would
  never have found: a state reached by a different route is not the state the
  product produces, and testing it proves nothing.
- **A scenario leaves no wishes behind, and names only its own trade.** Once
  the trade it built stands — or once it has failed — it takes back every
  heart it pressed, so «Likt» (12) shows nobody on its «[test]» things. Left
  standing, those hearts were wishes nobody had: the next scenario with the
  same accounts closed rings through them, an old «[test]» thing for a new
  one, by the heart and then by the hourly sweep, until «Bytter» held trades
  nobody asked for. It answers with the trade over its own ring — its own
  listings, round the way its hearts point — never whichever trade the last
  heart named. A heart it did not press is left alone, and can still close
  another ring first; the scenario then says so («Hjertene lukket en annen
  sirkel …», 409 `no_cycle`) rather than build its state on that one, and
  says it among its steps when its hearts opened other trades as well as its
  own. «Nullstill likes» and «→ bytter» clear the way.
- **It resolves nothing that is open on purpose.** The point of no return after
  acceptance, whether a three-way chain is accepted at all, and the revenue
  model are all still open in `DESIGN.md`. The tool reaches those states; it
  does not decide them.
- **`DELETE /admin/accounts/:id` is not the erasure door.** That is
  `DELETE /me`, behind «Slett kontoen» at the foot of «Juridisk og personvern»,
  the last row in settings (16b). The two meet in one place:
  pressed while acting as a test account, «Slett kontoen» is the tool, so it
  goes through `deleteTestAccount` — no password, sealed as `test_account`, and
  refused while a real person is in a trade with the account. The account that
  holds the key cannot erase itself at all until `pnpm admin revoke` has taken
  the key away, or a tombstone would hold it.
- **`INVITE_ONLY` stays a deploy, not a toggle.** It is read once at boot by
  design, and flipping it on a live site locks out real invited people. It is
  shown read-only in the diagnostics.
- **`sweep-media` is excluded by name** from the job runner. It deletes files
  from the media volume, which `README.md` names as the one thing here that
  cannot be rebuilt from the repository.

## The tests

`backend/test/flows/admin.test.ts` — the key: that nothing over HTTP can cut
one, that the set cannot grow sideways, that a switched session is not admin,
that an ordinary account gets 404, that no route assigns to the column, and that
the owner of a ring cannot be deleted out from under it.

`backend/test/flows/admin-scenarios.test.ts` — every named state, asserted by
the *consequences* a real journey leaves behind (offers, acceptances,
reservations, threads) rather than by the state column; the hearts taken
back, one trade per press over the scenario's own ring, and «Nullstill →
bytter» staying a no. `sweep.test.ts` holds that last one to the ring.

`backend/test/flows/test-ring.test.ts` — bound #2: every meeting between the
ring and somebody outside it refused, and every place a scenario's «[test]»
things on the admin's own account are kept from them, with the migration that
found the old ones.

`app/test/admin_test.dart` — the absence, first: an ordinary account's 16b ends
exactly where round 5 ends it. Then the floor, the badges, and the switch.
