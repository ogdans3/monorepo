// The screens drawn for 390×844, on the phones people have that are smaller.
//
// 06a was laid out from the top down in fixed sizes: 153 over the title, the
// words, then a table of cards 251 tall and 304 across. On a 375×667 phone
// the table ran some 25 points under «Se byttet», on a 360×640 one about a
// hundred, and at 320 across the right-hand card was cut off by the edge of
// the screen. The 153 is room a phone can spare, so it now gives way first;
// past that the words and the table scroll above the buttons; and the table
// is shrunk as a whole to the width it has. At 390 it is as it was.
//
// The counts on 11's «Venter · Aktive · Fullført» faded out at 320 across,
// where each label had 58 points between its paddings.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// A phone: its size in points, and its status bar.
typedef Phone = ({String name, Size size, double statusBar});

const phones = <Phone>[
  (name: '375×667, an iPhone SE', size: Size(375, 667), statusBar: 20),
  (name: '360×640, a small Android', size: Size(360, 640), statusBar: 24),
  (name: '320×568, the narrowest', size: Size(320, 568), statusBar: 20),
];

Future<void> hold(WidgetTester tester, Phone phone, Widget screen) async {
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
        // Real fonts: whether a word fits is the question, and the test
        // font draws every letter a full em wide.
        theme: phoneTheme(),
        home: screen,
        // The confetti never settles; a phone that asked for less motion
        // holds it still.
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The most the page can scroll, then the page as it stands there.
Future<void> scrollToEnd(WidgetTester tester) async {
  final scrollables = find.byType(Scrollable);
  if (scrollables.evaluate().isEmpty) return;
  final position = tester.state<ScrollableState>(scrollables.first).position;
  position.jumpTo(position.maxScrollExtent);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() async {
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    // The export's pair: two things of yours, so a card peeks out behind the
    // first and the words run to the longest they do.
    server.overrides['GET /trades/trade-1'] = {
      ...FakeServer.trade,
      'youGive': [
        FakeServer.drill,
        {...FakeServer.drill, 'id': 'item-helmet', 'title': 'Sykkelhjelm'},
      ],
    };
  });

  for (final phone in phones) {
    testWidgets('06a on ${phone.name} fits, or scrolls above its buttons', (tester) async {
      await hold(tester, phone, const MatchScreen(tradeId: 'trade-1'));

      // No overflow was reported while it was laid out.
      expect(tester.takeException(), isNull);
      expect(find.text('Dere kan swappe!'), findsOneWidget);

      await scrollToEnd(tester);
      final button = tester.getRect(find.widgetWithText(FilledButton, 'Se byttet'));
      // The foot of the table — the two names under the cards — clears the
      // button, and every card is inside the screen.
      for (final who in ['Du · 2 ting', 'Kari']) {
        expect(tester.getRect(find.text(who)).bottom, lessThanOrEqualTo(button.top), reason: who);
      }
      for (final card in tester.widgetList<ItemThumb>(find.byType(ItemThumb))) {
        final rect = tester.getRect(find.byWidget(card));
        expect(rect.left, greaterThanOrEqualTo(0), reason: card.item.title);
        expect(rect.right, lessThanOrEqualTo(phone.size.width), reason: card.item.title);
      }
    });

    testWidgets('07i on ${phone.name} fits, or scrolls above its buttons', (tester) async {
      server.overrides['GET /trades/trade-chain'] = chainTrade();
      await hold(tester, phone, const MatchScreen(tradeId: 'trade-chain'));

      expect(tester.takeException(), isNull);
      await scrollToEnd(tester);
      final button = tester.getRect(find.widgetWithText(FilledButton, 'Start chat'));
      expect(
          tester.getRect(find.textContaining('Dette byttet kan ikke Swaply fasilitere')).bottom,
          lessThanOrEqualTo(button.top));
    });
  }

  testWidgets('06a at the export\'s size still has its 153 over the title', (tester) async {
    await hold(tester, (name: '390×844', size: const Size(390, 844), statusBar: 46),
        const MatchScreen(tradeId: 'trade-1'));

    expect(tester.getRect(find.text('Dere kan swappe!')).top, 46 + 153);
    // Nothing to scroll: it is the drawing, not a page.
    final position = tester.state<ScrollableState>(find.byType(Scrollable)).position;
    expect(position.maxScrollExtent, 0);
  });

  testWidgets('11 at 320 across says every count whole', (tester) async {
    server.overrides['GET /trades'] = {
      'waiting': [FakeServer.trade, FakeServer.trade],
      'active': [for (var i = 0; i < 12; i++) FakeServer.trade],
      'done': [for (var i = 0; i < 3; i++) FakeServer.trade],
      'yourTurn': 2,
    };
    await hold(tester, phones.last, const TradesScreen());

    for (final label in ['Venter · 2', 'Aktive · 12', 'Fullført · 3']) {
      final paragraph = tester.renderObject<RenderParagraph>(find.text(label));
      expect(paragraph.debugHasOverflowShader, isFalse, reason: label);
      // Inside its third of the track, all of it.
      final rect = tester.getRect(find.text(label));
      final third = (phones.last.size.width - 44 - 6) / 3;
      expect(rect.width, lessThanOrEqualTo(third), reason: label);
    }
  });
}
