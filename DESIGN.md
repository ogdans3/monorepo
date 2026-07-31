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
- **Media**: Backblaze B2, delivered via Cloudflare (`items.media` holds URLs)
- **Push**: FCM + APNs
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

On each new swipe, search for a cycle back to the swiper (recursive CTE / BFS). **Depth is capped** (e.g. 5 hops) to keep the search tractable. On a hit, record a `pending` match and push-notify all participants.

### Accept flow

Every participant must accept (same for a 2-cycle or an n-hop chain).

- Match found → `pending`; involved items become `reserved` (hidden from the feed so they can't be double-matched). Each participant sees "waiting for other party to accept."
- All accept → match `accepted`, items flip to `traded`.
- **De-accept** reverses your acceptance → match back to `pending`, items back to `reserved`. Any single de-accept holds the whole trade.

## Chat

One **group thread per match** (all participants together — a chain trade only works if everyone syncs). Text-only in v1. Exact handoff details get agreed here, not stored on the profile.

## Trust & safety

Invite-only limits abuse; on top of that, users can **report** a user or item and **block** a user (blocked users' items are hidden and can't match). Reports are reviewed manually for the MVP.

## Data model (sketch)

- `users` — anonymous (device-scoped) until claimed. On claim: display_name, email *or* phone (one contact channel), location (town/county — coarse, no street address); `rating` (aggregate from reviews)
- `items` — owner, title, description, media (image URLs; video later), estimated_price (user-set), category/tags, condition, location (coarse), status (available/reserved/traded)
- `swipes` — from_user, from_item, target_item
- `matches` — ordered participants + per-hop give/get, state (pending/accepted)
- `match_participants` — match, user, accepted (bool)
- `messages` — match, sender, body (group thread per match)
- `reviews` — match, rater, ratee, score, comment (after a completed trade)
- `reports` / `blocks` — reporter/blocker, target (user or item), reason
- `invites` — deep-link token, inviter

## Next steps

1. Monorepo scaffold + Postgres schema + B2/Cloudflare media upload
2. Swipe endpoint + 2-cycle match + accept flow
3. Bounded n-cycle search
4. Chat + push notifications
5. Invite deep-link + anonymous account flow
6. Report/block
