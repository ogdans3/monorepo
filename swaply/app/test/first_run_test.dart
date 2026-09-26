// The app starts without asking.
//
// `../docs/DESIGN.md`: «On a first start with no invitation link it makes the
// device's account behind 01 and goes straight on to 02; nobody meets a
// sign-in before they have seen anything.» It used to open on 16c, and looking
// around was a choice reachable only from an invitation.
//
// So this file holds the gate to three things. A first start makes a stranger
// — once, however often the gate is rebuilt, and without looping when there is
// no network. Signing out leaves a *new* stranger, not the last person's
// device. And the stranger is not a dead end: making a profile claims it, and
// signing in to an account from another phone brings what it liked along.
//
// Mounted the way `main.dart` mounts the app, with the session restored rather
// than signed in by hand, because the point is what happens before anybody is.
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
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// What `main.dart` does: the gate from the first frame, and the session
/// restoring itself underneath it.
Future<void> boot(WidgetTester tester, {Map<String, Object> saved = const {}}) async {
  // Tall, so a list builds all of its rows and «Logg ut» at the foot of 16b is
  // on screen. Still, so the splash's confetti lets the frames settle.
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  SharedPreferences.setMockInitialValues(saved);
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
  );
  expect(find.byType(SplashScreen), findsOneWidget);
  unawaited(session.restore());
}

/// Pumps [frames] frames, checking at every one that 16c is nowhere.
Future<void> neverTheSignIn(WidgetTester tester, {int frames = 30}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(LoginScreen, skipOffstage: false), findsNothing, reason: 'frame $i');
  }
}

int asked(String request) => server.requests.where((r) => r == request).length;

Future<SharedPreferences> prefs() => SharedPreferences.getInstance();

/// Taps a tab on the bar, where the label may also be a word elsewhere.
Future<void> tapTab(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text(label)));
  await tester.pumpAndSettle();
}

/// Past 02 the quick way, which leaves the interests empty.
Future<void> skipInterests(WidgetTester tester) async {
  await tester.tap(find.text('Hopp over'));
  await tester.pumpAndSettle();
}

