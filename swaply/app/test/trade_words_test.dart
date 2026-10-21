// What the trade screens say about the things in a trade and the people in it.
//
// A thing listed without a value — the field is optional on 10b, «Helt
// billige ting kan være gratis» — was «fra Kari · verdi » on the trade page
// and «verdi » on 09a, and «Foreslå ting» sent «Jeg foreslår Skateboard (verdi
// ) i byttet.» into the conversation for the other side to read. 04, 05 and
// 13 leave «Verdi» out when there is none, and so do these now.
//
// 09d named the first thing on each side and its value, and then the
// difference between the sides: with a drill and a helmet for a console it
// said 1 200 and 600 and a difference of 350. With more than one thing on a
// side it says what each side is worth.
//
// 09a put an s on the name — «ANDREASS TING» — and 09h said «… er hans»
// about whoever was on the other side, and «er din» about several things.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
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

Future<void> openChip(WidgetTester tester, String chip) async {
  await tester.ensureVisible(find.text(chip));
  await tester.pumpAndSettle();
  await tester.tap(find.text(chip));
  await tester.pumpAndSettle();
}

/// A thing of yours listed without a value.
const skateboard = {
  ...FakeServer.drill,
  'id': 'item-skate',
  'title': 'Skateboard',
  'estimatedValueNok': null,
};

const helmet = {...FakeServer.drill, 'id': 'item-helmet', 'title': 'Sykkelhjelm', 'estimatedValueNok': 250};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('a thing without a value', () {
    testWidgets('1. on the trade page says who it is from, and no «verdi »', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'youGive': [skateboard],
      };
      await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

      expect(find.text('til Kari'), findsOneWidget);
      expect(find.textContaining('verdi 1 200 kr'), findsWidgets);
      expect(find.text('til Kari · verdi '), findsNothing);
    });

    testWidgets('2. on 09a has no «verdi » either', (tester) async {
      server.overrides['GET /trades/trade-1/candidates'] = {
        'yours': [FakeServer.drill, skateboard],
        'theirs': [FakeServer.console],
        'counterparty': FakeServer.kari,
      };
      await mount(tester, CounterOfferScreen(trade: Trade.fromJson(FakeServer.trade)));

      expect(find.text('verdi 600 kr'), findsOneWidget);
      expect(find.text('verdi '), findsNothing);
      expect(find.text('Skateboard'), findsOneWidget);
    });

    testWidgets('3. proposed from the chat, is named in the message without «(verdi )»',
        (tester) async {
      server.overrides['GET /trades/trade-1/candidates'] = {
        'yours': [
          {...FakeServer.drill, 'inOffer': true},
          skateboard,
        ],
        'theirs': [FakeServer.console],
        'counterparty': FakeServer.kari,
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå ting');

      expect(find.text('Verdi '), findsNothing);
      await tester.tap(find.text('Skateboard'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Foreslå Skateboard'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /threads/thread-1/messages']?['body'],
          'Jeg foreslår Skateboard i byttet.');
    });
  });

  group('09d, «Foreslå mellomlegg»', () {
    testWidgets('4. one thing a side: by name, as the export has it', (tester) async {
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå mellomlegg');

      expect(
          find.text('Retro spillkonsoll er verdt 1 200 kr, Bosch drill 18V 600 kr. '
              'Differansen er 600 kr.'),
          findsOneWidget);
    });

    testWidgets('5. more on a side: what each side is worth, which makes the difference',
        (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'youGive': [FakeServer.drill, helmet],
        'youGiveValue': 850,
        'difference': 350,
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, 'Foreslå mellomlegg');

      expect(
          find.text('Det du får er verdt 1 200 kr, det du gir 850 kr. Differansen er 350 kr.'),
          findsOneWidget);
      expect(find.textContaining('Bosch drill 18V 600 kr'), findsNothing);
    });
  });

  group('names', () {
    test('6. a name that ends in s takes an apostrophe, not a second s', () {
      expect(possessive('Ola'), 'Olas');
      expect(possessive('Kari'), 'Karis');
      expect(possessive('Andreas'), "Andreas'");
      expect(possessive('Max'), "Max'");
      expect(possessive('Fritz'), "Fritz'");
    });

    testWidgets('7. 09a says «DU FÅR · ANDREAS\' TING»', (tester) async {
      final andreas = {...FakeServer.kari, 'displayName': 'Andreas B.', 'position': 1};
      await mount(
          tester,
          CounterOfferScreen(
              trade: Trade.fromJson(
                  {...FakeServer.trade, 'givingTo': andreas, 'receivingFrom': andreas})));

      expect(find.text("DU FÅR · ANDREAS' TING"), findsOneWidget);
      expect(find.textContaining('ANDREASS'), findsNothing);
    });

    testWidgets('8. 09h says whose the things are by name, and «dine» for several',
        (tester) async {
      await mount(
          tester,
          TradeCompletedScreen(
              trade: Trade.fromJson({
            ...FakeServer.trade,
            'youGet': [FakeServer.console, {...FakeServer.console, 'id': 'c2', 'title': 'Kabel'}],
          })));

      expect(
          find.text('Du og Kari har begge bekreftet. Retro spillkonsoll og Kabel er dine, '
              'Bosch drill 18V er Karis.'),
          findsOneWidget);
      expect(find.textContaining('hans'), findsNothing);
    });
  });

  group('a side with nothing on it yet', () {
    // Per wrote first about Kari's listing; seen from Kari's side, she gives
    // and gets nothing yet. Here: you give the drill and get nothing yet.
    final firstAsk = {...FakeServer.trade, 'state': 'talking', 'youGet': const [], 'cash': null};

    testWidgets('9. is said in 06g\'s header, not a hole after the ⇄', (tester) async {
      server.overrides['GET /trades/trade-1'] = firstAsk;
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));

      expect(find.text('Bosch drill 18V ⇄ ingenting ennå · under avtale'), findsOneWidget);
    });

    testWidgets('10. «Jeg vil ha» asks for the first thing, not one more', (tester) async {
      server.overrides['GET /trades/trade-1'] = firstAsk;
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, '♥ Jeg vil ha');

      expect(find.text('Vil du ha noe av Kari?'), findsOneWidget);
      await tester.tap(find.text('Retro spillkonsoll'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Be om Retro spillkonsoll'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /threads/thread-1/messages']?['body'],
          'Kan jeg få Retro spillkonsoll?');
    });

    testWidgets('11. …and one more where there is something already', (tester) async {
      server.overrides['GET /trades/trade-1/candidates'] = {
        'yours': [FakeServer.drill],
        'theirs': [
          {...FakeServer.console, 'inOffer': true},
          {...FakeServer.console, 'id': 'item-sweater', 'title': 'Ullgenser M'},
        ],
        'counterparty': FakeServer.kari,
      };
      await mount(tester, const ThreadScreen(threadId: 'thread-1'));
      await openChip(tester, '♥ Jeg vil ha');

      expect(find.text('Vil du ha noe mer av Kari?'), findsOneWidget);
      await tester.tap(find.text('Ullgenser M'));
      await tester.pumpAndSettle();
      expect(find.text('Be om Ullgenser M i tillegg'), findsOneWidget);
    });
  });

  testWidgets('12. the totals on a trade page keep an amount on one line', (tester) async {
    await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));

    final cells = tester
        .widgetList<Text>(find.byType(Text))
        .where((t) => t.textSpan != null)
        .map((t) => t.textSpan!.toPlainText())
        .toList();
    expect(cells, contains('Du får verdi 1 200 kr'));
    expect(cells, contains('Du gir verdi 600 kr'));
  });
}
