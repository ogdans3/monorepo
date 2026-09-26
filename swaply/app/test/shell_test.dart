// The bar is fixed.
//
// Every tab used to be a route with its own Scaffold drawing its own bar, so
// changing tabs and opening a thing both slid a whole new page in, bar and
// all, and the bar travelled with it. Now the bar is drawn once, outside the
// five tab navigators, and this file holds it to that frame by frame: the same
// element, in the same place, while a tab changes and while a page slides in
// above it. A screen the export draws without the bar goes over it instead.
//
// Mounted the way `main.dart` mounts the app — `SwaplyApp`, with the gate, the
// admin floor and the shell host in the builder — and with animations on,
// because the point is what happens in the middle of one.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A phone, the size the export draws one.
const _phone = Size(390, 844);

Future<void> launch(WidgetTester tester) async {
  tester.view.physicalSize = _phone;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
  );
  await tester.pumpAndSettle();
}

final bar = find.byType(SwaplyNavBar);

/// Taps a tab on the bar. The labels are also words elsewhere — «Legg ut» is a
/// button on 10b — so the tap is aimed inside the bar.
Future<void> tapTab(WidgetTester tester, String label) =>
    tester.tap(find.descendant(of: bar, matching: find.text(label)));

/// How many times the app has asked for [request].
int asked(String request) => server.requests.where((r) => r == request).length;

/// Pumps [frames] frames of [step], checking at every one that the bar is the
/// same element in the same place, and that it is the only one.
Future<void> holdsStill(WidgetTester tester, Element element, Rect rect,
    {int frames = 40,
    Duration step = const Duration(milliseconds: 10),
    void Function()? each}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(step);
    expect(bar, findsOneWidget, reason: 'frame $i');
    expect(tester.element(bar), same(element), reason: 'frame $i');
    expect(tester.getRect(bar), rect, reason: 'frame $i');
    each?.call();
  }
}

/// The bar whether or not a page covers it.
final anyBar = find.byType(SwaplyNavBar, skipOffstage: false);

/// [holdsStill] for a page that covers the bar: out of sight by the end, so
/// looked for offstage too, and not faded either — a slide is not the only way
/// a page's outgoing transition moves what is on it.
Future<void> standsStill(WidgetTester tester, Element element, Rect rect,
    {int frames = 60, void Function()? each}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 10));
    expect(anyBar, findsOneWidget, reason: 'frame $i');
    expect(tester.element(anyBar), same(element), reason: 'frame $i');
    expect(tester.getRect(anyBar), rect, reason: 'frame $i');
    final faded = find
        .ancestor(of: anyBar, matching: find.byType(FadeTransition))
        .evaluate()
        .map((e) => (e.widget as FadeTransition).opacity.value)
        .where((v) => v < 1);
    expect(faded, isEmpty, reason: 'frame $i');
    each?.call();
  }
}

/// The route [finder]'s screen is on, and the navigator that holds it.
ModalRoute<Object?> routeOf(WidgetTester tester, Finder finder) =>
    ModalRoute.of(tester.element(finder))!;
NavigatorState navigatorOf(WidgetTester tester, Finder finder) =>
    Navigator.of(tester.element(finder));
