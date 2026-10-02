// Every screen, held to a finger.
//
// The rule: everything on a screen that answers a tap answers across at least
// 44×44 points (`kTapTarget`, Apple's minimum) and is named for a screen
// reader; it answers across the whole of the area it tells a screen reader it
// has; and no two targets claim the same point, so a tap cannot land on the
// neighbour. The export draws plenty of controls smaller than that, and they
// stay exactly as drawn — the goldens are the proof — so what these tests hold
// is the area around the ink, not the ink.
//
// Each screen is opened twice, in the export's world at the export's size: on
// a phone, under the export's 46-point status bar, and in a browser, which has
// no status bar and is where a header target has the least room. Flutter's own
// guidelines run first; then every target is measured on screen, touched at
// its corners, edges and middle through the real hit test, and laid against
// every other target. The few the export draws closer to a neighbour than a
// finger are listed in [_drawnTighter], each held to all the room it has.
//
// Where one target sits on another — the heart on a card, the ✕ on a photo —
// or reaches past its own slot — «‹» into the top of the page, «Innstillinger»
// into the status bar — or shares a gap with the next — 05's chips — the first
// group says in so many touches which of the two a finger gets: a tap, a
// second tap while the page is going, a drag.
// A few screens are opened scrolled as well, with things half under the
// header or the status bar.
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/screens/admin.dart';
import 'package:swaply_app/screens/agreement.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/counter_offer.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/notifications.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/review.dart';
import 'package:swaply_app/screens/tabs.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/screens/trades_list.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';
import 'package:swaply_app/widgets/admin_chrome.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'export_fixtures.dart' as fx;
import 'fake_server.dart';
import 'phone.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// Where a screen is looked at: under the export's status bar, or in a
/// browser, which has none.
enum _Frame {
  phone(exportStatusBar),
  browser(0);

  const _Frame(this.statusBar);
  final double statusBar;
}

/// One screen, or one sheet over one, as a person reaches it.
class _Screen {
  const _Screen(this.name, this.build,
      {this.signedIn = true, this.pushed = false, this.before, this.act});

  final String name;
  final Widget Function() build;
  final bool signedIn;

  /// Opened from somewhere, so it has somewhere to go back to — 16c draws its
  /// «‹» only then.
  final bool pushed;

  /// Before it is opened: the server's answers for the state it is in.
  final Future<void> Function()? before;

  /// After it is up: what opens the sheet, or puts the screen in its state.
  final Future<void> Function(WidgetTester tester)? act;
}

/// Opens [screen] at the export's size in [frame], with semantics on.
Future<SemanticsHandle> _open(WidgetTester tester, _Screen screen, _Frame frame) async {
  holdPhone(tester);
  await precachePhotos(tester);
  await screen.before?.call();
  if (screen.signedIn) await session.login('ola@epost.no', 'passord');
  final semantics = tester.ensureSemantics();

  final built = screen.build();
  await tester.pumpWidget(MultiProvider(
    providers: [
      Provider<SwaplyApi>.value(value: api),
      ChangeNotifierProvider<Session>.value(value: session),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: phoneTheme(),
      // The app's own floor, which draws nothing unless the tool has made
      // you somebody else.
      builder: (context, child) => PhoneFrame(
          light: false, statusBar: frame.statusBar, child: AdminFloor(child: child!)),
      home: screen.pushed ? _PushesOnce(built) : built,
      // A screen that finishes by going to a tab goes somewhere named.
      onGenerateRoute: (settings) =>
          MaterialPageRoute(settings: settings, builder: (_) => const Scaffold()),
    ),
  ));
  await tester.pumpAndSettle();
  if (screen.act != null) {
    await screen.act!(tester);
    await tester.pumpAndSettle();
  }
  return semantics;
}

/// A first screen that opens [screen] over itself, so it has a way back.
class _PushesOnce extends StatefulWidget {
  const _PushesOnce(this.screen);
  final Widget screen;

  @override
  State<_PushesOnce> createState() => _PushesOnceState();
}

class _PushesOnceState extends State<_PushesOnce> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => widget.screen)));
  }

  @override
  Widget build(BuildContext context) => const Scaffold();
}

/// A target as the screen reader has it: its node, and where it is on screen
/// in logical points.
class _Target {
  _Target(this.node, this.rect, {required this.scrolledPart, this.owner});

  final SemanticsNode node;
  final Rect rect;

  /// The render object the node belongs to, where one could be found.
  final RenderObject? owner;

  /// Cut by the edge of a scroll view: only part of it is on screen, and the
  /// part that is says nothing about its size.
  final bool scrolledPart;

  String get name {
    final data = node.getSemanticsData();
    final label = data.label.isNotEmpty ? data.label : data.tooltip;
    return '«${label.isEmpty ? '(no label)' : label.replaceAll('\n', ' ')}» at '
        '${rect.left.toStringAsFixed(1)},${rect.top.toStringAsFixed(1)} '
        '${rect.width.toStringAsFixed(1)}×${rect.height.toStringAsFixed(1)}';
  }

  bool contains(_Target other) {
    for (SemanticsNode? n = other.node.parent; n != null; n = n.parent) {
      if (identical(n, node)) return true;
    }
    return false;
  }
}

