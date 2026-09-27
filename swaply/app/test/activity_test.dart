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
//
// And the answer can be that the token opens nothing: the account was deleted
// while the app sat in the background — on another phone, or by that same
// twelve-month sweep — or its session was ended. That was kept quiet with the
// rest, and the app went on showing somebody signed in until its next cold
// start, with every tap refused. A refusal of the token is what a cold start
// with a dead token does something about, so coming back does the same: the
// token goes, the screens go with the person they were about, and the gate
// makes a new stranger. Only for the token that was asked about.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// The phone's clock, which a test moves on by hand.
late DateTime clock;

/// What `main.dart` does, with the device's token — or [token] — kept from
/// last time.
Future<void> boot(WidgetTester tester, {String token = FakeServer.deviceToken}) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  SharedPreferences.setMockInitialValues({'token': token});
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

  group('a token the server no longer knows', () {
    testWidgets('9. a device\'s: the gate makes a new stranger, and says nothing', (tester) async {
      await boot(tester);
      expect(asked('POST /auth/anonymous'), 0);
      server.overrides['GET /me'] = 401;
      clock = clock.add(const Duration(hours: 3));

      await backFromTheBackground(tester);

      expect(asked('GET /me'), 2);
      // Made without the dead token: it is nobody's any more.
      expect(asked('POST /auth/anonymous'), 1);
      expect(server.bearers['POST /auth/anonymous'], isNull);
      expect(session.signedIn, isTrue);
      expect(session.anonymous, isTrue);
      // A new stranger's first run.
      expect(find.byType(InterestsScreen), findsOneWidget);
      expect(find.byType(SwaplyToast), findsNothing);
    });

    testWidgets('10. an account\'s, erased elsewhere: the same, and every screen over the gate goes',
        (tester) async {
      server.overrides['GET /me'] = FakeServer.me;
      await boot(tester, token: 'tok');
      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);

      server.overrides['GET /me'] = 401;
      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);

      expect(find.byType(SettingsScreen, skipOffstage: false), findsNothing);
      expect(session.anonymous, isTrue);
      expect(server.bearers['POST /auth/anonymous'], isNull);
      expect((await SharedPreferences.getInstance()).getString('token'), FakeServer.deviceToken);
      expect(find.byType(InterestsScreen), findsOneWidget);
      expect(find.byType(SwaplyToast), findsNothing);
    });

    testWidgets('11. a sign-in that landed while the asking was out is somebody else, and stays',
        (tester) async {
      await boot(tester);
      final answer = Completer<Object?>();
      server.overrides['GET /me'] = (http.Request request) =>
          request.headers['authorization'] == 'Bearer ${FakeServer.deviceToken}'
              ? answer.future
              : FakeServer.me;
      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);

      await session.login('ola@epost.no', 'passord');
      await tester.pumpAndSettle();
      answer.complete(401);
      await tester.pumpAndSettle();

      expect(session.me?.id, FakeServer.me['id']);
      expect(session.anonymous, isFalse);
      expect(api.token, 'tok');
      expect((await SharedPreferences.getInstance()).getString('token'), 'tok');
      expect(asked('POST /auth/anonymous'), 0);
    });

    testWidgets('12. any other refusal is still quiet, and nobody is signed out', (tester) async {
      await boot(tester);
      server.overrides['GET /me'] = 500;
      clock = clock.add(const Duration(hours: 3));

      await backFromTheBackground(tester);

      expect(asked('GET /me'), 2);
      expect(session.signedIn, isTrue);
      expect(api.token, FakeServer.deviceToken);
      expect(asked('POST /auth/anonymous'), 0);
      expect(find.byType(SwaplyToast), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    // A refusal can also be the server letting somebody in. It retires the
    // token the asking went on as it answers a sign-in or a profile being
    // made — a claim reissues the device's session, a sign-in deletes the
    // device it folds in — and the phone learns who they are only when that
    // answer lands. Heard in between, the refusal closed 10c or 16c under the
    // person and made a stranger whose start threw away the draft the
    // sign-in was about to carry over.
    testWidgets('13. a sign-in on its way when the refusal comes is let land, and stays', (tester) async {
      await boot(tester);
      final asking = Completer<Object?>();
      final signing = Completer<Object?>();
      server.overrides['GET /me'] = (http.Request request) =>
          request.headers['authorization'] == 'Bearer ${FakeServer.deviceToken}'
              ? asking.future
              : FakeServer.me;
      server.overrides['POST /auth/login'] = (http.Request _) => signing.future;
      var sentBack = 0;
      final listening = session.sentBack.listen((_) => sentBack++);
      addTearDown(listening.cancel);
      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);

      final signedIn = session.login('ola@epost.no', 'passord');
      await tester.pumpAndSettle();
      expect(asked('POST /auth/login'), 1);
      asking.complete(401);
      await tester.pumpAndSettle();

      // Nothing yet: not signed out, not sent back, and no stranger.
      expect(sentBack, 0);
      expect(api.token, FakeServer.deviceToken);
      expect(asked('POST /auth/anonymous'), 0);

      signing.complete(asUsual);
      await signedIn;
      await tester.pumpAndSettle();

      expect(session.me?.id, FakeServer.me['id']);
      expect(api.token, 'tok');
      expect((await SharedPreferences.getInstance()).getString('token'), 'tok');
      expect(sentBack, 0);
      expect(asked('POST /auth/anonymous'), 0);
    });

    testWidgets('14. a profile being made on the device when the refusal comes: the same, and its draft stays',
        (tester) async {
      // A draft the stranger was writing, which the profile keeps.
      const draft = 'listingDraft:anon-1';
      await boot(tester);
      await (await SharedPreferences.getInstance()).setString(
          draft,
          jsonEncode({
            'v': 1,
            'kind': 'item',
            'category': 'friluft',
            'condition': 'good',
            'title': 'Fiskestang',
            'description': '',
            'subcategory': '',
            'value': '',
            'postalCode': '',
            'photos': const <Object>[],
          }));
      final asking = Completer<Object?>();
      final making = Completer<Object?>();
      server.overrides['GET /me'] = (http.Request request) =>
          request.headers['authorization'] == 'Bearer ${FakeServer.deviceToken}'
              ? asking.future
              : {...FakeServer.me, 'id': FakeServer.lookingAround['id']};
      server.overrides['POST /auth/register'] = (http.Request _) => making.future;
      // Were a stranger made, it would be a new one: this device is claimed.
      server.overrides['POST /auth/anonymous'] = {
        'token': 'tok-device-2',
        'user': {...FakeServer.lookingAround, 'id': 'anon-2'},
      };
      var sentBack = 0;
      final listening = session.sentBack.listen((_) => sentBack++);
      addTearDown(listening.cancel);
      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);

      final made = session.register(
          displayName: 'Ola N.', email: 'ola@epost.no', password: 'byttehandel1');
      await tester.pumpAndSettle();
      expect(asked('POST /auth/register'), 1);
      expect(server.bearers['POST /auth/register'], 'Bearer ${FakeServer.deviceToken}');
      asking.complete(401);
      await tester.pumpAndSettle();
      expect(sentBack, 0);
      expect(asked('POST /auth/anonymous'), 0);

      making.complete(asUsual);
      await made;
      await tester.pumpAndSettle();

      expect(session.me?.id, FakeServer.lookingAround['id']);
      expect(session.anonymous, isFalse);
      expect(api.token, 'tok');
      expect(sentBack, 0);
      expect(asked('POST /auth/anonymous'), 0);
      expect((await SharedPreferences.getInstance()).getString(draft), isNotNull);
    });

    testWidgets('15. coming back while a sign-in is on its way asks nothing: the sign-in asks itself',
        (tester) async {
      await boot(tester);
      final signing = Completer<Object?>();
      server.overrides['POST /auth/login'] = (http.Request _) => signing.future;
      server.overrides['GET /me'] = FakeServer.me;
      final signedIn = session.login('ola@epost.no', 'passord');
      await tester.pumpAndSettle();

      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);
      expect(asked('GET /me'), 1);

      signing.complete(asUsual);
      await signedIn;
      await tester.pumpAndSettle();
      // The sign-in's own asking, on the token it brought.
      expect(asked('GET /me'), 2);
      expect(server.bearers['GET /me'], 'Bearer tok');
      expect(session.me?.id, FakeServer.me['id']);
    });

    testWidgets('16. a sign-in that fails leaves the refusal standing: the token was dead after all',
        (tester) async {
      await boot(tester);
      final asking = Completer<Object?>();
      final signing = Completer<Object?>();
      server.overrides['GET /me'] = (http.Request _) => asking.future;
      server.overrides['POST /auth/login'] = (http.Request _) => signing.future;
      clock = clock.add(const Duration(hours: 3));
      await backFromTheBackground(tester);

      final signedIn = session.login('ola@epost.no', 'feil');
      await tester.pumpAndSettle();
      asking.complete(401);
      await tester.pumpAndSettle();
      expect(asked('POST /auth/anonymous'), 0);

      signing.complete(Refusal.wrongCredentials);
      await expectLater(signedIn, throwsA(isA<ApiException>()));
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 1);
      expect(server.bearers['POST /auth/anonymous'], isNull);
      expect(session.anonymous, isTrue);
      expect(find.byType(SwaplyToast), findsNothing);
    });
  });
}
