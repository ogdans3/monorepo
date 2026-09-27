// No answer is something the app can say.
//
// Every screen catches `ApiException` and nothing else, and a dropped
// connection used to throw something else past all of them: a heart on Oppdag
// whose request never reached the server stayed on as wished, and nothing was
// said. The api now says every way of not getting an answer — no network, no
// server, a request that never comes back, a page that is not Swaply's — as
// one `ApiException`, `no_contact`, in the words the splash already uses.
// Each is held here, and so are the two places that treat it differently from
// a refusal: the heart, which turns back, and the saved token, which is kept.
//
// And the pages that ask for what they show. Once a dropped connection was an
// `ApiException`, it reached error states written for refusals: a list asked
// for again behind itself was replaced by «Fikk ikke kontakt» and stayed that
// way after the connection came back, and a trade, a conversation, a listing
// or a profile asked for again was replaced by «Fant ikke …», which says the
// thing is gone. What is on screen stays, and what could not load at all
// asks again from «Prøv igjen».
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// What [call] threw, once the test's clock has let it finish; null while it
/// has not.
class Outcome {
  Outcome(Future<Object?> call) {
    call.then<void>((_) {
      done = true;
    }, onError: (Object e) {
      done = true;
      error = e;
    });
  }

  bool done = false;
  Object? error;

  ApiException get refusal => error! as ApiException;
}

/// An api in front of a proxy that answers every request with [status] and
/// [page], which is not JSON.
SwaplyApi behindProxy(int status, String page) => SwaplyApi(
      baseUrl: 'http://test',
      client: MockClient((_) async =>
          http.Response(page, status, headers: {'content-type': 'text/html'})),
    );

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
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

