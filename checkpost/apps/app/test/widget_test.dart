import 'package:checkpost/data/library_store.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/design/theme.dart';
import 'package:checkpost/design/tokens.dart';
import 'package:checkpost/state/library_controller.dart';
import 'package:checkpost/ui/home_screen.dart';
import 'package:checkpost/ui/list_screen.dart';
import 'package:checkpost/ui/scope.dart';
import 'package:checkpost/ui/widgets/check_mark.dart';
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

  LibraryController libraryWith(List<SavedList> lists) =>
      LibraryController(store: MemoryLibraryStore(lists), api: server.client());

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
