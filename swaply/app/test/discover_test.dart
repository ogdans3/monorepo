// 05 Oppdag, the grid and the search behind it.
//
// The grid comes a page at a time. It used to make one asking and draw what
// came of it, which is the server's first thirty: «84 treff» over thirty
// cards, and the rest never shown however far anybody scrolled. Now the next
// page is asked for as the foot of the grid comes near, with the search the
// grid on screen was asked with, and «N treff» stays the server's count.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// What each asking for the grid was sent with, in order.
late List<Map<String, String>> asked;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(390, 844);
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

/// [count] listings, each its own.
List<Map<String, Object?>> listings(int count, {int from = 0}) => [
      for (var i = from; i < from + count; i++)
        {...FakeServer.console, 'id': 'item-$i', 'title': 'Ting $i'},
    ];

/// The server's grid, handed out a page at a time as the real one does it:
/// `limit` from `offset`, thirty from nought when neither is said. [instead]
/// answers in its place for an asking it has something to say about.
void serve(List<Map<String, Object?>> all,
    {Object? Function(Map<String, String> query)? instead}) {
  server.overrides['GET /discover'] = (http.Request request) {
    final query = request.url.queryParameters;
    asked.add(query);
    final odd = instead?.call(query);
    if (odd != null) return odd;
    final from = int.tryParse(query['offset'] ?? '') ?? 0;
    final take = int.tryParse(query['limit'] ?? '') ?? 30;
    return {'total': all.length, 'items': all.skip(from).take(take).toList()};
  };
}

Finder card(int i) => find.byKey(ValueKey('item-$i'));

Finder get grid =>
    find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down);

/// Pulls the grid down, the way a thumb does. Not waited for: the pull ends
/// when the frames that draw it have been pumped.
void pull(WidgetTester tester) =>
    unawaited(tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show());

/// The grid scrolled to its foot, and what that asks for answered.
Future<void> toTheFoot(WidgetTester tester) async {
  final position = tester.state<ScrollableState>(grid.first).position;
  position.jumpTo(position.maxScrollExtent);
  await tester.pumpAndSettle();
}

