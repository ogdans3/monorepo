// Every screen from the round 5 export, mounted and asserted on.
//
// The strings checked here are lifted from `docs/round-5-screens.md`, so this
// suite is what stops the app drifting away from the drawings.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = true}) async {
  // A phone-shaped but very tall surface, so a ListView builds all of its
  // children and `find.text` can see what is below the fold on a real phone.
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  if (signedIn) await session.login('ola@epost.no', 'passord');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        home: screen,
        // The app's own tab routes. A screen that finishes by going somewhere
        // named — 10b ends on the profile — would otherwise throw at the last
        // step and hide whether it got that far.
        onGenerateRoute: (settings) => MaterialPageRoute(
            settings: settings,
            builder: (_) => Scaffold(body: Center(child: Text(settings.name ?? '')))),
        // pumpAndSettle waits for every animation to end, and the confetti
        // never does; it holds still when the phone asks for less motion.
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('01 · 16c · 10c first run', () {
    testWidgets('01 the splash is the wordmark on deep green', (tester) async {
      await mount(tester, const SplashScreen(), signedIn: false);
      expect(find.text('swaply'), findsOneWidget);
    });

    testWidgets('16c signing in takes an address and a password', (tester) async {
      await mount(tester, const LoginScreen(), signedIn: false);

      expect(find.text('E-post'), findsOneWidget);
      expect(find.text('Passord'), findsOneWidget);
      expect(find.text('Logg inn'), findsOneWidget);
      expect(find.text('Fortsett med Google'), findsOneWidget);
      expect(find.text('Fortsett med Facebook'), findsOneWidget);
      expect(find.text('Fortsett med Apple'), findsOneWidget);
      expect(find.text('Opprett konto'), findsOneWidget);
    });

    testWidgets('16c a social button says why it cannot sign you in yet', (tester) async {
      await mount(tester, const LoginScreen(), signedIn: false);
      await tester.tap(find.text('Fortsett med Apple'));
      await tester.pumpAndSettle();

      expect(find.textContaining('krever en avtale med leverandøren'), findsOneWidget);
    });

    testWidgets('16c a wrong password says so and does not sign you in', (tester) async {
      server.overrides['POST /auth/login'] = 401;
      await mount(tester, const LoginScreen(), signedIn: false);

      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'feil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();

      expect(find.text('Feil e-post eller passord.'), findsOneWidget);
      expect(session.signedIn, isFalse);
    });

    testWidgets('10c creating a profile asks for the four things and says why', (tester) async {
      await mount(tester, const CreateProfileScreen(continuingToListing: true),
          signedIn: false);

      expect(find.text('Visningsnavn'), findsOneWidget);
      expect(find.text('Telefonnummer'), findsOneWidget);
      expect(find.text('Lag profil og legg ut'), findsOneWidget);
      expect(find.text('2/2'), findsOneWidget);
      expect(
          find.textContaining('BankID bekreftes ved ditt første bytte'), findsOneWidget);
    });
  });

  group('02 interests', () {
    testWidgets('the picker holds all twelve categories and counts the choice',
        (tester) async {
      await mount(tester, const InterestsScreen());

      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      for (final label in ['Sykling', 'Gaming', 'Verktøy', 'Klær', 'Båt', 'Friluft',
        'Barn', 'Hjem', 'Sport', 'Musikk', 'Bøker', 'Diverse']) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
    });

    testWidgets('choosing is advised, but one or two is not a choice', (tester) async {
      final fresh = {...FakeServer.me, 'interests': const []};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': fresh};
      server.overrides['GET /me'] = fresh;
      await mount(tester, const InterestsScreen());

      // Alive from the first frame, and honest about it: nothing chosen is the
      // same door as «Hopp over».
      final button = find.widgetWithText(FilledButton, 'Fortsett');
      expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
      expect(find.text('Anbefalt, ikke påkrevd. Du kan endre dette senere.'), findsOneWidget);

      // Three to five or none is the shape of the column, so below three the
      // button waits and says what it is waiting for. It used to stay lit and
      // hand the server something it could only refuse.
      await tester.tap(find.text('Sykling'));
      await tester.tap(find.text('Gaming'));
      await tester.pump();
      expect(find.text('Velg 1 til, eller ingen for å hoppe over.'), findsOneWidget);
      expect(tester.widget<FilledButton>(button).onPressed, isNull);

      await tester.tap(find.text('Verktøy'));
      await tester.pump();
      expect(find.text('3 av 5 valgt'), findsOneWidget);
      expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
    });

    testWidgets('«Fortsett» with nothing chosen writes nothing and moves on', (tester) async {
      final fresh = {...FakeServer.me, 'interests': const []};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': fresh};
      server.overrides['GET /me'] = fresh;
      await mount(tester, const InterestsScreen());

      await tester.tap(find.widgetWithText(FilledButton, 'Fortsett'));
      await tester.pumpAndSettle();

      expect(server.requests, isNot(contains('PUT /me/interests')));
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('at five the rest go quiet rather than shouting', (tester) async {
      final fresh = {...FakeServer.me, 'interests': const []};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': fresh};
      server.overrides['GET /me'] = fresh;
      await mount(tester, const InterestsScreen());

      for (final c in ['Sykling', 'Gaming', 'Verktøy', 'Klær', 'Båt']) {
        await tester.tap(find.text(c));
        await tester.pump();
      }
      expect(find.text('Fem er nok. Du kan endre dette senere.'), findsOneWidget);

      await tester.tap(find.text('Sport'));
      await tester.pump();
      expect(find.text('Fem er nok. Du kan endre dette senere.'), findsOneWidget);
    });
  });

  group('05 · 05b discovery', () {
    testWidgets('05 before a search the rows come from your interests', (tester) async {
      await mount(tester, const DiscoverScreen());

      expect(find.text('Verktøy'), findsOneWidget);
      expect(find.text('Gaming'), findsOneWidget);
      expect(find.text('Bosch drill 18V'), findsOneWidget);
      expect(find.text('Verdi 600 kr'), findsOneWidget);
    });

    testWidgets('05 the heart is on the face of the card, not behind a long press',
        (tester) async {
      await mount(tester, const DiscoverScreen());
      expect(find.byIcon(Icons.favorite_border), findsWidgets);
    });

    testWidgets('05 searching shows a count and the results', (tester) async {
      await mount(tester, const DiscoverScreen());

      await tester.enterText(find.byType(TextField).first, 'sykkel');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(find.text('2 treff'), findsOneWidget);
      expect(find.text('Retro spillkonsoll'), findsOneWidget);
    });

    testWidgets('05 all five tabs are there, with the unread badge on Chats',
        (tester) async {
      await mount(tester, const DiscoverScreen());

      for (final tab in ['Oppdag', 'Legg ut', 'Bytter', 'Chats', 'Profil']) {
        expect(find.text(tab), findsOneWidget, reason: tab);
      }
      // Two unread messages and one trade waiting on you.
      expect(find.text('2'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('05b advanced search carries every control the export draws',
        (tester) async {
      await mount(tester,
          const AdvancedSearchScreen(initial: SearchFilters(), query: 'sykkel'));

      expect(find.text('Fritekst'), findsOneWidget);
      expect(find.text('Hovedkategori'), findsOneWidget);
      expect(find.text('Verdi'), findsNWidgets(2)); // the range, and the sort
      expect(find.text('Tilstand'), findsOneWidget);
      expect(find.text('Sorter etter'), findsOneWidget);
      expect(find.text('Nullstill'), findsOneWidget);
      expect(find.text('Vis 2 treff'), findsOneWidget);
    });
  });

  group('04 item detail', () {
    testWidgets('the page carries the facts, the owner and the message box',
        (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      expect(find.text('Retro spillkonsoll'), findsOneWidget);
      expect(find.text('Verdi 1 200 kr'), findsOneWidget);
      expect(find.text('Kari N.'), findsOneWidget);
      expect(find.text('Se profil ›'), findsOneWidget);
      expect(find.text('SAMTALE MED KARI'), findsOneWidget);
      expect(find.text('Send'), findsOneWidget);
      // The export ends this screen with two circles and no words on them: a ✕
      // that passes and the heart. `docs/round-5-screens.md` line 145.
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(find.byIcon(Icons.close), findsOneWidget);
    });

    testWidgets('writing the first message opens the conversation', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      await tester.enterText(
          find.widgetWithText(TextField, 'Skriv en melding til Kari…'), 'Er den ledig?');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /items/item-console/message'));
      expect(find.text('Meldingen er sendt. Samtalen ligger under Chats.'), findsOneWidget);
    });

    testWidgets('04 the tenth wish says what to do next, here as on the collage',
        (tester) async {
      // 10a lived on the discovery card only, so reaching ten hearts from a
      // listing was the one way to get there and never be told.
      server.overrides['POST /items/item-console/like'] =
          {'liked': true, 'tradeId': null, 'promptToList': true, 'likedCount': 10};
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      await tester.tap(find.byIcon(Icons.favorite_border).last);
      await tester.pumpAndSettle();

      expect(find.textContaining('Du har likt 10 ting'), findsOneWidget);
      expect(find.text('Legg ut en gjenstand'), findsOneWidget);
    });

    testWidgets('a listing with no photo gets a card, not a hole', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));
      expect(find.byIcon(Icons.sports_esports_outlined), findsWidgets);
    });
  });

  group('06 the trade, in its states', () {
    testWidgets('06b your turn: what you get, what you give, and three actions',
        (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('DU FÅR'), findsOneWidget);
      expect(find.text('DU GIR'), findsOneWidget);
      expect(find.text('Retro spillkonsoll'), findsOneWidget);
      expect(find.text('Avslå'), findsOneWidget);
      expect(find.text('Godta byttet'), findsOneWidget);
      expect(find.text('Foreslå motbytte'), findsOneWidget);
      // The other side's card says where they stand; no pill in the header.
      expect(find.text('✓ Har godtatt'), findsOneWidget);
    });

    testWidgets('06b the cash difference is shown as an amount to Vipps, never taken',
        (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('MELLOMLEGG'), findsOneWidget);
      expect(find.text('Du betaler 350 kr til Kari'), findsOneWidget);
      expect(find.text('betales når begge har godtatt'), findsOneWidget);
    });

    testWidgets('06b the values and the difference add up', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.textContaining('verdi 1 200 kr'), findsWidgets);
      expect(find.textContaining('verdi 600 kr'), findsWidgets);
      expect(find.text('differanse 600 kr'), findsOneWidget);
    });

    testWidgets('06e waiting: no accept button once you have accepted', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Godta byttet'), findsNothing);
      expect(find.textContaining('Har godtatt'), findsWidgets);
      expect(find.text('Trekk deg fra byttet'), findsOneWidget);
    });

    testWidgets('a half-filled offer offers no way to accept it', (tester) async {
      // The trade behind «Jeg vil ha» names their listing and nothing back.
      // «Godta byttet» there was a one-tap way to give a thing away for
      // nothing, and the server now refuses it too.
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'talking',
        'youGet': const [],
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Godta byttet'), findsNothing);
      expect(find.text('Sett sammen byttet'), findsOneWidget);
      expect(find.textContaining('har ikke lagt noe i byttet ennå'), findsOneWidget);
    });

    testWidgets('06e a yes can be taken back without ending the trade', (tester) async {
      // The lifecycle goes backwards as well as forwards, and until now
      // nothing in the app called the endpoint that does it: the only way out
      // of your own acceptance was cancelling the whole trade.
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      };
      server.overrides['DELETE /trades/trade-1/accept'] = FakeServer.trade;
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      await tester.tap(find.text('Angre godkjenningen'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Byttet står fortsatt'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Angre godkjenningen'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('DELETE /trades/trade-1/accept'));
    });

    testWidgets('06f accepted: the handover markers are yours to set', (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': 'accepted'};
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('DU SENDER'), findsOneWidget);
      expect(find.text('PÅ VEI TIL DEG'), findsOneWidget);
      expect(find.text('Marker som sendt'), findsOneWidget);
      expect(find.text('Marker som mottatt'), findsOneWidget);
      expect(find.text('Marker som betalt'), findsOneWidget);
      expect(find.textContaining('frakt avtales utenfor appen'), findsOneWidget);
    });

    testWidgets('09e a counter arrived: it says a new proposal is on the table',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'countered',
        'counterOfferBy': 'kari-1',
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);
    });

    testWidgets('09f declined: it says why, in words', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'cancelled',
        'closeReason': 'Tingene dine er tilgjengelige for andre igjen.',
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Byttet er avsluttet'), findsOneWidget);
      expect(find.text('Tingene dine er tilgjengelige for andre igjen.'), findsOneWidget);
      expect(find.text('Tilbake til Bytter'), findsOneWidget);
    });

    testWidgets('09i finished: what you got, what you gave, and your review',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'completed',
        'closedAt': '2026-09-04T12:00:00Z',
        'you': {
          ...FakeServer.trade['you'] as Map,
          'accepted': true,
          'sentAt': '2026-09-03T12:00:00Z',
          'receivedAt': '2026-09-04T12:00:00Z',
        },
        'yourReview': {'score': 5, 'comment': 'Rask og hyggelig, alt som avtalt'},
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('DU FIKK'), findsOneWidget);
      expect(find.text('DU GA'), findsOneWidget);
      expect(find.text('Fullført 4. september 2026'), findsOneWidget);
      expect(find.text('«Rask og hyggelig, alt som avtalt»'), findsOneWidget);
      expect(find.text('✓ Mottatt'), findsOneWidget);
      expect(find.text('✓ Levert'), findsOneWidget);
    });

    testWidgets('08b paused: the deadline and both answers are on the screen',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'paused',
        'withdrawal': {
          'id': 'w1',
          'byYou': false,
          'state': 'waiting',
          'respondsBy':
              DateTime.now().add(const Duration(days: 2, hours: 14)).toIso8601String(),
          'blockedBySent': false,
        },
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Kari vil trekke seg'), findsOneWidget);
      expect(find.textContaining('igjen'), findsWidgets);
      expect(find.text('Ja, greit'), findsOneWidget);
      expect(find.text('Nei'), findsOneWidget);
    });

    testWidgets('08c refused: once they have sent, you cannot withdraw', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'accepted',
        'withdrawal': {
          'id': 'w1',
          'byYou': true,
          'state': 'rejected',
          'respondsBy': null,
          'blockedBySent': true,
        },
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Du kan ikke trekke deg'), findsOneWidget);
      expect(find.textContaining('har allerede sendt sin ting'), findsOneWidget);
    });

    testWidgets('07j chain: the third leg is shown, and it is agreed in the chat',
        (tester) async {
      server.overrides['GET /trades/trade-chain'] = chainTrade();
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-chain'));

      expect(find.text('Ditt bytte'), findsOneWidget);
      expect(find.text('KARI GIR'), findsOneWidget);
      expect(find.text('CHAT · ALLE TRE'), findsOneWidget);
      // A chain has no counter-offer: it is arranged in the conversation.
      expect(find.text('Foreslå motbytte'), findsNothing);
    });
  });

  group('06c the agreement', () {
    testWidgets('every term is spelled out, including who is not a party',
        (tester) async {
      await mount(tester, AgreementScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Dette godtar du'), findsOneWidget);
      expect(find.textContaining('innen 7 dager'), findsOneWidget);
      expect(find.textContaining('som beskrevet i annonsen'), findsOneWidget);
      expect(find.textContaining('før noe sendes'), findsOneWidget);
      expect(find.textContaining('Er noe sendt, kan jeg ikke trekke meg'), findsOneWidget);
      // The party clause is in the full terms, behind the link.
      await tester.tap(find.text('Les hele byttevilkårene ›'));
      await tester.pumpAndSettle();
      expect(
        find.text('Swaply er ikke part i byttet og fasiliterer ikke frakt eller '
            'betaling. Avtalen er mellom dere.'),
        findsOneWidget,
      );
    });

    testWidgets('the swipe stays dead until the box is ticked', (tester) async {
      await mount(tester, AgreementScreen(trade: Trade.fromJson(FakeServer.trade)));

      final knob = find.text('›');
      await tester.drag(knob, const Offset(400, 0));
      await tester.pumpAndSettle();
      expect(server.requests, isNot(contains('POST /trades/trade-1/accept')));

      await tester.tap(find.text('Jeg har lest og godtar vilkårene'));
      await tester.pumpAndSettle();
      await tester.drag(knob, const Offset(400, 0));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /trades/trade-1/accept'));
    });

    testWidgets('BankID is asked for at the first accept, and only then',
        (tester) async {
      // «BankID bekreftes ved ditt første bytte» is the promise 10c makes, and
      // the settings row was the only place that kept it.
      final unverified = {...FakeServer.me, 'bankidVerified': false};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': unverified};
      server.overrides['GET /me'] = unverified;
      await mount(tester, AgreementScreen(trade: Trade.fromJson(FakeServer.trade)));

      await tester.tap(find.text('Jeg har lest og godtar vilkårene'));
      await tester.pumpAndSettle();
      await tester.drag(find.text('›'), const Offset(400, 0));
      await tester.pumpAndSettle();

      expect(find.text('BankID-verifisering'), findsOneWidget);
      expect(find.textContaining('ditt første bytte'), findsOneWidget);
      expect(find.textContaining('aldri fødselsnummer'), findsOneWidget);
    });
  });

  group('09 counter-offer', () {
    testWidgets('09a both sides are pickable and the totals follow', (tester) async {
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Motbytte'), findsOneWidget);
      expect(find.textContaining('må godta på nytt'), findsOneWidget);
      expect(find.text('DU FÅR · KARIS TING'), findsOneWidget);
      expect(find.text('DU GIR · DINE TING'), findsOneWidget);
      expect(find.text('Send motbytte'), findsOneWidget);
    });

    testWidgets('09a three a side is the cap, and both sides must have something',
        (tester) async {
      // «Each side of a hop is a list of 1–3 items», and a deal where one side
      // gives nothing is not one the other can accept — the server refuses
      // both, so the screen should never compose either.
      server.overrides['GET /trades/trade-1/candidates'] = {
        'yours': [
          FakeServer.drill,
          {...FakeServer.drill, 'id': 'a', 'title': 'Sykkelhjelm'},
          {...FakeServer.drill, 'id': 'b', 'title': 'Skateboard'},
          {...FakeServer.drill, 'id': 'c', 'title': 'Ullgenser M'},
        ],
        'theirs': [FakeServer.console],
        'counterparty': FakeServer.kari,
      };
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      // The drill and the console arrive picked, from the offer on the table.
      await tester.tap(find.text('Sykkelhjelm'));
      await tester.pump();
      await tester.tap(find.text('Skateboard'));
      await tester.pump();
      expect(find.text('Tre ting er nok på hver side.'), findsOneWidget);

      // A fourth is no longer something the row answers to.
      await tester.tap(find.text('Ullgenser M'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Send motbytte'));
      await tester.pumpAndSettle();
      expect(server.bodies['POST /trades/trade-1/counter']!['items'], hasLength(4));
    });

    testWidgets('09a with nothing of theirs there is nothing to send', (tester) async {
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pump();

      final send = find.widgetWithText(FilledButton, 'Send motbytte');
      expect(tester.widget<FilledButton>(send).onPressed, isNull);
    });

    testWidgets('09b a thing another trade is holding is shown, and locked',
        (tester) async {
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Bysykkel, dame'), findsOneWidget);
      expect(find.text('Låst'), findsOneWidget);
      expect(find.textContaining('reservert i annet bytte'), findsOneWidget);
    });

    testWidgets('09d the cash line says who pays, and flips when tapped', (tester) async {
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('MELLOMLEGG'), findsOneWidget);
      expect(find.text('Du betaler Kari'), findsOneWidget);
      await tester.tap(find.text('Du betaler Kari'));
      await tester.pumpAndSettle();
      expect(find.text('Kari betaler deg'), findsOneWidget);
    });
  });

  group('06g · 07k · 11a chat', () {
    testWidgets('11a each row says what the conversation is about', (tester) async {
      await mount(tester, const ChatsScreen());

      expect(find.text('Chats'), findsWidgets);
      // First names in the list, as the export writes them: «Kari», not «Kari N.»
      expect(find.text('Kari'), findsOneWidget);
      expect(find.text('Bytte · Bosch drill 18V ⇄ Retro spillkonsoll'), findsOneWidget);
    });

    testWidgets('06g the thread shows both sides and the three chips', (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.textContaining('Nidarosdomen'), findsOneWidget);
      expect(find.text('Passer bra! Kl. 17?'), findsOneWidget);
      expect(find.text('♥ Jeg vil ha'), findsOneWidget);
      expect(find.text('Foreslå ting'), findsOneWidget);
      expect(find.text('Foreslå mellomlegg'), findsOneWidget);
    });

    testWidgets('07k the chain thread carries a banner that cannot be closed',
        (tester) async {
      server.overrides['GET /threads/thread-1'] = {
        ...FakeServer.thread,
        'kind': 'chain',
        'banner': 'Swaply fasiliterer ikke dette byttet. Dere avtaler overlevering, '
            'mellomlegg og eventuell frakt selv i denne chatten.',
        'participants': [
          {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
          {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
          {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
        ],
      };
      server.overrides['GET /trades/trade-1'] = chainTrade();
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.textContaining('Swaply fasiliterer ikke dette byttet'), findsOneWidget);
      expect(find.text('Du, Kari N. og Per H.'), findsOneWidget);
      expect(find.byIcon(Icons.close), findsNothing);
    });

    testWidgets('sending a message posts it', (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      await tester.enterText(find.byType(TextField).last, 'Sees da!');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /threads/thread-1/messages'));
    });
  });

  group('09c · 09c2 · 09d the three sheets behind the chips', () {
    Future<void> openChip(WidgetTester tester, String chip) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      // The chip row scrolls sideways on a narrow phone, so the last one has to
      // be brought into view the way a thumb would.
      await tester.ensureVisible(find.text(chip));
      await tester.pumpAndSettle();
      await tester.tap(find.text(chip));
      await tester.pumpAndSettle();
    }

    testWidgets('09c offering one of yours names the thing on the button',
        (tester) async {
      await openChip(tester, 'Foreslå ting');

      expect(find.text('Foreslå en av dine ting'), findsOneWidget);
      expect(find.textContaining('kan svare «Jeg vil ha» direkte'), findsOneWidget);

      await tester.tap(find.text('Bosch drill 18V').last);
      await tester.pumpAndSettle();
      expect(find.text('Foreslå Bosch drill 18V'), findsOneWidget);

      await tester.tap(find.text('Foreslå Bosch drill 18V'));
      await tester.pumpAndSettle();
      expect(server.requests, contains('POST /trades/trade-1/counter'));
      // The other side gets a line in the conversation, not a silent change.
      expect(server.requests, contains('POST /threads/thread-1/messages'));
    });

    testWidgets('09c2 asking for more of theirs', (tester) async {
      await openChip(tester, '♥ Jeg vil ha');

      expect(find.text('Vil du ha noe mer av Kari?'), findsOneWidget);
      await tester.tap(find.text('Retro spillkonsoll').last);
      await tester.pumpAndSettle();
      expect(find.text('Be om Retro spillkonsoll i tillegg'), findsOneWidget);
    });

    testWidgets('09d the cash sheet states the difference it is suggesting',
        (tester) async {
      await openChip(tester, 'Foreslå mellomlegg');

      expect(find.text('Foreslå mellomlegg'), findsWidgets);
      expect(find.textContaining('Differansen er 600 kr'), findsOneWidget);
      expect(find.text('Jeg betaler'), findsOneWidget);
      expect(find.text('Kari betaler'), findsOneWidget);
      expect(find.text('Ingen'), findsOneWidget);
    });
  });

  group('11 · 17a trades list', () {
    testWidgets('the three tabs are counted', (tester) async {
      await mount(tester, const TradesScreen());

      expect(find.text('Mine handler'), findsOneWidget);
      expect(find.text('Venter · 1'), findsOneWidget);
      expect(find.text('Aktive · 0'), findsOneWidget);
      expect(find.text('Fullført · 0'), findsOneWidget);
      expect(find.text('Din tur'), findsOneWidget);
    });

    testWidgets('17a with nothing anywhere it teaches the way out', (tester) async {
      server.overrides['GET /trades'] = {
        'waiting': const [],
        'active': const [],
        'done': const [],
        'yourTurn': 0,
      };
      await mount(tester, const TradesScreen());

      expect(find.text('Ingen bytter ennå'), findsOneWidget);
      expect(find.textContaining('Lik noe på Oppdag'), findsOneWidget);
      expect(find.text('Gå til Oppdag'), findsOneWidget);
    });
  });

  group('12 · 12a · 17b likes and notifications', () {
    testWidgets('12 your things come with the people who liked them', (tester) async {
      await mount(tester, const LikedScreen());

      expect(find.text('Likt'), findsOneWidget);
      expect(find.text('Folk som har likt tingene dine'), findsOneWidget);
      expect(find.text('1 har likt denne'), findsOneWidget);
      // First name, as the export lists people: «Kari», «Ola», «Per».
      expect(find.text('Kari'), findsOneWidget);
      expect(find.text('Se tingene deres ›'), findsOneWidget);
    });

    testWidgets('17b with no likes it says what gets them', (tester) async {
      server.overrides['GET /me/liked-by'] = {'items': const []};
      await mount(tester, const LikedScreen());

      expect(find.text('Ingen likes ennå'), findsOneWidget);
      expect(find.textContaining('Gode bilder og ærlig tilstand'), findsOneWidget);
    });

    testWidgets('12a a new message opens the conversation it is about', (tester) async {
      // The chat route's notification carries a threadId, and the screen only
      // knew how to open a trade or a listing — so the one notification people
      // get most often did nothing at all when tapped.
      server.overrides['GET /notifications'] = {
        'notifications': [
          {
            'id': 'n3',
            'type': 'message',
            'payload': {'threadId': 'thread-1'},
            'actorName': null,
            'itemTitle': null,
            'readAt': null,
            'createdAt': '2026-09-09T08:55:00Z',
          },
        ],
        'unread': 1,
      };
      await mount(tester, const NotificationsScreen());

      await tester.tap(find.text('Ny melding'));
      await tester.pumpAndSettle();

      expect(find.byType(ThreadScreen), findsOneWidget);
    });

    testWidgets('12a the words are assembled here, from ids', (tester) async {
      await mount(tester, const NotificationsScreen());

      expect(find.text('Kari likte Bosch drill 18V'), findsOneWidget);
      expect(find.textContaining('lik tilbake'), findsOneWidget);
      expect(find.text('Noen godtok byttet'), findsOneWidget);
      expect(find.textContaining('Sveip for å godta'), findsOneWidget);
    });
  });

  group('13 · 13b · 17c · 16b profile', () {
    testWidgets('13 the profile carries rating, interests and your things',
        (tester) async {
      await mount(tester, const ProfileScreen());

      expect(find.text('Ola N.'), findsOneWidget);
      expect(find.text('BankID-verifisert'), findsOneWidget);
      expect(find.textContaining('4,9 · 12 vurderinger'), findsOneWidget);
      expect(find.text('♥ 4 har likt tingene dine'), findsOneWidget);
      expect(find.text('Mine gjenstander · 1'), findsOneWidget);
      expect(find.text('Tilgjengelig'), findsOneWidget);
    });

    testWidgets('17c with nothing listed it says so and offers the way out',
        (tester) async {
      server.overrides['GET /me'] = {...FakeServer.me, 'items': const [], 'likedByCount': 0};
      await mount(tester, const ProfileScreen());

      expect(find.text('Du har ingen ting ute'), findsOneWidget);
      expect(find.textContaining('under et minutt'), findsOneWidget);
    });

    testWidgets('13b their things are the point of the screen', (tester) async {
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'));

      expect(find.text('Kari N.'), findsWidgets);
      expect(find.text('Kari sine gjenstander · 1'), findsOneWidget);
      expect(find.text('Retro spillkonsoll'), findsOneWidget);
      expect(find.text('Friluft'), findsOneWidget);
    });

    testWidgets('16b settings groups account, notifications and the way out',
        (tester) async {
      await mount(tester, const SettingsScreen());

      expect(find.text('KONTO'), findsOneWidget);
      expect(find.text('E-post og telefon'), findsOneWidget);
      expect(find.text('BankID-verifisering'), findsOneWidget);
      expect(find.text('Verifisert'), findsOneWidget);
      expect(find.text('VARSLER'), findsOneWidget);
      expect(find.text('Logg ut'), findsOneWidget);
    });

    testWidgets('16b the list of notifications has a way in', (tester) async {
      // 12a is a lock screen, so round 5 never drew a door to the list inside
      // the app. It was built, registered as a route, and reachable from
      // nowhere.
      await mount(tester, const SettingsScreen());

      await tester.tap(find.text('Se alle varsler'));
      await tester.pumpAndSettle();

      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(find.textContaining('Kari likte Bosch drill 18V'), findsOneWidget);
    });

    testWidgets('16a a block can be taken back, from the same menu that set it',
        (tester) async {
      // Blocking was one tick inside a report and there was no way back: the
      // endpoint existed and nothing in the app called it.
      server.overrides['GET /users/kari-1'] = {
        ...FakeServer.kari,
        'items': const [],
        'interests': const [],
        'blockedByYou': true,
      };
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      expect(find.text('Opphev blokkeringen'), findsOneWidget);

      await tester.tap(find.text('Opphev blokkeringen'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('DELETE /blocks/kari-1'));
    });

    testWidgets('16a reporting can block in the same gesture', (tester) async {
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();

      expect(find.text('Rapporter Kari N.'), findsOneWidget);
      expect(find.text('Svindel'), findsOneWidget);
      expect(find.text('Blokkér Kari N.'), findsOneWidget);

      await tester.tap(find.text('Blokkér Kari N.'));
      await tester.tap(find.text('Send rapport'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /reports'));
    });
  });

  group('06h · 06i · 09h after the trade', () {
    testWidgets('09h the completion screen states what changed hands', (tester) async {
      await mount(tester,
          TradeCompletedScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Byttet er gjennomført!'), findsOneWidget);
      expect(find.textContaining('Retro spillkonsoll er din'), findsOneWidget);
      expect(find.text('Vurder Kari'), findsOneWidget);
      expect(find.text('Senere'), findsOneWidget);
    });

    testWidgets('06h rating is about the counterparty',
        (tester) async {
      await mount(tester, ReviewScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Hvordan var byttet med Kari?'), findsOneWidget);
      expect(find.text('Vurderinger bygger tillit i Swaply.'), findsOneWidget);
      expect(find.text('★'), findsNWidgets(5));
    });

    testWidgets('06h the send button waits for a score', (tester) async {
      await mount(tester, ReviewScreen(trade: Trade.fromJson(FakeServer.trade)));

      final button = find.widgetWithText(FilledButton, 'Send vurdering');
      expect(tester.widget<FilledButton>(button).onPressed, isNull);

      await tester.tap(find.text('★').last);
      await tester.pump();
      expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
    });

    testWidgets('07l a chain asks about both people separately', (tester) async {
      await mount(tester, ReviewScreen(trade: Trade.fromJson(chainTrade())));

      expect(find.text('Ble byttet gjennomført?'), findsOneWidget);
      expect(find.textContaining('Vi var ikke med på dette byttet'), findsOneWidget);
      expect(find.text('Kari N.'), findsOneWidget);
      expect(find.text('Per H.'), findsOneWidget);
      expect(find.text('Byttet ble ikke noe av'), findsOneWidget);
    });

    testWidgets('06i feedback is about us, and «Ingenting» clears the rest',
        (tester) async {
      await mount(tester,
          AppFeedbackScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('Hvordan var det å bytte med Swaply?'), findsOneWidget);
      expect(find.text('Tungvint'), findsOneWidget);
      expect(find.text('Sømløst'), findsOneWidget);

      await tester.tap(find.text('Mellomlegg'));
      await tester.tap(find.text('Frakt'));
      await tester.pump();
      await tester.tap(find.text('Ingenting'));
      await tester.pump();

      final chip = tester.widget<FilterChip>(
          find.widgetWithText(FilterChip, 'Mellomlegg'));
      expect(chip.selected, isFalse);
    });
  });

  group('10b listing', () {
    testWidgets('the form has every field, and a service drops the condition',
        (tester) async {
      await mount(tester, const PostItemScreen());

      expect(find.text('Legg ut en gjenstand'), findsOneWidget);
      expect(find.text('Tittel'), findsOneWidget);
      expect(find.text('Anslått verdi'), findsOneWidget);
      expect(find.text('Helt billige ting kan være gratis'), findsOneWidget);
      expect(find.text('Tilstand'), findsOneWidget);
      expect(find.text('Kun by vises for andre'), findsOneWidget);

      await tester.tap(find.text('Tjeneste'));
      await tester.pump();
      expect(find.text('Tilstand'), findsNothing);
    });
  });

  group('invitations · the way in and the way out', () {
    testWidgets('04 the share button hands over the link and the line with it',
        (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));

      await tester.tap(find.byIcon(Icons.ios_share));
      await tester.pumpAndSettle();

      expect(find.text('Del Bosch drill 18V'), findsOneWidget);
      expect(
          find.textContaining('Se denne på Swaply: Bosch drill 18V, verdi 600 kr.'),
          findsOneWidget);
      // The sheet says what the link is, because it is a key and not a preview.
      expect(find.textContaining('kan brukes én gang'), findsOneWidget);
      expect(server.requests, contains('POST /items/item-drill/share'));
    });

    testWidgets('04 «Kopier lenke» puts the whole line on the clipboard',
        (tester) async {
      final copied = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied.add((call.arguments as Map)['text'] as String);
          }
          return null;
        },
      );
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));
      await tester.tap(find.byIcon(Icons.ios_share));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kopier lenke'));
      await tester.pumpAndSettle();

      expect(copied.single, contains('http://web/i/${FakeServer.shareToken}'));
      expect(copied.single, startsWith('Se denne på Swaply'));
    });

    testWidgets('16b the invitation row is an ordinary row that makes a link',
        (tester) async {
      await mount(tester, const SettingsScreen());

      await tester.tap(find.text('Inviter en venn'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Ola N. inviterer deg til Swaply'), findsOneWidget);
    });

    testWidgets('a link opened by somebody already signed in shows the listing',
        (tester) async {
      // The same link is an invitation to one person and a listing to another.
      // The second one landed on Oppdag with no sign of what their friend had
      // sent them, which is the dead end the token exists to remove.
      await session.login('ola@epost.no', 'passord');
      session.pendingInvite = FakeServer.shareToken;

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<SwaplyApi>.value(value: api),
            ChangeNotifierProvider<Session>.value(value: session),
          ],
          child: const MaterialApp(home: RootGate()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(find.text('Bosch drill 18V'), findsWidgets);
      expect(session.pendingInvite, isNull);
    });

    testWidgets('a link names who sent it, and looking around makes no profile',
        (tester) async {
      await mount(tester, const InviteScreen(token: FakeServer.shareToken),
          signedIn: false);

      expect(find.text('Ola N. inviterer deg til Swaply.'), findsOneWidget);
      expect(find.textContaining('Delt med deg: Bosch drill 18V'), findsOneWidget);

      await tester.tap(find.text('Se deg rundt'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /auth/anonymous'));
      // 02 first: Oppdag is one row per interest, and this account has none.
      expect(find.textContaining('Hva er du'), findsOneWidget);
      expect(session.signedIn, isTrue);
      expect(session.anonymous, isTrue);
      // Spent on the way in, so nothing is left to spend again.
      expect(session.pendingInvite, isNull);
    });

    testWidgets('a spent invitation says so and is not kept', (tester) async {
      server.overrides['GET /invites/${FakeServer.shareToken}'] = {
        'token': FakeServer.shareToken,
        'url': 'http://web/i/${FakeServer.shareToken}',
        'used': true,
        'inviter': {'displayName': 'Ola N.'},
        'item': null,
        'shareText': 'Ola N. inviterer deg til Swaply.',
      };
      session.pendingInvite = FakeServer.shareToken;

      await mount(tester, const InviteScreen(token: FakeServer.shareToken),
          signedIn: false);

      expect(find.textContaining('allerede brukt'), findsOneWidget);
      expect(session.pendingInvite, isNull);
    });

    testWidgets('looking around has no profile to show, and says what it is',
        (tester) async {
      await session.lookAround();
      // The profile screen asks the server who you are on the way in.
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await mount(tester, const ProfileScreen(), signedIn: false);

      expect(find.text('Du ser deg rundt'), findsOneWidget);
      expect(find.textContaining('du beholder alt du har likt'), findsOneWidget);
      expect(find.text('Lag profil'), findsOneWidget);
    });

    testWidgets('10b listing something asks for the profile first', (tester) async {
      await session.lookAround();
      await mount(tester, const PostItemScreen(), signedIn: false);

      // The button says «Neste» rather than «Legg ut»: there is a step in front.
      expect(find.text('Neste'), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      await tester.pumpAndSettle();

      expect(find.text('Lag profil og legg ut'), findsOneWidget);
      expect(
          find.textContaining('kontoen du allerede ser deg rundt med'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /items')));
    });

    testWidgets('…and then actually lists it', (tester) async {
      // «Lag profil og legg ut» is a promise about two things. Making the
      // profile used to replace the whole stack, which threw away the
      // half-filled listing behind it: the account was made and nothing was
      // ever listed.
      await session.lookAround();
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await mount(tester, const PostItemScreen(), signedIn: false);

      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      await tester.pumpAndSettle();

      for (final (field, text) in [
        (0, 'Ola N.'),
        (1, 'ola@epost.no'),
        (2, '412 34 567'),
        (3, 'drillbits123'),
      ]) {
        await tester.enterText(find.byType(TextField).at(field), text);
      }
      await tester.tap(find.text('Lag profil og legg ut'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /auth/register'));
      expect(server.requests, contains('POST /items'));
      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
    });
  });

  group('04 your own listing', () {
    testWidgets('can be edited and taken down, which is the rest of the CRUD',
        (tester) async {
      // A listing could be posted and then never touched again: no edit, no
      // remove, and the «⋯» offered to report your own thing.
      server.overrides['PATCH /items/item-mine'] = {...FakeServer.drill, 'id': 'item-mine'};
      await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      expect(find.text('Rapporter'), findsNothing);
      expect(find.text('Fjern annonsen'), findsOneWidget);

      await tester.tap(find.text('Rediger annonsen'));
      await tester.pumpAndSettle();

      expect(find.text('Lagre endringene'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, 'Bosch drill 18V med koffert');
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      expect(server.bodies['PATCH /items/item-mine']!['title'],
          'Bosch drill 18V med koffert');
    });

    testWidgets('and taking it down asks first', (tester) async {
      server.overrides['DELETE /items/item-mine'] = <String, Object?>{};
      await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Den forsvinner fra Oppdag'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('DELETE /items/item-mine'));
    });

    testWidgets('offers nothing the server would refuse', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));

      expect(find.text('Dette er din egen ting. Slik ser andre den.'), findsOneWidget);
      // Both of these are refused with «Dette er din egen gjenstand».
      expect(find.byIcon(Icons.favorite_border), findsNothing);
      expect(find.textContaining('Skriv en melding'), findsNothing);
      // The share button stays: sending your own listing to somebody is the
      // whole point of it.
      expect(find.byIcon(Icons.ios_share), findsOneWidget);
    });
  });

  group('10b photographs', () {
    testWidgets('a picked photo is uploaded and shown in the strip', (tester) async {
      await mount(
        tester,
        PostItemScreen(pickImage: () async => const PickedPhoto([1, 2, 3], 'drill.jpg')),
      );

      expect(find.text('Legg til bilder'), findsOneWidget);
      await tester.tap(find.text('Legg til bilder'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /media'));
      // The strip draws the URL the server handed back, and the first one is
      // the cover.
      final image = tester.widget<Image>(find.byType(Image).first).image as NetworkImage;
      expect(image.url, 'http://test/media/${FakeServer.storedPhoto}');
      expect(find.text('Forside'), findsOneWidget);
    });

    testWidgets('the listing is created with the path, not the URL', (tester) async {
      await mount(
        tester,
        PostItemScreen(pickImage: () async => const PickedPhoto([1, 2, 3], 'drill.jpg')),
      );

      await tester.tap(find.text('Legg til bilder'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Bosch drill 18V');
      await tester.pump();
      // «Legg ut» is also a tab in the bottom bar, so aim at the button.
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /items']!['media'], ['/media/${FakeServer.storedPhoto}']);
    });

    testWidgets('a refused upload says why and adds nothing', (tester) async {
      server.overrides['POST /media'] = 413;
      await mount(
        tester,
        PostItemScreen(pickImage: () async => const PickedPhoto([1, 2, 3], 'huge.jpg')),
      );

      await tester.tap(find.text('Legg til bilder'));
      await tester.pumpAndSettle();

      expect(find.text('Forside'), findsNothing);
      expect(find.text('Bildet er for stort. Grensen er 10 MB.'), findsOneWidget);
    });
  });
}
