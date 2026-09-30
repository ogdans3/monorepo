// A tap away from the field being typed in puts the keyboard away, as other
// apps do on a phone, and a scroll does not.
//
// Flutter does not do this by itself on a phone: a text field there lets go
// only when the app says so. An iPhone has nothing else that takes the
// keyboard down, and where the return key makes a new line, in a description
// on 10b or a message, the only way out was to leave the screen.
//
// Some taps are not away. The field itself is not, and neither is another
// field, which is handed the keyboard without it going down and up again on
// the way. «Send» beside a message is pressed between one message and the
// next, so it is not away either, even while it cannot be pressed. A button
// anywhere else is away like the empty page, so what it answers with is not
// under the keyboard.
//
// All of it on an iPhone and on an Android phone, which Flutter treats alike
// here. A mouse is left to let go on the way down, which is what Flutter does
// with one.
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/keyboard.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

final phones = TargetPlatformVariant({TargetPlatform.iOS, TargetPlatform.android});

/// [screen] on a phone, signed in, under the rule the app puts over every
/// screen.
Future<void> mount(WidgetTester tester, Widget screen) async {
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
        builder: (context, child) => KeyboardAway(child: child!),
        home: screen,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Whether [field] has the focus now: the caret, and the keyboard with it.
bool typingIn(WidgetTester tester, Finder field) => tester
    .widget<EditableText>(find.descendant(of: field, matching: find.byType(EditableText)))
    .focusNode
    .hasFocus;

Finder get search => find.byType(TextField);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. in the app, a tap on the page away from the field puts the keyboard away',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    session = Session(api);
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
    final email = find.byType(TextField).first;

    await tester.tap(email);
    await tester.pump();
    expect(typingIn(tester, email), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);

    // The wordmark, which answers nothing.
    await tester.tap(find.text('swaply'));
    await tester.pump();

    expect(typingIn(tester, email), isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
  }, variant: phones);

  testWidgets('2. a chip is away too: the keyboard goes, and the chip does what it says',
      (tester) async {
    await mount(tester, const DiscoverScreen());
    await tester.tap(search);
    await tester.pump();
    expect(tester.testTextInput.isVisible, isTrue);
    final asked = server.asked('GET /discover');

    await tester.tap(find.text('Verktøy'));
    await tester.pumpAndSettle();

    expect(typingIn(tester, search), isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
    expect(server.asked('GET /discover'), asked + 1);
  }, variant: phones);

  testWidgets('3. a scroll is not a tap: the grid moves, and the keyboard stays', (tester) async {
    // Sixteen things, well past the foot of the screen, so the grid has
    // somewhere to go.
    server.overrides['GET /discover'] = {
      'total': 16,
      'items': [
        for (var i = 0; i < 16; i++) {...FakeServer.console, 'id': 'item-$i', 'title': 'Ting $i'},
      ],
    };
    await mount(tester, const DiscoverScreen());
    await tester.tap(search);
    await tester.pump();
    final card = find.text('Ting 0');
    final before = tester.getTopLeft(card);

    await tester.drag(card, const Offset(0, -120));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(card), isNot(before));
    expect(typingIn(tester, search), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
  }, variant: phones);

  testWidgets('4. another field is handed the keyboard, which does not go down on the way',
      (tester) async {
    await mount(tester, const LoginScreen());
    final email = find.byType(TextField).first;
    final password = find.byType(TextField).last;
    await tester.tap(email);
    await tester.pump();
    tester.testTextInput.log.clear();

    await tester.tap(password);
    await tester.pumpAndSettle();

    expect(typingIn(tester, email), isFalse);
    expect(typingIn(tester, password), isTrue);
    expect(tester.testTextInput.log.map((call) => call.method),
        isNot(contains('TextInput.hide')));
    expect(tester.testTextInput.isVisible, isTrue);
  }, variant: phones);

  testWidgets('5. «Send» keeps the keyboard up, across its whole area and while it is sending',
      (tester) async {
    await mount(tester, const ThreadScreen(threadId: 'thread-1'));
    final composer = find.byType(TextField).last;
    await tester.tap(composer);
    await tester.pump();
    await tester.enterText(composer, 'Sees da!');
    final answer = Completer<void>();
    server.overrides['POST /threads/thread-1/messages'] = (http.Request _) async {
      await answer.future;
      return asUsual;
    };

    await tester.tap(find.text('Send'));
    await tester.pump();
    expect(server.asked('POST /threads/thread-1/messages'), 1);
    expect(typingIn(tester, composer), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);

    // Greyed out until the server answers, so a second tap sends nothing,
    // and it is still «Send».
    await tester.tap(find.text('Send'));
    await tester.pump();
    expect(server.asked('POST /threads/thread-1/messages'), 1);
    expect(typingIn(tester, composer), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);

    answer.complete();
    await tester.pumpAndSettle();
    // Off the word, in the room around it that answers as it does.
    await tester.tapAt(tester.getRect(find.text('Send')).topRight + const Offset(4, -8));
    await tester.pumpAndSettle();
    expect(server.asked('POST /threads/thread-1/messages'), 1);
    expect(typingIn(tester, composer), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);

    // …and the conversation over the composer is away.
    await tester.tap(find.text('Passer bra! Kl. 17?'));
    await tester.pump();
    expect(typingIn(tester, composer), isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
  }, variant: phones);

  testWidgets('6. …and so does «Send» on 04 and on 06b', (tester) async {
    for (final (screen, hint) in [
      (const ItemDetailScreen(itemId: 'item-console'), 'Skriv en melding til Kari…'),
      (const TradeDetailScreen(tradeId: 'trade-1'), 'Skriv en melding…'),
    ]) {
      await mount(tester, screen);
      final field = find.widgetWithText(TextField, hint);
      await tester.ensureVisible(field);
      await tester.pumpAndSettle();
      await tester.tap(field);
      await tester.pump();
      await tester.enterText(field, 'Hei!');

      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(typingIn(tester, field), isTrue, reason: '$screen');
      expect(tester.testTextInput.isVisible, isTrue, reason: '$screen');
    }
  }, variant: phones);

  testWidgets('7. a mouse lets go on the way down, as Flutter has it do: an iPad with a trackpad',
      (tester) async {
    await mount(tester, const DiscoverScreen());
    await tester.tap(search, kind: PointerDeviceKind.mouse);
    await tester.pump();
    expect(typingIn(tester, search), isTrue);

    final mouse = await tester.startGesture(tester.getCenter(find.text('Verktøy')),
        kind: PointerDeviceKind.mouse);
    await tester.pump();
    expect(typingIn(tester, search), isFalse);
    await mouse.up();
    await tester.pumpAndSettle();
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
}
