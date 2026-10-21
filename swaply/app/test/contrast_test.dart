// Every colour that carries words reaches WCAG AA, 4.5:1 against what it sits
// on — the product owner's call on 21.10.2026, after the second test round
// measured the greys at 2.5 to 4.2:1 and coral error text at 2.8:1. The colours
// were darkened in their own hues only as far as that asks, so this holds the
// floor without saying anything about how they look.
import 'dart:math' as math;
import 'dart:ui' show Color;

import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/widgets/shell.dart';

double _channel(double c) =>
    c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();

double _luminance(Color c) =>
    0.2126 * _channel(c.r) + 0.7152 * _channel(c.g) + 0.0722 * _channel(c.b);

double contrast(Color a, Color b) {
  final la = _luminance(a), lb = _luminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  const white = Color(0xFFFFFFFF);
  const light = {'bg': SwaplyColors.bg, 'surface': SwaplyColors.surface, 'white': white};

  // Words on the light screens.
  const onLight = {
    'ink': SwaplyColors.ink,
    'inkBody': SwaplyColors.inkBody,
    'inkMuted': SwaplyColors.inkMuted,
    'chipInk': SwaplyColors.chipInk,
    'greySoft': SwaplyColors.greySoft,
    'grey': SwaplyColors.grey,
    'greyLight': SwaplyColors.greyLight,
    'greenText': SwaplyColors.greenText,
    'redText': SwaplyColors.redText,
    'coralText': SwaplyColors.coralText,
    'reportText': SwaplyColors.reportText,
    'amber': SwaplyColors.amber,
    'amberText': SwaplyColors.amberText,
  };

  for (final word in onLight.entries) {
    for (final ground in light.entries) {
      test('${word.key} on ${ground.key} reads at 4.5:1', () {
        expect(contrast(word.value, ground.value), greaterThanOrEqualTo(4.5));
      });
    }
  }

  test('the ambers read on their own tints', () {
    expect(contrast(SwaplyColors.amber, SwaplyColors.amberSoft), greaterThanOrEqualTo(4.5));
    expect(contrast(SwaplyColors.amberText, SwaplyColors.amberBg), greaterThanOrEqualTo(4.5));
  });

  test('a white initial reads on every avatar colour, and white words on a report button', () {
    for (final c in [
      SwaplyColors.avatarGold,
      SwaplyColors.avatarTeal,
      SwaplyColors.avatarPurple,
      SwaplyColors.greenDeep,
      SwaplyColors.reportText,
      SwaplyColors.badge,
      AdminColors.accentFill,
    ]) {
      expect(contrast(white, c), greaterThanOrEqualTo(4.5), reason: '$c');
    }
  });

  test('words on the dark grounds read too', () {
    expect(contrast(SwaplyColors.coralOnDark, SwaplyColors.greenDeep), greaterThanOrEqualTo(4.5));
    expect(contrast(AdminColors.accent, AdminColors.surface), greaterThanOrEqualTo(4.5));
    expect(contrast(SwaplyColors.coral, AdminColors.surface), greaterThanOrEqualTo(4.5));
  });

  test('every status pill on the trade page reads on its own ground', () {
    for (final tone in PillTone.values) {
      expect(contrast(tone.ink, tone.ground), greaterThanOrEqualTo(4.5), reason: tone.name);
    }
  });

  test('the two reds stay two values, as words too', () {
    expect(SwaplyColors.coral, isNot(SwaplyColors.red));
    expect(SwaplyColors.coralText, isNot(SwaplyColors.reportText));
  });

  test('the greys keep their order, darkest to lightest', () {
    expect(_luminance(SwaplyColors.inkMuted), lessThan(_luminance(SwaplyColors.greySoft)));
    expect(_luminance(SwaplyColors.greySoft), lessThan(_luminance(SwaplyColors.grey)));
    expect(_luminance(SwaplyColors.grey), lessThan(_luminance(SwaplyColors.greyLight)));
  });
}
