// Large text, and what a screen reader is told.
//
// A device's 13 ran off a small phone under a larger text setting, taking «Logg
// inn» and «Juridisk og personvern» with it; a tab label broke in two; and the
// switches on 16b, the tab you are in and the interests chosen on 02 were
// drawn and never said.
import 'dart:ui' show CheckedState, Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trades_list.dart';
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

    testWidgets('4. 06c\'s box is a checkbox that says whether it is ticked', (tester) async {
      // It is what unlocks the swipe, and was read as its words alone.
      final semantics = tester.ensureSemantics();
      await mount(tester, AgreementScreen(trade: Trade.fromJson(FakeServer.trade)));

      final box = find.text('Jeg har lest og godtar vilkårene');
      expect(
          tester.getSemantics(box),
          isSemantics(
              label: 'Jeg har lest og godtar vilkårene',
              hasCheckedState: true,
              isChecked: false,
              hasTapAction: true));

      await tester.tap(box);
      await tester.pump();
      // Ticked, and the «✓» is not read out as part of it.
      expect(tester.getSemantics(box),
          isSemantics(label: 'Jeg har lest og godtar vilkårene', isChecked: true));
      semantics.dispose();
    });

    testWidgets('5. 09a\'s things say which are chosen', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      // The drill is in the trade, and so chosen; the bike is held by another.
      expect(tester.getSemantics(find.text('Bosch drill 18V')),
          isSemantics(isSelected: true, isButton: true, hasTapAction: true));
      expect(tester.getSemantics(find.text('Bysykkel, dame')),
          isSemantics(isSelected: false, isButton: true, hasEnabledState: true, isEnabled: false));
      expect(find.bySemanticsLabel(RegExp('✓')), findsNothing);

      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pump();
      expect(tester.getSemantics(find.text('Bosch drill 18V')), isSemantics(isSelected: false));
      semantics.dispose();
    });

    testWidgets('6. 06i\'s scale says which number is chosen', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, AppFeedbackScreen(trade: Trade.fromJson(FakeServer.trade)));

      await tester.tap(find.text('4'));
      await tester.pump();
      expect(tester.getSemantics(find.text('4')),
          isSemantics(label: '4', isSelected: true, isButton: true));
      expect(tester.getSemantics(find.text('3')),
          isSemantics(label: '3', isSelected: false, isButton: true));
      semantics.dispose();
    });

    testWidgets('7. the chip over Oppdag that is lit is selected, and the others are not',
        (tester) async {
      // Lit in green and said as nothing: a screen reader had a row of
      // buttons and no way to tell which filter was on.
      final semantics = tester.ensureSemantics();
      await mount(tester, const DiscoverScreen());

      expect(tester.getSemantics(find.text('Alt')),
          isSemantics(label: 'Alt', isButton: true, hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Gaming')),
          isSemantics(label: 'Gaming', isButton: true, hasSelectedState: true, isSelected: false));

      await tester.tap(find.text('Gaming'));
      await tester.pumpAndSettle();
      expect(tester.getSemantics(find.text('Gaming')),
          isSemantics(label: 'Gaming', hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Alt')),
          isSemantics(label: 'Alt', hasSelectedState: true, isSelected: false));
      semantics.dispose();
    });

    testWidgets('8. 05b says which subcategory, condition and order are chosen', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester,
          const AdvancedSearchScreen(initial: SearchFilters(category: 'verktoy'), query: ''));

      expect(tester.getSemantics(find.text('Alle')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Elektroverktøy')),
          isSemantics(hasSelectedState: true, isSelected: false));
      expect(tester.getSemantics(find.text('Nyeste')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Verdi').last),
          isSemantics(hasSelectedState: true, isSelected: false));

      await tester.tap(find.text('God'));
      await tester.pump();
      expect(tester.getSemantics(find.text('God')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Ny')),
          isSemantics(hasSelectedState: true, isSelected: false));
      semantics.dispose();
    });

    testWidgets('9. 10b says which type and which condition are chosen', (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester, const PostItemScreen());

      expect(tester.getSemantics(find.text('Gjenstand')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Tjeneste')),
          isSemantics(hasSelectedState: true, isSelected: false));
      expect(tester.getSemantics(find.text('God')),
          isSemantics(hasSelectedState: true, isSelected: true));
      expect(tester.getSemantics(find.text('Slitt')),
          isSemantics(hasSelectedState: true, isSelected: false));
      semantics.dispose();
    });
  });

  group('everything that answers a tap says what it is', () {
    // InkWell and GestureDetector answer a tap and say nothing of being a
    // button, so the tabs, «Tilbake», «Del» and «⋯» on 04, the cards on 05
    // and 11, the rows of 16b and 12 and more were read as words. And on
    // 16a each round and box was a node of its own with no name.
    final screens = <(String, Widget Function(), Future<void> Function(WidgetTester)?)>[
      ('05', () => const DiscoverScreen(), null),
      ('04', () => const ItemDetailScreen(itemId: 'item-console'), null),
      ('11', () => const TradesScreen(), null),
      ('12', () => const LikedScreen(), null),
      ('13', () => const ProfileScreen(), null),
      ('16b', () => const SettingsScreen(), null),
      ('10b', () => const PostItemScreen(), null),
      ('16a', () => const ItemDetailScreen(itemId: 'item-console'), (tester) async {
        await tester.tap(find.byIcon(Icons.more_horiz));
        await tester.pumpAndSettle();
      }),
    ];
    for (final (name, screen, act) in screens) {
      testWidgets('$name: a role and a name on every target', (tester) async {
        final semantics = tester.ensureSemantics();
        await mount(tester, screen());
        await act?.call(tester);

        final faults = <String>[];
        void visit(SemanticsNode node) {
          final data = node.getSemanticsData();
          final f = data.flagsCollection;
          // The dimming behind a sheet is Flutter's own, and says so.
          final barrier = data.label == 'Scrim' || data.label == 'Dismiss';
          // Merged into the node above it, which is what is read.
          if (!barrier &&
              !node.isMergedIntoParent &&
              (data.hasAction(SemanticsAction.tap) || data.hasAction(SemanticsAction.longPress))) {
            final role = f.isButton ||
                f.isLink ||
                f.isTextField ||
                f.isSlider ||
                f.isChecked != CheckedState.none ||
                f.isToggled != Tristate.none;
            final name = data.label.isNotEmpty || data.value.isNotEmpty || data.tooltip.isNotEmpty;
            if (!role || !name) faults.add('«${data.label}» role: $role, name: $name');
          }
          node.visitChildren((child) {
            visit(child);
            return true;
          });
        }

        visit(tester.binding.renderViews.first.owner!.semanticsOwner!.rootSemanticsNode!);
        expect(faults, isEmpty, reason: faults.join('\n'));
        semantics.dispose();
      });
    }
  });
}
