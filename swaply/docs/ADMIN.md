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
| **Bygg et bytte** | Nine named states, each otherwise a multi-account journey: `talking` `pending` `countered` `accepted` `handover` `paused` `completed` `declined` `displaced`, two-way or three-way. |
| **Som motparten** | Switch, act, switch back, look — four switches to watch one counter-offer land on 09e. Chips at the foot of the trade screen do the other side's move without leaving it. |
| **Få noen til å ville ha denne** | The heart, pressed on your own real listing by one of your test accounts. If it closes a loop a real trade opens and a real notification lands. |
| **Nullstill** | Three one-way doors in the product: interests can never be emptied (`PUT /me/interests` takes three at minimum), BankID is set once and never unset, and a listing cannot be unmade back into an empty profile. |
| **Slett testkonto** | Accounts piling up, and the device id that `/auth/anonymous` refuses a second time. Goes through the real `anonymiseUser`, sealed as `reason = 'test_account'`. |
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
2. **A test account's listings are invisible on Oppdag to everybody outside its
   own admin's ring.** They are real rows in the database a deployment serves —
   without this a stranger hearts a test drill, a real trade opens, and from
   that moment the account can neither be reset nor deleted, because it is
   somebody's history.
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
  to hold it. They are titled «[test] …»; Nullstill → gjenstander clears them.
  Never a service, either: a service is never exclusive, so a scenario built on
  one silently means something else.
- **No scenario writes a trade, a like, an offer or an acceptance directly.**
  Everything is built by pressing the product's own buttons in order —
  `expressWish`, `acceptOffer`, `proposeCounterOffer`, `declineTrade`,
  `markHandover`, `requestWithdrawal`, `completeTrade`. `db/seed.ts` took that
  shortcut once and advertised a three-way ring the cycle search would never
  have found: a state reached by a different route is not the state the product
  produces, and testing it proves nothing.
- **It resolves nothing that is open on purpose.** The point of no return after
  acceptance, whether a three-way chain is accepted at all, and the revenue
  model are all still open in `DESIGN.md`. The tool reaches those states; it
  does not decide them.
- **`DELETE /admin/accounts/:id` is not the erasure door.** Item 10 of
  `DESIGN.md` is a «Slett kontoen» in settings with its own confirmation copy
  and a self-service path, and that is still unbuilt. This only gives the engine
  behind it a first caller, on accounts nobody real ever used.
- **`INVITE_ONLY` stays a deploy, not a toggle.** It is read once at boot by
  design, and flipping it on a live site locks out real invited people. It is
  shown read-only in the diagnostics.
- **`sweep-media` is excluded by name** from the job runner. It deletes files
  from the media volume, which `README.md` names as the one thing here that
  cannot be rebuilt from the repository.

## The tests

`backend/test/flows/admin.test.ts` — the key: that nothing over HTTP can cut
one, that the set cannot grow sideways, that a switched session is not admin,
that an ordinary account gets 404, and that no route assigns to the column.

`backend/test/flows/admin-scenarios.test.ts` — every named state, asserted by
the *consequences* a real journey leaves behind (offers, acceptances,
reservations, threads) rather than by the state column.

`app/test/admin_test.dart` — the absence, first: an ordinary account's 16b ends
exactly where round 5 ends it. Then the floor, the badges, and the switch.
