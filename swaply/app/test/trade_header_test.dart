// The trade page's header: its title, and the pill at its right that says
// where the trade stands.
//
// The pill was left out on 10.09 as if it were a choice — «the state is told
// by the cards and the buttons» — and the title was «Bytte med Kari» on every
// frame. Neither was decided by anybody, and the product owner had both put
// in as the export draws them (21.10.2026): «Ditt bytte» on 06e, 06f, 08b,
// 08c and 07j, «Bytte med Ola» on 06b, 09e, 09f and 09i, and a pill on all
// of them but 06b.
//
// The words are read out of `docs/round-5-screens.md` rather than written
// here again, with the export's Ola as this world's Kari. Where the export
// draws nothing — an ending that was not a decline, a conversation, a ring
// that is not yet agreed — the rule the frames follow is held instead. An
// ended trade says «Avslått» only for the code that means it: the app does
// not know who declined, nor whether anybody did.
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, String tradeId) async {
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
      child: MaterialApp(home: TradeDetailScreen(tradeId: tradeId)),
    ),
  );
  await tester.pumpAndSettle();
}

/// Every word the export puts in a trade's pill, and the colours it draws
/// each in.
const tones = {
  'Venter': PillTone.quiet,
  'Avtales i chat': PillTone.quiet,
  'Godtatt': PillTone.agreed,
  'Gjennomført': PillTone.agreed,
  'Pauset': PillTone.attention,
  'Endret': PillTone.attention,
  'Avslått': PillTone.ended,
};

/// The title [frame] draws after «‹», and the pill after it where it has
/// one, from the export's strings — with the export's Ola as Kari, who is
/// the other side here.
(String, String?) drawn(String frame) {
  final lines = File('../docs/round-5-screens.md').readAsLinesSync();
  final start = lines.indexWhere((l) => l.startsWith('### $frame '));
  if (start == -1) throw StateError('no frame $frame in the export\'s strings');
  final back = lines.indexWhere((l) => l.trim() == '‹', start);
  final next = lines[back + 2].trim();
  return (
    lines[back + 1].trim().replaceAll('Ola', 'Kari'),
    tones.containsKey(next) ? next : null,
  );
}

/// The trade with the yes of each side said: [you] for this phone's.
Map<String, Object?> pair(Map<String, Object?> more, {required bool you, bool kari = true}) => {
      ...FakeServer.trade,
      'you': {...FakeServer.trade['you']! as Map, 'accepted': you},
      'participants': [
        {...FakeServer.me, 'position': 0, 'accepted': you, 'gives': [FakeServer.drill]},
        {...FakeServer.kari, 'position': 1, 'accepted': kari, 'gives': [FakeServer.console]},
      ],
      ...more,
    };

/// The ring in [state], with this phone's yes said.
Map<String, Object?> ring(String state, {bool you = false, Map<String, Object?> more = const {}}) {
  final trade = chainTrade();
  return {
    ...trade,
    'state': state,
    'you': {...trade['you']! as Map, 'accepted': you},
    'participants': [
      for (final p in (trade['participants']! as List).cast<Map<String, Object?>>())
        p['id'] == 'me-1' ? {...p, 'accepted': you} : p,
    ],
    ...more,
  };
}

/// A question about getting out, asked by [by].
Map<String, Object?> question(String by, String state, {bool blockedBySent = false}) => {
      'id': 'w1',
      'requestedBy': by,
      'byYou': by == 'me-1',
      'state': state,
      'respondsBy': state == 'waiting'
          ? DateTime.now().add(const Duration(days: 2, hours: 14)).toIso8601String()
          : null,
      'blockedBySent': blockedBySent,
    };

/// The header says [title], and [pill] at its right in [tone] — or no pill.
void says(WidgetTester tester, String title, String? pill, [PillTone? tone]) {
  expect(find.text(title), findsOneWidget);
  if (pill == null) {
    expect(find.byType(HeaderPill), findsNothing);
    return;
  }
  final found = find.byType(HeaderPill);
  expect(found, findsOneWidget);
  expect(find.descendant(of: found, matching: find.text(pill)), findsOneWidget);
  expect(tester.widget<HeaderPill>(found).status.tone, tone ?? tones[pill]);
}

