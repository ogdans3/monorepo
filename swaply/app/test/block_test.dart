// A block takes the blocked person off the screen it was made on.
//
// Reporting and blocking are one gesture (16a), and it can be made from four
// places: the long press on a card, «⋯» on a listing, «⋯» on a profile and
// «Rapporter et problem» on a finished trade. Only the long press asked for
// anything again once the block had landed, so from the other three the
// person's listing, their things and their trade stayed on screen after
// somebody had asked never to see them. Across a block the server has no such
// listing for you, keeps the profile readable so the block can be taken back,
// and leaves the trade as it was. So the listing's page goes, the profile is
// asked for again and shows the block, and the trade is asked for again —
// each once the server has taken the report, never as the sheet closes, and
// never for a report that did not block.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// Whether the server has Kari blocked for this account, as it answers.
late bool blocked;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

/// «⋯», the report sheet, the block ticked or not, and «Send rapport».
Future<void> report(WidgetTester tester, {required bool block}) async {
  await tester.tap(find.byIcon(Icons.more_horiz));
  await tester.pumpAndSettle();
  if (block) await tester.tap(find.text('Blokkér Kari N.'));
  await tester.pump();
  await tester.tap(find.text('Send rapport'));
  await tester.pumpAndSettle();
}

String toast(WidgetTester tester) => tester.widget<SwaplyToast>(find.byType(SwaplyToast)).message;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    blocked = false;

    // What the server answers once the block is written: none of Kari's
    // things on Oppdag, no such listing by id, and her profile still there
    // with nothing of hers on it.
    server.overrides['POST /reports'] = (http.Request request) {
      if ((jsonDecode(request.body) as Map)['block'] == true) blocked = true;
      return {'ok': true, 'blocked': blocked};
    };
    server.overrides['GET /discover'] = (http.Request _) => {
          'total': blocked ? 1 : 2,
          'items': [FakeServer.drill, if (!blocked) FakeServer.console],
        };
    server.overrides['GET /items/item-console'] = (http.Request _) => blocked
        ? const Refusal(404, 'not_found', 'Fant ikke gjenstanden.')
        : {...FakeServer.console, 'owner': FakeServer.kari};
    server.overrides['GET /users/kari-1'] = (http.Request _) => {
          ...FakeServer.kari,
          'items': [if (!blocked) FakeServer.console],
          'interests': const <String>[],
          'blockedByYou': blocked,
        };
  });

  group('04, a listing', () {
    testWidgets('1. a block from «⋯» takes the page away, and the grid under it asks again',
        (tester) async {
      await mount(tester, const DiscoverScreen());
      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pumpAndSettle();
      expect(find.byType(ItemDetailScreen), findsOneWidget);
      final discovered = server.asked('GET /discover');

      await report(tester, block: true);

      expect(server.bodies['POST /reports']?['block'], isTrue);
      expect(find.byType(ItemDetailScreen), findsNothing);
      // The grid under it, asked for again, without Kari's things.
      expect(server.asked('GET /discover'), discovered + 1);
      expect(find.text('Retro spillkonsoll'), findsNothing);
      expect(find.text('Bosch drill 18V'), findsOneWidget);
      // One sentence says why the page went.
      expect(toast(tester), 'Takk. Vi ser på rapporten. Kari er blokkert.');
    });

    testWidgets('2. a report without a block leaves the listing where it is', (tester) async {
      await mount(tester, const DiscoverScreen());
      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pumpAndSettle();

      await report(tester, block: false);

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(toast(tester), 'Takk. Vi ser på rapporten.');
    });

    testWidgets('3. a report the server never heard takes nothing away', (tester) async {
      await mount(tester, const DiscoverScreen());
      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pumpAndSettle();
      server.overrides['POST /reports'] = unreachable;

      await report(tester, block: true);

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(toast(tester), noContact);
    });

    testWidgets('4. blocked from its owner\'s profile, the listing goes when it is come back to',
        (tester) async {
      await mount(tester, const DiscoverScreen());
      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se profil ›'));
      await tester.pumpAndSettle();
      expect(find.byType(OtherProfileScreen), findsOneWidget);

      await report(tester, block: true);
      await tester.tap(find.bySemanticsLabel('Tilbake'));
      await tester.pumpAndSettle();

      // Past the listing, which is gone for this account, to the grid.
      expect(find.byType(OtherProfileScreen), findsNothing);
      expect(find.byType(ItemDetailScreen), findsNothing);
      expect(find.text('Retro spillkonsoll'), findsNothing);
      // Quietly: no «Fant ikke gjenstanden» over the grid.
      expect(find.text('Fant ikke gjenstanden.'), findsNothing);
    });
  });

  group('13b, a profile', () {
    testWidgets('5. a block from «⋯» asks for the profile again, which shows the block',
        (tester) async {
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'));
      expect(find.text('Retro spillkonsoll'), findsOneWidget);
      final asked = server.asked('GET /users/kari-1');

      await report(tester, block: true);

      expect(server.asked('GET /users/kari-1'), asked + 1);
      // It stays: this is where a block is taken back.
      expect(find.byType(OtherProfileScreen), findsOneWidget);
      expect(find.text('Retro spillkonsoll'), findsNothing);
      expect(find.textContaining('Du har blokkert Kari.'), findsOneWidget);
      expect(toast(tester), 'Takk. Vi ser på rapporten. Kari er blokkert.');

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      expect(find.text('Opphev blokkeringen'), findsOneWidget);
    });

    testWidgets('6. a report without a block asks for nothing', (tester) async {
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'));
      final asked = server.asked('GET /users/kari-1');

      await report(tester, block: false);

      expect(server.asked('GET /users/kari-1'), asked);
      expect(find.text('Retro spillkonsoll'), findsOneWidget);
    });
  });

  group('06b, a finished trade', () {
    setUp(() {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'completed',
        'closedAt': '2026-09-04T12:00:00Z',
        'yourReview': {'score': 5, 'comment': 'Rask og hyggelig'},
      };
    });

    Future<void> reportTheTrade(WidgetTester tester, {required bool block}) async {
      final button = find.text('Rapporter et problem med byttet');
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
      if (block) await tester.tap(find.text('Blokkér Kari N.'));
      await tester.pump();
      await tester.tap(find.text('Send rapport'));
      await tester.pumpAndSettle();
    }

    testWidgets('7. a block from «Rapporter et problem» asks for the trade again, quietly',
        (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      final asked = server.asked('GET /trades/trade-1');

      await reportTheTrade(tester, block: true);

      expect(server.bodies['POST /reports']?['targetUser'], 'kari-1');
      expect(server.asked('GET /trades/trade-1'), asked + 1);
      expect(toast(tester), 'Takk. Vi ser på rapporten. Kari er blokkert.');
    });

    testWidgets('8. a report without a block asks for nothing', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      final asked = server.asked('GET /trades/trade-1');

      await reportTheTrade(tester, block: false);

      expect(server.asked('GET /trades/trade-1'), asked);
    });
  });
}
