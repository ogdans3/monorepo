import 'package:flutter/material.dart';

import '../data/models.dart';
import '../design/tokens.dart';
import '../main.dart';
import 'widgets/falling_squares.dart';

/// The recap.
///
/// A verdict in one word, then every tap in the period raining down behind it
/// into a grid, then the grid. It is the only theatre in the product and it
/// lasts four seconds, so it earns its place by being skippable: a tap anywhere
/// goes straight to the end.
class RecapScreen extends StatefulWidget {
  const RecapScreen({required this.span, super.key});

  final Span span;

  @override
  State<RecapScreen> createState() => _RecapScreenState();
}

class _RecapScreenState extends State<RecapScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _rain;
  late final Recap _recap;

  /// The verdict shrinks out of the way over the last stretch, handing the
  /// screen to the grid it was sitting on top of.
  late final Animation<double> _shrink;
  late final Animation<double> _tail;

  @override
  void initState() {
    super.initState();
    // Read once. The screen is a snapshot of a period, and a tap arriving
    // mid-animation must not reshuffle a grid somebody is watching land.
    _recap = AppScope.read(context).recap(widget.span);
    _rain = AnimationController(vsync: this, duration: Motion.rain);
    _shrink = CurvedAnimation(parent: _rain, curve: const Interval(0.72, 1, curve: Motion.ease));
    _tail = CurvedAnimation(parent: _rain, curve: const Interval(0.86, 1, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_rain.status == AnimationStatus.dismissed) {
      // Reduce Motion means every square is already home. The grid is the
      // information; the falling is the flourish, and it is the flourish they
      // asked not to see.
      if (MediaQuery.disableAnimationsOf(context)) {
        _rain.value = 1;
      } else {
        _rain.forward();
      }
    }
  }

  @override
  void dispose() {
    _rain.dispose();
    super.dispose();
  }

  void _skip() {
    if (_rain.isAnimating) _rain.animateTo(1, duration: Motion.base, curve: Motion.ease);
  }

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);

    return Scaffold(
      backgroundColor: palette.bg,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _skip,
        child: SafeArea(
          child: Stack(
            children: [
              // The grid sits between the verdict's resting place and the
              // footer, so nothing ends up hidden under either.
              Positioned.fill(
                top: 96,
                bottom: 64,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final size = Size(constraints.maxWidth - 24, constraints.maxHeight - 8);
                    final plan = GridPlan.fit(size, _recap.total);
                    // More taps than the screen has room for: show the most
                    // recent that fit, and say so in the footer rather than
                    // silently drawing a different number than the one above.
                    final shown = _recap.total > plan.capacity
                        ? _recap.taps.sublist(_recap.total - plan.capacity)
                        : _recap.taps;
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: FallingSquares(taps: shown, progress: _rain, plan: plan),
                    );
                  },
                ),
              ),

              _Verdict(recap: _recap, shrink: _shrink),

              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: FadeTransition(
                  opacity: _tail,
                  child: _Footer(recap: _recap, onDone: () => Navigator.of(context).pop()),
                ),
              ),

              Positioned(
                left: 8,
                top: 4,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: palette.inkMuted),
                  tooltip: 'Close',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The big button-shaped answer, which is the first thing on the screen and the
/// last thing left on it.
class _Verdict extends StatelessWidget {
  const _Verdict({required this.recap, required this.shrink});

  final Recap recap;
  final Animation<double> shrink;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    final colour = palette.of(recap.mostlyGood);

    return AnimatedBuilder(
      animation: shrink,
      builder: (context, _) {
        final t = shrink.value;
        return Align(
          alignment: Alignment.lerp(Alignment.center, Alignment.topCenter, t)!,
          child: Padding(
            padding: EdgeInsets.only(top: 12 * t),
            child: Transform.scale(
              scale: 1 - 0.42 * t,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 34, vertical: 26),
                decoration: BoxDecoration(
                  color: colour,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.22),
                      blurRadius: 34,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      // The word, not the colour. Somebody who cannot tell the
                      // two apart still reads the answer here.
                      recap.mostlyGood ? 'mostly good' : 'mostly bad',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.6,
                        color: palette.onColour,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${recap.good} of ${recap.total} · ${recap.span.label}',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: palette.onColour.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.recap, required this.onDone});

  final Recap recap;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 18),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${recap.good} good, ${recap.bad} bad',
              style: TextStyle(fontSize: 13.5, color: palette.inkMuted),
            ),
          ),
          TextButton(
            onPressed: onDone,
            child: Text(
              'done',
              style: TextStyle(fontWeight: FontWeight.w600, color: palette.ink),
            ),
          ),
        ],
      ),
    );
  }
}
