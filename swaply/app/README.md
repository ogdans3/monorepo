# app

The Swaply app, iOS and Android, in Flutter. Every screen from round 5 of the
design export is here; `../docs/round-5-screens.md` is the authority for what
each one says, and the widget tests assert against it.

```sh
flutter run --dart-define=API_BASE=http://localhost:3001
flutter test && flutter analyze
```

On an Android emulator the host machine is `10.0.2.2`, not `localhost`. A
release build talks to the live API instead; building one for Google Play is
under [Google Play](#google-play) at the end.

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
| 10a Prompt etter 10 likes | `screens/discover.dart`, on the fifth heart and every tenth after it — not the tenth, see below |
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
| 13 Profil · 13b Annen profil · 17c Tom · 16a Rapporter · 16b Innstillinger, and the «Juridisk og personvern» screen behind it | `screens/profile.dart` |
| 06h Vurdering · 07l Vurdering B2 · 06i Tilbakemelding · 09h Fullført | `screens/review.dart` |

**10a comes at the fifth heart, not at the tenth** the export's title names.
That is a decision, not a drift, and `../docs/DESIGN.md` has it: while nothing
is listed it comes at five, then at fifteen, twenty-five and on, so «Senere»
puts it off rather than ending it. The sheet says the real count — «Du har likt
5 ting» where the drawing has 10. The server decides when a count is due, and
only on a heart that made a new like; `Session.listingPromptDue` remembers on
the phone, by account, the highest count it has been shown at, so a heart taken
back and given again does not ask twice. Listing anything ends it, because the
server stops asking. «Nullstill likes» in Testverktøy forgets that count as well
as the likes, or the sheet would stay down until the old count was passed.

The sheet itself is the drawing's: the handle, the screen's off-white, the
count in green, and the last three things liked beside «ting du har likt», from
`GET /me/likes` and asked for as the sheet opens. Without an answer the row is
left out rather than drawn as three empty tiles. A heart whose page or card is
gone by the time the answer comes still gets its sheet, over wherever the
person went: the fifth heart asks and the sixth does not. The same goes for
the match screen when a heart closes a loop — the trade has opened either way
— and a match asks the session again, so the bar's «Bytter» counts it. A heart
taken back and pressed again over a ring that already has a trade gets none:
the server answers with that trade and `tradeIsNew: false`, and it had its
06a when it opened.
`followWish` in `screens/discover.dart` is that follow-up, for both hearts.
Its golden, `10a-prompt`, is the sheet over 05 as 05's golden has it, with the
white bike, the console and a listing without a photograph in the row, as the
export draws them.

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
  the phone next is a new stranger, and sees 02. The next id is kept before
  the token goes rather than made by the gate afterwards: on the web every tab
  becomes a stranger at that moment, and each used to find no id and make its
  own — two device accounts, one of them nobody's. See «Another tab» below.
- **Closing the app on 02**, or reloading the page, comes back to 02. Whose 02
  is still owed is kept next to the token, by account id, because nothing the
  server says can tell a skipped 02 from one never seen: «Hopp over» leaves the
  interests empty too. «Hopp over» and «Fortsett» both let go of it, so 02 is
  shown once and not on every start.
- **A claimed device** — its account got a name, then the token went missing —
  is refused by its old id. Making the profile spends the id, so the app keeps
  a new one there and then, and a token refused later starts over with it. An
  id an older app kept after a profile is refused; the app makes a new one and
  starts over, once, or takes the one another tab refused the same moment has
  just kept.
- **Opening the app reaches the server.** A device that only looked around is
  deleted after twelve months in which its own token asked the server
  nothing, and opening the app counts. A cold start asks `GET /me` as it
  restores the token; an app brought back from the background, or a browser
  tab brought back into view, asked nothing until somebody pressed something.
  Now `Session.wake` asks, quietly — no toast — at most once a minute after an
  answer, counting any `GET /me` answered since, so flicking between apps is
  not a request each time. An asking that got no answer may never have
  arrived, so the next return asks again. On the splash that is saying there
  was no answer, coming back is «Prøv igjen», and its button spins as if
  pressed: the kept token is somebody's, and they have just opened the app.
  Once for each return, never on a timer. `test/activity_test.dart` holds it.
- **A session ended while the app was away** — the account deleted from
  another phone or by the twelve-month sweep, or its sessions ended — is
  refused on that return with a 401, and the app did nothing about it: the
  person was shown as signed in until the next cold start, with every tap
  refused. Now the refusal of the token itself, and only that, does what a
  cold start with a dead token does. The token goes, every screen over the
  gate goes with the person it was about, and the gate makes a new stranger —
  for a device and for an erased account alike, since an erased account has
  no device id left. No toast: the gate is the news. `Session.sentBack` is how
  the session tells the app to take the screens down. The claim on 10c is
  followed by the same quiet `GET /me` a sign-in is (see below). A refusal
  heard while a sign-in or a claim is on its way is not a dead token: the
  server retires the token the asking went on as it lets the person in, and
  taken as one it closed 10c or 16c under them and made a stranger that threw
  their draft away. So coming back asks nothing while one is on its way, and a
  refusal that lands then is decided once it has — somebody else if it
  worked, still the dead token if it failed.
  `test/activity_test.dart` holds it.
- **Another tab** of the site shares the browser's storage, and each tab read
  the token from it once, when it opened. A tab left open went on as the
  person another tab had signed out — holding the revoked token, writing it
  back on its next change and keeping drafts for somebody no longer there —
  or went on as somebody else after a sign-in there. Each tab now listens for
  the browser's `storage` event on the token's key (`util/other_tabs.dart`,
  through `dart:js_interop`), and the storage is what says who this is, read
  again at the event rather than taken from it: signed out there, this tab
  drops what it was showing and the gate makes it a stranger — the same one,
  by the device id that tab kept; signed in there, this tab goes behind the
  splash and becomes whoever that is. Tabs that become strangers together are
  one stranger: the id is kept before the token changes — on «Logg ut», and on
  a profile made — so every tab that hears it sends the same one, and the
  server lets two starts with one id at the same moment into one account. A
  stranger's token is kept with the id it was made with, so where two tabs
  had no id to share and made one each, the id kept still opens the account
  every tab goes on as. A tab never writes back a token another
  tab has replaced: before it keeps the token it holds, it reads the storage
  again, and one written since wins. A stranger made without anybody asking
  does not overwrite somebody another tab has just signed in. Off the web
  nothing else writes the preferences and none of this runs.
  `test/other_tabs_test.dart` holds it, with a stand-in for the event.

**What the phone keeps does not leave it.** The token, the device id and the
drafts are in the preferences and the support directory, and Android backs
both up to the person's Google account unless told not to, and restores them
onto the next phone they sign in on — signed in as them, with no password,
where «Logg ut» on the first phone never reaches. `android:allowBackup` is off,
and `dataExtractionRules` leaves every domain out of the cloud backup and the
device-to-device transfer, which Android 12 does whatever `allowBackup` says;
the manifest says why. On iOS `NSUserDefaults`, where `shared_preferences`
keeps the token, is in the iCloud and Finder backups and comes back from them
on a new phone. The token belongs in the Keychain, as an item that does not
migrate (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`), and moves there
when a secure-storage dependency is accepted; until then an iOS backup carries
a live token.

A stranger may look and wish. Making a profile on 10c **claims** it: the same
account, so the same shell, with a half-filled 10b still behind it and no
second trip through 02. The answer to the claim is the profile and not the
rest of `GET /me` — no things, no unread counts — so the session asks for
that straight after, quietly, as a sign-in does: 13 and the bar's badges
showed the stranger's none until something asked again. 10c's «Logg inn» opens 16c over it, and 16c's
«Opprett konto» goes back down to that 10c, so a detour there does not end the
listing it is step two of. Signing in to an account from another phone **folds**
the stranger into that account on the server, and the likes come along. The
app sends its bearer with the sign-in, and says «Tingene du likte er tatt med.»
when there were any. That is somebody else, so it is a fresh shell — and not
02 again, even for an account with no interests: 02 is the phone's first run,
and the stranger had it a minute ago. (Its picks come along too, where the
account had none.) Signing in where nobody has been through the gate yet —
16c on an invite-only server, or from the invitation — still gets 02 once, and
so does signing in from a test account, whose picks stay in the ring.

A heart still on its way when the sign-in is pressed is waited for: the fold
deletes the stranger, and a heart that reached the server after it was lost —
or, taken back, stayed on the account. So a heart is sent through
`Session.like` and `Session.unlike`, never straight to the api, and a heart
pressed while a sign-in is on its way goes after it, to the account.

Signing in on 10c, halfway through a listing, is the same fold into somebody
else, and the fresh shell would have come without the form: the title, the
pictures held for the stranger, all gone, and nothing listed. So 10b hands the
session a `ListingDraft` (`state/listing_draft.dart`) before it opens 10c and
takes it back when 10c is done with; a sign-in there leaves it in place, the
gate opens the new app on Legg ut, and the form there takes the draft up and
finishes it — pictures, then the listing — as the account signed in to.

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
  Bytter also asks again when a trade opened from it closes, so a flow that
  ends there — «Tilbake til Bytter», a review — would ask twice; the list waits
  out the frame the trade closes in and asks once.

A tab is built the first time it is opened and then kept, stack and scroll and
half-typed search included. Tapping the tab you are in goes back to its first
screen; Android's back and the browser's go back inside the tab first. Kept
tabs would go stale, so a tab's first screen mixes in `RefetchOnTabReturn` and
asks again each time the tab comes back — behind what is on screen, not
instead of it. Changing tabs is a short fade of the content, and a cut for
somebody who has asked for less motion — in a browser too, which does not tell
Flutter: `util/reduced_motion.dart` reads `prefers-reduced-motion` itself and
hands it on as the phone's setting would arrive.

A heart asks for nothing again. It turns its own card, or the button on 04,
on the tap and changes nothing else on the screen: no spinner, no picture
drawn twice, no scroll lost. It used to fetch the collage again when the answer
came, which on a phone swapped the grid for a spinner and back. A heart on 04
is handed to the card it was opened from as it is pressed, so the card is
already right as the page slides away rather than once the collage has come
back. Coming back from a card's page does ask again, behind the grid like a
returning tab — which leaves the grid live while it is asked for, so the
collage remembers the hearts pressed on it or on a card's page meanwhile, and
an answer asked for before one of them does not turn it back by landing after
it. The page hands back what the server told it when it opened as well, which
is newer than the collage the card came from, and a card's own heart that is
answered after the page's heart was pressed — refused, say — leaves the card
as the page left it.

Pulling Oppdag down asks again the same way, behind the grid, with only the
pull's own spinner; a pull that gets no answer says so in a toast over the grid
it kept. Only the newest asking is taken: a chip tapped while the grid was
being asked for behind it, or a search sent while the last one was out, is not
undone by the older answer landing last. Only a grid that is the answer to
what is asked is kept, though: under a chip's spinner the grid in memory is the
one from before the chip, and a quiet asking that overtakes the spinner and
fails ends in «Fikk ikke kontakt», not in the old grid under the new chip.

The long press holds «Ikke vis meg slike», «Se profil» and «Rapporter».
Hiding takes the kind — the category and the subcategory, or the listing alone
when it has none — out of the grid on the tap and tells the server
(`POST /me/hidden`). The toast says «Vi viser deg ikke flere slike.», or «Vi
viser deg ikke denne igjen.» for a listing hidden alone, with «Angre» only
while this is the one thing hidden: the server's one way back is
`DELETE /me/hidden`, which shows everything again, and undoing one card must
not bring back what was hidden last month. Whether it is the one is the
server's count in its answer to the hide, not the session's, which can be from
before a sign-in brought other kinds along or another phone hid one; and a
second hide on the screen spends the first toast's «Angre». A report that
blocked, once the server has taken it, or the owner's profile closed again,
asks for the grid behind it, so a block takes their things away.

A block can be made from three other places, and each used to leave the
person on screen. From «⋯» on 04 the page goes — across a block the server has
no such listing for you — and the grid under it asks again as it comes back.
From «⋯» on 13b the profile is asked for again and stays: the server keeps it
readable because that is where a block is taken back, so it comes back with
none of their things, the line saying they are blocked and «Opphev
blokkeringen» behind «⋯»; a listing of theirs it was opened from goes when it
is come back to. From «Rapporter et problem» on a finished trade the trade is
asked for again. Each waits for the server's answer, and a report that did not
block asks for nothing. The thanks say the block — «Takk. Vi ser på
rapporten. Kari er blokkert.» — since the screen changes in the same moment.

04 comes back `true` when a block took it away, and whatever opened it asks
again. That was the grid and 13b's own list of things, and nothing else: 04
opened from 13b's «Send melding», from a notification on 12a or from a shared
link left the screen under it showing the blocked person's things. «Send
melding» now asks again as 13b's list does, quietly; a notification and a
link open 04 into Oppdag with `openListingInTab`, which has the tab's first
screen ask again, as it does when a finished flow lands on it.
`test/block_test.dart` holds all of it.
`test/heart_test.dart` holds all of it frame by frame, against a server that
takes as long to answer as a network does.

The search field has the focus only when somebody gives it the focus. Two
things gave it without a tap. A route hands focus back to whatever had it
last when what covered it goes, so a search typed, a card held down and its
sheet closed brought the keyboard back; the field now lets go of its focus
node as it loses focus, and nothing has it to give back — except when it is
the window that lost it: a browser takes the focus off the field while
another tab or the address bar has it, and gives it back to the same node
when the window returns, so the node is kept then. And in a browser with
a screen reader on, a page that appears with nothing on it asking for focus is
focused by the web engine on its first focusable thing — after a sheet closes,
since a sheet takes the page out of what a screen reader reads, and after
signing in, which builds the page anew — and an edit field takes that as a
tap. Oppdag draws no title, so the field was first. A heading, «Oppdag», for a
screen reader alone, now sits in the 6 over the field and takes it instead.
`test/focus_test.dart` holds both; the browser half is held on the rule the
engine applies, since a widget test has no browser to run it in.

A hide that gets no answer puts the kind back, says «Vi får ikke kontakt …», and
asks for the grid again behind it, quietly. The request is called off when the
api gives up on it, but calling off closes the connection and nothing more: a
request that reached the server whole is carried out whether anybody still
waits for the answer or not. So no answer is not a no, and the grid asked for
after it is what shows whether the kind is hidden. `test/abort_test.dart` holds
both halves.

The shell is keyed by who is signed in, so switching accounts or signing out
never leaves the last person's stacks on screen. A tab's old address —
`#/trades` in a browser, from when the tabs were routes — opens the gate at that
tab, never the tabs stacked on the gate, which would hide the splash, 02 or a
sign-in behind an empty shell. Only the first app opens there: the next person
through the gate, after «Logg ut», starts at Oppdag. A screen mounted on its own —
in a widget test, in a golden — has no shell above it and draws its own bar, so
the goldens are still the screens as the export draws them.

One place where the export and the app do not agree about the bar: 10b is
drawn without it, as step one of two, and is also the Legg ut tab, so a new
listing is written with the bar under it. There it keeps 12 under «Neste»
rather than the export's 30, which is room over the home indicator that the
bar keeps itself: with both, «Kun by vises for andre» was cut off at the edge
of the form, and the export shows it whole. The «Legg ut» buttons elsewhere open
that tab rather than a second form. 06c and 09a draw no bar of their own, so
their goldens, which mount them alone, have none where the export does; in the
app it is the shell's, under them.

## A finger is 44 points

The export draws controls smaller than a finger — «Hopp over» 21 tall, the
heart 34 across, «‹» seven pixels in a 25-tall row — and they stay drawn
exactly so; the goldens hold that. What is bigger is the area that answers,
made in `widgets/common.dart` one of two ways:

- **`TapArea`** is one target. Its `room` is free space the screen already had
  — a gap that was a `SizedBox` beside it moves inside it — so the box grows
  and nothing is drawn anywhere else. Its `reach` answers past the box without
  laying anything out. Around an `InkWell`, a field or a Material button it
  only widens where they answer, and a touch off their ink goes to its nearest
  point.
- **`TapRoom`** is space several targets share: a row of chips, a segmented
  control, a field and «Send». Each gets the part nearest to it, as much as
  makes it 44 and no more, so the amount between «−» and «+» stays an amount.

Between two targets the gap is split down the middle, so a finger in it gets
the nearer one. 05's chips scroll sideways, and a `TapRoom` does not reach
through a scroll view, so each chip carries half of the 7 on either side itself.

The header's «‹» and «⋯», and «Hopp over» on 02, sit in a slot the Scaffold
makes exactly their height. They answer from the route's overlay (`above`),
from the top edge of the screen down to 44 under the safe area — a browser has
no status bar, so that reaches into the top of the page — and only where the
page has nothing of its own there. «Innstillinger» on 13 is the first row of a
list, which ends at the status bar, so it answers up into it and out to the
edge the same way. The overlay is hit-tested apart from the page, so it only
answers while a touch on the target's own box would get there — not while the
page is on its way out, which popped the page under it on a second tap, nor
with the box scrolled out of sight — and the page under the finger is hit as
well: a tap there is the target's, a drag or a wheel is the list's.

`test/tap_targets_test.dart` opens every screen and sheet at 390×844, under the
export's status bar and again in a browser without one, and holds every target
to 44×44: Flutter's own guideline first, then each target touched at its edges,
corners and middle through the real hit test, and laid against every other so
no two claim the same point. A handful are drawn closer to a neighbour than a
finger — «Glemt passord?» has 41 between the field and the button — and take
all the room there is and no more; the test lists them with what they get.

## Photographs

10b opens the system picker and shrinks the picture on the phone — 1600px,
quality 82 — before uploading it, because a camera makes five megabytes and a
listing needs a few hundred kilobytes. `PostItemScreen` takes an injectable
`pickImage`, which is how the widget tests drive everything after the picker
without a camera roll.

The upload returns a path and a URL: the listing is created with the **path**,
the strip draws the **URL**. iOS asks for permission with the sentence in
`ios/Runner/Info.plist`. The browser build picks through a file input and
shrinks through a canvas to the same 1600px, but the quality only applies to
JPEG and WebP — a PNG comes back redrawn and still lossless — and a picture the
browser cannot draw, HEIC outside Safari, is passed on as it was picked. Those
two are what the server's ceiling is for.

The server stores a photograph only for somebody with a profile, and a stranger
gets one on 10c, which comes *after* 10b. So a stranger's pictures are picked
and shrunk the same way and then **kept on the phone**, drawn from memory in the
strip, and sent one at a time in the strip's order once 10c has made the
profile and before the listing is created. Each is marked as it lands: if one
does not get there, 10b stays up with everything still in it and says why in
coral, over the button where a phone shows it, and «Legg ut» sends only what is
missing. A picture the server will not take — too big for the ceiling, or not a
JPEG, PNG or WebP — is refused at that point rather than when it was picked; its
tile gets a coral edge, and its ✕ takes it out. Somebody with a profile has each
picture sent as it is picked, as before, and «Legg ut» waits while one is on
its way.

## A listing half written is kept on the phone

Closing the app, or the phone killing it in the background, used to throw 10b
away: what was typed, and every picture a stranger's phone was holding for it.
10c is where somebody puts the phone down to go and find a password, so it is
also where this hurt most. Now the form is kept as it is filled in
(`state/draft_store.dart`), and the app opened again has it back in Legg ut —
the words, the type, category and condition, the town beside the postcode and
the pictures in their order — whether it was killed on 10b or with 10c over it.
It still opens where it always does; only a listing that was on its way out
opens it on Legg ut.

- **Where.** The fields are one record in the preferences; each held picture is
  a file of its own in `drafts/` under the app's support directory — not
  Documents, which Files on iOS shows to the person. A picture the server has
  already — somebody with a profile, or one sent after 10c — is kept as its
  path and when it was sent, and its bytes are kept too: the server sweeps an
  upload no listing has taken up after a day, so a path older than twenty
  hours is not trusted, and the picture goes up again from the phone when the
  draft is listed — or is left out, where only the path was kept. A picture
  is written under a temporary name and renamed into place
  before the record naming it, so a phone that dies half-way leaves a draft
  that loads: a record that does not read is dropped with its pictures, a
  picture that is missing or not whole is left out and the rest come back, and
  files no record names are swept.
- **Whose.** By account id: nobody on a shared phone sees another's, and a test
  account keeps its own apart from the admin's. A claim on 10c keeps the id; a
  sign-in, which folds the stranger into another account, hands the draft to
  that account before the new token is kept. A draft handed over from 10c is
  marked as on its way out, and so is any listing while its pictures go up:
  killed then, the next start opens on Legg ut and finishes it, sending only
  the pictures that had not gone — if that start comes within five minutes.
  Swiping the app away is the one way to stop a «Legg ut» once pressed, and a
  start a week later is somebody opening the app to look around: the form
  comes back instead, for them to press. The mark comes off before the listing itself
  is asked for, so one whose answer was lost is never sent twice on its own —
  the form comes back instead, and 13 says whether it went.
- **One listing per draft.** Each draft names the listing it becomes, a UUID
  kept in its record and sent with «Legg ut» as `Idempotency-Key`. The server
  makes one listing per key and account and hands the first back to a second
  asking, so «Legg ut» pressed again after no answer — or after a kill, from
  the form that comes back — is the same listing, whether or not the first
  reached it. The draft gets a new one when it is listed or emptied. And the
  listing made is the whole answer: the session is asked again afterwards for
  13 and the badges, and no answer to that is quiet — it used to say «Legg ut»
  had failed after the listing was made, and pressed again, it was made
  twice. A listing handed back is the one the first press made, though, and
  the form may have changed since — the title put right, a picture added — so
  the server's 200 for it, where a new listing is 201, sends the form after it
  as the same correction «Rediger annonsen» makes, before the draft goes.
  Handed back as it was, «Lagt ut» went up over the old words and the new ones
  were lost. `test/listing_once_test.dart` holds all of it.
- **Until when.** It goes when the listing goes out; when the form is emptied
  — there is no «Forkast», the export draws none, so a form with nothing typed
  and no pictures is no draft, and a type or category chosen on its own keeps
  nothing; on «Logg ut», which takes every draft on the phone, since a draft is
  pictures of somebody's things in somebody's home; when the account is
  deleted; and when the phone is made a new stranger, which means whoever was
  signed in before can no longer be — signed out, or turned away by the server.
- **In a browser** there is no folder. The record goes in the browser's storage
  with the pictures in it as base64 while they come to under three million
  characters, and without them beyond that: the words come back and the
  pictures are picked again. A browser whose storage is fuller than that keeps
  the words the same way. Tabs of the site share that storage, and each
  answers from the copy it read when it opened, so clearing drafts reads it
  again first: «Logg ut» in one tab also takes a draft another tab kept since.
  The other tabs follow the sign-out (see *Another tab* above), and a form on
  its way out with them keeps nothing for somebody who is no longer there.

`test/draft_test.dart` holds all of it, killing the app between steps.

## The town beside the postcode

The export draws 10b's postcode as «7030 Trondheim»: the digits, and the town
the server keeps in their place, 11 and grey at the field's right edge. The
form asks `GET /postcodes/<code>` — public reference data, no session — once
four digits have held still for 300 ms, and draws the town beside them. A
postcode that belongs to no town gets the coral edge a refused photograph gets,
and the server's own words over the button, and «Neste» stays on 10b: it used
to be found out by «Legg ut», after 10c had made a profile for a listing that
could not go out. «Neste» pressed before the answer asks then, and three digits
are asked about too, so the server says why. No contact says nothing about the
postcode and holds nothing up; the listing is checked again when it is sent.
Answers are kept by code, so one that lands after the digits changed is never
drawn beside the new ones. `test/postcode_test.dart` holds it.

## The section the export does not draw at all

`screens/admin.dart` is Testverktøy, reached from a dark card on 16b and drawn
only for an account holding `is_admin`. It is deliberately not dressed as the
product — `AdminColors` in `design/tokens.dart` inverts the app's own two ends
and borrows the one avatar colour that has never been chrome — and
`widgets/admin_chrome.dart` puts «Du er Kari N. — ikke deg selv» under every
screen on every route while you are somebody else. `../docs/ADMIN.md` is the
whole of it.

## Rows the export does not draw

The share sheet behind the button on 04 and «Inviter en venn» on 16b: round 5
drew the invitation as a link somebody already had, not as one you make.

**«Se alle varsler» on 16b**, which opens 12a. The export drew 12a as a lock
screen — a push notification, not a screen with a back button — so it never drew
a door into the list of them inside the app. The screen was built anyway, and
without that row nothing could open it.

12a words every kind the server sends, from ids, as the lock screen the
export drew it as would. A trade ended because somebody in it deleted their
account comes as `trade_cancelled` with the reason `account_deleted`, and says
«Byttet er avsluttet» and why; a reason the app does not know yet still says
the trade ended, and the trade says the rest. It opens the trade, which shows
it ended, with the server's reason on it.

**«Vis alt på Oppdag igjen» on 16b**, under «Oppdag», with how much is hidden
beside it — kinds, and listings hidden alone while they can still be shown —
and only while any are, which is why the export's 16b, whose Ola has hidden
nothing, is still drawn exactly. It is `DELETE /me/hidden`, all of it, since
the server keeps no way to name one kind back; the session is asked again
after, so the count and the row go.

## Deleting the account

The export draws «Juridisk og personvern» at the foot of 16b and nothing behind
it, and it was a dialog. It is a screen of its own now, drawn without the bar
like 16b: what the product says about itself — the trade is between you, no
fødselsnummer, what deletion keeps, and that an account that only looked
around is deleted after twelve months in which the app was never opened — and
at its foot, as a row in a card the way «Logg ut» is on 16b, **«Slett
kontoen»**. Under everything, in small grey type, is the attribution NLOD 2.0
asks for of anybody using Bring's postcode register: the licensor, the
licence and where to find both, and that we changed it — the same facts as the
header of `backend/src/lib/postcode-register.ts`, in Norwegian and where a
person can read them. A device looking around has no 16b, so its 13 — an
invitation to make a profile — carries the way here itself, a quiet line under
«Har du konto? Logg inn», and says the twelve-month rule in its own words:
the likes are kept on an account for the device, and go with it. «Slett
kontoen» is not drawn for a device; there is no profile to delete.

The row opens a sheet with one sentence of what happens — the profile emptied
and the things taken down at once, trades under way ended, a minimal record
kept apart for three years after the last completed trade, or after the
deletion for somebody who never completed one — and the password,
because a phone left unlocked on a table is not the person. The button is the
app's destructive one («Avslå», «Trekk deg»), never the green way on and never
report-and-block red. `DELETE /me` then ends every session; the phone signs out
as «Logg ut» does, device id and all, and the gate makes whoever holds it next
a new stranger. What the server refuses — «Feil passord.», the account holding
the key to the test tooling — it says in the sheet, over the button. The phone
lets go even if the sheet was pulled down while the answer was on its way.
«Kontoen er slettet.» waits until the gate has shown what comes next: a toast
is placed once, as it goes up, and put up at once it was placed against the
splash and then lay across 02's «Fortsett».

Everybody else in a trade the deletion ended is told on 12a — «Noen i byttet
slettet kontoen sin.» — and the trade, ended, says the same thing in words that
fit it: «Den andre i byttet …» in a pair, «En av de andre i byttet …» in a
ring. Those are chosen by the trade's `closeCode`, `account_deleted`, not read
from its `closeReason`, the server's sentence kept for history; and the line
under every other ended trade, «Angret du? Du kan sende et nytt forslag fra
samtalen.», is not drawn under this one, since there is nobody to send it to.
`test/screens_test.dart` holds the words, under 09f.

Taking your own listing down, from «⋯» on 04, asks the way «Slett kontoen»
does: the row in «Logg ut»'s red and the app's destructive button, never
report-and-block red.

Acting as a test account, the sheet asks no password — the admin's key is
behind that session, not the account's — and the tool retires it, as
`../docs/ADMIN.md` has it; the phone goes back to the admin after.
`test/account_test.dart` holds both, and the «Vis alt» row.

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

A toast never lies over the screen's primary action. It sits 14 above the foot
of its screen — the bar, in a tab, whose screens end where the bar begins; the
keyboard, when it is up — unless that is where the action is, which on a screen
drawn without the bar (02, 10b, 10c, a chat) it is. Then it goes up to 14 above
it. What counts is every `PrimaryButton` and every `SecondaryButton` — the
trade screen's foot is outlined buttons only in most of its states, «Trekk deg
fra byttet» or «Tilbake til Bytter», and a refusal lay across them — and
anything wrapped in `KeepClear`: the composer on 06g, the heart and ✕ at the
foot of 04, the swipe and «Avbryt» on 06c, the words under 06a's button and
the invitation's. Nothing covering the page, no tab out of sight, no button
scrolled out of its list. The room under a lifted toast is margin, so the
button under it still answers. A toast can carry one word of a way back at its
right edge, «Angre», which takes it down as well.

It is measured as it goes up, and once more when the frame it went up in has
been drawn. A toast is often said in the same moment as a page comes or goes —
a listing out and the tab it lands on, a block and the page it leaves — and
then the page it was measured against is the one leaving: the new one is not
built until the next frame, and the one a pop uncovers is still offstage. A
toast whose place has changed by then is put up again where it belongs,
before anybody can have read it where it was. `test/toast_test.dart` holds the
rules, and `test/tap_targets_test.dart` raises one over every screen and holds
it off every target outside a list.

A page asked for again keeps what it has. Every failure to get an answer is
`ApiException.noContact`, and it reached error states written for refusals: a
list tab asked for again behind itself — a pull, the tab coming back — was
replaced by «Fikk ikke kontakt» and stayed that way after the connection came
back, and a trade, a conversation, a listing or a profile asked for again was
replaced by «Fant ikke …», which says the thing is gone. Now only a screen with
nothing on it yet fails into its empty state, which asks again from «Prøv
igjen»; after that the page stays, and a pull that fails says so in a toast
over it (a tab coming back keeps quiet, as Oppdag's does). A detail page that
could not get its one thing at all says «Fikk ikke kontakt» for no answer and
«Fant ikke …» only for the server's no — `LoadFailure` in `widgets/common.dart`.
06a is one of them: it said no answer in a toast and went on spinning on deep
green with no header and nothing to press. It has the app's own failed page
now, with «‹». The subcategories on 05b are a way to narrow a category and the
search goes on without them, so no answer about them leaves them out quietly,
as it does the count on the button.
`test/no_contact_test.dart` holds each of them.

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

## Google Play

**What goes up is an app bundle signed with the upload key.** Google keeps the
key that signs what reaches the phones (Play App Signing), so ours only shows
that an upload came from us, and a lost one can be replaced by asking Play
Console for an upload key reset. The keystore is never in the repository.
`android/key.properties`, which git ignores, says where it is and what opens it:

```properties
storeFile=/absolute/path/to/swaply-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

A relative `storeFile` is read from `android/app`. The key is made once:

```sh
keytool -genkeypair -keystore swaply-upload.jks -storetype PKCS12 \
  -keyalg RSA -keysize 4096 -validity 10000 -alias upload
```

PKCS12 has one password for the store and the key, so both lines carry it.
Then:

```sh
flutter build appbundle
# build/app/outputs/bundle/release/app-release.aab
```

Three things are seen to without being asked. A release build talks to
`https://swaply-api.freelunch.no` unless `--dart-define=API_BASE=…` says
otherwise, because localhost on a phone is the phone. Without `key.properties`
the bundle is refused before it is built, because Play refuses one signed with
the debug key, and after the upload is a long way to find that out. And
INTERNET is asked for in the main manifest: Flutter's template grants it only
to debug and profile, so the one build Play takes would have reached nothing.

**Every upload needs a higher build number than the last:** the number after
`+` in `version:` in `pubspec.yaml`, or `--build-number`. Play refuses a
number it has seen before, even on a bundle that was never rolled out.

**The first bundle goes up by hand**, in Play Console, because the Play API
knows an app only once a build of it exists. That upload is also what ties
`no.teorimester.swaply` to the app for good.

**Internal testing** takes up to a hundred testers named by e-mail, is not held
for review, and has a new bundle on their phones within minutes. The store
listing, content rating and data safety form can wait for a closed test; the
advertising ID question under App content cannot, because Play will not roll
out a release targeting Android 13 or later until it is answered (the app uses
none). A tester opens the opt-in link signed in with the Google account the
phone's Play Store uses.
