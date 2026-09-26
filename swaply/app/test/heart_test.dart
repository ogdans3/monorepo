// A heart changes its own card and nothing else.
//
// Pressed on a phone, a heart on Oppdag made the whole screen flash: once the
// answer came the card asked the collage to fetch itself again, and the
// collage put a spinner in its own place while it did, then built every card
// and picture back from nothing with the scroll at the top. The heart is the
// whole product and the thing pressed most, so this file holds it frame by
// frame: no spinner at any point, the cards and pictures the very same
// elements, the scroll where it was, and no second trip to the server for a
// page that did not change.
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A phone the size the export draws one, so the collage is taller than the
/// screen and there is a scroll to lose.
Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  addTearDown(() => imageCache
    ..clear()
    ..clearLiveImages());

  await session.login('ola@epost.no', 'passord');
  // Every picture asks a host that never answers, so each one stays the
  // same loading picture for as long as nothing throws it away. Only needed
  // while they are first asked for, and a debug hook left set fails the test.
  debugNetworkImageHttpClientProvider = _Silent.new;
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
  debugNetworkImageHttpClientProvider = null;
}

/// Sixteen things with a picture each: eight to a column, well past the
/// bottom of the screen.
final things = [
  for (var i = 0; i < 16; i++)
    {
      ...FakeServer.console,
      'id': 'item-$i',
      'title': 'Ting $i',
      'cover': 'http://test/media/$i.jpg',
    },
];

/// What the server has been told is wished, so that anything asked for again
/// answers with the truth: a test that fails because the server forgot a heart
/// says nothing about the screen.
late Set<String> wished;

/// How long the collage takes to come back. A phone waits on the network, and
/// a spinner put up for an answer that lands in the same microtask is never
/// drawn — which is how the flash got past every test there was.
const network = Duration(milliseconds: 150);

/// The server's side of every heart on the collage, answered once [until] is,
/// for a test that holds the answer back.
void serveHearts({Future<void>? until}) {
  for (final t in things) {
    final id = t['id'] as String;
    server.overrides['POST /items/$id/like'] = (http.Request _) async {
      await until;
      wished.add(id);
      return {'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': wished.length};
    };
    server.overrides['DELETE /items/$id/like'] = (http.Request _) async {
      await until;
      wished.remove(id);
      return <String, Object?>{};
    };
  }
}

/// The collage as a phone gets it: the server's word as it stood when it was
/// asked, landing [after] later. An answer asked for before a heart and
/// landing after it is the harshest case there is for a heart that must not
/// change its mind.
void slowCollage(Duration after) {
  server.overrides['GET /discover'] = (http.Request _) {
    final then = {
      'total': things.length,
      'items': [
        for (final t in things) {...t, 'likedByMe': wished.contains(t['id'])},
      ],
    };
    return Future.delayed(after, () => then);
  };
}

/// Any spinner at all, the grid's or one inside a button.
final spinner = find.byWidgetPredicate((w) => w is ProgressIndicator);

Finder heartOf(String id, {bool liked = false}) => find.descendant(
    of: find.byKey(ValueKey(id)),
    matching: find.byIcon(liked ? Icons.favorite : Icons.favorite_border));

/// The collage's own scroll: the chips above it scroll too, sideways.
ScrollableState collage(WidgetTester tester) => tester.state<ScrollableState>(
    find.descendant(of: find.byType(RefreshIndicator), matching: find.byType(Scrollable)));

/// What a flash would have thrown away, taken before a heart so every frame
/// after it can be held to it.
class Collage {
  Collage(this.tester)
      : cards = _cards(),
        pictures = find.byType(Image).evaluate().toList(),
        scroll = collage(tester),
        offset = collage(tester).position.pixels;

  final WidgetTester tester;
  final Map<String, Element> cards;
  final List<Element> pictures;
  final ScrollableState scroll;
  final double offset;

  static Map<String, Element> _cards() => {
        for (final e in find.byType(ItemCard).evaluate()) (e.widget as ItemCard).item.id: e,
      };

  /// Pumps [frames] frames and checks at every one that nothing but the heart
  /// has moved.
  Future<void> holds({int frames = 20, void Function()? each}) async {
    for (var i = 0; i < frames; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      unchanged('frame $i');
      each?.call();
    }
  }

