import 'package:flutter/widgets.dart';

import '../data/models.dart' show TagColor;

/// The palette, the scale and the motion, in one place.
///
/// These are the same values as `DESIGN.md` and `apps/web/src/app.css`. Three
/// files, one design system. Change them together or they drift.
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
    required this.tags,
  });

  final Color bg;
  final Color surface;
  final Color surfaceHover;
  final Color line;
  final Color lineStrong;
  final Color ink;
  final Color inkMuted;

  /// UI boundaries only, at 3.7:1 on white. Never body text.
  final Color inkFaint;
  final Color primary;
  final Color primaryHover;
  final Color primaryQuiet;
  final Color onPrimary;
  final Color scrim;

  /// The eight tag colours, DESIGN.md's "Tag tints". Quiet on purpose: one
  /// lightness for all eight, on hues kept clear of the rose, so a tagged list
  /// still has one accent on it.
  final Map<TagColor, TagTone> tags;

  TagTone tag(TagColor color) => tags[color]!;

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
    tags: {
      TagColor.clay: TagTone(
        tint: Color(0xFFFEEAE0),
        ink: Color(0xFF763F25),
        dot: Color(0xFFC16D45),
      ),
      TagColor.ochre: TagTone(
        tint: Color(0xFFF8EDD7),
        ink: Color(0xFF654B07),
        dot: Color(0xFFA77F19),
      ),
      TagColor.olive: TagTone(
        tint: Color(0xFFEBF2DA),
        ink: Color(0xFF4A561A),
        dot: Color(0xFF7D9034),
      ),
      TagColor.sage: TagTone(
        tint: Color(0xFFDDF6E7),
        ink: Color(0xFF195E3F),
        dot: Color(0xFF339C6D),
      ),
      TagColor.teal: TagTone(
        tint: Color(0xFFD7F6F7),
        ink: Color(0xFF005C60),
        dot: Color(0xFF03999F),
      ),
      TagColor.steel: TagTone(
        tint: Color(0xFFE1F1FF),
        ink: Color(0xFF21547B),
        dot: Color(0xFF3E8CC9),
      ),
      TagColor.iris: TagTone(
        tint: Color(0xFFECEDFF),
        ink: Color(0xFF4B487C),
        dot: Color(0xFF7F7BCB),
      ),
      TagColor.plum: TagTone(
        tint: Color(0xFFF8E8FC),
        ink: Color(0xFF643F6D),
        dot: Color(0xFFA66DB3),
      ),
    },
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
    tags: {
      TagColor.clay: TagTone(
        tint: Color(0xFF41261A),
        ink: Color(0xFFFAC8B1),
        dot: Color(0xFFE08C66),
      ),
      TagColor.ochre: TagTone(
        tint: Color(0xFF382C11),
        ink: Color(0xFFE8D2A4),
        dot: Color(0xFFC69F47),
      ),
      TagColor.olive: TagTone(
        tint: Color(0xFF2B3116),
        ink: Color(0xFFCEDBAB),
        dot: Color(0xFF9BAF58),
      ),
      TagColor.sage: TagTone(
        tint: Color(0xFF173526),
        ink: Color(0xFFB0E2C6),
        dot: Color(0xFF5BBB8C),
      ),
      TagColor.teal: TagTone(
        tint: Color(0xFF0A3537),
        ink: Color(0xFFA1E2E5),
        dot: Color(0xFF28BAC1),
      ),
      TagColor.steel: TagTone(
        tint: Color(0xFF193043),
        ink: Color(0xFFB1DAFD),
        dot: Color(0xFF62ACE8),
      ),
      TagColor.iris: TagTone(
        tint: Color(0xFF2B2A44),
        ink: Color(0xFFCFCFFE),
        dot: Color(0xFF9D9AEA),
      ),
      TagColor.plum: TagTone(
        tint: Color(0xFF38263C),
        ink: Color(0xFFE8C7EF),
        dot: Color(0xFFC58CD1),
      ),
    },
  );
}

/// One tag colour's three roles. **Tint** is a chip's fill, **ink** its text,
/// and **dot** the 8dp mark that stands for the tag where there is no chip: a
/// group heading, a filter that is off, a done row, the colour picker.
///
/// Measured, not eyeballed: ink on its tint is 6.78:1 at worst in light and
/// 9.17:1 in dark, and a dot clears the 3:1 a mark needs on the page and on
/// `surface` in both.
@immutable
class TagTone {
  const TagTone({required this.tint, required this.ink, required this.dot});

  final Color tint;
  final Color ink;
  final Color dot;
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
  /// ease-out-quart, the curve the whole product moves on.
  static const curve = Cubic(0.22, 1, 0.36, 1);

  static const fast = Duration(milliseconds: 160);
  static const base = Duration(milliseconds: 220);

  /// The checkmark draw. The one moment allowed to be pleasing.
  static const check = Duration(milliseconds: 180);

  /// How long a just-ticked row stays put before it drifts to the done shelf,
  /// so you can see what you did, and undo it by looking.
  static const settleGrace = Duration(milliseconds: 400);

  /// How long a change someone else made stays highlighted.
  static const remoteWash = Duration(milliseconds: 900);

  /// The done shelf's chevron turning a quarter as it folds. The rows go at
  /// once: animating a list's height is layout work for no information.
  static const fold = Duration(milliseconds: 180);
}
