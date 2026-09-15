import 'dart:math';

import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/tokens.dart';

/// The one confirmation there is.
///
/// A square of the colour just chosen leaves the finger and is filed into the
/// corner button, where the history lives. There is no toast, no tick, no
/// number going up: this says *recorded, and it went in there* in one gesture,
/// and it is over before you could have looked away.
///
/// It owns its own controller rather than being a widget with one, because
/// several are in the air at once whenever somebody taps faster than 420ms and
/// each needs its own clock.
class TossedSquare {
  TossedSquare({
    required TickerProvider vsync,
    required this.kind,
    required this.from,
    required this.to,
    required VoidCallback onDone,
  }) : _controller = AnimationController(vsync: vsync, duration: Motion.toss) {
    _controller.forward().whenCompleteOrCancel(onDone);
  }

  final Choice kind;
  final Offset from;
  final Offset to;
  final AnimationController _controller;

  /// Sideways is linear and vertical is not, so the square travels on an arc
  /// rather than a straight line. A straight line between two points on a
  /// screen reads as a UI element moving; an arc reads as something thrown.
  static const _startSize = 64.0;
  static const _endSize = 13.0;

  Widget build(Palette palette) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        final eased = Curves.easeOutCubic.transform(t);
        final x = from.dx + (to.dx - from.dx) * eased;
        // The vertical leg lags, which is what bends the path.
        final y = from.dy + (to.dy - from.dy) * Curves.easeInOutCubic.transform(t);

        final size = _startSize + (_endSize - _startSize) * eased;
        // Fades only at the very end, so it is unmistakably *arriving* rather
        // than dissolving on the way.
        final opacity = t < 0.82 ? 1.0 : 1.0 - (t - 0.82) / 0.18;

        return Positioned(
          key: const ValueKey('tossed'),
          left: x - size / 2,
          top: y - size / 2,
          child: IgnorePointer(
            child: Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform.rotate(
                angle: -0.55 * sin(t * pi),
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    color: palette.of(kind.isGood),
                    borderRadius: BorderRadius.circular(size * 0.22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.22 * (1 - eased)),
                        blurRadius: 18 * (1 - eased),
                        offset: Offset(0, 6 * (1 - eased)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void dispose() => _controller.dispose();
}
