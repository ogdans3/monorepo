# Swappify

A bartering platform where users trade items directly. Swipe on items you want; when intent closes a loop, we connect people so a trade can happen.

## Scope (v1)

- **Mobile app only** (Flutter). Web is a plain landing page.
- **Invite-only** via deep links.
- **Anonymous-first**: no sign-up to add an item or swipe. Accounts are deferred until a match needs a stable identity.

## Stack

- **App**: Flutter (iOS + Android)
- **Backend**: Node + TypeScript
- **Web**: SvelteKit (landing + invite handling)
- **DB**: Postgres
- **Repo**: monorepo — `app/`, `backend/`, `web/`, `shared/`

## UX

Add an item, then swipe on items you want. **Tinder-style** left/right swipe for v1 — cleanest yes/no signal for matching. (Collage grid and TikTok-style feed are alternatives to revisit.)

## Discovery

Free-text **search** on the main page — no recommendation algorithm in v1. Users pull what they want; the swipe feed is "swipe through the search results."

Postgres-native, no extra infra: `tsvector` full-text over title/description/tags (GIN index) + `pg_trgm` for typo tolerance, with category/location/condition filters on top. Query layer can be swapped later if ranking ever needs more.

## Matching

A swipe = "I want *their* item and offer *mine* in return" — a directed edge:

```
(user A, item a) --wants--> (user B, item b)
```

A match is a **cycle** in this graph:

- **Direct (2-cycle)**: A wants B's item and B wants A's → mutual swap.
- **Chain (n-cycle)**: A→B→C→…→A. Each person gives the next what they want, gets what they want.

On each new swipe, search for a cycle back to the swiper (recursive CTE / BFS). **Depth is capped** (e.g. 5 hops) to keep the search tractable. On a hit, record the match and notify all participants.

No accept flow in v1 — a found cycle is surfaced as a match; participants coordinate the trade themselves.

## Chat

One **group thread per match** (all participants together — a chain trade only works if everyone syncs). Text-only in v1. Exact handoff details get agreed here, not stored on the profile.

## Data model (sketch)

- `users` — anonymous (device-scoped) until claimed. On claim: display_name, email *or* phone (one contact channel), location (town/county — coarse, no street address); `rating` (aggregate from reviews)
- `items` — owner, title, description, media (images; video later), estimated_price (user-set), category/tags, condition, location (coarse), status (available/traded)
- `swipes` — from_user, from_item, target_item
- `matches` — ordered participants + per-hop give/get
- `messages` — match, sender, body (group thread per match)
- `reviews` — match, rater, ratee, score, comment (given after a completed trade)
- `invites` — deep-link token, inviter

## Next steps

1. Monorepo scaffold + Postgres schema
2. Swipe endpoint + 2-cycle match
3. Bounded n-cycle search
4. Invite deep-link + anonymous account flow
