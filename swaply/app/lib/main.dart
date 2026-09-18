import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/client.dart';
import 'design/tokens.dart';
import 'screens/chat.dart';
import 'screens/discover.dart';
import 'screens/item_detail.dart';
import 'screens/liked.dart';
import 'screens/notifications.dart';
import 'screens/onboarding.dart';
import 'screens/post_item.dart';
import 'screens/profile.dart';
import 'screens/trades_list.dart';
import 'state/session.dart';
import 'widgets/desk.dart';

/// Points at the machine's own address in development so a phone on the same
/// network can reach it. Override with `--dart-define=API_BASE=…`.
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:3001');

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

class SwaplyApp extends StatelessWidget {
  const SwaplyApp({super.key, required this.api});

  final SwaplyApi api;

  @override
  Widget build(BuildContext context) {
    return Provider<SwaplyApi>.value(
      value: api,
      child: MaterialApp(
        title: 'Swaply',
        debugShowCheckedModeBanner: false,
        theme: swaplyTheme(),
        // Phone-sized on a desk; see Desk.
        builder: (context, child) => Desk(child: child!),
        home: const RootGate(),
        routes: {
          '/discover': (_) => const DiscoverScreen(),
          '/post': (_) => const PostItemScreen(),
          '/trades': (_) => const TradesScreen(),
          '/chats': (_) => const ChatsScreen(),
          '/profile': (_) => const ProfileScreen(),
          '/liked': (_) => const LikedScreen(),
          '/notifications': (_) => const NotificationsScreen(),
          '/login': (_) => const LoginScreen(),
          '/register': (_) => const CreateProfileScreen(),
        },
      ),
    );
  }
}

/// Screen 01 while the saved token is checked, then either the sign-in screen
/// or the interest picker or the app.
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _followed = false;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();

    if (session.loading) return const SplashScreen();
    if (!session.signedIn) {
      final invite = session.pendingInvite;
      return invite == null ? const LoginScreen() : InviteScreen(token: invite);
    }
    if (session.interestsPending) return const InterestsScreen();

    // A shared link is an invitation to somebody who is not here yet and a
    // listing to everybody else, and it is the same link. Landing on Oppdag
    // with no sign of what your friend sent is the dead end the token was
    // supposed to remove.
    if (session.pendingInvite != null && !_followed) {
      _followed = true;
      _openSharedListing(session.pendingInvite!);
      session.pendingInvite = null;
    }
    return const DiscoverScreen();
  }

  Future<void> _openSharedListing(String token) async {
    try {
      final invite = await context.read<SwaplyApi>().invite(token);
      // A listing can be retired after the link went out, and a plain
      // invitation carries none at all. Then there is simply nothing to open.
      if (!mounted || invite.itemId == null) return;
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ItemDetailScreen(itemId: invite.itemId!)));
    } on ApiException {
      // A link that no longer resolves is not worth interrupting anyone over.
    }
  }
}