/// Back at the top, where «N treff» is: a list builds only what is near the
/// screen.
Future<void> toTheTop(WidgetTester tester) async {
  tester.state<ScrollableState>(grid.first).position.jumpTo(0);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    asked = [];
  });

  group('the grid comes a page at a time', () {
    testWidgets('1. thirty first, the next thirty as the foot comes near, and the count is the '
        'server\'s all along', (tester) async {
      serve(listings(70));
      await mount(tester, const DiscoverScreen());

      expect(asked.single, containsPair('limit', '30'));
      expect(asked.single, containsPair('offset', '0'));
      expect(find.text('70 treff'), findsOneWidget);
      expect(card(29), findsOneWidget);
      expect(card(30), findsNothing);

      await toTheFoot(tester);
      expect(asked.last, containsPair('offset', '30'));
      expect(asked.last, containsPair('limit', '30'));
      expect(card(59), findsOneWidget);
      await toTheTop(tester);
      expect(find.text('70 treff'), findsOneWidget);

      await toTheFoot(tester);
      expect(asked.last, containsPair('offset', '60'));
      expect(card(69), findsOneWidget);

      // The last page came back short: there is no more to ask for.
      final before = asked.length;
      await toTheFoot(tester);
      await tester.drag(grid.first, const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(asked.length, before);
      // And no spinner is left under it.
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('2. asked again behind the grid, it is asked as far down as it was read',
        (tester) async {
      // A pull, the tab coming back, a card's page closed: the first page alone
      // took the second away from under the thumb that had scrolled to it.
      serve(listings(70));
      await mount(tester, const DiscoverScreen());
      await toTheFoot(tester);
      expect(card(59), findsOneWidget);

      pull(tester);
      await tester.pumpAndSettle();

      expect(asked.last, containsPair('offset', '0'));
      expect(asked.last, containsPair('limit', '60'));
      expect(card(59), findsOneWidget);
    });

    testWidgets('3. …in pieces of a hundred, the most the server hands over at once',
        (tester) async {
      serve(listings(250));
      await mount(tester, const DiscoverScreen());
      for (var i = 0; i < 4; i++) {
        await toTheFoot(tester);
      }
      expect(card(149), findsOneWidget);
      asked.clear();

      pull(tester);
      await tester.pumpAndSettle();

      expect([for (final q in asked) (q['offset'], q['limit'])], [('0', '100'), ('100', '50')]);
      expect(card(149), findsOneWidget);
    });

    testWidgets('4. a page that does not come keeps the grid, says so, and the next scroll asks '
        'again', (tester) async {
      var fail = true;
      serve(listings(70), instead: (query) => query['offset'] == '30' && fail ? unreachable : null);
      await mount(tester, const DiscoverScreen());

      await toTheFoot(tester);
      expect(find.text(noContact), findsOneWidget);
      expect(card(29), findsOneWidget);
      expect(card(30), findsNothing);

      // Not again by itself, at every frame the thumb rests there.
      final tries = asked.length;
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(asked.length, tries);

      fail = false;
      await tester.drag(grid.first, const Offset(0, -200));
      await tester.pumpAndSettle();
      expect(asked[tries], containsPair('offset', '30'));
      expect(card(59), findsOneWidget);
    });

    testWidgets('5. the next page is the grid\'s: words typed and not searched for stay out of it',
        (tester) async {
      serve(listings(70));
      await mount(tester, const DiscoverScreen());

      await tester.enterText(find.byType(TextField), 'kajakk');
      await tester.pump();
      FocusManager.instance.primaryFocus?.unfocus();
      await toTheFoot(tester);

      expect(asked.last, containsPair('offset', '30'));
      expect(asked.last.containsKey('q'), isFalse);
      expect(card(59), findsOneWidget);
    });

    testWidgets('6. a listing that moved a place between two pages is drawn once', (tester) async {
      // Somebody put a thing out while this was being read: every listing
      // moved down a place, and the last of the first page came again first
      // in the second.
      final all = listings(70);
      serve(all, instead: (query) {
        if (query['offset'] != '30') return null;
        return {
          'total': 71,
          'items': [all[29], ...all.skip(30).take(29)],
        };
      });
      await mount(tester, const DiscoverScreen());
      await toTheFoot(tester);

      expect(card(29), findsOneWidget);
      expect(card(58), findsOneWidget);
      // And the next page starts after what the server handed over, not
      // after what was drawn.
      await toTheFoot(tester);
      expect(asked.last, containsPair('offset', '60'));
    });

    testWidgets('7. a new search starts from the first page, and a page for the old one is dropped',
        (tester) async {
      final all = listings(70);
      var slow = false;
      serve(all, instead: (query) {
        if (!slow || query['offset'] != '30') return null;
        return Future.delayed(const Duration(seconds: 2),
            () => {'total': 70, 'items': all.skip(30).take(30).toList()});
      });
      await mount(tester, const DiscoverScreen());

      slow = true;
      final position = tester.state<ScrollableState>(grid.first).position;
      position.jumpTo(position.maxScrollExtent);
      await tester.pump();
      await tester.pump();
      expect(asked.last, containsPair('offset', '30'));

      serve([...listings(3, from: 100)]);
      await tester.enterText(find.byType(TextField), 'kajakk');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      // The old grid's page lands after the new search has.
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      expect(asked.last, containsPair('offset', '0'));
      expect(asked.last, containsPair('q', 'kajakk'));
      expect(find.text('3 treff'), findsOneWidget);
      expect(card(100), findsOneWidget);
      expect(card(30), findsNothing);
      expect(card(0), findsNothing);
    });

    testWidgets('8. a grid «Ikke vis meg slike» has emptied is asked for again, when there is more',
        (tester) async {
      // The whole first page of one kind, and the second of another.
      final ps5 = [
        for (final item in listings(30)) {...item, 'subcategory': 'PS5'},
      ];
      final rest = listings(10, from: 30);
      var hidden = false;
      server.overrides['POST /me/hidden'] = (http.Request request) {
        hidden = true;
        return {
          'hidden': {'category': 'gaming', 'subcategory': 'PS5', 'itemId': null},
          'hiddenCount': 1,
        };
      };
      server.overrides['GET /discover'] = (http.Request request) {
        final query = request.url.queryParameters;
        asked.add(query);
        final all = hidden ? rest : [...ps5, ...rest];
        final from = int.parse(query['offset']!);
        final take = int.parse(query['limit']!);
        return {'total': all.length, 'items': all.skip(from).take(take).toList()};
      };
      await mount(tester, const DiscoverScreen());

      await tester.longPress(find.text('Ting 0'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ikke vis meg slike'));
      await tester.pumpAndSettle();

      expect(jsonEncode(asked.last), contains('"offset":"0"'));
      expect(card(30), findsOneWidget);
      expect(card(0), findsNothing);
      expect(find.text('Ingen treff'), findsNothing);
    });
  });

  group('the chips and 05b are one filter', () {
    /// The chip on the row over the grid named [label].
    Pill chip(WidgetTester tester, String label) =>
        tester.widget<Pill>(find.widgetWithText(Pill, label).first);

    Future<void> openFilters(WidgetTester tester) async {
      await tester.tap(find.bySemanticsLabel('Avansert søk'));
      await tester.pumpAndSettle();
    }

    testWidgets('1. a chip takes the place of 05b\'s category, and lets go of its subcategory',
        (tester) async {
      // Gaming and «PS5» on 05b, then «Alt», showed the same three PS5s; and
      // «Klær» asked for clothes that were PS5s, and found none.
      serve(listings(3));
      server.overrides['GET /discover/subcategories'] = {'subcategories': ['PS5']};
      await mount(tester, const DiscoverScreen());

      await openFilters(tester);
      await tester.tap(find.byType(DropdownButtonFormField<String?>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gaming').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('PS5'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('treff').last);
      await tester.pumpAndSettle();

      expect(asked.last, containsPair('category', 'gaming'));
      expect(asked.last, containsPair('subcategory', 'PS5'));
      expect(chip(tester, 'Gaming').selected, isTrue);

      await tester.tap(find.text('Alt'));
      await tester.pumpAndSettle();
      expect(asked.last.containsKey('category'), isFalse);
      expect(asked.last.containsKey('subcategory'), isFalse);
      expect(chip(tester, 'Alt').selected, isTrue);

      await tester.tap(find.text('Klær'));
      await tester.pumpAndSettle();
      expect(asked.last, containsPair('category', 'klaer'));
      expect(asked.last.containsKey('subcategory'), isFalse);
    });

    testWidgets('2. 05b opens on the chip\'s category, and «Vis N treff» keeps the chip',
        (tester) async {
      // It opened on what was last chosen in it: on «Klær» it said «Alle»,
      // counted every category, and pressed, put the chip back to «Alt».
      serve(listings(3));
      await mount(tester, const DiscoverScreen());
      await tester.tap(find.text('Klær'));
      await tester.pumpAndSettle();

      await openFilters(tester);
      expect(find.byType(AdvancedSearchScreen), findsOneWidget);
      expect(
          tester
              .widget<DropdownButtonFormField<String?>>(find.byType(DropdownButtonFormField<String?>))
              .initialValue,
          'klaer');
      // The count on the button is for the chip's category.
      expect(asked.last, containsPair('category', 'klaer'));

      await tester.tap(find.textContaining('treff').last);
      await tester.pumpAndSettle();

      expect(find.byType(AdvancedSearchScreen), findsNothing);
      expect(chip(tester, 'Klær').selected, isTrue);
      expect(chip(tester, 'Alt').selected, isFalse);
      expect(asked.last, containsPair('category', 'klaer'));
    });
  });

  group('10a fits the phone it is on', () {
    /// 10a over a screen of [size], the way a heart puts it up.
    Future<void> prompt(WidgetTester tester, Size size) async {
      server.overrides['GET /me/likes'] = {
        'items': [
          for (var i = 0; i < 3; i++) {...FakeServer.console, 'id': 'liked-$i', 'cover': null},
        ],
      };
      await mount(
        tester,
        Builder(
          builder: (context) => TextButton(
              onPressed: () => showListingPrompt(context, 5), child: const Text('Vis')),
        ),
      );
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      await tester.tap(find.text('Vis'));
      await tester.pumpAndSettle();
    }

    testWidgets('1. on a 375×667, «Senere» is on screen and answers', (tester) async {
      // Held to nine sixteenths of the screen, a sheet of about four hundred
      // points put «Senere» under the edge of a 667, where nothing reached it.
      await prompt(tester, const Size(375, 667));

      final later = find.widgetWithText(TextButton, 'Senere');
      expect(tester.getRect(later).bottom, lessThanOrEqualTo(667));
      expect(later.hitTestable(), findsOneWidget);
      expect(find.text('Legg ut en gjenstand').hitTestable(), findsOneWidget);

      await tester.tap(later);
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
    });

    testWidgets('2. on a 320, the pictures shrink to fit, and the sheet scrolls to «Senere»',
        (tester) async {
      // Three 88s and their gaps are wider than a 320 leaves, and ran past
      // its edge.
      await prompt(tester, const Size(320, 568));

      expect(tester.takeException(), isNull);
      final thumb = tester.getSize(find.byType(ItemThumb).first);
      expect(thumb.width, lessThan(88));
      expect(thumb.width, thumb.height);
      expect(tester.getRect(find.byType(ItemThumb).last).right, lessThanOrEqualTo(320 - 24));

      final later = find.widgetWithText(TextButton, 'Senere');
      await tester.ensureVisible(later);
      await tester.pumpAndSettle();
      expect(later.hitTestable(), findsOneWidget);
      // Never under the status bar, however much there is to scroll.
      expect(tester.getRect(find.byType(BottomSheet)).top, greaterThanOrEqualTo(0));
    });

    testWidgets('3. on the export\'s 390, the pictures are its 88s', (tester) async {
      await prompt(tester, const Size(390, 844));

      expect(tester.getSize(find.byType(ItemThumb).first), const Size(88, 88));
      expect(find.byType(ItemThumb), findsNWidgets(3));
    });
  });

  group('05b\'s value fields take a number, and a filter refused keeps the grid', () {
    Finder valueField(int i) => find.descendant(
        of: find.byType(AdvancedSearchScreen), matching: find.byType(TextField).at(i + 1));

    testWidgets('1. only digits go in, and «1 000» is a thousand', (tester) async {
      // «-500» was sent and refused; «1 000» read as nothing and filtered
      // nothing.
      serve(listings(3));
      await mount(tester, const AdvancedSearchScreen(initial: SearchFilters(), query: ''));

      await tester.enterText(valueField(0), '-500');
      await tester.pump();
      expect(tester.widget<TextField>(valueField(0)).controller!.text, '500');
      expect(asked.last, containsPair('minValue', '500'));

      await tester.enterText(valueField(1), '1 000');
      await tester.pump();
      expect(asked.last, containsPair('maxValue', '1000'));

      // Past what any listing can be worth, a bound is that much, and a
      // number the server could not hold is never sent.
      await tester.enterText(valueField(1), '9' * 25);
      await tester.pump();
      expect(asked.last, containsPair('maxValue', '10000000'));
    });

    testWidgets('2. a filter the server refuses leaves the grid, and says why', (tester) async {
      serve(listings(3),
          instead: (query) => query.containsKey('minValue')
              ? const Refusal(400, 'invalid_request', 'Tallet kan være høyst 100.')
              : null);
      await mount(tester, const DiscoverScreen());
      expect(card(2), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Avansert søk'));
      await tester.pumpAndSettle();
      await tester.enterText(valueField(0), '500');
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('treff').last);
      await tester.pumpAndSettle();

      expect(find.text('Fikk ikke kontakt'), findsNothing);
      expect(find.text('Tallet kan være høyst 100.'), findsOneWidget);
      expect(card(2), findsOneWidget);
      expect(find.text('3 treff'), findsOneWidget);

      // The filter that was refused is not the grid's: the next asking is
      // without it.
      await tester.tap(find.text('Gaming'));
      await tester.pumpAndSettle();
      expect(asked.last.containsKey('minValue'), isFalse);
      expect(asked.last, containsPair('category', 'gaming'));
    });

    testWidgets('3. no answer is still «Fikk ikke kontakt», with «Prøv igjen»', (tester) async {
      var reach = true;
      serve(listings(3), instead: (query) => reach ? null : unreachable);
      await mount(tester, const DiscoverScreen());

      reach = false;
      await tester.tap(find.text('Gaming'));
      await tester.pumpAndSettle();
      expect(find.text('Fikk ikke kontakt'), findsOneWidget);

      reach = true;
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();
      expect(card(2), findsOneWidget);
    });
  });
}

