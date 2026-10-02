// Large text, and what a screen reader is told.
//
// A device's 13 ran off a small phone under a larger text setting, taking «Logg
// inn» and «Juridisk og personvern» with it; a tab label broke in two; and the
// switches on 16b, the tab you are in and the interests chosen on 02 were
// drawn and never said.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen,
    {Size size = const Size(430, 1800),
    double text = 1,
    double statusBar = 0,
    bool signedIn = true}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  if (signedIn) await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        // The real fonts: how far words run is what large text is about, and
        // the test font's square letters run far further than Roboto's.
        theme: phoneTheme(),
        home: screen,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: true,
            textScaler: TextScaler.linear(text),
            padding: EdgeInsets.only(top: statusBar),
            viewPadding: EdgeInsets.only(top: statusBar),
          ),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() async {
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('large text on a small phone', () {
    testWidgets('1. a device\'s 13 scrolls to «Logg inn» and «Juridisk og personvern»',
        (tester) async {
      await session.lookAround();
      server.overrides['GET /me'] = FakeServer.lookingAround;
      // A 320 with its status bar, and the text a setting or two up.
      await mount(tester, const ProfileScreen(),
          size: const Size(320, 568), text: 1.5, statusBar: 20, signedIn: false);

      expect(tester.takeException(), isNull);
      for (final words in ['Logg inn', 'Juridisk og personvern']) {
        await tester.ensureVisible(find.text(words));
        await tester.pumpAndSettle();
        expect(find.text(words).hitTestable(), findsOneWidget, reason: words);
      }
      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();
      expect(find.byType(LegalScreen), findsOneWidget);
    });

    testWidgets('2. …and with room to spare it stands in the middle, as drawn', (tester) async {
      await session.lookAround();
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await mount(tester, const ProfileScreen(), signedIn: false);

      final screen = tester.getRect(find.byType(Scaffold));
      final title = tester.getRect(find.text('Du ser deg rundt'));
      expect(title.top, greaterThan(screen.top + 200));
    });

    testWidgets('3. the bar\'s labels keep to one line', (tester) async {
      // «Legg ut» broke in two at twice the size, and ran out of the bar.
      await mount(tester, const Scaffold(bottomNavigationBar: SwaplyNavBar(current: 0)),
          size: const Size(320, 568), text: 2);

      expect(tester.takeException(), isNull);
      for (final label in ['Oppdag', 'Legg ut', 'Bytter', 'Chats', 'Profil']) {
        final text = tester.widget<Text>(
            find.descendant(of: find.byType(SwaplyNavBar), matching: find.text(label)));
        expect(text.maxLines, 1, reason: label);
      }
    });
  });

  group('what is drawn is also said', () {
    testWidgets('1. the tab you are in is selected, and the others are not', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, const ProfileScreen());

      Finder tab(String label) =>
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text(label));
      // On its own the tab you are in has nowhere to go; in the shell it
      // goes back to the tab's first screen.
      expect(tester.getSemantics(tab('Profil')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(tab('Oppdag')),
          isSemantics(hasSelectedState: true, isSelected: false, hasTapAction: true));
      semantics.dispose();
    });

    testWidgets('2. 16b\'s three switches are switches, and say which way they stand',
        (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, const SettingsScreen());

      for (final label in ['Swaps og bytter', 'Meldinger', 'Likes på tingene mine']) {
        expect(tester.getSemantics(find.text(label)),
            isSemantics(hasToggledState: true, isToggled: true, hasTapAction: true),
            reason: label);
      }
      await tester.tap(find.text('Meldinger'));
      await tester.pumpAndSettle();
      expect(tester.getSemantics(find.text('Meldinger')),
          isSemantics(hasToggledState: true, isToggled: false));
      semantics.dispose();
    });

    testWidgets('3. 02\'s chosen interests are selected, not a tick in the name', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, const InterestsScreen());

      expect(tester.getSemantics(find.text('Verktøy')),
          isSemantics(label: 'Verktøy', isSelected: true, isButton: true));
      expect(tester.getSemantics(find.text('Båt')),
          isSemantics(label: 'Båt', isSelected: false, isButton: true));

      await tester.tap(find.text('Båt'));
      await tester.pump();
      expect(tester.getSemantics(find.text('Båt')),
          isSemantics(label: 'Båt', isSelected: true));
      semantics.dispose();
    });
  });
}
