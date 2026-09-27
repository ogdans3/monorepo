// Every way into an account keeps what the phone did.
//
// `CLAUDE.md`: «Making that profile *claims the device's account* rather than
// making a second one, so every like survives … signing in from there *folds
// the device's account into theirs*.» The server does the keeping, and it can
// only keep what it is told about: the stranger's token has to be on the
// request. Sent without it, the sign-in works and the hearts stay behind with a
// stranger nobody will be again — which is what a person reads as «I signed in
// and lost what I liked».
//
// So this file walks every path that ends with the phone holding a named
// account's token — 10c and 16c from each place they open, the invitation's
// two buttons, the invite-only gate, after «Logg ut», after a start that
// failed, and the account switcher, which must never fold — and holds each to
// the bearer it sends and to the hearts on screen afterwards. Where nothing
// had been made yet, it says so: there is nothing to keep, and the test pins
// that no stranger is conjured up only to be lost.
//
// The races are the other half. A sign-in sent while the stranger was still
// being made went without its token, and the stranger then landed on top of
// the account signed in to. The session now waits for a start in flight, and
// drops an answer about who the phone is that arrives after a sign-in. It
// waits for a heart in flight too: one that reached the server after the
// sign-in found the stranger already folded away, and was lost — or, taken
// back, stayed on the account.
//
// [Ledger] is the server's memory of who liked what, kept by bearer and
// folded or claimed the way `backend/src/auth/merge.ts` and `/auth/register`
// do. A missing bearer shows up here as a missing heart, not as a header
// nobody read.
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
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

/// Who has liked what, by account, and which token opens which account.
class Ledger {
  Ledger(this.server) {
    accounts['me-1'] = {...FakeServer.me};
    // An unclaimed test account, as `POST /admin/accounts` with
    // `claimed: false` makes one: a device with a mark on it.
    accounts['test-1'] = {
      ...FakeServer.lookingAround,
      'id': 'test-1',
      'displayName': 'Testbruker Én',
      'testAccount': true,
    };
    for (final item in items.keys) {
      _route('POST /items/$item/like', (r) => _like(r, item));
      _route('DELETE /items/$item/like', (r) => _unlike(r, item));
      _route('GET /items/$item', (r) => _item(item, _viewer(r)));
    }
    _route('POST /auth/anonymous', _anonymous);
    _route('POST /auth/login', _login);
    _route('POST /auth/register', _register);
    _route('POST /auth/logout', (r) {
      sessions.remove(_token(r));
      return <String, Object?>{};
    });
    _route('GET /me', (r) {
      final viewer = _viewer(r);
      if (viewer == null) return 401;
      return {
        ...accounts[viewer]!,
        if (switched.contains(_token(r)))
          'actingAs': {'adminId': 'me-1', 'adminName': 'Ola N.'},
      };
    });
    _route('GET /me/likes', (r) {
      final viewer = _viewer(r);
      if (viewer == null) return 401;
      return {'items': [for (final item in hearts[viewer] ?? const []) _item(item, viewer)]};
    });
    _route('GET /discover', (r) {
      final viewer = _viewer(r);
      final shown = [
        for (final item in items.keys)
          if (items[item]!['ownerId'] != viewer) _item(item, viewer),
      ];
      return {'total': shown.length, 'items': shown};
    });
    _route('POST /admin/accounts/test-1/session', (r) {
      final viewer = _viewer(r);
      if (viewer == null || accounts[viewer]!['isAdmin'] != true) return null;
      final token = _mint('test-1');
      switched.add(token);
      return {'token': token, 'displayName': 'Testbruker Én', 'id': 'test-1'};
    });
  }

  final FakeServer server;

  static const email = 'ola@epost.no';
  static const password = 'passord';

  /// Ola's drill and Kari's console. The drill is the one a stranger who
  /// turns out to be Ola cannot bring along: a wish for one's own thing.
  static final items = {'item-drill': FakeServer.drill, 'item-console': FakeServer.console};

  final accounts = <String, Map<String, Object?>>{};
  final sessions = <String, String>{};
  final devices = <String, String>{};
  final hearts = <String, List<String>>{};

  /// Minted by the account switcher. A sign-in from one of these folds
  /// nothing, as on the server.
  final switched = <String>{};

  /// The token the last stranger was handed, and whose it is.
  String? strangerToken, strangerId;

  int _minted = 0;

  String _mint(String account, {bool device = false}) {
    final token = device ? 'tok-device-${++_minted}' : 'tok-${++_minted}';
    sessions[token] = account;
    return token;
  }

  /// A token for [account], as a phone that signed in earlier kept it.
  String signedIn(String account) => _mint(account);

  /// A stranger the server already knows, and the token its phone kept.
  String stranger({List<String> liked = const []}) {
    final id = 'anon-${accounts.length}';
    accounts[id] = {...FakeServer.lookingAround, 'id': id};
    devices['fedcba9876543210fedcba9876543210'] = id;
    hearts[id] = [...liked];
    return strangerToken = _mint(strangerId = id, device: true);
  }

