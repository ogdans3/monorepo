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
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/design/tokens.dart';
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

import 'export_fixtures.dart' as fx;
import 'fake_photos.dart';
import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// The test binding draws every glyph as a box unless real fonts are loaded, and
/// a picture of boxes is no use for comparing a design. The SDK ships the fonts
/// the app uses; find them next to the tester binary rather than by an absolute
/// path, so this works on any machine. Symbols — ★ ♥ ⇄ → ✓ — come from the
/// system on a phone; here DejaVu stands in, when the machine has it.
Future<void> _loadFonts() async {
  final engine = File(Platform.resolvedExecutable).parent; // …/artifacts/engine/<host>
  final fonts = Directory('${engine.parent.parent.path}/material_fonts');

  Future<void> load(String family, List<String> files) async {
    final loader = FontLoader(family);
    var any = false;
    for (final name in files) {
      final file = File(name.startsWith('/') ? name : '${fonts.path}/$name');
      if (file.existsSync()) {
        any = true;
        loader.addFont(file.readAsBytes().then((b) => ByteData.view(Uint8List.fromList(b).buffer)));
      }
    }
    if (any) await loader.load();
  }

  await load('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Black.ttf']);
  await load('MaterialIcons', ['MaterialIcons-Regular.otf']);
  await load('Symbols', ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']);
}

/// The app's theme with the symbol font as a fallback, for the goldens only.
ThemeData _theme() {
  final t = swaplyTheme();
  return t.copyWith(
    textTheme: t.textTheme.apply(fontFamilyFallback: const ['Symbols']),
    primaryTextTheme: t.primaryTextTheme.apply(fontFamilyFallback: const ['Symbols']),
  );
}

/// The export's status bar: «9:41» and a battery, 46 tall, white on the
/// green screens. The app is told it is there, so its safe areas match.
class _Frame extends StatelessWidget {
  const _Frame({required this.light, required this.child});

  final bool light;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final ink = light ? Colors.white : SwaplyColors.ink;
    return Stack(
      children: [
        MediaQuery(
          data: mq.copyWith(
            padding: mq.padding.copyWith(top: 46),
            viewPadding: mq.viewPadding.copyWith(top: 46),
            // A picture cannot drift: the confetti holds still, as on a phone
            // that has asked for less motion.
            disableAnimations: true,
          ),
          child: child,
        ),
        Positioned(
          left: 26,
          top: 15,
          // Outside any Material, so the family has to be said.
          child: Text('9:41',
              style: TextStyle(
                  fontFamily: 'Roboto',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: ink,
                  decoration: TextDecoration.none)),
        ),
        Positioned(
          right: 26,
          top: 15,
          child: Container(
            width: 29,
            height: 17,
            padding: const EdgeInsets.all(1.5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: ink.withValues(alpha: light ? 0.5 : 0.35)),
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: 16,
                height: 12,
                decoration:
                    BoxDecoration(color: ink, borderRadius: BorderRadius.circular(2)),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A phone, at the size the export draws one.
Future<void> shoot(WidgetTester tester, String name, Widget screen,
    {bool signedIn = true, bool light = false, Future<void> Function(WidgetTester)? act}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  // The photographs: decoded for real, outside the test's fake clock, and
  // left in the image cache for the screen to find. The hook is put back at
  // once — the binding checks it is unset when the test body ends.
  debugNetworkImageHttpClientProvider = PhotoClient.new;
  await tester.pumpWidget(const MaterialApp(home: SizedBox()));
  await tester.runAsync(() async {
    final context = tester.element(find.byType(SizedBox));
    for (final file in fx.photoFiles) {
      await precacheImage(NetworkImage('${fx.photos}$file'), context);
    }
  });
  debugNetworkImageHttpClientProvider = null;

  if (signedIn) await session.login('ola@epost.no', 'passord');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: _theme(),
        builder: (context, child) => _Frame(light: light, child: child!),
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

/// A photograph of a drill, as the picker would hand it over.
Future<PickedPhoto?> _pick() async =>
    PickedPhoto(File('test/photos/drill.jpg').readAsBytesSync(), 'drill.jpg');

void main() {
  setUp(() async {
    await _loadFonts();
    SharedPreferences.setMockInitialValues({});
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
  testWidgets('09a-motbytte',
      (t) => shoot(t, '09a-motbytte', CounterOfferScreen(trade: _trade())));
  // Step one of two, as a device that has not made a profile yet.
  testWidgets('10b-legg-ut', (t) => shoot(t, '10b-legg-ut', PostItemScreen(pickImage: _pick),
      signedIn: false, act: (t) async {
        await t.tap(find.text('Legg til bilder'));
        await t.pumpAndSettle();
        await t.tap(find.text('Legg til bilder'));
        await t.pumpAndSettle();
        final fields = find.byType(TextField);
        await t.enterText(fields.at(0), 'Bosch drill 18V');
        await t.enterText(fields.at(2), '600');
        await t.enterText(fields.at(3), 'Elektroverktøy');
        await t.enterText(fields.at(4), '7030');
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
