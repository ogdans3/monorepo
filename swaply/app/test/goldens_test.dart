// Every screen, rendered to a picture.
//
// Not a test that asserts anything: a way to *look* at the app without a phone.
// `flutter test --update-goldens test/goldens_test.dart` writes one PNG per
// screen into `test/goldens/`, at the size the export draws — 390×844 — so the
// two can be put side by side.
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

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// The test binding draws every glyph as a box unless real fonts are loaded, and
/// a picture of boxes is no use for comparing a design. The SDK ships the fonts
/// the app uses; find them next to the tester binary rather than by an absolute
/// path, so this works on any machine.
Future<void> _loadFonts() async {
  final engine = File(Platform.resolvedExecutable).parent; // …/artifacts/engine/<host>
  final fonts = Directory('${engine.parent.parent.path}/material_fonts');
  if (!fonts.existsSync()) return;

  Future<void> load(String family, List<String> files) async {
    final loader = FontLoader(family);
    for (final name in files) {
      final file = File('${fonts.path}/$name');
      if (file.existsSync()) {
        loader.addFont(file.readAsBytes().then((b) => ByteData.view(Uint8List.fromList(b).buffer)));
      }
    }
    await loader.load();
  }

  await load('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Black.ttf']);
  await load('MaterialIcons', ['MaterialIcons-Regular.otf']);
}

/// A phone, at the size the export draws one.
Future<void> shoot(WidgetTester tester, String name, Widget screen,
    {bool signedIn = true, Future<void> Function(WidgetTester)? act}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  if (signedIn) await session.login('ola@epost.no', 'passord');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: swaplyTheme(),
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
Trade _trade() => Trade.fromJson(Map<String, dynamic>.from(FakeServer.trade));

void main() {
  setUp(() async {
    await _loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('01-splash', (t) => shoot(t, '01-splash', const SplashScreen(), signedIn: false));
  testWidgets('02-interesser', (t) => shoot(t, '02-interesser', const InterestsScreen()));
  testWidgets('04-gjenstand',
      (t) => shoot(t, '04-gjenstand', const ItemDetailScreen(itemId: 'item-console')));
  testWidgets('05-oppdag', (t) => shoot(t, '05-oppdag', const DiscoverScreen()));
  testWidgets('05b-avansert-sok',
      (t) => shoot(t, '05b-avansert-sok',
          const AdvancedSearchScreen(initial: SearchFilters(), query: '')));
  testWidgets('06a-match', (t) => shoot(t, '06a-match', const MatchScreen(tradeId: 'trade-1')));
  testWidgets('06b-byttedetalj',
      (t) => shoot(t, '06b-byttedetalj', const TradeDetailScreen(tradeId: 'trade-1')));
  testWidgets('06c-avtale',
      (t) => shoot(t, '06c-avtale', AgreementScreen(trade: _trade())));
  testWidgets('06g-samtale', (t) => shoot(t, '06g-samtale', const ThreadScreen(threadId: 'thread-1')));
  testWidgets('06h-vurdering',
      (t) => shoot(t, '06h-vurdering', ReviewScreen(trade: _trade())));
  testWidgets('09a-motbytte',
      (t) => shoot(t, '09a-motbytte', CounterOfferScreen(trade: _trade())));
  testWidgets('10b-legg-ut', (t) => shoot(t, '10b-legg-ut', const PostItemScreen()));
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