/// Every node on screen that answers a tap or a long press.
List<_Target> _targets(WidgetTester tester) {
  final ratio = tester.view.devicePixelRatio;
  final screen = Offset.zero & (tester.view.physicalSize / ratio);
  final found = <_Target>[];

  // Which render object each node belongs to, for the size it has before a
  // scroll view or the edge of the screen cuts it.
  final owners = <SemanticsNode, RenderObject>{};
  void own(RenderObject o) {
    final node = o.debugSemantics;
    if (node != null) owners.putIfAbsent(node, () => o);
    o.visitChildren(own);
  }

  for (final view in tester.binding.renderViews) {
    own(view);
  }

  void visit(SemanticsNode node) {
    node.visitChildren((child) {
      visit(child);
      return true;
    });
    if (node.isMergedIntoParent) return;
    final data = node.getSemanticsData();
    if (!data.hasAction(SemanticsAction.tap) && !data.hasAction(SemanticsAction.longPress)) {
      return;
    }
    if (data.flagsCollection.isHidden) return;
    // The dimming behind a sheet answers everywhere the sheet is not, and is
    // not a target anyone aims at.
    if (_dimming.contains(data.label)) return;

    // Up to the root, as Flutter's own guideline measures it.
    var rect = node.rect;
    for (SemanticsNode? n = node; n != null; n = n.parent) {
      final transform = n.transform;
      if (transform != null) rect = MatrixUtils.transformRect(transform, rect);
    }
    rect = Rect.fromLTRB(rect.left / ratio, rect.top / ratio, rect.right / ratio, rect.bottom / ratio);
    final onScreen = rect.intersect(screen);
    if (onScreen.width <= 0 || onScreen.height <= 0) return;
    // A node's rectangle is cut where a scroll view clips it. Flutter's own
    // guideline guesses at that from a node touching the edge of a list, which
    // passes over the first thing in every list — and on 13 the first thing
    // in the list is «Innstillinger». The whole box says it exactly.
    final whole = owners[node]?.semanticBounds.size;
    final cut = whole != null &&
        (node.rect.width < whole.width - 0.5 || node.rect.height < whole.height - 0.5);
    found.add(_Target(node, onScreen, scrolledPart: cut, owner: owners[node]));
  }

  for (final view in tester.binding.renderViews) {
    visit(view.owner!.semanticsOwner!.rootSemanticsNode!);
  }
  return found;
}

/// What the dimming behind a sheet or a dialog calls itself: in English, as a
/// screen mounted on its own speaks, and in Norwegian, as the app does.
const _dimming = {'Scrim', 'Dismiss', 'Vev', 'Avvis'};

/// The target a real touch at [position] reaches: the deepest listener the hit
/// test finds, and the node it answers as — or null, when that node answers
/// no tap and the touch reached nothing that does.
SemanticsNode? _reached(WidgetTester tester, Offset position) {
  final result = HitTestResult();
  tester.binding.hitTestInView(result, position, tester.view.viewId);
  for (final entry in result.path) {
    if (entry.target is! RenderPointerListener) continue;
    RenderObject? owner = entry.target as RenderObject;
    while (owner != null && owner.debugSemantics == null) {
      owner = owner.parent;
    }
    var node = owner?.debugSemantics;
    while (node != null && node.isMergedIntoParent) {
      node = node.parent;
    }
    final data = node?.getSemanticsData();
    final taps = data != null &&
        (data.hasAction(SemanticsAction.tap) || data.hasAction(SemanticsAction.longPress));
    return taps ? node : null;
  }
  return null;
}

/// Where the export leaves less than a finger between one target and the
/// next, the target takes all the room there is and no more: taking more
/// would be taking it from the neighbour, and a tap landing on the wrong one
/// is worse than a small target. Each is held here to exactly what it has,
/// by screen and name, so a change that takes any of it away still fails.
const _drawnTighter = <String, Size>{
  // 10 under the password field, 16 over «Logg inn».
  '16c at the gate|Glemt passord?': Size(115, 41),
  '16c opened|Glemt passord?': Size(115, 41),
  // 8 under «Send motbytte», 12 to the foot of the screen.
  '09a|Avbryt': Size(63, 40),
  // A browser has no status bar, and the first notification starts right
  // under the header: «‹» has the header's 31 and the row keeps its own.
  'in a browser 12a|Tilbake': Size(48, 31),
  // The tool, not the product. Its floor is 34 tall with a 3-point edge on
  // top, over the tab bar; its chips are 33 tall in rows 8 apart.
  '13 as a test account|Logg ut ↩': Size(80, 31),
  'admin|Godtatt': Size(69, 41),
  'admin|Overlevering': Size(100, 41),
  'admin|Pauset — noen vil trekke seg': Size(193, 41),
  'admin|Avslått': Size(67, 41),
  'admin|Fortrengt av et annet bytte': Size(181, 41),
};

/// What the export allows [target] on [screen], in [frame].
Size _allowed(String screen, _Frame frame, _Target target) {
  final label = target.node.getSemanticsData().label;
  return _drawnTighter['in a ${frame.name} $screen|$label'] ??
      _drawnTighter['$screen|$label'] ??
      const Size(kTapTarget, kTapTarget);
}

