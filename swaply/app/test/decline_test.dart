// «Avslå» on every negotiation you have not said yes to.
//
// It stood only beside «Godta byttet», which is only there once both sides
// of the offer hold something. So a conversation in `talking`, and an offer
// with a side still empty, could not be closed from the trade at all — while
// the server declines a trade in all three negotiating states.
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

Future<void> mount(WidgetTester tester) async {
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
      child: const MaterialApp(home: TradeDetailScreen(tradeId: 'trade-1')),
    ),
  );
  await tester.pumpAndSettle();
}

void tradeIn(String state, [Map<String, Object?> more = const {}]) =>
    server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': state, ...more};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    server.overrides['POST /trades/trade-1/decline'] = {
      ...FakeServer.trade,
      'state': 'cancelled',
      'closeCode': 'declined',
      'closeReason': 'Byttet ble avslått',
    };
  });

  testWidgets('1. a conversation behind «Jeg vil ha» can be declined', (tester) async {
    // Their listing on the table and nothing of yours.
    tradeIn('talking', {'youGive': const []});
    await mount(tester);

    expect(find.text('Godta byttet'), findsNothing);
    expect(find.text('Sett sammen byttet'), findsOneWidget);
    await tester.tap(find.text('Avslå'));
    await tester.pumpAndSettle();
    // Nothing was ever held, so nothing is said to come free.
    expect(find.text('Byttet avsluttes, og Kari får beskjed.'), findsOneWidget);

    await tester.tap(find.text('Avslå byttet'));
    await tester.pumpAndSettle();

    expect(server.asked('POST /trades/trade-1/decline'), 1);
    expect(find.text('Byttet er avsluttet'), findsOneWidget);
  });

  testWidgets('2. so can a counter-offer with their side still empty', (tester) async {
    tradeIn('countered', {'youGet': const [], 'counterOfferBy': 'kari-1'});
    await mount(tester);

    expect(find.text('Avslå'), findsOneWidget);
    expect(find.text('Sett sammen byttet'), findsOneWidget);
    expect(find.text('Godta byttet'), findsNothing);
  });

  testWidgets('3. a whole offer keeps its three actions', (tester) async {
    await mount(tester);

    expect(find.text('Avslå'), findsOneWidget);
    expect(find.text('Godta byttet'), findsOneWidget);
    expect(find.text('Foreslå motbytte'), findsOneWidget);
    await tester.tap(find.text('Avslå'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Tingene deres blir tilgjengelige for andre igjen'),
        findsOneWidget);
  });

  testWidgets('4. once you have said yes, the way out is withdrawing, not declining',
      (tester) async {
    tradeIn('pending', {
      'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
    });
    await mount(tester);

    expect(find.text('Avslå'), findsNothing);
    expect(find.text('Trekk deg fra byttet'), findsOneWidget);
  });
}
