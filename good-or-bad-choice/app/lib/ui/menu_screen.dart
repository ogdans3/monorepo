import 'package:flutter/material.dart';

import '../data/models.dart';
import '../design/tokens.dart';
import '../main.dart';
import 'recap_screen.dart';
import 'settings_screen.dart';

/// Everything that is not the two buttons.
///
/// Six stretches of time and a way to the account, on one screen, because there
/// are only seven things here and a menu of menus would be worse than all of
/// them in a list.
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final palette = PaletteScope.of(context);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: palette.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'look back',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: palette.ink),
        ),
        iconTheme: IconThemeData(color: palette.ink),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
          children: [
            for (final span in Span.values)
              _SpanRow(span: span, recap: state.recap(span)),
            const SizedBox(height: 28),
            _AccountRow(
              signedIn: state.isSignedIn,
              username: state.username,
              unsynced: state.unsynced,
            ),
          ],
        ),
      ),
    );
  }
}

class _SpanRow extends StatelessWidget {
  const _SpanRow({required this.span, required this.recap});

  final Span span;
  final Recap recap;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    final empty = recap.isEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: palette.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          // An empty stretch has nothing to rain down, so it does not pretend
          // it has. The row says so instead of opening onto a blank screen.
          onTap: empty
              ? null
              : () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => RecapScreen(span: span)),
                  ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        span.label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: empty ? palette.inkMuted : palette.ink,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        empty
                            ? 'nothing yet'
                            : '${recap.total} ${recap.total == 1 ? 'tap' : 'taps'}'
                                ' · ${recap.good} good, ${recap.bad} bad',
                        style: TextStyle(fontSize: 13, color: palette.inkMuted),
                      ),
                    ],
                  ),
                ),
                if (!empty) _Sparkbar(recap: recap),
                const SizedBox(width: 10),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: empty ? palette.line : palette.inkMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The balance, at a glance, before you commit to watching the whole thing.
///
/// Two segments and a number beside them, never a bare bar: a ratio of green to
/// red carried by colour alone is exactly what this app cannot do.
class _Sparkbar extends StatelessWidget {
  const _Sparkbar({required this.recap});

  final Recap recap;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return SizedBox(
      width: 56,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          height: 8,
          child: Row(
            // Stretch, not the default centre. A `ColoredBox` with no child
            // lays out at `constraints.smallest`, and a loose cross axis makes
            // that zero high — the bar was in the tree and eight pixels of
            // nothing on screen.
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: (recap.share * 1000).round().clamp(0, 1000),
                child: ColoredBox(color: palette.good),
              ),
              Expanded(
                flex: (1000 - recap.share * 1000).round().clamp(0, 1000),
                child: ColoredBox(color: palette.bad),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({required this.signedIn, required this.username, required this.unsynced});

  final bool signedIn;
  final String? username;
  final int unsynced;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(Icons.settings_outlined, size: 20, color: palette.inkMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      signedIn ? 'settings · $username' : 'settings',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: palette.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      signedIn
                          ? (unsynced == 0 ? 'everything is backed up' : '$unsynced still to send')
                          : 'this device only',
                      style: TextStyle(fontSize: 12.5, color: palette.inkMuted),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 22, color: palette.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}
