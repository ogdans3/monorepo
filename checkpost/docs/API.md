# Checkpost API

Base path `/v1`. All bodies and responses are JSON.

The canonical machine-readable definition is
[`packages/contract/src/index.ts`](../packages/contract/src/index.ts). The Dart
client cannot import it, so this document is the twin that client is written
against. Change them together.

## Authentication

There is none, in the account sense. Every list-scoped request carries its share
token as a bearer credential:

```
Authorization: Bearer <43-character token>
```

The token resolves to exactly one list, **at exactly one level**. There is no
list id in any URL, so there is nothing to guess at or increment.

## What a link may do

One list has many live links, at different levels. That is the point: you send
read to the people who only need to look and keep admin for yourself.

| `access` | Can |
|---|---|
| `read` | Fetch the snapshot, the change log and the socket. Nothing else. |
| `write` | Everything `read` can, plus items, tags and the list title. |
| `admin` | Everything, plus making and revoking links, rotating, and deleting the list. |
| `copy` | Exactly one thing: mint a fresh list for whoever opens it. |

`read`, `write` and `admin` are a ladder. **`copy` is not on it.** A copy link
cannot read the list it came from, or its changes, or its socket. Every one of
those answers `403 copy_link`, which clients turn into an offer to take a copy
rather than into an error.

Whoever creates a list gets an `admin` link. Every other level exists because
an admin handed it out.

A refusal is `403 forbidden` with a message written for a person. Getting the
level wrong is not a 401: the link is real, it is simply not allowed.

| Situation | Status | Meaning |
|---|---|---|
| No / malformed / unknown token | `401 unauthorized` | This link never worked. |
| Token was replaced by a rotation | `410 gone` | This link was replaced. |
| List was deleted | `410 gone` | The list is gone. |

The 401/410 split is the whole point: the app can tell a mistyped link from a
link that has been deliberately retired, and say so.

### Browsers

The web client calls this API directly from the browser, so `CORS_ORIGINS` has
to name the web origin or every request fails a preflight. `authorization`,
`content-type` and `x-checkpost-client` are the allowed request headers.

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
- Tokens are never accepted in a query string. Query strings survive in access
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
  "tags": [],
  "token": "…43 chars…",
  "url": "https://checkpost.app/l/…" }
```

### `GET /v1/list`

Full snapshot: the list, every item in display order, the list's tags, and
what this link may do. Clients render according to `access` rather than
guessing.

```jsonc
{ "list": { … },
  "items": [ { "id": "…", "text": "Tent", "checked": false, "position": "a1", "tagIds": ["…"], … } ],
  "tags": [ { "id": "…", "listId": "…", "name": "Kitchen", "color": "clay", "createdAt": "…", "updatedAt": "…" } ],
  "access": "write" }
```

`tags` come in the order they were made. Show them in `compareTags` order
(see Tags below), which is what both clients do.

### `PATCH /v1/list`

`{ "title": "Weekend in Bergen" }` → the updated `List`. Unknown fields are a
`400`, not a silent no-op.

### `DELETE /v1/list`

`204`. Deletes the list and its items. Every connected socket receives
`{"type":"revoked","reason":"deleted"}`. The link then answers `410` until the
reaper eventually forgets it.

### Links (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/v1/list/links` | none | `200` `ShareLink[]` |
| `POST` | `/v1/list/links` | `{ access, label? }` | `201` `{ link, token, url }` |
| `DELETE` | `/v1/list/links/:linkId` | none | `204` |

A `ShareLink` never carries a token, and cannot: only its SHA-256 was stored. A
token is visible **once**, in the `201` from `POST /v1/list/links`. Lose it and
the only way back is a new link.

Revoking the link you are currently using answers `400`. Replacing it is the
deliberate way to do that, and locking yourself out mid-request is not.

Capped at `LIMITS.linksPerList` live links.

### Copy links

