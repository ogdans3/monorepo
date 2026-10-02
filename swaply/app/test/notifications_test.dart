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
}
