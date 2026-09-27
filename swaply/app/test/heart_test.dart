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
import 'dart:convert';
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
import 'package:swaply_app/widgets/common.dart';

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

/// Any spinner but the one a pull draws over the grid, which is the pull's.
final gridSpinner =
    find.byWidgetPredicate((w) => w is ProgressIndicator && w is! RefreshProgressIndicator);

/// Pulls the collage down, the way a thumb does, and leaves the pumping to
/// the test. The pull asks once its spinner has come down.
void pull(WidgetTester tester) =>
    unawaited(tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show());

/// [pull], and frames until the collage has been asked for — with the answer
/// still to come.
Future<void> pulledUntilAsked(WidgetTester tester) async {
  final before = server.asked('GET /discover');
  pull(tester);
  for (var i = 0; i < 60 && server.asked('GET /discover') == before; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

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
  /// has moved. [pulled] lets the pull's own spinner be there.
  Future<void> holds({int frames = 20, bool pulled = false, void Function()? each}) async {
    for (var i = 0; i < frames; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      unchanged('frame $i', pulled: pulled);
      each?.call();
    }
  }

  void unchanged(String when, {bool pulled = false}) {
    expect(pulled ? gridSpinner : spinner, findsNothing, reason: when);
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

    testWidgets('9. what the page was told when it opened is on its card from the first frame back',
        (tester) async {
      // Liked from somewhere else since the collage was asked for: the page
      // asked later and knew, and the card went on saying otherwise until a
      // collage asked for on the way back had landed.
      final id = await scrolledDown(tester);
      final title = things.firstWhere((t) => t['id'] == id)['title'] as String;
      slowCollage(const Duration(milliseconds: 600));
      wished.add(id);
      final before = Collage(tester);
      expect(heartOf(id), findsOneWidget);

      await tester.tap(find.text(title));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.favorite), findsOneWidget);
      Navigator.of(tester.element(find.byType(ItemDetailScreen))).pop();

      await before.holds(frames: 45, each: () => expect(heartOf(id, liked: true), findsOneWidget));
      await tester.pumpAndSettle();
      expect(heartOf(id, liked: true), findsOneWidget);
    });

    testWidgets('10. the card\'s own heart refused after the page\'s does not turn the card back',
        (tester) async {
      // The card's heart was on its way when its page was opened and the
      // heart pressed there. The card's was refused after that, and turned
      // the card — and the collage — back over what the page had just done.
      final id = await scrolledDown(tester);
      final title = things.firstWhere((t) => t['id'] == id)['title'] as String;
      final refusal = Completer<void>();
      var likes = 0;
      server.overrides['POST /items/$id/like'] = (http.Request _) async {
        if (++likes == 1) {
          await refusal.future;
          return 500;
        }
        wished.add(id);
        return {'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': 1};
      };

      await tester.tap(heartOf(id));
      await tester.pump();
      await tester.tap(find.text(title));
      await tester.pumpAndSettle();
      // The page asked before the server had the card's heart.
      await tester.tap(find.byIcon(Icons.favorite_border));
      await tester.pumpAndSettle();
      refusal.complete();
      await tester.pumpAndSettle();
      expect(likes, 2);
      expect(find.byIcon(Icons.favorite), findsOneWidget);

      // From the first frame back, and not only once a collage asked for on
      // the way back has put it right.
      slowCollage(const Duration(milliseconds: 600));
      Navigator.of(tester.element(find.byType(ItemDetailScreen))).pop();
      for (var i = 0; i < 45; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(heartOf(id, liked: true), findsOneWidget, reason: 'frame $i');
      }
      await tester.pumpAndSettle();
      expect(heartOf(id, liked: true), findsOneWidget);
      expect(wished, {id});
    });
  });

  group('05 asked again', () {
    testWidgets('1. pulled down, the grid stays and only the pull spins', (tester) async {
      // A pull was the first load over again: the grid went, a spinner stood
      // in its place, and every picture was drawn again.
      await mount(tester, const DiscoverScreen());
      final before = Collage(tester);
      final discovered = server.asked('GET /discover');

      pull(tester);
      var pulling = false;
      await before.holds(
          frames: 30,
          pulled: true,
          each: () => pulling |= find.byType(RefreshProgressIndicator).evaluate().isNotEmpty);
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(pulling, isTrue);
      expect(server.asked('GET /discover'), discovered + 1);
    });

    testWidgets('2. …and a pull that gets no answer says so over the grid', (tester) async {
      await mount(tester, const DiscoverScreen());
      final before = Collage(tester);
      server.overrides['GET /discover'] = 500;

      pull(tester);
      await before.holds(pulled: true);
      await tester.pumpAndSettle();
      before.unchanged('settled');

      expect(find.byType(SwaplyToast), findsOneWidget);
      expect(find.text('Noe gikk galt hos oss.'), findsOneWidget);
    });

    testWidgets('3. an answer to an older asking does not replace a newer one by landing last',
        (tester) async {
      // A pull on its way, and a chip tapped meanwhile: the pull's answer is
      // the whole collage, and landing after the chip's put it back.
      await mount(tester, const DiscoverScreen());
      server.overrides['GET /discover'] = (http.Request request) {
        final tools = request.url.queryParameters['category'] == 'verktoy';
        return Future.delayed(
            Duration(milliseconds: tools ? 100 : 600),
            () => tools
                ? {'total': 1, 'items': [FakeServer.drill]}
                : {'total': things.length, 'items': things});
      };

      final discovered = server.asked('GET /discover');
      await pulledUntilAsked(tester);
      expect(server.asked('GET /discover'), discovered + 1);
      await tester.tap(find.text('Verktøy'));
      await tester.pumpAndSettle();

      expect(find.text('Bosch drill 18V'), findsOneWidget);
      expect(find.text('1 treff'), findsOneWidget);
      expect(find.text('Ting 0'), findsNothing);
    });
  });

  group('05 the long press', () {
    // «Ikke vis meg slike» hides a kind: the category and the subcategory,
    // compared without regard to case, or the listing alone when it has no
    // subcategory. The server here does what `backend/src/lib/hidden.ts` does.
    final kinds = [
      {...FakeServer.console, 'id': 'item-a', 'title': 'Konsoll A', 'subcategory': 'Konsoller'},
      {...FakeServer.console, 'id': 'item-b', 'title': 'Konsoll B', 'subcategory': 'konsoller'},
      {...FakeServer.console, 'id': 'item-c', 'title': 'Spill C', 'subcategory': 'Spill'},
      {...FakeServer.console, 'id': 'item-d', 'title': 'Ting D'},
      {
        ...FakeServer.drill,
        'id': 'item-e',
        'title': 'Drill E',
        'ownerId': 'per-1',
        'owner': {'id': 'per-1', 'displayName': 'Per H.'},
      },
    ].map((t) => {'owner': FakeServer.kari, ...t}).toList();

    late List<Map<String, Object?>> hidden;
    late bool blocked;

    bool hides(Map<String, Object?> rule, Map<String, Object?> t) => rule['itemId'] != null
        ? rule['itemId'] == t['id']
        : rule['category'] == t['category'] &&
            (rule['subcategory'] as String).toLowerCase() ==
                ((t['subcategory'] as String?) ?? '').toLowerCase();

    List<Map<String, Object?>> shown() => [
          for (final t in kinds)
            if (!hidden.any((h) => hides(h, t)) && !(blocked && t['ownerId'] == 'kari-1')) t,
        ];

    setUp(() {
      hidden = [];
      blocked = false;
      // Worked out as it is answered, the way a server answers what it has
      // done by then.
      server.overrides['GET /discover'] = (http.Request _) =>
          Future.delayed(network, () => {'total': shown().length, 'items': shown()});
      server.overrides['POST /me/hidden'] = (http.Request request) {
        final id = (jsonDecode(request.body) as Map)['itemId'];
        final t = kinds.firstWhere((t) => t['id'] == id);
        final kind = t['subcategory'] as String?;
        final rule = {
          'category': t['category'],
          'subcategory': kind,
          'itemId': kind == null ? id : null,
        };
        if (!hidden.any((h) => h.toString() == rule.toString())) hidden.add(rule);
        // With the count after it, as the real route answers.
        return {'hidden': rule, 'hiddenCount': hidden.length};
      };
      server.overrides['DELETE /me/hidden'] = (http.Request _) {
        hidden.clear();
        return <String, Object?>{};
      };
      server.overrides['GET /me'] =
          (http.Request _) => {...FakeServer.me, 'hiddenCount': hidden.length};
      server.overrides['POST /reports'] = (http.Request request) {
        if ((jsonDecode(request.body) as Map)['block'] == true) blocked = true;
        return {'ok': true, 'blocked': blocked};
      };
    });

    Finder card(String id) => find.byKey(ValueKey('item-$id'));

    Future<void> hide(WidgetTester tester, String title) async {
      await tester.longPress(find.text(title));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ikke vis meg slike'));
    }

    testWidgets('1. «Ikke vis meg slike» takes the kind out at once, and «Angre» brings it back',
        (tester) async {
      await mount(tester, const DiscoverScreen());
      final discovered = server.asked('GET /discover');
      expect(find.text('5 treff'), findsOneWidget);

      await hide(tester, 'Konsoll A');
      await tester.pump();
      // On the tap, both spellings of the kind, and nothing else.
      expect(card('a'), findsNothing);
      expect(card('b'), findsNothing);
      for (final id in ['c', 'd', 'e']) {
        expect(card(id), findsOneWidget, reason: id);
      }
      expect(spinner, findsNothing);

      await tester.pumpAndSettle();
      expect(server.bodies['POST /me/hidden'], {'itemId': 'item-a'});
      expect(find.text('Vi viser deg ikke flere slike.'), findsOneWidget);
      expect(find.text('3 treff'), findsOneWidget);
      // Taken out of the grid there is, not asked for again.
      expect(server.asked('GET /discover'), discovered);

      await tester.tap(find.text('Angre'));
      await tester.pumpAndSettle();
      expect(server.requests, contains('DELETE /me/hidden'));
      for (final id in ['a', 'b', 'c', 'd', 'e']) {
        expect(card(id), findsOneWidget, reason: id);
      }
      expect(find.text('5 treff'), findsOneWidget);
      expect(find.byType(SwaplyToast), findsNothing);
    });

    testWidgets('2. a listing with no subcategory takes only itself', (tester) async {
      await mount(tester, const DiscoverScreen());

      await hide(tester, 'Ting D');
      await tester.pumpAndSettle();

      expect(card('d'), findsNothing);
      for (final id in ['a', 'b', 'c', 'e']) {
        expect(card(id), findsOneWidget, reason: id);
      }
      // And it says so: «flere slike» promised the rest of the category too.
      expect(find.text('Vi viser deg ikke denne igjen.'), findsOneWidget);
      expect(find.text('Vi viser deg ikke flere slike.'), findsNothing);
    });

    testWidgets('3. no «Angre» when it would bring back more than this', (tester) async {
      // Showing hidden kinds again is all of them at once, so undoing one is
      // only offered while it is the only one.
      await mount(tester, const DiscoverScreen());

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();
      expect(find.text('Angre'), findsOneWidget);

      // A second, straight after: showing everything again would bring the
      // first back with it.
      await hide(tester, 'Spill C');
      await tester.pumpAndSettle();
      expect(find.text('Vi viser deg ikke flere slike.'), findsOneWidget);
      expect(find.text('Angre'), findsNothing);
    });

    testWidgets('…nor when something was hidden on another day', (tester) async {
      hidden.add({'category': 'verktoy', 'subcategory': 'Sager', 'itemId': null});
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': {...FakeServer.me, 'hiddenCount': 1},
      };
      await mount(tester, const DiscoverScreen());

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();
      expect(find.text('Vi viser deg ikke flere slike.'), findsOneWidget);
      expect(find.text('Angre'), findsNothing);
    });

    testWidgets('…nor when another phone hid something since this one last asked',
        (tester) async {
      // The count the session holds is from before, and says nothing is
      // hidden. The server's count after the hide is the one that knows.
      await mount(tester, const DiscoverScreen());
      expect(session.me?.hiddenCount, 0);
      hidden.add({'category': 'verktoy', 'subcategory': 'Sager', 'itemId': null});

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();
      expect(find.text('Vi viser deg ikke flere slike.'), findsOneWidget);
      expect(find.text('Angre'), findsNothing);
    });

    testWidgets('…and «Angre» on the first is spent once a second is pressed', (tester) async {
      // Two hides, the first one's toast still up with its «Angre» while the
      // second is on its way: showing everything again would take both.
      await mount(tester, const DiscoverScreen());
      final second = Completer<void>();
      final canned = server.overrides['POST /me/hidden'] as Object? Function(http.Request);
      server.overrides['POST /me/hidden'] = (http.Request request) async {
        if ((jsonDecode(request.body) as Map)['itemId'] == 'item-d') await second.future;
        return canned(request);
      };

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();
      expect(find.text('Angre'), findsOneWidget);
      await hide(tester, 'Ting D');
      await tester.pump();

      await tester.tap(find.text('Angre'));
      await tester.pumpAndSettle();
      expect(server.requests, isNot(contains('DELETE /me/hidden')));
      second.complete();
      await tester.pumpAndSettle();
      expect(card('a'), findsNothing);
      expect(card('d'), findsNothing);
    });

    testWidgets('4. refused, the kind comes back and it says why', (tester) async {
      await mount(tester, const DiscoverScreen());
      server.overrides['POST /me/hidden'] = 500;

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();

      expect(card('a'), findsOneWidget);
      expect(card('b'), findsOneWidget);
      expect(find.text('Noe gikk galt hos oss.'), findsOneWidget);
    });

    testWidgets('5. a collage asked for before it, landing after, does not bring the kind back',
        (tester) async {
      await mount(tester, const DiscoverScreen());
      // The server's word from before the kind was hidden, slow to arrive.
      server.overrides['GET /discover'] = (http.Request _) {
        final then = shown();
        return Future.delayed(
            const Duration(milliseconds: 600), () => {'total': then.length, 'items': then});
      };
      await pulledUntilAsked(tester);

      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();
      expect(card('a'), findsNothing);
      expect(card('b'), findsNothing);

      // Asked for after, the server's word is the grid's again: shown again
      // from somewhere else, the kind is back.
      hidden.clear();
      pull(tester);
      await tester.pumpAndSettle();
      expect(card('a'), findsOneWidget);
      expect(card('b'), findsOneWidget);
    });

    testWidgets('6. a report that blocks, from the long press, takes the owner\'s things away',
        (tester) async {
      // The menu took a callback for this and never called it, so a block
      // left everything of theirs in the grid until the tab came back. And
      // then it called it as the sheet closed, before the report was sent: a
      // server slower over the report than over the grid answered from
      // before the block. This one is.
      await mount(tester, const DiscoverScreen());
      final discovered = server.asked('GET /discover');
      server.overrides['POST /reports'] = (http.Request request) =>
          Future.delayed(const Duration(milliseconds: 400), () {
            if ((jsonDecode(request.body) as Map)['block'] == true) blocked = true;
            return {'ok': true, 'blocked': blocked};
          });

      await tester.longPress(find.text('Konsoll A'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rapporter'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Blokkér Kari N.'));
      await tester.pump();
      await tester.tap(find.text('Send rapport'));
      for (var i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(spinner, findsNothing, reason: 'frame $i');
      }
      await tester.pumpAndSettle();

      expect(server.bodies['POST /reports']?['block'], isTrue);
      expect(server.asked('GET /discover'), discovered + 1);
      for (final id in ['a', 'b', 'c', 'd']) {
        expect(card(id), findsNothing, reason: id);
      }
      expect(card('e'), findsOneWidget);
    });

    testWidgets('…but a report without a block leaves the grid as it is', (tester) async {
      await mount(tester, const DiscoverScreen());
      final discovered = server.asked('GET /discover');

      await tester.longPress(find.text('Konsoll A'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rapporter'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Send rapport'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /reports']?['block'], isFalse);
      expect(server.asked('GET /discover'), discovered);
      expect(card('a'), findsOneWidget);
    });

    testWidgets('7. and so does coming back from the owner\'s profile', (tester) async {
      await mount(tester, const DiscoverScreen());
      final discovered = server.asked('GET /discover');

      await tester.longPress(find.text('Konsoll A'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se profil'));
      await tester.pumpAndSettle();
      blocked = true;
      Navigator.of(tester.element(find.text('Kari N.').first)).pop();
      await tester.pumpAndSettle();

      expect(server.asked('GET /discover'), discovered + 1);
      expect(card('a'), findsNothing);
      expect(card('e'), findsOneWidget);
    });

    testWidgets('8. a quiet asking that overtakes a chip and fails leaves no old grid under it',
        (tester) async {
      // «Angre» asks for the grid again behind it. Pressed while a chip's
      // grid is on its way, it is the newer asking, so the chip's answer is
      // not taken — and when it failed, it kept «the grid on screen», which
      // under the spinner was the grid from before the chip.
      await mount(tester, const DiscoverScreen());
      await hide(tester, 'Konsoll A');
      await tester.pumpAndSettle();

      final chip = Completer<Object?>();
      var asked = 0;
      server.overrides['GET /discover'] = (http.Request _) => ++asked == 1 ? chip.future : unreachable;
      await tester.tap(find.text('Verktøy'));
      await tester.pump();
      expect(gridSpinner, findsOneWidget);

      await tester.tap(find.text('Angre'));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(asked, 2);
      // The chip's answer lands after, and is older than the asking that failed.
      chip.complete({'total': 1, 'items': [kinds[4]]});
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }

      expect(find.text('Fikk ikke kontakt'), findsOneWidget);
      expect(card('c'), findsNothing);
      expect(find.text('3 treff'), findsNothing);
      expect(find.text('5 treff'), findsNothing);

      // And from there, asked again, the chip's grid.
      server.overrides['GET /discover'] = {'total': 1, 'items': [kinds[4]]};
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();
      expect(card('e'), findsOneWidget);
      expect(card('c'), findsNothing);
      expect(find.text('1 treff'), findsOneWidget);
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
      // Said over the heart, not on it: pressing it again is what comes next.
      final heart = tester.getRect(find.byType(CircleAction).last);
      expect(tester.getRect(find.byType(SwaplyToast)).bottom, lessThan(heart.top - 14));
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
