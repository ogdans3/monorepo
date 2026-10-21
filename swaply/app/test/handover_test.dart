// 06f, the handover, from the moment everybody has said yes to the last mark.
//
// Nothing on an agreed trade said it was agreed: 06f opens with «Byttet er
// godtatt!» and «Dere kan også avtale å møtes i samtalen.», and the page went
// straight to the mellomlegg and the marks. And 09h, «Byttet er
// gjennomført!», came only when «Marker som mottatt» was the last mark set:
// a trade finished by «Marker som sendt» turned completed under the person
// with nothing said.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
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
      child: const MaterialApp(home: TradeDetailScreen(tradeId: 'trade-1')),
    ),
  );
  await tester.pumpAndSettle();
}

const at = '2026-09-09T10:00:00Z';

/// The pair, agreed, with your own marks as given and Kari's both set.
Map<String, Object?> agreed({String? sent, String? received, String state = 'accepted'}) => {
      ...FakeServer.trade,
      'state': state,
      if (state == 'completed') 'closedAt': at,
      'you': {
        ...FakeServer.trade['you'] as Map,
        'accepted': true,
        'sentAt': sent,
        'receivedAt': received,
      },
      'participants': [
        {
          ...FakeServer.me,
          'position': 0,
          'accepted': true,
          'gives': [FakeServer.drill],
          'sentAt': sent,
          'receivedAt': received,
        },
        {
          ...FakeServer.kari,
          'position': 1,
          'accepted': true,
          'gives': [FakeServer.console],
          'sentAt': at,
          'receivedAt': at,
        },
      ],
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. an agreed trade says so, in 06f\'s words', (tester) async {
    server.overrides['GET /trades/trade-1'] = agreed();
    await mount(tester);

    expect(find.text('Byttet er godtatt!'), findsOneWidget);
    expect(find.text('Dere kan også avtale å møtes i samtalen.'), findsOneWidget);
  });

  for (final state in ['pending', 'paused', 'completed', 'cancelled']) {
    testWidgets('2. …and a trade that is $state does not', (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': state};
      await mount(tester);
      expect(find.text('Byttet er godtatt!'), findsNothing);
    });
  }

  for (final (last, first) in [('sendt', 'received'), ('mottatt', 'sent')]) {
    testWidgets('3. «Marker som $last» as the last mark brings up 09h', (tester) async {
      server.overrides['GET /trades/trade-1'] = agreed(
        sent: first == 'sent' ? at : null,
        received: first == 'received' ? at : null,
      );
      server.overrides['POST /trades/trade-1/mark'] = {
        'complete': true,
        'trade': agreed(sent: at, received: at, state: 'completed'),
      };
      await mount(tester);

      await tester.tap(find.text('Marker som $last'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /trades/trade-1/mark']?['marker'],
          last == 'sendt' ? 'sent' : 'received');
      expect(find.byType(TradeCompletedScreen), findsOneWidget);
      expect(find.text('Byttet er gjennomført!'), findsOneWidget);

      // «Senere» goes back to the trade, finished.
      await tester.tap(find.text('Senere'));
      await tester.pumpAndSettle();
      expect(find.text('DU FIKK'), findsOneWidget);
    });
  }

  testWidgets('4. a mark that finishes nothing stays on the trade', (tester) async {
    server.overrides['GET /trades/trade-1'] = agreed();
    server.overrides['POST /trades/trade-1/mark'] = {
      'complete': false,
      'trade': agreed(sent: at),
    };
    await mount(tester);

    await tester.tap(find.text('Marker som sendt'));
    await tester.pumpAndSettle();

    expect(find.byType(TradeCompletedScreen), findsNothing);
    expect(find.text('Marker som ikke sendt'), findsOneWidget);
  });
}
