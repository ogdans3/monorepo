// 10b says the town while the postcode is typed, and refuses one that has none
// before 10c.
//
// The export draws «7030 Trondheim»: the digits, and the town the server will
// show in their place, grey against the field's edge. The app drew the digits
// only, and a postcode that belongs to no town was found out by «Legg ut»,
// after 10c had already made a profile for a listing that could not go out.
// The rule: a postcode that is no town is refused on 10b, in the server's own
// words, and nothing is made for it.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// Longer than the form waits for the digits to hold still.
const settle = Duration(milliseconds: 400);

const unknown = 'Fant ikke postnummer 7031. Sjekk det, eller la feltet stå tomt.';

Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = true}) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  if (signedIn) {
    await session.login('ola@epost.no', 'passord');
  } else {
    await session.lookAround();
  }

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

Finder get postcode => find.byType(TextField).at(4);

int asked(String code) => server.asked('GET /postcodes/$code');

/// The field's edge as it is drawn now.
Color edge(WidgetTester tester) {
  final decoration = tester.widget<TextField>(postcode).decoration!;
  return (decoration.enabledBorder as OutlineInputBorder).borderSide.color;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. four digits that hold still are asked about once, and the town goes beside them',
      (tester) async {
    await mount(tester, const PostItemScreen(), signedIn: false);

    // Three digits are not a postcode yet, and nobody is asked.
    await tester.enterText(postcode, '703');
    await tester.pump(settle);
    expect(server.requests.where((r) => r.startsWith('GET /postcodes/')), isEmpty);

    // Four are, once they have held still for a moment.
    await tester.enterText(postcode, '7030');
    await tester.pump(const Duration(milliseconds: 100));
    expect(asked('7030'), 0);
    await tester.pump(settle);
    expect(asked('7030'), 1);
    expect(find.text('Trondheim'), findsOneWidget);
    // In the field, at its right edge, where the export draws it.
    final field = tester.getRect(postcode);
    final town = tester.getRect(find.text('Trondheim'));
    expect(field.contains(town.center), isTrue);
    expect(field.right - town.right, closeTo(12, 1));

    // The town belongs to the digits: a digit taken away takes it along, and
    // putting it back draws it again without asking twice.
    await tester.enterText(postcode, '703');
    await tester.pump();
    expect(find.text('Trondheim'), findsNothing);
    await tester.enterText(postcode, '7030');
    await tester.pump(settle);
    expect(find.text('Trondheim'), findsOneWidget);
    expect(asked('7030'), 1);
  });

  testWidgets('2. a postcode that is no town is said over «Neste», and «Neste» does not open 10c',
      (tester) async {
    await mount(tester, const PostItemScreen(), signedIn: false);
    await tester.enterText(find.byType(TextField).first, 'Fiskestang');
    await tester.enterText(postcode, '7031');
    await tester.pump(settle);

    // The server's own words, at once, and the field's edge in coral: the
    // «no» colour, not report-and-block red.
    expect(find.text(unknown), findsOneWidget);
    expect(edge(tester), SwaplyColors.coral);

    await tester.tap(find.text('Neste'));
    await tester.pumpAndSettle();
    expect(find.byType(CreateProfileScreen), findsNothing);
    expect(find.text(unknown), findsOneWidget);
    expect(server.requests, isNot(contains('POST /auth/register')));

    // Put right, the words and the coral go, and 10c comes.
    await tester.enterText(postcode, '7030');
    await tester.pump(settle);
    expect(find.text(unknown), findsNothing);
    expect(edge(tester), SwaplyColors.fieldLine);
    await tester.tap(find.text('Neste'));
    await tester.pumpAndSettle();
    expect(find.byType(CreateProfileScreen), findsOneWidget);
  });

  testWidgets('3. «Neste» pressed before the answer asks then, and waits for it', (tester) async {
    await mount(tester, const PostItemScreen(), signedIn: false);
    await tester.enterText(find.byType(TextField).first, 'Fiskestang');

    // Inside the moment the form gives the digits to hold still.
    await tester.enterText(postcode, '7031');
    await tester.tap(find.text('Neste'));
    await tester.pumpAndSettle();
    expect(asked('7031'), 1);
    expect(find.text(unknown), findsOneWidget);
    expect(find.byType(CreateProfileScreen), findsNothing);

    // Three digits are asked about on «Neste» too, and the server says why.
    await tester.enterText(postcode, '703');
    await tester.tap(find.text('Neste'));
    await tester.pumpAndSettle();
    expect(find.text('Et postnummer har fire sifre.'), findsOneWidget);
    expect(find.byType(CreateProfileScreen), findsNothing);
    expect(server.requests, isNot(contains('POST /auth/register')));
  });

  testWidgets('4. no answer about the postcode holds nothing up: the listing is still checked',
      (tester) async {
    // The lookup is a courtesy. Without contact it says nothing about the
    // code, and the server checks it again when the listing goes out.
    server.overrides['GET /postcodes/7030'] = unreachable;
    await mount(tester, const PostItemScreen(), signedIn: false);
    await tester.enterText(find.byType(TextField).first, 'Fiskestang');
    await tester.enterText(postcode, '7030');
    await tester.pump(settle);

    expect(find.text('Trondheim'), findsNothing);
    expect(find.text(noContact), findsNothing);
    await tester.tap(find.text('Neste'));
    await tester.pumpAndSettle();
    expect(find.byType(CreateProfileScreen), findsOneWidget);
  });

  testWidgets('5. an answer for digits no longer in the field is not drawn beside the new ones',
      (tester) async {
    final late = Completer<Object?>();
    server.overrides['GET /postcodes/7030'] = (_) => late.future;
    await mount(tester, const PostItemScreen(), signedIn: false);

    await tester.enterText(postcode, '7030');
    await tester.pump(settle);
    expect(asked('7030'), 1);
    await tester.enterText(postcode, '5003');
    await tester.pump(settle);
    expect(find.text('Bergen'), findsOneWidget);

    late.complete({'postalCode': '7030', 'town': 'Trondheim'});
    await tester.pump();
    expect(find.text('Trondheim'), findsNothing);
    expect(find.text('Bergen'), findsOneWidget);
  });

  testWidgets('6. with a profile, «Legg ut» refuses it the same way, and sends nothing',
      (tester) async {
    // With a profile there is no 10c to save, but a listing the server would
    // refuse is still better refused where it is typed.
    await mount(tester, const PostItemScreen());
    await tester.enterText(find.byType(TextField).first, 'Fiskestang');
    await tester.enterText(postcode, '7031');
    // The button, not the tab of the same name under it.
    await tester.tap(find.widgetWithText(FilledButton, 'Legg ut'));
    await tester.pumpAndSettle();
    expect(find.text(unknown), findsOneWidget);
    expect(server.requests, isNot(contains('POST /items')));
  });

  testWidgets('7. …and so does a correction to a listing that is out', (tester) async {
    await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));
    await tester.tap(find.byIcon(Icons.more_horiz));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rediger annonsen'));
    await tester.pumpAndSettle();

    await tester.enterText(postcode, '7031');
    await tester.tap(find.text('Lagre endringene'));
    await tester.pumpAndSettle();
    expect(find.text(unknown), findsOneWidget);
    expect(server.requests, isNot(contains('PATCH /items/item-mine')));

    // Put right, it goes, with the postcode the town was shown for.
    server.overrides['PATCH /items/item-mine'] = {...FakeServer.drill, 'id': 'item-mine'};
    await tester.enterText(postcode, '5003');
    await tester.pump(settle);
    expect(find.text('Bergen'), findsOneWidget);
    await tester.tap(find.text('Lagre endringene'));
    await tester.pumpAndSettle();
    expect(server.bodies['PATCH /items/item-mine']!['postalCode'], '5003');
  });
}