| Method | Path | Returns |
|---|---|---|
| `GET` | `/v1/list/copy` | `200` `{ title, itemCount }` |
| `POST` | `/v1/list/copy` | `201` `{ list, items, tags, token, url }` |

The preview is a name and a count, so a client can say what it is about to
make. The items themselves are not in it.

Taking the copy makes a new list with the same title and items, **all
unchecked**, notes and order preserved, and hands the caller an `admin` link to
it. The tags come too, as new tags with new ids, and the copied rows wear the
copies. The two lists are strangers afterwards: no shared rows, no shared links, no
events crossing between them. Each person who opens the same copy link gets
their own, and the template keeps working.

Both refuse anything that is not a copy link, and every other endpoint refuses
a copy link.

### `POST /v1/list/rotate`

Replaces the share link **you are holding**, keeping its level.

```jsonc
// 200
{ "token": "…new 43 chars…", "url": "https://checkpost.app/l/…" }
```

The old link is revoked immediately. There is no grace period, because a grace
period would defeat the feature. Every socket authenticated with the old link is
sent `{"type":"revoked","reason":"rotated"}` and closed, including the caller's.
The caller reconnects with the token it just received.

**Other links on the list are untouched.** When a list could only have one link,
replacing it meant replacing all of them. Now that you can hand out a read link
and keep an admin one, quietly killing the others would be the surprising
behaviour. Revoke those one at a time instead.

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

Capped at 500 events per call. Ask again with the highest revision you got.

### Items

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/v1/list/items` | `{ id?, text, note?, afterId?, beforeId?, tagIds? }` | `201` `Item` |
| `PATCH` | `/v1/list/items/:itemId` | `{ text?, note?, checked?, afterId?, beforeId?, tagIds? }` | `200` `Item` |
| `DELETE` | `/v1/list/items/:itemId` | none | `204` |
| `POST` | `/v1/list/items/clear-checked` | none | `200` `{ removed: string[] }` |

**Placement.** Omit `afterId`/`beforeId` to append. `afterId: "<id>"` inserts
immediately after that item, `beforeId: "<id>"` immediately before it, and
`beforeId: null` sends it to the very top. The two are mutually exclusive. If
the named neighbour was deleted mid-drag, the item is appended rather than
rejected.

**Idempotency.** Supply `id` (a client-generated UUID) on create. A retried
request returns the existing item instead of creating a second one. That is
what makes optimistic UI safe on a flaky connection.

**Deleting twice is fine.** Two people tapping the same row both get `204`.
The end state is what matters.

**Tags on a row.** `tagIds` is the whole set the row carries afterwards, not a
change to it, at most `tagsPerItem` of them. Ids that are not tags on this list
are dropped rather than refused: the usual cause is a tag somebody deleted
while the request was in flight, and the rest of the edit is still kept. A
client showing a tag filter should create rows with the filter's tags, or they
vanish from the view as they land.

### Tags

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/v1/list/tags` | `{ id?, name, color? }` | `201` `Tag`, or `200` with the tag the list already had |
| `PATCH` | `/v1/list/tags/:tagId` | `{ name?, color? }` | `200` `Tag` |
| `DELETE` | `/v1/list/tags/:tagId` | none | `204` |

A tag belongs to the list and everyone on it sees the same ones. All three need
`write`; every link that can read sees them in the snapshot.

**Names.** Trimmed, inner whitespace folded to one space, 1 to `tagName`
characters. Two names are the same tag when their `tagKey` matches: the name
folded as above and lowercased, with non-ASCII letters folded too ("Ønsker" and
"ønsker" are one tag). Creating a name the list already has answers `200` with
the existing tag and changes nothing, and that is the id to tag rows with. The
same goes for a retried create with an `id` that already exists. Renaming onto
another tag's name is `400 bad_request`, not a merge.

