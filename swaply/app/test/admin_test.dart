// The test tooling, and the two things it must never get wrong.
//
// It is a section the export never drew, in an app whose every other screen is
// drawn — so the first half of this file is about **absence**: an ordinary
// account's Innstillinger has to end exactly where round 5 ends it, with no
// group, no row, no badge and no hint that there is anything else.
//
// The second half is about the state a tool like this makes possible and that
// nothing else in the product can: being somebody who is not you. That is the
// state most easily forgotten, so it is drawn on every screen from server
// truth, and the way back is always one tap away.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/admin.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/admin_chrome.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// Mounted the way `main.dart` mounts the app: the floor is wired into the
/// `MaterialApp` builder, so a test that puts a screen in without it would be
/// testing a different app.
Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = true}) async {
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
        onGenerateRoute: (settings) => MaterialPageRoute(
            settings: settings,
            builder: (_) => Scaffold(body: Center(child: Text(settings.name ?? '')))),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: AdminFloor(child: child!),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Sign in as somebody the server says holds the key.
void asAdmin() {
  server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.admin};
  server.overrides['GET /me'] = FakeServer.admin;
}

/// Sign in as a test account, on a session the switcher minted.
void asActingTestAccount() {
  server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.actingAsTest};
  server.overrides['GET /me'] = FakeServer.actingAsTest;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('for everybody else it is not there', () {
    testWidgets('16b ends where round 5 ends it', (tester) async {
      await mount(tester, const SettingsScreen());

      // Exactly the export: KONTO, VARSLER, the legal row and «Logg ut».
      expect(find.text('VARSLER'), findsOneWidget);
      expect(find.text('Logg ut'), findsOneWidget);
      expect(find.text('ADMIN'), findsNothing);
      expect(find.text('Testverktøy'), findsNothing);
      expect(find.byType(AdminBadge), findsNothing);
    });

    testWidgets('13 carries no badge, and the floor is not drawn', (tester) async {
      await mount(tester, const ProfileScreen());

      expect(find.text('Ola N.'), findsWidgets);
      expect(find.byType(AdminBadge), findsNothing);
      expect(find.textContaining('ikke deg selv'), findsNothing);
    });

    testWidgets('04 offers no way to make somebody want a thing', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      expect(find.text('Få noen til å ville ha denne'), findsNothing);
    });

    testWidgets('and the trade screen has only the product’s own buttons', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Som motparten'), findsNothing);
      expect(find.textContaining('godtar'), findsNothing);
    });
  });

  group('for the one account that holds the key', () {
    testWidgets('16b says what it is, in its own colours', (tester) async {
      asAdmin();
      await mount(tester, const SettingsScreen());

      // Three separate things say «admin» before a finger reaches the row: the
      // kicker, the badge beside it and the subtitle under the row itself.
      expect(find.text('ADMIN'), findsOneWidget);
      expect(find.text('KUN FOR DEG'), findsOneWidget);
      expect(find.text('Testverktøy'), findsOneWidget);
      expect(find.text('Kontoer · bygg et bytte · tilstand'), findsOneWidget);
      // And it says whose account you are on right now, before you switch.
      expect(find.text('Du er Ola N.'), findsOneWidget);
    });

    testWidgets('13 wears the badge beside the name', (tester) async {
      asAdmin();
      await mount(tester, const ProfileScreen());

      expect(find.text('ADMIN'), findsOneWidget);
    });

    testWidgets('the tool opens on the ring of accounts', (tester) async {
      asAdmin();
      await mount(tester, const AdminScreen());

      expect(find.text('Testverktøy'), findsOneWidget);
      expect(find.text('KONTOER'), findsOneWidget);
      expect(find.text('Testbruker Én'), findsOneWidget);
      expect(find.textContaining('2 ting'), findsOneWidget);
      expect(find.text('Lag testkonto'), findsOneWidget);
      // Every named state the trade screen draws, as a chip.
      expect(find.text('Motbytte mottatt'), findsOneWidget);
      expect(find.text('Pauset — noen vil trekke seg'), findsOneWidget);
    });

    testWidgets('making one asks the server, and says what it made', (tester) async {
      asAdmin();
      await mount(tester, const AdminScreen());

      await tester.tap(find.text('Lag testkonto'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /admin/accounts'));
      expect(find.textContaining('Lagde Testbruker To'), findsOneWidget);
    });

    testWidgets('«Nullstill likes» brings 10a back, and nothing else does', (tester) async {
      // The phone remembers the highest count it showed 10a at, per account,
      // so a heart taken back and given again does not ask twice. Resetting
      // likes starts the server's count over, and the sheet has to come with
      // it or the tool cannot walk 10a a second time.
      asAdmin();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('listingPromptShownAt:test-1', 15);
      await mount(tester, const AdminScreen());

      Future<void> reset(String lever) async {
        await tester.tap(find.byTooltip('Nullstill eller slett'));
        await tester.pumpAndSettle();
        await tester.tap(find.text(lever));
        await tester.pumpAndSettle();
      }

      await reset('Nullstill gjenstander');
      expect(prefs.getInt('listingPromptShownAt:test-1'), 15);

      await reset('Nullstill likes');
      expect(server.bodies['POST /admin/accounts/test-1/reset'], {
        'parts': ['likes'],
      });
      expect(prefs.getInt('listingPromptShownAt:test-1'), isNull);
    });

    testWidgets('building a trade goes through the product’s own buttons', (tester) async {
      asAdmin();
      await mount(tester, const AdminScreen());

      await tester.tap(find.text('Motbytte mottatt'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /admin/scenarios']!['state'], 'countered');
      // And it lands you on the trade it built, rather than telling you it
      // exists somewhere.
      expect(find.byType(TradeDetailScreen), findsOneWidget);
    });

    testWidgets('«Som motparten» sits at the foot of the trade screen', (tester) async {
      asAdmin();
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Som motparten'), findsOneWidget);
      await tester.tap(find.text('Kari godtar'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /admin/trades/trade-1/act'], {
        'as': FakeServer.kari['id'],
        'action': 'accept',
      });
    });

    testWidgets('«Få noen til å ville ha denne» is offered on your own listing only',
        (tester) async {
      // A test account wanting a stranger's thing puts the two of them in one
      // trade, one chat and one handover — the same failure hiding test
      // listings exists to prevent, arriving from the other direction. The
      // server refuses it, and a button that is always refused is not a button.
      asAdmin();
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      expect(find.text('Få noen til å ville ha denne'), findsNothing);
    });

    testWidgets('«Få noen til å ville ha denne» presses the real heart', (tester) async {
      asAdmin();
      await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));

      expect(find.text('Få noen til å ville ha denne'), findsOneWidget);
      await tester.tap(find.text('Velg konto'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Testbruker Én'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /admin/items/item-mine/want'], {'as': 'test-1'});
    });
  });

  group('being somebody who is not you', () {
    testWidgets('the floor is on every screen, and names both of you', (tester) async {
      asActingTestAccount();
      await mount(tester, const DiscoverScreen());

      expect(find.text('Du er Testbruker Én — ikke deg selv'), findsOneWidget);
      // Signed straight in as the test account, so there is no parked token to
      // go back to and the floor says the only way out there is. The named
      // door is asserted below, where a switch parked one.
      expect(find.text('Logg ut ↩'), findsOneWidget);
    });

    testWidgets('including the ones with no bottom nav', (tester) async {
      asActingTestAccount();
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));

      expect(find.text('Du er Testbruker Én — ikke deg selv'), findsOneWidget);
    });

    testWidgets('and the key does not come along', (tester) async {
      // The server answers 404 on every admin route for a switched session, and
      // the app must not offer a door the server would refuse.
      asActingTestAccount();
      await mount(tester, const SettingsScreen());

      expect(find.text('Testverktøy'), findsNothing);
      expect(find.text('ADMIN'), findsNothing);
    });

    testWidgets('the profile says out loud that this is a test account', (tester) async {
      asActingTestAccount();
      await mount(tester, const ProfileScreen());

      expect(find.text('TESTKONTO'), findsOneWidget);
    });

    testWidgets('becoming an account that has never picked interests shows 02',
        (tester) async {
      // «Nullstill interesser — skjerm 02 kommer igjen» is what the lever
      // promises. Emptying the column is half of it; the other half is that
      // somebody has to walk through the gate again to see the picker.
      asAdmin();
      await mount(tester, const AdminScreen());

      server.overrides['GET /me'] = {...FakeServer.actingAsTest, 'interests': const []};
      await tester.tap(find.text('Bli denne'));
      await tester.pumpAndSettle();

      expect(session.interestsPending, isTrue);
    });

    testWidgets('switching parks your own token and the floor gets you back',
        (tester) async {
      asAdmin();
      await mount(tester, const AdminScreen());
      expect(session.actingAs, isFalse);

      // Becoming somebody is a token the server minted, and the way back is a
      // token this app parked — so closing the app cannot strand you as Kari.
      server.overrides['GET /me'] = FakeServer.actingAsTest;
      await tester.tap(find.text('Bli denne'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /admin/accounts/test-1/session'));
      expect(api.token, 'tok-test-1');
      expect(session.actingAs, isTrue);
      expect(session.canReturnToAdmin, isTrue);
      expect(find.textContaining('Tilbake til Ola N.'), findsOneWidget);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('adminToken'), 'tok');

      server.overrides['GET /me'] = FakeServer.admin;
      await session.returnToAdmin();
      expect(api.token, 'tok');
      expect(session.actingAs, isFalse);
      expect(prefs.getString('adminToken'), isNull);
    });
  });
}
