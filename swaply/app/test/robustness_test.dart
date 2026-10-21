// The screens on the phones people have that are smaller than the export's,
// at the text sizes people set, and with the names and things people have.
//
// Found by pumping every screen at 320, 360 and 412 across and 100, 130 and
// 200 % text, in the export's world and in one of long names, long titles and
// many things, and catching every overflow and every word cut short. These are
// the ones that hid something a person needed. Measured with real fonts, since
// whether a word fits is the question and the test font draws every letter a
// full em wide.
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

const narrow = (name: '320×568', size: Size(320, 568), statusBar: 20.0);
const android = (name: '360×640', size: Size(360, 640), statusBar: 24.0);

/// [screen] on [phone] at [scale] times the text size.
Future<void> hold(WidgetTester tester, Phone phone, Widget screen, {double scale = 1}) async {
  tester.view.physicalSize = phone.size * 3;
  tester.view.devicePixelRatio = 3;
  tester.view.padding = FakeViewPadding(top: phone.statusBar * 3);
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

/// [finder] lies inside the screen, all of it.
void onScreen(WidgetTester tester, Finder finder, Phone phone) {
  final rect = tester.getRect(finder);
  expect(rect.left, greaterThanOrEqualTo(0));
  expect(rect.right, lessThanOrEqualTo(phone.size.width));
  expect(rect.top, greaterThanOrEqualTo(0));
  expect(rect.bottom, lessThanOrEqualTo(phone.size.height));
}

void main() {
  setUp(() async {
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('the sheets that ask before a trade is left', () {
    // Held to nine sixteenths of the screen and not scrolling, 08a ran past
    // its foot on a 360×640 phone at the ordinary text size, and «Avbryt»
    // was cut off; 09g on a 320 one. Larger text cut both buttons.
    final sheets = <(String, Map<String, Object?>, String, String)>[
      ('08a', {'state': 'accepted'}, 'Trekk deg fra byttet', 'Spør om å trekke meg'),
      (
        '09g',
        {
          'state': 'pending',
          'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
          'participants': [
            {...FakeServer.me, 'position': 0, 'accepted': true, 'gives': [FakeServer.drill]},
            {...FakeServer.kari, 'position': 1, 'accepted': false, 'gives': [FakeServer.console]},
          ],
        },
        'Trekk deg fra byttet',
        'Trekk meg fra byttet'
      ),
      ('«Avslå»', {'state': 'pending'}, 'Avslå', 'Avslå byttet'),
    ];
    for (final (name, state, opens, confirm) in sheets) {
      for (final (phone, scale) in [(android, 1.0), (narrow, 1.0), (narrow, 1.3), (narrow, 2.0)]) {
        testWidgets('$name on ${phone.name} at ${(scale * 100).round()} % reaches «Avbryt»',
            (tester) async {
          server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, ...state};
          await hold(tester, phone, const TradeDetailScreen(tradeId: 'trade-1'), scale: scale);
          final open = find.text(opens).last;
          await tester.ensureVisible(open);
          await tester.pumpAndSettle();
          await tester.tap(open);
          await tester.pumpAndSettle();

          // Nothing ran past the foot of the sheet while it was laid out.
          expect(tester.takeException(), isNull);
          for (final button in [confirm, 'Avbryt']) {
            final target = find.text(button).last;
            await tester.ensureVisible(target);
            await tester.pumpAndSettle();
            onScreen(tester, target, phone);
          }
          await tester.tap(find.text('Avbryt').last);
          await tester.pumpAndSettle();
          expect(find.text(confirm), findsNothing);
        });
      }
    }
  });
}
