import 'package:flutter/material.dart';

import 'tokens.dart';

/// Makes the palette reachable from any widget without threading it through.
class CheckpostTheme extends InheritedWidget {
  const CheckpostTheme({required this.colors, required super.child, super.key});

  final CheckpostColors colors;

  static CheckpostColors of(BuildContext context) {
    final theme = context.dependOnInheritedWidgetOfExactType<CheckpostTheme>();
    assert(theme != null, 'No CheckpostTheme found in context');
    return theme!.colors;
  }

  @override
  bool updateShouldNotify(CheckpostTheme oldWidget) =>
      colors != oldWidget.colors;
}

const _fontFamily = 'Schibsted Grotesk';

/// Fixed rem-equivalent scale, ratio ≈ 1.2. Not fluid, because phones do not
/// resize.
///
/// The family is named on every style rather than left to `ThemeData.fontFamily`
/// alone: styles copied into `appBarTheme`, `snackBarTheme` and the button
/// themes are not covered by that merge, and would quietly fall back to the
/// platform font.
TextTheme _textTheme(CheckpostColors c) => TextTheme(
  // title
  headlineMedium: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.56,
    color: c.ink,
  ),
  // heading
  titleLarge: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 20,
    height: 26 / 20,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: c.ink,
  ),
  // body
  bodyLarge: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 16,
    height: 23 / 16,
    color: c.ink,
  ),
  // bodyMedium
  titleMedium: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 16,
    height: 23 / 16,
    fontWeight: FontWeight.w500,
    color: c.ink,
  ),
  // label
  labelLarge: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 14,
    height: 19 / 14,
    fontWeight: FontWeight.w500,
    color: c.ink,
  ),
  // caption
  bodySmall: TextStyle(
    fontFamily: _fontFamily,
    fontSize: 13,
    height: 17 / 13,
    color: c.inkMuted,
  ),
);

ThemeData buildTheme(CheckpostColors c, Brightness brightness) {
  final text = _textTheme(c);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: _fontFamily,
    scaffoldBackgroundColor: c.bg,
    canvasColor: c.bg,
    splashFactory: InkSparkle.splashFactory,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.onPrimary,
      secondary: c.primary,
      onSecondary: c.onPrimary,
      // There is deliberately no second red: with a rose accent, a separate
      // destructive colour would muddy the palette and dilute the accent's
      // meaning. Destructive actions are gated behind a sheet that spells out
      // the consequence. Words carry the warning, not hue.
      error: c.primary,
      onError: c.onPrimary,
      surface: c.bg,
      onSurface: c.ink,
      surfaceContainerHighest: c.surface,
      outline: c.lineStrong,
      outlineVariant: c.line,
      scrim: c.scrim,
    ),
    textTheme: text,
    dividerTheme: DividerThemeData(color: c.line, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: c.bg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: c.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: text.titleLarge,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.bg,
      surfaceTintColor: Colors.transparent,
      modalBarrierColor: c.scrim,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radii.lg),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: c.ink,
      contentTextStyle: text.labelLarge?.copyWith(color: c.bg),
      behavior: SnackBarBehavior.floating,
      shape: const RoundedRectangleBorder(borderRadius: Radii.mdAll),
      actionTextColor: c.primary.withValues(alpha: 1),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: c.primary,
      selectionColor: c.primaryQuiet,
      selectionHandleColor: c.primary,
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: InputBorder.none,
      // Placeholders are held to the same 4.5:1 as body text. The default
      // light grey is the most common contrast failure in a form.
      hintStyle: text.bodyLarge?.copyWith(color: c.inkMuted),
      contentPadding: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.primary,
        foregroundColor: c.onPrimary,
        minimumSize: const Size.fromHeight(Space.minTarget),
        textStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        shape: const RoundedRectangleBorder(borderRadius: Radii.mdAll),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: c.primary,
        minimumSize: const Size(Space.minTarget, Space.minTarget),
        textStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        side: BorderSide(color: c.lineStrong),
        minimumSize: const Size.fromHeight(Space.minTarget),
        textStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        shape: const RoundedRectangleBorder(borderRadius: Radii.mdAll),
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: c.inkFaint,
      textColor: c.ink,
      minVerticalPadding: Space.md,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: c.primary,
      linearTrackColor: c.line,
    ),
  );
}
