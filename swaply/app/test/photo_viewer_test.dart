// A listing's pictures open big, and are swiped between.
//
// A picture in the gallery on 04 opens them all at that one, and so does the
// round button at the gallery's foot, which is there because a picture does not
// say that it opens. 10b's strip opens its own the same way. Big, they are
// swiped between, pinched or double-tapped closer, and while one is close a
// finger moves round it instead of on to the next. Pulled down, or «✕», they
// go back, and the gallery is left on the one looked at last. A browser on a
// desk has arrows and Escape, and a mouse drags where a finger swipes. For
// somebody who asked for less motion nothing slides or fades.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/photo_viewer.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

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

/// Kari's console, with [count] pictures.
void pictures(int count) {
  final media = [for (var i = 1; i <= count; i++) 'http://test/media/console-$i.jpg'];
  server.overrides['GET /items/item-console'] = {
    ...FakeServer.console,
    'owner': FakeServer.kari,
    'cover': media.firstOrNull,
    'media': media,
  };
}

Future<void> openConsole(WidgetTester tester, {bool lessMotion = false}) =>
    mount(tester, const ItemDetailScreen(itemId: 'item-console'), lessMotion: lessMotion);

Finder get viewer => find.byType(PhotoViewer);

/// The viewer's «✕», and not 04's, which is still there under it.
Finder get close => find.descendant(of: viewer, matching: find.byIcon(Icons.close));

/// The viewer's own pages, and the gallery's under it.
Finder get bigPages => find.descendant(of: viewer, matching: find.byType(PageView));
Finder get galleryPages =>
    find.descendant(of: find.byType(ItemDetailScreen), matching: find.byType(PageView));

double galleryPage(WidgetTester tester) =>
    tester.widget<PageView>(galleryPages).controller!.page!;

/// How close the picture on screen is.
double closeness(WidgetTester tester) => tester
    .widgetList<InteractiveViewer>(find.descendant(of: viewer, matching: find.byType(InteractiveViewer)))
    .first
    .transformationController!
    .value
    .getMaxScaleOnAxis();

Future<void> swipe(WidgetTester tester, Finder pages, {double by = -300}) async {
  await tester.drag(pages, Offset(by, 0));
  await tester.pumpAndSettle();
}

Future<void> doubleTap(WidgetTester tester) async {
  final middle = tester.getCenter(bigPages);
  await tester.tapAt(middle);
  await tester.pump(const Duration(milliseconds: 60));
  await tester.tapAt(middle);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. a picture on 04 opens them all, big, at the one tapped', (tester) async {
    pictures(3);
    await openConsole(tester);
    await swipe(tester, galleryPages);

    await tester.tapAt(tester.getCenter(galleryPages));
    await tester.pumpAndSettle();

    expect(viewer, findsOneWidget);
    expect(find.text('2 av 3'), findsOneWidget);
  });

  testWidgets('2. the round button opens them too, and says what it does', (tester) async {
    pictures(3);
    await openConsole(tester);
    final semantics = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Vis alle bildene'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();
    expect(find.text('1 av 3'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('3. one picture opens alone, with no count', (tester) async {
    pictures(1);
    await openConsole(tester);
    final semantics = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Vis bildet'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();
    expect(viewer, findsOneWidget);
    expect(find.textContaining(' av '), findsNothing);
    semantics.dispose();
  });

  testWidgets('3b. …and a listing with none has no button', (tester) async {
    pictures(0);
    await openConsole(tester);
    expect(find.byIcon(Icons.open_in_full), findsNothing);
  });

  testWidgets('4. swiped between, and «✕» leaves the gallery on the one looked at last',
      (tester) async {
    pictures(3);
    await openConsole(tester);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();

    await swipe(tester, bigPages);
    await swipe(tester, bigPages);
    expect(find.text('3 av 3'), findsOneWidget);

    await tester.tap(close);
    await tester.pumpAndSettle();

    expect(viewer, findsNothing);
    expect(galleryPage(tester), 2);
  });

  testWidgets('5. pulled down it goes back, and a short pull goes back into place',
      (tester) async {
    pictures(2);
    await openConsole(tester);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();

    await tester.timedDrag(bigPages, const Offset(0, 60), const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(viewer, findsOneWidget);
    expect(tester.getTopLeft(bigPages).dy, 0);

    await tester.timedDrag(bigPages, const Offset(0, 200), const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(viewer, findsNothing);
  });

  testWidgets('6. a double tap goes closer, and a close picture holds the swipe', (tester) async {
    pictures(3);
    await openConsole(tester);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();

    await doubleTap(tester);
    expect(closeness(tester), 2);
    await swipe(tester, bigPages);
    expect(find.text('1 av 3'), findsOneWidget);

    // A second double tap puts it back, and the swipe is the next picture again.
    await doubleTap(tester);
    expect(closeness(tester), 1);
    await swipe(tester, bigPages);
    expect(find.text('2 av 3'), findsOneWidget);
  });

  testWidgets('7. on a desk: arrows between them, and Escape out', (tester) async {
    pictures(3);
    await openConsole(tester);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
    await tester.pumpAndSettle();
    expect(find.text('2 av 3'), findsOneWidget);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
    await tester.pumpAndSettle();
    expect(find.text('1 av 3'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(viewer, findsNothing);
  });

  testWidgets('8. the status bar is light over the dark', (tester) async {
    pictures(2);
    await openConsole(tester);
    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pumpAndSettle();

    final region = tester.widget<AnnotatedRegion<SystemUiOverlayStyle>>(find.descendant(
        of: viewer, matching: find.byType(AnnotatedRegion<SystemUiOverlayStyle>)));
    expect(region.value, onDarkStatusBar);
  });

  testWidgets('9. for less motion it is there at once, and gone at once', (tester) async {
    pictures(2);
    await openConsole(tester, lessMotion: true);

    await tester.tap(find.byIcon(Icons.open_in_full));
    await tester.pump();
    final fade = tester.widget<FadeTransition>(
        find.ancestor(of: viewer, matching: find.byType(FadeTransition)).first);
    expect(fade.opacity.value, 1);

    await tester.tap(close);
    await tester.pump();
    await tester.pump();
    expect(viewer, findsNothing);
  });

  testWidgets('10. 10b\'s strip opens its pictures from the one tapped, and «✕» there still removes',
      (tester) async {
    var n = 0;
    Future<PickedPhoto?> pick() async =>
        PickedPhoto([for (var i = 0; i < 64; i++) (n * 31 + i) % 256], 'bilde-${n++}.jpg');
    await mount(tester, PostItemScreen(pickImage: pick));
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text('Legg til bilder'));
      await tester.pumpAndSettle();
    }
    final second = find.byType(Image).at(1);
    await tester.tapAt(tester.getCenter(second) + const Offset(-20, 20));
    await tester.pumpAndSettle();
    expect(find.text('2 av 2'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Lukk'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Fjern bildet').first);
    await tester.pumpAndSettle();
    expect(viewer, findsNothing);
    expect(find.bySemanticsLabel('Fjern bildet'), findsOneWidget);
  });
}
