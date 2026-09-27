// What the app says in passing, and what it must not look like saying it.
//
// The failure this exists for is on record: a review sent without a comment
// came back refused, and the refusal arrived as a black rectangle with square
// corners across the bottom of the screen reading «Expected string, received
// null». Both halves of that were bugs. The backend half is pinned by
// `backend/test/flows/reviews.test.ts`; this is the half you can see.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/widgets/common.dart';

/// A screen with one button on it, so a toast can be asked for the way a
/// screen asks for one.
Future<void> mount(WidgetTester tester, void Function(BuildContext) tell) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (context) => Center(
          child: TextButton(onPressed: () => tell(context), child: const Text('si fra')),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('si fra'));
  await tester.pump();
}

BoxDecoration _decoration(WidgetTester tester) =>
    tester.widget<Container>(find.descendant(
      of: find.byType(SwaplyToast),
      matching: find.byType(Container),
    ).first).decoration! as BoxDecoration;

void main() {
  testWidgets('an error carries the Norwegian the server wrote', (tester) async {
    await mount(
        tester,
        (context) => showError(
            context, ApiException(409, 'not_completed', 'Du kan vurdere når byttet er gjennomført.')));

    expect(find.text('Du kan vurdere når byttet er gjennomført.'), findsOneWidget);
    expect(find.byType(SwaplyToast), findsOneWidget);
  });

  testWidgets('and it is a card in the palette, not a black bar', (tester) async {
    await mount(tester, (context) => showError(context, 'Noe gikk galt.'));

    final decoration = _decoration(tester);
    expect(decoration.color, Colors.white);
    expect(decoration.borderRadius, BorderRadius.circular(18));
    expect(decoration.boxShadow, isNotEmpty);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
  });

  testWidgets('a refusal is coral, which is the «no» colour, and never the report red',
      (tester) async {
    // `../CLAUDE.md`: «Two reds, and they must never collapse into one value.»
    // An error toast is the most tempting place in the app to reach for the
    // stronger one, and it belongs to report and block alone.
    await mount(tester, (context) => showError(context, 'Nei.'));

    final icon = tester.widget<Icon>(find.byIcon(Icons.error_outline));
    expect(icon.color, SwaplyColors.coral);
    expect(icon.color, isNot(SwaplyColors.red));
  });

  testWidgets('something that landed is green, and something else is neither',
      (tester) async {
    await mount(tester, (context) => showDone(context, 'Lagt ut.'));
    expect(tester.widget<Icon>(find.byIcon(Icons.check_rounded)).color,
        SwaplyColors.greenPressed);

    await mount(tester, (context) => showNote(context, 'Nummeret er kopiert'));
    expect(tester.widget<Icon>(find.byIcon(Icons.info_outline)).color, SwaplyColors.inkBody);
  });

  testWidgets('a second refusal replaces the first rather than queueing behind it',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () {
                showError(context, 'Første');
                showError(context, 'Andre');
              },
              child: const Text('si fra'),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('si fra'));
    await tester.pumpAndSettle();

    expect(find.text('Andre'), findsOneWidget);
    expect(find.text('Første'), findsNothing);
  });

  group('where it goes up', () {
    // It used to sit 14 above the foot of whatever screen it was on. On a
    // screen drawn without the bar that is where the button is, so a refusal
    // of «Fortsett» on 02 lay across «Fortsett» for as long as it was up —
    // exactly when the person wanted to press it again.

    /// A phone the size the export draws one, with [screen] on it.
    Future<void> hold(WidgetTester tester, Widget screen) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(home: screen));
      await tester.pumpAndSettle();
    }

    /// …and a toast asked for over it.
    Future<void> sayOver(WidgetTester tester, Widget screen,
        {String message = 'Noe gikk galt hos oss.'}) async {
      await hold(tester, screen);
      showToastOn(ScaffoldMessenger.of(tester.element(find.byType(Scaffold).last)),
          ToastTone.error, message);
      await tester.pumpAndSettle();
    }

    /// 02's foot: the button with 34 under it, on a screen with no bar.
    Widget footed({double under = 34, PreferredSizeWidget? bar}) => Scaffold(
          bottomNavigationBar: bar,
          body: Column(
            children: [
              const Expanded(child: TextField()),
              Padding(
                padding: EdgeInsets.fromLTRB(24, 12, 24, under),
                child: PrimaryButton('Fortsett', onPressed: () {}),
              ),
            ],
          ),
        );

    Rect toast(WidgetTester tester) => tester.getRect(find.byType(SwaplyToast));
    Rect button(WidgetTester tester) => tester.getRect(find.byType(PrimaryButton));

    testWidgets('1. over the button at the foot of a screen without the bar, not on it',
        (tester) async {
      await sayOver(tester, footed());

      expect(toast(tester).bottom, button(tester).top - 14);
      // The same card, as wide as ever: only where it lies has changed.
      expect(toast(tester).width, 390 - 2 * 14);
      final decoration = _decoration(tester);
      expect(decoration.color, Colors.white);
      expect(decoration.borderRadius, BorderRadius.circular(18));
    });

    testWidgets('…however long the sentence', (tester) async {
      await sayOver(tester, footed(),
          message: 'Swaply er invitasjonsbasert. Du trenger en invitasjon fra noen som '
              'allerede er med, og den du har er brukt av noen andre allerede.');

      expect(toast(tester).height, greaterThan(70));
      expect(toast(tester).bottom, button(tester).top - 14);
    });

    testWidgets('…and the button still answers under the room the toast leaves', (tester) async {
      var pressed = 0;
      await sayOver(
          tester,
          Scaffold(
            body: Column(children: [
              const Spacer(),
              PrimaryButton('Fortsett', onPressed: () => pressed++),
            ]),
          ));

      await tester.tap(find.text('Fortsett'));
      expect(pressed, 1);
    });

    testWidgets('2. with nothing at the foot it stays where it was, 14 above it', (tester) async {
      await sayOver(tester, const Scaffold(body: Center(child: Text('Oppdag'))));
      expect(toast(tester).bottom, 844 - 14);
    });

    testWidgets('3. over the keyboard, and over a button standing on it', (tester) async {
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await sayOver(tester, footed(under: 10));

      expect(button(tester).bottom, 844 - 300 - 10);
      expect(toast(tester).bottom, button(tester).top - 14);
    });

    testWidgets('4. over a bottom bar, and over a button above the bar', (tester) async {
      await sayOver(
          tester,
          footed(
            under: 8,
            bar: const PreferredSize(
                preferredSize: Size.fromHeight(60), child: SizedBox(height: 60)),
          ));

      expect(button(tester).bottom, 844 - 60 - 8);
      expect(toast(tester).bottom, button(tester).top - 14);
    });

    testWidgets('5. a button that is not on screen is not kept clear of', (tester) async {
      // Under another page: the one on top has nothing at its foot.
      await hold(
          tester,
          Builder(
            builder: (context) => Scaffold(
              body: Column(children: [
                const Spacer(),
                PrimaryButton('Fortsett',
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => const Scaffold(body: Center(child: Text('Neste')))))),
              ]),
            ),
          ));
      await tester.tap(find.text('Fortsett'));
      await tester.pumpAndSettle();
      showToastOn(ScaffoldMessenger.of(tester.element(find.text('Neste'))), ToastTone.note, 'Ok.');
      await tester.pumpAndSettle();
      expect(toast(tester).bottom, 844 - 14);
    });

    testWidgets('…nor one in a list, laid out below where the list ends', (tester) async {
      await sayOver(
          tester,
          Scaffold(
            body: Column(children: [
              Expanded(
                child: ListView(children: [
                  const SizedBox(height: 800),
                  PrimaryButton('Fortsett', onPressed: () {}),
                ]),
              ),
              const SizedBox(height: 54),
            ]),
          ));

      // Laid out, in the list's cache below the fold, and out of sight.
      expect(find.byType(PrimaryButton, skipOffstage: false), findsOneWidget);
      expect(toast(tester).bottom, 844 - 14);
    });

    testWidgets('…nor one so high that clearing it would take the toast off the screen',
        (tester) async {
      await sayOver(
          tester,
          Scaffold(
            body: Column(children: [
              SizedBox(
                  height: 844, child: PrimaryButton('Fortsett', onPressed: () {}, height: 844)),
            ]),
          ));
      expect(toast(tester).bottom, 844 - 14);
    });

    testWidgets('7. an outlined button counts: the foot of the trade screen is often only those',
        (tester) async {
      // 06f, 09f and a paused trade end in «Trekk deg fra byttet», «Tilbake
      // til Bytter» or «Angre forespørselen» and nothing else, and a refusal
      // of one lay across it: only the filled button was measured.
      await sayOver(
          tester,
          Scaffold(
            body: Column(children: [
              const Spacer(),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
                child: SecondaryButton('Trekk deg fra byttet', destructive: true, onPressed: () {}),
              ),
            ]),
          ));

      expect(toast(tester).bottom, tester.getRect(find.byType(SecondaryButton)).top - 14);
    });

    testWidgets('8. said as a page opens, it goes up over that page\'s button', (tester) async {
      // «Lagt ut» and the tab it lands on, a sign-in and the app it opens:
      // the toast is said in the same moment the page is asked for, when the
      // page is not built yet. It was measured against the page it was
      // leaving, and lay across the new one's button.
      await hold(
          tester,
          Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () {
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => footed()));
                    showToastOn(ScaffoldMessenger.of(context), ToastTone.done, 'Lagt ut.');
                  },
                  child: const Text('Legg ut'),
                ),
              ),
            ),
          ));
      await tester.tap(find.text('Legg ut'));
      await tester.pumpAndSettle();

      expect(find.text('Fortsett'), findsOneWidget);
      expect(toast(tester).bottom, button(tester).top - 14);
    });

    testWidgets('…and said as a page goes, over the button of the page it uncovers',
        (tester) async {
      // A block from 04's «⋯» takes the listing away, and the report's thanks
      // go up in the same moment: measured against 04's heart and ✕, it stood
      // high over the grid; measured against nothing, it lay across 02.
      await hold(tester, footed());
      final under = button(tester);
      final navigator = Navigator.of(tester.element(find.text('Fortsett')));
      navigator.push(MaterialPageRoute<void>(
          builder: (context) => Scaffold(
                body: Column(children: [
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 200),
                    child: PrimaryButton('Høyt oppe', onPressed: () {}),
                  ),
                ]),
              )));
      await tester.pumpAndSettle();

      final messenger = ScaffoldMessenger.of(tester.element(find.text('Høyt oppe')));
      navigator.pop();
      showToastOn(messenger, ToastTone.done, 'Takk. Vi ser på rapporten.');
      await tester.pumpAndSettle();

      expect(find.text('Høyt oppe'), findsNothing);
      expect(toast(tester).bottom, under.top - 14);
    });

    testWidgets('…and a toast whose place is the same is put up once', (tester) async {
      await sayOver(tester, footed());
      final first = tester.element(find.byType(SwaplyToast));
      await tester.pump(const Duration(milliseconds: 500));
      // The same card, not one taken down and put up again.
      expect(tester.element(find.byType(SwaplyToast)), same(first));
      expect(find.byType(SwaplyToast), findsOneWidget);
    });

    testWidgets('6. anything else can ask to be kept clear of — the composer on 06g',
        (tester) async {
      await sayOver(
          tester,
          const Scaffold(
            body: Column(children: [
              Spacer(),
              KeepClear(child: SizedBox(height: 60, child: TextField())),
            ]),
          ));
      expect(toast(tester).bottom, 844 - 60 - 14);
    });
  });

  group('a way back', () {
    testWidgets('is one word on the card, and pressing it takes the toast down', (tester) async {
      var undone = 0;
      await mount(
          tester,
          (context) => showDone(context, 'Vi viser deg ikke flere slike.',
              action: ToastAction('Angre', () => undone++)));
      await tester.pumpAndSettle();

      final word = tester.widget<Text>(find.text('Angre'));
      expect(word.style!.color, SwaplyColors.greenText);
      expect(find.descendant(of: find.byType(SwaplyToast), matching: find.text('Angre')),
          findsOneWidget);
      // A finger's worth of it, inside the card.
      final card = tester.getRect(find.byType(SwaplyToast));
      final area = tester
          .getRect(find.ancestor(of: find.text('Angre'), matching: find.byType(TapArea)));
      expect(card.contains(area.center), isTrue);

      await tester.tap(find.text('Angre'));
      await tester.pumpAndSettle();
      expect(undone, 1);
      expect(find.byType(SwaplyToast), findsNothing);
    });

    testWidgets('and without one the card is the one it always was', (tester) async {
      await mount(tester, (context) => showDone(context, 'Lagt ut.'));
      await tester.pumpAndSettle();
      expect(find.byType(TapArea), findsNothing);
    });
  });
}
