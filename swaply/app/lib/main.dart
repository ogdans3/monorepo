import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/client.dart';
import 'design/tokens.dart';
import 'screens/admin.dart';
import 'screens/item_detail.dart';
import 'screens/liked.dart';
import 'screens/notifications.dart';
import 'screens/onboarding.dart';
import 'screens/tabs.dart';
import 'state/session.dart';
import 'util/reduced_motion.dart';
import 'widgets/admin_chrome.dart';
import 'widgets/desk.dart';
import 'widgets/keyboard.dart';
import 'widgets/shell.dart';

/// Where the API is; `--dart-define=API_BASE=…` says otherwise. In development
/// that is the machine's own address. A release build is for a phone, where
/// localhost is the phone itself, so it talks to the live API. That is what
/// Google Play and TestFlight need, and an archive made in Xcode carries only
/// the defines the last `flutter` command happened to leave behind.
const apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: kReleaseMode ? 'https://swaply-api.freelunch.no' : 'http://localhost:3001',
);

void main() {
  final api = SwaplyApi(baseUrl: apiBase);

  // The web build reads the invitation straight out of the address the link
  // opened. On iOS and Android the same token arrives through a universal link,
  // which needs a registered domain and bundle id — neither exists yet — so
  // there the way in is the link opened in a browser.
  final invite = Uri.base.queryParameters['invitasjon'];

  runApp(
    ChangeNotifierProvider(
      create: (_) => Session(api)
        ..pendingInvite = invite
        ..restore(),
      child: SwaplyApp(api: api),
    ),
  );
}

class SwaplyApp extends StatefulWidget {
  const SwaplyApp({super.key, required this.api, this.lessMotion});

  final SwaplyApi api;

  /// Whether the person has asked for less motion where the platform does not
  /// say so itself — the browser's setting; see [askedForLessMotion]. Given
  /// in a test, which has no browser to ask.
  final ValueListenable<bool>? lessMotion;

  @override
  State<SwaplyApp> createState() => _SwaplyAppState();
}

class _SwaplyAppState extends State<SwaplyApp> with WidgetsBindingObserver {
  /// For the admin floor, which sits outside the navigator — under it, on the
  /// screen — and so cannot find it by looking up.
  final _navigator = GlobalKey<NavigatorState>();

  /// Asked once, for the life of the app: the builder below runs on every
  /// rebuild, and each ask listens to the browser anew.
  late final _lessMotion = widget.lessMotion ?? askedForLessMotion();

  /// The session's word that whoever the screens are about is gone; see
  /// [Session.sentBack].
  late final StreamSubscription<void> _sentBack;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _sentBack = context.read<Session>().sentBack.listen((_) => _throughGate());
  }

  @override
  void dispose() {
    unawaited(_sentBack.cancel());
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Everything over the gate taken down, as «Logg ut» does: a chat, 16b,
  /// 10c — each was about somebody this phone no longer is, and the gate
  /// under them has already moved on to the next start. From here, since
  /// nothing on screen asked for it: the session did.
  void _throughGate() {
    final navigator = _navigator.currentContext;
    if (navigator != null) backThroughGate(navigator);
  }

  /// Back from the background is opening the app, and the server has to hear
  /// it: a device nobody opens for twelve months is deleted. See
  /// [Session.wake], which keeps it to once a minute after an answer, and
  /// quiet.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(Provider.of<Session>(context, listen: false).wake());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Provider<SwaplyApi>.value(
      value: widget.api,
      child: MaterialApp(
        title: 'Swaply',
        debugShowCheckedModeBanner: false,
        theme: swaplyTheme(),
        navigatorKey: _navigator,
        // Phone-sized on a desk; see Desk. The admin floor is wired here and
        // not inside a screen, so that «you are Kari right now» is drawn on
        // every route including the ones with no bottom nav. The shell host is
        // here for the same reason from the other side: a screen pushed over
        // the tabs is not inside them, and still has to reach them. Less
        // motion outermost, so everything under it — the desk's own
        // MediaQuery included — hears a browser that asked for it. The
        // keyboard's rule over all of it, since a field can be anywhere.
        builder: (context, child) => LessMotion(
          asked: _lessMotion,
          child: KeyboardAway(
            child: Desk(
              child: AdminFloor(
                navigator: _navigator,
                child: TabShellHost(child: child!),
              ),
            ),
          ),
        ),
        // `/` rather than `home:` so that anything can send a person back
        // through the gate — which is what decides between the splash, the
        // interest picker and the app. Switching accounts has to: the account
        // you become may never have seen screen 02. So does signing out, which
        // leaves a new stranger to be made.
        initialRoute: '/',
        onGenerateRoute: _route,
        // What a browser's address opens, bookmarks from when the tabs were
        // routes included. A tab's address is the gate opening on that tab,
        // not the tabs stacked on the gate: an empty shell on top hid what the
        // gate had to show first — the splash saying «Prøv igjen», 02, a
        // sign-in. Any other address goes over the gate, as it always has.
        onGenerateInitialRoutes: (name) {
          final tab = tabRoutes.contains(name);
          return [
            _route(RouteSettings(name: tab ? name : Navigator.defaultRouteName))!,
            if (!tab && name != Navigator.defaultRouteName) ?_route(RouteSettings(name: name)),
          ];
        },
      ),
    );
  }

  Route<dynamic>? _route(RouteSettings settings) {
    // A tab is not a route inside the app; its address opens the gate at it.
    final tab = tabRoutes.indexOf(settings.name ?? '');
    if (tab >= 0 || settings.name == Navigator.defaultRouteName) {
      // A [TabShellRoute], since the shell will be on it, and named `/`
      // whichever tab it opens on: that is the name `backThroughGate` looks
      // for.
      return TabShellRoute<dynamic>(
        settings: const RouteSettings(name: Navigator.defaultRouteName),
        builder: (_) => RootGate(tab: math.max(tab, 0)),
      );
    }
    final WidgetBuilder? screen = switch (settings.name) {
      '/liked' => (_) => const LikedScreen(),
      '/notifications' => (_) => const NotificationsScreen(),
      '/admin' => (_) => const AdminScreen(),
      '/login' => (_) => const LoginScreen(),
      '/register' => (_) => const CreateProfileScreen(),
      _ => null,
    };
    return screen == null ? null : MaterialPageRoute<dynamic>(settings: settings, builder: screen);
  }
}

