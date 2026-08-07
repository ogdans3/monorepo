# Working in this repo

Checkpost is a shared checklist that lives at a link. Read `README.md` first.
`PRODUCT.md` and `DESIGN.md` are the design contract and are not decoration.

## Layout

```
apps/api      Fastify + Drizzle + Postgres + ws   (@checkpost/api)
apps/app      Flutter, iOS + Android
apps/web      SvelteKit landing + /l/[token] handoff  (@checkpost/web)
packages/     contract: Zod schemas, limits, token helpers
```

pnpm workspace covers `apps/api`, `apps/web`, `packages/*`. The Flutter app is
outside it and uses `flutter pub`.

## Invariants. Break these and things go subtly wrong

**Tokens never appear in a URL the API sees.** `Authorization: Bearer` only,
never a query string. The one exception is `/l/<token>` on the web app, which
is why that route is `no-store`, `noindex`, and disallowed in `robots.txt`.

**Only the SHA-256 of a token is stored.** Never persist a raw token
server-side.

**Every mutating transaction bumps `lists.revision` as its first statement.**
That row lock is what serialises concurrent writers, and the change-log row and
the broadcast hang off it. `ListService.#mutate` exists so this cannot be forgotten.

**A revoked or deleted list answers 410, never 401.** `share_links` rows
deliberately outlive their list (`on delete set null`) to make that possible.
The app's copy depends on the distinction.

**Three files hold one palette:** `DESIGN.md`, `apps/web/src/app.css`,
`apps/app/lib/design/tokens.dart`. Change them together.

**Two files hold one ordering algorithm:**
`apps/api/src/lib/fractional-index.ts` and
`apps/app/lib/data/fractional_index.dart`. They must produce byte-identical
keys, and both test suites assert the same properties. Postgres sorts
`position` with an explicit `COLLATE "C"` in every query and index. Keep it
there.

## Design rules that are not negotiable

From `PRODUCT.md` / `DESIGN.md`, restated because they get eroded first:

- **No green tick, no blue accent.** Both are the category reflex. One accent,
  the deep rose, under 10% of any screen.
- **Never colour alone.** Checked is the mark *plus* the strikethrough *plus*
  the dimming.
- **No second destructive red.** Consequences are spelled out in words in a
  confirm sheet, and the confirm button uses the normal accent.
- **No gesture-only affordance.** Swipe-to-open is a shortcut. The right-edge
  chevron and the menu do the same job.
- **Cards are not the answer.** Both list surfaces are hairline-separated rows.
- **Motion 150 to 250ms, ease-out, no bounce**, and every animation has a
  `prefers-reduced-motion` / `disableAnimations` path. The one exception that
  survives Reduce Motion is the remote-change wash, because it is information.
- Empty states teach the interface. Errors are one plain sentence and a way
  forward, in the product's voice: what happened, no apology, no exclamation
  marks.

## Testing

```bash
pnpm db:up && pnpm test    # API, against real Postgres, not a mock
pnpm app:analyze && pnpm app:test
pnpm typecheck
```

- The API suite runs against a real database on purpose: the partial unique
  index, the row-lock serialisation and `COLLATE "C"` ordering are database
  behaviour, and mocking them would only test the mock.
- Flutter tests drive the real `CheckpostApi` against `test/fake_server.dart`
  through `MockClient`. Widget and golden tests must pass
  `realtimeFactory: noRealtime`, or reconnect timers outlive the widget tree.
- Goldens (`apps/app/test/goldens/`) are design regression tests. Regenerate
  with `flutter test --update-goldens` and read the diff as a review.

## Conventions

- Conventional Commits. Commit and push each coherent unit.
- Product-facing copy is British-flavoured plain English, no exclamation marks,
  no emoji, no "Oops".
- Comments explain *why*, especially where the code looks odd on purpose
  (the revision bump, the 410-vs-401 split, the deferred settle).
