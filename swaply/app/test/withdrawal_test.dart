// The banners of a withdrawal: 08b while the question is open, 08c when it
// was asked too late.
//
// 08c, «Du kan ikke trekke deg», was drawn for everybody in the trade once a
// question had been turned down because something was sent — so the person
// who had answered was told they could not withdraw, and the banner stayed
// on the trade after it ended. And both banners named the person you receive
// from, who in a ring of three is not always the one who asked, nor the one
// who sent. The server says who asked (`withdrawal.requestedBy`), and the
// participants say who has sent.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, String tradeId) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(home: TradeDetailScreen(tradeId: tradeId)),
    ),
  );
  await tester.pumpAndSettle();
}

/// A question about getting out, as the trade view carries it.
Map<String, Object?> question({
  required String by,
  String state = 'waiting',
  bool blockedBySent = false,
}) =>
    {
      'id': 'w1',
      'requestedBy': by,
      'byYou': by == 'me-1',
      'state': state,
      'respondsBy': state == 'waiting'
          ? DateTime.now().add(const Duration(days: 2, hours: 14)).toIso8601String()
          : null,
      'blockedBySent': blockedBySent,
    };

/// The pair, in [state], with [withdrawal] on it.
void pair(String state, Map<String, Object?> withdrawal, [Map<String, Object?> more = const {}]) =>
    server.overrides['GET /trades/trade-1'] = {
      ...FakeServer.trade,
      'state': state,
      'withdrawal': withdrawal,
      ...more,
    };

/// The ring of three — you, Kari whom you receive from, and Per — in
/// [state], with [withdrawal] on it.
void ring(String state, Map<String, Object?> withdrawal, {String? perSent}) {
  final trade = chainTrade();
  server.overrides['GET /trades/trade-chain'] = {
    ...trade,
    'state': state,
    'withdrawal': withdrawal,
    'participants': [
      for (final p in trade['participants'] as List)
        if ((p as Map)['id'] == 'per-1') {...p, 'sentAt': perSent} else p,
    ],
  };
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('08b, while the question is open', () {
    testWidgets('1. asked by Kari in a pair, it names Kari and asks you', (tester) async {
      pair('paused', question(by: 'kari-1'));
      await mount(tester, 'trade-1');

      expect(find.text('Kari vil trekke seg'), findsOneWidget);
      expect(find.text('Ja, greit'), findsOneWidget);
      expect(find.text('Nei'), findsOneWidget);
    });

    testWidgets('2. asked by Per in a ring, it names Per, not Kari whom you receive from',
        (tester) async {
      ring('paused', question(by: 'per-1'));
      await mount(tester, 'trade-chain');

      expect(find.text('Per vil trekke seg'), findsOneWidget);
      expect(find.textContaining('Per har bedt om å trekke seg'), findsOneWidget);
      expect(find.text('Kari vil trekke seg'), findsNothing);
    });

    testWidgets('3. asked by you in a pair, it is Kari who is asked', (tester) async {
      pair('paused', question(by: 'me-1'));
      await mount(tester, 'trade-1');

      expect(find.text('Vi hører med Kari'), findsOneWidget);
      expect(
          find.text('Byttet er pauset mens Kari svarer på om det er greit at du trekker deg.'),
          findsOneWidget);
      expect(find.text('Ja, greit'), findsNothing);
      expect(find.text('Angre forespørselen'), findsOneWidget);
    });

    testWidgets('4. asked by you in a ring, both are asked, and the first answer decides',
        (tester) async {
      ring('paused', question(by: 'me-1'));
      await mount(tester, 'trade-chain');

      expect(find.text('Vi hører med Kari og Per'), findsOneWidget);
      expect(
          find.text('Byttet er pauset til en av dem svarer på om det er greit at du trekker deg.'),
          findsOneWidget);
    });
  });

  group('08c, asked too late', () {
    testWidgets('5. is said to the one who asked, while the trade carries on', (tester) async {
      pair('accepted', question(by: 'me-1', state: 'rejected', blockedBySent: true));
      await mount(tester, 'trade-1');

      expect(find.text('Du kan ikke trekke deg'), findsOneWidget);
      expect(find.textContaining('Kari har allerede sendt sin ting.'), findsOneWidget);
    });

    testWidgets('6. …and not to the one who answered it', (tester) async {
      pair('accepted', question(by: 'kari-1', state: 'rejected', blockedBySent: true));
      await mount(tester, 'trade-1');

      expect(find.text('Du kan ikke trekke deg'), findsNothing);
    });

    testWidgets('7. …nor once the trade is over', (tester) async {
      pair('completed', question(by: 'me-1', state: 'rejected', blockedBySent: true), {
        'closedAt': '2026-09-04T12:00:00Z',
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      });
      await mount(tester, 'trade-1');

      expect(find.text('Du kan ikke trekke deg'), findsNothing);
    });

    testWidgets('8. in a ring it names whoever has sent', (tester) async {
      ring('accepted', question(by: 'me-1', state: 'rejected', blockedBySent: true),
          perSent: '2026-09-08T10:00:00Z');
      await mount(tester, 'trade-chain');

      expect(find.text('Du kan ikke trekke deg'), findsOneWidget);
      expect(find.textContaining('Per har allerede sendt sin ting.'), findsOneWidget);
    });
  });
}
