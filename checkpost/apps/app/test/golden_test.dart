@Tags(['golden'])
library;

import 'package:checkpost/data/library_store.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/design/theme.dart';
import 'package:checkpost/design/tokens.dart';
import 'package:checkpost/state/library_controller.dart';
import 'package:checkpost/ui/home_screen.dart';
import 'package:checkpost/ui/list_screen.dart';
import 'package:checkpost/ui/scope.dart';
import 'package:checkpost/ui/sheets/share_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

/// Pixel snapshots of every screen, in both colour schemes.
///
/// These are the design's regression tests: contrast, spacing and the row
/// anatomy are things you have to *look* at, and a golden is the only way to
/// keep looking at them after the fact. Regenerate deliberately with
/// `flutter test --update-goldens`, and read the diff as a design review.
void main() {
  late FakeServer server;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // The bundled brand font, so the goldens show the real typography rather
    // than the test framework's placeholder blocks.
    await (FontLoader('Schibsted Grotesk')..addFont(
          rootBundle.load('assets/fonts/SchibstedGrotesk-Variable.ttf'),
        ))
        .load();
    // Without this, every icon in the goldens is an empty box, which makes
    // the snapshots useless for reviewing the very affordances they exist for.
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  setUp(() => server = FakeServer(title: 'Cabin, Friday'));

  Widget wrap(Widget child, CheckpostColors colors, Brightness brightness) {
    return CheckpostApiScope(
      api: server.client(),
      child: MediaQuery(
        // Animations off: a golden of a half-drawn checkmark is a flaky test,
        // not a design review.
        data: const MediaQueryData(disableAnimations: true),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(colors, brightness),
          home: CheckpostTheme(colors: colors, child: child),
          builder: (context, child) =>
              CheckpostTheme(colors: colors, child: child ?? const SizedBox()),
        ),
      ),
    );
  }

  Future<void> shoot(
    WidgetTester tester,
    String name,
    Widget Function() build, {
    Size size = const Size(390, 844),
  }) async {
    for (final scheme in const [Brightness.light, Brightness.dark]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final colors = scheme == Brightness.dark
          ? CheckpostColors.dark
          : CheckpostColors.light;
      await tester.pumpWidget(wrap(build(), colors, scheme));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/$name-${scheme.name}.png'),
      );
    }
  }

  LibraryController libraryWith(List<SavedList> lists) =>
      LibraryController(store: MemoryLibraryStore(lists), api: server.client());

  SavedList saved({
    required String id,
    required String title,
    int done = 0,
    int total = 0,
    int daysAgo = 0,
  }) => SavedList(
    id: id,
    token: server.token,
    title: title,
    doneCount: done,
    totalCount: total,
    lastOpenedAt: DateTime(2026, 8, 6).subtract(Duration(days: daysAgo)),
  );

  testWidgets('home, empty', (tester) async {
    final library = libraryWith(const []);
    await library.load();
    await shoot(tester, 'home-empty', () => HomeScreen(library: library));
  });

  testWidgets('home, with lists', (tester) async {
    final library = libraryWith([
      saved(id: server.listId, title: 'Cabin, Friday', done: 2, total: 5),
      saved(
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Shopping',
        done: 7,
        total: 7,
        daysAgo: 1,
      ),
      saved(
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Before the flight: passports, chargers, the dog',
        total: 12,
        daysAgo: 4,
      ),
    ]);
    await library.load();
    await shoot(tester, 'home-lists', () => HomeScreen(library: library));
  });

  testWidgets('list, open and done items', (tester) async {
    server
      ..addItem('Firewood')
      ..addItem('Coffee, and the good one', note: 'The dark bag, not the tin')
      ..addItem('Someone remember the cards')
      ..addItem('Book the ferry', checked: true)
      ..addItem('Cabin key from Marit', checked: true);
    final library = libraryWith([
      saved(id: server.listId, title: 'Cabin, Friday', done: 2, total: 5),
    ]);
    await library.load();
    await shoot(
      tester,
      'list',
      () => ListScreen(
        library: library,
        listId: server.listId,
        realtimeFactory: noRealtime,
      ),
    );
  });

  testWidgets('list, empty', (tester) async {
    final library = libraryWith([
      saved(id: server.listId, title: 'Cabin, Friday'),
    ]);
    await library.load();
    await shoot(
      tester,
      'list-empty',
      () => ListScreen(
        library: library,
        listId: server.listId,
        realtimeFactory: noRealtime,
      ),
    );
  });

  testWidgets('share sheet', (tester) async {
    await shoot(
      tester,
      'share',
      () => Scaffold(
        body: ShareSheet(
          url:
              'https://checkpost.app/l/ObWVf6kPcePDbI5XEY0jmbSPqKmzEqKCPP8cxIRGR7g',
          listTitle: 'Cabin, Friday',
          onRotate: () async => 'https://checkpost.app/l/x',
        ),
      ),
      size: const Size(390, 940),
    );
  });
}
