// The icon and the launch, as the platforms hold them.
//
// `tool/icon/make.py` cuts every icon and launch image from the one picture in
// `tool/icon/`, and the platforms each keep their part somewhere of their own:
// an asset catalog, Android's resources, the web's folder. This holds them to
// what the app and the stores expect. iOS takes no icon with transparency in it,
// Android 8 and later want three layers, and every launch screen draws the same
// S the same size on the same green that screen 01 draws it on, so nothing
// moves or changes colour when the app takes over from the phone.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/design/tokens.dart';
import 'package:swaply_app/screens/onboarding.dart';

/// Width, height and whether it has an alpha channel, from a PNG's header.
({int width, int height, bool alpha}) png(String path) {
  final bytes = File(path).readAsBytesSync();
  int word(int at) =>
      bytes[at] << 24 | bytes[at + 1] << 16 | bytes[at + 2] << 8 | bytes[at + 3];
  // IHDR: width, height, bit depth, then the colour type; 4 and 6 carry alpha.
  return (width: word(16), height: word(20), alpha: bytes[25] == 4 || bytes[25] == 6);
}

const res = 'android/app/src/main/res';
const densities = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0};

String hex(int argb) => '#${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';
final green = hex(SwaplyColors.greenDeep.toARGB32());

void main() {
  test('1. every icon iOS lists is there, at its size, and opaque', () {
    const dir = 'ios/Runner/Assets.xcassets/AppIcon.appiconset';
    final list = File('$dir/Contents.json').readAsStringSync();
    final entries = RegExp(r'"size" : "([\d.]+)x[\d.]+",\s*"idiom" : "[\w-]+",\s*"filename" : "([^"]+)",\s*"scale" : "(\d)x"')
        .allMatches(list)
        .toList();
    expect(entries, hasLength(19));
    for (final e in entries) {
      final side = (double.parse(e[1]!) * int.parse(e[3]!)).round();
      final icon = png('$dir/${e[2]}');
      expect((icon.width, icon.height), (side, side), reason: e[2]);
      expect(icon.alpha, isFalse, reason: '${e[2]}: the App Store refuses an icon with alpha');
    }
  });

  test('2. Android 8 and later get the three layers, and 7 its square', () {
    final adaptive = File('$res/mipmap-anydpi-v26/ic_launcher.xml').readAsStringSync();
    expect(adaptive, contains('@color/ic_launcher_background'));
    expect(adaptive, contains('@mipmap/ic_launcher_foreground'));
    expect(adaptive, contains('@mipmap/ic_launcher_monochrome'));
    for (final MapEntry(key: name, value: d) in densities.entries) {
      final square = png('$res/mipmap-$name/ic_launcher.png');
      expect((square.width, square.height), ((48 * d).round(), (48 * d).round()), reason: name);
      for (final layer in ['ic_launcher_foreground', 'ic_launcher_monochrome']) {
        final image = png('$res/mipmap-$name/$layer.png');
        expect((image.width, image.height), ((108 * d).round(), (108 * d).round()),
            reason: '$name/$layer');
        expect(image.alpha, isTrue, reason: '$name/$layer is a layer, over the background');
      }
    }
  });

  test('3. every launch screen draws the S as tall as 01 does', () {
    const tall = SplashScreen.markHeight;
    for (final MapEntry(key: name, value: d) in densities.entries) {
      expect(png('$res/drawable-$name/splash_s.png').height, (tall * d).round(), reason: name);
      // Android 12's splash is a 288 square, drawn at the size it is.
      final twelve = png('$res/drawable-$name/splash_icon.png');
      expect((twelve.width, twelve.height), ((288 * d).round(), (288 * d).round()), reason: name);
    }
    for (final (scale, file) in [(1, 'LaunchImage.png'), (2, 'LaunchImage@2x.png'), (3, 'LaunchImage@3x.png')]) {
      expect(png('ios/Runner/Assets.xcassets/LaunchImage.imageset/$file').height,
          (tall * scale).round(), reason: file);
    }
    for (final (scale, file) in [(1, 's.png'), (2, '2.0x/s.png'), (3, '3.0x/s.png')]) {
      expect(png('assets/brand/$file').height, (tall * scale).round(), reason: file);
    }
  });

  test('4. every launch screen is the green 01 is drawn on', () {
    expect(File('$res/values/colors.xml').readAsStringSync(),
        contains('<color name="splash_background">$green</color>'));
    for (final drawable in ['drawable', 'drawable-v21']) {
      final launch = File('$res/$drawable/launch_background.xml').readAsStringSync();
      expect(launch, contains('@color/splash_background'), reason: drawable);
      expect(launch, contains('@drawable/splash_s'), reason: drawable);
    }
    for (final values in ['values-v31', 'values-night-v31']) {
      final styles = File('$res/$values/styles.xml').readAsStringSync();
      expect(styles, contains('"android:windowSplashScreenBackground">@color/splash_background'),
          reason: values);
      expect(styles, contains('"android:windowSplashScreenAnimatedIcon">@drawable/splash_icon'),
          reason: values);
    }

    // iOS's storyboard writes the colour as three fractions of 1.
    final board = File('ios/Runner/Base.lproj/LaunchScreen.storyboard').readAsStringSync();
    final colour = RegExp(r'<color key="backgroundColor" red="([\d.]+)" green="([\d.]+)" blue="([\d.]+)"')
        .firstMatch(board)!;
    final g = SwaplyColors.greenDeep;
    expect([for (var i = 1; i <= 3; i++) (double.parse(colour[i]!) * 255).round()],
        [(g.r * 255).round(), (g.g * 255).round(), (g.b * 255).round()]);

    // The web's page before the app, and what a phone paints around it.
    expect(File('web/index.html').readAsStringSync(), contains('background-color: $green'));
    final manifest = File('web/manifest.json').readAsStringSync();
    expect(manifest, contains('"background_color": "$green"'));
    expect(manifest, contains('"theme_color": "$green"'));
  });

  test('5. the web has its icons, and Play Console its 512', () {
    expect(png('web/favicon.png').width, 64);
    expect(png('web/icons/apple-touch-icon.png').width, 180);
    for (final side in [192, 512]) {
      expect(png('web/icons/swaply-$side.png').width, side);
      expect(png('web/icons/swaply-maskable-$side.png').width, side);
    }
    final store = png('tool/icon/play-store-512.png');
    expect((store.width, store.height, store.alpha), (512, 512, true),
        reason: 'Play Console asks for a 512 square, 32-bit');
  });
}
