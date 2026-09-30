// The item page says how many people have liked the thing, and the heart says
// plainly whether you are one of them.
//
// The count is the server's, from when the page opened, with this account's own
// like in it or not. The page counts the others apart from it and follows the
// heart as the phone has it, so the words turn with the tap, and back again if
// the server says no. They are the words 12 and the profile use, «3 har likt
// denne», and with your own like «Du og 3 andre har likt denne».
//
// The heart is open until it is pressed and green all through once it is, on
// the page and on the card alike: more colour is on, and green is the app's yes
// beside the ✕'s red. It used to be a coral heart on the card and a filled glyph
// on the page's green button, which changed too little to be seen. The product
// owner chose green on 30.09.2026 over a heart that turns coral, which is the
// app's no. A heart pressed on pulses once, and holds still for somebody who
// asked for less motion.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A heart that lands with no loop behind it, so nothing goes up over the page.
const plainLike = {'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': 1};

/// [lessMotion] as the app's `LessMotion` says it, in the MediaQuery: a
/// browser's setting arrives that way and no other, and the phone's own also
/// has the framework cut every animation short by itself, which would hide
/// whether the heart asked at all.
Future<void> mount(WidgetTester tester, Widget screen, {bool lessMotion = false}) async {
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
      child: MaterialApp(
        builder: lessMotion
            ? (context, child) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(disableAnimations: true),
                  child: child!,
                )
            : null,
        home: screen,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Kari's console, liked by [count] people, this account among them or not.
void console({required int count, bool mine = false}) {
  server.overrides['GET /items/item-console'] = {
    ...FakeServer.console,
    'owner': FakeServer.kari,
    'likeCount': count,
    'likedByMe': mine,
  };
}

Future<void> openConsole(WidgetTester tester) =>
    mount(tester, const ItemDetailScreen(itemId: 'item-console'));

/// The page's heart, whichever way it is turned.
CircleAction heart(WidgetTester tester) => tester.widget<CircleAction>(find.byWidgetPredicate(
    (w) => w is CircleAction && w.icon != Icons.close));

Future<void> press(WidgetTester tester) async {
  await tester.tap(find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close));
  await tester.pumpAndSettle();
}

/// The words beside the small heart under the category and the town.
Color? colourOf(WidgetTester tester, String words) =>
    tester.widget<Text>(find.text(words)).style?.color;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    server.overrides['POST /items/item-console/like'] = plainLike;
    server.overrides['DELETE /items/item-console/like'] = <String, dynamic>{};
  });

  group('04 says how many have liked it', () {
    testWidgets('1. somebody else\'s listing, liked by three', (tester) async {
      console(count: 3);
      await openConsole(tester);

      expect(find.text('3 har likt denne'), findsOneWidget);
      expect(colourOf(tester, '3 har likt denne'), SwaplyColors.inkBody);
    });

    testWidgets('2. pressing the heart puts you in the count, in green', (tester) async {
      console(count: 3);
      await openConsole(tester);

      await press(tester);

      expect(find.text('Du og 3 andre har likt denne'), findsOneWidget);
      expect(colourOf(tester, 'Du og 3 andre har likt denne'), SwaplyColors.greenText);
      expect(find.text('3 har likt denne'), findsNothing);
    });

    testWidgets('3. taking it back takes you out again', (tester) async {
      console(count: 4, mine: true);
      await openConsole(tester);
      expect(find.text('Du og 3 andre har likt denne'), findsOneWidget);

      await press(tester);

      expect(find.text('3 har likt denne'), findsOneWidget);
    });

    testWidgets('4. a heart the server refuses takes the words back with it', (tester) async {
      console(count: 3);
      server.overrides['POST /items/item-console/like'] = 500;
      await openConsole(tester);

      await press(tester);

      expect(find.text('3 har likt denne'), findsOneWidget);
      expect(find.text('Du og 3 andre har likt denne'), findsNothing);
      expect(heart(tester).filled, isFalse);
    });

    testWidgets('5. none, you alone, and you and one other', (tester) async {
      console(count: 0);
      await openConsole(tester);
      expect(find.text('Ingen har likt denne ennå'), findsOneWidget);

      await press(tester);
      expect(find.text('Du har likt denne'), findsOneWidget);
    });

    testWidgets('6. …and one other is «1 annen»', (tester) async {
      console(count: 1);
      await openConsole(tester);
      expect(find.text('1 har likt denne'), findsOneWidget);

      await press(tester);
      expect(find.text('Du og 1 annen har likt denne'), findsOneWidget);
    });

    testWidgets('7. on your own listing the owner sees the count', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-mine'));

      expect(find.text('Dette er din egen ting. Slik ser andre den.'), findsOneWidget);
      expect(find.text('3 har likt denne'), findsOneWidget);
    });

    testWidgets('8. a server that sends no count gets no line, not a made-up nought',
        (tester) async {
      await openConsole(tester);

      expect(find.textContaining('har likt denne'), findsNothing);
      expect(find.text('Ingen har likt denne ennå'), findsNothing);
    });
  });

  group('the heart is open, and green all through once pressed', () {
    testWidgets('1. on 04', (tester) async {
      console(count: 3);
      await openConsole(tester);
      expect(heart(tester).filled, isFalse);
      expect(heart(tester).icon, Icons.favorite_border);
      expect(heart(tester).color, SwaplyColors.greenPressed);
      expect(heart(tester).borderColor, SwaplyColors.greenPressed);

      await press(tester);

      expect(heart(tester).filled, isTrue);
      expect(heart(tester).icon, Icons.favorite);
      expect(heart(tester).color, SwaplyColors.greenPressed);
    });

    testWidgets('2. on a card on Oppdag, where it was a coral heart', (tester) async {
      server.overrides['POST /items/item-drill/like'] = plainLike;
      await mount(tester, const DiscoverScreen());
      final card = find.byType(ItemCard).first;
      (Color?, Color?) drawn(IconData glyph) {
        final icon = find.descendant(of: card, matching: find.byIcon(glyph));
        final disc = tester.widget<Container>(
            find.ancestor(of: icon, matching: find.byType(Container)).first);
        return ((disc.decoration! as BoxDecoration).color, tester.widget<Icon>(icon).color);
      }

      expect(drawn(Icons.favorite_border), (Colors.white.withValues(alpha: 0.92), SwaplyColors.ink));

      await tester.tap(find.descendant(of: card, matching: find.byIcon(Icons.favorite_border)));
      await tester.pumpAndSettle();

      expect(drawn(Icons.favorite), (SwaplyColors.greenPressed, Colors.white));
    });

    testWidgets('3. a heart pressed on pulses once, and not when it is taken back',
        (tester) async {
      console(count: 3);
      await openConsole(tester);
      double scale() => tester
          .widget<ScaleTransition>(find
              .ancestor(
                  of: find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close),
                  matching: find.byType(ScaleTransition))
              .first)
          .scale
          .value;

      await tester.tap(find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(scale(), greaterThan(1));
      await tester.pumpAndSettle();
      expect(scale(), 1);

      await tester.tap(find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(scale(), 1);
      await tester.pumpAndSettle();
    });

    testWidgets('4. …and holds still for somebody who asked for less motion', (tester) async {
      console(count: 3);
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'), lessMotion: true);

      await tester.tap(find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(
          tester
              .widget<ScaleTransition>(find
                  .ancestor(
                      of: find.byWidgetPredicate((w) => w is CircleAction && w.icon != Icons.close),
                      matching: find.byType(ScaleTransition))
                  .first)
              .scale
              .value,
          1);
      expect(heart(tester).filled, isTrue);
    });
  });
}
