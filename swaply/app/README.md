# app

The Swaply app, iOS and Android, in Flutter. Every screen from round 5 of the
design export is here; `../docs/round-5-screens.md` is the authority for what
each one says, and the widget tests assert against it.

```sh
flutter run --dart-define=API_BASE=http://localhost:3001
flutter test && flutter analyze
```

On an Android emulator the host machine is `10.0.2.2`, not `localhost`.

## The export is the authority, and it is a drawing

`../docs/round-5-screens.md` is every **string** in round 5, extracted from the
file. It says nothing about type or colour, and building from it alone is how
this app ended up with the right words in the wrong shapes.

The drawing itself is the bundled HTML the design work exports — round 5 of it,
in the `swapply-design` project. It is a real page: open it in a browser and it
renders all forty-five screens at 390pt. That also means it can be *asked* for
its values rather than squinted at:

```js
// in the page's console, on any element
getComputedStyle(el).color        // rgb(6, 78, 59) — a title is deep green
getComputedStyle(el).fontSize     // 23px, and the weight is 800
```

Every number in `lib/design/tokens.dart` under «read off the round 5 export»
came out that way. When a screen here looks close but not right, that is the
place to check before changing anything.

`tool/design-compare/` does the asking for all forty-five frames at once: it
writes a blueprint of every frame (geometry, type, colour, padding, gaps),
renders the frames in Roboto, and lays each golden beside its frame with a heat
map and a percentage of pixels that differ. The goldens are rendered in the
export's own world for this — its status bar, its people and things, its
photographs (`test/export_fixtures.dart`, `test/photos/`) — so a golden can be
laid straight over the drawing it came from. The README there has the three
commands.

## Where each screen lives

The trade screen is one widget in every state rather than nine near-copies, so
several rows below point at the same file with a different `state` behind it.

| Screen | Implementation |
|---|---|
| 01 Splash · 02 Interesser · 10c Lag profil · 16c Logg inn | `screens/onboarding.dart` |
| 05 Oppdag · 05b Avansert søk | `screens/discover.dart` |
| 04 Gjenstand detalj | `screens/item_detail.dart` |
| 10a Prompt etter 10 likes | `screens/discover.dart`, on the tenth heart |
| 10b Legg ut gjenstand | `screens/post_item.dart` |
| 06a Swap toveis · 07i Swap treveis | `MatchScreen` |
| 06b Godta · 06e Venter · 06f Overlevering · 09e Motbytte mottatt · 09f Avslått · 09i Ferdig · 07j Treveis-oversikt · 08b Pauset · 08c Avvist | `TradeDetailScreen`, by state |
| 06c Avtale sveip | `screens/agreement.dart` |
| 08a Trekk deg varsel · 09g Trekk deg tidlig | `TradeDetailScreen`, confirmation sheets |
| 09a Foreslå motbytte · 09b Legg til ting | `screens/counter_offer.dart` |
| 09c Foreslå ting · 09c2 Be om ekstra · 09d Foreslå mellomlegg | `screens/proposal_sheets.dart` |
| 06g Samtale · 07k Gruppesamtale · 11a Chats | `screens/chat.dart` |
| 11 Mine handler · 17a Tom | `screens/trades_list.dart` |
| 12 Likt · 17b Tom | `screens/liked.dart` |
| 12a Varsler | `screens/notifications.dart` |
| 13 Profil · 13b Annen profil · 17c Tom · 16a Rapporter · 16b Innstillinger | `screens/profile.dart` |
| 06h Vurdering · 07l Vurdering B2 · 06i Tilbakemelding · 09h Fullført | `screens/review.dart` |

Three things are here that round 5 did not draw, because the invitations needed
them: the sheet behind the share button on 04 and the invitation row on 16b
(`widgets/share_sheet.dart`), and the screen a link opens — `InviteScreen` in
`screens/onboarding.dart`, which is also where looking around without an account
starts.

## Photographs

10b opens the system picker and shrinks the picture on the phone — 1600px,
quality 82 — before uploading it, because a camera makes five megabytes and a
listing needs a few hundred kilobytes. `PostItemScreen` takes an injectable
`pickImage`, which is how the widget tests drive everything after the picker
without a camera roll.

The upload returns a path and a URL: the listing is created with the **path**,
the strip draws the **URL**. iOS asks for permission with the sentence in
`ios/Runner/Info.plist`; the browser build uses a file input and cannot resize,
which is what the server's ceiling is for.

## The section the export does not draw at all

`screens/admin.dart` is Testverktøy, reached from a dark card on 16b and drawn
only for an account holding `is_admin`. It is deliberately not dressed as the
product — `AdminColors` in `design/tokens.dart` inverts the app's own two ends
and borrows the one avatar colour that has never been chrome — and
`widgets/admin_chrome.dart` puts «Du er Kari N. — ikke deg selv» under every
screen on every route while you are somebody else. `../docs/ADMIN.md` is the
whole of it.

## Three rows the export does not draw

The share sheet behind the button on 04 and «Inviter en venn» on 16b: round 5
drew the invitation as a link somebody already had, not as one you make.

And **«Se alle varsler» on 16b**, which opens 12a. The export drew 12a as a lock
screen — a push notification, not a screen with a back button — so it never drew
a door into the list of them inside the app. The screen was built anyway, and
without that row nothing could open it.

## What the app says in passing

`widgets/toast.dart` is the only way the app says something without taking over
the screen: a refusal, something that landed, something worth knowing. One card
in three tones, in the palette the rest of the app is drawn in — the plain
`SnackBar` it replaced was a black rectangle with square corners glued across
the button that had just been pressed.

The error tone is **coral**, which is the «no» colour. Not
`SwaplyColors.red`, which belongs to report and block: an error toast is the
most tempting place in the app to reach for the stronger red, and the two must
not collapse into one meaning.

## Two things that are honest about being unfinished

**Sign-in with Google, Facebook and Apple** is drawn, and says so when tapped:
each needs an agreement with the provider and a registered bundle id.

**An invitation link opens the app in a browser**, not on the phone. A universal
link needs a registered domain and a bundle id, and there is neither; on the web
build the token is read straight out of the address.

Both are one screen away once the accounts exist. Neither pretends to work.
