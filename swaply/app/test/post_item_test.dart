// 10b, writing a listing and correcting one.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/state/session.dart';

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

/// 10b's fields, in the order the form has them.
Finder field(int i) => find.byType(TextField).at(i);
const title = 0, description = 1, value = 2, subcategory = 3, postcode = 4;

/// «Rediger annonsen» on your own listing, from its page.
Future<void> correct(WidgetTester tester) async {
  server.overrides['PATCH /items/item-mine'] = {...FakeServer.drill, 'id': 'item-mine'};
  await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));
  await tester.tap(find.byIcon(Icons.more_horiz));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Rediger annonsen'));
  await tester.pumpAndSettle();
}

Map<String, dynamic> get sent => server.bodies['PATCH /items/item-mine']!;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('«Rediger annonsen» clears what is emptied', () {
    testWidgets('1. an emptied description, subcategory and value are sent as null',
        (tester) async {
      // Sent as '' and left out, and the server kept all three.
      await correct(tester);
      expect(tester.widget<TextField>(field(description)).controller!.text,
          'Lite brukt, ladar følger med.');

      await tester.enterText(field(description), '   ');
      await tester.enterText(field(value), '');
      await tester.enterText(field(subcategory), '');
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      expect(sent.containsKey('description'), isTrue);
      expect(sent['description'], isNull);
      expect(sent.containsKey('subcategory'), isTrue);
      expect(sent['subcategory'], isNull);
      expect(sent.containsKey('estimatedValueNok'), isTrue);
      expect(sent['estimatedValueNok'], isNull);
      // What was not emptied is sent as it stands.
      expect(sent['title'], 'Bosch drill 18V');
      expect(sent['condition'], 'good');
      // An empty postcode leaves the listing where it is: the server keeps
      // the town, not the postcode, so the field opens empty.
      expect(sent.containsKey('postalCode'), isFalse);
    });

    testWidgets('2. what is written is sent trimmed, and a value as a number', (tester) async {
      await correct(tester);
      await tester.enterText(field(description), '  Med to batterier. ');
      await tester.enterText(field(value), '750');
      await tester.enterText(field(subcategory), ' Drill ');
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      expect(sent['description'], 'Med to batterier.');
      expect(sent['estimatedValueNok'], 750);
      expect(sent['subcategory'], 'Drill');
    });

    testWidgets('3. a thing made a service has its condition cleared', (tester) async {
      await correct(tester);
      await tester.tap(find.text('Tjeneste'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      expect(sent['kind'], 'service');
      expect(sent.containsKey('condition'), isTrue);
      expect(sent['condition'], isNull);
    });
  });
}
