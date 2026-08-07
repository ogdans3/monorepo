import 'package:flutter/widgets.dart';

/// The palette, the scale and the motion, in one place.
///
/// These are the same values as `DESIGN.md` and `apps/web/src/app.css`. Three
/// files, one design system — change them together or they drift.
class CheckpostColors {
  const CheckpostColors({
    required this.bg,
    required this.surface,
    required this.surfaceHover,
    required this.line,
    required this.lineStrong,
    required this.ink,
    required this.inkMuted,
    required this.inkFaint,
    required this.primary,
    required this.primaryHover,
    required this.primaryQuiet,
    required this.onPrimary,
    required this.scrim,
  });

  final Color bg;
  final Color surface;
  final Color surfaceHover;
  final Color line;
  final Color lineStrong;
  final Color ink;
  final Color inkMuted;

  /// UI boundaries only — 3.7:1 on white. Never body text.
  final Color inkFaint;
  final Color primary;
  final Color primaryHover;
  final Color primaryQuiet;
  final Color onPrimary;
  final Color scrim;

  /// Daylight on a kitchen counter. The design's home.
  static const light = CheckpostColors(
    bg: Color(0xFFFFFFFF),
    surface: Color(0xFFF9F4F6),
    surfaceHover: Color(0xFFF2EAEE),
    line: Color(0xFFE3DADE),
    lineStrong: Color(0xFFCFC4C8),
    ink: Color(0xFF1A1417),
    inkMuted: Color(0xFF6C6166),
    inkFaint: Color(0xFF8D8387),
    primary: Color(0xFFC62D6A),
    primaryHover: Color(0xFFB1165B),
    primaryQuiet: Color(0xFFFFE8EE),
    onPrimary: Color(0xFFFFFFFF),
    scrim: Color(0x661A1417),
  );

  static const dark = CheckpostColors(
    bg: Color(0xFF110E0F),
    surface: Color(0xFF1E181B),
    surfaceHover: Color(0xFF292225),
    line: Color(0xFF342D30),
    lineStrong: Color(0xFF4E4549),
    ink: Color(0xFFF2EFF0),
    inkMuted: Color(0xFFAB9FA4),
    inkFaint: Color(0xFF82777B),
    primary: Color(0xFFF06E98),
    primaryHover: Color(0xFFFE82A8),
    primaryQuiet: Color(0xFF401E28),
    onPrimary: Color(0xFF110E0F),
    scrim: Color(0x99000000),
  );
}

/// 8dp base with a 4dp half-step.
abstract final class Space {
  static const xxs = 2.0;
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 24.0;
  static const xxxl = 32.0;
  static const huge = 40.0;
  static const giant = 56.0;

  /// Screen gutter.
  static const gutter = 20.0;

  /// Everything you can hit is at least this tall.
  static const minTarget = 48.0;

  /// A list row, before dynamic type stretches it.
  static const rowHeight = 56.0;
}

abstract final class Radii {
  static const sm = Radius.circular(8);
  static const md = Radius.circular(12);
  static const lg = Radius.circular(20);

  static const smAll = BorderRadius.all(sm);
  static const mdAll = BorderRadius.all(md);
  static const lgAll = BorderRadius.all(lg);
}

/// Curves and durations. Ease-out only: no bounce, no elastic.
abstract final class Motion {
  /// ease-out-quart — the curve the whole product moves on.
  static const curve = Cubic(0.22, 1, 0.36, 1);

  static const fast = Duration(milliseconds: 160);
  static const base = Duration(milliseconds: 220);

  /// The checkmark draw. The one moment allowed to be pleasing.
  static const check = Duration(milliseconds: 180);

  /// How long a just-ticked row stays put before it drifts to the done shelf,
  /// so you can see what you did — and undo it by looking.
  static const settleGrace = Duration(milliseconds: 400);

  /// How long a change someone else made stays highlighted.
  static const remoteWash = Duration(milliseconds: 900);
}
