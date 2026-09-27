// Every screen, rendered to a picture.
//
// Not a test that asserts anything: a way to *look* at the app without a phone.
// `flutter test --update-goldens test/goldens_test.dart` writes one PNG per
// screen into `test/goldens/`, at the size the export draws — 390×844, with the
// export's status bar and the export's people, things and photographs — so a
// golden can be laid straight over the frame it was drawn from.
//
// Run as an ordinary test it compares against the committed pictures, which
// makes it a tripwire: a change that moves something on a screen shows up as a
// diff rather than as a surprise on somebody's phone.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';

import 'export_fixtures.dart' as fx;
import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A phone, at the size the export draws one.
Future<void> shoot(WidgetTester tester, String name, Widget screen,
    {bool signedIn = true, bool light = false, Future<void> Function(WidgetTester)? act}) async {
  holdPhone(tester);
  await precachePhotos(tester);

  if (signedIn) await session.login('ola@epost.no', 'passord');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: phoneTheme(),
        builder: (context, child) => PhoneFrame(light: light, child: child!),
        home: screen,
      ),
    ),
  );
  await tester.pumpAndSettle();
  if (act != null) {
    await act(tester);
    await tester.pumpAndSettle();
  }

  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

/// The trade the fake server serves, as the screens that take one expect it.
Trade _trade() => Trade.fromJson(fx.exportTrade1());

/// The export's two photographs on 10b, the bike and then the drill, as the
/// picker would hand them over: a device with no profile keeps them on the
/// phone, so the strip draws the bytes picked and not what an upload returns.
var _picked = 0;
Future<PickedPhoto?> _pick() async {
  final file = ['bike-white.jpg', 'drill.jpg'][_picked++ % 2];
  return PickedPhoto(File('test/photos/$file').readAsBytesSync(), file);
}

/// Pictures drawn from memory are decoded for real, which the test's fake
/// clock never gets round to: let every one on screen finish, outside it.
Future<void> _decodeImages(WidgetTester tester) => tester.runAsync(() async {
      for (final element in find.byType(Image).evaluate()) {
        await precacheImage((element.widget as Image).image, element);
      }
    });

