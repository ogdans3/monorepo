// A tab follows the others.
//
// On the web every tab of the site keeps the session's token in one storage,
// and each tab read it once, when it opened. A tab left open went on as the
// person another tab had signed out — holding the token that tab had revoked,
// writing it back on its next change, keeping drafts for somebody no longer
// there — and went on as whoever it was after another tab signed somebody
// else in. So the rule held here: a tab hears the browser's `storage` event
// for the token and follows the storage, which is read again at the event
// rather than trusted from it. Signed out there, this tab lets go and the gate
// makes it the same stranger as that one; signed in there, this tab becomes
// whoever that is. And a tab never writes over a token another tab has put
// there since it last looked: not the one it holds, and not a stranger made
// without anybody asking.
//
// And tabs that become strangers together are one stranger. Each starts its
// own at the same moment, and each used to find no device id kept and make
// one of its own: two accounts, one of them left behind with nobody holding
// it, and the id kept belonging to that one rather than to the account every
// tab was using. So the id the next stranger will have is kept before the
// token goes, whenever it is known that the old one is no way back in — on
// «Logg ut», and once a profile has spent it — and a stranger's token is kept
// together with the id it was made with.
//
// The event is a stand-in here, and so is the other tab: it writes the
// storage underneath this tab's copy of it, as a browser tab does, and this
// tab hears of it only through the event. Where both tabs have to do their
// own part — 11 and 12 — the other tab is a second session over the same
// storage, on a connection of its own, and this tab still hears it only when
// the test delivers the event.
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
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/listing_draft.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// The browser telling this tab another one changed the token.
late StreamController<void> storageEvents;

/// How many times the session has sent the app back through the gate.
late int sentBack;

/// Another tab of the site writes the storage both tabs share: [writes] over
/// what is there, null for a key it removes. This tab hears of it through the
/// event unless [heard] is false — a change the browser has not delivered
/// yet.
Future<void> otherTab(WidgetTester tester, Map<String, Object?> writes, {bool heard = true}) async {
  final prefs = await SharedPreferences.getInstance();
  final stored = <String, Object>{for (final key in prefs.getKeys()) key: prefs.get(key)!};
  writes.forEach((key, value) => value == null ? stored.remove(key) : stored[key] = value);
  SharedPreferences.setMockInitialValues(stored);
  if (heard) storageEvents.add(null);
  await tester.pumpAndSettle();
}

Future<String?> storedToken() async => (await SharedPreferences.getInstance()).getString('token');

/// Who the server says each token is.
Object? whoFor(http.Request request) => switch (request.headers['authorization']) {
      'Bearer tok' => FakeServer.me,
      'Bearer tok-kari' => {
          ...FakeServer.me,
          ...FakeServer.kari,
          'email': 'kari@epost.no',
          'interests': ['friluft'],
        },
      'Bearer ${FakeServer.deviceToken}' => FakeServer.lookingAround,
      _ => 401,
    };

/// This tab's session, listening for the others. Made inside the test, not
/// in `setUp`: a subscription made outside the test's clock hears its events
/// outside it too, and the test would never see the tab follow.
void openTab() {
  storageEvents = StreamController<void>.broadcast();
  session = Session(api, otherTabs: storageEvents.stream);
  sentBack = 0;
  session.sentBack.listen((_) => sentBack++);
}

/// Another tab of the site, open next to this one: a session of its own on a
/// connection of its own, over the storage both keep, told about this tab's
/// changes through an event of its own.
({Session session, StreamController<void> events}) secondTab() {
  final events = StreamController<void>.broadcast();
  final tab = Session(SwaplyApi(baseUrl: 'http://test', client: server.client),
      otherTabs: events.stream);
  return (session: tab, events: events);
}

/// `/auth/anonymous` as the real route answers it: one account for each
/// device id, made the first time the id is seen, and a new session every
/// time — so two tabs that sent one id hold two tokens for one account. An
/// id whose account has a profile is refused.
class Devices {
  Devices() {
    server.overrides['POST /auth/anonymous'] = start;
    server.overrides['GET /me'] = me;
  }

  /// Every device id sent, in order.
  final sent = <String>[];

  /// The account each device id made.
  final accounts = <String, String>{};

  /// The account each session token opens.
  final tokens = <String, String>{};

  final claimed = <String>{};

  /// Tokens the server no longer knows.
  final refused = <String>{};

  Object? start(http.Request request) {
    final id = (jsonDecode(request.body) as Map)['deviceId'] as String;
    sent.add(id);
    if (claimed.contains(id)) return Refusal.deviceClaimed;
    final account = accounts.putIfAbsent(id, () => 'anon-${accounts.length + 1}');
    final token = 'tok-anon-${tokens.length + 1}';
    tokens[token] = account;
    return {'token': token, 'user': {...FakeServer.lookingAround, 'id': account}};
  }

