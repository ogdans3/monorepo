import 'package:flutter/material.dart';

/// The palette. Three files hold it — this one, `docs/DESIGN.md` and
/// `web/src/app.css` — and they have to be changed together.
///
/// Values are read off the round 5 export rather than invented, which is why
/// there are three reds: they do three different jobs and must not collapse.
class SwaplyColors {
  const SwaplyColors._();

  static const green = Color(0xFF12B76A);
  static const greenDeep = Color(0xFF064E3B);
  static const greenPressed = Color(0xFF0A6C4C);
  static const greenSoft = Color(0xFFE8F5EF);
  static const bg = Color(0xFFFAFAF9);
  static const surface = Color(0xFFFCFCFB);
  static const ink = Color(0xFF141C18);
  static const grey = Color(0xFF8A938E);
  static const greySoft = Color(0xFF6E7B73);
  static const line = Color(0x14064E3B);

  /// «No», and destructive-but-ordinary.
  static const coral = Color(0xFFFF6B5E);

  /// Report and block only. Never the same value as [coral].
  static const red = Color(0xFFE5484D);

  /// The unread badge on the Chats tab, and nothing else.
  static const badge = Color(0xFFDC2F26);

  static const amber = Color(0xFFB77B12);
  static const amberSoft = Color(0xFFFDF5E4);
}

class Insets {
  const Insets._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 14.0;
  static const lg = 20.0;
  static const xl = 28.0;
  static const screen = 20.0;
}

class Radii {
  const Radii._();
  static const card = 16.0;
  static const sheet = 24.0;
  static const pill = 100.0;
}

class Type {
  const Type._();
  static const display = TextStyle(
      fontSize: 27, height: 1.2, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: SwaplyColors.ink);
  static const title = TextStyle(
      fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: SwaplyColors.ink);
  static const heading = TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: SwaplyColors.ink);
  static const body = TextStyle(fontSize: 14.5, height: 1.45, color: SwaplyColors.ink);
  static const secondary = TextStyle(fontSize: 13, height: 1.4, color: SwaplyColors.greySoft);
  static const small = TextStyle(fontSize: 12, color: SwaplyColors.grey);
  static const kicker = TextStyle(
      fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: SwaplyColors.greySoft);
}

/// Category keys cross the wire; the Norwegian words live here and in the web
/// app, never in the database.
const categoryLabels = <String, String>{
  'sykling': 'Sykling',
  'gaming': 'Gaming',
  'verktoy': 'Verktøy',
  'klaer': 'Klær',
  'bat': 'Båt',
  'friluft': 'Friluft',
  'barn': 'Barn',
  'hjem': 'Hjem',
  'sport': 'Sport',
  'musikk': 'Musikk',
  'boker': 'Bøker',
  'diverse': 'Diverse',
};

const categoryIcons = <String, IconData>{
  'sykling': Icons.directions_bike_outlined,
  'gaming': Icons.sports_esports_outlined,
  'verktoy': Icons.handyman_outlined,
  'klaer': Icons.checkroom_outlined,
  'bat': Icons.sailing_outlined,
  'friluft': Icons.terrain_outlined,
  'barn': Icons.child_friendly_outlined,
  'hjem': Icons.chair_outlined,
  'sport': Icons.sports_soccer_outlined,
  'musikk': Icons.music_note_outlined,
  'boker': Icons.menu_book_outlined,
  'diverse': Icons.category_outlined,
};

const conditionLabels = <String, String>{'new': 'Ny', 'good': 'God', 'worn': 'Slitt'};

/// «Verdi 2 500 kr». The export separates thousands with a plain space, not a
/// thin one — checked against the file rather than guessed.
String kr(num? value) {
  if (value == null) return '';
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return '$buffer kr';
}