  static String? _token(http.Request r) =>
      r.headers['authorization']?.substring('Bearer '.length);
  String? _viewer(http.Request r) => sessions[_token(r)];
  static Map<String, dynamic> _body(http.Request r) =>
      jsonDecode(r.body) as Map<String, dynamic>;

  void _route(String request, Object? Function(http.Request) answer) =>
      server.overrides[request] = answer;

  /// Answers [request] as it arrives and delivers the answer only when the
  /// returned completer is completed: the server has done its part, and the
  /// network is slow. Once; the next one is answered at once.
  Completer<void> hold(String request) {
    final release = Completer<void>();
    final answer = server.overrides[request] as Object? Function(http.Request);
    server.overrides[request] = (http.Request r) async {
      server.overrides[request] = answer;
      final said = answer(r);
      await release.future;
      return said;
    };
    return release;
  }

  /// [request] reaches the server only when the returned completer is
  /// completed, and is answered then: sent, and still on its way. Once.
  /// Unlike [hold], the server knows nothing of it meanwhile — a request sent
  /// after it can get there first.
  Completer<void> slow(String request) {
    final release = Completer<void>();
    final answer = server.overrides[request] as Object? Function(http.Request);
    server.overrides[request] = (http.Request r) async {
      server.overrides[request] = answer;
      await release.future;
      return answer(r);
    };
    return release;
  }

  /// No answer to [request], once.
  void dropOnce(String request) {
    final answer = server.overrides[request];
    server.overrides[request] = (http.Request _) {
      server.overrides[request] = answer;
      return unreachable;
    };
  }

  Map<String, Object?> _item(String item, String? viewer) => {
        ...items[item]!,
        'owner': items[item]!['ownerId'] == 'me-1'
            ? {'id': 'me-1', 'displayName': 'Ola N.'}
            : FakeServer.kari,
        'likedByMe': hearts[viewer]?.contains(item) ?? false,
      };

  Object? _like(http.Request r, String item) {
    final viewer = _viewer(r);
    if (viewer == null) return 401;
    if (items[item]!['ownerId'] == viewer) {
      return const Refusal(400, 'own_item', 'Du kan ikke like din egen ting.');
    }
    final mine = hearts[viewer] ??= [];
    if (!mine.contains(item)) mine.add(item);
    return {'liked': true, 'tradeId': null, 'promptToList': false, 'likedCount': mine.length};
  }

  Object? _unlike(http.Request r, String item) {
    final viewer = _viewer(r);
    if (viewer == null) return 401;
    hearts[viewer]?.remove(item);
    return <String, Object?>{};
  }

  Object? _anonymous(http.Request r) {
    final device = _body(r)['deviceId'] as String;
    final known = devices[device];
    if (known != null && accounts.containsKey(known)) {
      if (accounts[known]!['email'] != null) return Refusal.deviceClaimed;
      return {'token': strangerToken = _mint(strangerId = known, device: true),
              'user': accounts[known]};
    }
    final id = 'anon-${accounts.length}';
    accounts[id] = {...FakeServer.lookingAround, 'id': id};
    devices[device] = id;
    return {'token': strangerToken = _mint(strangerId = id, device: true), 'user': accounts[id]};
  }

  /// `/auth/login`, folding the way `mergeDeviceAccount` does: only an
  /// unclaimed device that is nobody's test account, never a switched
  /// session, and less the wishes for the account's own things.
  Object? _login(http.Request r) {
    final body = _body(r);
    final target = accounts.entries
        .where((e) => e.value['email'] == body['email'])
        .map((e) => e.key)
        .firstOrNull;
    if (target == null || body['password'] != password) return 401;

    final token = _token(r);
    final device = sessions[token];
    int? carried;
    if (device != null &&
        device != target &&
        !switched.contains(token) &&
        accounts[device]!['email'] == null &&
        accounts[device]!['testAccount'] != true) {
      final mine = hearts[target] ??= [];
      carried = 0;
      for (final item in hearts.remove(device) ?? const <String>[]) {
        if (items[item]!['ownerId'] == target || mine.contains(item)) continue;
        mine.add(item);
        carried = carried! + 1;
      }
      accounts.remove(device);
      sessions.removeWhere((_, owner) => owner == device);
    }
    return {
      'token': _mint(target),
      'user': accounts[target],
      if (carried != null) 'carried': {'likes': carried},
    };
  }

  /// `/auth/register`: a device with no name is claimed, row and hearts;
  /// anybody else gets a new account.
  Object? _register(http.Request r) {
    final body = _body(r);
    final token = _token(r);
    final device = sessions[token];
    final claiming = device != null && accounts[device]!['email'] == null;
    final id = claiming ? device : 'user-${accounts.length}';
    accounts[id] = {
      ...FakeServer.me,
      'id': id,
      'displayName': body['displayName'],
      'email': body['email'],
      'interests': const <String>[],
      'items': const <Object>[],
    };
    if (claiming) sessions.remove(token);
    return {'token': _mint(id), 'user': accounts[id]};
  }
}

