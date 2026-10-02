// Proposing a version is agreeing to it.
//
// 09e draws whoever proposed the version on the table as «✓ Har godtatt», and
// gives the other side «Godta endringen»: the product owner chose that on
// 02.10.2026, and the server now takes a counter-offer as its proposer's yes —
// which, like any owner's yes, holds their things in it. A person must not
// learn that afterwards, so 09a and the chips in the chat say it over the
// button, with the terms behind the line, and send the version of the terms
// they agreed to by sending. A proposal with a side still empty is a question
// rather than a deal, and says nothing of the kind.
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

const agrees = 'Når du sender forslaget, har du godtatt det og byttevilkårene.';

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

Future<void> openChip(WidgetTester tester, String chip) async {
  await tester.ensureVisible(find.text(chip));
  await tester.pumpAndSettle();
  await tester.tap(find.text(chip));
  await tester.pumpAndSettle();
}

/// Kari's counter-offer, as the trade stands once it has landed.
final countered = {
  ...FakeServer.trade,
  'state': 'countered',
  'offerId': 'offer-2',
  'offerSeq': 2,
  'counterOfferBy': 'kari-1',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('09a', () {
    testWidgets('1. says over «Send motbytte» that sending it is agreeing to it', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();

      expect(find.text(agrees), findsOneWidget);
    });

    testWidgets('2. …and the line opens the terms it means', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(agrees));
      await tester.pumpAndSettle();

      expect(find.text('Byttevilkår'), findsOneWidget);
      expect(find.text('Versjon 2026-09-06'), findsOneWidget);
    });

    testWidgets('3. sends the version of the terms with the proposal', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Send motbytte'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /trades/trade-1/counter']?['termsVersion'], '2026-09-06');
    });
  });

  group('a proposal from the chat', () {
    testWidgets('4. that makes a deal says so too, and sends the terms', (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå mellomlegg');

      expect(find.text(agrees), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Foreslå 350 kr'));
      await tester.pumpAndSettle();
      expect(server.bodies['POST /trades/trade-1/counter']?['termsVersion'], '2026-09-06');
    });

    testWidgets('5. with a side still empty is a question, and says nothing of the kind',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'youGive': <dynamic>[]};
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå mellomlegg');

      expect(find.text(agrees), findsNothing);
    });
  });

  group('09e', () {
    testWidgets('6. a version Kari proposed, and so agreed to, is «Godta endringen»',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = countered;
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Godta endringen'), findsOneWidget);
      expect(find.text('Godta byttet'), findsNothing);
    });

    testWidgets('7. the trade as it first opened is still «Godta byttet»', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('Godta byttet'), findsOneWidget);
      expect(find.text('Godta endringen'), findsNothing);
    });
  });
}
