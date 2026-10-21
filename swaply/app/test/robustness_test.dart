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
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/shell.dart';

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

  group('a button says its whole label', () {
    // Cut to one line, «Godta endringen» beside «Avslå» read «Godta endri…»
    // on a 320 phone at the ordinary text size, and «Marker byttet som
    // gjennomført» «Marker byttet som gjennomf…».
    final buttons = <(String, Map<String, Object?>, String, double)>[
      ('09e', {'state': 'countered', 'counterOfferBy': 'kari-1'}, 'Godta endringen', 1.0),
      ('06b', {'state': 'pending'}, 'Godta byttet', 1.3),
      ('06b', {'state': 'pending'}, 'Godta byttet', 2.0),
      ('07j', {...chainTrade(), 'state': 'accepted'}, 'Marker byttet som gjennomført', 1.0),
      ('06f', {'state': 'accepted'}, 'Marker som mottatt', 2.0),
    ];
    for (final (name, state, label, scale) in buttons) {
      testWidgets('$name: «$label» on 320×568 at ${(scale * 100).round()} %', (tester) async {
        server.overrides['GET /trades/trade-1'] = {...FakeServer.trade, ...state};
        await hold(tester, narrow, const TradeDetailScreen(tradeId: 'trade-1'), scale: scale);
        if (find.text(label).evaluate().isEmpty) {
          await tester.scrollUntilVisible(find.text(label), 200,
              scrollable: find.byType(Scrollable).first);
        }
        final words = find.text(label).last;
        await tester.ensureVisible(words);
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(tester.renderObject<RenderParagraph>(words).didExceedMaxLines, isFalse);
        // Inside its button, all of it.
        final button = tester.getRect(find
            .ancestor(of: words, matching: find.byWidgetPredicate((w) => w is ButtonStyleButton))
            .first);
        final text = tester.getRect(words);
        expect(button.contains(text.topLeft) && button.contains(text.bottomRight), isTrue,
            reason: '$text in $button');
      });
    }
  });

  group('rows that could not give way', () {
    final long = {...FakeServer.kari, 'displayName': 'Kristoffer-Alexander H.'};

    testWidgets('11: «Venter på …» stays on its card with a long name at 130 %', (tester) async {
      server.overrides['GET /trades'] = {
        'waiting': [
          {
            ...FakeServer.trade,
            'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
            'receivingFrom': {...long, 'position': 1},
            'givingTo': {...long, 'position': 1},
            'participants': [
              {...FakeServer.me, 'position': 0, 'accepted': true, 'gives': [FakeServer.drill]},
              {...long, 'position': 1, 'accepted': false, 'gives': [FakeServer.console]},
            ],
          },
        ],
        'active': const [],
        'done': const [],
        'yourTurn': 0,
      };
      await hold(tester, narrow, const TradesScreen(), scale: 1.3);

      expect(tester.takeException(), isNull);
      onScreen(tester, find.textContaining('Venter på Kristoffer'), narrow);
    });

    testWidgets('06c in a ring: «Med … og …» stays on the screen beside «Avtalen»',
        (tester) async {
      final ring = chainTrade();
      final participants = <Map<String, Object?>>[
        for (final p in (ring['participants']! as List).cast<Map<String, Object?>>())
          switch (p['id']) {
            'kari-1' => {...p, 'displayName': 'Kristoffer-Alexander H.'},
            'per-1' => {...p, 'displayName': 'Marianne-Elisabeth K.'},
            _ => p,
          },
      ];
      await hold(
          tester,
          narrow,
          AgreementScreen(
              trade: Trade.fromJson({...ring, 'participants': participants})));

      expect(tester.takeException(), isNull);
      onScreen(tester, find.textContaining('Med Kristoffer-Alexander'), narrow);
      onScreen(tester, find.text('Avtalen'), narrow);
    });

    testWidgets('06a: the names under the cards stay on the screen at 130 %', (tester) async {
      server.overrides['GET /trades/trade-1'] = {
        ...FakeServer.trade,
        'receivingFrom': {...long, 'position': 1},
        'youGive': [FakeServer.drill, {...FakeServer.drill, 'id': 'item-2', 'title': 'Hjelm'}],
      };
      await hold(tester, narrow, const MatchScreen(tradeId: 'trade-1'), scale: 1.3);

      expect(tester.takeException(), isNull);
      // Only the name gives way: the count is whole.
      expect(find.text(' · 2 ting'), findsOneWidget);
    });

    for (final (name, screen) in [
      ('10b', () => const PostItemScreen()),
      ('13b', () => const OtherProfileScreen(userId: 'kari-1')),
      ('13', () => const ProfileScreen()),
    ]) {
      testWidgets('$name at 200 % on a 320 phone', (tester) async {
        final me = {
          ...FakeServer.me,
          'items': [
            for (var i = 0; i < 4; i++)
              {...FakeServer.drill, 'id': 'item-$i', 'title': 'Elektrisk drill med to batterier'},
          ],
        };
        server.overrides['GET /me'] = me;
        server.overrides['GET /users/kari-1'] = {
          ...FakeServer.kari,
          'items': [
            for (var i = 0; i < 4; i++)
              {...FakeServer.console, 'id': 'item-$i', 'title': 'Retro spillkonsoll med kontrollere'},
          ],
          'interests': ['friluft'],
        };
        await hold(tester, narrow, screen(), scale: 2);
        final list = find.byType(Scrollable).first;
        await tester.drag(list, const Offset(0, -400));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the bar\'s labels are whole at 200 % on a 320 phone', (tester) async {
      await hold(tester, narrow, const TradesScreen(), scale: 2);

      for (final label in ['Oppdag', 'Legg ut', 'Bytter', 'Chats', 'Profil']) {
        final words = find.descendant(of: find.byType(SwaplyNavBar), matching: find.text(label));
        expect(tester.renderObject<RenderParagraph>(words).didExceedMaxLines, isFalse,
            reason: label);
      }
    });
  });

  group('words that were cut short or broken inside', () {
    /// Every word of [text] in [finder]'s paragraph is on one line.
    void whole(WidgetTester tester, Finder finder, String text) {
      final paragraph = tester.renderObject<RenderParagraph>(finder);
      final all = paragraph.text.toPlainText();
      var at = 0;
      for (final word in text.split(' ')) {
        at = all.indexOf(word, at);
        final boxes = paragraph.getBoxesForSelection(
            TextSelection(baseOffset: at, extentOffset: at + word.length));
        expect(boxes.map((b) => b.top).toSet(), hasLength(1), reason: '«$word» in «$all»');
        at += word.length;
      }
    }

    testWidgets('13: the rating line wraps rather than «… 12 vurderin…» on a 320',
        (tester) async {
      await hold(tester, narrow, const ProfileScreen());
      final line = find.descendant(
          of: find.textContaining('vurderinger'), matching: find.byType(RichText));
      expect(tester.renderObject<RenderParagraph>(line).didExceedMaxLines, isFalse);
      whole(tester, line, '12 vurderinger');
    });

    for (final (cash, scale) in [(350, 1.3), (1050, 1.0), (12500, 1.0)]) {
      testWidgets('09a: the mellomlegg $cash kr is one line at ${(scale * 100).round()} %',
          (tester) async {
        final trade = Trade.fromJson({
          ...FakeServer.trade,
          'cash': {...FakeServer.trade['cash'] as Map<String, Object?>, 'amountNok': cash},
        });
        await hold(tester, narrow, CounterOfferScreen(trade: trade), scale: scale);
        await tester.scrollUntilVisible(find.text(kr(cash)), 200,
            scrollable: find.byType(Scrollable).first);
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        final paragraph = tester.renderObject<RenderParagraph>(find.text(kr(cash)));
        final boxes = paragraph.getBoxesForSelection(
            TextSelection(baseOffset: 0, extentOffset: kr(cash).length));
        expect(boxes.map((b) => b.top).toSet(), hasLength(1));
      });
    }

    testWidgets('12: «gjenstander» under a liker is whole at 130 % on a 320', (tester) async {
      server.overrides['GET /me/liked-by'] = {
        'items': [
          {
            'item': FakeServer.drill,
            'likers': [
              {...FakeServer.kari, 'itemCount': 6, 'town': 'Bergen'},
            ],
          },
        ],
      };
      // The first thing with likes opens by itself.
      await hold(tester, narrow, const LikedScreen(), scale: 1.3);

      whole(tester, find.text('6 gjenstander · Bergen'), '6 gjenstander');
    });

    testWidgets('04: at 200 % the value goes under the name, which breaks between words',
        (tester) async {
      await hold(tester, (name: '412×915', size: const Size(412, 915), statusBar: 24),
          const ItemDetailScreen(itemId: 'item-console'),
          scale: 2);

      whole(tester, find.text('Retro spillkonsoll'), 'Retro spillkonsoll');
      expect(tester.getRect(find.text('Verdi 1\u00A0200\u00A0kr')).top,
          greaterThan(tester.getRect(find.text('Retro spillkonsoll')).bottom));
    });

    testWidgets('…and at the export\'s size it is beside the name, as drawn', (tester) async {
      await hold(tester, (name: '390×844', size: const Size(390, 844), statusBar: 46),
          const ItemDetailScreen(itemId: 'item-console'));

      final name = tester.getRect(find.text('Retro spillkonsoll'));
      final value = tester.getRect(find.text('Verdi 1\u00A0200\u00A0kr'));
      expect(value.left, greaterThan(name.left + 100));
      expect(value.top, lessThan(name.bottom));
    });
  });
}
