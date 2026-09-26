import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:provider/provider.dart';

import '../design/tokens.dart';
import '../state/session.dart';

/// The routes the five tabs answer to, in the export's order: Oppdag · Legg ut
/// · Bytter · Chats · Profil. Inside the app a tab is not a route any more —
/// see [TabShell] — so these are only reached where there is no shell to
/// switch: a screen mounted on its own, or an address typed into a browser.
const tabRoutes = ['/discover', '/post', '/trades', '/chats', '/profile'];

/// The five tabs from the export: Oppdag · Legg ut · Bytter · Chats · Profil.
/// The unread badge sits on Chats and nowhere else, and at zero it draws
/// nothing rather than a zero.
///
/// Inside the app the bar is the [TabShell]'s, drawn once under every tab, so
/// this draws none and [currentTab] says nothing: the shell lights the tab you
/// are in. Pushed over the shell — the admin tool opening a trade, 10b editing
/// a listing — the screen covers the bar like any other, and a bar of its own
/// would slide in with it; with no bar under it, it keeps clear of the foot of
/// the screen itself, which is what the bar did for it. Only on its own, in a
/// widget test or a golden, does it draw one.
class SwaplyScaffold extends StatelessWidget {
  const SwaplyScaffold({
    super.key,
    required this.currentTab,
    required this.child,
    this.appBar,
    this.floatingActionButton,
    this.backgroundColor,
  });

  final int currentTab;
  final Widget child;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final alone = TabShell.maybeOf(context) == null;
    final covering = !alone && !TabShell.contains(context);
    return Scaffold(
      backgroundColor: backgroundColor ?? SwaplyColors.bg,
      appBar: appBar,
      // Over the shell nothing takes the home indicator's strip, and
      // TradeDetail's buttons would sit under it.
      body: SafeArea(bottom: covering, child: child),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: alone ? SwaplyNavBar(current: currentTab) : null,
    );
  }
}

class SwaplyNavBar extends StatelessWidget {
  const SwaplyNavBar({super.key, required this.current, this.onSelect});

  final int current;

  /// The shell's, and called for the tab already showing as well: tapping it
  /// again goes back to its first screen. Null on a screen drawn on its own,
  /// where a tab is a named route and a whole new page.
  final ValueChanged<int>? onSelect;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();

    return Container(
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.barLine)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              _tab(context, 0, Icons.search, 'Oppdag'),
              _tab(context, 1, Icons.add_circle_outline, 'Legg ut'),
              _tab(context, 2, Icons.swap_horiz, 'Bytter', badge: session.tradesNeedingYou),
              _tab(context, 3, Icons.chat_bubble_outline, 'Chats', badge: session.unreadChats),
              _tab(context, 4, Icons.person_outline, 'Profil'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tab(BuildContext context, int index, IconData icon, String label, {int badge = 0}) {
    final selected = index == current;
    final colour = selected ? SwaplyColors.greenPressed : SwaplyColors.grey;

    return Expanded(
      child: InkWell(
        onTap: onSelect != null
            ? () => onSelect!(index)
            : selected
                ? null
                : () => Navigator.of(context)
                    .pushNamedAndRemoveUntil(tabRoutes[index], (r) => false),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 21, color: colour),
                if (badge > 0)
                  Positioned(
                    top: -5,
                    right: -9,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 16),
                      height: 16,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: SwaplyColors.badge,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge > 9 ? '9+' : '$badge',
                        style: const TextStyle(
                            color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: colour)),
          ],
        ),
      ),
    );
  }
}