**Colours.** One of `clay`, `ochre`, `olive`, `sage`, `teal`, `steel`, `iris`,
`plum`. Leave it out and the server picks `nextTagColor`: the colour used least
on the list so far, ties broken by the order `clay, teal, ochre, steel, olive,
iris, sage, plum`, so the first eight tags get eight colours. A client that
shows a tag before the server answers computes the same thing and sends it.

**Order.** `compareTags`: by `tagKey`, compared by code unit, then by `id`.
Both clients use it for chips, filters, groups and the tag list.

**Deleting** takes the tag off every row in the same transaction, and the one
`tag.deleted` event is all anyone is sent: take the id off your rows locally.
Deleting one twice is fine. At most `tagsPerList` tags per list; one more is
`409 limit_reached`.

## The list on the landing page

The front page shows a real list, not a mock, and everyone reading the page is
on it at once. It is the only part of the API that takes a write with no
credential, so it is also the only part with a write surface small enough to
name in full: one boolean, on one row, on one list.

### `GET /v1/demo`

`200` `{ token, snapshot }`. The token is a **`read`** link on the demo list,
published on purpose — it is meant for everybody, and read is all it can do.
Everything else the page needs (`GET /list`, `GET /list/changes`, the socket)
is the ordinary API with that token.

The link is reissued whenever the API restarts, because only the SHA-256 of a
token is ever stored and so no raw one survives. A client holding a retired
demo token gets `410` and is expected to ask here again rather than to show
somebody a message about a replaced link.

### `POST /v1/demo/tick`

`{ id, checked }` → `200` `Item`. No credential. The id must be a row of the
demo list; anything else is `404`, so an item id from a real list is not a way
to reach it. Rate limited harder than the shared bucket, at 60 a minute.

There is no demo equivalent of anything else. Adding, renaming, reordering,
clearing and deleting all refuse the published link with `403`, which is what
keeps the front page the front page.

Left alone for `DEMO_QUIET_MS`, the list puts itself back the way it was found,
as an ordinary change that everyone still watching sees happen.

### `GET /v1/health` · `GET /v1/ready`

Liveness (no database) and readiness (`select 1`).

## Realtime

`GET /v1/list/socket` is a WebSocket, and a **read path only**. Every mutation
goes over HTTP, where it is idempotent, retryable and rate limited.

Authenticate with the `Authorization` header, or, for clients that cannot set
headers on a handshake, with the subprotocol pair
`["checkpost.bearer", "<token>"]`. Browsers are the reason the second form
exists, and the server echoes `checkpost.bearer` back as the selected
subprotocol.

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
| `tag.created` | `{ tag }` |
| `tag.updated` | `{ tag }` |
| `tag.deleted` | `{ id }`, and the tag is gone from every row's `tagIds` |

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

Codes: `bad_request` (400) · `unauthorized` (401) · `forbidden` (403) ·
`copy_link` (403) · `not_found` (404) · `limit_reached` (409) · `gone` (410) ·
`too_many_requests` (429) · `internal` (500).

Messages are written for a person and are safe to show verbatim.

## Limits

| | |
|---|---|
| List title | 120 characters |
| Item text | 500 characters |
| Item note | 4000 characters |
| Items per list | 500 |
| Live links per list | 20 |
| Tag name | 30 characters |
| Tags per item | 10 |
| Tags per list | 50 |
| Events per `/changes` call | 500 |
| Global | `RATE_LIMIT_MAX` (default 300) requests per IP per minute |
| Create list | `RATE_LIMIT_CREATE_MAX` (default 30) per IP per hour |
| Rotate link | `RATE_LIMIT_ROTATE_MAX` (default 10) per IP per hour |

## Retention

Nothing has an owner, so nothing is ever deleted by a person tidying up their
account. A background reaper is the only bound on the database:

- change-log rows older than `EVENT_RETENTION_DAYS` (default 14). Clients past
  that get a snapshot instead.
- lists untouched for `LIST_TTL_DAYS` (default 365). Any read or write resets
  the clock.
- links whose list has been gone for 30 days, after which they answer `401`
  rather than `410`.
