import 'package:flutter/material.dart';

/// The palette. One of three files that hold it — see DESIGN.md and
/// `api/public` — and they are changed together or they drift.
///
/// Two colours do all the work here, so they are chosen for how far apart they
/// are rather than for how they feel. Good sits lighter than bad by enough that
/// the two are still different greys in a greyscale screenshot, which is the
/// first defence against the obvious problem with an app made of red and green.
class Palette {
  const Palette({
    required this.good,
    required this.bad,
    required this.onColour,
    required this.ink,
    required this.inkMuted,
    required this.bg,
    required this.surface,
    required this.line,
  });

  final Color good;
  final Color bad;

  /// Text laid over [good] or [bad]. One colour for both, because two would be
  /// two things to check the contrast of every time the palette moves.
  final Color onColour;
  final Color ink;
  final Color inkMuted;
  final Color bg;
  final Color surface;
  final Color line;

  Color of(bool isGood) => isGood ? good : bad;

  /// The default pair. Green and red, with the lightness gap described above.
  static const lightGreenRed = Palette(
    good: Color(0xFF2E9E6B),
    bad: Color(0xFFB4291F),
    onColour: Color(0xFFFFFFFF),
    ink: Color(0xFF16181D),
    inkMuted: Color(0xFF5E636E),
    bg: Color(0xFFFCFCFD),
    surface: Color(0xFFF1F2F5),
    line: Color(0xFFDDDFE5),
  );

  static const darkGreenRed = Palette(
    good: Color(0xFF3FBE85),
    bad: Color(0xFFD84034),
    onColour: Color(0xFF101216),
    ink: Color(0xFFF0F1F4),
    inkMuted: Color(0xFFA2A7B3),
    bg: Color(0xFF16181C),
    surface: Color(0xFF23262C),
    line: Color(0xFF383C45),
  );

  /// The colour-blind pair: blue and orange, the standard robust substitution,
  /// keeping the same lightness gap. Nothing in the product depends on the hue,
  /// so this is only ever a swap of two values.
  static const lightBlueOrange = Palette(
    good: Color(0xFF2F72C4),
    bad: Color(0xFFD97A16),
    onColour: Color(0xFFFFFFFF),
    ink: Color(0xFF16181D),
    inkMuted: Color(0xFF5E636E),
    bg: Color(0xFFFCFCFD),
    surface: Color(0xFFF1F2F5),
    line: Color(0xFFDDDFE5),
  );

  static const darkBlueOrange = Palette(
    good: Color(0xFF5599E6),
    bad: Color(0xFFEE9B3A),
    onColour: Color(0xFF101216),
    ink: Color(0xFFF0F1F4),
    inkMuted: Color(0xFFA2A7B3),
    bg: Color(0xFF16181C),
    surface: Color(0xFF23262C),
    line: Color(0xFF383C45),
  );

  static Palette resolve({required bool dark, required bool colourBlind}) {
    if (colourBlind) return dark ? darkBlueOrange : lightBlueOrange;
    return dark ? darkGreenRed : lightGreenRed;
  }
}

/// Reaches the palette from anywhere below [PaletteScope].
class PaletteScope extends InheritedWidget {
  const PaletteScope({required this.palette, required super.child, super.key});

  final Palette palette;

  static Palette of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PaletteScope>();
    assert(scope != null, 'No PaletteScope above this widget');
    return scope!.palette;
  }

  @override
  bool updateShouldNotify(PaletteScope old) => old.palette != palette;
}

/// Motion. Short, ease-out, no bounce — except the recap, which has its own
/// timing because it is the one piece of theatre in the product.
class Motion {
  static const fast = Duration(milliseconds: 160);
  static const base = Duration(milliseconds: 220);

  /// A tap's square, from where the finger was to the corner it is filed in.
  static const toss = Duration(milliseconds: 420);

  /// The whole rain, start to last landing.
  static const rain = Duration(milliseconds: 3800);

  static const ease = Curves.easeOutCubic;
}

class Insets {
  static const corner = 20.0;
  static const cornerButton = 48.0;
}
