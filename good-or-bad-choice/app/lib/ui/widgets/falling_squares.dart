import 'dart:math';

import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/tokens.dart';

/// The shape of the grid: how big a cell is and how many fit across.
class GridPlan {
  const GridPlan({required this.cell, required this.gap, required this.columns, required this.rows});

  final double cell;
  final double gap;
  final int columns;
  final int rows;

  double get pitch => cell + gap;
  double get width => columns * pitch - gap;
  double get height => rows * pitch - gap;

  /// The biggest cell that fits [count] squares in [size].
  ///
  /// Walked from large to small rather than solved, because the answer is an
  /// integer number of columns and rows and the closed form is a floor inside a
  /// floor. Twenty-odd iterations, once per layout.
  static GridPlan fit(Size size, int count) {
    if (count <= 0) return const GridPlan(cell: 8, gap: 2, columns: 1, rows: 1);

    for (var cell = 56.0; cell >= 3.0; cell -= 0.5) {
      final gap = max(1.0, cell * 0.16);
      final columns = ((size.width + gap) / (cell + gap)).floor();
      final rows = ((size.height + gap) / (cell + gap)).floor();
      if (columns < 1 || rows < 1) continue;
      if (columns * rows >= count) {
        // Only as many rows as are actually needed, so a short history sits in
        // a block rather than floating in the middle of an empty field.
        final needed = (count / columns).ceil();
        return GridPlan(cell: cell, gap: gap, columns: columns, rows: needed);
      }
    }
    // More taps than pixels. The caller shows the most recent that fit.
    const cell = 3.0;
    const gap = 1.0;
    final columns = max(1, ((size.width + gap) / (cell + gap)).floor());
    final rows = max(1, ((size.height + gap) / (cell + gap)).floor());
    return GridPlan(cell: cell, gap: gap, columns: columns, rows: rows);
  }

  int get capacity => columns * rows;
}

/// Rains the period's taps down into a grid, faster and faster, and leaves them
/// there.
///
/// One painter and one controller rather than a widget per square: a year is a
/// couple of thousand of them, and two thousand `AnimatedBuilder`s is two
/// thousand rebuilds a frame.
///
/// The nth of N lands at `T·√(n/N)`. The square root is the whole trick — with
/// a linear schedule the squares tick down like a metronome, and with this one
/// the gaps between landings shrink as it goes, so it accelerates into the
/// finish instead of just stopping.
class FallingSquares extends StatelessWidget {
  const FallingSquares({
    required this.taps,
    required this.progress,
    required this.plan,
    super.key,
  });

  final List<Tap> taps;
  final Animation<double> progress;
  final GridPlan plan;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return RepaintBoundary(
      child: CustomPaint(
        painter: _RainPainter(
          taps: taps,
          progress: progress,
          plan: plan,
          good: palette.good,
          bad: palette.bad,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _RainPainter extends CustomPainter {
  _RainPainter({
    required this.taps,
    required this.progress,
    required this.plan,
    required this.good,
    required this.bad,
  }) : super(repaint: progress);

  final List<Tap> taps;
  final Animation<double> progress;
  final GridPlan plan;
  final Color good;
  final Color bad;

  /// How much of the whole run one square spends in the air. Long enough to
  /// read as falling, short enough that the last one is not still descending
  /// after the rest have settled.
  static const _fall = 0.14;

  /// How far above its cell a square starts, in rows.
  static const _drop = 7.0;

  @override
  void paint(Canvas canvas, Size size) {
    final n = taps.length;
    if (n == 0) return;

    final t = progress.value;
    final left = (size.width - plan.width) / 2;
    final top = (size.height - plan.height) / 2;
    final radius = Radius.circular(plan.cell >= 6 ? plan.cell * 0.22 : 0.8);

    final paint = Paint()..isAntiAlias = plan.cell >= 5;

    for (var i = 0; i < n; i++) {
      // Landing schedule. The last square lands exactly at the end.
      final land = sqrt((i + 1) / n) * (1 - _fall) + _fall;
      final start = land - _fall;
      if (t < start) continue;

      final column = i % plan.columns;
      final row = i ~/ plan.columns;
      final x = left + column * plan.pitch;
      final restY = top + row * plan.pitch;

      var width = plan.cell;
      var height = plan.cell;
      var y = restY;

      if (t < land) {
        final local = ((t - start) / _fall).clamp(0.0, 1.0);
        // Gravity: slow at the top, quick at the bottom.
        final fallen = Curves.easeInQuad.transform(local);
        // From just above its own cell rather than from above the screen. A
        // square that falls the whole height passes over rows that have already
        // landed, which reads as a curtain coming down; dropping each one into
        // its own place reads as the grid filling in, which is what it is.
        y = restY - _drop * plan.pitch * (1 - fallen);
      } else {
        // A squash on impact that settles within a tenth of the run. Without it
        // the squares arrive like a progress bar filling rather than like
        // objects that have weight.
        final settle = ((t - land) / 0.08).clamp(0.0, 1.0);
        if (settle < 1) {
          final squash = sin(settle * pi) * 0.22;
          height = plan.cell * (1 - squash);
          width = plan.cell * (1 + squash * 0.5);
          // Anchored at the bottom, so it flattens onto its cell rather than
          // shrinking towards the middle of it.
          y = restY + (plan.cell - height);
        }
      }

      paint.color = taps[i].kind.isGood ? good : bad;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x - (width - plan.cell) / 2, y, width, height),
          radius,
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_RainPainter old) =>
      old.taps != taps || old.plan != plan || old.good != good || old.bad != bad;
}
