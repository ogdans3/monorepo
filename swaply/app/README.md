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

## Two things that are honest about being unfinished

**Sign-in with Google, Facebook and Apple** is drawn, and says so when tapped:
each needs an agreement with the provider and a registered bundle id.

**An invitation link opens the app in a browser**, not on the phone. A universal
link needs a registered domain and a bundle id, and there is neither; on the web
build the token is read straight out of the address.

Both are one screen away once the accounts exist. Neither pretends to work.
