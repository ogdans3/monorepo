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
`screens/onboarding.dart`.

## Nobody starts at a sign-in

The app starts as a stranger. On a first start with no token and no link, the
gate in `main.dart` keeps 01 up while `Session.begin` makes the device an
account — `POST /auth/anonymous`, with a device id the app generated and kept,
never the phone's own — and goes on to 02 and then the app. 16c is not on the
way. It is behind «Har du konto? Logg inn» on the stranger's profile and on
10c, and behind «Jeg har konto fra før» on the invitation, and it comes first
only on a server that wants invitations and refuses a start without one.
Waiting for the server counts as no answer after `Session.patience`, twelve
seconds, so a host that drops packets gets «Prøv igjen» rather than a splash
with nothing to tap.

- **A link** still opens on the invitation, and nothing is made until «Se deg
  rundt»: looking around from there spends the key, so it is the person's
  choice and not the gate's. A shared listing is opened in Oppdag once the
  person is through, spent key or not. A key the server does not know — a link
  cut short — is said on the page, and both ways in try again without it.
- **No answer** — no network, or no server — is said on the splash, with «Prøv
  igjen», and never retried behind anybody's back. A saved token the server
  could not be asked about is kept: being offline is not being signed out.
- **Signing out** forgets the device id as well as the token, so whoever holds
  the phone next is a new stranger, and sees 02.
- **Closing the app on 02**, or reloading the page, comes back to 02. Whose 02
  is still owed is kept next to the token, by account id, because nothing the
  server says can tell a skipped 02 from one never seen: «Hopp over» leaves the
  interests empty too. «Hopp over» and «Fortsett» both let go of it, so 02 is
  shown once and not on every start.
- **A claimed device** — its account got a name, then the token went missing —
  is refused by its old id. The app makes a new one and starts over, once.

A stranger may look and wish. Making a profile on 10c **claims** it: the same
account, so the same shell, with a half-filled 10b still behind it and no
second trip through 02. 10c's «Logg inn» opens 16c over it, and 16c's
«Opprett konto» goes back down to that 10c, so a detour there does not end the
listing it is step two of. Signing in to an account from another phone **folds**
the stranger into that account on the server, and the likes come along. The
app sends its bearer with the sign-in, and says «Tingene du likte er tatt med.»
when there were any. That is somebody else, so it is a fresh shell — and not
02 again, even for an account with no interests: 02 is the phone's first run,
and the stranger had it a minute ago. (Its picks come along too, where the
account had none.) Signing in where nobody has been through the gate yet —
16c on an invite-only server, or from the invitation — still gets 02 once.

The screens the gate shows — 01, the invitation, 02, and 16c when it has to —
do not navigate on their own. The gate moves on when the session changes, and a
screen going somewhere as well built the app twice. A screen pushed over the
gate goes back to it with `backThroughGate`. `test/first_run_test.dart` holds
all of it, from a cold start.

## The bar is drawn once

Every tab used to be a route with its own Scaffold and its own bar, so changing
tabs, and opening anything at all, slid a whole new page in — bar included. Now
`TabShell` in `widgets/shell.dart` draws `SwaplyNavBar` once, under five
navigators, one per tab (`screens/tabs.dart` lists them in the export's order).
The bar never takes part in a page transition, and a test holds it to that
frame by frame (`test/shell_test.dart`). That includes a page pushed over it: the
shell is on the gate's route, a `TabShellRoute`, which stays where it is under
an incoming page instead of sliding or fading aside with the bar on it.

Where a screen goes is decided by the export, not by taste:

- **Drawn with the bar** (04, 06b and the other trade states, 06c, 09a/09b, 12,
  13b): inside the tab. From a tab that is just `Navigator.of(context).push`;
  from a screen that covers the bar, `pushInTab` takes the cover down first.
- **Drawn without it** (05b, 06a, 06g, 10b when it corrects a listing, 10c,
  12a, 16b, 16c, the reviews): `pushOverBar`, on the root navigator, so it
  covers the bar the way the drawing does. With no bar under it, a
  `SwaplyScaffold` there keeps clear of the home indicator itself. Every bottom
  sheet is `useRootNavigator: true` for the same reason: a sheet inside a tab
  stops at the bar and leaves it working under the dimming.
- **A finished flow** — a listing went out, a review was sent — ends with
  `goToTab`, which clears the way there and lands on the tab's first screen,
  which asks again even if it was on screen already. It used to be
  `pushNamedAndRemoveUntil('/trades')`, which threw every tab away. The flow is
  finished in the tab it was started in, not the one on screen: the bar is live
  while 10b waits on the server, and a tab tapped meanwhile is left alone.

A tab is built the first time it is opened and then kept, stack and scroll and
half-typed search included. Tapping the tab you are in goes back to its first
screen; Android's back and the browser's go back inside the tab first. Kept
tabs would go stale, so a tab's first screen mixes in `RefetchOnTabReturn` and
asks again each time the tab comes back — behind what is on screen, not
instead of it. Changing tabs is a short fade of the content, and a cut for
somebody who has asked for less motion.

The shell is keyed by who is signed in, so switching accounts or signing out
never leaves the last person's stacks on screen. A tab's old address —
`#/trades` in a browser, from when the tabs were routes — opens the gate at that
tab, never the tabs stacked on the gate, which would hide the splash, 02 or a
sign-in behind an empty shell. A screen mounted on its own —
in a widget test, in a golden — has no shell above it and draws its own bar, so
the goldens are still the screens as the export draws them.

One place where the export and the app do not agree about the bar: 10b is
drawn without it, as step one of two, and is also the Legg ut tab, so a new
listing is written with the bar under it. The «Legg ut» buttons elsewhere open
that tab rather than a second form. 06c and 09a draw no bar of their own, so
their goldens, which mount them alone, have none where the export does; in the
app it is the shell's, under them.

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

**Sign-in with Google, Facebook and Apple** is drawn in the export and not
offered: each needs an agreement with the provider, and App Review turns down a
build whose buttons do nothing. 16c and 10c leave out the three buttons and the
«eller» above them, so their goldens differ from the export on purpose. The
buttons are still in `screens/onboarding.dart` behind `socialSignIn`, and they
come back together — Apple requires its own wherever another provider's is
offered.

**An invitation link opens the app in a browser**, not on the phone. A universal
link needs a registered domain and a bundle id, and there is neither; on the web
build the token is read straight out of the address.

Both are one screen away once the accounts exist. Neither pretends to work.