void main() {
  setUp(() async {
    // Real fonts, for 7: whether the pill fits beside the title is the question.
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('1. each frame says what the export draws on it', () {
    final frames = <(String, String, Map<String, Object?>)>[
      // Kari has said yes, and it is your turn.
      ('06b', 'trade-1', pair({}, you: false)),
      // You have said yes, and it waits on Kari.
      ('06e', 'trade-1', pair({}, you: true, kari: false)),
      ('06f', 'trade-1', pair({'state': 'accepted'}, you: true)),
      ('08b', 'trade-1', pair({'state': 'paused', 'withdrawal': question('me-1', 'waiting')}, you: true)),
      (
        '08c',
        'trade-1',
        pair({
          'state': 'accepted',
          'withdrawal': question('me-1', 'rejected', blockedBySent: true),
        }, you: true)
      ),
      // Kari proposed something else, and your yes went with the old one.
      ('09e', 'trade-1', pair({'state': 'countered', 'counterOfferBy': 'kari-1'}, you: false)),
      (
        '09f',
        'trade-1',
        pair({
          'state': 'cancelled',
          'closeCode': 'declined',
          'closeReason': 'Byttet ble avslått',
        }, you: false)
      ),
      ('09i', 'trade-1', pair({'state': 'completed', 'closedAt': '2026-09-04T10:00:00Z'}, you: true)),
      // Agreed by all three, and handed over in the chat.
      ('07j', 'trade-chain', ring('accepted', you: true)),
    ];
    for (final (frame, id, trade) in frames) {
      final (title, pill) = drawn(frame);
      testWidgets('$frame: «$title»${pill == null ? ' and no pill' : ' and «$pill»'}',
          (tester) async {
        server.overrides['GET /trades/$id'] = trade;
        await mount(tester, id);

        says(tester, title, pill);
      });
    }
  });

  group('2. an ended trade is «Avslått» only when it was declined', () {
    for (final code in [
      'blocked',
      'account_deleted',
      'listing_removed',
      'displaced',
      'withdrawn_early',
      'withdrawal_approved',
      'ended_by_admin',
      null,
    ]) {
      testWidgets('ended by ${code ?? 'no code'}: «Avsluttet»', (tester) async {
        server.overrides['GET /trades/trade-1'] =
            pair({'state': 'cancelled', 'closeCode': code}, you: true);
        await mount(tester, 'trade-1');

        says(tester, 'Bytte med Kari', 'Avsluttet', PillTone.ended);
        expect(find.text('Avslått'), findsNothing);
      });
    }

    testWidgets('a ring declined is «Avslått», and still «Ditt bytte»', (tester) async {
      server.overrides['GET /trades/trade-chain'] =
          ring('cancelled', more: {'closeCode': 'declined'});
      await mount(tester, 'trade-chain');

      says(tester, 'Ditt bytte', 'Avslått');
    });
  });

  group('3. the states the export does not draw follow the ones it does', () {
    final states = <(String, String, Map<String, Object?>, String, String?)>[
      // A conversation: nothing on the table to say yes to, as on 06b.
      ('a conversation', 'trade-1', pair({'state': 'talking'}, you: false, kari: false),
          'Bytte med Kari', null),
      // Nobody has said yes yet.
      ('an offer nobody has agreed to', 'trade-1', pair({}, you: false, kari: false),
          'Bytte med Kari', null),
      // A counter-offer of your own is your yes, and waits on Kari, as 06e.
      (
        'your own counter-offer',
        'trade-1',
        pair({'state': 'countered', 'counterOfferBy': 'me-1'}, you: true, kari: false),
        'Ditt bytte',
        'Venter'
      ),
      // …and with that yes taken back, it is your turn again, as 06b.
      (
        'your own counter-offer, the yes taken back',
        'trade-1',
        pair({'state': 'countered', 'counterOfferBy': 'me-1'}, you: false, kari: false),
        'Bytte med Kari',
        null
      ),
      // Kari's change, which you have said yes to since.
      (
        'Kari\'s change, agreed to',
        'trade-1',
        pair({'state': 'countered', 'counterOfferBy': 'kari-1'}, you: true),
        'Ditt bytte',
        'Venter'
      ),
      // 08b from the other side: Kari asks, and you answer.
      (
        'Kari asks to be let out',
        'trade-1',
        pair({'state': 'paused', 'withdrawal': question('kari-1', 'waiting')}, you: true),
        'Ditt bytte',
        'Pauset'
      ),
      ('a ring not yet agreed to by you', 'trade-chain', ring('pending'), 'Ditt bytte', null),
      ('a ring you have agreed to', 'trade-chain', ring('pending', you: true), 'Ditt bytte',
          'Venter'),
      (
        'a ring paused',
        'trade-chain',
        ring('paused', you: true, more: {'withdrawal': question('per-1', 'waiting')}),
        'Ditt bytte',
        'Pauset'
      ),
      ('a ring done', 'trade-chain', ring('completed', you: true), 'Ditt bytte', 'Gjennomført'),
    ];
    for (final (name, id, trade, title, pill) in states) {
      testWidgets('$name: «$title»${pill == null ? ' and no pill' : ' and «$pill»'}',
          (tester) async {
        server.overrides['GET /trades/$id'] = trade;
        await mount(tester, id);

        says(tester, title, pill);
      });
    }
  });

  testWidgets('4. the pill moves with the trade: «Venter» once you have said yes',
      (tester) async {
    server.overrides['GET /trades/trade-1'] = pair({}, you: false);
    await mount(tester, 'trade-1');
    says(tester, 'Bytte med Kari', null);

    // Asked for again — a pull, as after 06c — with your yes on it now.
    server.overrides['GET /trades/trade-1'] = pair({}, you: true, kari: false);
    unawaited(tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show());
    await tester.pumpAndSettle();

    says(tester, 'Ditt bytte', 'Venter');
  });

  testWidgets('5. a screen reader hears the pill as part of the heading, not as a button',
      (tester) async {
    final semantics = tester.ensureSemantics();
    server.overrides['GET /trades/trade-1'] = pair({}, you: true, kari: false);
    await mount(tester, 'trade-1');

    final heading = find.bySemanticsLabel('Ditt bytte\nVenter');
    expect(heading, findsOneWidget);
    expect(
        tester.getSemantics(heading),
        isSemantics(
            label: 'Ditt bytte\nVenter', isHeader: true, isButton: false, hasTapAction: false));
    // Not a word of its own beside the title.
    expect(find.bySemanticsLabel('Venter'), findsNothing);
    semantics.dispose();
  });

  testWidgets('6. …and a title without one is the heading alone', (tester) async {
    final semantics = tester.ensureSemantics();
    server.overrides['GET /trades/trade-1'] = pair({}, you: false);
    await mount(tester, 'trade-1');

    expect(tester.getSemantics(find.bySemanticsLabel('Bytte med Kari')),
        isSemantics(label: 'Bytte med Kari', isHeader: true, isButton: false));
    semantics.dispose();
  });

  testWidgets('7. on 06e at 390, the pill is where the export puts it', (tester) async {
    holdPhone(tester);
    tester.view.padding = const FakeViewPadding(top: exportStatusBar * 3);
    server.overrides['GET /trades/trade-1'] = pair({}, you: true, kari: false);
    await session.login('ola@epost.no', 'passord');
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<SwaplyApi>.value(value: api),
          ChangeNotifierProvider<Session>.value(value: session),
        ],
        child: MaterialApp(theme: phoneTheme(), home: const TradeDetailScreen(tradeId: 'trade-1')),
      ),
    );
    await tester.pumpAndSettle();

    // Blueprint 06e, less the 28 over the phone: «Ditt bytte» at 41,52 and
    // 25 tall, «Venter» at 305,53, 63×23, against the right margin of 22.
    final title = tester.getRect(find.text('Ditt bytte'));
    final pill = tester.getRect(find.byType(HeaderPill));
    expect(title.left, 41);
    expect(title.top, 52);
    expect(pill.right, 368);
    expect(pill.height, closeTo(23, 0.5));
    expect(pill.center.dy, closeTo(title.center.dy, 0.5));
    // One line, whole.
    final words = find.descendant(of: find.byType(HeaderPill), matching: find.byType(RichText));
    expect(tester.renderObject<RenderParagraph>(words).didExceedMaxLines, isFalse);
  });
}