/// What is wrong with the targets on screen, one line each.
List<String> _faults(WidgetTester tester, String screen, _Frame frame) {
  final targets = _targets(tester);
  final faults = <String>[];

  // A header target reaches from the top of the screen down past the header,
  // over the top of the page — but only where the page has nothing of its
  // own (see `TapArea.above`). Where it does, the page's target is the one
  // under the finger, and the header's ends where it begins.
  bool fromTheTop(_Target t) => t.rect.top <= 0.01;
  bool givesWay(_Target a, _Target b) =>
      fromTheTop(a) && !fromTheTop(b) && b.rect.top > a.rect.top && a.rect.overlaps(b.rect);

  for (final target in targets) {
    if (target.scrolledPart) continue;
    var r = target.rect;
    for (final other in targets) {
      if (givesWay(target, other)) {
        r = Rect.fromLTRB(r.left, r.top, r.right, math.min(r.bottom, other.rect.top));
      }
    }
    final allowed = _allowed(screen, frame, target);
    if (r.width < allowed.width - 0.01 || r.height < allowed.height - 0.01) {
      faults.add('${target.name}: ${r.width.toStringAsFixed(1)}×'
          '${r.height.toStringAsFixed(1)} is smaller than '
          '${allowed.width.toStringAsFixed(0)}×${allowed.height.toStringAsFixed(0)}');
    }
    // The middle of each edge a point inside, and the centre. The corners
    // from further in: a pill or a circle is drawn that shape to the touch as
    // well, and its corners were never the target's.
    final edge = r.deflate(1);
    final corner = r.deflate(1 + 0.15 * r.shortestSide);
    for (final point in [
      edge.topCenter, edge.centerLeft, r.center, edge.centerRight, edge.bottomCenter,
      corner.topLeft, corner.topRight, corner.bottomLeft, corner.bottomRight,
    ]) {
      final reached = _reached(tester, point);
      final ok = reached != null &&
          (identical(reached, target.node) ||
              targets.any((t) => identical(t.node, reached) && target.contains(t)) ||
              _below(reached, target.node));
      if (!ok) {
        faults.add('${target.name}: a touch at ${point.dx.toStringAsFixed(1)},'
            '${point.dy.toStringAsFixed(1)} goes to '
            '${reached == null ? 'nothing that answers a tap' : _describe(reached)}');
      }
    }
  }

  for (var i = 0; i < targets.length; i++) {
    for (var j = i + 1; j < targets.length; j++) {
      final a = targets[i], b = targets[j];
      if (a.contains(b) || b.contains(a) || givesWay(a, b) || givesWay(b, a)) continue;
      final both = a.rect.intersect(b.rect);
      if (both.width > 0.01 && both.height > 0.01) {
        faults.add('${a.name} and ${b.name} overlap');
      }
    }
  }
  return faults;
}

/// Whether [target] is in a list — anything built in a scroll view — which
/// is the list's content and not the screen's foot. A toast lifted over a
/// foot may lie over the last of it, as it lies over the grid above the bar.
bool _inAList(_Target target) {
  for (RenderObject? o = target.owner?.parent; o != null; o = o.parent) {
    if (o is RenderAbstractViewport) return true;
  }
  return false;
}

/// Whether [target] is the toast's own: «Angre».
bool _inTheToast(_Target target) {
  for (RenderObject? o = target.owner; o != null; o = o.parent) {
    final creator = o.debugCreator;
    if (creator is DebugCreator && creator.element.widget is SwaplyToast) return true;
  }
  return false;
}

bool _below(SemanticsNode node, SemanticsNode ancestor) {
  for (SemanticsNode? n = node.parent; n != null; n = n.parent) {
    if (identical(n, ancestor)) return true;
  }
  return false;
}

/// Three pages deep in [frame]: a first one, then «Side B» and «Side C» over
/// it, each with the app's header and its [body] under it.
Future<GlobalKey<NavigatorState>> _threeDeep(
    WidgetTester tester, _Frame frame, Widget Function(String page) body) async {
  holdPhone(tester);
  final navigator = GlobalKey<NavigatorState>();
  await tester.pumpWidget(MaterialApp(
    navigatorKey: navigator,
    debugShowCheckedModeBanner: false,
    theme: phoneTheme(),
    builder: (context, child) =>
        PhoneFrame(light: false, statusBar: frame.statusBar, child: child!),
    home: const Scaffold(body: Center(child: Text('Først'))),
  ));
  for (final page in ['Side B', 'Side C']) {
    navigator.currentState!.push(MaterialPageRoute<void>(
        builder: (context) => Scaffold(appBar: swaplyAppBar(context, page), body: body(page))));
    await tester.pumpAndSettle();
  }
  return navigator;
}

String _describe(SemanticsNode node) {
  final data = node.getSemanticsData();
  final label = data.label.isNotEmpty ? data.label : data.tooltip;
  return label.isEmpty ? 'a node with no name (#${node.id})' : '«${label.replaceAll('\n', ' ')}»';
}

/// Flutter's own guideline for Apple's 44, minus the few [_drawnTighter]
/// holds to less.
class _IosTapTargets extends MinimumTapTargetGuideline {
  const _IosTapTargets(this.screen, this.frame)
      : super(size: const Size(kTapTarget, kTapTarget), link: '');

  final String screen;
  final _Frame frame;

  @override
  bool shouldSkipNode(SemanticsNode node) {
    final label = node.getSemanticsData().label;
    return super.shouldSkipNode(node) ||
        _drawnTighter.containsKey('in a ${frame.name} $screen|$label') ||
        _drawnTighter.containsKey('$screen|$label');
  }
}

/// Flutter's own two guidelines and ours, on whatever is on screen, all said
/// at once.
Future<void> _holdsFingers(WidgetTester tester, String screen, _Frame frame) async {
  final faults = <String>[
    for (final guideline in [_IosTapTargets(screen, frame), labeledTapTargetGuideline])
      if (await guideline.evaluate(tester) case final e when !e.passed) e.reason!,
    ..._faults(tester, screen, frame),
  ];
  expect(faults, isEmpty, reason: faults.join('\n'));
}

Trade _trade([Map<String, Object?>? json]) => Trade.fromJson(json ?? fx.exportTrade1());

var _picked = 0;
Future<PickedPhoto?> _pick() async {
  final file = ['bike-white.jpg', 'drill.jpg'][_picked++ % 2];
  return PickedPhoto(File('test/photos/$file').readAsBytesSync(), file);
}