late FakeServer server;
late Ledger ledger;
late SwaplyApi api;
late Session session;

/// What `main.dart` does, at an address if [at] is given: the gate from the
/// first frame, and the session restoring itself underneath it.
Future<void> boot(WidgetTester tester, {Map<String, Object> saved = const {}, String? at}) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  if (at != null) {
    tester.platformDispatcher.defaultRouteNameTestValue = at;
    addTearDown(tester.platformDispatcher.clearDefaultRouteNameTestValue);
  }

  SharedPreferences.setMockInitialValues(saved);
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
  );
  unawaited(session.restore());
}

int asked(String request) => server.requests.where((r) => r == request).length;

Future<String?> keptToken() async => (await SharedPreferences.getInstance()).getString('token');

Future<void> tapTab(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text(label)));
  await tester.pumpAndSettle();
}

Future<void> skipInterests(WidgetTester tester) async {
  await tester.tap(find.text('Hopp over'));
  await tester.pumpAndSettle();
}

/// The heart on [item]'s card in Oppdag, by what it says.
Finder heart(String item, {required bool liked}) => find.descendant(
    of: find.byKey(ValueKey(item)),
    matching: find.bySemanticsLabel(liked ? 'Du vil ha denne' : 'Jeg vil ha'));

Future<void> like(WidgetTester tester, String item) async {
  await tester.tap(heart(item, liked: false));
  await tester.pumpAndSettle();
}

/// A first start, past 02, with [items] liked on the grid.
Future<void> strangerWhoLiked(WidgetTester tester, List<String> items) async {
  await boot(tester);
  await tester.pumpAndSettle();
  await skipInterests(tester);
  for (final item in items) {
    await like(tester, item);
  }
  expect(ledger.hearts[ledger.strangerId], items);
}

/// 16c filled in and sent, without waiting for the answer.
Future<void> send16c(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).first, Ledger.email);
  await tester.enterText(find.byType(TextField).last, Ledger.password);
  await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
  await tester.pump();
}

Future<void> signInOn16c(WidgetTester tester) async {
  await send16c(tester);
  await tester.pumpAndSettle();
}

/// 10c filled in and sent with [button], without waiting for the answer.
Future<void> send10c(WidgetTester tester, String button) async {
  for (final (field, text) in [
    (0, 'Siri'),
    (1, 'siri@epost.no'),
    (2, '412 34 567'),
    (3, 'drillbits123'),
  ]) {
    await tester.enterText(find.byType(TextField).at(field), text);
  }
  await tester.tap(find.widgetWithText(PrimaryButton, button));
  await tester.pump();
}