void main() {
  setUp(() async {
    // A Thursday afternoon, so «i går» and «tirsdag» stay what they were drawn.
    now = () => DateTime(2026, 9, 10, 14, 30);
    addTearDown(() => now = DateTime.now);
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    _picked = 0;
    server = FakeServer(export: true);
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('01-splash',
      (t) => shoot(t, '01-splash', const SplashScreen(), signedIn: false, light: true));
  testWidgets('02-interesser', (t) => shoot(t, '02-interesser', const InterestsScreen()));
  testWidgets('04-gjenstand',
      (t) => shoot(t, '04-gjenstand', const ItemDetailScreen(itemId: 'item-console')));
  testWidgets('05-oppdag', (t) => shoot(t, '05-oppdag', const DiscoverScreen(), act: (t) async {
        await t.enterText(find.byType(TextField).first, 'sykkel');
        await t.testTextInput.receiveAction(TextInputAction.search);
      }));
  testWidgets('05b-avansert-sok',
      (t) => shoot(t, '05b-avansert-sok',
          const AdvancedSearchScreen(
              initial: SearchFilters(
                  category: 'sykling', subcategory: 'Sykler', minValue: 500, condition: 'new'),
              query: 'sykkel')));
  testWidgets('06a-match',
      (t) => shoot(t, '06a-match', const MatchScreen(tradeId: 'trade-1'), light: true));
  testWidgets('06b-byttedetalj',
      (t) => shoot(t, '06b-byttedetalj', const TradeDetailScreen(tradeId: 'trade-1')));
  testWidgets('06c-avtale',
      (t) => shoot(t, '06c-avtale', AgreementScreen(trade: _trade()),
          act: (t) => t.tap(find.text('Jeg har lest og godtar vilkårene'))));
  testWidgets('06g-samtale', (t) => shoot(t, '06g-samtale', const ThreadScreen(threadId: 'thread-1')));
  testWidgets('06h-vurdering',
      (t) => shoot(t, '06h-vurdering', ReviewScreen(trade: _trade()),
          act: (t) => t.tap(find.text('★').at(3))));
  // Not a screen the export draws: the toast, on the screen the complaint
  // about it came from. It lies on top of every screen in the app, so this is
  // the one picture of it there is.
  testWidgets('06h-vurdering-avvist',
      (t) => shoot(t, '06h-vurdering-avvist', ReviewScreen(trade: _trade()), act: (t) async {
            server.overrides['POST /trades/trade-1/reviews'] = 409;
            await t.tap(find.text('★').at(3));
            await t.pump();
            await t.tap(find.text('Send vurdering'));
          }));
  testWidgets('09a-motbytte',
      (t) => shoot(t, '09a-motbytte', CounterOfferScreen(trade: _trade())));
  // 10a is a sheet and not a screen: it comes up over the collage the fifth
  // heart was pressed on, so that is what is under it — 05 as its golden has
  // it. It says five where the export says ten, because five is when it
  // comes; see app/README.md.
  testWidgets('10a-prompt', (t) => shoot(t, '10a-prompt', const DiscoverScreen(), act: (t) async {
        await t.enterText(find.byType(TextField).first, 'sykkel');
        await t.testTextInput.receiveAction(TextInputAction.search);
        await t.pumpAndSettle();
        t.testTextInput.hide();
        FocusManager.instance.primaryFocus?.unfocus();
        // Not awaited: the sheet's future is its closing.
        showListingPrompt(t.element(find.byType(DiscoverScreen)), 5);
      }));
  // Step one of two, as a device that has not made a profile yet.
  testWidgets('10b-legg-ut', (t) => shoot(t, '10b-legg-ut', PostItemScreen(pickImage: _pick),
      signedIn: false, act: (t) async {
        await t.tap(find.text('Legg til bilder'));
        await t.pumpAndSettle();
        await t.tap(find.text('Legg til bilder'));
        await t.pumpAndSettle();
        await _decodeImages(t);
        final fields = find.byType(TextField);
        await t.enterText(fields.at(0), 'Bosch drill 18V');
        await t.enterText(fields.at(2), '600');
        await t.enterText(fields.at(3), 'Elektroverktøy');
        await t.enterText(fields.at(4), '7030');
        // The town is asked for once the digits have held still for a moment,
        // and «Trondheim» is drawn beside them when it comes.
        await t.pump(const Duration(seconds: 1));
        // Typing scrolls the form to the caret, on a frame after the text
        // lands; let that finish, then put the form back at the top.
        await t.pumpAndSettle();
        t.testTextInput.hide();
        FocusManager.instance.primaryFocus?.unfocus();
        await t.pumpAndSettle();
        for (final e in find.byType(Scrollable).evaluate()) {
          final position = ((e as StatefulElement).state as ScrollableState).position;
          if (position.axis == Axis.vertical && position.pixels > 0) position.jumpTo(0);
        }
      }));
  testWidgets('10c-lag-profil',
      (t) => shoot(t, '10c-lag-profil', const CreateProfileScreen(continuingToListing: true),
          signedIn: false));
  testWidgets('11-mine-handler', (t) => shoot(t, '11-mine-handler', const TradesScreen()));
  testWidgets('11a-chats', (t) => shoot(t, '11a-chats', const ChatsScreen()));
  testWidgets('12-likt', (t) => shoot(t, '12-likt', const LikedScreen()));
  testWidgets('12a-varsler', (t) => shoot(t, '12a-varsler', const NotificationsScreen()));
  testWidgets('13-profil', (t) => shoot(t, '13-profil', const ProfileScreen()));
  testWidgets('13b-annen-profil',
      (t) => shoot(t, '13b-annen-profil', const OtherProfileScreen(userId: 'kari-1')));
  testWidgets('16b-innstillinger', (t) => shoot(t, '16b-innstillinger', const SettingsScreen()));
  testWidgets('16c-logg-inn', (t) => shoot(t, '16c-logg-inn', const LoginScreen(), signedIn: false));
  testWidgets('invitasjon',
      (t) => shoot(t, 'invitasjon', const InviteScreen(token: FakeServer.shareToken),
          signedIn: false));
}
