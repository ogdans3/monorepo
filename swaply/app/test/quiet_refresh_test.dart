// What a screen did is what it says, whatever the badges' asking after it
// says.
//
// Every action on the trade screen asked the session again afterwards, for
// the bar's counts, inside the action's own `try`: with no answer to that,
// «Vi får ikke kontakt» went up over a trade that had just been declined,
// marked or answered — and the button span on for the asking's whole
// patience first. The badges are the session's business, and they come with
// the next answer.
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

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('the trade screen', () {
    testWidgets('1. a decline that went through says nothing of the badges\' asking',
        (tester) async {
      server.overrides['POST /trades/trade-1/decline'] = {
        ...FakeServer.trade,
        'state': 'cancelled',
        'closeCode': 'declined',
        'closeReason': 'Byttet ble avslått',
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      server.overrides['GET /me'] = unreachable;

      await tester.tap(find.text('Avslå'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Avslå byttet'));
      await tester.pumpAndSettle();

      expect(server.asked('POST /trades/trade-1/decline'), 1);
      expect(find.text('Byttet er avsluttet'), findsOneWidget);
      expect(find.text(noContact), findsNothing);
    });

    testWidgets('2. a yes on 06c whose badges get no answer throws nothing', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      server.overrides['GET /me'] = unreachable;

      await tester.tap(find.text('Godta byttet'));
      await tester.pumpAndSettle();
      // Out of 06c without a yes: the trade is asked for again, and so is
      // the session, which does not answer.
      await tester.tap(find.text('Avbryt'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Godta byttet'), findsOneWidget);
    });
  });
}