/// What Oppdag draws for Ola once she is signed in: her own drill is not on
/// it, and the console carries the heart the stranger gave it.
Future<void> expectOlasGridKeepsTheConsole(WidgetTester tester) async {
  if (find.byType(DiscoverScreen).evaluate().isEmpty) await tapTab(tester, 'Oppdag');
  expect(session.me?.id, 'me-1');
  expect(heart('item-console', liked: true), findsOneWidget);
  expect(find.byKey(const ValueKey('item-drill')), findsNothing);
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    ledger = Ledger(server);
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api);
  });

  group('signing in from a stranger folds it in', () {
    testWidgets('1. from Profil: the stranger\'s token goes along, and its hearts come back',
        (tester) async {
      await strangerWhoLiked(tester, ['item-drill', 'item-console']);
      final stranger = ledger.strangerToken;

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $stranger');
      expect(ledger.hearts['me-1'], ['item-console']);
      // The drill is Ola's own. A stranger's heart on it is a heart nobody
      // can hold once the stranger turns out to be her, so it stays behind —
      // and the toast counts only what came along.
      expect(find.text('Tingen du likte er tatt med.'), findsOneWidget);
      await expectOlasGridKeepsTheConsole(tester);
      expect(await keptToken(), api.token);
    });

    testWidgets('2. from 10c, halfway through listing something', (tester) async {
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await strangerWhoLiked(tester, ['item-console']);
      final stranger = ledger.strangerToken;

      await tapTab(tester, 'Legg ut');
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $stranger');
      expect(ledger.hearts['me-1'], ['item-console']);
      expect(asked('POST /items'), 1);
      await expectOlasGridKeepsTheConsole(tester);
    });

    testWidgets('3. into the owner\'s own account, which holds the key', (tester) async {
      // Only a test account is refused as the account signed in to. The
      // person who runs the tooling tries the app on a phone like anybody.
      ledger.accounts['me-1'] = {...FakeServer.admin};
      await strangerWhoLiked(tester, ['item-console']);
      final stranger = ledger.strangerToken;

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $stranger');
      expect(session.isAdmin, isTrue);
      expect(ledger.hearts['me-1'], ['item-console']);
      await expectOlasGridKeepsTheConsole(tester);
    });
  });

  group('a heart on its way is not left behind by a sign-in', () {
    /// Past 02 as a stranger, with nothing liked yet.
    Future<void> stranger(WidgetTester tester) async {
      await boot(tester);
      await tester.pumpAndSettle();
      await skipInterests(tester);
    }

    /// 16c from Profil, sent while whatever is on its way still is.
    Future<void> signInMeanwhile(WidgetTester tester) async {
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
    }

    testWidgets('1. a heart still on its way is waited for, and comes along', (tester) async {
      // Sent at once, the sign-in folded the stranger away before the heart
      // got there, and the heart arrived for nobody.
      await stranger(tester);
      final token = ledger.strangerToken;
      final arriving = ledger.slow('POST /items/item-console/like');
      await tester.tap(heart('item-console', liked: false));
      await tester.pump();
      await signInMeanwhile(tester);
      expect(asked('POST /auth/login'), 0);

      arriving.complete();
      await tester.pumpAndSettle();

      expect(server.bearers['POST /items/item-console/like'], 'Bearer $token');
      expect(server.bearers['POST /auth/login'], 'Bearer $token');
      expect(ledger.hearts['me-1'], ['item-console']);
      expect(find.text('Tingen du likte er tatt med.'), findsOneWidget);
      await expectOlasGridKeepsTheConsole(tester);
    });

    testWidgets('2. a heart taken back on its way is taken back before the fold', (tester) async {
      // Sent at once, the sign-in carried the heart along, and taking it back
      // then reached a stranger that was gone: back on, on the account.
      await strangerWhoLiked(tester, ['item-console']);
      final arriving = ledger.slow('DELETE /items/item-console/like');
      await tester.tap(heart('item-console', liked: true));
      await tester.pump();
      await signInMeanwhile(tester);
      expect(asked('POST /auth/login'), 0);

      arriving.complete();
      await tester.pumpAndSettle();

      expect(ledger.hearts['me-1'] ?? const <String>[], isEmpty);
      expect(find.byType(SwaplyToast), findsNothing);
      await tapTab(tester, 'Oppdag');
      expect(heart('item-console', liked: false), findsOneWidget);
    });

    testWidgets('3. a heart pressed while the sign-in is on its way goes to the account',
        (tester) async {
      // The server has folded the stranger in by the time its answer comes
      // back, so the stranger's token opens nothing any more.
      await stranger(tester);
      final answering = ledger.hold('POST /auth/login');
      final signingIn = session.login(Ledger.email, Ledger.password);
      await tester.pump();
      final liking = session.like('item-console');
      await tester.pump(const Duration(milliseconds: 500));
      expect(asked('POST /items/item-console/like'), 0);

      answering.complete();
      await tester.pumpAndSettle();
      await signingIn;
      final landed = await liking;

      expect(session.me?.id, 'me-1');
      expect(server.bearers['POST /items/item-console/like'], 'Bearer ${api.token}');
      expect(landed.likedCount, 1);
      expect(ledger.hearts['me-1'], ['item-console']);
    });

    testWidgets('4. a heart that gets no answer holds the sign-in no longer than it holds itself',
        (tester) async {
      // Bounded by the api's own patience: the sign-in goes after it, and the
      // heart turns back on a card that is gone by then.
      await stranger(tester);
      server.overrides['POST /items/item-console/like'] =
          (http.Request _) => Completer<Object?>().future;
      await tester.tap(heart('item-console', liked: false));
      await tester.pump();
      await signInMeanwhile(tester);
      expect(asked('POST /auth/login'), 0);

      await tester.pump(SwaplyApi.patience);
      await tester.pumpAndSettle();

      expect(asked('POST /auth/login'), 1);
      expect(session.me?.id, 'me-1');
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
    });
  });

  group('making a profile claims the stranger', () {
    testWidgets('1. from Profil: the same row, every heart on it', (tester) async {
      await strangerWhoLiked(tester, ['item-drill', 'item-console']);
      final stranger = ledger.strangerToken, id = ledger.strangerId;

      await tapTab(tester, 'Profil');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
      await tester.pumpAndSettle();
      await send10c(tester, 'Lag profil');
      await tester.pumpAndSettle();

      expect(server.bearers['POST /auth/register'], 'Bearer $stranger');
      expect(session.me?.id, id);
      expect(session.anonymous, isFalse);
      // Nothing is folded, so nothing is left behind: the drill is Ola's,
      // and this is Siri.
      expect(ledger.hearts[id], ['item-drill', 'item-console']);
      await tapTab(tester, 'Oppdag');
      expect(heart('item-drill', liked: true), findsOneWidget);
      expect(heart('item-console', liked: true), findsOneWidget);
    });

    testWidgets('2. from 10b, «Lag profil og legg ut»', (tester) async {
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await strangerWhoLiked(tester, ['item-console']);
      final stranger = ledger.strangerToken, id = ledger.strangerId;

      await tapTab(tester, 'Legg ut');
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      await tester.pumpAndSettle();
      await send10c(tester, 'Lag profil og legg ut');
      await tester.pumpAndSettle();

      expect(server.bearers['POST /auth/register'], 'Bearer $stranger');
      expect(session.me?.id, id);
      expect(asked('POST /items'), 1);
      expect(ledger.hearts[id], ['item-console']);
      await tapTab(tester, 'Oppdag');
      expect(heart('item-console', liked: true), findsOneWidget);
    });
  });

  group('the invitation\'s ways in', () {
    setUp(() => session.pendingInvite = FakeServer.shareToken);

    testWidgets('1. «Lag profil med en gang»: nothing was made, so nothing is sent or lost',
        (tester) async {
      await boot(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lag profil med en gang'));
      await tester.pumpAndSettle();
      await send10c(tester, 'Lag profil');
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 0);
      expect(server.bearers['POST /auth/register'], isNull);
      expect(server.bodies['POST /auth/register']!['invite'], FakeServer.shareToken);
      expect(session.anonymous, isFalse);
    });

    testWidgets('2. «Jeg har konto fra før»: the same, signing in', (tester) async {
      await boot(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Jeg har konto fra før'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(asked('POST /auth/anonymous'), 0);
      expect(server.bearers['POST /auth/login'], isNull);
      expect(session.me?.id, 'me-1');
    });

    testWidgets('3. «Se deg rundt» and then «Jeg har konto fra før» at once: the sign-in waits',
        (tester) async {
      // Both buttons stay under the thumb while the first is on its way. Sent
      // then, the sign-in had no stranger to name, and the stranger landed
      // after it — over the account, as if the sign-in had never happened.
      final start = ledger.hold('POST /auth/anonymous');
      await boot(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se deg rundt'));
      await tester.pump();
      await tester.tap(find.text('Jeg har konto fra før'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));

      expect(asked('POST /auth/login'), 0);

      start.complete();
      await tester.pumpAndSettle();

      expect(server.bearers['POST /auth/login'], 'Bearer ${ledger.strangerToken}');
      expect(ledger.accounts, isNot(contains(ledger.strangerId)));
      expect(session.me?.id, 'me-1');
      expect(await keptToken(), api.token);
      expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      // Ola's app, with what the link shared open over Oppdag.
      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(find.byType(DiscoverScreen, skipOffstage: false), findsOneWidget);
    });

    testWidgets('4. «Se deg rundt» and then «Lag profil med en gang»: the profile claims it',
        (tester) async {
      final start = ledger.hold('POST /auth/anonymous');
      await boot(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se deg rundt'));
      await tester.pump();
      await tester.tap(find.text('Lag profil med en gang'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await send10c(tester, 'Lag profil');
      await tester.pump(const Duration(milliseconds: 500));

      expect(asked('POST /auth/register'), 0);

      start.complete();
      await tester.pumpAndSettle();

      final id = ledger.strangerId;
      expect(server.bearers['POST /auth/register'], 'Bearer ${ledger.strangerToken}');
      expect(session.me?.id, id);
      expect(ledger.accounts[id]!['email'], 'siri@epost.no');
      // The stranger was made under 10c and never saw 02, so it comes now.
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      await skipInterests(tester);
      expect(session.me?.id, id);
      expect(await keptToken(), api.token);
    });

    testWidgets('5. «Se deg rundt» that never answers holds the sign-in as long as the splash waits',
        (tester) async {
      // A host that drops packets is not refused, and a phone takes a minute
      // or two to give up on the connection. The sign-in waits for the start
      // so it can name the stranger — for as long as the splash waits for
      // one, and no longer. Then there is no stranger on this phone to name.
      final start = ledger.hold('POST /auth/anonymous');
      await boot(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se deg rundt'));
      await tester.pump();
      await tester.tap(find.text('Jeg har konto fra før'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
      expect(asked('POST /auth/login'), 0);

      await tester.pump(Session.patience);
      await tester.pump();
      expect(asked('POST /auth/login'), 1);
      await tester.pumpAndSettle();
      expect(server.bearers['POST /auth/login'], isNull);
      expect(session.me?.id, 'me-1');

      // The stranger's answer, when it does come, is about somebody this
      // phone no longer is.
      start.complete();
      await tester.pumpAndSettle();
      expect(session.me?.id, 'me-1');
      expect(await keptToken(), api.token);
      expect(find.byType(ItemDetailScreen), findsOneWidget);
    });
  });

  group('the gate\'s own ways', () {
    testWidgets('1. a server that wants an invitation: 16c at the gate, and no stranger to keep',
        (tester) async {
      server.overrides['POST /auth/anonymous'] = Refusal.inviteRequired;
      await boot(tester);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);

      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], isNull);
      expect(session.me?.id, 'me-1');
    });

    testWidgets('2. after «Logg ut», a new stranger is made before 16c can be reached',
        (tester) async {
      await boot(tester, saved: {'token': ledger.signedIn('me-1')});
      await tester.pumpAndSettle();
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Logg ut'));
      await tester.pumpAndSettle();

      // Nothing between «Logg ut» and the new stranger leads to 16c: the
      // gate makes one behind the splash, and 02 is what comes up.
      expect(asked('POST /auth/anonymous'), 1);
      expect(session.anonymous, isTrue);
      final stranger = ledger.strangerToken;
      await skipInterests(tester);
      await like(tester, 'item-console');

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $stranger');
      expect(ledger.hearts['me-1'], ['item-console']);
      await expectOlasGridKeepsTheConsole(tester);
    });

    testWidgets('3. after a start that failed: no 16c until there is a stranger, then it keeps',
        (tester) async {
      ledger.dropOnce('POST /auth/anonymous');
      await boot(tester);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
        expect(find.byType(LoginScreen, skipOffstage: false), findsNothing);
      }
      expect(find.text(noContact), findsOneWidget);

      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();
      await skipInterests(tester);
      await like(tester, 'item-console');
      final stranger = ledger.strangerToken;

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $stranger');
      expect(ledger.hearts['me-1'], ['item-console']);
    });

    testWidgets('4. a kept stranger the splash could not check is still the one signed in from',
        (tester) async {
      // Offline on the way in: the token is kept, not traded for a new
      // stranger with nothing on it.
      final kept = ledger.stranger(liked: ['item-console']);
      ledger.dropOnce('GET /me');
      await boot(tester, saved: {'token': kept, 'deviceId': 'fedcba9876543210fedcba9876543210'});
      await tester.pumpAndSettle();
      await tester.tap(find.text('Prøv igjen'));
      await tester.pumpAndSettle();

      expect(asked('POST /auth/anonymous'), 0);
      expect(heart('item-console', liked: true), findsOneWidget);

      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $kept');
      expect(ledger.hearts['me-1'], ['item-console']);
      await expectOlasGridKeepsTheConsole(tester);
    });
  });

  group('16c over the splash, by its address', () {
    testWidgets('1. a stranger still being made is waited for, and folded in', (tester) async {
      final start = ledger.hold('POST /auth/anonymous');
      await boot(tester, at: '/login');
      await tester.pump();
      await tester.pump();
      expect(asked('POST /auth/anonymous'), 1);

      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
      expect(asked('POST /auth/login'), 0);

      start.complete();
      await tester.pumpAndSettle();

      expect(server.bearers['POST /auth/login'], 'Bearer ${ledger.strangerToken}');
      expect(ledger.accounts, isNot(contains(ledger.strangerId)));
      expect(session.me?.id, 'me-1');
      expect(await keptToken(), api.token);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('2. a kept stranger still being checked is waited for, hearts and all',
        (tester) async {
      // Sent at once, the sign-in folded the kept token away and the check's
      // late answer put the stranger back over the account.
      final kept = ledger.stranger(liked: ['item-console']);
      final check = ledger.hold('GET /me');
      await boot(tester, saved: {'token': kept}, at: '/login');
      await tester.pump();
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
      expect(asked('POST /auth/login'), 0);

      check.complete();
      await tester.pumpAndSettle();

      expect(server.bearers['POST /auth/login'], 'Bearer $kept');
      expect(ledger.hearts['me-1'], ['item-console']);
      expect(session.me?.id, 'me-1');
      expect(await keptToken(), api.token);
      await expectOlasGridKeepsTheConsole(tester);
    });

    testWidgets('3. a stranger that answers after the splash gave up does not undo the sign-in',
        (tester) async {
      final start = ledger.hold('POST /auth/anonymous');
      await boot(tester, at: '/login');
      await tester.pump();
      await tester.pump(Session.patience);
      expect(session.stalled, isTrue);

      await signInOn16c(tester);
      expect(session.me?.id, 'me-1');
      final signedIn = api.token;

      start.complete();
      await tester.pumpAndSettle();

      expect(session.me?.id, 'me-1');
      expect(session.anonymous, isFalse);
      expect(api.token, signedIn);
      expect(await keptToken(), signedIn);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });
  });

  group('02 after a sign-in is owed only where nobody has been through it', () {
    /// Ola's account, with no interests of her own.
    void olaHasNone() =>
        ledger.accounts['me-1'] = {...FakeServer.me, 'interests': const <String>[]};

    Future<void> intro(WidgetTester tester, {required bool shown}) async {
      expect(session.me?.id, 'me-1');
      expect(find.byType(InterestsScreen), shown ? findsOneWidget : findsNothing);
      expect((await SharedPreferences.getInstance()).getString('interestsPendingFor'),
          shown ? 'me-1' : isNull);
    }

    testWidgets('1. a kept stranger still being checked had its 02, and is folded in with it',
        (tester) async {
      // Read before the check had answered, the phone was nobody yet — and
      // nobody has been through 02 — so the picker came after the sign-in,
      // a second time for the person holding the phone.
      olaHasNone();
      final kept = ledger.stranger(liked: ['item-console']);
      final check = ledger.hold('GET /me');
      await boot(tester, saved: {'token': kept}, at: '/login');
      await tester.pump();
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
      check.complete();
      await tester.pumpAndSettle();

      await intro(tester, shown: false);
      await expectOlasGridKeepsTheConsole(tester);
    });

    testWidgets('2. …and so did one the splash could not check at all', (tester) async {
      // Nothing was kept beside the token saying 02 was still owed.
      olaHasNone();
      final kept = ledger.stranger(liked: ['item-console']);
      ledger.dropOnce('GET /me');
      await boot(tester, saved: {'token': kept}, at: '/login');
      await tester.pumpAndSettle();
      expect(session.stalled, isTrue);
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $kept');
      await intro(tester, shown: false);
    });

    testWidgets('3. a kept stranger still owed its 02 gets it, since nobody has been through it',
        (tester) async {
      olaHasNone();
      final kept = ledger.stranger();
      final check = ledger.hold('GET /me');
      await boot(tester, saved: {'token': kept, 'interestsPendingFor': ledger.strangerId!},
          at: '/login');
      await tester.pump();
      await send16c(tester);
      await tester.pump(const Duration(milliseconds: 500));
      check.complete();
      await tester.pumpAndSettle();

      await intro(tester, shown: true);
    });
  });

  testWidgets('a question the stranger asked before signing in is not answered after it',
      (tester) async {
    // Profil asks who you are on the way in. On a slow line that answer —
    // the stranger — came after the sign-in, and the app went back to it.
    await strangerWhoLiked(tester, ['item-console']);
    final late = ledger.hold('GET /me');
    await tapTab(tester, 'Profil');
    await tester.tap(find.text('Logg inn'));
    await tester.pumpAndSettle();
    await signInOn16c(tester);
    expect(session.me?.id, 'me-1');

    late.complete();
    await tester.pumpAndSettle();

    expect(session.me?.id, 'me-1');
    expect(find.text('Du ser deg rundt', skipOffstage: false), findsNothing);
    await expectOlasGridKeepsTheConsole(tester);
  });

  group('the account switcher is never a sign-in', () {
    testWidgets('1. switching and coming back fold nothing and sign nobody in', (tester) async {
      ledger.accounts['me-1'] = {...FakeServer.admin};
      await boot(tester, saved: {'token': ledger.signedIn('me-1')});
      await tester.pumpAndSettle();

      await session.switchTo('test-1');
      await tester.pumpAndSettle();
      expect(session.actingAs, isTrue);
      await session.returnToAdmin();
      await tester.pumpAndSettle();

      expect(session.me?.id, 'me-1');
      expect(ledger.accounts, contains('test-1'));
      expect(server.requests, isNot(contains('POST /auth/login')));
      expect(server.requests, isNot(contains('POST /auth/anonymous')));
    });

    testWidgets('2. signing in from a switched session leaves the test account\'s hearts with it',
        (tester) async {
      // Acting as an unclaimed test account looks like being a stranger —
      // 13 says «Du ser deg rundt» and offers «Logg inn» — but its hearts are
      // the test account's, and the server folds nothing out of the ring.
      // The app does not hide the session it is in; the server decides.
      ledger.accounts['me-1'] = {...FakeServer.admin};
      await boot(tester, saved: {'token': ledger.signedIn('me-1')});
      await tester.pumpAndSettle();
      await session.switchTo('test-1');
      await tester.pumpAndSettle();
      final acting = api.token;
      await skipInterests(tester);
      await like(tester, 'item-console');

      await tapTab(tester, 'Profil');
      expect(find.text('Du ser deg rundt'), findsOneWidget);
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);

      expect(server.bearers['POST /auth/login'], 'Bearer $acting');
      expect(ledger.hearts['test-1'], ['item-console']);
      expect(ledger.hearts['me-1'], isNull);
      expect(find.text('Tingen du likte er tatt med.'), findsNothing);
      // Ola has her interests, and nothing of the test account's came along.
      expect(find.byType(InterestsScreen, skipOffstage: false), findsNothing);
    });

    /// Ola, who holds the key, signed in and switched to the unclaimed test
    /// account, which has no interests and so is shown 02 — skipped here.
    Future<String> actingAsTheTestAccount(WidgetTester tester,
        {List<String> interests = const ['verktoy', 'gaming', 'sykling']}) async {
      ledger.accounts['me-1'] = {...FakeServer.admin, 'interests': interests};
      final own = ledger.signedIn('me-1');
      await boot(tester, saved: {'token': own});
      await tester.pumpAndSettle();
      await session.switchTo('test-1');
      await tester.pumpAndSettle();
      await skipInterests(tester);
      expect(session.canReturnToAdmin, isTrue);
      return own;
    }

    Future<void> signInFromProfile(WidgetTester tester) async {
      await tapTab(tester, 'Profil');
      await tester.tap(find.text('Logg inn'));
      await tester.pumpAndSettle();
      await signInOn16c(tester);
    }

    testWidgets('3. a sign-in from there lets go of the way back to the admin', (tester) async {
      // «Tilbake til Ola N.» stayed parked after it, for whoever that was,
      // and the next switch went back to that token instead of this one.
      await actingAsTheTestAccount(tester);
      await signInFromProfile(tester);

      expect(session.actingAs, isFalse);
      expect(session.canReturnToAdmin, isFalse);
      expect((await SharedPreferences.getInstance()).getString('adminToken'), isNull);
    });

    testWidgets('4. …and gets 02 where the account signed in to has none', (tester) async {
      // Nothing folds out of the ring, so the test account's walk through 02
      // is not this account's: it is a sign-in with nobody's 02 behind it.
      await actingAsTheTestAccount(tester, interests: const []);
      await signInFromProfile(tester);

      expect(session.me?.id, 'me-1');
      expect(find.byType(InterestsScreen), findsOneWidget);
    });

    testWidgets('5. a question asked before a switch is not answered after it, either way',
        (tester) async {
      // Screens ask who you are on the way in. Asked as the admin and
      // answered after the switch, the admin came back over the test
      // account's token — and the other way round on the way back.
      ledger.accounts['me-1'] = {...FakeServer.admin};
      await boot(tester, saved: {'token': ledger.signedIn('me-1')});
      await tester.pumpAndSettle();

      var late = ledger.hold('GET /me');
      var asking = session.refresh();
      await tester.pump();
      await session.switchTo('test-1');
      late.complete();
      await asking;
      await tester.pumpAndSettle();
      expect(session.me?.id, 'test-1');
      expect(session.actingAs, isTrue);

      await skipInterests(tester);
      late = ledger.hold('GET /me');
      asking = session.refresh();
      await tester.pump();
      await session.returnToAdmin();
      late.complete();
      await asking;
      await tester.pumpAndSettle();
      expect(session.me?.id, 'me-1');
      expect(session.actingAs, isFalse);
    });

    testWidgets('6. nothing is kept until it is known whether 02 is owed', (tester) async {
      // The test account's token was kept before it was asked who that is,
      // and 02 after: a phone that died between the two came back as the
      // test account, past a 02 the lever had promised.
      ledger.accounts['me-1'] = {...FakeServer.admin};
      final own = ledger.signedIn('me-1');
      await boot(tester, saved: {'token': own});
      await tester.pumpAndSettle();
      String? keptWhileAsking;
      final answer = server.overrides['GET /me'] as Object? Function(http.Request);
      server.overrides['GET /me'] = (http.Request r) async {
        keptWhileAsking = await keptToken();
        return answer(r);
      };

      await session.switchTo('test-1');

      expect(keptWhileAsking, own);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('token'), api.token);
      expect(prefs.getString('interestsPendingFor'), 'test-1');
      expect(prefs.getString('adminToken'), own);
    });

    testWidgets('7. a switch that hears nothing back leaves the admin as they were', (tester) async {
      ledger.accounts['me-1'] = {...FakeServer.admin};
      final own = ledger.signedIn('me-1');
      await boot(tester, saved: {'token': own});
      await tester.pumpAndSettle();
      ledger.dropOnce('GET /me');

      await expectLater(session.switchTo('test-1'), throwsA(isA<ApiException>()));
      await tester.pumpAndSettle();

      expect(api.token, own);
      expect(session.me?.id, 'me-1');
      expect(session.canReturnToAdmin, isFalse);
      expect(await keptToken(), own);
      expect((await SharedPreferences.getInstance()).getString('adminToken'), isNull);
    });

    testWidgets('8. a way back the server no longer knows is let go of, and says so',
        (tester) async {
      // Signed out on another phone while this one was somebody else: the
      // parked token opens nothing, and «Tilbake til …» was a door that is
      // always refused.
      final own = await actingAsTheTestAccount(tester);
      final acting = api.token;
      ledger.sessions.remove(own);

      await tester.tap(find.text('Tilbake til Ola N. ↩'));
      await tester.pumpAndSettle();

      expect(find.byType(SwaplyToast), findsOneWidget);
      expect(api.token, acting);
      expect(session.actingAs, isTrue);
      expect(session.canReturnToAdmin, isFalse);
      expect(find.text('Logg ut ↩'), findsOneWidget);
      expect((await SharedPreferences.getInstance()).getString('adminToken'), isNull);
    });
  });
}
