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
import 'package:swaply_app/widgets/toast.dart';

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
    expect(decoration.borderRadius, BorderRadius.circular(Radii.card));
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
}