  void unchanged(String when) {
    expect(spinner, findsNothing, reason: when);
    final now = _cards();
    expect(now.keys, cards.keys, reason: when);
    for (final id in cards.keys) {
      expect(now[id], same(cards[id]), reason: '$id, $when');
    }
    final shown = find.byType(Image).evaluate().toList();
    expect(shown, hasLength(pictures.length), reason: when);
    for (var i = 0; i < shown.length; i++) {
      expect(shown[i], same(pictures[i]), reason: 'picture $i, $when');
    }
    expect(collage(tester), same(scroll), reason: when);
    expect(scroll.position.pixels, offset, reason: when);
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    wished = {};
    server.overrides['GET /discover'] = (http.Request _) => Future.delayed(
        network,
        () => {
              'total': things.length,
              'items': [
                for (final t in things) {...t, 'likedByMe': wished.contains(t['id'])},
              ],
            });
    for (final t in things) {
      server.overrides['GET /items/${t['id']}'] = (http.Request _) =>
          {...t, 'owner': FakeServer.kari, 'likedByMe': wished.contains(t['id'])};
    }
    serveHearts();
  });

  /// Oppdag, scrolled down the way it is when somebody has found something,
  /// and the id of the first card whose heart is on screen there.
  Future<String> scrolledDown(WidgetTester tester) async {
    await mount(tester, const DiscoverScreen());
    collage(tester).position.jumpTo(300);
    await tester.pump();
    expect(collage(tester).position.pixels, 300);

    final screen = tester.getRect(find.byType(RefreshIndicator));
    return things
        .map((t) => t['id'] as String)
        .firstWhere((id) => screen.contains(tester.getCenter(heartOf(id))));
  }

  group('05 a heart on the collage', () {
    testWidgets('1. turns its card, and the grid is never swapped for a spinner', (tester) async {
      final id = await scrolledDown(tester);
      final answer = Completer<void>();
      serveHearts(until: answer.future);
      final before = Collage(tester);
      final discovered = server.asked('GET /discover');

      // On its way: turned already, and nothing else has moved.
      await tester.tap(heartOf(id));
      await before.holds(each: () => expect(heartOf(id, liked: true), findsOneWidget));
      expect(server.requests, contains('POST /items/$id/like'));

      // Answered: still nothing else moves, in any frame, for longer than a
      // collage would take to come back.
      answer.complete();
      await before.holds(each: () => expect(heartOf(id, liked: true), findsOneWidget));
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(wished, {id});
      expect(server.asked('GET /discover'), discovered);
    });

    testWidgets('2. …and taking it back is the same', (tester) async {
      final id = await scrolledDown(tester);
      await tester.tap(heartOf(id));
      await tester.pumpAndSettle();
      final answer = Completer<void>();
      serveHearts(until: answer.future);
      final before = Collage(tester);
      final discovered = server.asked('GET /discover');

      await tester.tap(heartOf(id, liked: true));
      await before.holds(each: () => expect(heartOf(id), findsOneWidget));
      answer.complete();
      await before.holds(each: () => expect(heartOf(id), findsOneWidget));
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(wished, isEmpty);
      expect(server.asked('GET /discover'), discovered);
    });

    testWidgets('3. a refused heart turns back, and that too is the card alone', (tester) async {
      final id = await scrolledDown(tester);
      server.overrides['POST /items/$id/like'] = 500;
      final before = Collage(tester);

      await tester.tap(heartOf(id));
      await before.holds();
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(heartOf(id), findsOneWidget);
      expect(find.text('Noe gikk galt hos oss.'), findsOneWidget);
    });

    testWidgets('4. coming back from its page asks again behind the grid, not instead of it',
        (tester) async {
      // A block from the page's «⋯» can change what the grid shows, so the
      // collage does ask again: quietly, the way a tab coming back does.
      final id = await scrolledDown(tester);
      final title = things.firstWhere((t) => t['id'] == id)['title'] as String;
      final before = Collage(tester);
      final discovered = server.asked('GET /discover');

      await tester.tap(find.text(title));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.favorite_border));
      await tester.pumpAndSettle();
      Navigator.of(tester.element(find.byType(ItemDetailScreen))).pop();

      await before.holds(frames: 40);
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(server.asked('GET /discover'), discovered + 1);
      expect(heartOf(id, liked: true), findsOneWidget);
    });

    testWidgets('5. a collage asked for before a heart does not take it back by landing after',
        (tester) async {
      // Coming back from a card's page asks again behind the grid, and the
      // grid stays live meanwhile. A heart pressed then is newer than the
      // answer on its way, whichever of the two comes back first.
      await mount(tester, const DiscoverScreen());
      slowCollage(const Duration(milliseconds: 600));
      Future<void> backFromTing0() async {
        await tester.tap(find.text('Ting 0'));
        await tester.pumpAndSettle();
        Navigator.of(tester.element(find.byType(ItemDetailScreen))).pop();
        await tester.pump(const Duration(milliseconds: 350));
      }

      await backFromTing0();
      final discovered = server.asked('GET /discover');
      await tester.tap(heartOf('item-1'));
      await tester.pump();
      expect(wished, {'item-1'});
      // The collage asked for before the heart lands after it.
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expect(server.asked('GET /discover'), discovered);
      expect(heartOf('item-1', liked: true), findsOneWidget);

      // Asked for after the heart was answered, the server's word is the
      // card's again: taken back somewhere else, it shows taken back.
      wished.remove('item-1');
      await backFromTing0();
      await tester.pumpAndSettle();
      expect(heartOf('item-1'), findsOneWidget);
    });

    /// Opens the card's page, presses the heart there and goes back, leaving
    /// the pumping after ‹ to the test.
    Future<void> heartOnItsPage(WidgetTester tester, String id, IconData press,
        {bool settle = true}) async {
      final title = things.firstWhere((t) => t['id'] == id)['title'] as String;
      await tester.tap(find.text(title));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(press));
      if (settle) {
        await tester.pumpAndSettle();
      } else {
        await tester.pump();
      }
      Navigator.of(tester.element(find.byType(ItemDetailScreen))).pop();
    }

    testWidgets('6. a heart pressed on its page is on its card from the first frame back',
        (tester) async {
      // The collage asked for on the way back takes its time on a phone, and
      // until it landed the card went on showing the heart from before the
      // page was opened: empty as the page slid away, then filled — a heart
      // changing its mind about what the person had just done.
      final id = await scrolledDown(tester);
      slowCollage(const Duration(milliseconds: 600));
      final before = Collage(tester);
      final discovered = server.asked('GET /discover');

      for (final (press, liked) in [(Icons.favorite_border, true), (Icons.favorite, false)]) {
        await heartOnItsPage(tester, id, press);
        // Past the 600 the collage takes, so the frames run both sides of it.
        await before.holds(
            frames: 45, each: () => expect(heartOf(id, liked: liked), findsOneWidget));
        await tester.pumpAndSettle();
        before.unchanged('settled');
        expect(heartOf(id, liked: liked), findsOneWidget);
        expect(wished, liked ? {id} : isEmpty);
      }
      expect(server.asked('GET /discover'), discovered + 2);
    });

    testWidgets('7. …and when the page\'s heart is answered only after ‹', (tester) async {
      // The collage asked for on the way back is then the server's word from
      // before the heart, and it lands before the heart does.
      final id = await scrolledDown(tester);
      slowCollage(const Duration(milliseconds: 300));
      final answer = Completer<void>();
      serveHearts(until: answer.future);
      final before = Collage(tester);

      await heartOnItsPage(tester, id, Icons.favorite_border, settle: false);
      await before.holds(frames: 45, each: () => expect(heartOf(id, liked: true), findsOneWidget));
      expect(wished, isEmpty);

      answer.complete();
      await before.holds(each: () => expect(heartOf(id, liked: true), findsOneWidget));
      await tester.pumpAndSettle();
      before.unchanged('settled');
      expect(heartOf(id, liked: true), findsOneWidget);
      expect(wished, {id});
    });

    testWidgets('8. a heart refused on its page is not on its card', (tester) async {
      final id = await scrolledDown(tester);
      slowCollage(const Duration(milliseconds: 600));
      server.overrides['POST /items/$id/like'] = 500;
      final before = Collage(tester);

      await heartOnItsPage(tester, id, Icons.favorite_border);
      await before.holds(frames: 45, each: () => expect(heartOf(id), findsOneWidget));
      await tester.pumpAndSettle();
      before.unchanged('settled');
      expect(heartOf(id), findsOneWidget);
      expect(wished, isEmpty);
    });
  });

  group('04 the heart on a listing', () {
    Future<void> openListing(WidgetTester tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    }

    /// The page as it stands, to be held to it while the heart is on its way.
    Element page(WidgetTester tester) => tester.element(find.byType(ListView));

    testWidgets('1. turns on the tap, never spins, and the page is not fetched again for it',
        (tester) async {
      final answer = Completer<Object?>();
      server.overrides['POST /items/item-console/like'] = (http.Request _) => answer.future;
      await openListing(tester);
      final fetched = server.asked('GET /items/item-console');
      final shown = page(tester);

      void turned() {
        expect(spinner, findsNothing);
        expect(find.byIcon(Icons.favorite), findsOneWidget);
        expect(page(tester), same(shown));
      }

      await tester.tap(find.byIcon(Icons.favorite_border));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        turned();
      }
      // A second tap while the first is on its way sends nothing.
      await tester.tap(find.byIcon(Icons.favorite));
      await tester.pump();
      turned();

      answer.complete({'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': 1});
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        turned();
      }
      await tester.pumpAndSettle();
      turned();

      expect(server.asked('POST /items/item-console/like'), 1);
      expect(server.asked('GET /items/item-console'), fetched);
    });

    testWidgets('2. …and taking it back is the same', (tester) async {
      server.overrides['GET /items/item-console'] =
          {...FakeServer.console, 'owner': FakeServer.kari, 'likedByMe': true};
      final answer = Completer<Object?>();
      server.overrides['DELETE /items/item-console/like'] = (http.Request _) => answer.future;
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));
      final fetched = server.asked('GET /items/item-console');

      await tester.tap(find.byIcon(Icons.favorite));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(spinner, findsNothing);
        expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      }
      answer.complete(<String, Object?>{});
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(server.asked('GET /items/item-console'), fetched);
    });

    testWidgets('3. a refused heart turns back and says why', (tester) async {
      final answer = Completer<Object?>();
      server.overrides['POST /items/item-console/like'] = (http.Request _) => answer.future;
      await openListing(tester);

      await tester.tap(find.byIcon(Icons.favorite_border));
      await tester.pump();
      expect(find.byIcon(Icons.favorite), findsOneWidget);
      answer.complete(500);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(find.text('Noe gikk galt hos oss.'), findsOneWidget);
    });
  });
}

/// A picture host that never answers.
class _Silent implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) => Completer<HttpClientRequest>().future;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
