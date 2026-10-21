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
  // The three greys are words — a value, a time, a hint — so each is as dark
  // as WCAG AA asks of text on [bg] (4.5:1), and no darker: they were read
  // off the export at 3.0, 2.5 and 4.2:1 and darkened on 21.10.2026 in their
  // own hue, so they keep their order and their green cast.
  static const grey = Color(0xFF68706C);
  static const greySoft = Color(0xFF606C65);
  static const line = Color(0x14064E3B);

  /// «No», and destructive-but-ordinary. A shape's colour — an icon, an edge,
  /// a ring — because at 2.8:1 on white it is too light to read as words.
  static const coral = Color(0xFFFF6B5E);

  /// [coral] as words: a refusal under a field or a button. The same hue,
  /// only as dark as AA asks on a light screen.
  static const coralText = Color(0xFFCF3E36);

  /// [coral] as words on [greenDeep], where it has to go lighter instead.
  static const coralOnDark = Color(0xFFFF9588);

  /// Report and block only. Never the same value as [coral]. An icon and a
  /// switch; as words or behind white words it is [reportText].
  static const red = Color(0xFFE5484D);

  /// [red] as words, and the fill behind white ones: «Rapporter», and the
  /// button that sends a report. Darker in [red]'s own hue, and still not
  /// [coralText].
  static const reportText = Color(0xFFD4373F);

  /// The unread badge on the Chats tab, and nothing else.
  static const badge = Color(0xFFDC2F26);

  static const amber = Color(0xFF9A6501);
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

  /// Hints, kickers, the placeholder in a message field. Still the lightest of
  /// the greys, at the 4.5:1 that text has to reach (see [grey]).
  static const greyLight = Color(0xFF6C756F);

  /// A card's edge. Barely there, and not the same as [line], which is a
  /// transparency and goes muddy on tinted backgrounds.
  static const cardLine = Color(0xFFECEFEA);

  /// Somebody else's avatar. Yours is [greenDeep]; the export gives other
  /// people a colour of their own, and these are the ones it uses.
  /// A white initial sits on them, so each is as dark as 4.5:1 asks, in the
  /// export's own hue (it drew #C08B2D, #2F9E8F and #7C6FD1).
  static const avatarGold = Color(0xFF9C6C07);
  static const avatarTeal = Color(0xFF038477);
  static const avatarPurple = Color(0xFF7668CA);

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
  /// A shade under the export's #B25E09, which was 4.3:1 on [amberBg].
  static const amberText = Color(0xFFAB5A04);
  static const amberBg = Color(0xFFFFF3E2);

  /// A chosen tile on 02: not [greenSoft], a touch lighter.
  static const tileSelected = Color(0xFFE9F7F0);

  /// Body copy on the dark screens, and the one subtitle colour on 02.
  static const inkMuted = Color(0xFF5B6862);

  /// «Logg ut», and the red of «Avslått».
  static const redText = Color(0xFFC0271F);

  /// The ground under [redText] in a pill: «Avslått» at the right of 09f's
  /// header, and «Avsluttet» where a trade ended another way.
  static const redSoft = Color(0xFFFDEFEE);
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

/// The test tooling's chrome.
///
/// Aliases, and nothing else. Admin adds no hex to the product: it inverts the
/// app's own two ends — ink as the fill, the background as the ink on it — and
/// borrows the one avatar colour that has never been chrome. Nothing here
/// belongs in `docs/DESIGN.md` or `web/src/app.css`; the three-file palette
/// rule in CLAUDE.md is about the product's palette, and this is deliberately
/// not part of it.
///
/// Amber is not used on purpose: the export spends it on «Din tur»,
/// «Reservert» and «Ola får», so admin chrome in amber would wear a product
/// state's colour.
class AdminColors {
  static const surface = SwaplyColors.ink;
  static const ink = SwaplyColors.bg;
  /// Words and edges on the dark floor: the export's purple lifted to 4.5:1
  /// on [surface]. A filled button is [accentFill], under white words.
  static const accent = Color(0xFF8276D8);
  static const accentFill = SwaplyColors.avatarPurple;
  /// Flutter values rather than palette values: a fill and a rule *on* the dark.
  static const cardFill = Color(0x14FFFFFF);
  static const hairline = Color(0x24FFFFFF);
  static const muted = Color(0xB3FAFAF9);
}

/// «Verdi 2 500 kr». The export separates thousands with a space as wide as
/// a plain one, not a thin one — checked against the file rather than
/// guessed. It is a no-break space (U+00A0), which draws the same: with a
/// plain one a line broke inside an amount, «Du får verdi 1» over «200 kr»
/// on a narrow phone, and between the number and «kr».
String kr(num? value) {
  if (value == null) return '';
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(nbsp);
    buffer.write(digits[i]);
  }
  return '$buffer${nbsp}kr';
}

/// The space inside an amount, which a line does not break at.
const nbsp = '\u00A0';

/// «Olas», and «Andreas'» for a name that ends in s, x or z, which takes the
/// apostrophe and not a second s: «Du får · Andreas' ting», not «Andreass».
String possessive(String name) =>
    RegExp(r'[sxz]$', caseSensitive: false).hasMatch(name) ? "$name'" : '${name}s';

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
