// 06g, 07k and 11a say what the export says.
//
// Checked against `docs/round-5-screens.md` and the export itself: 06g's
// header is «Ola», where the app wrote «Ola N.»; 07k's is «Du, Ola og Kari»,
// its bubbles say «Ola» and «Kari», its field «Skriv en melding…» — «Skriv
// til begge…» is 07j's card — and it carries a card saying «Du får … · du gir
// … · Ola gir …», which the app left out. Both draw «Lest 14:10» under your
// newest message once it is read, and the app drew nothing, though the
// server says how far everybody has read; it keeps no time of reading, so
// the app says «Lest». 11a said «i går» for a message from two calendar days
// back. And the trade page wrote «★ 4,7 · » for somebody with no town.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';

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

const per = {'id': 'per-1', 'displayName': 'Per H.', 'town': 'Stjørdal'};
final rod = {...FakeServer.console, 'id': 'item-rod', 'title': 'Fiskestang', 'ownerId': 'kari-1'};
final bike = {...FakeServer.console, 'id': 'item-bike', 'title': 'Bysykkel', 'ownerId': 'per-1'};

/// A ring as the server sends it to Ola: Kari gives him the rod, he gives
/// Per the drill, and Per gives Kari the bike. [readBy] is how far each has
/// read the conversation.
void ring({Map<String, String?> readBy = const {}}) {
  server.overrides['GET /threads/thread-1'] = {
    ...FakeServer.thread,
    'kind': 'chain',
    'participants': [
      {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
      {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
      {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
    ],
    'readBy': [
      for (final e in readBy.entries) {'userId': e.key, 'lastReadMessageId': e.value},
    ],
  };
  server.overrides['GET /trades/trade-1'] = {
    ...chainTrade(),
    'id': 'trade-1',
    'receivingFrom': {...FakeServer.kari, 'position': 1},
    'givingTo': {...per, 'position': 2},
    'youGet': [rod],
    'youGive': [FakeServer.drill],
    'otherLegs': [
      {'giver': per, 'receiver': FakeServer.kari, 'items': [bike]},
    ],
  };
}

/// The pair's conversation, with Kari having read as far as [kariRead].
void pair({String? kariRead}) => server.overrides['GET /threads/thread-1'] = {
      ...FakeServer.thread,
      'readBy': [
        {'userId': 'me-1', 'lastReadMessageId': 'm2'},
        {'userId': 'kari-1', 'lastReadMessageId': kariRead},
      ],
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('06g', () {
    testWidgets('1. is headed with the first name, as drawn', (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Kari'), findsOneWidget);
      expect(find.text('Kari N.'), findsNothing);
    });

    testWidgets('2. says «Lest» under your newest message once it is read', (tester) async {
      pair(kariRead: 'm2');
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Lest'), findsOneWidget);
      // Under it, at its right.
      final message = tester.getRect(find.text('Passer bra! Kl. 17?'));
      final lest = tester.getRect(find.text('Lest'));
      expect(lest.top, greaterThan(message.bottom));
      expect(lest.right, greaterThan(message.right));
    });

    testWidgets('3. …and nothing while it is not', (tester) async {
      pair(kariRead: 'm1');
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Lest'), findsNothing);
    });
  });

  group('07k', () {
    testWidgets('4. is headed with first names, and its bubbles say who in them too',
        (tester) async {
      ring();
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Du, Kari og Per'), findsOneWidget);
      // Kari's message, with her name in it.
      expect(find.text('Kari'), findsOneWidget);
      expect(find.text('Kari N.'), findsNothing);
    });

    testWidgets('5. carries the line of who gives what to whom', (tester) async {
      ring();
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(
          find.text('Du får Fiskestang fra Kari · du gir Bosch drill 18V til Per · '
              'Per gir Bysykkel til Kari',
              findRichText: true),
          findsOneWidget);
    });

    testWidgets('6. asks for «Skriv en melding…», as 06g does', (tester) async {
      ring();
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Skriv en melding…'), findsOneWidget);
      expect(find.text('Skriv til begge…'), findsNothing);
    });

    testWidgets('7. says nothing while one of the others has not read it', (tester) async {
      ring(readBy: {'kari-1': 'm2', 'per-1': 'm1'});
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Lest'), findsNothing);
    });

    testWidgets('8. …and «Lest» once both have', (tester) async {
      ring(readBy: {'kari-1': 'm2', 'per-1': 'm2'});
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Lest'), findsOneWidget);
    });

    testWidgets('9. 07j\'s card keeps its «Skriv til begge…»', (tester) async {
      server.overrides['GET /trades/trade-chain'] = chainTrade();
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-chain'));

      expect(find.text('Skriv til begge…'), findsOneWidget);
    });
  });

  group('11a', () {
    setUp(() {
      // Thursday morning.
      now = () => DateTime(2026, 9, 10, 9, 0);
      addTearDown(() => now = DateTime.now);
    });

    Map<String, Object?> row(String id, String at) => {
          'id': id,
          'tradeId': 'trade-1',
          'state': 'pending',
          'kind': 'direct',
          'others': [
            {'id': 'kari-1', 'displayName': 'Kari N.'}
          ],
          'subject': null,
          'unread': 0,
          // The phone's own time, as the app reads it.
          'lastMessage': {'body': 'Melding $id', 'mine': false, 'createdAt': at},
        };

    testWidgets('10. says «i går», a weekday and today\'s time by the calendar', (tester) async {
      server.overrides['GET /threads'] = {
        'threads': [
          row('a', '2026-09-10T00:10:00'),
          row('b', '2026-09-09T23:30:00'),
          // Under 48 hours ago, and two days back on the calendar.
          row('c', '2026-09-08T20:00:00'),
          row('d', '2026-09-01T12:00:00'),
        ],
        'unreadTotal': 0,
      };
      await mount(tester, const ChatsScreen());

      expect(find.text('00:10'), findsOneWidget);
      expect(find.text('i går'), findsOneWidget);
      expect(find.text('tirsdag'), findsOneWidget);
      expect(find.text('1.9.'), findsOneWidget);
    });
  });

  testWidgets('11. the trade page leaves out a town somebody does not have', (tester) async {
    final noTown = {...FakeServer.kari, 'town': ''};
    server.overrides['GET /trades/trade-1'] = {
      ...FakeServer.trade,
      'receivingFrom': {...noTown, 'position': 1},
      'givingTo': {...noTown, 'position': 1},
      'participants': [
        {...FakeServer.me, 'position': 0, 'accepted': false, 'gives': [FakeServer.drill]},
        {...noTown, 'position': 1, 'accepted': true, 'gives': [FakeServer.console]},
      ],
    };
    await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

    expect(find.text('★ 4,8'), findsOneWidget);
    expect(find.text('★ 4,8 · '), findsNothing);
  });
}