/// The back chevron and title every inner screen in the export starts with.
/// «‹ Bytte med Ola»: the export's header is one 25-tall row six below the
/// status bar — a thin «‹» and the title in deep green, 22/800. `big` is the
/// 26/800 kind («Innstillinger», «Likt») with 14 below; a subtitle goes under
/// a big title and, on the small kind, into a chip at the right («Med Ola»).
/// The glyph's box is 33 wide and the row tall, so the target is more than
/// the seven pixels it draws.
PreferredSizeWidget swaplyAppBar(BuildContext context, String title,
    {String? subtitle,
    List<Widget> actions = const [],
    bool showBack = true,
    bool big = false,
    double inset = 22}) {
  final under = big && subtitle != null;
  // No title at all — 13b — and the row is just the two glyphs, 21 tall and
  // flush with the status bar.
  final bare = title.isEmpty;
  final rowHeight = bare ? 21.0 : big ? 30.0 : 25.0;
  final top = bare ? 0.0 : 6.0;
  final height = top + rowHeight + (under ? 18 : 0) + (big ? (under ? 4 : 14) : 0);
  return PreferredSize(
    preferredSize: Size.fromHeight(height),
    child: Container(
      color: SwaplyColors.bg,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(showBack ? inset - 14 : inset, top, inset, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: rowHeight,
                child: Row(
                  children: [
                    if (showBack)
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => Navigator.of(context).maybePop(),
                        child: const SizedBox(
                          width: 33,
                          child: Padding(
                            padding: EdgeInsets.only(left: 14),
                            child: Text('‹',
                                style: TextStyle(
                                    fontSize: 18, height: 1.15, color: SwaplyColors.ink)),
                          ),
                        ),
                      ),
                    Expanded(
                      child: Text(title,
                          style: big
                              ? Type.screen
                              : const TextStyle(
                                  fontSize: 22,
                                  height: 1.15,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.4,
                                  color: SwaplyColors.greenDeep),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    ),
                    if (!big && subtitle != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                        decoration: BoxDecoration(
                          color: SwaplyColors.chip,
                          borderRadius: BorderRadius.circular(Radii.pill),
                        ),
                        child: Text(subtitle,
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: SwaplyColors.inkMuted)),
                      ),
                    ...actions,
                  ],
                ),
              ),
              if (under)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: SwaplyColors.grey)),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// A small glyph at the right of the header — «⋯» — sized to the row.
Widget headerAction(IconData icon, VoidCallback onTap) => GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: 30,
        height: 25,
        child: Align(
          alignment: Alignment.centerRight,
          child: Icon(icon, size: 20, color: SwaplyColors.ink),
        ),
      ),
    );

/// The app behind the gate: five tabs under one bar that is drawn once and
/// never moves.
///
/// Every tab is its own [Navigator] and the bar sits outside all five, so a
/// screen pushed inside a tab slides in above a bar that stays where it is,
/// and changing tabs changes what is above the bar and nothing else. It used
/// to be the other way round — every screen drew its own bar and every tab was
/// a route — so each step carried a fresh bar in with the page.
///
/// A tab is built the first time it is opened and kept from then on, with its
/// stack, its scroll and a half-typed search in it; [RefetchOnTabReturn] is
/// how its first screen stays current anyway. A screen the export draws
/// without the bar is not pushed inside a tab at all but over the shell, where
/// it covers the bar the way the drawing does: see [pushOverBar].
class TabShell extends StatefulWidget {
  const TabShell({super.key, required this.tabs, this.initialTab = 0});

  /// The first screen of each tab, in the order the bar draws them.
  final List<WidgetBuilder> tabs;
  final int initialTab;

  /// The shell a screen is in — or, for a screen pushed over the bar, which is
  /// not inside it, the shell underneath. Null when there is none at all, which
  /// is a screen mounted on its own in a widget test. Asking from over the bar
  /// makes the screen depend on the answer: a browser address can put a screen
  /// over the gate before there is a shell under it, and it has to stop
  /// drawing a bar of its own when one arrives, not at its next setState.
  static TabShellState? maybeOf(BuildContext context) =>
      context.findAncestorStateOfType<TabShellState>() ??
      context.dependOnInheritedWidgetOfExactType<_HostScope>()?.host.shell;

  /// Whether [context] is inside one of the tabs, under the shell's bar.
  static bool contains(BuildContext context) =>
      context.getInheritedWidgetOfExactType<_TabScope>() != null;

  /// The tab [context] is in, or null outside the tabs. Not always the tab on
  /// screen: the bar stays live while a screen waits on the server, and a flow
  /// that finishes after a tap on it finished in the tab it was started in.
  static int? tabOf(BuildContext context) =>
      context.getInheritedWidgetOfExactType<_TabScope>()?.index;