final deviceIdShape = RegExp(r'^[0-9a-f]{32}$');

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api);
  });

  group('a first start makes a stranger, not a sign-in', () {
    testWidgets('1. no token and no link: the device becomes somebody behind 01, and 02 is next',
        (tester) async {
      await boot(tester);
      await neverTheSignIn(tester);
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 1);
      // A secret this app made and kept, not the phone's own identifier.
      final sent = server.bodies['POST /auth/anonymous']!['deviceId'] as String;
      expect(sent, matches(deviceIdShape));
      expect((await prefs()).getString('deviceId'), sent);
      expect((await prefs()).getString('token'), FakeServer.deviceToken);
      expect(server.bearers['POST /auth/anonymous'], isNull);

      expect(session.anonymous, isTrue);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /auth/login')));

      // And from 02 into the app, once: the gate moves on by itself, so the
      // picker going somewhere as well would build a second shell.
      await skipInterests(tester);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsOneWidget);
      expect(asked('GET /discover'), 1);
    });

    testWidgets('2. it is asked for once, however often the gate is built', (tester) async {
      // Held open, so the gate has every chance to ask again while it waits.
      final answer = Completer<Object?>();
      server.overrides['POST /auth/anonymous'] = (_) => answer.future;
      await boot(tester);
      await tester.pump();
      await tester.pump();

      for (var i = 0; i < 5; i++) {
        session.notifyListeners();
        await tester.pump(const Duration(milliseconds: 20));
      }
      // A second gate, the way signing out and switching accounts push one.
      tester.state<NavigatorState>(find.byType(Navigator).first).pushNamed('/');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(asked('POST /auth/anonymous'), 1);

      answer.complete({'token': FakeServer.deviceToken, 'user': FakeServer.lookingAround});
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 1);
      expect(session.anonymous, isTrue);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
    });

    testWidgets('3. no answer: the splash says so, calmly, and asks again only when asked',
        (tester) async {
      server.overrides['POST /auth/anonymous'] = unreachable;
      await boot(tester);
      await neverTheSignIn(tester);

      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Vi får ikke kontakt med Swaply akkurat nå.'), findsOneWidget);
      expect(find.widgetWithText(PrimaryButton, 'Prøv igjen'), findsOneWidget);
      expect(find.textContaining('!'), findsNothing);

      // A phone with no network must not be made to ask forever.
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(seconds: 1));
      }
      expect(asked('POST /auth/anonymous'), 1);

      // The network is back.
      server.overrides.remove('POST /auth/anonymous');
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 2);
      expect(session.anonymous, isTrue);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
    });

    testWidgets('…and an answer that never comes is no answer, after a while', (tester) async {
      // A host that drops packets refuses nothing, and the phone waits a
      // minute or two before it gives up on the connection. The splash does
      // not wait that long with nothing to tap.
      server.overrides['POST /auth/anonymous'] = (_) => Completer<Object?>().future;
      await boot(tester);
      await tester.pump();
      await tester.pump(Session.patience - const Duration(seconds: 1));
      expect(find.text('Prøv igjen'), findsNothing);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text(noContact), findsOneWidget);
      expect(find.widgetWithText(PrimaryButton, 'Prøv igjen'), findsOneWidget);
    });

    testWidgets('4. a saved token that cannot be checked is kept, not traded for a stranger',
        (tester) async {
      // Offline on the way in is not the same as signed out. Treating it so
      // would have made somebody with an account a stranger on this phone.
      server.overrides['GET /me'] = unreachable;
      await boot(tester, saved: {'token': 'tok'});
      await tester.pumpAndSettle();

      expect(find.text('Prøv igjen'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
      expect((await prefs()).getString('token'), 'tok');

      server.overrides.remove('GET /me');
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();

      expect(session.me?.id, FakeServer.me['id']);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
    });

    testWidgets('5. a server that wants an invitation gets 16c, as it did before',
        (tester) async {
      server.overrides['POST /auth/anonymous'] = Refusal.inviteRequired;
      await boot(tester);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      // The first screen there is, so there is nothing to go back to.
      expect(find.text('‹'), findsNothing);
      expect(find.text('Prøv igjen'), findsNothing);
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(seconds: 1));
      }
      expect(asked('POST /auth/anonymous'), 1);

      // And signing in there goes on into the app once: the gate does it, and
      // the sign-in it is showing does not go anywhere as well.
      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'passord');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pumpAndSettle();

      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsOneWidget);
      expect(asked('GET /discover'), 1);
    });

    testWidgets('…and an account with no interests signing in there gets 02, once',
        (tester) async {
      // Nobody on this phone has been through it yet: the gate had nobody to
      // show it to before the sign-in.
      final fresh = {...FakeServer.me, 'interests': const <String>[]};
      server.overrides['POST /auth/anonymous'] = Refusal.inviteRequired;
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': fresh};
      server.overrides['GET /me'] = fresh;
      await boot(tester);
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'passord');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pumpAndSettle();

      expect(find.byType(InterestsScreen), findsOneWidget);
      await skipInterests(tester);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('…and an address from when the tabs were routes opens the gate, at that tab',
        (tester) async {
      // A bookmark of #/trades used to stack an empty shell on the gate and
      // hide whatever it had to show first behind it.
      tester.platformDispatcher.defaultRouteNameTestValue = '/trades';
      addTearDown(tester.platformDispatcher.clearDefaultRouteNameTestValue);
      server.overrides['POST /auth/anonymous'] = unreachable;
      await boot(tester);
      await tester.pumpAndSettle();

      // In plain view, not under anything.
      expect(find.text(noContact), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsNothing);

      server.overrides.remove('POST /auth/anonymous');
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      await skipInterests(tester);

      expect(find.byType(TradesScreen), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsOneWidget);
      expect(find.byType(RootGate, skipOffstage: false), findsOneWidget);
    });

    testWidgets('7. a link still opens on the invitation, and nothing is made until asked',
        (tester) async {
      // Looking around from a link spends the invitation, so it is the person's
      // choice there and not the gate's.
      session.pendingInvite = FakeServer.shareToken;
      await boot(tester);
      await tester.pumpAndSettle();

      expect(find.byType(InviteScreen), findsOneWidget);
      expect(find.text('Ola N. inviterer deg til Swaply.'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));

      await tester.tap(find.text('Se deg rundt'));
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 1);
      expect(server.bodies['POST /auth/anonymous']!['invite'], FakeServer.shareToken);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      await skipInterests(tester);

      // The key is spent, and the link was a listing as well: that is what
      // the friend sent, so that is what is open, in Oppdag.
      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(find.byType(DiscoverScreen, skipOffstage: false), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsOneWidget);
    });

    /// A link whose key the server does not know: cut short by a chat app.
    const garbled = 'inv-token-01234';

    /// `/auth/anonymous` refusing the garbled key, and answering [keyless]
    /// without one.
    Object? Function(http.Request) refusingTheKey(Object keyless) => (request) =>
        (jsonDecode(request.body) as Map)['invite'] == null
            ? keyless
            : const Refusal(400, 'invite_unknown', 'Vi kjenner ikke igjen denne invitasjonen.');

    testWidgets('8. a link with a key that is no good says so, and is still a way in',
        (tester) async {
      server.overrides['POST /auth/anonymous'] = refusingTheKey(
          {'token': FakeServer.deviceToken, 'user': FakeServer.lookingAround});
      session.pendingInvite = garbled;
      await boot(tester);
      await tester.pumpAndSettle();
      expect(find.byType(InviteScreen), findsOneWidget);
      expect(find.text('Fant ikke det du ba om.'), findsOneWidget);

      await tester.tap(find.text('Se deg rundt'));
      await tester.pumpAndSettle();

      // Once with the key, once without it.
      expect(asked('POST /auth/anonymous'), 2);
      expect(session.anonymous, isTrue);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
    });

    testWidgets('…and where there is no way in without one, says what was wrong with it',
        (tester) async {
      server.overrides['POST /auth/anonymous'] = refusingTheKey(Refusal.inviteRequired);
      session.pendingInvite = garbled;
      await boot(tester);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Se deg rundt'));
      await tester.pumpAndSettle();

      expect(find.text('Vi kjenner ikke igjen denne invitasjonen.'), findsOneWidget);
      expect(session.signedIn, isFalse);
    });

    testWidgets('6. a device whose account has been claimed starts over as somebody new, once',
        (tester) async {
      // Its account got a name on 10c, and then the token went missing. The
      // device id is no way back into a claimed account — the password is —
      // so the phone becomes a new stranger instead of a refusal.
      const old = '0123456789abcdef0123456789abcdef';
      final sent = <String>[];
      server.overrides['POST /auth/anonymous'] = (request) {
        sent.add((jsonDecode(request.body) as Map)['deviceId'] as String);
        return sent.length == 1
            ? Refusal.deviceClaimed
            : {'token': FakeServer.deviceToken, 'user': FakeServer.lookingAround};
      };
      await boot(tester, saved: {'deviceId': old});
      await tester.pumpAndSettle();

      expect(sent, hasLength(2));
      expect(sent.first, old);
      expect(sent.last, matches(deviceIdShape));
      expect(sent.last, isNot(old));
      expect((await prefs()).getString('deviceId'), sent.last);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
    });
  });

  group('02 is owed until it has been through once', () {
    /// The same phone started again: a new app and a new session, over what
    /// the last one kept rather than over nothing.
    Future<void> reopen(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox());
      api = SwaplyApi(baseUrl: 'http://test', client: server.client);
      session = Session(api);
      await tester.pumpWidget(
        ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
      );
      unawaited(session.restore());
      await tester.pumpAndSettle();
    }

    const intro = 'Hva er du\ninteressert i?';

    testWidgets('1. closing the app on 02 comes back to 02, not past it', (tester) async {
      // The flag lived in memory, and a restored token only asked who this
      // is. The server cannot say whether 02 was seen: skipping it leaves
      // the interests as empty as never having been asked.
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await boot(tester);
      await tester.pumpAndSettle();
      expect(find.text(intro), findsOneWidget);

      await reopen(tester);

      // The same stranger, by the kept token, and still owed its intro.
      expect(asked('POST /auth/anonymous'), 1);
      expect(session.me?.id, FakeServer.lookingAround['id']);
      expect(find.text(intro), findsOneWidget);
      expect(find.byType(TabShell, skipOffstage: false), findsNothing);

      await skipInterests(tester);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('2. «Hopp over» is once, not on every start', (tester) async {
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await boot(tester);
      await tester.pumpAndSettle();
      await skipInterests(tester);

      await reopen(tester);

      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('3. …and so is choosing', (tester) async {
      final chosen = {
        ...FakeServer.lookingAround,
        'interests': ['sykling', 'gaming', 'verktoy'],
      };
      server.overrides['GET /me'] = FakeServer.lookingAround;
      server.overrides['PUT /me/interests'] = chosen;
      await boot(tester);
      await tester.pumpAndSettle();
      for (final tile in ['Sykling', 'Gaming', 'Verktøy']) {
        await tester.tap(find.text(tile));
      }
      await tester.pump();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Fortsett'));
      await tester.pumpAndSettle();
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect((await prefs()).getString('interestsPendingFor'), isNull);

      server.overrides['GET /me'] = chosen;
      await reopen(tester);

      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('4. what was owed to one account is not owed to the next', (tester) async {
      server.overrides['GET /me'] = {...FakeServer.me, 'interests': const <String>[]};
      await boot(tester, saved: {'token': 'tok', 'interestsPendingFor': 'anon-gone'});
      await tester.pumpAndSettle();

      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('5. after «Prøv igjen» too, and without the app built on the way to it',
        (tester) async {
      // Who you are and whether 02 is owed are decided together. Told the
      // first before the second, the gate would build the tabs — and Oppdag
      // ask for its rows — only to swap them for 02 on a later frame.
      server.overrides['GET /me'] = unreachable;
      await boot(tester, saved: {
        'token': FakeServer.deviceToken,
        'interestsPendingFor': FakeServer.lookingAround['id']!,
      });
      await tester.pumpAndSettle();
      expect(find.text('Prøv igjen'), findsOneWidget);

      server.overrides['GET /me'] = FakeServer.lookingAround;
      await tester.tap(find.text('Prøv igjen'));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(find.byType(TabShell, skipOffstage: false), findsNothing, reason: 'frame $i');
      }
      await tester.pumpAndSettle();

      expect(find.text(intro), findsOneWidget);
      expect(asked('GET /discover'), 0);
    });
  });

  group('signing out leaves a new stranger', () {
    testWidgets('1. «Logg ut» forgets the device id, and the next start is somebody else',
        (tester) async {
      const old = 'fedcba9876543210fedcba9876543210';
      await boot(tester, saved: {'token': 'tok', 'deviceId': old});
      await tester.pumpAndSettle();
      expect(find.byType(DiscoverScreen), findsOneWidget);

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Logg ut'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /auth/logout'));
      final sent = server.bodies['POST /auth/anonymous']!['deviceId'] as String;
      expect(sent, matches(deviceIdShape));
      expect(sent, isNot(old));
      expect((await prefs()).getString('deviceId'), sent);
      expect(session.anonymous, isTrue);
      // The intro again, for the person who is holding the phone now.
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      expect(find.byType(SettingsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('2. becoming a test account and coming back is not signing out', (tester) async {
      // The switcher mints a session; it does not end one. Nothing about the
      // device may change on the way there or back.
      const old = 'fedcba9876543210fedcba9876543210';
      server.overrides['GET /me'] = FakeServer.admin;
      await boot(tester, saved: {'token': 'tok', 'deviceId': old});
      await tester.pumpAndSettle();

      server.overrides['GET /me'] = {
        ...FakeServer.actingAsTest,
        'interests': ['verktoy', 'gaming', 'sykling'],
      };
      await session.switchTo('test-1');
      await tester.pumpAndSettle();
      expect(session.actingAs, isTrue);

      server.overrides['GET /me'] = FakeServer.admin;
      await session.returnToAdmin();
      await tester.pumpAndSettle();

      expect(session.isAdmin, isTrue);
      expect((await prefs()).getString('deviceId'), old);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
      expect(server.requests, isNot(contains('POST /auth/logout')));
    });
  });

  group('the stranger is not a dead end', () {
    Future<void> asStranger(WidgetTester tester) async {
      // Who the server says you are, when a screen asks again.
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await boot(tester);
      await tester.pumpAndSettle();
      await skipInterests(tester);
    }

    testWidgets('1. its profile has a way in for somebody who already has an account',
        (tester) async {
      await asStranger(tester);
      await tapTab(tester, 'Profil');

      expect(find.text('Du ser deg rundt'), findsOneWidget);
      expect(find.widgetWithText(PrimaryButton, 'Lag profil'), findsOneWidget);
      expect(find.text('Har du konto? '), findsOneWidget);

      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();

      // 16c is drawn without the bar, so it covers it — and it was opened
      // from somewhere, so it has a way back there.
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(SwaplyNavBar), findsNothing);
      await tester.tap(find.text('‹'));
      await tester.pumpAndSettle();
      expect(find.text('Du ser deg rundt'), findsOneWidget);
      expect(find.byType(SwaplyNavBar), findsOneWidget);
    });

    Future<void> signIn(WidgetTester tester) async {
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      // From here on the server knows you as the account signed in to.
      server.overrides['GET /me'] =
          (server.overrides['POST /auth/login'] as Map<String, Object?>)['user'];
      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'passord');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pumpAndSettle();
    }

    testWidgets('2. signing in carries the device\'s token, and says what came along',
        (tester) async {
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': FakeServer.me,
        'carried': {'likes': 3},
      };
      await asStranger(tester);
      await signIn(tester);

      // The bearer is how the server knows which device to fold in.
      expect(server.bearers['POST /auth/login'], 'Bearer ${FakeServer.deviceToken}');
      expect(find.text('Tingene du likte er tatt med.'), findsOneWidget);
      expect(find.byType(SwaplyToast), findsOneWidget);

      // Somebody else now, so a fresh app: nothing of the stranger's stacks.
      expect(session.me?.id, FakeServer.me['id']);
      expect(session.anonymous, isFalse);
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(find.text('Du ser deg rundt', skipOffstage: false), findsNothing);
      expect(find.byType(TabShell, skipOffstage: false), findsOneWidget);
    });

    testWidgets('3. …and nothing, when nothing came along', (tester) async {
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': FakeServer.me,
        'carried': {'likes': 0},
      };
      await asStranger(tester);
      await signIn(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer ${FakeServer.deviceToken}');
      expect(find.byType(SwaplyToast), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('…and when the server does not answer, says that rather than nothing',
        (tester) async {
      server.overrides['POST /auth/login'] = unreachable;
      await asStranger(tester);
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'passord');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pumpAndSettle();

      expect(find.text('Vi får ikke kontakt med Swaply akkurat nå.'), findsOneWidget);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(session.anonymous, isTrue);
    });

    testWidgets('…but a sign-in the server took is not called off when the next question fails',
        (tester) async {
      // The stranger is folded in and gone by then, so a second try would
      // find nothing to bring along and nothing to say.
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': FakeServer.me,
        'carried': {'likes': 3},
      };
      await asStranger(tester);
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      server.overrides['GET /me'] = unreachable;
      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(find.byType(TextField).last, 'passord');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pumpAndSettle();

      expect(find.text('Tingene du likte er tatt med.'), findsOneWidget);
      expect(find.text(noContact), findsNothing);
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      expect(session.me?.id, FakeServer.me['id']);
      expect((await prefs()).getString('token'), 'tok');
    });

    testWidgets('…and an answer that comes after ‹ closed the form lands nowhere', (tester) async {
      final login = Completer<Object?>();
      final register = Completer<Object?>();
      server.overrides['POST /auth/login'] = (_) => login.future;
      server.overrides['POST /auth/register'] = (_) => register.future;
      await asStranger(tester);
      await tapTab(tester, 'Profil');

      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pump();
      await tester.tap(find.text('‹'));
      await tester.pumpAndSettle();
      login.complete(401);
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
      await tester.pump();
      await tester.tap(find.text('‹'));
      await tester.pumpAndSettle();
      register.complete(const Refusal(400, 'validation', 'Skriv inn en gyldig e-postadresse.'));
      await tester.pumpAndSettle();

      expect(find.text('Du ser deg rundt'), findsOneWidget);
    });

    testWidgets('4. the stranger had its 02, so an account with no interests is not asked again',
        (tester) async {
      // Skipped on the account's first phone, and skipped here as the
      // stranger a minute ago. 02 is this phone's first run, and it was twice
      // in a row — with the toast lying across «Fortsett».
      final fresh = {...FakeServer.me, 'interests': const <String>[]};
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': fresh,
        'carried': {'likes': 1},
      };
      await asStranger(tester);
      await signIn(tester);

      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      // Nor owed for next time: a cold start is not a way back to it.
      expect((await prefs()).getString('interestsPendingFor'), isNull);

      // The toast is on the app, clear of the bar, not over a button.
      expect(find.text('Tingen du likte er tatt med.'), findsOneWidget);
      expect(tester.getRect(find.byType(SwaplyToast)).bottom,
          lessThanOrEqualTo(tester.getRect(find.byType(SwaplyNavBar)).top));
    });

    /// A claim keeps the row, so the server answers with the stranger's own id.
    Map<String, Object?> claimed() => {
          ...FakeServer.me,
          'id': FakeServer.lookingAround['id'],
          'interests': const <String>[],
        };

    Future<void> startListing(WidgetTester tester) async {
      await tapTab(tester, 'Legg ut');
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      await tester.pumpAndSettle();
    }

    Future<void> fillProfile(WidgetTester tester, String button) async {
      for (final (field, text) in [
        (0, 'Ola N.'),
        (1, 'ola@epost.no'),
        (2, '412 34 567'),
        (3, 'drillbits123'),
      ]) {
        await tester.enterText(find.byType(TextField).at(field), text);
      }
      await tester.tap(find.widgetWithText(PrimaryButton, button));
      await tester.pumpAndSettle();
    }

    testWidgets('5. making a profile claims the stranger, and the listing still goes out',
        (tester) async {
      // Through the real gate, which is where this went wrong: 02 had been
      // skipped, the claimed account still had no interests, and the gate
      // swapped the app for the picker — taking the half-filled form with it.
      server.overrides['POST /auth/register'] = {'token': 'tok', 'user': claimed()};
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await asStranger(tester);
      server.overrides['GET /me'] = claimed();
      await startListing(tester);

      expect(find.text('Lag profil og legg ut'), findsOneWidget);
      await fillProfile(tester, 'Lag profil og legg ut');

      expect(server.bearers['POST /auth/register'], 'Bearer ${FakeServer.deviceToken}');
      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('6. 10c to 16c and back is the same 10c, still step two of the listing',
        (tester) async {
      // The detour used to swap 10c for 16c and back for a new 10c, which told
      // the listing waiting on the first one that it was over: the profile
      // got made, and the thing it was made for did not go out.
      server.overrides['POST /auth/register'] = {'token': 'tok', 'user': claimed()};
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await asStranger(tester);
      server.overrides['GET /me'] = claimed();
      await startListing(tester);
      await tester.enterText(find.byType(TextField).first, 'Ola Nordmann');

      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);

      await tester.tap(find.text('Opprett konto'));
      await tester.pumpAndSettle();
      // Back down to it rather than a second one: still 2/2, and still what
      // was typed into it.
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      expect(find.byType(CreateProfileScreen, skipOffstage: false), findsOneWidget);
      expect(find.text('2/2'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Ola Nordmann'), findsOneWidget);

      await fillProfile(tester, 'Lag profil og legg ut');

      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
      expect(find.byType(CreateProfileScreen, skipOffstage: false), findsNothing);
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
      expect(session.anonymous, isFalse);
    });

    testWidgets('…and 16c from the profile turns into 10c in its place', (tester) async {
      await asStranger(tester);
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Opprett konto'));
      await tester.pumpAndSettle();
      expect(find.byType(CreateProfileScreen), findsOneWidget);
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);

      await tester.tap(find.text('‹'));
      await tester.pumpAndSettle();
      expect(find.text('Du ser deg rundt'), findsOneWidget);
    });
  });
}
