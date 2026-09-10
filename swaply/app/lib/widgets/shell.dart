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
