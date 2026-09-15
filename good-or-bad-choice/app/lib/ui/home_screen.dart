import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/models.dart';
import '../design/tokens.dart';
import '../main.dart';
import '../state/app_state.dart';
import 'menu_screen.dart';
import 'widgets/tossed_square.dart';

/// The product.
///
/// Two halves and one small button. Everything else in the app is behind that
/// button, including the account, because settings are not a destination.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  /// Squares currently in the air. Several at once is normal: the animation is
  /// 420ms and somebody can tap faster than that.
  final List<TossedSquare> _inFlight = [];

  /// Which half is lit, and how brightly. The flash is the acknowledgement that
  /// survives Reduce Motion, so it is not part of the toss.
  final Map<Choice, AnimationController> _flashes = {};

  final GlobalKey _cornerKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    for (final kind in Choice.values) {
      _flashes[kind] = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 90),
        reverseDuration: const Duration(milliseconds: 260),
      );
    }
  }

  @override
  void dispose() {
    for (final controller in _flashes.values) {
      controller.dispose();
    }
    for (final square in _inFlight) {
      square.dispose();
    }
    super.dispose();
  }

  void _tap(Choice kind, Offset globalPosition) {
    final state = AppScope.read(context);
    state.record(kind);
    HapticFeedback.lightImpact();

    final flash = _flashes[kind]!;
    flash.forward(from: 0).then((_) {
      if (mounted) flash.reverse();
    });

    if (MediaQuery.disableAnimationsOf(context)) return;

    // Where it is going: the corner button, which is where the history lives.
    final corner = _cornerKey.currentContext?.findRenderObject() as RenderBox?;
    final box = context.findRenderObject() as RenderBox?;
    if (corner == null || box == null) return;
    final target = box.globalToLocal(corner.localToGlobal(corner.size.center(Offset.zero)));
    final from = box.globalToLocal(globalPosition);

    late final TossedSquare square;
    square = TossedSquare(
      vsync: this,
      kind: kind,
      from: from,
      to: target,
      onDone: () {
        if (!mounted) {
          square.dispose();
          return;
        }
        setState(() => _inFlight.remove(square));
        square.dispose();
      },
    );
    setState(() => _inFlight.add(square));
  }

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    final size = MediaQuery.sizeOf(context);
    // Side by side on anything wider than it is tall, so one build serves a
    // phone and a laptop without a second layout.
    final wide = size.width > size.height;

    final halves = [
      _Half(
        kind: Choice.good,
        flash: _flashes[Choice.good]!,
        onTap: (position) => _tap(Choice.good, position),
      ),
      _Half(
        kind: Choice.bad,
        flash: _flashes[Choice.bad]!,
        onTap: (position) => _tap(Choice.bad, position),
      ),
    ];

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: wide
                ? Row(children: [for (final half in halves) Expanded(child: half)])
                : Column(children: [for (final half in halves) Expanded(child: half)]),
          ),
          for (final square in _inFlight) square.build(palette),
          Positioned(
            left: Insets.corner,
            bottom: Insets.corner,
            child: _CornerButton(key: _cornerKey),
          ),
          const Positioned(left: 0, right: 0, bottom: 0, child: _UndoBar()),
        ],
      ),
    );
  }
}

/// One half of the screen. The whole thing is the target — there is no button
/// inside it to miss.
class _Half extends StatelessWidget {
  const _Half({required this.kind, required this.flash, required this.onTap});

  final Choice kind;
  final AnimationController flash;
  final void Function(Offset globalPosition) onTap;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    final colour = palette.of(kind.isGood);

    return Semantics(
      button: true,
      label: kind.isGood ? 'Good choice' : 'Bad choice',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (details) => onTap(details.globalPosition),
        child: AnimatedBuilder(
          animation: flash,
          builder: (context, child) {
            return ColoredBox(
              color: Color.alphaBlend(
                palette.onColour.withValues(alpha: 0.20 * flash.value),
                colour,
              ),
              child: child,
            );
          },
          child: LayoutBuilder(
            builder: (context, constraints) {
              // The one screen in the product that is closer to a poster than
              // to a control panel, so the word grows with the half it sits in.
              // Fixed at 34 it is lost in the middle of a laptop-sized field of
              // colour; this keeps it the same weight on any screen.
              final short = min(constraints.maxWidth, constraints.maxHeight);
              final size = (short * 0.17).clamp(34.0, 96.0);
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Never colour alone. The word is the other half of the
                    // meaning, and it is why this reads on a greyscale screen
                    // and to somebody who cannot tell the two apart.
                    Text(
                      kind.isGood ? 'good' : 'bad',
                      style: TextStyle(
                        fontSize: size,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5 - size * 0.01,
                        height: 1.05,
                        color: palette.onColour,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'choice',
                      style: TextStyle(
                        fontSize: (size * 0.44).clamp(15.0, 30.0),
                        fontWeight: FontWeight.w500,
                        color: palette.onColour.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The only way out of the two buttons, and the way in to everything else.
class _CornerButton extends StatelessWidget {
  const _CornerButton({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return Material(
      color: palette.surface,
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: Colors.black.withValues(alpha: 0.35),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const MenuScreen()),
        ),
        child: SizedBox(
          width: Insets.cornerButton,
          height: Insets.cornerButton,
          child: Semantics(
            button: true,
            label: 'Recap and settings',
            child: Center(
              child: Icon(Icons.grid_view_rounded, size: 22, color: palette.ink),
            ),
          ),
        ),
      ),
    );
  }
}

/// A way back from a slip, for a few seconds, and then never again.
class _UndoBar extends StatefulWidget {
  const _UndoBar();

  @override
  State<_UndoBar> createState() => _UndoBarState();
}

class _UndoBarState extends State<_UndoBar> {
  Timer? _expiry;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The offer is time-limited, and nothing notifies when a deadline passes.
    // Runs when a tap arrives — which is the only time the window opens — and
    // rebuilds once, when it shuts.
    _expiry?.cancel();
    final tap = AppScope.read(context).undoable;
    if (tap == null) return;
    final left = AppState.undoWindow - DateTime.now().difference(tap.at);
    _expiry = Timer(left.isNegative ? Duration.zero : left, () {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _expiry?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final palette = PaletteScope.of(context);
    final tap = state.undoable;

    return AnimatedSwitcher(
      duration: Motion.base,
      switchInCurve: Motion.ease,
      child: tap == null
          ? const SizedBox(key: ValueKey('none'), height: 0)
          : Padding(
              key: ValueKey(tap.id),
              padding: const EdgeInsets.only(bottom: Insets.corner),
              child: Center(
                child: Material(
                  color: palette.surface,
                  borderRadius: BorderRadius.circular(999),
                  elevation: 3,
                  shadowColor: Colors.black.withValues(alpha: 0.35),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: () {
                      state.undo(tap);
                      setState(() {});
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: palette.of(tap.kind.isGood),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'undo',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: palette.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
