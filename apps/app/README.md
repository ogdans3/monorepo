# Checkpost app

The Flutter client. Two screens — your lists, and one list — plus the share
sheet, which is where the actual product lives.

```bash
flutter run --dart-define=CHECKPOST_API_ORIGIN=http://10.0.2.2:4000 \
            --dart-define=CHECKPOST_WEB_ORIGIN=http://localhost:5173
flutter analyze
flutter test
flutter test --update-goldens   # regenerate the design snapshots
```

`10.0.2.2` is how the Android emulator reaches the host. On a physical device
use your machine's LAN address, and remember the API must be reachable from
the phone.

## How it is put together

```
lib/
  data/      wire models, HTTP client, realtime client, local index, ids
  state/     LibraryController (your lists) · ListController (one list)
  design/    tokens.dart (the palette) · theme.dart
  ui/        screens, sheets, widgets
```

No state-management package. `ChangeNotifier` + `ListenableBuilder` is enough
for two screens, and every dependency here is one more thing that can break a
build you cannot debug from a train.

### The rules the code follows

**Optimistic, always.** Every edit lands on local state in the frame the finger
lifts, then goes to the server. If the server *refuses*, the edit is undone and
said out loud. If the device is merely offline, the edit is **kept** — it is
still true on this phone, and `reconcile()` settles it when the network is
back. Those two failures are not the same thing and are not treated the same.

**Client-generated ids.** A new item's UUID is minted here, so the optimistic
row and the server row are the same row, and a retry is not a duplicate.

**The socket is a hint.** `RealtimeClient` is a read path only; every mutation
goes over HTTP where it is idempotent and retryable. On connect, on reconnect
and on app resume the client asks `GET /changes?since=` for whatever it missed.
That is what makes a dropped connection a non-event.

**Order is computed twice, identically.** `data/fractional_index.dart` is a
line-by-line twin of `apps/api/src/lib/fractional-index.ts`, and both suites
assert the same properties. Items sort by `String.compareTo` — byte order,
exactly what Postgres produces under `COLLATE "C"`. If the two ever diverge,
two phones would quietly disagree about the order of a list.

### Where the lists actually live

`shared_preferences` holds `{listId, token, title, counts}` per list. There are
no accounts, so **this file is the only record that a list exists on this
device**. Losing it does not delete anything — anyone else with the link still
has the list — but this device cannot get back in without the link. That trade
is the product, and it is why the share sheet puts the link in front of you
rather than burying it in settings.

## Deep links

| Form | Handled by |
|---|---|
| `https://checkpost.app/l/<token>` | Verified App Link (Android) / Universal Link (iOS) |
| `checkpost://l/<token>` | Custom scheme, for sideloads and scanners that bypass the system resolver |
| Pasted into "Open a link" | `parseShareToken` accepts all of the above |

**Before release**, two things must be filled in or links silently fall through
to the web handoff page forever:

- `apps/web/static/.well-known/assetlinks.json` — the release signing SHA-256
  (`keytool -list -v -keystore <release>.jks`).
- `apps/web/static/.well-known/apple-app-site-association` — your Team ID, and
  **Associated Domains** (`applinks:checkpost.app`) enabled on the App ID and
  added as a capability in Xcode. That capability cannot be added from this
  repo; it is an Xcode/portal step.

The custom scheme and the "Open a link" paste both work without either.

## Tests

- `fractional_index_test.dart` — the ordering algorithm, including a 5000-insert
  randomised storm.
- `share_link_test.dart` — every shape of link a person might paste.
- `list_controller_test.dart` — optimistic edits, refusals, offline, rotation,
  and changes arriving from other people. Runs the real `CheckpostApi` against
  an in-memory server (`fake_server.dart`) via `MockClient`, so headers, JSON
  and error mapping are all exercised.
- `widget_test.dart` — the screens, including "a tick is on screen before the
  network answers" and "checked text is struck through, not just dimmed".
- `golden_test.dart` — pixel snapshots of every screen in both colour schemes.
  Read a golden diff as a design review; regenerate deliberately.

Widget and golden tests pass `realtimeFactory: noRealtime` so nothing dials a
real server — otherwise reconnect timers outlive the widget tree and every
assertion depends on the network.