NavigatorState rootOf(WidgetTester tester, Finder finder) =>
    Navigator.of(tester.element(finder), rootNavigator: true);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('the bar is drawn once and does not move', () {
    testWidgets('1. changing tabs changes what is above the bar, and nothing slides',
        (tester) async {
      await launch(tester);
      expect(bar, findsOneWidget);
      final element = tester.element(bar);
      final rect = tester.getRect(bar);
      // A tab is not built until it is opened.
      expect(find.byType(TradesScreen, skipOffstage: false), findsNothing);

      await tapTab(tester, 'Bytter');
      var midway = false;
      await holdsStill(tester, element, rect, each: () {
        final trades = find.byType(TradesScreen);
        if (trades.evaluate().isEmpty) return;
        // The page comes in where it will stay: a fade, not a slide.
        expect(tester.getTopLeft(trades), Offset.zero);
        final fading = find
            .ancestor(of: trades, matching: find.byType(FadeTransition))
            .evaluate()
            .map((e) => (e.widget as FadeTransition).opacity.value)
            .any((v) => v > 0 && v < 1);
        // Halfway, both tabs are on screen, one fading in over the other.
        if (fading && find.byType(DiscoverScreen).evaluate().isNotEmpty) midway = true;
      });

      expect(midway, isTrue, reason: 'no frame caught the tabs in the middle of the change');
      await tester.pumpAndSettle();
      expect(find.byType(TradesScreen), findsOneWidget);
      // The tab that left is kept, out of sight.
      expect(find.byType(DiscoverScreen), findsNothing);
      expect(find.byType(DiscoverScreen, skipOffstage: false), findsOneWidget);
    });

    testWidgets('…and it is a cut, not a fade, for somebody who asked for less motion',
        (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      await launch(tester);

      await tapTab(tester, 'Bytter');
      await tester.pump();

      expect(find.byType(TradesScreen), findsOneWidget);
      expect(find.byType(DiscoverScreen), findsNothing);
    });

    testWidgets('2. a screen opened inside a tab slides in above a bar that stays put',
        (tester) async {
      await launch(tester);
      final element = tester.element(bar);
      final rect = tester.getRect(bar);

      await tester.tap(find.text('Bosch drill 18V'));
      var midway = false;
      await holdsStill(tester, element, rect, frames: 60, each: () {
        final detail = find.byType(ItemDetailScreen);
        if (detail.evaluate().isEmpty) return;
        final animation = routeOf(tester, detail).animation!.value;
        if (animation > 0 && animation < 1) midway = true;
        // Above the bar, never across it.
        expect(tester.getRect(detail).bottom, lessThanOrEqualTo(rect.top + 0.01));
      });

      expect(midway, isTrue, reason: 'no frame caught the page in the middle of its slide');
      await tester.pumpAndSettle();
      final detail = find.byType(ItemDetailScreen);
      expect(detail, findsOneWidget);
      // Inside the tab: its own navigator, not the one the whole app is in.
      expect(navigatorOf(tester, detail), isNot(same(rootOf(tester, detail))));
    });

    testWidgets('3. a screen the export draws without the bar covers it', (tester) async {
      await launch(tester);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();

      final settings = find.byType(SettingsScreen);
      expect(settings, findsOneWidget);
      expect(navigatorOf(tester, settings), same(rootOf(tester, settings)));
      expect(tester.getRect(settings), Offset.zero & _phone);
      // Still there underneath, and out of sight.
      expect(bar, findsNothing);
      expect(find.byType(SwaplyNavBar, skipOffstage: false), findsOneWidget);
    });

    testWidgets('…and slides in over it, with the bar standing still underneath, and back out',
        (tester) async {
      // The shell is on the gate's route, so a page pushed over it on the root
      // navigator would carry that route off to the side — iOS's parallax,
      // Android's slide and fade — and the bar with it.
      await launch(tester);
      await tapTab(tester, 'Chats');
      await tester.pumpAndSettle();
      final element = tester.element(anyBar);
      final rect = tester.getRect(anyBar);

      await tester.tap(find.text('Kari'));
      var midway = false;
      await standsStill(tester, element, rect, each: () {
        final thread = find.byType(ThreadScreen);
        if (thread.evaluate().isEmpty) return;
        final animation = routeOf(tester, thread).animation!.value;
        if (animation > 0 && animation < 1) midway = true;
      });
      expect(midway, isTrue, reason: 'no frame caught the chat in the middle of its slide');
      await tester.pumpAndSettle();
      final thread = find.byType(ThreadScreen);
      expect(navigatorOf(tester, thread), same(rootOf(tester, thread)));

      await tester.tap(find.byIcon(Icons.chevron_left));
      midway = false;
      await standsStill(tester, element, rect, each: () {
        final thread = find.byType(ThreadScreen, skipOffstage: false);
        if (thread.evaluate().isEmpty) return;
        final animation = routeOf(tester, thread).animation!.value;
        if (animation > 0 && animation < 1) midway = true;
      });
      expect(midway, isTrue, reason: 'no frame caught the chat in the middle of going');
      await tester.pumpAndSettle();
      expect(bar, findsOneWidget);
      expect(tester.getRect(bar), rect);
    }, variant: const TargetPlatformVariant({TargetPlatform.android, TargetPlatform.iOS}));

    testWidgets('4. and so does a sheet, down to the foot of the screen', (tester) async {
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      final bytter = tester.getCenter(find.descendant(of: bar, matching: find.text('Bytter')));

      await tester.tap(find.byIcon(Icons.ios_share));
      await tester.pumpAndSettle();
      final sheet = find.byType(BottomSheet);
      expect(find.text('Del Bosch drill 18V'), findsOneWidget);
      // Inside the tab it would stop at the bar, and leave it working under
      // the dimming.
      expect(navigatorOf(tester, sheet), same(rootOf(tester, sheet)));
      expect(tester.getRect(sheet).bottom, _phone.height);

      await tester.tapAt(bytter);
      await tester.pumpAndSettle();
      expect(find.byType(TradesScreen, skipOffstage: false), findsNothing);
    });

    testWidgets('5. «+ Legg ut» on 13 sits where it did, 44 above the bar', (tester) async {
      // On its own first, the way the goldens draw it, with its own bar.
      tester.view.physicalSize = _phone;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await session.login('ola@epost.no', 'passord');
      await tester.pumpWidget(MultiProvider(
        providers: [
          Provider<SwaplyApi>.value(value: api),
          ChangeNotifierProvider<Session>.value(value: session),
        ],
        child: MaterialApp(theme: swaplyTheme(), home: const ProfileScreen()),
      ));
      await tester.pumpAndSettle();
      final alone = tester.getRect(find.text('+ Legg ut'));
      final aloneBar = tester.getRect(bar);

      await tester.pumpWidget(const SizedBox());
      await launch(tester);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();

      expect(tester.getRect(bar), aloneBar);
      expect(tester.getRect(find.text('+ Legg ut')), alone);
      final pill = find.ancestor(of: find.text('+ Legg ut'), matching: find.byType(Container));
      expect(aloneBar.top - tester.getRect(pill.first).bottom, 44);
    });

    testWidgets('6. 06c and 09a are drawn with the bar, so they open in the tab, above it',
        (tester) async {
      await launch(tester);
      await tapTab(tester, 'Bytter');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Direkte bytte'));
      await tester.pumpAndSettle();
      final element = tester.element(bar);
      final rect = tester.getRect(bar);

      await tester.tap(find.text('Godta byttet'));
      await holdsStill(tester, element, rect, frames: 60);
      await tester.pumpAndSettle();
      final agreement = find.byType(AgreementScreen);
      expect(navigatorOf(tester, agreement), isNot(same(rootOf(tester, agreement))));
      expect(tester.getRect(agreement).bottom, lessThanOrEqualTo(rect.top));
      await tester.tap(find.text('Avbryt'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Foreslå motbytte'));
      await tester.pumpAndSettle();
      final counter = find.byType(CounterOfferScreen);
      expect(navigatorOf(tester, counter), isNot(same(rootOf(tester, counter))));
      expect(tester.getRect(bar), rect);
    });

    testWidgets('7. 10b correcting a listing is drawn without it, and keeps clear of the foot',
        (tester) async {
      // Nothing under it takes the home indicator's strip once the bar is
      // covered, so the page has to.
      tester.view.padding = const FakeViewPadding(bottom: 34);
      server.overrides['GET /items/item-drill'] = {
        ...FakeServer.drill,
        'owner': {'id': FakeServer.me['id'], 'displayName': 'Ola N.'},
      };
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Rediger annonsen'));
      await tester.pumpAndSettle();

      final form = find.byType(PostItemScreen);
      expect(navigatorOf(tester, form), same(rootOf(tester, form)));
      expect(bar, findsNothing);
      final save = tester.getRect(find.widgetWithText(PrimaryButton, 'Lagre endringene'));
      expect(save.bottom, lessThanOrEqualTo(_phone.height - 34 - 30));
    });
  });

  group('a tab keeps its place', () {
    testWidgets('1. tapping the tab you are in goes back to its first screen', (tester) async {
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      expect(find.byType(ItemDetailScreen), findsOneWidget);

      await tapTab(tester, 'Oppdag');
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen, skipOffstage: false), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('2. going to another tab and back finds it as it was left', (tester) async {
      await launch(tester);
      await tester.enterText(find.byType(TextField).first, 'sykkel');
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();

      await tapTab(tester, 'Chats');
      await tester.pumpAndSettle();
      expect(find.byType(ChatsScreen), findsOneWidget);
      await tapTab(tester, 'Oppdag');
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.chevron_left));
      await tester.pumpAndSettle();
      // And under it, the search that was typed before.
      expect(find.widgetWithText(TextField, 'sykkel'), findsOneWidget);
    });

    testWidgets('3. back goes back inside the tab on screen, and only that one',
        (tester) async {
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tapTab(tester, 'Bytter');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Direkte bytte'));
      await tester.pumpAndSettle();
      expect(find.byType(TradeDetailScreen), findsOneWidget);

      // Android's back, and the browser's.
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      expect(find.byType(TradeDetailScreen, skipOffstage: false), findsNothing);
      expect(find.byType(TradesScreen), findsOneWidget);
      // Oppdag was not on screen, so its page is still open.
      expect(find.byType(ItemDetailScreen, skipOffstage: false), findsOneWidget);
    });

    testWidgets('4. the first screen of a tab asks again each time it comes back',
        (tester) async {
      // Every tap on the bar used to build the screen from nothing, which is
      // what kept the lists fresh. Kept tabs have to ask.
      await launch(tester);
      expect(asked('GET /discover'), 1);

      await tapTab(tester, 'Bytter');
      await tester.pumpAndSettle();
      expect(asked('GET /trades'), 1);
      await tapTab(tester, 'Chats');
      await tester.pumpAndSettle();
      expect(asked('GET /threads'), 1);

      await tapTab(tester, 'Bytter');
      await tester.pumpAndSettle();
      expect(asked('GET /trades'), 2);
      await tapTab(tester, 'Chats');
      await tester.pumpAndSettle();
      expect(asked('GET /threads'), 2);

      final before = asked('GET /me');
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();
      await tapTab(tester, 'Oppdag');
      await tester.pump();
      // Behind the grid, not instead of it.
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.pumpAndSettle();
      expect(asked('GET /discover'), 2);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();
      // 13 is the session's, so asking again is asking who you are: once on
      // the way in, once on the way back.
      expect(asked('GET /me'), greaterThanOrEqualTo(before + 2));
    });
  });

  group('where a finished flow goes', () {
    testWidgets('1. «+ Legg ut» opens the tab, and a listing that went out empties it',
        (tester) async {
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await launch(tester);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();

      // The tab, not a second form stacked on 13.
      await tester.tap(find.text('+ Legg ut'));
      await tester.pumpAndSettle();
      expect(find.byType(PostItemScreen), findsOneWidget);
      expect(find.byType(ProfileScreen), findsNothing);

      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
      expect(find.byType(ProfileScreen), findsOneWidget);

      await tapTab(tester, 'Legg ut');
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextField, 'Fiskestang'), findsNothing);
      expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, isEmpty);
    });

    /// Starts a listing and, while the server has it, taps [elsewhere] on the
    /// bar. The bar is live the whole time, so that is somewhere to be.
    Future<void> postAndLeaveFor(WidgetTester tester, String elsewhere) async {
      final created = Completer<Object?>();
      server.overrides['POST /items'] = (_) => created.future;
      await tapTab(tester, 'Legg ut');
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pump();

      await tapTab(tester, elsewhere);
      await tester.pumpAndSettle();
      created.complete({...FakeServer.drill, 'title': 'Fiskestang'});
      await tester.pumpAndSettle();
    }

    Future<void> formIsEmpty(WidgetTester tester) async {
      await tapTab(tester, 'Legg ut');
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, isEmpty);
    }

    testWidgets('…and it is the form that starts over, not the tab you went to meanwhile',
        (tester) async {
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();

      await postAndLeaveFor(tester, 'Oppdag');
      final discovered = asked('GET /discover');

      expect(find.byType(ProfileScreen), findsOneWidget);
      // Oppdag as it was left, with the page that was open on it, and not
      // built again from nothing.
      expect(find.byType(ItemDetailScreen, skipOffstage: false), findsOneWidget);
      expect(asked('GET /discover'), discovered);
      await formIsEmpty(tester);
    });

    testWidgets('…including when you went to where it lands', (tester) async {
      await launch(tester);
      await postAndLeaveFor(tester, 'Profil');

      expect(find.byType(ProfileScreen), findsOneWidget);
      await formIsEmpty(tester);
    });

    testWidgets('2. the match covers the bar, and «Se byttet» opens the trade in the tab under it',
        (tester) async {
      await launch(tester);
      final heart = find.descendant(
          of: find.byKey(const ValueKey('item-console')),
          matching: find.byIcon(Icons.favorite_border));
      await tester.tap(heart);
      // The match screen's confetti never settles; step through it instead.
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 20));
      }
      final match = find.byType(MatchScreen);
      expect(match, findsOneWidget);
      expect(navigatorOf(tester, match), same(rootOf(tester, match)));
      expect(bar, findsNothing);

      await tester.tap(find.text('Se byttet'));
      await tester.pumpAndSettle();

      expect(find.byType(MatchScreen, skipOffstage: false), findsNothing);
      final trade = find.byType(TradeDetailScreen);
      expect(trade, findsOneWidget);
      expect(navigatorOf(tester, trade), isNot(same(rootOf(tester, trade))));
      expect(bar, findsOneWidget);
    });

    testWidgets('3. «Tilbake til Bytter» clears the way there and lands on the list',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'cancelled',
        'closeReason': 'declined',
      };
      await launch(tester);
      await tester.tap(find.descendant(
          of: find.byKey(const ValueKey('item-console')),
          matching: find.byIcon(Icons.favorite_border)));
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 20));
      }
      await tester.tap(find.text('Se byttet'));
      await tester.pumpAndSettle();
      expect(find.byType(TradeDetailScreen), findsOneWidget);

      await tester.tap(find.text('Tilbake til Bytter'));
      await tester.pumpAndSettle();

      expect(find.byType(TradesScreen), findsOneWidget);
      // The trade was opened in Oppdag, and the flow that opened it is over.
      expect(find.byType(TradeDetailScreen, skipOffstage: false), findsNothing);
      await tapTab(tester, 'Oppdag');
      await tester.pumpAndSettle();
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });

    testWidgets('…and the list asks again, even when Bytter was the tab on screen',
        (tester) async {
      // Opened from a notification, so it is not the list that is waiting to
      // hear how it went. Before the shell, landing there built the list
      // from nothing.
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'state': 'cancelled',
        'closeReason': 'declined',
      };
      await launch(tester);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se alle varsler'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Noen godtok byttet'));
      await tester.pumpAndSettle();
      expect(find.byType(TradeDetailScreen), findsOneWidget);
      final before = asked('GET /trades');

      await tester.tap(find.text('Tilbake til Bytter'));
      await tester.pumpAndSettle();

      expect(find.byType(TradesScreen), findsOneWidget);
      expect(asked('GET /trades'), before + 1);
    });

    testWidgets('…and so does a review, from the screens that cover the bar', (tester) async {
      server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': 'completed'};
      await launch(tester);
      await tapTab(tester, 'Bytter');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Direkte bytte'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Vurder Kari'));
      await tester.pumpAndSettle();
      expect(bar, findsNothing);
      await tester.tap(find.text('★').last);
      await tester.pump();
      await tester.tap(find.text('Send vurdering'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hopp over'));
      await tester.pumpAndSettle();

      expect(find.byType(TradesScreen), findsOneWidget);
      expect(find.byType(TradeDetailScreen, skipOffstage: false), findsNothing);
      expect(bar, findsOneWidget);
    });

    testWidgets('4. a notification opens its screen where it lives, with the bar under it',
        (tester) async {
      await launch(tester);
      await tapTab(tester, 'Profil');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Se alle varsler'));
      await tester.pumpAndSettle();
      expect(bar, findsNothing);

      // A trade lives under Bytter.
      await tester.tap(find.text('Noen godtok byttet'));
      await tester.pumpAndSettle();

      final trade = find.byType(TradeDetailScreen);
      expect(trade, findsOneWidget);
      expect(navigatorOf(tester, trade), isNot(same(rootOf(tester, trade))));
      expect(find.byType(SettingsScreen, skipOffstage: false), findsNothing);
      expect(bar, findsOneWidget);
      // And back from it is the list it belongs to.
      await tester.tap(find.text('‹'));
      await tester.pumpAndSettle();
      expect(find.byType(TradesScreen), findsOneWidget);
    });

    testWidgets('5. a shared link opens the listing inside Oppdag', (tester) async {
      session.pendingInvite = FakeServer.shareToken;
      await launch(tester);

      final detail = find.byType(ItemDetailScreen);
      expect(detail, findsOneWidget);
      expect(navigatorOf(tester, detail), isNot(same(rootOf(tester, detail))));
      expect(bar, findsOneWidget);
      await tapTab(tester, 'Oppdag');
      await tester.pumpAndSettle();
      expect(find.byType(DiscoverScreen), findsOneWidget);
    });
  });

  group('a different person gets a different app', () {
    testWidgets('1. becoming somebody else leaves nothing of the last one open',
        (tester) async {
      await launch(tester);
      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      expect(find.byType(ItemDetailScreen), findsOneWidget);

      // With interests, or the gate would rightly stop at 02 first.
      final somebody = {
        ...FakeServer.actingAsTest,
        'interests': ['verktoy', 'gaming', 'sykling'],
      };
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': somebody};
      server.overrides['GET /me'] = somebody;
      await session.login('testkonto-abc@swaply.test', 'passord');
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen, skipOffstage: false), findsNothing);
      expect(find.byType(DiscoverScreen), findsOneWidget);
      // The admin floor is under the shell as it is under everything else.
      expect(find.text('Du er Testbruker Én — ikke deg selv'), findsOneWidget);
      expect(bar, findsOneWidget);
    });

    testWidgets('2. and the floor\'s way out goes through the gate', (tester) async {
      // It is drawn under the navigator rather than inside it, and asking the
      // tree for a navigator from there threw.
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.actingAsTest};
      server.overrides['GET /me'] = FakeServer.actingAsTest;
      await launch(tester);

      await tester.tap(find.text('Logg ut ↩'));
      await tester.pumpAndSettle();

      // Through the gate, which no longer stops at a sign-in: whoever holds
      // the phone next is a new stranger, and 02 is the first thing they see.
      expect(server.requests, contains('POST /auth/logout'));
      expect(session.anonymous, isTrue);
      expect(session.actingAs, isFalse);
      expect(find.byType(LoginScreen), findsNothing);
      expect(find.byType(InterestsScreen), findsOneWidget);
      expect(find.byType(SwaplyNavBar, skipOffstage: false), findsNothing);
    });
  });
}
