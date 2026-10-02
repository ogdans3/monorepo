// A ring of three is arranged in its chat, and the app is not part of it.
//
// Three places led nowhere. The proposal chips in a ring's chat each opened a
// sheet that proposes to the one person you receive from — there is no offer
// to counter in a ring — so every tap ended in a toast. «Marker byttet som
// gjennomført» looked the same once pressed as before, and never said whose
// press was still missing. And «Byttet ble ikke noe av» on 07l closed the
// screen and told nobody anything.
//
// The chips are gone from a ring's chat. Once pressed, the ring says who it
// waits on. 07l is reached once all three have marked the ring done, when
// nothing can be freed any more, so «Byttet ble ikke noe av» asks whom it
// concerns and opens the report sheet for them; and since it no longer
// leaves, 07l has the «Senere» its export draws at the top.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// [screen] opened over a first page, so it has somewhere to go back to.
Future<void> open(WidgetTester tester, Widget screen) async {
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
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () =>
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen)),
                child: const Text('Først'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Først'));
  await tester.pumpAndSettle();
}

/// The ring, accepted by all three, with the sent and received marks of
/// [marked] set — what «Marker byttet som gjennomført» sets for each.
Map<String, Object?> ring({Set<String> marked = const {}}) {
  final trade = chainTrade();
  const at = '2026-09-09T10:00:00Z';
  return {
    ...trade,
    'state': 'accepted',
    'you': {
      ...trade['you'] as Map,
      'accepted': true,
      'sentAt': marked.contains('me-1') ? at : null,
      'receivedAt': marked.contains('me-1') ? at : null,
    },
    'participants': [
      for (final p in trade['participants'] as List)
        {
          ...p as Map<String, Object?>,
          'accepted': true,
          'sentAt': marked.contains(p['id']) ? at : null,
          'receivedAt': marked.contains(p['id']) ? at : null,
        },
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

  testWidgets('1. a ring\'s chat has no proposal chips, only its field', (tester) async {
    server.overrides['GET /threads/thread-1'] = {
      ...FakeServer.thread,
      'kind': 'chain',
      'participants': [
        {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
        {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
        {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
      ],
    };
    server.overrides['GET /trades/trade-1'] = chainTrade();
    await open(tester, const ThreadScreen(threadId: 'thread-1'));

    expect(find.text('♥ Jeg vil ha'), findsNothing);
    expect(find.text('Foreslå ting'), findsNothing);
    expect(find.text('Foreslå mellomlegg'), findsNothing);
    // The field is still there: a ring is agreed in words.
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('2. pressed, «Marker byttet som gjennomført» says whose press is missing',
      (tester) async {
    server.overrides['GET /trades/trade-chain'] = ring();
    server.overrides['POST /trades/trade-chain/complete'] = ring(marked: {'me-1', 'kari-1'});
    await open(tester, const TradeDetailScreen(tradeId: 'trade-chain'));

    await tester.tap(find.text('Marker byttet som gjennomført'));
    await tester.pumpAndSettle();

    expect(server.asked('POST /trades/trade-chain/complete'), 1);
    expect(find.text('Marker byttet som gjennomført'), findsNothing);
    expect(find.text('Du har markert byttet som gjennomført. Venter på Per.'), findsOneWidget);
  });

  testWidgets('3. …and names both while neither of the others has pressed it', (tester) async {
    server.overrides['GET /trades/trade-chain'] = ring(marked: {'me-1'});
    await open(tester, const TradeDetailScreen(tradeId: 'trade-chain'));

    expect(find.text('Du har markert byttet som gjennomført. Venter på Kari og Per.'),
        findsOneWidget);
  });

  group('07l', () {
    Trade completed() => Trade.fromJson(
        {...ring(marked: {'me-1', 'kari-1', 'per-1'}), 'state': 'completed'});

    testWidgets('4. asks whether it happened, with «Ja, send vurdering» and a «Senere»',
        (tester) async {
      await open(tester, ReviewScreen(trade: completed()));

      expect(find.text('Ble byttet gjennomført?'), findsOneWidget);
      expect(find.text('Ja, send vurdering'), findsOneWidget);
      await tester.tap(find.text('Senere'));
      await tester.pumpAndSettle();
      expect(find.byType(ReviewScreen), findsNothing);
    });

    testWidgets('5. «Byttet ble ikke noe av» asks whom it concerns, and reports them',
        (tester) async {
      await open(tester, ReviewScreen(trade: completed()));

      await tester.tap(find.text('Byttet ble ikke noe av'));
      await tester.pumpAndSettle();
      // Not gone: the question is still open, and nobody has been told.
      expect(find.byType(ReviewScreen), findsOneWidget);
      expect(find.text('Hvem gjelder det?'), findsOneWidget);

      await tester.tap(find.text('Per H.').last);
      await tester.pumpAndSettle();
      expect(find.text('Rapporter Per H.'), findsOneWidget);
      await tester.tap(find.text('Send rapport'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /reports']?['targetUser'], 'per-1');
      // Rating is still there to do, or «Senere».
      expect(find.byType(ReviewScreen), findsOneWidget);
    });

    testWidgets('6. …and closing the question asks nothing', (tester) async {
      await open(tester, ReviewScreen(trade: completed()));

      await tester.tap(find.text('Byttet ble ikke noe av'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Avbryt'));
      await tester.pumpAndSettle();

      expect(find.text('Hvem gjelder det?'), findsNothing);
      expect(server.asked('POST /reports'), 0);
      expect(find.byType(ReviewScreen), findsOneWidget);
    });
  });
}