/// Two pictures in 10b's strip, each with its ✕.
Future<void> _twoPhotos(WidgetTester tester) async {
  for (var i = 0; i < 2; i++) {
    await tester.tap(find.text('Legg til bilder'));
    await tester.pumpAndSettle();
  }
  await tester.runAsync(() async {
    for (final element in find.byType(Image).evaluate()) {
      await precacheImage((element.widget as Image).image, element);
    }
  });
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

/// The trade on the fake server in [state], with [more] on top.
Future<void> Function() _tradeIn(String state, [Map<String, Object?> more = const {}]) =>
    () async => server.overrides['GET /trades/trade-1'] = {
          ...FakeServer.trade,
          'state': state,
          ...more,
        };

/// The screen's main list scrolled [by] points, so what was under the header
/// or the status bar is there, half out of sight.
Future<void> Function(WidgetTester) _scrolled(double by) => (tester) async {
      final lists = find.byWidgetPredicate(
          (w) => w is Scrollable && w.axisDirection == AxisDirection.down);
      tester.state<ScrollableState>(lists.first).position.jumpTo(by);
      await tester.pump();
    };

final _screens = <_Screen>[
  // 01 · 02 · the invitation · 16c · 10c
  _Screen('01 no answer', () => SplashScreen(onRetry: () {}), signedIn: false),
  _Screen('02 interests', () => const InterestsScreen()),
  _Screen('invitation', () => const InviteScreen(token: FakeServer.shareToken),
      signedIn: false),
  _Screen('16c at the gate', () => const LoginScreen(), signedIn: false),
  _Screen('16c opened', () => const LoginScreen(), signedIn: false, pushed: true),
  _Screen('16c forgotten password', () => const LoginScreen(),
      signedIn: false, pushed: true, act: (t) => _tap(t, find.text('Glemt passord?'))),
  _Screen('10c', () => const CreateProfileScreen(continuingToListing: true),
      signedIn: false, pushed: true),

  // 05 · 05b · 04 · 10a
  _Screen('05 collage', () => const DiscoverScreen()),
  _Screen('05 results', () => const DiscoverScreen(), act: (t) async {
    await t.enterText(find.byType(TextField).first, 'sykkel');
    await t.testTextInput.receiveAction(TextInputAction.search);
  }),
  _Screen('05 long press', () => const DiscoverScreen(),
      act: (t) => t.longPress(find.text('Terrengsykkel 26"'))),
  // Not awaited: the sheet's future is its closing.
  _Screen('10a', () => const DiscoverScreen(), act: (t) async {
    showListingPrompt(t.element(find.byType(DiscoverScreen)), 5);
  }),
  _Screen('05 scrolled', () => const DiscoverScreen(), act: _scrolled(120)),
  _Screen(
      '05b',
      () => const AdvancedSearchScreen(
          initial: SearchFilters(
              category: 'sykling', subcategory: 'Sykler', minValue: 500, condition: 'new'),
          query: 'sykkel')),
  _Screen('04 theirs', () => const ItemDetailScreen(itemId: 'item-console')),
  _Screen('04 a message sent', () => const ItemDetailScreen(itemId: 'item-console'),
      act: (t) async {
    await t.enterText(find.byType(TextField), 'Hei!');
    await _tap(t, find.text('Send'));
    await t.pumpAndSettle();
    // The caret's handle lies over the field while it has the focus.
    FocusManager.instance.primaryFocus?.unfocus();
  }),
  _Screen('04 yours', () => const ItemDetailScreen(itemId: 'item-drill')),
  _Screen('04 share', () => const ItemDetailScreen(itemId: 'item-console'),
      before: () async => server.overrides['POST /items/item-console/share'] = {
            'token': FakeServer.shareToken,
            'url': 'http://web/i/${FakeServer.shareToken}',
            'text': 'Se denne på Swaply. http://web/i/${FakeServer.shareToken}',
          },
      act: (t) => t.tap(find.byIcon(Icons.ios_share))),
  _Screen('04 yours, «⋯»', () => const ItemDetailScreen(itemId: 'item-drill'),
      act: (t) => t.tap(find.byIcon(Icons.more_horiz))),
  _Screen('04 yours, removing', () => const ItemDetailScreen(itemId: 'item-drill'),
      act: (t) async {
    await t.tap(find.byIcon(Icons.more_horiz));
    await t.pumpAndSettle();
    await t.tap(find.text('Fjern annonsen'));
  }),
  _Screen('16a report', () => const ItemDetailScreen(itemId: 'item-console'),
      act: (t) => t.tap(find.byIcon(Icons.more_horiz))),

  // 10b
  _Screen('10b a stranger', () => PostItemScreen(pickImage: _pick),
      signedIn: false, act: _twoPhotos),
  _Screen('10b with a profile', () => PostItemScreen(pickImage: _pick), act: _twoPhotos),

  // 06 · 07 · 08 · 09, the trade in its states
  _Screen('06a', () => const MatchScreen(tradeId: 'trade-1')),
  _Screen('07i', () => const MatchScreen(tradeId: 'trade-chain'),
      before: () async => server.overrides['GET /trades/trade-chain'] = chainTrade()),
  _Screen('06b', () => const TradeDetailScreen(tradeId: 'trade-1')),
  _Screen('06b scrolled', () => const TradeDetailScreen(tradeId: 'trade-1'),
      act: _scrolled(120)),
  _Screen('06b declining', () => const TradeDetailScreen(tradeId: 'trade-1'),
      act: (t) => _tap(t, find.text('Avslå'))),
  _Screen('06e', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('pending', {
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      })),
  _Screen('08a withdrawing', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('pending', {
        'you': {...FakeServer.trade['you'] as Map, 'accepted': true},
      }),
      act: (t) => _tap(t, find.text('Trekk deg fra byttet'))),
  _Screen('half-filled', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('talking', {'youGet': const []})),
  _Screen('06f', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('accepted')),
  _Screen('09e', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('countered', {'counterOfferBy': 'kari-1'})),
  _Screen('09f', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('cancelled', {'closeReason': 'Tingene dine er tilgjengelige igjen.'})),
  _Screen('09i', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('completed', {
        'closedAt': '2026-09-04T12:00:00Z',
        'you': {
          ...FakeServer.trade['you'] as Map,
          'accepted': true,
          'sentAt': '2026-09-03T12:00:00Z',
          'receivedAt': '2026-09-04T12:00:00Z',
        },
        'yourReview': {'score': 5, 'comment': 'Rask og hyggelig'},
      })),
  _Screen('08b', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('paused', {
        'withdrawal': {
          'id': 'w1',
          'byYou': false,
          'state': 'waiting',
          'respondsBy': DateTime(2026, 9, 13).toIso8601String(),
          'blockedBySent': false,
        },
      })),
  _Screen('08c', () => const TradeDetailScreen(tradeId: 'trade-1'),
      before: _tradeIn('accepted', {
        'withdrawal': {
          'id': 'w1',
          'byYou': true,
          'state': 'rejected',
          'respondsBy': null,
          'blockedBySent': true,
        },
      })),
  _Screen('07j', () => const TradeDetailScreen(tradeId: 'trade-chain')),
  _Screen('06c', () => AgreementScreen(trade: _trade())),
  _Screen('06c ticked', () => AgreementScreen(trade: _trade()),
      act: (t) => _tap(t, find.text('Jeg har lest og godtar vilkårene'))),
  _Screen('09a', () => CounterOfferScreen(trade: _trade())),

  // 06g · 07k · 11a · 09c · 09c2 · 09d
  _Screen('06g', () => const ThreadScreen(threadId: 'thread-1')),
  _Screen('07k', () => const ThreadScreen(threadId: 'thread-1'), before: () async {
    server.overrides['GET /threads/thread-1'] = {
      ...FakeServer.thread,
      'kind': 'chain',
      'banner': 'Swaply fasiliterer ikke dette byttet.',
      'participants': [
        {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
        {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
        {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
      ],
    };
    server.overrides['GET /trades/trade-1'] = chainTrade();
  }),
  for (final (name, chip) in [
    ('09c', 'Foreslå ting'),
    ('09c2', '♥ Jeg vil ha'),
    ('09d', 'Foreslå mellomlegg'),
  ])
    _Screen(name, () => const ThreadScreen(threadId: 'thread-1'),
        act: (t) => _tap(t, find.text(chip))),
  _Screen('11a', () => const ChatsScreen()),

  // 11 · 17a · 12 · 17b · 12a
  _Screen('11', () => const TradesScreen()),
  _Screen('17a', () => const TradesScreen(),
      before: () async => server.overrides['GET /trades'] = {
            'waiting': const [],
            'active': const [],
            'done': const [],
            'yourTurn': 0,
          }),
  _Screen('12', () => const LikedScreen()),
  _Screen('17b', () => const LikedScreen(),
      before: () async => server.overrides['GET /me/liked-by'] = {'items': const []}),
  _Screen('12a', () => const NotificationsScreen()),

  // 13 · 17c · 13b · 16a · 16b
  _Screen('13', () => const ProfileScreen()),
  // «Innstillinger» half under the status bar, and a phone's corner answers
  // only while a touch on the words would.
  _Screen('13 scrolled', () => const ProfileScreen(), act: _scrolled(8)),
  _Screen('13 scrolled further', () => const ProfileScreen(), act: _scrolled(120)),
  _Screen('17c', () => const ProfileScreen(), before: () async {
    final nothing = {...fx.me, 'items': const []};
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': nothing};
    server.overrides['GET /me'] = nothing;
  }),
  _Screen('13 looking around', () => const ProfileScreen(), signedIn: false,
      before: () async {
    await session.lookAround();
    server.overrides['GET /me'] = FakeServer.lookingAround;
  }),
  _Screen('13b', () => const OtherProfileScreen(userId: 'kari-1')),
  _Screen('13b blocked, «⋯»', () => const OtherProfileScreen(userId: 'kari-1'),
      before: () async => server.overrides['GET /users/kari-1'] = {
            ...FakeServer.kari,
            'items': const [],
            'interests': const [],
            'blockedByYou': true,
          },
      act: (t) => t.tap(find.byIcon(Icons.more_horiz))),
  _Screen('16a from 13b', () => const OtherProfileScreen(userId: 'kari-1'),
      act: (t) => t.tap(find.byIcon(Icons.more_horiz))),
  _Screen('16b', () => const SettingsScreen()),
  _Screen('16b invitation', () => const SettingsScreen(),
      act: (t) => _tap(t, find.text('Inviter en venn'))),
  _Screen('16b legal', () => const SettingsScreen(),
      act: (t) => _tap(t, find.text('Juridisk og personvern'))),
  _Screen('16b deleting the account', () => const SettingsScreen(), act: (t) async {
    await _tap(t, find.text('Juridisk og personvern'));
    await t.pumpAndSettle();
    await _tap(t, find.text('Slett kontoen'));
  }),
  _Screen('16b with something hidden', () => const SettingsScreen(), before: () async {
    final hiding = {...fx.me, 'hiddenCount': 2};
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': hiding};
    server.overrides['GET /me'] = hiding;
  }),
  _Screen('16b BankID', () => const SettingsScreen(), before: () async {
    final unverified = {...fx.me, 'bankidVerified': false};
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': unverified};
    server.overrides['GET /me'] = unverified;
  }, act: (t) => _tap(t, find.text('BankID-verifisering'))),
  _Screen('16b as admin', () => const SettingsScreen(), before: () async {
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.admin};
    server.overrides['GET /me'] = FakeServer.admin;
  }),
  _Screen('Rediger profil', () => const EditProfileScreen()),

  // 06h · 07l · 06i · 09h
  _Screen('06h', () => ReviewScreen(trade: _trade())),
  _Screen('07l', () => ReviewScreen(trade: _trade(chainTrade()))),
  _Screen('06i', () => AppFeedbackScreen(trade: _trade())),
  _Screen('09h', () => TradeCompletedScreen(trade: _trade())),

  // Testverktøy, and the floor it draws under every screen while you are
  // somebody else.
  _Screen('admin', () => const AdminScreen(), before: () async {
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.admin};
    server.overrides['GET /me'] = FakeServer.admin;
  }),
  // The tool's two sheets: what to reset on an account, and which test
  // account wants your thing.
  _Screen('admin, «Nullstill eller slett»', () => const AdminScreen(), before: () async {
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.admin};
    server.overrides['GET /me'] = FakeServer.admin;
  }, act: (t) => _tap(t, find.byTooltip('Nullstill eller slett'))),
  _Screen('04 as admin, «Velg konto»', () => const ItemDetailScreen(itemId: 'item-drill'),
      before: () async {
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.admin};
    server.overrides['GET /me'] = FakeServer.admin;
  }, act: (t) => _tap(t, find.text('Velg konto'))),
  _Screen('13 as a test account', () => const ProfileScreen(), before: () async {
    server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.actingAsTest};
    server.overrides['GET /me'] = FakeServer.actingAsTest;
  }),
];

