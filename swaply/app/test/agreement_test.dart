// 06c, the swipe that accepts a trade.
//
// The swipe was a drag and nothing else, so a person on VoiceOver or TalkBack
// could not accept a trade at all: a screen reader cannot make the gesture,
// and the knob offered it nothing to activate. And a swipe whose acceptance
// the server refused, or never answered, stayed at the end of its track with
// a tick and «Godtatt» on it, over a trade nobody had accepted, and could not
// be dragged again. The trade page under 06c asked for the trade again only
// when 06c said it had accepted, so a swipe that heard no answer — and may
// have landed all the same — left the page as it was.
//
// Now the knob is a button to a screen reader, with the swipe's words on it,
// dimmed until the box is ticked; a refused swipe goes back to the start; and
// the trade is asked for again however 06c is left.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

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

/// The trade page, and 06c opened from its «Godta byttet».
Future<void> openAgreement(WidgetTester tester) async {
  await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
  await tester.tap(find.text('Godta byttet'));
  await tester.pumpAndSettle();
  expect(find.byType(AgreementScreen), findsOneWidget);
}

Future<void> tick(WidgetTester tester) async {
  await tester.tap(find.text('Jeg har lest og godtar vilkårene'));
  await tester.pumpAndSettle();
}

Future<void> swipe(WidgetTester tester) async {
  await tester.drag(find.text('›'), const Offset(400, 0));
  await tester.pumpAndSettle();
}

final knob = find.bySemanticsLabel('Sveip for å godta byttet');

String toast(WidgetTester tester) => tester.widget<SwaplyToast>(find.byType(SwaplyToast)).message;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. to a screen reader the knob is a button, dimmed until the box is ticked',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await openAgreement(tester);

    expect(
        tester.getSemantics(knob),
        isSemantics(
            label: 'Sveip for å godta byttet',
            isButton: true,
            hasEnabledState: true,
            isEnabled: false,
            hasTapAction: false));
    // The track's words are the knob's, and are not read out a second time.
    expect(find.bySemanticsLabel('Sveip for å godta byttet'), findsOneWidget);

    await tick(tester);
    expect(tester.getSemantics(knob),
        isSemantics(isButton: true, isEnabled: true, hasTapAction: true));
    semantics.dispose();
  });

  testWidgets('2. …and activating it accepts, with no swipe at all', (tester) async {
    final semantics = tester.ensureSemantics();
    await openAgreement(tester);
    await tick(tester);

    tester.semantics.tap(find.semantics.byLabel('Sveip for å godta byttet'));
    await tester.pumpAndSettle();

    expect(server.asked('POST /trades/trade-1/accept'), 1);
    expect(server.bodies['POST /trades/trade-1/accept']?['termsVersion'], '2026-09-06');
    // Accepted, and back on the trade.
    expect(find.byType(AgreementScreen), findsNothing);
    semantics.dispose();
  });

  testWidgets('3. a finger still has to swipe: a tap on the knob accepts nothing',
      (tester) async {
    await openAgreement(tester);
    await tick(tester);

    await tester.tap(find.text('›'));
    await tester.pumpAndSettle();

    expect(server.asked('POST /trades/trade-1/accept'), 0);
  });

  for (final (name, answer) in [
    ('refused', const Refusal(409, 'trade_paused', 'Byttet er pauset mens noen svarer.')),
    ('not answered', unreachable),
  ]) {
    testWidgets('4. a swipe $name goes back to the start, and can be swiped again',
        (tester) async {
      await openAgreement(tester);
      server.overrides['POST /trades/trade-1/accept'] = answer;
      await tick(tester);

      await swipe(tester);

      expect(server.asked('POST /trades/trade-1/accept'), 1);
      expect(toast(tester), answer is Refusal ? answer.message : noContact);
      // Not «Godtatt» with a tick over a trade nobody accepted.
      expect(find.text('Godtatt'), findsNothing);
      expect(find.byIcon(Icons.check), findsNothing);
      expect(find.text('Sveip for å godta byttet'), findsOneWidget);
      expect(find.byType(AgreementScreen), findsOneWidget);

      server.overrides.remove('POST /trades/trade-1/accept');
      await swipe(tester);

      expect(server.asked('POST /trades/trade-1/accept'), 2);
      expect(find.byType(AgreementScreen), findsNothing);
    });
  }

  testWidgets('5. the trade is asked for again when 06c is left with «Avbryt»', (tester) async {
    await openAgreement(tester);
    final asked = server.asked('GET /trades/trade-1');

    await tester.tap(find.text('Avbryt'));
    await tester.pumpAndSettle();

    expect(find.byType(AgreementScreen), findsNothing);
    expect(server.asked('GET /trades/trade-1'), asked + 1);
  });

  testWidgets('6. …and with the phone\'s back, after a swipe that heard no answer',
      (tester) async {
    await openAgreement(tester);
    server.overrides['POST /trades/trade-1/accept'] = unreachable;
    await tick(tester);
    await swipe(tester);
    // The acceptance landed after all: the server has it, the phone does not.
    server.overrides['GET /trades/trade-1'] = {
      ...FakeServer.trade,
      'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
    };
    final asked = server.asked('GET /trades/trade-1');

    // Android's back, which goes to the app's navigator.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(server.asked('GET /trades/trade-1'), asked + 1);
    // 06e, as the server has it: no «Godta byttet» to press a second time.
    expect(find.text('Godta byttet'), findsNothing);
    expect(find.text('Angre godkjenningen'), findsOneWidget);
  });
}