/// The heart on [item]'s card, by what it says.
Finder heartOn(String item, {required bool liked}) => find.descendant(
    of: find.byKey(ValueKey(item)),
    matching: find.bySemanticsLabel(liked ? 'Du vil ha denne' : 'Jeg vil ha'));

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('every way of hearing nothing is one refusal', () {
    testWidgets('1. no network, or no server behind the address', (tester) async {
      server.overrides['GET /me'] = unreachable;
      final asked = Outcome(api.me());
      await tester.pump();

      expect(asked.refusal.isNoContact, isTrue);
      expect(asked.refusal.code, ApiException.noContactCode);
      expect(asked.refusal.statusCode, 0);
      expect(asked.refusal.message, noContact);
      // What a toast prints.
      expect('${asked.refusal}', noContact);
    });

    testWidgets('2. an answer that never comes, after the api\'s patience', (tester) async {
      // A host that drops packets refuses nothing, and a phone waits a minute
      // or two before it gives up on the connection.
      server.overrides['GET /me'] = (http.Request _) => Completer<Object?>().future;
      final asked = Outcome(api.me());

      await tester.pump(SwaplyApi.patience - const Duration(seconds: 1));
      expect(asked.done, isFalse);
      await tester.pump(const Duration(seconds: 1));
      expect(asked.refusal.isNoContact, isTrue);
    });

    testWidgets('…and a photograph is given longer, since it is the most to send',
        (tester) async {
      server.overrides['POST /media'] = (http.Request _) => Completer<Object?>().future;
      api.token = 'tok';
      final sent = Outcome(api.uploadImage([1, 2, 3], filename: 'a.jpg'));

      await tester.pump(SwaplyApi.patience);
      expect(sent.done, isFalse);
      await tester.pump(SwaplyApi.uploadPatience - SwaplyApi.patience);
      expect(sent.refusal.isNoContact, isTrue);
    });

    testWidgets('3. a page that is not Swaply\'s — a proxy\'s — whatever its status', (tester) async {
      for (final status in [502, 413, 200]) {
        final asked = Outcome(behindProxy(status, '<html><h1>$status</h1></html>').me());
        await tester.pump();

        expect(asked.refusal.isNoContact, isTrue, reason: '$status');
        expect(asked.refusal.message, noContact, reason: '$status');
        // Not the proxy's: 10b reads a 413 as a picture the server refused.
        expect(asked.refusal.statusCode, 0, reason: '$status');
      }
    });

    testWidgets('4. and a refusal is still the server\'s own, word for word', (tester) async {
      server.overrides['POST /items/item-console/like'] = Refusal.accountRequired;
      final asked = Outcome(api.like('item-console'));
      await tester.pump();

      expect(asked.refusal.isNoContact, isFalse);
      expect(asked.refusal.statusCode, 403);
      expect(asked.refusal.code, 'account_required');
      expect(asked.refusal.message, Refusal.accountRequired.message);
    });
  });

  group('where it is not the same as a refusal', () {
    testWidgets('1. a heart the server never heard turns back, and says why', (tester) async {
      await mount(tester, const DiscoverScreen());
      server.overrides['POST /items/item-console/like'] = unreachable;

      await tester.tap(heartOn('item-console', liked: false));
      await tester.pumpAndSettle();

      expect(heartOn('item-console', liked: false), findsOneWidget);
      expect(heartOn('item-console', liked: true), findsNothing);
      final toast = tester.widget<SwaplyToast>(find.byType(SwaplyToast));
      expect(toast.message, noContact);
      expect(toast.tone, ToastTone.error);
    });

    testWidgets('…and so does the one on 04', (tester) async {
      await mount(tester, const ItemDetailScreen(itemId: 'item-console'));
      server.overrides['POST /items/item-console/like'] =
          (http.Request _) => Completer<Object?>().future;

      await tester.tap(find.bySemanticsLabel('Jeg vil ha'));
      await tester.pump();
      // Turned on the tap, as always, while it is on its way.
      expect(find.bySemanticsLabel('Du vil ha denne'), findsOneWidget);

      await tester.pump(SwaplyApi.patience);
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Jeg vil ha'), findsOneWidget);
      expect(tester.widget<SwaplyToast>(find.byType(SwaplyToast)).message, noContact);
    });

    testWidgets('2. a saved token checked against a proxy\'s page is kept, not dropped',
        (tester) async {
      // A 404 from the server is a token nobody knows; a 404 page from
      // something in front of it says nothing about the token at all.
      SharedPreferences.setMockInitialValues({'token': 'tok'});
      api = behindProxy(404, '<html>Not Found</html>');
      session = Session(api);

      await session.restore();

      expect(session.stalled, isTrue);
      expect(session.signedIn, isFalse);
      expect(api.token, 'tok');
      expect((await SharedPreferences.getInstance()).getString('token'), 'tok');
    });
  });

  group('a page asked for again keeps what it has', () {
    /// A pull, and the frames until it is done with.
    Future<void> pullDown(WidgetTester tester) async {
      unawaited(tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator).first).show());
      await tester.pumpAndSettle();
    }

    String toast(WidgetTester tester) => tester.widget<SwaplyToast>(find.byType(SwaplyToast)).message;

    // Each list tab, with what the first asking gets and what the list shows.
    final lists = <({String name, Widget screen, String route, String shows})>[
      (name: 'Bytter', screen: const TradesScreen(), route: 'GET /trades', shows: 'Venter · 1'),
      (
        name: 'Chats',
        screen: const ChatsScreen(),
        route: 'GET /threads',
        shows: 'Jeg kan sende fiskestangen med PostNord i morgen.'
      ),
      (name: 'Likt', screen: const LikedScreen(), route: 'GET /me/liked-by', shows: 'Bosch drill 18V'),
      (
        name: 'Varsler',
        screen: const NotificationsScreen(),
        route: 'GET /notifications',
        shows: 'Kari likte Bosch drill 18V'
      ),
    ];

    for (final list in lists) {
      testWidgets('1. ${list.name}: a pull with no contact keeps the list, and says so',
          (tester) async {
        await mount(tester, list.screen);
        expect(find.text(list.shows), findsOneWidget);

        server.overrides[list.route] = unreachable;
        await pullDown(tester);

        expect(find.text(list.shows), findsOneWidget);
        expect(find.text('Fikk ikke kontakt'), findsNothing);
        expect(toast(tester), noContact);
      });

      testWidgets('2. ${list.name}: nothing to keep, it asks again from «Prøv igjen»',
          (tester) async {
        server.overrides[list.route] = unreachable;
        await mount(tester, list.screen);
        expect(find.text('Fikk ikke kontakt'), findsOneWidget);

        // Back in contact: the answer comes, and it is what is shown.
        server.overrides.remove(list.route);
        await tester.tap(find.text('Prøv igjen'));
        await tester.pumpAndSettle();

        expect(find.text(list.shows), findsOneWidget);
        expect(find.text('Fikk ikke kontakt'), findsNothing);
      });
    }

    testWidgets('3. 06b: a pull with no contact keeps the trade', (tester) async {
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
      expect(find.text('Bytte med Kari'), findsOneWidget);

      server.overrides['GET /trades/trade-1'] = unreachable;
      await pullDown(tester);

      expect(find.text('Bytte med Kari'), findsOneWidget);
      expect(find.text('Fant ikke byttet'), findsNothing);
      expect(toast(tester), noContact);
    });

    testWidgets('4. 06g: a message that went, and a reload that did not, keeps the conversation',
        (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      expect(find.text('Passer bra! Kl. 17?'), findsOneWidget);

      server.overrides['GET /threads/thread-1'] = unreachable;
      await tester.enterText(find.byType(TextField).last, 'Sees da!');
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('POST /threads/thread-1/messages'));
      expect(find.text('Passer bra! Kl. 17?'), findsOneWidget);
      expect(find.text('Fant ikke samtalen'), findsNothing);
      expect(toast(tester), noContact);
    });

    // A page that could not get its one thing at all: which it is, by cause.
    final pages = <({String name, Widget screen, String route, String missing, String shows})>[
      (
        name: '04',
        screen: const ItemDetailScreen(itemId: 'item-console'),
        route: 'GET /items/item-console',
        missing: 'Fant ikke gjenstanden',
        shows: 'Retro spillkonsoll'
      ),
      (
        name: '06b',
        screen: const TradeDetailScreen(tradeId: 'trade-1'),
        route: 'GET /trades/trade-1',
        missing: 'Fant ikke byttet',
        shows: 'Bytte med Kari'
      ),
      (
        name: '06g',
        screen: const ThreadScreen(threadId: 'thread-1'),
        route: 'GET /threads/thread-1',
        missing: 'Fant ikke samtalen',
        shows: 'Passer bra! Kl. 17?'
      ),
      (
        name: '13b',
        screen: const OtherProfileScreen(userId: 'kari-1'),
        route: 'GET /users/kari-1',
        missing: 'Fant ikke profilen',
        shows: 'Kari N.'
      ),
    ];

    for (final page in pages) {
      testWidgets('5. ${page.name}: no contact is not «${page.missing}», and asks again',
          (tester) async {
        server.overrides[page.route] = unreachable;
        await mount(tester, page.screen);

        expect(find.text('Fikk ikke kontakt'), findsOneWidget);
        expect(find.text(noContact), findsOneWidget);
        expect(find.text(page.missing), findsNothing);

        server.overrides.remove(page.route);
        await tester.tap(find.text('Prøv igjen'));
        await tester.pumpAndSettle();

        expect(find.text(page.shows), findsWidgets);
        expect(find.text('Fikk ikke kontakt'), findsNothing);
      });

      testWidgets('6. ${page.name}: a refusal is still «${page.missing}»', (tester) async {
        server.overrides[page.route] = 404;
        await mount(tester, page.screen);

        expect(find.text(page.missing), findsOneWidget);
        expect(find.text('Prøv igjen'), findsNothing);
      });
    }
  });
}
