import 'package:flutter/material.dart';

/// The palette. Three files hold it — this one, `docs/DESIGN.md` and
/// `web/src/app.css` — and they have to be changed together.
///
/// Values are read off the round 5 export rather than invented, which is why
/// there are three reds: they do three different jobs and must not collapse.
///
/// The second half of this list was read out of the export itself — the bundled
/// HTML in `swapply-design`, opened in a browser and asked for its computed
/// styles — rather than guessed from the screenshots. Where a value here has a
/// hex that looks arbitrary, that is why: it is what the drawing actually uses.
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

  // --- read off the round 5 export -----------------------------------------

  /// Green text: links, «Se profil ›», «Send», a verified badge. Lighter than
  /// [greenPressed], which stays the colour of a filled button.
  static const greenText = Color(0xFF0B7A47);

  /// The fill behind every small pill — a category, a condition, a filter that
  /// is not selected. No border: the fill is the shape.
  static const chip = Color(0xFFEEF2EE);

  /// The ink inside one.
  static const chipInk = Color(0xFF3C4A43);

  /// Body copy and section labels. Softer than [ink], darker than [greySoft].
  static const inkBody = Color(0xFF41514A);

  /// Hints, kickers, the placeholder in a message field.
  static const greyLight = Color(0xFF98A29B);

  /// A card's edge. Barely there, and not the same as [line], which is a
  /// transparency and goes muddy on tinted backgrounds.
  static const cardLine = Color(0xFFECEFEA);

  /// Somebody else's avatar. Yours is [greenDeep]; the export gives other
  /// people a colour of their own, and these are the ones it uses.
  static const avatarGold = Color(0xFFC08B2D);
  static const avatarTeal = Color(0xFF2F9E8F);
  static const avatarPurple = Color(0xFF7C6FD1);

  /// The «Tilgjengelig» badge on your own listing.
  static const availableBg = Color(0xFFDEF5E9);

  /// The ring around the ✕ on a listing: coral at a tenth of its strength.
  static const declineLine = Color(0xFFF5C9C6);

  /// A text field's edge, and the edge of an unselected tile on 02.
  static const fieldLine = Color(0xFFE4E8E3);

  /// The one hairline the bottom bar draws above itself.
  static const barLine = Color(0xFFEDEFEA);

  /// A chevron that says «there is more» and nothing else.
  static const chevron = Color(0xFFC9CFCA);

  /// The amber the export uses for words: «Ola får», «Din tur», «Reservert».
  static const amberText = Color(0xFFB25E09);
  static const amberBg = Color(0xFFFFF3E2);

  /// A chosen tile on 02: not [greenSoft], a touch lighter.
  static const tileSelected = Color(0xFFE9F7F0);

  /// Body copy on the dark screens, and the one subtitle colour on 02.
  static const inkMuted = Color(0xFF5B6862);

  /// «Logg ut», and the red of «Avslått».
  static const redText = Color(0xFFC0271F);
}

class Insets {
  const Insets._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 14.0;
  static const lg = 20.0;
  static const xl = 28.0;

  /// The side margin most screens keep: 22 in the export. A few screens have
  /// their own — 18 on Oppdag, 24 on the interest picker, 28 on sign-in — and
  /// say so where they are built.
  static const screen = 22.0;
}

class Radii {
  const Radii._();
  static const card = 16.0;
  static const sheet = 24.0;
  static const pill = 100.0;
}

/// The type scale, measured in the export the same way the colours were.
///
/// It is smaller and denser than a Material default, and the weights are
/// heavier: 800 for a screen's own title, 700 for anything that names a thing,
/// 400 for prose. Nothing here is 500.
class Type {
  const Type._();

  /// A listing's name on 04, and the biggest thing on a screen. Deep green: the
  /// export gives the thing you are looking at the brand colour, and keeps ink
  /// for people and for rows in a list.
  static const display = TextStyle(
      fontSize: 23,
      height: 1.15,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.4,
      color: SwaplyColors.greenDeep);

  /// What a tab-root screen calls itself: «Mine handler», «Chats», «Likt».
  /// Bigger than a listing's name, which is a thing inside a screen.
  static const screen = TextStyle(
      fontSize: 26,
      height: 1.1,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.5,
      color: SwaplyColors.greenDeep);

  /// A person's name on their own profile, and a screen heading in ink.
  static const title = TextStyle(
      fontSize: 22, height: 1.15, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: SwaplyColors.ink);

  /// The name of a card, a row, a person you are talking to.
  static const heading = TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: SwaplyColors.ink);

  static const body = TextStyle(fontSize: 14, height: 1.5, color: SwaplyColors.inkBody);

  static const secondary = TextStyle(fontSize: 12.5, height: 1.4, color: SwaplyColors.grey);

  static const small = TextStyle(fontSize: 12, color: SwaplyColors.grey);

  /// What a section of a screen is called: «Interesser», «Mine gjenstander · 4».
  /// Sentence case and dark, not the tracked-out capitals of a design system
  /// that wanted to look technical.
  static const section =
      TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: SwaplyColors.inkBody);

  /// Capitals, and only where the export uses them: above a conversation box.
  static const kicker = TextStyle(
      fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: SwaplyColors.greyLight);

  /// «Se profil ›», «Send», «Rediger profil».
  static const link =
      TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: SwaplyColors.greenText);

  /// The value on a card and beside a title: grey, never green.
  static const value =
      TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: SwaplyColors.grey);
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

/// The one theme, here rather than inside a widget so the golden screenshots
/// render what the app renders.
ThemeData swaplyTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: SwaplyColors.greenDeep,
      primary: SwaplyColors.greenPressed,
      surface: SwaplyColors.bg,
    ),
    scaffoldBackgroundColor: SwaplyColors.bg,
  );
  final text = base.textTheme.apply(bodyColor: SwaplyColors.ink, displayColor: SwaplyColors.ink);
  return base.copyWith(
    // Material's default styles carry a line height of 1.43, and every Text
    // that does not say its own inherits it — a 12.5px label came out 18
    // tall instead of 15, a field 52 instead of 48. The export's line height
    // is the font's own; 1.2 is that, for Roboto and SF alike.
    textTheme: text.copyWith(
      bodyLarge: text.bodyLarge?.copyWith(fontSize: 15, height: 1.2),
      bodyMedium: text.bodyMedium?.copyWith(height: 1.2),
      bodySmall: text.bodySmall?.copyWith(height: 1.2),
      titleMedium: text.titleMedium?.copyWith(height: 1.2),
      titleSmall: text.titleSmall?.copyWith(height: 1.2),
      labelLarge: text.labelLarge?.copyWith(height: 1.2),
      labelMedium: text.labelMedium?.copyWith(height: 1.2),
    ),
    // A field in the export: 48 tall, corners of 14, a hairline of #E4E8E3,
    // 15px text with 14 of padding at the sides.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: SwaplyColors.fieldLine),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: SwaplyColors.fieldLine),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: SwaplyColors.greenPressed),
      ),
      hintStyle: const TextStyle(color: SwaplyColors.greyLight, fontSize: 15),
    ),
  );
}
