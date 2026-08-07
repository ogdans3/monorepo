import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';

/// The checkbox.
///
/// The mark is *drawn*, stroke by stroke, rather than faded in. It is the one
/// piece of motion in this product allowed to be pleasing rather than merely
/// functional — it is the thing the user came for. 180ms, ease-out, no bounce.
class CheckMark extends StatelessWidget {
  const CheckMark({required this.checked, this.size = 24, super.key});

  final bool checked;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final instant = MediaQuery.disableAnimationsOf(context);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: checked ? 1 : 0, end: checked ? 1 : 0),
      duration: instant ? Duration.zero : Motion.check,
      curve: Motion.curve,
      builder: (context, progress, _) {
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: Color.lerp(
              colors.bg.withValues(alpha: 0),
              colors.primary,
              progress,
            ),
            borderRadius: Radii.smAll,
            border: Border.all(
              // inkFaint is 3.7:1 — a control boundary has to clear 3:1 to be
              // a boundary at all, and the usual pale grey does not.
              color: Color.lerp(colors.inkFaint, colors.primary, progress)!,
              width: 1.5,
            ),
          ),
          child: CustomPaint(
            painter: _MarkPainter(progress: progress, color: colors.onPrimary),
          ),
        );
      },
    );
  }
}

class _MarkPainter extends CustomPainter {
  _MarkPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0.01) return;
    final s = size.shortestSide;
    final path = Path()
      ..moveTo(s * 0.24, s * 0.52)
      ..lineTo(s * 0.43, s * 0.72)
      ..lineTo(s * 0.77, s * 0.30);

    final metrics = path.computeMetrics().toList();
    final total = metrics.fold<double>(0, (sum, m) => sum + m.length);
    var remaining = total * progress;

    final drawn = Path();
    for (final metric in metrics) {
      if (remaining <= 0) break;
      final take = remaining.clamp(0, metric.length).toDouble();
      drawn.addPath(metric.extractPath(0, take), Offset.zero);
      remaining -= take;
    }

    canvas.drawPath(
      drawn,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.115
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_MarkPainter old) =>
      old.progress != progress || old.color != color;
}
