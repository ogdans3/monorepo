// 13 Profil and what opens from it.
//
// Everything on 13 is the session's — the things, the likes, the rating — so
// 13 is only as current as the last time the session asked who you are.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = true}) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  if (signedIn) await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        home: screen,
        onGenerateRoute: (settings) => MaterialPageRoute(
            settings: settings,
            builder: (_) => Scaffold(body: Center(child: Text(settings.name ?? '')))),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The drill, as its owner opens it: their own.
const ownDrill = {
  ...FakeServer.drill,
  'owner': {'id': 'me-1', 'displayName': 'Ola N.'},
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('a listing changed on 04 is changed on 13', () {
    testWidgets('1. taken down, 04 says so, and 13 no longer has it', (tester) async {
      var gone = false;
      server.overrides['GET /items/item-drill'] = ownDrill;
      server.overrides['DELETE /items/item-drill'] = (http.Request _) {
        gone = true;
        return <String, Object?>{};
      };
      server.overrides['GET /me'] =
          (http.Request _) => {...FakeServer.me, if (gone) 'items': const <Object>[]};
      await mount(tester, const ProfileScreen());
      expect(find.text('Mine gjenstander · 1'), findsOneWidget);

      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fjern annonsen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SecondaryButton, 'Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('DELETE /items/item-drill'));
      expect(find.byType(ItemDetailScreen), findsNothing);
      expect(find.text('Annonsen er fjernet.'), findsOneWidget);
      expect(find.text('Mine gjenstander · 0'), findsOneWidget);
      expect(find.text('Bosch drill 18V'), findsNothing);
      expect(session.me!.items, isEmpty);
    });

    testWidgets('2. …and a refusal leaves the page, and says why', (tester) async {
      server.overrides['GET /items/item-drill'] = ownDrill;
      server.overrides['DELETE /items/item-drill'] = const Refusal(
          400, 'item_reserved', 'Gjenstanden er reservert i et bytte.');
      await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fjern annonsen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SecondaryButton, 'Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(find.text('Gjenstanden er reservert i et bytte.'), findsOneWidget);
      expect(find.text('Annonsen er fjernet.'), findsNothing);
    });

    testWidgets('3. corrected, 13 has the new words once 04 is closed', (tester) async {
      var title = 'Bosch drill 18V';
      server.overrides['GET /items/item-drill'] = (http.Request _) => {...ownDrill, 'title': title};
      server.overrides['PATCH /items/item-drill'] = (http.Request _) {
        title = 'Bosch drill 18V med koffert';
        return {...FakeServer.drill, 'title': title};
      };
      server.overrides['GET /me'] = (http.Request _) => {
            ...FakeServer.me,
            'items': [
              {...FakeServer.drill, 'title': title},
            ],
          };
      await mount(tester, const ProfileScreen());

      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rediger annonsen'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Bosch drill 18V med koffert');
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      final asked = server.asked('GET /me');
      await tester.tap(find.bySemanticsLabel('Tilbake'));
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsNothing);
      expect(server.asked('GET /me'), asked + 1);
      expect(find.text('Bosch drill 18V med koffert'), findsOneWidget);
    });
  });
}