  Object? me(http.Request request) {
    final bearer = request.headers['authorization']?.substring('Bearer '.length);
    if (refused.contains(bearer)) return 401;
    final account = tokens[bearer];
    return account == null ? whoFor(request) : {...FakeServer.lookingAround, 'id': account};
  }
}

/// A cold start as Ola, with nothing on screen: the session alone.
Future<void> restoreAsOla(WidgetTester tester) async {
  openTab();
  SharedPreferences.setMockInitialValues({'token': 'tok', 'deviceId': 'dev-0123456789abcdef'});
  await session.restore();
  await tester.pumpAndSettle();
  expect(session.me?.id, FakeServer.me['id']);
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    server.overrides['GET /me'] = whoFor;
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
  });

  group('signed out in another tab', () {
    testWidgets('1. this tab lets go too, without signing out a second time', (tester) async {
      await restoreAsOla(tester);

      // That tab signed out, and kept the device id its next stranger will
      // have before it let go of the token.
      await otherTab(tester, {'token': null, 'deviceId': 'dev-fedcba9876543210'});

      expect(session.signedIn, isFalse);
      expect(api.token, isNull);
      expect(sentBack, 1);
      expect(server.requests, isNot(contains('POST /auth/logout')));
      // Nothing written back: the storage says nobody, as that tab left it.
      expect(await storedToken(), isNull);
    });

    testWidgets('…and a form left open keeps nothing for somebody who is no longer there',
        (tester) async {
      await restoreAsOla(tester);
      tester.view.physicalSize = const Size(430, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MultiProvider(
        providers: [
          Provider<SwaplyApi>.value(value: api),
          ChangeNotifierProvider<Session>.value(value: session),
        ],
        child: const MaterialApp(home: PostItemScreen()),
      ));
      await tester.pumpAndSettle();
      // Typed, and signed out elsewhere before the typing had held still.
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();

      await otherTab(tester, {'token': null});
      await tester.pump(const Duration(seconds: 2));

      expect((await SharedPreferences.getInstance()).getString('listingDraft:me-1'), isNull);
    });

    testWidgets('2. and the gate makes it the same stranger as that tab, by its device id',
        (tester) async {
      await restoreAsOla(tester);
      await otherTab(tester, {'token': null, 'deviceId': 'dev-fedcba9876543210'});

      session.begin();
      await tester.pumpAndSettle();

      expect(server.bodies['POST /auth/anonymous']!['deviceId'], 'dev-fedcba9876543210');
      expect(server.bearers['POST /auth/anonymous'], isNull);
      expect(session.anonymous, isTrue);
    });
  });

  group('signed in in another tab', () {
    testWidgets('3. this tab becomes whoever that is', (tester) async {
      await restoreAsOla(tester);

      await otherTab(tester, {'token': 'tok-kari'});

      expect(server.bearers['GET /me'], 'Bearer tok-kari');
      expect(session.me?.id, FakeServer.kari['id']);
      expect(session.loading, isFalse);
      expect(sentBack, 1);
      expect(await storedToken(), 'tok-kari');
    });

    testWidgets('4. and leaves the listing that tab is finishing to that tab', (tester) async {
      await restoreAsOla(tester);
      // Kari signed in on 10c in the other tab, halfway through a listing,
      // which that tab's new app is sending.
      await session.drafts.save(
          'kari-1',
          const ListingDraft(
            kind: 'item',
            category: 'friluft',
            condition: 'good',
            title: 'Fiskestang',
            description: '',
            subcategory: '',
            value: '',
            postalCode: '',
            photos: [],
            finish: true,
          ));

      await otherTab(tester, {'token': 'tok-kari'});

      expect(session.me?.id, FakeServer.kari['id']);
      expect(session.listingToFinish, isNull);
    });

    testWidgets('…and signed out there again before this tab knew who that was: nobody, and no splash left standing',
        (tester) async {
      await restoreAsOla(tester);
      final answer = Completer<Object?>();
      server.overrides['GET /me'] = (http.Request request) =>
          request.headers['authorization'] == 'Bearer tok-kari' ? answer.future : whoFor(request);

      await otherTab(tester, {'token': 'tok-kari'});
      expect(session.loading, isTrue);
      await otherTab(tester, {'token': null});
      answer.complete(whoFor(http.Request('GET', Uri.parse('http://test/me'))
        ..headers['authorization'] = 'Bearer tok-kari'));
      await tester.pumpAndSettle();

      expect(session.loading, isFalse);
      expect(session.signedIn, isFalse);
      expect(api.token, isNull);
    });

    testWidgets('5. a change this tab already has is nothing to follow', (tester) async {
      await restoreAsOla(tester);
      final asked = server.asked('GET /me');

      await otherTab(tester, {'token': 'tok'});

      expect(server.asked('GET /me'), asked);
      expect(sentBack, 0);
      expect(session.me?.id, FakeServer.me['id']);
    });
  });

  group('never over another tab', () {
    testWidgets('6. a token refused here does not take away the one another tab has put there since',
        (tester) async {
      // Ola's token is checked as the tab opens. Meanwhile Kari signs in in
      // another tab, and Ola's comes back refused: signed out elsewhere.
      SharedPreferences.setMockInitialValues({'token': 'tok'});
      server.overrides['GET /me'] = (http.Request request) {
        if (request.headers['authorization'] == 'Bearer tok') {
          SharedPreferences.setMockInitialValues({'token': 'tok-kari'});
          return 401;
        }
        return whoFor(request);
      };

      openTab();
      await session.restore();
      await tester.pumpAndSettle();

      expect(await storedToken(), 'tok-kari');
      expect(session.me?.id, FakeServer.kari['id']);
    });

    testWidgets('7. a stranger made here without asking does not sign out somebody another tab has just signed in',
        (tester) async {
      // Nobody signed in anywhere; this tab's gate makes a stranger, and
      // while it is on its way Ola signs in in another tab.
      server.overrides['POST /auth/anonymous'] = (http.Request _) {
        SharedPreferences.setMockInitialValues({'token': 'tok'});
        return asUsual;
      };
      openTab();
      session.loading = false;

      session.begin();
      await tester.pumpAndSettle();

      expect(await storedToken(), 'tok');
      expect(session.me?.id, FakeServer.me['id']);
      expect(session.anonymous, isFalse);
    });

    testWidgets('8. a token refused on coming back does not take away the one another tab put there',
        (tester) async {
      // The same, from the other side: this tab's token is refused on its
      // way back from the background, and the storage already holds Kari,
      // whose sign-in the browser has not told this tab about yet.
      await restoreAsOla(tester);
      await otherTab(tester, {'token': 'tok-kari'}, heard: false);
      server.overrides['GET /me'] = (http.Request request) =>
          request.headers['authorization'] == 'Bearer tok' ? 401 : whoFor(request);
      // An hour in the background.
      now = () => DateTime.now().add(const Duration(hours: 1));
      addTearDown(() => now = DateTime.now);

      await session.wake();
      await tester.pumpAndSettle();

      expect(await storedToken(), 'tok-kari');
      expect(session.me?.id, FakeServer.kari['id']);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
    });
  });

  group('in the app', () {
    Future<void> launch(WidgetTester tester) async {
      tester.view.physicalSize = const Size(430, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      SharedPreferences.setMockInitialValues({'token': 'tok', 'deviceId': 'dev-0123456789abcdef'});
      openTab();
      await tester.pumpWidget(
        ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
      );
      unawaited(session.restore());
      await tester.pumpAndSettle();
    }

    Future<void> openSettings(WidgetTester tester) async {
      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
    }

    testWidgets('9. signed out elsewhere: 16b goes, and the next thing on screen is a new stranger\'s',
        (tester) async {
      await launch(tester);
      await openSettings(tester);

      await otherTab(tester, {'token': null, 'deviceId': 'dev-fedcba9876543210'});

      expect(find.byType(SettingsScreen, skipOffstage: false), findsNothing);
      expect(session.anonymous, isTrue);
      expect(server.bodies['POST /auth/anonymous']!['deviceId'], 'dev-fedcba9876543210');
      expect(find.byType(InterestsScreen), findsOneWidget);
    });

    testWidgets('10. signed in elsewhere as somebody else: 16b goes, and the app is theirs',
        (tester) async {
      await launch(tester);
      await openSettings(tester);

      await otherTab(tester, {'token': 'tok-kari'});

      expect(find.byType(SettingsScreen, skipOffstage: false), findsNothing);
      expect(session.me?.id, FakeServer.kari['id']);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
    });
  });

  group('one stranger between them', () {
    testWidgets('11. signed out in the other tab: it and this one become the same stranger',
        (tester) async {
      final devices = Devices();
      await restoreAsOla(tester);
      final other = secondTab();
      await other.session.restore();
      await tester.pumpAndSettle();

      await other.session.logout();
      storageEvents.add(null);
      await tester.pumpAndSettle();
      expect(session.signedIn, isFalse);
      // Both gates, on the same frame.
      session.begin();
      other.session.begin();
      await tester.pumpAndSettle();

      final prefs = await SharedPreferences.getInstance();
      expect(devices.sent, hasLength(2));
      expect(devices.sent.toSet(), hasLength(1));
      expect(devices.sent.first, isNot('dev-0123456789abcdef'));
      expect(devices.accounts, hasLength(1));
      expect(prefs.getString('deviceId'), devices.sent.first);
      expect(devices.tokens[prefs.getString('token')], devices.accounts.values.single);
      expect(session.me?.id, devices.accounts.values.single);
      expect(other.session.me?.id, devices.accounts.values.single);
    });

    testWidgets('12. a profile made in the other tab spends the id, so a token refused later leaves one stranger too',
        (tester) async {
      // Both tabs are the stranger the phone's id made, and the other one
      // makes a profile on it. Later the account is deleted from another
      // phone, the other tab hears so first, and both become strangers.
      const spent = 'dev-0123456789abcdef';
      final devices = Devices();
      SharedPreferences.setMockInitialValues(
          {'token': FakeServer.deviceToken, 'deviceId': spent});
      openTab();
      await session.restore();
      final other = secondTab();
      await other.session.restore();
      await tester.pumpAndSettle();
      expect(other.session.anonymous, isTrue);

      await other.session.register(
          displayName: 'Ola N.', email: 'ola@epost.no', password: 'byttehandel1');
      devices.claimed.add(spent);
      storageEvents.add(null);
      await tester.pumpAndSettle();
      expect(session.me?.id, FakeServer.me['id']);

      devices.refused.add('tok');
      now = () => DateTime.now().add(const Duration(hours: 1));
      addTearDown(() => now = DateTime.now);
      await other.session.wake();
      storageEvents.add(null);
      await tester.pumpAndSettle();
      expect(session.signedIn, isFalse);
      session.begin();
      other.session.begin();
      await tester.pumpAndSettle();

      final prefs = await SharedPreferences.getInstance();
      expect(devices.sent, isNot(contains(spent)));
      expect(devices.sent.toSet(), hasLength(1));
      expect(devices.accounts, hasLength(1));
      expect(prefs.getString('deviceId'), devices.sent.first);
      expect(session.me?.id, other.session.me?.id);
      expect(session.anonymous, isTrue);
    });

    testWidgets('13. a stranger made here is kept with the id it was made with, whatever another tab kept meanwhile',
        (tester) async {
      // The site's storage cleared under two open tabs: neither has an id to
      // share, so each makes one, and the other tab's is kept after this
      // one's while both are on their way. Two accounts it is — nothing in
      // the storage tells two such tabs apart — but the id kept must be the
      // one that opens the account whose token is kept, which the other tab
      // follows when its own answer comes. A token refused later comes back
      // with that id, and with the other one the next stranger would be the
      // account nobody went on as.
      final devices = Devices();
      server.overrides['POST /auth/anonymous'] = (http.Request request) async {
        final answer = devices.start(request);
        final prefs = await SharedPreferences.getInstance();
        SharedPreferences.setMockInitialValues({
          for (final key in prefs.getKeys()) key: prefs.get(key)!,
          'deviceId': 'dev-other-tab-0123456789abcdef',
        });
        return answer;
      };
      openTab();
      session.loading = false;

      session.begin();
      await tester.pumpAndSettle();

      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      expect(session.anonymous, isTrue);
      expect(prefs.getString('token'), isNotNull);
      expect(prefs.getString('deviceId'), devices.sent.single);
      expect(devices.accounts[prefs.getString('deviceId')], devices.tokens[prefs.getString('token')]);
    });

    testWidgets('14. an id spent before any of this, refused in two tabs at once, is replaced once and not once in each',
        (tester) async {
      // A profile made by an older app kept the id it spent. Both tabs send
      // it, both are refused, and the other tab has already kept the next
      // one by the time this tab hears its refusal: that one is this tab's
      // too, rather than a third.
      const spent = 'dev-0123456789abcdef';
      const next = 'dev-next-0123456789abcdef';
      final devices = Devices()..claimed.add(spent);
      server.overrides['POST /auth/anonymous'] = (http.Request request) async {
        if ((jsonDecode(request.body) as Map)['deviceId'] == spent) {
          SharedPreferences.setMockInitialValues({'deviceId': next});
        }
        return devices.start(request);
      };
      SharedPreferences.setMockInitialValues({'deviceId': spent});
      openTab();
      session.loading = false;

      session.begin();
      await tester.pumpAndSettle();

      expect(devices.sent, [spent, next]);
      expect((await SharedPreferences.getInstance()).getString('deviceId'), next);
      expect(session.me?.id, devices.accounts[next]);
    });
  });
}
