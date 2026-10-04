import 'package:checkpost/data/library_store.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/design/theme.dart';
import 'package:checkpost/design/tokens.dart';
import 'package:checkpost/state/library_controller.dart';
import 'package:checkpost/ui/home_screen.dart';
import 'package:checkpost/ui/scope.dart';
import 'package:checkpost/ui/widgets/check_mark.dart';
import 'package:checkpost/ui/widgets/item_row.dart';
import 'package:checkpost/ui/widgets/tags.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

/// Tags, driven the way a person drives them: from the home screen, into the
/// list, through the tag bar and the sheets. Every one of these mounts the
/// list by navigating to it, because the crash that rule exists for only
/// shows up with the home screen listening underneath.
void main() {
  late FakeServer server;

  setUp(() => server = FakeServer(title: 'Cabin, Friday'));

  Widget wrap(Widget child) {
    const colors = CheckpostColors.light;
    return CheckpostApiScope(
      api: server.client(),
      child: MaterialApp(
        theme: buildTheme(colors, Brightness.light),
        home: CheckpostTheme(colors: colors, child: child),
        builder: (context, child) =>
            CheckpostTheme(colors: colors, child: child ?? const SizedBox()),
      ),
    );
  }

  LibraryController libraryWith() {
    final library = LibraryController(
      store: MemoryLibraryStore([
        SavedList(
          id: server.listId,
          token: server.token,
          title: 'Cabin, Friday',
          doneCount: 0,
          totalCount: server.items.length,
          lastOpenedAt: DateTime(2026, 8, 1),
        ),
      ]),
      api: server.client(),
    );
    addTearDown(library.flush);
    return library;
  }

  /// A phone, so the sheets and the tag bar are laid out the way they are on
  /// one, rather than on the test framework's landscape default.
  void phone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Future<void> openFromHome(
    WidgetTester tester,
    LibraryController library,
  ) async {
    await tester.tap(find.text('Cabin, Friday'));
    await tester.pumpAndSettle();
  }

  Future<LibraryController> startAtHome(WidgetTester tester) async {
    phone(tester);
    final library = libraryWith();
    await library.load();
    await tester.pumpWidget(
      wrap(HomeScreen(library: library, realtimeFactory: noRealtime)),
    );
    await tester.pump();
    await openFromHome(tester, library);
    expect(tester.takeException(), isNull);
    return library;
  }

  Future<void> backToHome(WidgetTester tester) async {
    await tester.pageBack();
    await tester.pumpAndSettle();
  }

  Finder rowOf(String text) =>
      find.ancestor(of: find.text(text), matching: find.byType(ItemRow));

  Finder chipsOn(String text) =>
      find.descendant(of: rowOf(text), matching: find.byType(TagChip));

  List<String> chipNamesOn(WidgetTester tester, String text) => [
    for (final chip in tester.widgetList<TagChip>(chipsOn(text))) chip.tag.name,
  ];

  Finder toggle(String name) => find.widgetWithText(TagToggle, name);

  /// A toggle in the open sheet, not the one in the tag bar behind it.
  Finder sheetToggle(String name) => find.descendant(
    of: find.byType(BottomSheet),
    matching: find.widgetWithText(TagToggle, name),
  );

  Finder field(String hint) => find.widgetWithText(TextField, hint);

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> openRow(WidgetTester tester, String text) async {
    await tester.tap(
      find.descendant(of: rowOf(text), matching: find.text(text)),
    );
    await tester.pumpAndSettle();
  }

  Future<void> submit(WidgetTester tester, Finder target, String text) async {
    await tester.ensureVisible(target);
    await tester.pumpAndSettle();
    await tester.enterText(target, text);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
  }

  testWidgets('a list with no tags looks as it always did', (tester) async {
    server
      ..addItem('Firewood')
      ..addItem('Coffee', checked: true);
    await startAtHome(tester);

    expect(find.text('Your order'), findsNothing);
    expect(find.byType(TagToggle), findsNothing);
    expect(find.byType(TagChip), findsNothing);
  });

  testWidgets('a row is tagged from its sheet, with a new tag or one the list '
      'already has', (tester) async {
    final bath = server.addTag('Bath', color: 'clay');
    final kettle = server.addItem('Kettle');
    final soap = server.addItem('Soap');
    await startAtHome(tester);

    await openRow(tester, 'Kettle');
    expect(find.text('Tags'), findsOneWidget);
    expect(tester.widget<TagToggle>(sheetToggle('Bath')).on, isFalse);

    // A new name makes the tag and puts it on the row, at once.
    await submit(tester, field('Add a tag'), 'Kitchen');
    expect(tester.widget<TagToggle>(sheetToggle('Kitchen')).on, isTrue);
    await tester.pumpAndSettle();
    final kitchen = server.tagNamed('Kitchen')!;
    expect(server.tagIdsOf(kettle['id'] as String), [kitchen['id']]);
    // And the field is empty again, ready for the next one.
    expect(tester.widget<TextField>(field('Add a tag')).controller!.text, '');

    // A tap on one the list has lands at a tap, not on Save.
    await tapVisible(tester, sheetToggle('Bath'));
    expect(tester.widget<TagToggle>(sheetToggle('Bath')).on, isTrue);
    expect(server.tagIdsOf(kettle['id'] as String).toSet(), {
      kitchen['id'],
      bath['id'],
    });

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    // On the row, under its text, in compareTags order.
    expect(chipNamesOn(tester, 'Kettle'), ['Bath', 'Kitchen']);

    // Typing a name the list already has, in another case, puts that one on.
    await openRow(tester, 'Soap');
    await submit(tester, field('Add a tag'), ' BATH ');
    await tester.pumpAndSettle();
    expect(server.tagIdsOf(soap['id'] as String), [bath['id']]);
    expect(server.tags, hasLength(2), reason: 'no second Bath');
    expect(tester.takeException(), isNull);
  });

  testWidgets('a tag typed and not yet added is added by Save', (
    tester,
  ) async {
    final kettle = server.addItem('Kettle');
    await startAtHome(tester);

    await openRow(tester, 'Kettle');
    await tester.enterText(field('Add a tag'), 'Kitchen');
    await tester.pump();
    // No Enter, no Add: Save is where the sheet is done, and it takes the
    // name along.
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    final kitchen = server.tagNamed('Kitchen')!;
    expect(server.tagIdsOf(kettle['id'] as String), [kitchen['id']]);
    expect(chipNamesOn(tester, 'Kettle'), ['Kitchen']);

    // Once there are tags, the sheet says they save at a tap.
    await openRow(tester, 'Kettle');
    expect(
      find.text('Tags save as you tap them, for everyone on the list.'),
      findsOneWidget,
    );
  });

  testWidgets('a filter shows only its rows, done ones too, and new rows join '
      'it', (tester) async {
    final kitchen = server.addTag('Kitchen');
    final bath = server.addTag('Bath');
    server
      ..addItem('Kettle', tagIds: [kitchen['id'] as String])
      ..addItem('Soap', tagIds: [bath['id'] as String])
      ..addItem('Stamps')
      ..addItem('Toast', checked: true, tagIds: [kitchen['id'] as String])
      ..addItem('Towel', checked: true, tagIds: [bath['id'] as String]);
    await startAtHome(tester);

    expect(find.text('Done · 2'), findsOneWidget);
    // Tapped at the far edge of the bar, where it sits on a narrow phone.
    await Scrollable.ensureVisible(
      tester.element(toggle('Kitchen')),
      alignment: 1,
    );
    await tester.pumpAndSettle();
    expect(tester.getRect(toggle('Kitchen')).right, closeTo(390, 1));
    await tester.tap(toggle('Kitchen'));
    await tester.pumpAndSettle();

    expect(tester.widget<TagToggle>(toggle('Kitchen')).on, isTrue);
    // Clear arrived in front of the chips and moved them along. The one just
    // tapped is still wholly on screen, so it can be tapped off again.
    final chip = tester.getRect(toggle('Kitchen'));
    expect(chip.left, greaterThanOrEqualTo(0));
    expect(chip.right, lessThanOrEqualTo(390));
    expect(rowOf('Kettle'), findsOneWidget);
    expect(rowOf('Soap'), findsNothing);
    expect(rowOf('Stamps'), findsNothing);
    // The done shelf is filtered too, and its count follows.
    expect(rowOf('Toast'), findsOneWidget);
    expect(rowOf('Towel'), findsNothing);
    expect(find.text('Done · 1'), findsOneWidget);
    expect(find.text('Clear'), findsWidgets);
    expect(find.text('Add to Kitchen'), findsOneWidget);

    // A row added under the filter carries its tag, so it stays in view.
    await tester.enterText(field('Add to Kitchen'), 'Spoons');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(rowOf('Spoons'), findsOneWidget);
    await tester.pumpAndSettle();
    final spoons = server.items.firstWhere((item) => item['text'] == 'Spoons');
    expect(spoons['tagIds'], [kitchen['id']]);

    // Two on means rows with either.
    await tapVisible(tester, toggle('Bath'));
    expect(rowOf('Soap'), findsOneWidget);
    expect(find.text('Add to Bath and Kitchen'), findsOneWidget);

    // Clear puts every row back. The first "Clear" is the bar's.
    await tapVisible(tester, find.text('Clear').first);
    expect(rowOf('Stamps'), findsOneWidget);
    expect(find.text('Add something'), findsOneWidget);
  });

  testWidgets('clearing done rows under a filter says it takes the hidden ones '
      'too', (tester) async {
    final kitchen = server.addTag('Kitchen');
    final bath = server.addTag('Bath');
    server
      ..addItem('Kettle', tagIds: [kitchen['id'] as String])
      ..addItem('Toast', checked: true, tagIds: [kitchen['id'] as String])
      ..addItem('Towel', checked: true, tagIds: [bath['id'] as String]);
    await startAtHome(tester);

    await tapVisible(tester, toggle('Kitchen'));
    expect(find.text('Done · 1'), findsOneWidget);
    // The shelf's Clear, not the bar's. It takes both done rows, and the
    // heading beside it counted one, so the confirm has to say so.
    await tapVisible(tester, find.text('Clear').last);
    expect(find.text('Clear 2 done items?'), findsOneWidget);
    expect(
      find.textContaining('including one the tag filter is hiding'),
      findsOneWidget,
    );
  });

  testWidgets('a filter that leaves nothing open says so, with the way back', (
    tester,
  ) async {
    final garden = server.addTag('Garden');
    server
      ..addItem('Firewood')
      ..addItem('Seeds', checked: true, tagIds: [garden['id'] as String]);
    await startAtHome(tester);

    await tapVisible(tester, toggle('Garden'));
    expect(find.text('Nothing left tagged Garden.'), findsOneWidget);
    // The done shelf still shows what the filter matches.
    expect(rowOf('Seeds'), findsOneWidget);

    await tester.tap(find.text('Show every row'));
    await tester.pump();
    expect(rowOf('Firewood'), findsOneWidget);
    expect(find.text('Nothing left tagged Garden.'), findsNothing);
  });

  testWidgets('grouped by tag: a heading per tag in order, No tag last, and '
      'nothing to drag', (tester) async {
    final kitchen = server.addTag('Kitchen');
    final bath = server.addTag('Bath');
    server
      ..addItem('Stamps')
      ..addItem('Kettle', tagIds: [kitchen['id'] as String])
      ..addItem(
        'Towels',
        tagIds: [kitchen['id'] as String, bath['id'] as String],
      )
      ..addItem('Soap', tagIds: [bath['id'] as String])
      ..addItem('Toast', checked: true, tagIds: [kitchen['id'] as String]);
    final library = await startAtHome(tester);

    // Your order: every open row has a grip.
    expect(find.byIcon(Icons.drag_indicator_rounded), findsNWidgets(4));

    await tester.tap(find.text('By tag'));
    await tester.pump();

    final headings = tester.widgetList<TagGroupHeading>(
      find.byType(TagGroupHeading),
    );
    expect(
      [for (final h in headings) h.tag?.name ?? 'No tag'],
      ['Bath', 'Kitchen', 'No tag'],
    );
    expect([for (final h in headings) h.count], [2, 1, 1]);
    // A row with two tags sits under the first of them.
    double top(String text) => tester.getTopLeft(rowOf(text)).dy;
    expect(top('Towels'), lessThan(top('Kettle')));
    expect(top('Soap'), lessThan(top('Kettle')));
    expect(top('Stamps'), greaterThan(top('Kettle')));

    // Nothing to drag, and no column kept open for a grip that is not there:
    // the done row's box lines up with the open rows' boxes.
    expect(find.byIcon(Icons.drag_indicator_rounded), findsNothing);
    double boxX(String text) => tester
        .getTopLeft(
          find.descendant(of: rowOf(text), matching: find.byType(CheckMark)),
        )
        .dx;
    expect(boxX('Toast'), boxX('Kettle'));
    expect(boxX('Kettle'), Space.gutter + (Space.minTarget - 24) / 2);

    // And the sheet does not offer to move a row in an order not on screen.
    await openRow(tester, 'Kettle');
    expect(find.text('Move up'), findsNothing);
    expect(find.text('Move down'), findsNothing);
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    // Grouping is this device's view of the list, so it is still grouped the
    // next time the list is opened.
    await backToHome(tester);
    await openFromHome(tester, library);
    expect(find.byType(TagGroupHeading), findsNWidgets(3));
    expect(tester.takeException(), isNull);
  });

  testWidgets('the done shelf folds, and stays folded when the list is opened '
      'again', (tester) async {
    server
      ..addItem('Firewood')
      ..addItem('Coffee', checked: true);
    final handle = tester.ensureSemantics();
    final library = await startAtHome(tester);

    expect(rowOf('Coffee'), findsOneWidget);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Done, 1')),
      isSemantics(isButton: true, hasExpandedState: true, isExpanded: true),
    );

    await tester.tap(find.text('Done · 1'));
    await tester.pump();
    // The rows go at once, and the heading stays, with Clear beside it.
    expect(rowOf('Coffee'), findsNothing);
    expect(find.text('Done · 1'), findsOneWidget);
    expect(find.text('Clear'), findsOneWidget);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Done, 1')),
      isSemantics(hasExpandedState: true, isExpanded: false),
    );

    await backToHome(tester);
    await openFromHome(tester, library);
    expect(find.text('Done · 1'), findsOneWidget);
    expect(rowOf('Coffee'), findsNothing);

    await tester.tap(find.text('Done · 1'));
    await tester.pump();
    expect(rowOf('Coffee'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('the Tags sheet renames, recolours and deletes, and says what a '
      'delete takes', (tester) async {
    final kitchen = server.addTag('Kitchen', color: 'clay');
    server.addTag('Bread', color: 'teal');
    for (final text in ['Kettle', 'Toaster', 'Spoons', 'Bowl']) {
      server.addItem(text, tagIds: [kitchen['id'] as String]);
    }
    server.addItem('Bag');
    final handle = tester.ensureSemantics();
    await startAtHome(tester);

    await tapVisible(tester, find.text('Edit tags'));
    expect(find.text('Tags'), findsOneWidget);
    expect(find.text('4 rows'), findsOneWidget);
    expect(find.text('No rows'), findsOneWidget);

    // One tag opens at a time, underneath its own line.
    await tester.tap(find.text('4 rows'));
    await tester.pumpAndSettle();
    expect(find.text('Name'), findsOneWidget);

    // A name another tag has is caught here and never sent.
    final name = find.widgetWithText(TextField, 'Kitchen');
    await tester.enterText(name, 'bread');
    await tester.pump();
    expect(find.text('There is already a tag called “Bread”.'), findsOneWidget);
    final save = find.widgetWithText(FilledButton, 'Save name');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);

    await tester.enterText(name, 'Cooking');
    await tester.pump();
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(server.tags.first['name'], 'Cooking');

    // The eight colours, named for a screen reader, on at a tap.
    for (final color in TagColor.values) {
      expect(find.bySemanticsLabel(color.label), findsOneWidget);
    }
    expect(
      tester.getSemantics(find.bySemanticsLabel('Clay')),
      isSemantics(isSelected: true, isButton: true),
    );
    await tester.tap(find.bySemanticsLabel('Olive'));
    await tester.pumpAndSettle();
    expect(server.tags.first['color'], 'olive');
    expect(
      tester.getSemantics(find.bySemanticsLabel('Olive')),
      isSemantics(isSelected: true),
    );

    // Deleting asks first, in words, with the accent and no second red.
    await tapVisible(tester, find.text('Delete tag'));
    expect(
      find.text('Takes Cooking off 4 rows, for everyone. There is no undo.'),
      findsOneWidget,
    );
    await tapVisible(tester, find.text('Delete the tag'));
    expect(server.tags.map((tag) => tag['name']), ['Bread']);
    expect(
      server.items.every((item) => (item['tagIds'] as List).isEmpty),
      isTrue,
    );

    // A tag nobody wears says so instead of a count.
    await tester.tap(find.text('No rows'));
    await tester.pumpAndSettle();
    await tapVisible(tester, find.text('Delete tag'));
    expect(
      find.text('No rows wear it. It goes for everyone, and there is no undo.'),
      findsOneWidget,
    );
    await tapVisible(tester, find.text('Keep it'));
    expect(server.tags, hasLength(1));

    // And a new one from the foot of the sheet.
    await submit(tester, field('New tag'), 'Garden');
    await tester.pumpAndSettle();
    expect(server.tagNamed('Garden'), isNotNull);
    expect(find.text('Garden'), findsWidgets);
    handle.dispose();
  });

  testWidgets('the Tags sheet with nothing in it says how to make one', (
    tester,
  ) async {
    final only = server.addTag('Only');
    server.addItem('Row', tagIds: [only['id'] as String]);
    await startAtHome(tester);

    await tapVisible(tester, find.text('Edit tags'));
    await tester.tap(find.text('1 row'));
    await tester.pumpAndSettle();
    expect(
      find.text('Takes Only off 1 row, for everyone. There is no undo.'),
      findsNothing,
    );
    await tapVisible(tester, find.text('Delete tag'));
    expect(
      find.text('Takes Only off 1 row, for everyone. There is no undo.'),
      findsOneWidget,
    );
    await tapVisible(tester, find.text('Delete the tag'));

    expect(
      find.text('No tags yet. Make one here, or from any row’s sheet.'),
      findsOneWidget,
    );
  });

  testWidgets('a row holds ten tags, and says so', (tester) async {
    final ids = [
      for (var i = 0; i <= Limits.tagsPerItem; i++)
        server.addTag('T$i')['id'] as String,
    ];
    final row = server.addItem('Busy', tagIds: ids.take(10).toList());
    await startAtHome(tester);

    await openRow(tester, 'Busy');
    expect(find.text('A row holds 10 tags.'), findsOneWidget);
    // The one that is off cannot go on, and the field takes nothing more.
    expect(tester.widget<TagToggle>(sheetToggle('T10')).enabled, isFalse);
    expect(tester.widget<TextField>(field('Add a tag')).enabled, isFalse);
    final before = server.requestCount;
    await tester.ensureVisible(sheetToggle('T10'));
    await tester.tap(sheetToggle('T10'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(server.requestCount, before);

    // Taking one off is always allowed, and makes room.
    await tapVisible(tester, sheetToggle('T0'));
    expect(find.text('A row holds 10 tags.'), findsNothing);
    expect(tester.widget<TagToggle>(sheetToggle('T10')).enabled, isTrue);
    expect(server.tagIdsOf(row['id'] as String), hasLength(9));
  });

  testWidgets('a list at fifty tags says why a new name will not go on', (
    tester,
  ) async {
    for (var i = 0; i < Limits.tagsPerList; i++) {
      server.addTag('Tag $i');
    }
    server.addItem('Row');
    await startAtHome(tester);

    await openRow(tester, 'Row');
    final add = find.widgetWithText(FilledButton, 'Add');
    await tester.ensureVisible(field('Add a tag'));
    await tester.enterText(field('Add a tag'), 'Something new');
    await tester.pump();
    expect(
      find.text(
        'This list holds 50 tags. Delete one in Edit tags to make room.',
      ),
      findsOneWidget,
    );
    expect(tester.widget<FilledButton>(add).onPressed, isNull);

    // A name the list already has still goes on: nothing new is made.
    await tester.enterText(field('Add a tag'), 'tag 7');
    await tester.pump();
    expect(find.textContaining('This list holds 50 tags'), findsNothing);
    expect(tester.widget<FilledButton>(add).onPressed, isNotNull);
  });

  testWidgets('a link that can only look sees the tags and the bar, and '
      'cannot edit them', (tester) async {
    final kitchen = server.addTag('Kitchen');
    server
      ..access = 'read'
      ..addItem('Kettle', tagIds: [kitchen['id'] as String])
      ..addItem('Stamps');
    await startAtHome(tester);

    expect(chipNamesOn(tester, 'Kettle'), ['Kitchen']);
    expect(find.text('Your order'), findsOneWidget);
    expect(find.text('By tag'), findsOneWidget);
    expect(toggle('Kitchen'), findsOneWidget);
    expect(find.text('Edit tags'), findsNothing);

    // Looking through a filter changes nothing for anyone, so it still works.
    final before = server.requestCount;
    await tapVisible(tester, toggle('Kitchen'));
    expect(rowOf('Stamps'), findsNothing);
    expect(server.requestCount, before);
  });

  test('the words for one, two and three tags', () {
    Tag tag(String name) => Tag(
      id: name,
      listId: 'list',
      name: name,
      color: TagColor.clay,
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
    );
    final kitchen = tag('Kitchen');
    final bath = tag('Bath');
    final garden = tag('Garden');

    expect(composerHintFor(const []), 'Add something');
    expect(composerHintFor([kitchen]), 'Add to Kitchen');
    expect(composerHintFor([kitchen, bath]), 'Add to Kitchen and Bath');
    expect(composerHintFor([kitchen, bath, garden]), 'Add with 3 tags');
    expect(nothingLeftFor([kitchen]), 'Nothing left tagged Kitchen.');
    expect(
      nothingLeftFor([kitchen, bath]),
      'Nothing left tagged Kitchen or Bath.',
    );
    expect(
      nothingLeftFor([kitchen, bath, garden]),
      'Nothing left with those 3 tags.',
    );
    expect(rowCount(0), 'No rows');
    expect(rowCount(1), '1 row');
    expect(rowCount(4), '4 rows');
  });
}
