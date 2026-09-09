import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/client.dart';
import 'design/tokens.dart';
import 'screens/chat.dart';
import 'screens/discover.dart';
import 'screens/liked.dart';
import 'screens/notifications.dart';
import 'screens/onboarding.dart';
import 'screens/post_item.dart';
import 'screens/profile.dart';
import 'screens/trades_list.dart';
import 'state/session.dart';

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
        theme: _theme(),
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

  ThemeData _theme() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: SwaplyColors.greenDeep,
        primary: SwaplyColors.greenPressed,
        surface: SwaplyColors.bg,
      ),
      scaffoldBackgroundColor: SwaplyColors.bg,
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: SwaplyColors.ink, displayColor: SwaplyColors.ink),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          borderSide: const BorderSide(color: SwaplyColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          borderSide: const BorderSide(color: SwaplyColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          borderSide: const BorderSide(color: SwaplyColors.greenPressed, width: 1.6),
        ),
        hintStyle: const TextStyle(color: SwaplyColors.grey, fontSize: 14.5),
      ),
    );
  }
}

/// Screen 01 while the saved token is checked, then either the sign-in screen
/// or the interest picker or the app.
class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();

    if (session.loading) return const SplashScreen();
    if (!session.signedIn) {
      final invite = session.pendingInvite;
      return invite == null ? const LoginScreen() : InviteScreen(token: invite);
    }
    if (session.interestsPending) return const InterestsScreen();
    return const DiscoverScreen();
  }
}
