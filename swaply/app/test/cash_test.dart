// The mellomlegg card, from both ends of it and through the whole trade.
//
// «✓ betalt via Vipps» read the viewer's own mark, which only the payer sets,
// so the one being paid never saw it. Paused, completed and cancelled trades
// all said «betales når begge har godtatt», and a completed one said «Du
// betaler» where 09i has «Du betalte». The phone to pay to may now be left
// out by the server, which sends it only to the payer of an accepted trade,
// and only where the payee gave one.
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

const paid = '2026-09-02T12:00:00Z';

/// The pair in [state], with 350 kr from [payer] to the other, as the
/// trade view has it: the payer's mark on the participants, and on `you`
/// when that is you.
void trade(String state,
    {required String payer, String? paidAt, String? phone = '911 22 333'}) {
  final mine = payer == 'me-1';
  server.overrides['GET /trades/trade-1'] = {
    ...FakeServer.trade,
    'state': state,
    if (state == 'completed') 'closedAt': '2026-09-04T12:00:00Z',
    'you': {
      ...FakeServer.trade['you'] as Map,
      'accepted': state != 'pending',
      'paidAt': mine ? paidAt : null,
    },
    'cash': {
      'amountNok': 350,
      'youPay': mine,
      'payer': mine ? {...FakeServer.me, 'position': 0} : {...FakeServer.kari, 'position': 1},
      'payee': mine ? {...FakeServer.kari, 'position': 1} : {...FakeServer.me, 'position': 0},
      'payeePhone': phone,
    },
    'participants': [
      {...FakeServer.me, 'position': 0, 'gives': [FakeServer.drill], 'paidAt': mine ? paidAt : null},
      {
        ...FakeServer.kari,
        'position': 1,
        'gives': [FakeServer.console],
        'paidAt': mine ? null : paidAt,
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

  testWidgets('1. the one being paid sees it paid once the payer has marked it', (tester) async {
    trade('accepted', payer: 'kari-1', paidAt: paid, phone: null);
    await mount(tester);

    expect(find.text('Kari betaler deg 350 kr'), findsOneWidget);
    expect(find.text('✓ betalt via Vipps'), findsOneWidget);
    // Marking it is the payer's to do.
    expect(find.text('Marker som betalt'), findsNothing);
    expect(find.text('Marker som ikke betalt'), findsNothing);
  });

  testWidgets('2. paused, it is still paid between you before anything is sent',
      (tester) async {
    trade('paused', payer: 'me-1');
    await mount(tester);

    expect(find.text('betales direkte mellom dere, før noe sendes'), findsOneWidget);
    expect(find.text('betales når begge har godtatt'), findsNothing);
  });

  testWidgets('3. completed and marked paid, it is said in the past, as on 09i',
      (tester) async {
    trade('completed', payer: 'me-1', paidAt: paid);
    await mount(tester);

    expect(find.text('Du betalte 350 kr til Kari'), findsOneWidget);
    expect(find.text('✓ betalt via Vipps'), findsOneWidget);
    expect(find.text('betales når begge har godtatt'), findsNothing);
  });

  testWidgets('4. completed and never marked, it says what was agreed, not that it happened',
      (tester) async {
    trade('completed', payer: 'kari-1');
    await mount(tester);

    expect(find.text('Kari skulle betale deg 350 kr'), findsOneWidget);
    expect(find.text('ikke markert som betalt'), findsOneWidget);
    expect(find.text('Kari betalte deg 350 kr'), findsNothing);
  });

  testWidgets('5. an ended trade has nothing left to pay', (tester) async {
    trade('cancelled', payer: 'me-1');
    await mount(tester);

    expect(find.text('MELLOMLEGG'), findsNothing);
    expect(find.textContaining('betales'), findsNothing);
  });

  testWidgets('6. the payer of an accepted trade gets the number to Vipps, and can copy it',
      (tester) async {
    trade('accepted', payer: 'me-1');
    await mount(tester);

    expect(find.text('Vipps til Kari · 911 22 333'), findsOneWidget);
    expect(find.byTooltip('Kopiér'), findsOneWidget);
    expect(find.text('Marker som betalt'), findsOneWidget);
  });

  testWidgets('7. …and without one, is told where to get it, with nothing to copy',
      (tester) async {
    trade('accepted', payer: 'me-1', phone: null);
    await mount(tester);

    expect(find.text('Vipps til Kari · spør etter nummeret i samtalen'), findsOneWidget);
    expect(find.byTooltip('Kopiér'), findsNothing);
    expect(find.text('Marker som betalt'), findsOneWidget);
  });
}
