// A yes, or a counter-offer, belongs to the offer it was made on.
//
// An acceptance is keyed to an offer version, and the app sent none: the swipe
// on 06c accepted whatever offer was newest when it reached the server, which
// could be one proposed while 06c was being read. A counter-offer from 09a or
// from a chip in the chat was built on the offer the screen had, and wrote
// over one that had landed meanwhile. And the trade page went on showing the
// offer it opened with: it never asked again after the chat, where the chips
// make proposals, or after the app had been in the background.
//
// Now the swipe sends the offer 06c showed and a counter-offer the one it was
// composed on. The server refuses either with `offer_changed` once another
// has been proposed, in its own words; the app takes the person back to the
// trade, asked for again, with those words over it. The trade page asks
// again when the chat closes and when the app comes back.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

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

String toast(WidgetTester tester) => tester.widget<SwaplyToast>(find.byType(SwaplyToast)).message;

/// What the server says when the offer on screen is no longer the newest.
const changed = Refusal(409, 'offer_changed', 'Kari har endret forslaget. Se på det nye først.');

/// Kari's counter-offer, as the trade stands once it has landed.
final countered = {
  ...FakeServer.trade,
  'state': 'countered',
  'offerId': 'offer-2',
  'offerSeq': 2,
  'counterOfferBy': 'kari-1',
};

Future<void> swipeToAccept(WidgetTester tester) async {
  await tester.tap(find.text('Godta byttet'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Jeg har lest og godtar vilkårene'));
  await tester.pumpAndSettle();
  await tester.drag(find.text('›'), const Offset(400, 0));
  await tester.pumpAndSettle();
}

Future<void> openChip(WidgetTester tester, String chip) async {
  await tester.ensureVisible(find.text(chip));
  await tester.pumpAndSettle();
  await tester.tap(find.text(chip));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('each names the offer it was made on', () {
    testWidgets('1. the swipe on 06c, the offer 06c showed', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await swipeToAccept(tester);

      expect(server.bodies['POST /trades/trade-1/accept'],
          {'termsVersion': '2026-09-06', 'offerId': 'offer-1'});
    });

    testWidgets('2. a counter-offer from 09a, the offer it was composed on', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Send motbytte'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /trades/trade-1/counter']?['baseOfferId'], 'offer-1');
    });

    testWidgets('3. a proposal from a chip in the chat, the offer it was opened over',
        (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå mellomlegg');
      await tester.tap(find.widgetWithText(FilledButton, 'Foreslå 350 kr'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /trades/trade-1/counter']?['baseOfferId'], 'offer-1');
    });
  });

  group('refused because another came first', () {
    testWidgets('4. 06c goes back to the trade, which shows the new offer under the words',
        (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      server.overrides['POST /trades/trade-1/accept'] = changed;
      server.overrides['GET /trades/trade-1'] = countered;

      await swipeToAccept(tester);

      expect(find.byType(AgreementScreen), findsNothing);
      expect(toast(tester), changed.message);
      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);
    });

    testWidgets('5. 09a goes back to the trade the same way', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      server.overrides['POST /trades/trade-1/counter'] = changed;
      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();
      server.overrides['GET /trades/trade-1'] = countered;

      await tester.tap(find.widgetWithText(FilledButton, 'Send motbytte'));
      await tester.pumpAndSettle();

      expect(find.byType(CounterOfferScreen), findsNothing);
      expect(toast(tester), changed.message);
      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);
    });

    testWidgets('6. a chip\'s sheet closes, and the chat asks for the trade again',
        (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      server.overrides['POST /trades/trade-1/counter'] = changed;
      await openChip(tester, 'Foreslå mellomlegg');
      final asked = server.asked('GET /trades/trade-1');

      await tester.tap(find.widgetWithText(FilledButton, 'Foreslå 350 kr'));
      await tester.pumpAndSettle();

      expect(find.text('Jeg betaler'), findsNothing);
      expect(toast(tester), changed.message);
      expect(server.asked('GET /trades/trade-1'), asked + 1);
      // Nothing was proposed, so nothing is said about it in the chat.
      expect(server.asked('POST /threads/thread-1/messages'), 0);
    });

    testWidgets('7. a proposal that went, with its line in the chat lost, is not sent twice',
        (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      server.overrides['POST /threads/thread-1/messages'] = unreachable;
      await openChip(tester, 'Foreslå mellomlegg');

      await tester.tap(find.widgetWithText(FilledButton, 'Foreslå 350 kr'));
      await tester.pumpAndSettle();

      // The sheet is gone, so «Foreslå» cannot be pressed a second time over
      // the offer it has itself replaced.
      expect(find.text('Jeg betaler'), findsNothing);
      expect(server.asked('POST /trades/trade-1/counter'), 1);
      expect(toast(tester), noContact);
    });
  });

  group('the trade page asks again', () {
    testWidgets('8. when the chat it opened closes', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.tap(find.text('Åpne ›'));
      await tester.pumpAndSettle();
      expect(find.byType(ThreadScreen), findsOneWidget);
      server.overrides['GET /trades/trade-1'] = countered;
      final asked = server.asked('GET /trades/trade-1');

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      expect(find.byType(ThreadScreen), findsNothing);
      expect(server.asked('GET /trades/trade-1'), asked + 1);
      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);
    });

    testWidgets('9. when the app comes back from the background, quietly', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      server.overrides['GET /trades/trade-1'] = countered;

      for (final state in [
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pump();
      expect(find.textContaining('Nytt forslag fra Kari'), findsNothing);

      for (final state in [
        AppLifecycleState.hidden,
        AppLifecycleState.inactive,
        AppLifecycleState.resumed,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pumpAndSettle();
      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);

      // With no answer it keeps the trade it has and says nothing.
      server.overrides['GET /trades/trade-1'] = unreachable;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.textContaining('Nytt forslag fra Kari'), findsOneWidget);
      expect(find.byType(SwaplyToast), findsNothing);
    });
  });
}
