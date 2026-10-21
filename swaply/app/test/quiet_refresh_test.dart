// What a screen did is what it says, whatever the badges' asking after it
// says.
//
// Every action on the trade screen asked the session again afterwards, for
// the bar's counts, inside the action's own `try`: with no answer to that,
// «Vi får ikke kontakt» went up over a trade that had just been declined,
// marked or answered — and the button span on for the asking's whole
// patience first. The badges are the session's business, and they come with
// the next answer.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
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

    testWidgets('2b. a refusal because the trade moved on elsewhere asks for the trade again',
        (tester) async {
      // The yes was taken back on another phone. «Angre godkjenningen» here
      // was refused, and the page went on offering it, and «Trekk deg» on
      // the strength of a yes that was no longer there.
      final accepted = {
        ...FakeServer.trade,
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      };
      server.overrides['GET /trades/trade-1'] = accepted;
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      expect(find.text('Angre godkjenningen'), findsOneWidget);

      server.overrides['GET /trades/trade-1'] = FakeServer.trade;
      server.overrides['DELETE /trades/trade-1/accept'] =
          const Refusal(409, 'not_accepted', 'Du har ikke godtatt dette byttet.');
      await tester.tap(find.text('Angre godkjenningen'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Angre godkjenningen').last);
      await tester.pumpAndSettle();

      expect(find.text('Du har ikke godtatt dette byttet.'), findsOneWidget);
      expect(find.text('Angre godkjenningen'), findsNothing);
      expect(find.text('Godta byttet'), findsOneWidget);
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

  group('a list that came is not said to have failed', () {
    Future<void> pullDown(WidgetTester tester) async {
      unawaited(tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator).first).show());
      await tester.pumpAndSettle();
    }

    testWidgets('3. Bytter: a pull whose list came and whose badges did not says nothing',
        (tester) async {
      await mount(tester, const TradesScreen());
      server.overrides['GET /me'] = unreachable;
      final before = server.asked('GET /trades');

      await pullDown(tester);

      expect(server.asked('GET /trades'), before + 1);
      expect(find.text('Venter · 1'), findsOneWidget);
      expect(find.text(noContact), findsNothing);
    });

    testWidgets('4. Chats: nor here', (tester) async {
      await mount(tester, const ChatsScreen());
      server.overrides['GET /me'] = unreachable;
      final before = server.asked('GET /threads');

      await pullDown(tester);

      expect(server.asked('GET /threads'), before + 1);
      expect(find.text('Jeg kan sende fiskestangen med PostNord i morgen.'), findsOneWidget);
      expect(find.text(noContact), findsNothing);
    });

    testWidgets('5. 12a: notifications that came are shown when marking them read gets no answer',
        (tester) async {
      server.overrides['POST /notifications/read'] = unreachable;
      await mount(tester, const NotificationsScreen());

      expect(find.text('Fikk ikke kontakt'), findsNothing);
      expect(find.text('Kari likte Bosch drill 18V'), findsOneWidget);
    });

    testWidgets('6. 12a marks read as far as it showed, and no further', (tester) async {
      // Everything was marked read, including a notification that arrived
      // between loading the list and saying so, which nobody had seen.
      await mount(tester, const NotificationsScreen());

      expect(server.asked('POST /notifications/read'), 1);
      expect(server.bodies['POST /notifications/read'], {'upTo': 'n1'});
    });

    testWidgets('7. …and with nothing on screen, marks nothing', (tester) async {
      server.overrides['GET /notifications'] = {'notifications': <Object>[], 'unread': 0};
      await mount(tester, const NotificationsScreen());

      expect(find.text('Ingen varsler'), findsOneWidget);
      expect(server.asked('POST /notifications/read'), 0);
    });
  });
}
