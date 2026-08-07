# Checkpost API

Base path `/v1`. All bodies and responses are JSON.

The canonical machine-readable definition is
[`packages/contract/src/index.ts`](../packages/contract/src/index.ts). The Dart
client cannot import it, so this document is the twin that client is written
against; change them together.

## Authentication

There is none, in the account sense. Every list-scoped request carries its share
token as a bearer credential:

```
Authorization: Bearer <43-character token>
```

The token resolves to exactly one list. There is no list id in any URL, so
there is nothing to guess at or increment.

| Situation | Status | Meaning |
|---|---|---|
| No / malformed / unknown token | `401 unauthorized` | This link never worked. |
| Token was replaced by a rotation | `410 gone` | This link was replaced. |
| List was deleted | `410 gone` | The list is gone. |

The 401/410 split is the whole point: the app can tell a mistyped link from a
link that has been deliberately retired, and say so.

### Optional headers

| Header | Purpose |
|---|---|
| `X-Checkpost-Client` | Opaque device id (`[A-Za-z0-9_-]{4,64}`). Echoed on every change event as `actor`, so a device can ignore the echo of its own write. |

## Tokens and links

- 32 random bytes, base64url → **43 characters**, ~192 bits.
- The server stores **only `sha256(token)`**. A database dump yields no working
  links.
- Share URL: `https://<web origin>/l/<token>`
- Deep link: `checkpost://l/<token>`
- Tokens are never accepted in a query string — query strings survive in access
  logs and proxy caches, and this token is the entire credential. Request URLs
  are additionally scrubbed of anything token-shaped before logging.

## Endpoints

### `POST /v1/lists`

Creates a list and mints its first link. The only unauthenticated write.
Rate limited to `RATE_LIMIT_CREATE_MAX` per IP per hour.

```jsonc
// request
{ "title": "Camping", "items": ["Tent", "Stove"] }   // items optional, max 50

// 201
{ "list": { "id": "…", "title": "Camping", "revision": 0, "createdAt": "…", "updatedAt": "…" },
  "items": [ /* Item */ ],
  "token": "…43 chars…",
  "url": "https://checkpost.app/l/…" }
```

### `GET /v1/list`

Full snapshot: the list plus every item, already in display order.

```jsonc
{ "list": { … }, "items": [ { "id": "…", "text": "Tent", "checked": false, "position": "a1", … } ] }
```

### `PATCH /v1/list`

`{ "title": "Weekend in Bergen" }` → the updated `List`. Unknown fields are a
`400`, not a silent no-op.

### `DELETE /v1/list`

`204`. Deletes the list and its items. Every connected socket receives
`{"type":"revoked","reason":"deleted"}`; the link then answers `410` until the
reaper eventually forgets it.

### `POST /v1/list/rotate`

Replaces the share link.

```jsonc
// 200
{ "token": "…new 43 chars…", "url": "https://checkpost.app/l/…" }
```

The old link is revoked immediately — no grace period, because a grace period
would defeat the feature. Every socket authenticated with the old link is sent
`{"type":"revoked","reason":"rotated"}` and closed, including the caller's; the
caller reconnects with the token it just received.

### `GET /v1/list/changes?since=<revision>`

Everything that happened after `since`.

```jsonc
{ "kind": "events", "revision": 42, "events": [ { "type": "item.created", "revision": 41, "actor": "device-a", "at": "…", "data": { "item": { … } } } ] }
```

If `since` predates the retained change log, the server cannot prove what was
missed and returns a snapshot instead:

```jsonc
{ "kind": "resync", "snapshot": { "list": { … }, "items": [ … ] } }
```

Capped at 500 events per call; ask again with the highest revision you got.

### Items

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/v1/list/items` | `{ id?, text, note?, afterId?, beforeId? }` | `201` `Item` |
| `PATCH` | `/v1/list/items/:itemId` | `{ text?, note?, checked?, afterId?, beforeId? }` | `200` `Item` |
| `DELETE` | `/v1/list/items/:itemId` | — | `204` |
| `POST` | `/v1/list/items/clear-checked` | — | `200` `{ removed: string[] }` |

**Placement.** Omit `afterId`/`beforeId` to append. `afterId: "<id>"` inserts
immediately after that item; `beforeId: "<id>"` immediately before it;
`beforeId: null` sends it to the very top. The two are mutually exclusive. If
the named neighbour was deleted mid-drag, the item is appended rather than
rejected.

**Idempotency.** Supply `id` (a client-generated UUID) on create. A retried
request returns the existing item instead of creating a second one — which is
what makes optimistic UI safe on a flaky connection.

**Deleting twice is fine.** Two people tapping the same row both get `204`.
The end state is what matters.

### `GET /v1/health` · `GET /v1/ready`

Liveness (no database) and readiness (`select 1`).

## Realtime

`GET /v1/list/socket` — a WebSocket, and a **read path only**. Every mutation
goes over HTTP, where it is idempotent, retryable and rate limited.

Authenticate with the `Authorization` header, or — for clients that cannot set
headers on a handshake — with the subprotocol pair
`["checkpost.bearer", "<token>"]`.

Server → client frames:

```jsonc
{ "type": "hello",    "revision": 42, "presence": 2 }
{ "type": "change",   "event": { "type": "item.updated", "revision": 43, "actor": "device-b", "at": "…", "data": { "item": { … } } } }
{ "type": "presence", "presence": 3 }
{ "type": "revoked",  "reason": "rotated" | "deleted" }
{ "type": "pong" }
```

Client → server: `{ "type": "ping" }`. Anything else is ignored.

The socket is a **hint, not a guarantee**. Clients must still reconcile with
`GET /changes?since=` on connect and on regaining focus, which is what lets the
API scale past one instance without a message bus.

### Event payloads

| `type` | `data` |
|---|---|
| `list.updated` | `{ title }` |
| `item.created` | `{ item }` |
| `item.updated` | `{ item }` |
| `item.deleted` | `{ id }` or `{ ids: [...] }` (from clear-checked) |
| `link.rotated` | `{}` |

## Ordering

`item.position` is a fractional index: an opaque base62 string compared
byte-wise. Inserting between two items writes one row and touches nothing else,
so two people inserting at the same spot never collide.

Clients must sort with a plain byte comparison (Dart's `String.compareTo`,
JavaScript's `<`). The server's index is declared `COLLATE "C"` so it produces
the identical order.

## Errors

```jsonc
{ "error": { "code": "gone", "message": "This link was replaced. Ask whoever shared it for the new one." } }
```

Codes: `bad_request` (400) · `unauthorized` (401) · `not_found` (404) ·
`limit_reached` (409) · `gone` (410) · `too_many_requests` (429) ·
`internal` (500).

Messages are written for a person and are safe to show verbatim.

## Limits

| | |
|---|---|
| List title | 120 characters |
| Item text | 500 characters |
| Item note | 4000 characters |
| Items per list | 500 |
| Events per `/changes` call | 500 |
| Global | `RATE_LIMIT_MAX` (default 300) requests per IP per minute |
| Create list | `RATE_LIMIT_CREATE_MAX` (default 30) per IP per hour |
| Rotate link | `RATE_LIMIT_ROTATE_MAX` (default 10) per IP per hour |

## Retention

Nothing has an owner, so nothing is ever deleted by a person tidying up their
account. A background reaper is the only bound on the database:

- change-log rows older than `EVENT_RETENTION_DAYS` (default 14) — clients past
  that get a snapshot instead;
- lists untouched for `LIST_TTL_DAYS` (default 365) — any read or write resets
  the clock;
- links whose list has been gone for 30 days, after which they answer `401`
  rather than `410`.
