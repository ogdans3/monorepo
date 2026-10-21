// 06f, the handover, from the moment everybody has said yes to the last mark.
//
// Nothing on an agreed trade said it was agreed: 06f opens with «Byttet er
// godtatt!» and «Dere kan også avtale å møtes i samtalen.», and the page went
// straight to the mellomlegg and the marks. And 09h, «Byttet er
// gjennomført!», came only when «Marker som mottatt» was the last mark set:
// a trade finished by «Marker som sendt» turned completed under the person
// with nothing said.
//
// And a finished trade, 09i, was drawn from the listings as they are now,
// not from the copy the server takes as the trade finishes and sends with it:
// a listing changed after it was traded, or the pictures of an account
// deleted since, rewrote what the other side had traded.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';

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

  group('09i, from the copy taken as it finished', () {
    /// Finished, with Kari's console changed since: a new title, a new value
    /// and no picture any more, while the copy has it as it was traded.
    Map<String, Object?> finished({bool copy = true}) {
      final changed = {
        ...FakeServer.console,
        'title': 'Retro spillkonsoll, ny pris',
        'estimatedValueNok': 9900,
        'cover': null,
      };
      return {
        ...agreed(sent: at, received: at, state: 'completed'),
        'youGet': [changed],
        'youGetValue': 9900,
        'difference': 9300,
        'cash': null,
        'snapshots': copy
            ? [
                {
                  'title': 'Bosch drill 18V',
                  'giverPosition': 0,
                  'estimatedValueNok': 600,
                  'cover': null,
                },
                {
                  'title': 'Retro spillkonsoll',
                  'giverPosition': 1,
                  'estimatedValueNok': 1200,
                  'cover': 'http://test/media/console.jpg',
                },
              ]
            : const [],
      };
    }

    testWidgets('5. says what was traded, not what the listing says now', (tester) async {
      server.overrides['GET /trades/trade-1'] = finished();
      await mount(tester);

      expect(find.text('Retro spillkonsoll'), findsOneWidget);
      expect(find.text('fra Kari · verdi 1 200 kr'), findsOneWidget);
      expect(find.textContaining('ny pris'), findsNothing);
      expect(find.textContaining('9 900'), findsNothing);
      // The values under them are the copy's too.
      expect(find.text('differanse 600 kr'), findsOneWidget);
      // And the picture it was traded with, which the listing no longer has.
      final console = tester
          .widgetList<ItemThumb>(find.byType(ItemThumb))
          .firstWhere((t) => t.item.title == 'Retro spillkonsoll');
      expect(console.item.cover, 'http://test/media/console.jpg');
    });

    testWidgets('6. …and from the listings where the server sent no copy', (tester) async {
      server.overrides['GET /trades/trade-1'] = finished(copy: false);
      await mount(tester);

      expect(find.text('Retro spillkonsoll, ny pris'), findsOneWidget);
    });

    testWidgets('7. a trade under way is the offer as it stands', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...finished(),
        'state': 'accepted',
        'closedAt': null,
      };
      await mount(tester);

      // On its card and under «PÅ VEI TIL DEG».
      expect(find.text('Retro spillkonsoll, ny pris'), findsWidgets);
      expect(find.text('Retro spillkonsoll'), findsNothing);
    });

    testWidgets('8. in a ring, the third leg is the copy\'s as well', (tester) async {
      final ring = chainTrade();
      server.overrides['GET /trades/trade-chain'] = {
        ...ring,
        'state': 'completed',
        'closedAt': at,
        'otherLegs': [
          {
            'giver': FakeServer.kari,
            'receiver': FakeServer.me,
            'items': [
              {...FakeServer.console, 'title': 'Noe annet nå'}
            ],
          }
        ],
        'snapshots': [
          {'title': 'Bosch drill 18V', 'giverPosition': 0, 'estimatedValueNok': 600},
          {'title': 'Retro spillkonsoll', 'giverPosition': 1, 'estimatedValueNok': 1200},
          {'title': 'Bysykkel, dame', 'giverPosition': 2, 'estimatedValueNok': 1100},
        ],
      };
      tester.view.physicalSize = const Size(430, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await session.login('ola@epost.no', 'passord');
      await tester.pumpWidget(MultiProvider(
        providers: [
          Provider<SwaplyApi>.value(value: api),
          ChangeNotifierProvider<Session>.value(value: session),
        ],
        child: const MaterialApp(home: TradeDetailScreen(tradeId: 'trade-chain')),
      ));
      await tester.pumpAndSettle();

      expect(find.text('KARI GIR'), findsOneWidget);
      expect(find.text('Noe annet nå'), findsNothing);
      expect(find.text('Retro spillkonsoll'), findsWidgets);
    });
  });

  group('what the one waiting is told', () {
    setUp(() {
      // The day after Kari's marks in [agreed].
      now = () => DateTime.parse('2026-09-10T12:00:00Z').toLocal();
      addTearDown(() => now = DateTime.now);
    });

    testWidgets('9. «PÅ VEI TIL DEG» says when Kari sent it, as 08c draws it', (tester) async {
      // Kari has sent and received in [agreed]; you have marked nothing.
      server.overrides['GET /trades/trade-1'] = agreed();
      await mount(tester);

      expect(find.text('sendt av Kari i går'), findsOneWidget);
      expect(find.textContaining('avtal detaljer i samtalen'), findsNothing);
    });

    testWidgets('10. …and that details are agreed in the conversation while she has not',
        (tester) async {
      final trade = agreed();
      server.overrides['GET /trades/trade-1'] = {
        ...trade,
        'participants': [
          for (final p in trade['participants']! as List)
            {...p as Map<String, Object?>, 'sentAt': null, 'receivedAt': null},
        ],
      };
      await mount(tester);

      expect(find.text('fra Kari · avtal detaljer i samtalen'), findsOneWidget);
      expect(find.textContaining('sendt av'), findsNothing);
    });
  });

  testWidgets('11. a finished trade has one way to rate it, at the foot', (tester) async {
    server.overrides['GET /trades/trade-1'] = agreed(sent: at, received: at, state: 'completed');
    await mount(tester);

    expect(find.text('Du har ikke vurdert byttet ennå.'), findsOneWidget);
    expect(find.text('Vurder Kari'), findsOneWidget);
    expect(find.text('Vurder byttet'), findsNothing);
  });

  group('09h, what went in and out', () {
    Trade paidToYou() => Trade.fromJson({
          ...agreed(sent: at, received: at, state: 'completed'),
          // Kari's console for your drill, and 450 kr from her to you.
          'youGetValue': 600,
          'youGiveValue': 1200,
          'youGet': [FakeServer.drill],
          'youGive': [FakeServer.console],
          'cash': {
            'amountNok': 450,
            'youPay': false,
            'payer': {...FakeServer.kari, 'position': 1},
            'payee': {...FakeServer.me, 'position': 0},
            'payeePhone': null,
          },
        });

    Future<void> show(WidgetTester tester, Trade trade) async {
      tester.view.physicalSize = const Size(430, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MultiProvider(
        providers: [
          Provider<SwaplyApi>.value(value: api),
          ChangeNotifierProvider<Session>.value(value: session),
        ],
        child: MaterialApp(home: TradeCompletedScreen(trade: trade)),
      ));
      await tester.pumpAndSettle();
    }

    testWidgets('12. counts a mellomlegg paid to you as come in', (tester) async {
      await show(tester, paidToYou());

      expect(find.text('1 050 kr'), findsOneWidget);
      expect(find.text('verdi inn, med mellomlegg'), findsOneWidget);
      expect(find.text('1 200 kr'), findsOneWidget);
      expect(find.text('verdi ut'), findsOneWidget);
    });

    testWidgets('13. …and one you paid as gone out', (tester) async {
      await show(tester, Trade.fromJson(FakeServer.trade));

      // The drill and 350 kr out, the console in.
      expect(find.text('950 kr'), findsOneWidget);
      expect(find.text('verdi ut, med mellomlegg'), findsOneWidget);
      expect(find.text('1 200 kr'), findsOneWidget);
      expect(find.text('verdi inn'), findsOneWidget);
    });
  });
}
