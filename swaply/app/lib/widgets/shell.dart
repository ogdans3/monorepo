import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../design/tokens.dart';
import '../state/session.dart';

/// The five tabs from the export: Oppdag · Legg ut · Bytter · Chats · Profil.
/// The unread badge sits on Chats and nowhere else, and at zero it draws
/// nothing rather than a zero.
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
    return Scaffold(
      backgroundColor: backgroundColor ?? SwaplyColors.bg,
      appBar: appBar,
      body: SafeArea(bottom: false, child: child),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: SwaplyNavBar(current: currentTab),
    );
  }
}

class SwaplyNavBar extends StatelessWidget {
  const SwaplyNavBar({super.key, required this.current});

  final int current;

  static const _routes = ['/discover', '/post', '/trades', '/chats', '/profile'];

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();

    return Container(
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.line)),
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
    final colour = selected ? SwaplyColors.greenDeep : SwaplyColors.grey;

    return Expanded(
      child: InkWell(
        onTap: selected
            ? null
            : () => Navigator.of(context).pushNamedAndRemoveUntil(_routes[index], (r) => false),
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
                        border: Border.all(color: SwaplyColors.surface, width: 2),
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
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: colour)),
          ],
        ),
      ),
    );
  }
}

/// The back chevron and title every inner screen in the export starts with.
AppBar swaplyAppBar(BuildContext context, String title,
    {String? subtitle, List<Widget> actions = const [], bool showBack = true}) {
  return AppBar(
    backgroundColor: SwaplyColors.bg,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    leading: showBack
        ? IconButton(
            icon: const Icon(Icons.chevron_left, size: 30, color: SwaplyColors.ink),
            onPressed: () => Navigator.of(context).maybePop(),
          )
        : null,
    titleSpacing: showBack ? 0 : Insets.screen,
    // Every screen with a back arrow names itself big and deep green in the
    // export — «Innstillinger», «Bytte med Ola», «Likt». Ink at heading size is
    // what a settings app does; this is what the drawing does.
    toolbarHeight: subtitle == null ? 62 : 74,
    title: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(title,
            style: const TextStyle(
                fontSize: 22,
                height: 1.1,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
                color: SwaplyColors.greenDeep),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        if (subtitle != null) Text(subtitle, style: Type.secondary),
      ],
    ),
    actions: actions,
  );
}