/// Screen 01 while the saved token is checked or the device is made a
/// stranger, then the interest picker or the app. The sign-in is not on the
/// way: it is behind «Logg inn» on the profile of a device looking around, and
/// here only when a server that wants invitations refuses to start without one.
class RootGate extends StatefulWidget {
  const RootGate({super.key, this.tab = 0});

  /// The tab the app opens on once it is through — the first time. It comes
  /// from the address the app was opened at, and that was somebody's.
  final int tab;

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  /// Whether the gate has put an app on screen yet. The address's tab is for
  /// that one: the gate stays for as long as the app is open, and the next
  /// person through it — a stranger after «Logg ut», an account signed in to
  /// — opened on Bytter because somebody once came in at #/trades.
  bool _opened = false;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();

    if (session.loading) return const SplashScreen();
    if (!session.signedIn) {
      // No answer from the server. Said on the splash, with the one thing
      // there is to do about it, and not retried on a timer: a phone with no
      // network would ask forever. Only the person opening the app again
      // asks again, once for each time; see [Session.wake].
      if (session.stalled) {
        return SplashScreen(onRetry: session.retry, retrying: session.starting);
      }
      final invite = session.pendingInvite;
      if (invite != null) return InviteScreen(token: invite, atGate: true);
      // Invite-only, and no key: the app cannot start without asking after
      // all, and the door is the sign-in, as it was before.
      if (session.inviteRequired) return const LoginScreen();
      // After the frame, because this is inside one. Asking on every build is
      // safe: the session runs one start at a time, and stops asking once it
      // has either somebody or a reason.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) session.begin();
      });
      return const SplashScreen();
    }
    if (session.interestsPending) return const InterestsScreen(atGate: true);

    // A shared link is an invitation to somebody who is not here yet and a
    // listing to everybody else, and it is the same link. Landing on Oppdag
    // with no sign of what your friend sent is the dead end the token was
    // supposed to remove. Somebody who was already here has a key they cannot
    // spend; somebody who came in with it has spent it, on «Se deg rundt» or
    // on 10c, and the listing is still there to open.
    final link = session.pendingInvite ?? session.linkToOpen;
    if (link != null) {
      session.pendingInvite = null;
      session.linkToOpen = null;
      _openSharedListing(link);
    }
    // A listing that was waiting on 10c when the person signed in there
    // instead: this is their new app, and it opens where the form is, which
    // finishes it.
    final tab = session.listingToFinish != null ? 1 : (_opened ? 0 : widget.tab);
    // A shell reads its tab when it is made and not after, so building the
    // same one again with 0 changes nothing; the next one starts at Oppdag.
    _opened = true;
    return AppTabs(tab: tab);
  }

  Future<void> _openSharedListing(String token) async {
    try {
      final invite = await context.read<SwaplyApi>().invite(token);
      // A listing can be retired after the link went out, and a plain
      // invitation carries none at all. Then there is simply nothing to open.
      if (!mounted || invite.itemId == null) return;
      // Into Oppdag, over the grid, with the bar under it: the gate is above
      // the tabs rather than in one, so it says which. And the grid asks
      // again after a block made on it, as it does for a listing it opened.
      await openListingInTab(context, invite.itemId!, tab: 0);
    } catch (_) {
      // A link that no longer resolves, or no answer about it, is not worth
      // interrupting anyone over.
    }
  }
}
