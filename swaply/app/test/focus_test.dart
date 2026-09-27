// Oppdag's search field has the focus only when somebody gives it the focus.
//
// A caret and a keyboard nobody asked for cover half the grid, and for
// somebody with a screen reader they move them into an edit field they did
// not choose. Two things gave the field its focus without a tap.
//
// In the app: a route hands focus back to whatever had it last when what
// covered it goes. A search typed, a card held down and its sheet closed, and
// the keyboard was up again. So focus that leaves the field does not come
// back to it.
//
// In a browser with a screen reader on: when a page appears and nothing on it
// has asked for focus, the web engine focuses the first thing a screen reader
// reads that takes focus (`SemanticRouteBase._setDefaultFocus` in the
// engine), and an edit field takes it as if tapped — the engine sends it
// `SemanticsAction.focus`, and the field asks for the keyboard. A page
// appears after a sheet closes, because the sheet takes the page out of what
// a screen reader reads while it is up, and after signing in, which builds
// the page anew. The first thing on Oppdag was the field.
//
// What is not taken away: a browser window that loses focus — another tab,
// the address bar — takes it off the field, and gives it back to the field
// when the window returns. That is the person's caret, where they left it.
//
// That second half runs in the engine's DOM, which a widget test does not
// have: there is no browser here, and `flutter test --platform chrome` would
// need one. So it is held the way the engine decides it — [firstFocus] walks
// the page's semantics in the order a screen reader reads them and applies
// the engine's rule — and on what the engine then does, the focus action on
// the node it picked.
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester) async {
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
      child: const MaterialApp(home: DiscoverScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

Finder get field => find.byType(EditableText);

/// Whether the search field has the focus now.
bool focused(WidgetTester tester) => tester.widget<EditableText>(field).focusNode.hasFocus;

/// The page the search field is on, as a screen reader has it: the nearest
/// node over the field that scopes a route.
SemanticsNode pageOf(WidgetTester tester) {
  SemanticsNode? node = tester.getSemantics(field);
  while (node != null && !node.getSemanticsData().flagsCollection.scopesRoute) {
    node = node.parent;
  }
  return node!;
}

/// What the web engine focuses on a page that appears with nothing on it
/// asking for focus: in reading order, the first node that is a heading, an
/// edit field or focusable, or a leaf with words in it. A route inside it is
/// looked into, never focused itself.
SemanticsNode? firstFocus(SemanticsNode page) {
  SemanticsNode? found;
  bool visit(SemanticsNode node) {
    final data = node.getSemanticsData();
    final flags = data.flagsCollection;
    final leaf = node.mergeAllDescendantsIntoThisNode || node.childrenCount == 0;
    final takes = !identical(node, page) &&
        !flags.scopesRoute &&
        (data.headingLevel != 0 ||
            (flags.isHeader && data.label.isNotEmpty && leaf) ||
            flags.isTextField ||
            flags.isFocused != Tristate.none ||
            (leaf && data.label.isNotEmpty));
    if (takes) {
      found = node;
      return false;
    }
    if (leaf) return true;
    for (final child in node.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder)) {
      if (!visit(child)) return false;
    }
    return true;
  }

  visit(page);
  return found;
}

/// What the engine does with the node it picked: the focus action, where
/// the node has one. A heading has none; an edit field asks for the keyboard.
void focusAsTheEngineDoes(WidgetTester tester, SemanticsNode node) {
  if (node.getSemanticsData().hasAction(SemanticsAction.focus)) {
    node.owner!.performAction(node.id, SemanticsAction.focus);
  }
}

/// A card held down, and its sheet closed again without choosing anything.
Future<void> holdACardAndLetGo(WidgetTester tester) async {
  await tester.longPress(find.text('Retro spillkonsoll'));
  await tester.pumpAndSettle();
  expect(find.text('Ikke vis meg slike'), findsOneWidget);
  // The dimming over the grid, above the sheet.
  await tester.tapAt(const Offset(195, 60));
  await tester.pumpAndSettle();
  expect(find.text('Ikke vis meg slike'), findsNothing);
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. a tap on the field gives it the focus, as it always did', (tester) async {
    await mount(tester);
    expect(focused(tester), isFalse);

    await tester.tap(field);
    await tester.pump();

    expect(focused(tester), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
  });

  testWidgets('2. a sheet closing does not hand the field its focus back', (tester) async {
    await mount(tester);
    await tester.tap(field);
    await tester.pump();
    expect(focused(tester), isTrue);

    await holdACardAndLetGo(tester);

    expect(focused(tester), isFalse);
    // …and it is the field's again the moment somebody taps it.
    await tester.tap(field);
    await tester.pump();
    expect(focused(tester), isTrue);
  });

  testWidgets('3. a page that appears is named for a screen reader before the field is reached',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester);
    await holdACardAndLetGo(tester);

    final first = firstFocus(pageOf(tester))!;
    expect(first.getSemanticsData().label, 'Oppdag');
    expect(first.getSemanticsData().flagsCollection.isHeader, isTrue);
    expect(first.getSemanticsData().flagsCollection.isTextField, isFalse);

    focusAsTheEngineDoes(tester, first);
    await tester.pump();
    expect(focused(tester), isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
    semantics.dispose();
  });

  testWidgets('4. …and the name is drawn nowhere: the field is still the top of the screen',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester);

    // Six over the field, as the export has it, and nothing to see in them:
    // the only «Oppdag» drawn is the bar's.
    expect(tester.getRect(find.byType(TextField)).top, 6);
    expect(find.text('Oppdag'), findsOneWidget);
    expect(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Oppdag')),
        findsOneWidget);
    final heading = firstFocus(pageOf(tester))!;
    expect(heading.getSemanticsData().label, 'Oppdag');
    expect(heading.rect.height, 6);
    semantics.dispose();
  });

  testWidgets('5. after signing in, the new app\'s Oppdag is named first, and nothing has focus',
      (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    session = Session(api);
    // A stranger until the sign-in, and the account signed in to after it.
    server.overrides['GET /me'] = FakeServer.lookingAround;
    await tester.pumpWidget(
      ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
    );
    await session.restore();
    await tester.pumpAndSettle();
    // A stranger, through 02, on Oppdag; then Profil › «Logg inn».
    await tester.tap(find.text('Hopp over'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Logg inn'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);

    server.overrides.remove('GET /me');
    await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
    await tester.enterText(find.byType(TextField).last, 'passord');
    await tester.tap(find.widgetWithText(FilledButton, 'Logg inn'));
    await tester.pumpAndSettle();

    expect(find.byType(DiscoverScreen), findsOneWidget);
    expect(focused(tester), isFalse);
    final first = firstFocus(pageOf(tester))!;
    expect(first.getSemanticsData().label, 'Oppdag');
    focusAsTheEngineDoes(tester, first);
    await tester.pump();
    expect(focused(tester), isFalse);
    semantics.dispose();
  });

  testWidgets('6. focus that went elsewhere while the window was away is not handed back to the field later',
      (tester) async {
    // The window gives the field its focus back only if nothing else took
    // it meanwhile. A sheet that went up while the window was away took it,
    // so the field is left without — and must be let go of then, or the
    // sheet closing hands the field its focus back, keyboard and all.
    await mount(tester);
    await tester.tap(field);
    await tester.pump();
    expect(focused(tester), isTrue);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    await tester.longPress(find.text('Retro spillkonsoll'));
    await tester.pumpAndSettle();
    expect(find.text('Ikke vis meg slike'), findsOneWidget);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(focused(tester), isFalse);

    await tester.tapAt(const Offset(195, 60));
    await tester.pumpAndSettle();
    expect(find.text('Ikke vis meg slike'), findsNothing);
    expect(focused(tester), isFalse);
  }, variant: TargetPlatformVariant.only(TargetPlatform.linux));

  testWidgets('7. a browser window that loses focus gives the field its caret back when it returns',
      (tester) async {
    // A browser, and a desktop, take the focus off the field while the window
    // is not the one in front — another tab, the address bar — and give it
    // back to the node that had it when it is. The field let go of that node
    // as it lost the focus, and there was nothing to give it back to. A
    // desktop target stands in for the browser: the focus manager does the
    // same on both, and a widget test has no browser.
    await mount(tester);
    await tester.tap(field);
    await tester.pump();
    expect(focused(tester), isTrue);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(focused(tester), isFalse);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();

    expect(focused(tester), isTrue);
    // …and a sheet closing still does not hand it back.
    await holdACardAndLetGo(tester);
    expect(focused(tester), isFalse);
  }, variant: TargetPlatformVariant.only(TargetPlatform.linux));
}
