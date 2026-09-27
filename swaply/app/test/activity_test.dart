// Opening the app is something the server hears.
//
// `../CLAUDE.md`: «A device nobody uses is erased after twelve months,
// strictly» — unclaimed, and no request from its own token for twelve months.
// Activity is an authenticated request made with the account's own token, and
// opening the app sends one. A cold start does: restoring the kept token asks
// `GET /me`. An app brought back from the background asked nothing until
// somebody pressed something, so a phone opened every week to look at the grid
// it already held was a phone nobody used, as far as the server could tell.
// So coming back asks too — once a minute at most after an answer, since
// flicking between apps or a browser tab taking focus is not a request each
// time, and without a word when there is no answer. An asking that got no
// answer may never have arrived, so it is not what the minute counts from;
// and the splash that had none is asked past by coming back, as «Prøv igjen».
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// The phone's clock, which a test moves on by hand.
late DateTime clock;

/// What `main.dart` does, with the device's token kept from last time.
Future<void> boot(WidgetTester tester) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  SharedPreferences.setMockInitialValues({'token': FakeServer.deviceToken});
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
  );
  unawaited(session.restore());
  await tester.pumpAndSettle();
}

/// Into the background and back, as a phone does it.
Future<void> backFromTheBackground(WidgetTester tester) async {
  for (final state in [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(state);
  }
  await tester.pumpAndSettle();
}

int asked(String request) => server.asked(request);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api);
    // A device that has only looked around: the account the rule is for.
    server.overrides['GET /me'] = FakeServer.lookingAround;
    clock = DateTime(2026, 9, 27, 12);
    now = () => clock;
    addTearDown(() => now = DateTime.now);
  });

  testWidgets('1. a cold start asks who this is, with the device\'s own token', (tester) async {
    await boot(tester);

    expect(asked('GET /me'), 1);
    expect(server.bearers['GET /me'], 'Bearer ${FakeServer.deviceToken}');
    expect(session.anonymous, isTrue);
    expect(find.byType(DiscoverScreen), findsOneWidget);
  });

  testWidgets('2. brought back from the background, it asks again', (tester) async {
    await boot(tester);
    clock = clock.add(const Duration(hours: 3));

    await backFromTheBackground(tester);

    expect(asked('GET /me'), 2);
    expect(server.bearers['GET /me'], 'Bearer ${FakeServer.deviceToken}');
  });

  testWidgets('3. back again within the minute, it does not ask twice', (tester) async {
    await boot(tester);
    clock = clock.add(const Duration(hours: 3));
    await backFromTheBackground(tester);

    // Flicking between apps, and a browser tab losing and taking focus.
    for (var i = 0; i < 5; i++) {
      clock = clock.add(const Duration(seconds: 10));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
    }
    expect(asked('GET /me'), 2);

    // A minute after it last asked, it asks again.
    clock = clock.add(const Duration(seconds: 11));
    await backFromTheBackground(tester);
    expect(asked('GET /me'), 3);
  });

  testWidgets('4. any answer about who this is since counts as having asked', (tester) async {
    // The cold start a moment ago did; so does a screen refreshing the
    // session. Coming back straight after is not a second request.
    await boot(tester);
    clock = clock.add(const Duration(seconds: 20));

    await backFromTheBackground(tester);

    expect(asked('GET /me'), 1);
  });

  testWidgets('5. no answer says nothing, and nobody is signed out', (tester) async {
    await boot(tester);
    server.overrides['GET /me'] = unreachable;
    clock = clock.add(const Duration(hours: 3));

    await backFromTheBackground(tester);

    expect(asked('GET /me'), 2);
    expect(find.byType(SwaplyToast), findsNothing);
    expect(session.signedIn, isTrue);
    expect(find.byType(DiscoverScreen), findsOneWidget);
  });

  testWidgets('6. on the splash that had no answer, coming back is «Prøv igjen»', (tester) async {
    // A cold start in a tunnel: the token is kept, and the splash says there
    // was no answer. The person puts the app away and opens it again later,
    // with signal — that is opening the app, and the server hears it without
    // anybody having to find the button.
    server.overrides['GET /me'] = unreachable;
    await boot(tester);
    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.text('Prøv igjen'), findsOneWidget);
    expect(asked('GET /me'), 1);

    server.overrides['GET /me'] = FakeServer.lookingAround;
    clock = clock.add(const Duration(hours: 3));
    await backFromTheBackground(tester);

    expect(asked('GET /me'), 2);
    expect(server.bearers['GET /me'], 'Bearer ${FakeServer.deviceToken}');
    expect(session.signedIn, isTrue);
    expect(find.byType(DiscoverScreen), findsOneWidget);
  });

  testWidgets('7. still no answer: it stays on the splash, and asks once for each return, never on its own',
      (tester) async {
    server.overrides['GET /me'] = unreachable;
    await boot(tester);

    for (var i = 0; i < 2; i++) {
      clock = clock.add(const Duration(seconds: 10));
      await backFromTheBackground(tester);
    }
    expect(asked('GET /me'), 3);
    expect(find.text('Prøv igjen'), findsOneWidget);
    expect(session.stalled, isTrue);

    // Left on the splash, it waits for the person.
    clock = clock.add(const Duration(hours: 1));
    await tester.pump(const Duration(minutes: 5));
    expect(asked('GET /me'), 3);
  });

  testWidgets('8. a return that got no answer does not keep the next one quiet', (tester) async {
    // Brought back in a lift: no signal, no answer. Put away and brought back
    // forty seconds later with signal — that opening reaches the server, where
    // counting the unanswered one as having asked kept it quiet.
    await boot(tester);
    clock = clock.add(const Duration(hours: 3));
    server.overrides['GET /me'] = unreachable;
    await backFromTheBackground(tester);
    expect(asked('GET /me'), 2);

    server.overrides['GET /me'] = FakeServer.lookingAround;
    clock = clock.add(const Duration(seconds: 40));
    await backFromTheBackground(tester);
    expect(asked('GET /me'), 3);

    // Answered now, so the minute counts from here again.
    clock = clock.add(const Duration(seconds: 40));
    await backFromTheBackground(tester);
    expect(asked('GET /me'), 3);
  });
}