  @override
  State<TabShell> createState() => TabShellState();
}

class TabShellState extends State<TabShell> with SingleTickerProviderStateMixin {
  late int _active = widget.initialTab;

  /// The tabs opened so far. The rest do not exist yet: five screens fetching
  /// at once on the first frame is four fetches nobody asked for.
  late final _built = <int>{widget.initialTab};
  late final _navigators = [for (final _ in widget.tabs) GlobalKey<NavigatorState>()];

  /// How many times each tab has been landed on while it was already showing;
  /// see [RefetchOnTabReturn].
  late final _visits = [for (final _ in widget.tabs) 0];

  /// The tab being faded out, under the one fading in.
  int? _leaving;

  /// Tabs to take back to their first screen, and tabs to throw away, once
  /// they are off screen; see [jumpTo].
  final _toClear = <int>{};
  final _startOver = <int>{};

  // Made in initState rather than lazily: a shell that never switched tabs
  // would otherwise first make its ticker in dispose(), against an element
  // that is already on its way out.
  late final AnimationController _fade;
  late final CurvedAnimation _fadeIn;

  _TabShellHostState? _host;
  TabShellRoute<dynamic>? _route;

  /// The tab on screen.
  int get active => _active;

  @override
  void initState() {
    super.initState();
    // A cross-fade of the content only, and short enough to read as a cut:
    // the bar says where you went, so the page does not have to travel. The
    // new tab is mostly there within the first third, and settles after.
    _fade = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 180), value: 1)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) _settle();
      });
    _fadeIn = CurvedAnimation(parent: _fade, curve: Curves.easeOutQuart);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final host = context.getInheritedWidgetOfExactType<_HostScope>()?.host;
    if (host != _host) {
      _host?._leave(this);
      _host = host?.._join(this);
    }
    final route = ModalRoute.of(context);
    if (route != _route) {
      if (_route?._shell == this) _route!._shell = null;
      _route = route is TabShellRoute ? route : null;
      _route?._shell = this;
    }
  }

  @override
  void dispose() {
    _host?._leave(this);
    // Unless a shell for somebody else has taken the route over already.
    if (_route?._shell == this) _route!._shell = null;
    _fadeIn.dispose();
    _fade.dispose();
    super.dispose();
  }

  /// The bar: another tab comes back as it was left, and the tab already
  /// showing goes back to its first screen.
  void select(int tab) => tab == _active ? popToRoot(tab) : _show(tab);

  void popToRoot(int tab) => _navigators[tab].currentState?.popUntil((r) => r.isFirst);

  /// Shows [tab] as it was left, from anywhere: the «Legg ut» buttons elsewhere
  /// in the app open the tab rather than a second form.
  void open(int tab) {
    _uncover();
    _show(tab);
  }

  /// Where a finished flow goes — a listing went out, a review was sent — with
  /// the way there cleared: whatever covers the bar, the stack of the tab it
  /// was done in, and the stack of the tab it lands in. It stands in for
  /// `pushNamedAndRemoveUntil('/trades')`, which threw away every tab to do it,
  /// and like that it lands on a first screen that asks the server again.
  ///
  /// [from] is the tab the flow was done in, and the tab on screen when it is
  /// not given. They differ when the bar was tapped while the flow waited on
  /// the server: that tab is where the person went, and it is left alone.
  ///
  /// [startOver] throws away the tab it was done in as well, once it is off
  /// screen: a form whose listing just went out must be empty the next time,
  /// and going back to its first screen does not empty the first screen. A
  /// flow that lands in the tab it was done in has nothing to throw away.
  void jumpTo(int tab, {int? from, bool startOver = false}) {
    final origin = from ?? _active;
    final covered = _uncover();
    if (tab == _active && !covered) {
      // Already where it lands, in plain view: the page slides back.
      popToRoot(tab);
    } else {
      // Otherwise at once, under the cover going away or the fade coming in:
      // the tab arrives at its first screen.
      _clear(tab);
      _show(tab);
    }
    _land(tab);
    if (origin == tab) return;
    // Not while it is still fading out under the tab coming in, but as soon
    // as it is out of sight.
    (startOver ? _startOver : _toClear).add(origin);
    if (_leaving == null) _settle();
  }

  /// A finished flow has landed on [tab]'s first screen, which asks again even
  /// if the tab never left the screen; see [RefetchOnTabReturn].
  void _land(int tab) => setState(() => _visits[tab]++);

  /// Opens [route] inside [tab], or the tab showing. From a screen that covers
  /// the bar, that screen is taken down first: a screen the export draws with
  /// the bar belongs above it.
  Future<T?> push<T extends Object?>(Route<T> route, {int? tab}) async {
    _uncover();
    if (tab != null) _show(tab);
    final key = _navigators[_active];
    if (key.currentState == null) {
      // A tab opened for the first time just now has its navigator after this
      // frame, not before.
      await SchedulerBinding.instance.endOfFrame;
    }
    return key.currentState?.push(route);
  }

  void _show(int tab) {
    if (tab == _active) return;
    // Instant for somebody who has asked for less motion.
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    setState(() {
      _built.add(tab);
      _leaving = still ? null : _active;
      _active = tab;
    });
    if (still) {
      _fade.value = 1;
      _settle();
    } else {
      _fade.forward(from: 0);
    }
  }

  /// The fade is over: the tab that left goes offstage, a tab a flow finished
  /// in is cleared, and a tab that was to start over is thrown away and built
  /// fresh the next time it is opened.
  void _settle() {
    if (!mounted) return;
    for (final tab in _toClear) {
      if (tab != _active) _clear(tab);
    }
    _toClear.clear();
    setState(() {
      _leaving = null;
      // Unless it was opened again before the fade was over.
      _built.removeAll(_startOver.where((tab) => tab != _active));
      _startOver.clear();
    });
  }

  /// Takes [tab] back to its first screen at once, without the slide. For a
  /// tab going out of sight, whose tickers stop: a page sliding out there
  /// would freeze halfway and finish in front of you the next time you came
  /// back to it.
  void _clear(int tab) {
    final navigator = _navigators[tab].currentState;
    if (navigator == null) return;
    while (true) {
      Route<Object?>? top;
      // Asks for the top route and pops nothing: the predicate holds at once.
      navigator.popUntil((route) {
        top = route;
        return true;
      });
      final route = top;
      if (route == null || route.isFirst) return;
      navigator.removeRoute(route);
    }
  }

  /// Takes down whatever the root navigator has over the shell — a chat, a
  /// sheet, the agreement — so that what happens next happens in view. True
  /// when there was something to take down.
  bool _uncover() {
    final route = ModalRoute.of(context);
    if (route == null || !route.isActive || route.isCurrent) return false;
    Navigator.of(context).popUntil((r) => r == route);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // Painted in this order, so the tab fading in lies on the one fading out.
    final order = [
      for (final tab in _built)
        if (tab != _active && tab != _leaving) tab,
      ?_leaving,
      _active,
    ];

    return Material(
      color: SwaplyColors.bg,
      child: CustomMultiChildLayout(
        delegate: _ShellLayout(keyboard: media.viewInsets.bottom),
        children: [
          LayoutId(
            id: _Slot.tabs,
            // What a Scaffold hands the body above its bottom bar: the bar
            // takes the safe area at the foot, and the keyboard is dealt with
            // here, by ending the tabs where it begins.
            child: MediaQuery(
              data: media
                  .removePadding(removeBottom: true)
                  .removeViewInsets(removeBottom: true),
              child: Stack(
                fit: StackFit.expand,
                children: [for (final tab in order) _tab(tab)],
              ),
            ),
          ),
          LayoutId(
            id: _Slot.bar,
            child: SwaplyNavBar(current: _active, onSelect: select),
          ),
        ],
      ),
    );
  }

  Widget _tab(int tab) {
    final shown = tab == _active;
    return KeyedSubtree(
      key: ValueKey(tab),
      child: Offstage(
        offstage: !shown && tab != _leaving,
        // A tab out of sight holds still, takes no taps and gives up the
        // keyboard: its search field must not keep the focus it had.
        child: TickerMode(
          enabled: shown,
          // Nor does it fly anything. A toast is drawn in every tab's
          // Scaffold at once, and a toast is a hero: with two tabs built,
          // anything pushed over the bar found the same hero twice in one
          // route and stopped on it.
          child: HeroMode(
            enabled: shown,
            child: IgnorePointer(
              ignoring: !shown,
              child: ExcludeFocus(
                excluding: !shown,
                child: FadeTransition(
                  opacity: shown && _leaving != null ? _fadeIn : kAlwaysCompleteAnimation,
                  child: _TabScope(
                    index: tab,
                    shown: shown,
                    visit: _visits[tab],
                    // Android's back and the browser's go to the tab first:
                    // back out of an item page, not out of the app.
                    child: NavigatorPopHandler<Object?>(
                      enabled: shown,
                      onPopWithResult: (_) {
                        if (tab == _active) _navigators[tab].currentState?.maybePop();
                      },
                      child: Navigator(
                        key: _navigators[tab],
                        onGenerateRoute: (settings) =>
                            MaterialPageRoute(settings: settings, builder: widget.tabs[tab]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum _Slot { tabs, bar }

/// The bar at the foot and the tabs above it, as a Scaffold lays out a body
/// and a bottom bar: the keyboard comes up over the bar, and the tabs end at
/// whichever of the two is higher.
class _ShellLayout extends MultiChildLayoutDelegate {
  _ShellLayout({required this.keyboard});

  final double keyboard;

  @override
  void performLayout(Size size) {
    final bar = layoutChild(_Slot.bar,
        BoxConstraints(minWidth: size.width, maxWidth: size.width, maxHeight: size.height));
    positionChild(_Slot.bar, Offset(0, size.height - bar.height));

    final bottom = math.max(bar.height, keyboard);
    layoutChild(_Slot.tabs,
        BoxConstraints.tight(Size(size.width, math.max(0, size.height - bottom))));
    positionChild(_Slot.tabs, Offset.zero);
  }

  @override
  bool shouldRelayout(_ShellLayout oldDelegate) => oldDelegate.keyboard != keyboard;
}

class _TabScope extends InheritedWidget {
  const _TabScope(
      {required this.index, required this.shown, required this.visit, required super.child});

  final int index;
  final bool shown;
  final int visit;

  @override
  bool updateShouldNotify(_TabScope oldWidget) =>
      oldWidget.shown != shown || oldWidget.visit != visit;
}

/// The root route the [TabShell] is on: the gate's, in `main.dart`.
///
/// A page pushed over it on the root navigator — a chat, 16b, the match —
/// covers the bar. A [MaterialPageRoute] under an incoming page takes part in
/// its transition: it slides a third of the way off on iOS, and slides and
/// fades on Android. The bar is on this route, so it went with it, on every
/// one of those pages and back again. While a shell is on it, this route takes
/// no part: the page comes in over a bar that stays where it is, and leaves
/// the same way. Before there is a shell on it — the splash, 02, a sign-in at
/// the gate — it moves aside like any other page.
class TabShellRoute<T> extends MaterialPageRoute<T> {
  TabShellRoute({required super.builder, super.settings});

  /// Set by the shell itself, which finds its route when it is built.
  TabShellState? _shell;

  @override
  bool canTransitionTo(TransitionRoute<dynamic> nextRoute) =>
      _shell == null && super.canTransitionTo(nextRoute);
}

/// Above the root navigator, so a screen that covers the bar — and is not
/// inside the shell — can still reach the tabs under it. Wired once, into the
/// `MaterialApp` builder.
class TabShellHost extends StatefulWidget {
  const TabShellHost({super.key, required this.child});

  final Widget child;

  @override
  State<TabShellHost> createState() => _TabShellHostState();
}

class _TabShellHostState extends State<TabShellHost> {
  // The newest wins. Signing in or switching accounts mounts a fresh shell
  // before the one it replaces is disposed.
  final _shells = <TabShellState>[];
  bool _telling = false;

  TabShellState? get shell => _shells.lastOrNull;

  void _join(TabShellState shell) {
    _shells.add(shell);
    _changed();
  }

  void _leave(TabShellState shell) {
    if (_shells.remove(shell)) _changed();
  }

  /// Tells the screens over the bar that the shell under them changed. After
  /// the frame: a shell comes and goes while it is being built, and this is
  /// above it.
  void _changed() {
    if (_telling) return;
    _telling = true;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      _telling = false;
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) =>
      _HostScope(host: this, shell: shell, child: widget.child);
}

class _HostScope extends InheritedWidget {
  const _HostScope({required this.host, required this.shell, required super.child});

  final _TabShellHostState host;

  /// The shell when this was built, only to know when to tell.
  final TabShellState? shell;

  @override
  bool updateShouldNotify(_HostScope oldWidget) => oldWidget.shell != shell;
}

/// For the first screen of a tab. Tabs are kept rather than rebuilt now, so a
/// list fetched when the tab was first opened would otherwise still be the
/// list on screen an hour later — every tap on the bar used to fetch it again,
/// by building the screen from nothing.
///
/// And each time a finished flow lands on it — a trade declined, a review sent
/// — even with the tab on screen already. Nothing came into view, but what the
/// first screen lists has changed, and landing there used to build it again
/// from nothing too. Tapping the tab you are in does not ask: nothing was
/// finished, and a page the first screen opened is one it asks again after.
mixin RefetchOnTabReturn<T extends StatefulWidget> on State<T> {
  bool? _shown;
  int? _visit;

  /// Each time the tab comes back into view. Not the first time: that is what
  /// `initState` is for.
  void onTabReturn();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scope = context.dependOnInheritedWidgetOfExactType<_TabScope>();
    final shown = scope?.shown;
    final visit = scope?.visit;
    final back = _shown == false && shown == true;
    final landed = _shown == true && shown == true && visit != _visit;
    if (back || landed) {
      // After the frame, because this is inside one, and a refresh tells the
      // session — and so the bar's badges — before it has anything to say.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) onTabReturn();
      });
    }
    _shown = shown;
    _visit = visit;
  }
}

/// Opens a screen the export draws with the bar, inside a tab. From inside one
/// that is its own navigator. From a screen covering the bar — the match, a
/// notification — the covering screens are taken down first and the screen
/// goes into [tab], or into the tab underneath. [replace] takes the place of
/// the screen it is opened from, as `pushReplacement` does.
Future<T?> pushInTab<T extends Object?>(BuildContext context, Widget screen,
    {int? tab, bool replace = false}) {
  final route = MaterialPageRoute<T>(builder: (_) => screen);
  final shell = TabShell.maybeOf(context);
  if (shell == null || (tab == null && TabShell.contains(context))) {
    final navigator = Navigator.of(context);
    return replace ? navigator.pushReplacement(route) : navigator.push(route);
  }
  return shell.push(route, tab: tab);
}

/// Opens a screen the export draws without the bar — 10c, the match, the
/// agreement, a chat — over the shell, on the root navigator, so it covers the
/// bar the way the drawing does. With no shell this is an ordinary push.
Future<T?> pushOverBar<T extends Object?>(BuildContext context, Widget screen) =>
    Navigator.of(context, rootNavigator: true)
        .push(MaterialPageRoute<T>(builder: (_) => screen));

/// Sends a finished flow to [tab], from the tab [context] is in; see
/// [TabShellState.jumpTo]. With no shell above it — a screen on its own — the
/// tab's route replaces everything, which is what this did before there was a
/// shell.
void goToTab(BuildContext context, int tab, {bool startOver = false}) {
  final shell = TabShell.maybeOf(context);
  if (shell == null) {
    Navigator.of(context, rootNavigator: true)
        .pushNamedAndRemoveUntil(tabRoutes[tab], (r) => false);
  } else {
    shell.jumpTo(tab, from: TabShell.tabOf(context), startOver: startOver);
  }
}

/// Shows [tab] as it was left. False when there is no shell to show it in, and
/// the caller has to open the screen some other way.
bool showTab(BuildContext context, int tab) {
  final shell = TabShell.maybeOf(context);
  shell?.open(tab);
  return shell != null;
}
