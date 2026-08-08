import 'package:checkpost/data/library_store.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/design/theme.dart';
import 'package:checkpost/design/tokens.dart';
import 'package:checkpost/state/library_controller.dart';
import 'package:checkpost/ui/home_screen.dart';
import 'package:checkpost/ui/list_screen.dart';
import 'package:checkpost/ui/scope.dart';
import 'package:checkpost/ui/widgets/check_mark.dart';
import 'package:checkpost/ui/widgets/composer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

void main() {
  late FakeServer server;

  setUp(() => server = FakeServer(title: 'Cabin, Friday'));

  Widget wrap(Widget child, {Brightness brightness = Brightness.light}) {
    final colors = brightness == Brightness.dark
        ? CheckpostColors.dark
        : CheckpostColors.light;
    return CheckpostApiScope(
      api: server.client(),
      child: MaterialApp(
        theme: buildTheme(colors, brightness),
        home: CheckpostTheme(colors: colors, child: child),
        builder: (context, child) =>
            CheckpostTheme(colors: colors, child: child ?? const SizedBox()),
      ),
    );
  }

  LibraryController libraryWith(List<SavedList> lists) {
    final library = LibraryController(
      store: MemoryLibraryStore(lists),
      api: server.client(),
    );
    // Writes to the index are debounced, so a test that ends mid-burst would
    // leave a live timer behind and fail on the pending-timer check.
    addTearDown(library.flush);
    return library;
  }

  SavedList savedList({int done = 0, int total = 0}) => SavedList(
    id: server.listId,
    token: server.token,
    title: 'Cabin, Friday',
    doneCount: done,
    totalCount: total,
    lastOpenedAt: DateTime(2026, 8, 1),
  );

  group('home screen', () {
    testWidgets('the empty state teaches the product, not the void', (
      tester,
    ) async {
      final library = libraryWith(const []);
      await library.load();
      await tester.pumpWidget(wrap(HomeScreen(library: library)));
      await tester.pump();

      expect(find.text('No lists yet'), findsOneWidget);
      expect(find.textContaining('A list is a link'), findsOneWidget);
      // Both real next actions are on screen, not hidden behind a menu.
      expect(find.text('New list'), findsOneWidget);
      expect(find.text('Open a link someone sent'), findsOneWidget);
    });

    testWidgets('a saved list shows its progress as a fact, not a score', (
      tester,
    ) async {
      final library = libraryWith([savedList(done: 2, total: 5)]);
      await library.load();
      await tester.pumpWidget(wrap(HomeScreen(library: library)));
      await tester.pump();

      expect(find.text('Cabin, Friday'), findsOneWidget);
      expect(find.text('2 of 5 done'), findsOneWidget);
      // No percentage, no celebration.
      expect(find.textContaining('%'), findsNothing);
    });

    testWidgets('an all-done list says so plainly', (tester) async {
      final library = libraryWith([savedList(done: 4, total: 4)]);
      await library.load();
      await tester.pumpWidget(wrap(HomeScreen(library: library)));
      await tester.pump();

      expect(find.text('All 4 done'), findsOneWidget);
    });
  });

  group('opening a list from home', () {
    testWidgets('does not mark the home screen dirty while it is building', (
      tester,
    ) async {
      // The regression this exists for: ListScreen.initState touched the
      // library, the library notified its listeners, and the home screen was
      // one of them, halfway through building the route transition. That threw
      // "setState() called during build" on a real device every single time.
      //
      // The earlier tests missed it because they mounted ListScreen directly,
      // with no home screen listening underneath. This one navigates the way a
      // person does.
      server.addItem('Firewood');
      final library = libraryWith([savedList(total: 1)]);
      await library.load();
      await tester.pumpWidget(
        wrap(HomeScreen(library: library, realtimeFactory: noRealtime)),
      );
      await tester.pump();

      await tester.tap(find.text('Cabin, Friday'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Firewood'), findsOneWidget);
    });

    testWidgets('records the visit once the frame is done', (tester) async {
      final library = libraryWith([savedList(total: 1)]);
      await library.load();
      final before = library.lists.single.lastOpenedAt;

      await tester.pumpWidget(
        wrap(HomeScreen(library: library, realtimeFactory: noRealtime)),
      );
      await tester.pump();
      await tester.tap(find.text('Cabin, Friday'));
      await tester.pumpAndSettle();

      expect(library.lists.single.lastOpenedAt.isAfter(before), isTrue);
      expect(tester.takeException(), isNull);
    });
  });

  group('list screen', () {
    Future<void> openList(
      WidgetTester tester,
      LibraryController library,
    ) async {
      await library.load();
      await tester.pumpWidget(
        wrap(
          ListScreen(
            library: library,
            listId: server.listId,
            realtimeFactory: noRealtime,
          ),
        ),
      );
      // Snapshot arrives, then the frame that shows it.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    }

    testWidgets('shows the list and its items', (tester) async {
      server
        ..addItem('Firewood')
        ..addItem('Coffee', checked: true);
      final library = libraryWith([savedList(total: 2, done: 1)]);
      await openList(tester, library);

      expect(find.text('Cabin, Friday'), findsOneWidget);
      expect(find.text('Firewood'), findsOneWidget);
      expect(find.text('Coffee'), findsOneWidget);
      // Checked items live on their own shelf, labelled with a count.
      expect(find.text('Done · 1'), findsOneWidget);
    });

    testWidgets('tapping a row ticks it off immediately', (tester) async {
      server.addItem('Firewood');
      final library = libraryWith([savedList(total: 1)]);
      await openList(tester, library);

      expect(
        tester.widget<CheckMark>(find.byType(CheckMark).first).checked,
        isFalse,
      );

      await tester.tap(find.text('Firewood'));
      await tester.pump();

      // No await on the network: the tick is on screen in the very next frame.
      expect(
        tester.widget<CheckMark>(find.byType(CheckMark).first).checked,
        isTrue,
      );

      await tester.pumpAndSettle();
      expect(server.items.single['checked'], isTrue);
    });

    testWidgets('checked text is struck through, not just dimmed', (
      tester,
    ) async {
      server.addItem('Coffee', checked: true);
      final library = libraryWith([savedList(total: 1, done: 1)]);
      await openList(tester, library);

      final style = tester.widget<Text>(find.text('Coffee')).style;
      // Colour alone is never the signal. This is the colour-blind-safe
      // requirement from PRODUCT.md, asserted rather than hoped for.
      expect(
        DefaultTextStyle.of(
              tester.element(find.text('Coffee')),
            ).style.decoration ??
            style?.decoration,
        TextDecoration.lineThrough,
      );
    });

    testWidgets('adding an item puts it on screen before the network answers', (
      tester,
    ) async {
      final library = libraryWith([savedList()]);
      await openList(tester, library);

      await tester.enterText(find.byType(TextField).last, 'Firewood');
      await tester.pump();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(find.text('Firewood'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(server.items.single['text'], 'Firewood');
    });

    testWidgets('the empty list teaches the composer', (tester) async {
      final library = libraryWith([savedList()]);
      await openList(tester, library);

      expect(find.text('Nothing on the list yet'), findsOneWidget);
      expect(find.textContaining('press enter'), findsOneWidget);
    });

    testWidgets('a replaced link is a plain sentence with a way out', (
      tester,
    ) async {
      server.revoked.add(server.token);
      final library = libraryWith([savedList()]);
      await openList(tester, library);

      expect(find.text('This link was replaced'), findsOneWidget);
      expect(find.textContaining('Ask them for the new one'), findsOneWidget);
      expect(find.text('Back to your lists'), findsOneWidget);
    });

    testWidgets('being offline is a quiet strip, not an error screen', (
      tester,
    ) async {
      server.offline = true;
      final library = libraryWith([savedList()]);
      await openList(tester, library);

      expect(find.textContaining('Offline'), findsOneWidget);
      // The composer is still there, so you can keep working.
      expect(find.byType(TextField), findsWidgets);
    });

    testWidgets('presence appears only when somebody else is here', (
      tester,
    ) async {
      server.addItem('Firewood');
      final library = libraryWith([savedList(total: 1)]);
      await openList(tester, library);

      // No socket in a widget test, so presence stays at one, and one person
      // on a list is not news.
      expect(find.textContaining('here'), findsNothing);
    });
  });

  group('a link that can only look', () {
    testWidgets('shows the list and offers nothing that would change it', (
      tester,
    ) async {
      server
        ..access = 'read'
        ..addItem('Firewood');
      final library = libraryWith([savedList(total: 1)]);
      await library.load();
      await tester.pumpWidget(
        wrap(
          ListScreen(
            library: library,
            listId: server.listId,
            realtimeFactory: noRealtime,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      // Everything is visible. Nothing is on offer.
      expect(find.text('Firewood'), findsOneWidget);
      expect(find.text('Read only'), findsOneWidget);
      expect(find.byType(Composer), findsNothing);
      expect(find.textContaining('cannot change it'), findsOneWidget);

      // Tapping the row does not tick it, and does not ask the server either.
      final before = server.requestCount;
      await tester.tap(find.text('Firewood'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        tester.widget<CheckMark>(find.byType(CheckMark).first).checked,
        isFalse,
      );
      expect(server.requestCount, before);
    });

    testWidgets('a copy link says what it is instead of failing', (
      tester,
    ) async {
      server.access = 'copy';
      final library = libraryWith([savedList()]);
      await library.load();
      await tester.pumpWidget(
        wrap(
          ListScreen(
            library: library,
            listId: server.listId,
            realtimeFactory: noRealtime,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('This link hands out copies'), findsOneWidget);
      expect(find.textContaining('Open it in a browser'), findsOneWidget);
    });
  });

  group('theme', () {
    testWidgets('renders in dark mode without losing the accent', (
      tester,
    ) async {
      server.addItem('Firewood');
      final library = libraryWith([savedList(total: 1)]);
      await library.load();
      await tester.pumpWidget(
        wrap(
          ListScreen(
            library: library,
            listId: server.listId,
            realtimeFactory: noRealtime,
          ),
          brightness: Brightness.dark,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Firewood'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
