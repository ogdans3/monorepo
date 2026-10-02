// An ended trade says why in the app's own words, and closes its
// conversation where there is nobody left to write to.
//
// The server ends a trade for two new reasons: somebody in it blocked
// another (`blocked`), and an owner took down a listing on the table
// (`listing_removed`). The card on 09f read the server's sentence for both,
// where it has words of its own for a deletion. The composer stayed open on a
// trade a deletion or a block had ended, so what was written there went to
// nobody; other ended conversations keep theirs, as how long one should live
// is an open question. Every ended trade but a deleted account's promised
// «Angret du? Du kan sende et nytt forslag fra samtalen.», which nothing in
// this build does. And a ring's chat went on telling its three to arrange
// the handover there after the ring had ended.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
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
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

/// The pair, ended with [code], as both the trade and its thread say it.
void endedWith(String code, {String reason = 'Byttet ble avsluttet'}) {
  server.overrides['GET /trades/trade-1'] = {
    ...FakeServer.trade,
    'state': 'cancelled',
    'closedAt': '2026-09-09T08:55:00Z',
    'closeCode': code,
    'closeReason': reason,
  };
  server.overrides['GET /threads/thread-1'] = {...FakeServer.thread, 'state': 'cancelled'};
}

/// The ring's conversation, its trade in [state].
void ringIn(String state) {
  server.overrides['GET /threads/thread-1'] = {
    ...FakeServer.thread,
    'state': state,
    'kind': 'chain',
    'banner': 'Swaply fasiliterer ikke dette byttet. Dere avtaler overlevering, mellomlegg og '
        'eventuell frakt selv i denne chatten.',
    'participants': [
      {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
      {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
      {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
    ],
  };
  server.overrides['GET /trades/trade-1'] = {...chainTrade(), 'id': 'trade-1', 'state': state};
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('the app\'s words for why', () {
    testWidgets('1. a block, without saying who blocked whom', (tester) async {
      endedWith('blocked', reason: 'Kari blokkerte Ola');
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Byttet er avsluttet'), findsOneWidget);
      expect(find.text('Byttet ble avsluttet etter en blokkering.'), findsOneWidget);
      expect(find.text('Kari blokkerte Ola'), findsNothing);
    });

    testWidgets('2. a listing taken down, true for its owner too', (tester) async {
      endedWith('listing_removed');
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('En av tingene i byttet ble tatt ned av eieren.'), findsOneWidget);
    });

    testWidgets('3. no ended trade promises a new proposal from the conversation',
        (tester) async {
      for (final code in ['declined', 'withdrawn_early', 'displaced', 'blocked']) {
        endedWith(code);
        await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
        expect(find.textContaining('Angret du?'), findsNothing, reason: code);
        expect(find.textContaining('nytt forslag'), findsNothing, reason: code);
      }
    });
  });

  group('the conversation of a trade nobody can answer in is closed', () {
    for (final (code, why) in [
      ('account_deleted', 'Samtalen er stengt fordi den andre i byttet slettet kontoen sin.'),
      ('blocked', 'Samtalen er stengt etter en blokkering.'),
    ]) {
      testWidgets('4. ended by $code, 06g has no field, and says why', (tester) async {
        endedWith(code);
        await mount(tester, const ThreadScreen(threadId: 'thread-1'));

        expect(find.byType(TextField), findsNothing);
        expect(find.text('Send'), findsNothing);
        expect(find.text(why), findsOneWidget);
        // What was said is still there to read.
        expect(find.text('Passer bra! Kl. 17?'), findsOneWidget);
      });

      testWidgets('5. ended by $code, the trade page has no field either', (tester) async {
        endedWith(code);
        await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

        expect(find.byType(TextField), findsNothing);
        expect(find.text('Samtalen er stengt.'), findsOneWidget);
      });
    }

    testWidgets('6. in a ring, it is one of the other two who deleted theirs', (tester) async {
      ringIn('cancelled');
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'closeCode': 'account_deleted',
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Samtalen er stengt fordi en av de andre i byttet slettet kontoen sin.'),
          findsOneWidget);
    });

    for (final code in ['declined', 'listing_removed']) {
      testWidgets('7. ended by $code, the conversation stays open', (tester) async {
        endedWith(code);
        await mount(tester, const ThreadScreen(threadId: 'thread-1'));

        expect(find.byType(TextField), findsOneWidget);
        expect(find.textContaining('Samtalen er stengt'), findsNothing);
      });
    }
  });

  group('a ring\'s banner', () {
    testWidgets('8. tells the three to arrange it there while it goes on', (tester) async {
      ringIn('accepted');
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.textContaining('Dere avtaler overlevering'), findsOneWidget);
    });

    for (final (state, words) in [
      ('cancelled', 'Byttet er avsluttet. Swaply var ikke part i det.'),
      ('completed', 'Byttet er gjennomført. Swaply var ikke part i det.'),
    ]) {
      testWidgets('9. once $state, says so, and still that Swaply was not part of it',
          (tester) async {
        ringIn(state);
        await mount(tester, const ThreadScreen(threadId: 'thread-1'));

        expect(find.text(words), findsOneWidget);
        expect(find.textContaining('Dere avtaler overlevering'), findsNothing);
      });
    }
  });
}
