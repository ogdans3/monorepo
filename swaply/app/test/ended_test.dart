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

/// Why the server says the conversation is closed after a pair's trade
/// ended with [code]: a deletion leaves nobody, a block stands between the
/// two, and any other ending leaves it open.
String? closedAfter(String code) => switch (code) {
      'account_deleted' => 'deleted',
      'blocked' => 'blocked',
      _ => null,
    };

/// The pair, ended with [code], as both the trade and its thread say it.
void endedWith(String code, {String reason = 'Byttet ble avsluttet'}) {
  server.overrides['GET /trades/trade-1'] = {
    ...FakeServer.trade,
    'state': 'cancelled',
    'closedAt': '2026-09-09T08:55:00Z',
    'closeCode': code,
    'closeReason': reason,
    'conversationClosed': closedAfter(code),
  };
  server.overrides['GET /threads/thread-1'] = {
    ...FakeServer.thread,
    'state': 'cancelled',
    'closed': closedAfter(code),
  };
}

/// [answer] as a server from before it said whether a conversation is
/// closed: no `closed`, no `conversationClosed`.
Map<String, Object?> unsaid(String route) =>
    {...server.overrides[route]! as Map<String, Object?>}
      ..remove('closed')
      ..remove('conversationClosed');

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
        expect(find.text(why), findsOneWidget);
      });

      testWidgets('5b. ended by $code, from a server that does not say: the same, read off the ending',
          (tester) async {
        endedWith(code);
        server.overrides['GET /trades/trade-1'] = unsaid('GET /trades/trade-1');
        server.overrides['GET /threads/thread-1'] = unsaid('GET /threads/thread-1');
        await mount(tester, const ThreadScreen(threadId: 'thread-1'));
        expect(find.byType(TextField), findsNothing);
        expect(find.text(why), findsOneWidget);

        await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
        expect(find.byType(TextField), findsNothing);
        expect(find.text('Samtalen er stengt.'), findsOneWidget);
      });
    }

    // A block ends no finished or agreed trade, so nothing about how the
    // trade stands said the two could no longer write to each other: the
    // field stayed until the first «Send» was refused. The server says it
    // with the conversation now, and the field gives way before anything
    // is typed.
    testWidgets('5c. a finished trade across a block: no field on 06g, said before «Send»',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'completed',
        'conversationClosed': 'blocked',
      };
      server.overrides['GET /threads/thread-1'] = {
        ...FakeServer.thread,
        'state': 'completed',
        'closed': 'blocked',
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.byType(TextField), findsNothing);
      expect(find.text('Samtalen er stengt etter en blokkering.'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /threads/thread-1/messages')));
    });

    testWidgets('5d. …nor on the trade page\'s card', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'completed',
        'conversationClosed': 'blocked',
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.byType(TextField), findsNothing);
      expect(find.text('Samtalen er stengt etter en blokkering.'), findsOneWidget);
    });

    testWidgets('5e. a block lifted since leaves the conversation open, whatever ended the trade',
        (tester) async {
      endedWith('blocked');
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'conversationClosed': null,
      };
      server.overrides['GET /threads/thread-1'] = {
        ...server.overrides['GET /threads/thread-1']! as Map<String, Object?>,
        'closed': null,
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.byType(TextField), findsOneWidget);
      expect(find.textContaining('Samtalen er stengt'), findsNothing);
    });

    // The people in a conversation who have deleted their account come with
    // no name, as `GET /threads/:id` sends them.
    void gone(Set<String> ids) {
      final thread = server.overrides['GET /threads/thread-1']! as Map<String, Object?>;
      final participants = [
        for (final p in thread['participants']! as List)
          ids.contains((p as Map)['id']) ? {...p, 'displayName': null} : p,
      ];
      // And closed, as the server says it, once nobody else is left.
      final nobody = participants
          .where((p) => p['id'] != 'me-1')
          .every((p) => p['displayName'] == null);
      server.overrides['GET /threads/thread-1'] = {
        ...thread,
        'participants': participants,
        'closed': nobody ? 'deleted' : null,
      };
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'conversationClosed': nobody ? 'deleted' : null,
      };
    }

    testWidgets('6. in a ring one of whose others has gone, the third is still there to write to',
        (tester) async {
      // The server takes the message: one of them is still there to read
      // it. The app closed the conversation all the same.
      ringIn('cancelled');
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'closeCode': 'account_deleted',
      };
      gone({'kari-1'});
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.byType(TextField), findsOneWidget);
      expect(find.textContaining('Samtalen er stengt'), findsNothing);
    });

    testWidgets('6b. …and once both have gone, it is closed, in the server\'s words for a ring',
        (tester) async {
      ringIn('cancelled');
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'closeCode': 'account_deleted',
      };
      gone({'kari-1', 'per-1'});
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.byType(TextField), findsNothing);
      expect(
          find.text('Samtalen er stengt fordi de andre i byttet har slettet kontoene sine.'),
          findsOneWidget);
    });

    testWidgets('6c. a finished trade whose other side has gone since is closed too',
        (tester) async {
      // Deleting an account ends nothing that is finished, so the trade
      // says nothing of it; its conversation does, and «Send» wrote to nobody.
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'completed',
        'closedAt': '2026-09-09T08:55:00Z',
      };
      server.overrides['GET /threads/thread-1'] = {...FakeServer.thread, 'state': 'completed'};
      gone({'kari-1'});
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.byType(TextField), findsNothing);
      expect(find.text('Samtalen er stengt fordi den andre i byttet slettet kontoen sin.'),
          findsOneWidget);
    });

    const refusal = Refusal(409, 'conversation_closed',
        'Samtalen er stengt fordi den andre i byttet slettet kontoen sin.');

    testWidgets('6d. «Send» refused because nobody is left gives the field way to why',
        (tester) async {
      server.overrides['POST /threads/thread-1/messages'] = refusal;
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      await tester.enterText(find.byType(TextField), 'Er du der?');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsNothing);
      expect(find.text(refusal.message), findsOneWidget);
    });

    testWidgets('6e. …and on the trade page\'s card the same', (tester) async {
      server.overrides['POST /threads/thread-1/messages'] = refusal;
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      await tester.enterText(find.byType(TextField), 'Er du der?');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsNothing);
      expect(find.text(refusal.message), findsOneWidget);
    });

    // A block ends what is still being negotiated, and nothing that has
    // finished: a completed trade's conversation kept its field, and «Send»
    // there said «Dette er ikke mulig mellom dere.» each time it was pressed.
    const acrossABlock = Refusal(403, 'blocked', 'Dette er ikke mulig mellom dere.');

    testWidgets('6f. «Send» refused across a block gives the field way to why', (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': 'completed'};
      server.overrides['GET /threads/thread-1'] = {...FakeServer.thread, 'state': 'completed'};
      server.overrides['POST /threads/thread-1/messages'] = acrossABlock;
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      await tester.enterText(find.byType(TextField), 'Er du der?');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsNothing);
      expect(find.text('Samtalen er stengt etter en blokkering.'), findsOneWidget);
    });

    testWidgets('6g. …and on the trade page\'s card the same', (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': 'completed'};
      server.overrides['POST /threads/thread-1/messages'] = acrossABlock;
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      await tester.enterText(find.byType(TextField), 'Er du der?');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsNothing);
      expect(find.text('Samtalen er stengt etter en blokkering.'), findsOneWidget);
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

  group('09f, what was not traded', () {
    // An ended trade drew «DU FÅR» and «DU GIR» and the totals between them,
    // as one still going on. 09f draws one card, «IKKE BYTTET», with whose
    // each thing is and «Tilgjengelig» beside yours.
    testWidgets('10. is one card of what was on the table, yours with where it stands',
        (tester) async {
      endedWith('declined', reason: 'Byttet ble avslått');
      server.overrides['GET /trades/trade-1'] = {
        ...server.overrides['GET /trades/trade-1']! as Map<String, Object?>,
        'youGive': [
          FakeServer.drill,
          // Taken by another trade since.
          {...FakeServer.drill, 'id': 'item-helmet', 'title': 'Sykkelhjelm', 'estimatedValueNok': 250,
            'status': 'reserved', 'reserved': true},
        ],
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('IKKE BYTTET'), findsOneWidget);
      expect(find.text('DU FÅR'), findsNothing);
      expect(find.text('DU GIR · 2 TING'), findsNothing);
      expect(find.textContaining('differanse'), findsNothing);
      expect(find.text('Kari · verdi 1\u00A0200\u00A0kr'), findsOneWidget);
      expect(find.text('din · verdi 600\u00A0kr'), findsOneWidget);
      expect(find.text('din · verdi 250\u00A0kr'), findsOneWidget);
      expect(find.text('Tilgjengelig'), findsOneWidget);
      expect(find.text('Reservert'), findsOneWidget);
      // Still why it ended, and the way back.
      expect(find.text('Byttet ble avslått'), findsOneWidget);
      expect(find.text('Tilbake til Bytter'), findsOneWidget);
    });
  });
}
