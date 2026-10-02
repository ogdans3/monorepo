// 12a Varsler: the server sends ids and codes, and the words are the app's.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        home: screen,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// 12a with one notification of [type], about [payload].
void one(String type,
    {Map<String, Object?> payload = const {'tradeId': 'trade-1'},
    String? actorName,
    String? itemTitle}) {
  server.overrides['GET /notifications'] = {
    'notifications': [
      {
        'id': 'n1',
        'type': type,
        'payload': payload,
        'actorName': actorName,
        'itemTitle': itemTitle,
        'readAt': null,
        'createdAt': '2026-09-09T08:50:00Z',
      },
    ],
    'unread': 1,
  };
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('a like names the person by first name, as the export does', () {
    testWidgets('1. «Kari N.» is «Kari»', (tester) async {
      // The server sends the whole name, and 12a said «Kari N. likte …».
      one('item_liked',
          payload: {'itemId': 'item-drill'}, actorName: 'Kari N.', itemTitle: 'Bosch drill 18V');
      await mount(tester, const NotificationsScreen());

      expect(find.text('Kari likte Bosch drill 18V'), findsOneWidget);
    });

    testWidgets('2. nobody named is «Noen»', (tester) async {
      one('item_liked', payload: {'itemId': 'item-drill'}, actorName: ' ', itemTitle: 'Bosch drill 18V');
      await mount(tester, const NotificationsScreen());

      expect(find.text('Noen likte Bosch drill 18V'), findsOneWidget);
    });
  });

  group('a trade that ended says why, true for a pair and for a ring', () {
    for (final (reason, words) in [
      ('declined', 'Noen i byttet avslo det.'),
      ('withdrawn_early', 'Noen i byttet trakk seg før det var godtatt.'),
      ('displaced', 'En av tingene i byttet ble reservert i et annet bytte.'),
      ('withdrawal_approved', 'Dere ble enige om å avbryte det.'),
      ('blocked', 'Det kan ikke fortsette mellom dere.'),
      ('listing_removed', 'En av tingene i byttet ble tatt ned.'),
      ('account_deleted', 'Noen i byttet slettet kontoen sin.'),
      ('ended_by_admin', 'Det ble avsluttet fra testverktøyet.'),
      ('something_new', 'Åpne byttet for å se hvorfor.'),
    ]) {
      testWidgets(reason, (tester) async {
        one('trade_cancelled', payload: {'tradeId': 'trade-1', 'reason': reason});
        await mount(tester, const NotificationsScreen());

        expect(find.text('Byttet er avsluttet'), findsOneWidget);
        expect(find.text(words), findsOneWidget);
        // Never «den andre», which a ring of three makes untrue.
        expect(find.textContaining('andre parten'), findsNothing);
      });
    }
  });

  group('a withdrawal that did not end the trade', () {
    testWidgets('1. refused, the one who asked is told it goes on, and it opens', (tester) async {
      one('withdrawal_rejected');
      await mount(tester, const NotificationsScreen());

      expect(find.text('Du kan ikke trekke deg'), findsOneWidget);
      expect(find.text('Noen i byttet sa nei, så byttet fortsetter som vanlig.'), findsOneWidget);
      expect(find.text('Varsel'), findsNothing);

      await tester.tap(find.text('Du kan ikke trekke deg'));
      await tester.pumpAndSettle();
      expect(server.requests, contains('GET /trades/trade-1'));
    });

    testWidgets('2. unanswered in time, everybody is told it goes on', (tester) async {
      one('withdrawal_lapsed');
      await mount(tester, const NotificationsScreen());

      expect(find.text('Byttet fortsetter'), findsOneWidget);
      expect(find.text('Fristen for å svare gikk ut, så byttet fortsetter som vanlig.'),
          findsOneWidget);
      expect(find.text('Varsel'), findsNothing);
    });
  });
}

