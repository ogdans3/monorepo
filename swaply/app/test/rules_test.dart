// The decisions that erode first, as tests.
//
// `../CLAUDE.md` keeps a list of them, and the reason it exists is that every
// one of them is easy to undo by accident while making something else better.
// A screen test asserts that a screen says what the export says; these assert
// that the product still means what it decided to mean.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

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

  group('the heart is the whole product', () {
    testWidgets('it is on the face of the card, and tapping it is the wish',
        (tester) async {
      await mount(tester, const DiscoverScreen());

      expect(find.byIcon(Icons.favorite_border), findsWidgets);

      await tester.tap(find.byIcon(Icons.favorite_border).first);
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /items/item-drill/like'));
    });

    testWidgets('…and a screen reader can find it by name, which follows the wish',
        (tester) async {
      // A drawn circle alone is an unnamed button, so the one action on the
      // card that matters was the one nobody could ask for. The same two words
      // as the heart on the item page.
      final semantics = tester.ensureSemantics();
      var liked = false;
      server.overrides['GET /discover'] = (http.Request _) => {
            'total': 2,
            'items': [
              {...FakeServer.drill, 'likedByMe': liked},
              FakeServer.console,
            ],
          };
      server.overrides['POST /items/item-drill/like'] = (http.Request _) {
        liked = true;
        return {'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': 1};
      };
      await mount(tester, const DiscoverScreen());

      final heart = find.descendant(
          of: find.byKey(const ValueKey('item-drill')),
          matching: find.bySemanticsLabel('Jeg vil ha'));
      expect(heart, findsOneWidget);
      expect(
          tester.getSemantics(heart),
          matchesSemantics(
              label: 'Jeg vil ha', isButton: true, hasTapAction: true));

      await tester.tap(heart);
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /items/item-drill/like'));
      expect(
          find.descendant(
              of: find.byKey(const ValueKey('item-drill')),
              matching: find.bySemanticsLabel('Du vil ha denne')),
          findsOneWidget);
      semantics.dispose();
    });

    testWidgets('long press keeps the rare actions, and the heart is not among them',
        (tester) async {
      // Round 4 hid the heart behind a long press and that was the single
      // biggest problem with the round. What is behind it now is the three
      // things you do once a month.
      await mount(tester, const DiscoverScreen());

      await tester.longPress(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();

      expect(find.text('Ikke vis meg slike'), findsOneWidget);
      expect(find.text('Se profil'), findsOneWidget);
      expect(find.text('Rapporter'), findsOneWidget);
      expect(find.text('Jeg vil ha'), findsNothing);
    });
  });

  group('two reds, and they must never collapse into one value', () {
    test('coral is the no, and the stronger red is report and block', () {
      expect(SwaplyColors.coral, const Color(0xFFFF6B5E));
      expect(SwaplyColors.red, const Color(0xFFE5484D));
      expect(SwaplyColors.coral, isNot(SwaplyColors.red));
    });

    test('and nothing else in the palette has quietly become either of them', () {
      // The failure this is for is a third red drifting into one of the two
      // values and making the pair meaningless without changing either line.
      final others = {
        'badge': SwaplyColors.badge,
        'redText': SwaplyColors.redText,
        'declineLine': SwaplyColors.declineLine,
        'amber': SwaplyColors.amber,
      };
      for (final entry in others.entries) {
        expect(entry.value, isNot(SwaplyColors.coral), reason: entry.key);
        expect(entry.value, isNot(SwaplyColors.red), reason: entry.key);
      }
    });
  });

  group('the unread badge', () {
    testWidgets('counts what is waiting', (tester) async {
      await mount(tester, const DiscoverScreen());

      // Two unread messages on Chats, one trade waiting on you under Bytter.
      expect(find.text('2'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('and at zero shows nothing, not a zero', (tester) async {
      // «At zero it shows nothing, not a zero» — docs/DESIGN.md. A nav bar
      // wearing two noughts tells you about the absence of news.
      final quiet = {...FakeServer.me, 'unreadMessages': 0, 'tradesNeedingYou': 0};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': quiet};
      server.overrides['GET /me'] = quiet;
      await mount(tester, const DiscoverScreen());

      expect(find.text('0'), findsNothing);
    });
  });

  group('a number is a fact about a thing, and is written once', () {
    test('«Verdi 2 500 kr», with a plain space and no decimals', () {
      expect(kr(2500), '2 500 kr');
      expect(kr(600), '600 kr');
      expect(kr(1200000), '1 200 000 kr');
      expect(kr(0), '0 kr');
    });

    test('and nothing at all when there is no value', () {
      // A listing may be free, or simply not have a number on it. «null kr» is
      // the bug this is for.
      expect(kr(null), '');
    });
  });

  group('an unclaimed device may look and wish, and nothing else', () {
    testWidgets('the heart is open to it', (tester) async {
      await session.lookAround();
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'),
          signedIn: false);

      await tester.tap(find.byIcon(Icons.favorite_border).last);
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /items/item-console/like'));
    });

    testWidgets('writing the first message is where the profile comes in',
        (tester) async {
      // A trade has two named people in it, so this is the moment a device
      // becomes a person — and nothing is sent until it has.
      await session.lookAround();
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'),
          signedIn: false);

      await tester.enterText(
          find.widgetWithText(TextField, 'Skriv en melding til Kari…'), 'Hei!');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(find.byType(CreateProfileScreen), findsOneWidget);
      expect(server.requests, isNot(contains('POST /items/item-console/message')));
    });
  });
}