void main() {
  setUp(() async {
    // A Thursday afternoon, as the goldens have it.
    now = () => DateTime(2026, 9, 10, 14, 30);
    addTearDown(() => now = DateTime.now);
    await loadFonts();
    SharedPreferences.setMockInitialValues({});
    _picked = 0;
    server = FakeServer(export: true);
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('where one target sits on another, or beside the page', () {
    Future<SemanticsHandle> openOne(WidgetTester tester, Widget screen,
            {_Frame frame = _Frame.phone, bool pushed = false, bool signedIn = true,
            Future<void> Function(WidgetTester)? act}) =>
        _open(tester, _Screen('', () => screen, pushed: pushed, signedIn: signedIn, act: act),
            frame);

    testWidgets('the heart takes the corner of the picture, and the card keeps the rest',
        (tester) async {
      final semantics = await openOne(tester, const DiscoverScreen());
      final card = find.byType(ItemCard).first;
      final heart = tester.getRect(
          find.descendant(of: card, matching: find.bySemanticsLabel('Jeg vil ha')));
      final picture =
          tester.getRect(find.descendant(of: card, matching: find.byType(ClipRRect)).first);

      expect(heart.size, const Size(kTapTarget, kTapTarget));
      for (final corner in [heart.topLeft, heart.topRight, heart.bottomLeft, heart.bottomRight]) {
        expect(picture.inflate(0.01).contains(corner), isTrue, reason: '$heart in $picture');
      }
      // Off the drawn circle but in its area, the corner of the square: the
      // heart. The picture's middle: the card.
      await tester.tapAt(heart.bottomLeft + const Offset(2, -2));
      await tester.pumpAndSettle();
      expect(server.requests.where((r) => r.endsWith('/like')), hasLength(1));
      await tester.tapAt(picture.center);
      await tester.pumpAndSettle();
      expect(find.byType(ItemDetailScreen), findsOneWidget);
      semantics.dispose();
    });

    for (final frame in _Frame.values) {
      testWidgets('in a ${frame.name}, a tap between two of 05\'s chips is the nearer one\'s',
          (tester) async {
        // The row scrolls sideways, so it is no [TapRoom]: each chip carries
        // half of the 7 either side of it. With the whole gap on one side, a
        // finger 1.5 from «Klær» would pick «Gaming», 5.5 away.
        final semantics = await openOne(tester, const DiscoverScreen(), frame: frame);
        final chips = find.descendant(
            of: find.byWidgetPredicate(
                (w) => w is ListView && w.scrollDirection == Axis.horizontal),
            matching: find.byType(Pill));
        // Where each is drawn, once: a tap rebuilds them, and the row stays put.
        final ink = {
          for (final chip in tester.widgetList<Pill>(chips))
            chip.label: tester.getRect(find.byWidget(chip)),
        };
        String? selected() =>
            tester.widgetList<Pill>(chips).where((c) => c.selected).map((c) => c.label).singleOrNull;

        // Every pair wholly on screen, from «Alt | Gaming» along.
        final shown = [
          for (final MapEntry(key: label, value: rect) in ink.entries)
            if (rect.right <= phoneSize.width) (label, rect),
        ]..sort((a, b) => a.$2.left.compareTo(b.$2.left));
        expect(shown.take(3).map((c) => c.$1), ['Alt', 'Gaming', 'Klær']);
        var pairs = 0;
        for (var i = 0; i + 1 < shown.length; i++) {
          final ((left, a), (right, b)) = (shown[i], shown[i + 1]);
          expect(b.left - a.right, closeTo(7, 0.01), reason: '$left | $right');
          pairs++;
          for (final (x, want, other) in [(a.right + 1.5, left, b), (b.left - 1.5, right, a)]) {
            // Away from the one it should pick, so the tap has something to
            // change.
            if (selected() == want) {
              await tester.tapAt(other.center);
              await tester.pumpAndSettle();
            }
            await tester.tapAt(Offset(x, a.center.dy));
            await tester.pumpAndSettle();
            expect(selected(), want, reason: 'a tap at $x, between «$left» and «$right»');
          }
        }
        expect(pairs, greaterThanOrEqualTo(4));
        semantics.dispose();
      });
    }

    testWidgets('a photo\'s ✕ takes the corner of its own tile and nothing of the next',
        (tester) async {
      final semantics = await openOne(tester, PostItemScreen(pickImage: _pick),
          signedIn: false, act: _twoPhotos);
      final crosses = find.bySemanticsLabel('Fjern bildet');
      expect(crosses, findsNWidgets(2));
      final first = tester.getRect(crosses.first);
      final second = tester.getRect(crosses.last);
      final add = tester.getRect(find.ancestor(
          of: find.text('Legg til bilder'), matching: find.byType(Container)).first);

      expect(first.size, const Size(kTapTarget, kTapTarget));
      // In its tile's corner: the tiles are 106 square and 8 apart, so the
      // next ✕'s area starts 106 + 8 - 44 after this one ends.
      expect(second.left - first.right, closeTo(106 + 8 - kTapTarget, 0.01));
      expect(first.overlaps(add), isFalse);

      // The far corner of the area, well off the drawn ✕.
      await tester.tapAt(first.bottomLeft + const Offset(2, -2));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Fjern bildet'), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('below the header «‹» answers only where the page has nothing of its own',
        (tester) async {
      // 05b: under the header is the list's empty top, and a finger there is
      // on «‹» — in a browser, where the header itself is only 31 tall.
      var semantics = await openOne(
          tester,
          const AdvancedSearchScreen(initial: SearchFilters(), query: ''),
          frame: _Frame.browser,
          pushed: true);
      expect(find.byType(AdvancedSearchScreen), findsOneWidget);
      await tester.tapAt(const Offset(20, 40));
      await tester.pumpAndSettle();
      expect(find.byType(AdvancedSearchScreen), findsNothing);
      semantics.dispose();

      // 12a: under the header is the first notification, and it keeps its
      // taps.
      semantics = await openOne(tester, const NotificationsScreen(),
          frame: _Frame.browser, pushed: true);
      await tester.tapAt(const Offset(20, 40));
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsScreen, skipOffstage: false), findsOneWidget);
      expect(find.byType(LikedScreen), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('in the tabs, a header answers only while its tab is the one showing',
        (tester) async {
      final semantics = await openOne(tester, const AppTabs(tab: 2), act: (t) async {
        await t.tap(find.text('Bytte via kjede'));
      });
      expect(find.byType(TradeDetailScreen), findsOneWidget);
      await _holdsFingers(tester, '07j in the tabs', _Frame.phone);

      // Over to Oppdag: the trade's «‹» is still there, under a tab out of
      // sight, and the corner it answered across is Oppdag's now.
      await tester.tap(find.text('Oppdag'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(20, 60));
      await tester.pumpAndSettle();
      expect(find.byType(TradeDetailScreen, skipOffstage: false), findsOneWidget);
      semantics.dispose();
    });

    for (final frame in _Frame.values) {
      // Where the reach is outside the «‹» box: the status bar strip on a
      // phone, the top of the page in a browser.
      final reach = frame == _Frame.phone ? const Offset(20, 10) : const Offset(20, 40);

      testWidgets('in a ${frame.name}, a second tap on «‹» while its page is going goes nowhere',
          (tester) async {
        // The corner is the one the owner found hard to hit, so a second,
        // impatient tap is likely. The page on its way out takes no taps, and
        // its reach must not either: it popped the page under it as well.
        final navigator = await _threeDeep(tester, frame, (_) => const SizedBox.expand());
        await tester.tapAt(reach);
        await tester.pump(const Duration(milliseconds: 60));
        await tester.tapAt(reach);
        await tester.pumpAndSettle();

        expect(find.text('Side C'), findsNothing);
        expect(find.text('Side B'), findsOneWidget);
        expect(navigator.currentState!.canPop(), isTrue);
      });

      testWidgets('in a ${frame.name}, a drag that starts under a small header scrolls the page',
          (tester) async {
        // The reach under the header is «‹»'s for a tap, and the list's for a
        // drag or a wheel, the way two targets on the page share a finger.
        final list = ScrollController();
        addTearDown(list.dispose);
        await _threeDeep(
            tester,
            frame,
            (page) => ListView(
                  controller: page == 'Side C' ? list : null,
                  children: [for (var i = 0; i < 100; i++) Text('Rad $i')],
                ));
        final header = tester.getRect(find.text('Side C'));
        final start = Offset(20, header.bottom + 6);

        await tester.dragFrom(start, const Offset(0, -300));
        await tester.pumpAndSettle();
        expect(list.offset, greaterThan(200));
        expect(find.text('Side C'), findsOneWidget);

        list.jumpTo(0);
        await tester.pump();
        final wheel = TestPointer(1, PointerDeviceKind.mouse);
        await tester.sendEventToBinding(wheel.hover(start));
        await tester.sendEventToBinding(wheel.scroll(const Offset(0, 120)));
        await tester.pumpAndSettle();
        expect(list.offset, 120);

        // And a tap there is still «‹».
        await tester.tapAt(start);
        await tester.pumpAndSettle();
        expect(find.text('Side C'), findsNothing);
      });
    }

    testWidgets('«Innstillinger» answers into its corner: above it and out to the edge',
        (tester) async {
      // The one the owner named. On a phone the corner is the status bar
      // strip over the words and the 22 beside them, and a thumb aimed at a
      // corner lands there more often than under the word.
      final semantics = await openOne(tester, const ProfileScreen());
      final words = tester.getRect(find.text('Innstillinger'));
      for (final point in [
        words.topCenter - const Offset(0, 8),
        words.centerRight + const Offset(8, 0),
        const Offset(389, 1),
      ]) {
        await tester.tapAt(point);
        await tester.pumpAndSettle();
        expect(find.byType(SettingsScreen), findsOneWidget, reason: '$point');
        Navigator.of(tester.element(find.byType(SettingsScreen))).pop();
        await tester.pumpAndSettle();
      }

      // Scrolled 30 up, the words are under the status bar and out of sight,
      // and the strip beside them — still inside the area — answers nothing.
      final list = tester.state<ScrollableState>(find.byType(Scrollable).first);
      list.position.jumpTo(30);
      await tester.pump();
      await tester.tapAt(const Offset(380, 20));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsNothing);
      semantics.dispose();
    });

    testWidgets('…and the same in the tabs, only while Profil is the tab showing', (tester) async {
      final semantics = await openOne(tester, const AppTabs(tab: 4));
      await tester.tapAt(const Offset(389, 1));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      Navigator.of(tester.element(find.byType(SettingsScreen))).pop();
      await tester.pumpAndSettle();

      await tester.tap(find.text('Oppdag'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(389, 1));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsNothing);
      semantics.dispose();
    });

    testWidgets('«Innstillinger» answers down into the empty space beside the name',
        (tester) async {
      final semantics = await openOne(tester, const ProfileScreen(), frame: _Frame.browser);
      final words = tester.getRect(find.text('Innstillinger'));
      await tester.tapAt(words.bottomCenter + const Offset(0, 20));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('«Hopp over» answers from the top of the screen to its edge', (tester) async {
      final semantics = await openOne(tester, const InterestsScreen(), frame: _Frame.browser);
      await tester.tapAt(const Offset(389, 1));
      await tester.pumpAndSettle();
      expect(session.interestsPending, isFalse);
      expect(find.byType(InterestsScreen), findsNothing);
      semantics.dispose();
    });

    testWidgets('the stars are one strip, and a finger anywhere on it gives the nearest',
        (tester) async {
      final semantics = await openOne(tester, ReviewScreen(trade: _trade()));
      Element row() => tester.element(
          find.ancestor(of: find.text('★').first, matching: find.byType(Row)).first);
      final built = row();
      final star = tester.getRect(find.text('★').at(3));
      // Over the fourth star, in the room above the row.
      await tester.tapAt(star.topCenter - const Offset(0, 10));
      await tester.pump();
      // The row is the one it was, not one built from nothing for the tap.
      expect(row(), same(built));
      expect(
          tester.getSemantics(find.bySemanticsLabel('Vurdering av Kari')),
          matchesSemantics(
            label: 'Vurdering av Kari',
            value: '4 av 5',
            increasedValue: '5 av 5',
            decreasedValue: '3 av 5',
            isSlider: true,
            hasIncreaseAction: true,
            hasDecreaseAction: true,
          ));

      // A finger sliding from the first star to the last gives the last.
      await tester.dragFrom(tester.getCenter(find.text('★').first),
          tester.getCenter(find.text('★').last) - tester.getCenter(find.text('★').first));
      await tester.pump();
      expect(row(), same(built));
      expect(tester.getSemantics(find.bySemanticsLabel('Vurdering av Kari')).value, '5 av 5');
      semantics.dispose();
    });
  });

  group('a toast over any screen lies over none of the actions at its foot', () {
    // A refusal is said where the thumb is, and it stays up for five seconds,
    // which is when the person wants to press the button again. Every target
    // outside a list is the screen's own and counts — the trade screen's foot
    // is outlined buttons only in most of its states, and 06c's «Avbryt» and
    // the words under 06a's button are targets as much as the button. What is
    // in a list is the list's content, which a toast lifted over the foot may
    // lie over the last of, as it lies over the grid over 13's «+ Legg ut».
    for (final screen in _screens) {
      testWidgets(screen.name, (tester) async {
        final semantics = await _open(tester, screen, _Frame.phone);
        // A sheet or a dialog is over the page, and a toast is the page's.
        final covered = find.byType(BottomSheet).evaluate().isNotEmpty ||
            find.byType(Dialog).evaluate().isNotEmpty;
        if (!covered) {
          showToastOn(ScaffoldMessenger.of(tester.element(find.byType(Scaffold).last)),
              ToastTone.error, 'Noe gikk galt hos oss. Prøv igjen om litt, så ser vi på det.');
          await tester.pumpAndSettle();
          final toast = tester.getRect(find.byType(SwaplyToast));
          final under = [
            for (final target in _targets(tester))
              if (!_inAList(target) &&
                  !_inTheToast(target) &&
                  target.rect.intersect(toast).width > 0.5 &&
                  target.rect.intersect(toast).height > 0.5)
                target.name,
          ];
          expect(under, isEmpty, reason: 'under the toast at $toast');
        }
        semantics.dispose();
      });
    }
  });

  for (final frame in _Frame.values) {
    group('in a ${frame.name}', () {
      for (final screen in _screens) {
        testWidgets(screen.name, (tester) async {
          final semantics = await _open(tester, screen, frame);
          await _holdsFingers(tester, screen.name, frame);
          semantics.dispose();
        });
      }
    });
  }
}
