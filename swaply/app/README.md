# app

The Swaply app, iOS and Android, in Flutter. Every screen from round 5 of the
design export is here; `../docs/round-5-screens.md` is the authority for what
each one says, and the widget tests assert against it.

```sh
flutter run --dart-define=API_BASE=http://localhost:3001
flutter test && flutter analyze
```

On an Android emulator the host machine is `10.0.2.2`, not `localhost`.

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

## Two things that are honest about being unfinished

**Sign-in with Google, Facebook and Apple** is drawn, and says so when tapped:
each needs an agreement with the provider and a registered bundle id.

**Photo upload** takes a URL rather than opening the camera roll, because the
OVH bucket it should upload to does not exist yet.

Both are one screen away once the accounts exist. Neither pretends to work.
