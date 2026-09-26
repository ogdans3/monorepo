import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/shell.dart';
import 'chat.dart';
import 'discover.dart';
import 'post_item.dart';
import 'profile.dart';
import 'trades_list.dart';

/// The app behind the gate: the export's five tabs — Oppdag · Legg ut · Bytter
/// · Chats · Profil — in a [TabShell].
class AppTabs extends StatelessWidget {
  const AppTabs({super.key, this.tab = 0});

  /// The tab it opens on.
  final int tab;

  @override
  Widget build(BuildContext context) {
    final who = context.select<Session, String?>((s) => s.me?.id);
    // Signed out, on the way back through the gate to a new stranger: five
    // tabs asking the server for somebody who is no longer here would only be
    // refused.
    if (who == null) return const ColoredBox(color: SwaplyColors.bg);

    return TabShell(
      // A different person gets a different app. Switching accounts or
      // signing out must never leave the last person's stacks on screen, and
      // a key is what makes the shell start again from nothing.
      key: ValueKey(who),
      initialTab: tab,
      tabs: [
        (_) => const DiscoverScreen(),
        (_) => const PostItemScreen(),
        (_) => const TradesScreen(),
        (_) => const ChatsScreen(),
        (_) => const ProfileScreen(),
      ],
    );
  }
}

/// [AppTabs] as a route of its own, for a screen that is not at the gate and
/// has to put the app on screen itself. A [TabShellRoute], as the gate's is:
/// the shell will be on it, and a page pushed over it must not take the bar
/// along.
Route<void> appTabsRoute() => TabShellRoute<void>(builder: (_) => const AppTabs());
