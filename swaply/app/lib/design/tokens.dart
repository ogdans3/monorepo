import 'package:flutter/material.dart';

/// The palette. Three files hold it — this one, `docs/DESIGN.md` and
/// `web/src/app.css` — and they have to be changed together.
class SwaplyColors {
  const SwaplyColors._();

  static const green = Color(0xFF12B76A);
  static const greenDeep = Color(0xFF064E3B);
  static const greenPressed = Color(0xFF0A6C4C);
  static const bg = Color(0xFFFAFAF9);
  static const ink = Color(0xFF141C18);
  static const grey = Color(0xFF8A938E);

  /// Two reds that must never collapse into one value: [coral] is "no", and
  /// [red] is reserved for report and block.
  static const coral = Color(0xFFFF6B5E);
  static const red = Color(0xFFE5484D);
}
