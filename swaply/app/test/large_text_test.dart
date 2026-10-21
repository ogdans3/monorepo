// The trade screens at a large text size, on the phones people have that are
// smaller than the export's.
//
// Each was drawn for 390 points and the export's own text size, and several
// had a row or a column that could not give way: «Åpne ›» on a trade page ran
// off its card and was clipped, the fifth star on 06h went the same way, 09h
// pushed «Vurder Kari» and «Senere» off the foot of the screen, and in a
// ring's conversation the summary and the banner over it pushed the field
// under the keyboard. Measured with real fonts, since whether a word fits is
// the question and the test font draws every letter a full em wide.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A phone: its size in points, and its status bar.
typedef Phone = ({String name, Size size, double statusBar});

const small = (name: '320×568', size: Size(320, 568), statusBar: 20.0);
const se = (name: '375×667', size: Size(375, 667), statusBar: 20.0);

/// [screen] on [phone] at [scale] times the text size, with the keyboard
/// [keyboard] points tall when it is up.
Future<void> hold(WidgetTester tester, Phone phone, Widget screen,
    {double scale = 1, double keyboard = 0}) async {
  tester.view.physicalSize = phone.size * 3;
  tester.view.devicePixelRatio = 3;
  tester.view.padding = FakeViewPadding(top: phone.statusBar * 3);
  tester.view.viewInsets = FakeViewPadding(bottom: keyboard * 3);
  addTearDown(tester.view.reset);
  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        theme: phoneTheme(),
        home: screen,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// [finder]'s box lies inside the screen, all of it.
void onScreen(WidgetTester tester, Finder finder, Phone phone, {String? reason}) {
  final rect = tester.getRect(finder);
  expect(rect.left, greaterThanOrEqualTo(0), reason: reason);
  expect(rect.right, lessThanOrEqualTo(phone.size.width), reason: reason);
  expect(rect.top, greaterThanOrEqualTo(0), reason: reason);
  expect(rect.bottom, lessThanOrEqualTo(phone.size.height), reason: reason);
}

void main() {
  setUp(() async {
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('«Åpne ›» on a trade page', () {
    for (final state in ['pending', 'accepted', 'completed', 'cancelled']) {
      testWidgets('stays on its card at twice the text size, $state', (tester) async {
        server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, 'state': state};
        await hold(tester, small, const TradeDetailScreen(tradeId: 'trade-1'), scale: 2);
        await tester.scrollUntilVisible(find.text('Åpne ›'), 200);
        await tester.pumpAndSettle();

        // Nothing ran over an edge while it was laid out.
        expect(tester.takeException(), isNull);
        onScreen(tester, find.text('Åpne ›'), small);
      });
    }

    testWidgets('…and beside a long first name at the export\'s size', (tester) async {
      final long = {...FakeServer.kari, 'displayName': 'Kristoffer-Alexander H.', 'position': 1};
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'givingTo': long,
        'receivingFrom': long,
      };
      await hold(tester, small, const TradeDetailScreen(tradeId: 'trade-1'));
      await tester.scrollUntilVisible(find.text('Åpne ›'), 200);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      onScreen(tester, find.text('Åpne ›'), small);
      // The kicker gives way, and says as much of the name as fits.
      expect(find.textContaining('SAMTALE MED KRISTOFFER'), findsOneWidget);
    });
  });
}
