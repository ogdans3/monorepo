import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../design/tokens.dart';
import '../state/session.dart';

/// «Du er Kari N. — ikke deg selv.»
///
/// The state most easily forgotten in a tool that can be somebody else, so it
/// is drawn on every screen on every route rather than on the ones that
/// remembered to ask. It is wired once, into the `MaterialApp` builder.
///
/// A floor rather than a banner: the top of every screen in the export is a
/// composition — the search field on 05, the photograph running under the
/// status bar on 04 — and a strip there breaks the drawing everywhere. The
/// bottom is already chrome, so a band under it reads as the chrome growing a
/// floor. It is also in the thumb, which matters, because the button on it is
/// the one pressed most.
///
/// It renders from `me.actingAs`, which is the session row — so a refresh, a
/// restored token or a cold start cannot lose it, and an admin's own session
/// is pixel-identical to everybody else's.
class AdminFloor extends StatelessWidget {
  const AdminFloor({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (!session.actingAs) return child;

    final admin = session.actingAsAdminName ?? 'deg selv';
    final who = session.me?.displayName ?? 'en testkonto';

    return Column(
      children: [
        Expanded(child: child),
        Material(
          color: AdminColors.surface,
          child: SafeArea(
            top: false,
            child: Container(
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AdminColors.accent, width: 3)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      // Second person, and slightly uncomfortable on purpose:
                      // the clause after the dash is what stops the skim.
                      'Du er $who — ikke deg selv',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600, color: AdminColors.ink),
                    ),
                  ),
                  const SizedBox(width: 10),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () async {
                      await session.returnToAdmin();
                      if (context.mounted) {
                        Navigator.of(context)
                            .pushNamedAndRemoveUntil('/discover', (route) => false);
                      }
                    },
                    child: Text(
                      // Naming the admin makes it a door rather than a warning.
                      session.canReturnToAdmin ? 'Tilbake til $admin ↩' : 'Logg ut ↩',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w800, color: AdminColors.accent),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// «ADMIN», wherever the app has to say out loud that this is not the product.
class AdminBadge extends StatelessWidget {
  const AdminBadge(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AdminColors.accent,
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(label.toUpperCase(),
            style: const TextStyle(
                fontSize: 9.5,
                height: 1.2,
                letterSpacing: 0.6,
                fontWeight: FontWeight.w800,
                color: Colors.white)),
      );
}

/// A card on the tool screen. Dark, so that no screen in the section can be
/// mistaken for a screen in the product even at a glance across a desk.
class AdminCard extends StatelessWidget {
  const AdminCard({super.key, required this.title, required this.children, this.note});

  final String title;
  final String? note;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
        decoration: BoxDecoration(
          color: AdminColors.cardFill,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AdminColors.hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title.toUpperCase(),
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: AdminColors.accent)),
            if (note != null) ...[
              const SizedBox(height: 4),
              Text(note!,
                  style: const TextStyle(fontSize: 12, height: 1.4, color: AdminColors.muted)),
            ],
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      );
}

/// The one button shape in the section: a dark pill with a purple edge.
class AdminButton extends StatelessWidget {
  const AdminButton(this.label, {super.key, this.onPressed, this.filled = false, this.busy = false});

  final String label;
  final VoidCallback? onPressed;
  final bool filled, busy;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 40,
        child: OutlinedButton(
          onPressed: busy ? null : onPressed,
          style: OutlinedButton.styleFrom(
            backgroundColor: filled ? AdminColors.accent : Colors.transparent,
            foregroundColor: filled ? Colors.white : AdminColors.ink,
            disabledForegroundColor: AdminColors.muted,
            side: BorderSide(color: filled ? AdminColors.accent : AdminColors.hairline),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
          ),
          child: busy
              ? const SizedBox(
                  height: 16,
                  width: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AdminColors.ink))
              : Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        ),
      );
}
