// Whose turn a trade is on 11, by the same rule as the badge on Bytter.
//
// «Godta byttet» was offered on every pending or countered trade you had not
// said yes to, including one whose offer had a side still empty — which the
// server will not let anybody accept, and does not count as your turn. And a
// trade paused on a question somebody else asked, waiting for your answer,
// read «Pauset» like one waiting on somebody else.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester) async {
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
      child: const MaterialApp(home: TradesScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

/// The list, with [waiting] and [active] in their tabs.
void list({List<Map<String, Object?>> waiting = const [], List<Map<String, Object?>> active = const []}) =>
    server.overrides['GET /trades'] = {
      'waiting': waiting,
      'active': active,
      'done': const [],
      'yourTurn': 0,
    };

/// The edge the card with [label] on it is drawn with: green when it is
/// your turn.
Color edge(WidgetTester tester, String label) {
  final boxes = tester.widgetList<Container>(
      find.ancestor(of: find.text(label), matching: find.byType(Container)));
  final card = boxes.firstWhere((c) => (c.decoration as BoxDecoration?)?.border != null);
  return ((card.decoration! as BoxDecoration).border! as Border).top.color;
}

Map<String, Object?> paused({required bool byYou}) => {
      ...FakeServer.trade,
      'state': 'paused',
      'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      'withdrawal': {
        'id': 'w1',
        'requestedBy': byYou ? 'me-1' : 'kari-1',
        'byYou': byYou,
        'state': 'waiting',
        'respondsBy': DateTime.now().add(const Duration(days: 2)).toIso8601String(),
        'blockedBySent': false,
      },
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. a whole offer you have not said yes to is your turn, with «Godta byttet»',
      (tester) async {
    list(waiting: [FakeServer.trade]);
    await mount(tester);

    expect(find.text('Din tur'), findsOneWidget);
    expect(find.text('Godta byttet'), findsOneWidget);
    expect(edge(tester, 'Din tur'), SwaplyColors.greenPressed);
  });

  testWidgets('2. an offer with a side still empty has nothing to accept', (tester) async {
    list(waiting: [
      {...FakeServer.trade, 'state': 'countered', 'counterOfferBy': 'kari-1', 'youGive': const []},
    ]);
    await mount(tester);

    expect(find.text('Endret'), findsOneWidget);
    expect(find.text('Godta byttet'), findsNothing);
    expect(edge(tester, 'Endret'), SwaplyColors.cardLine);
  });

  testWidgets('3. a question somebody else asked is yours to answer: «Svar»', (tester) async {
    list(active: [paused(byYou: false)]);
    await mount(tester);
    await tester.tap(find.text('Aktive · 1'));
    await tester.pumpAndSettle();

    expect(find.text('Svar'), findsOneWidget);
    expect(find.text('Pauset'), findsNothing);
    expect(edge(tester, 'Svar'), SwaplyColors.greenPressed);
    // An answer, not an acceptance.
    expect(find.text('Godta byttet'), findsNothing);
  });

  testWidgets('4. a question you asked waits on the others', (tester) async {
    list(active: [paused(byYou: true)]);
    await mount(tester);
    await tester.tap(find.text('Aktive · 1'));
    await tester.pumpAndSettle();

    expect(find.text('Pauset'), findsOneWidget);
    expect(find.text('Svar'), findsNothing);
    expect(edge(tester, 'Pauset'), SwaplyColors.cardLine);
  });
}
