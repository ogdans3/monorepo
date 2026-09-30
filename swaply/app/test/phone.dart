// A phone for the tests that look at the app as drawn: the goldens, and the
// tap targets.
//
// Real fonts, because a golden of boxes compares nothing and a word's width is
// a target's width; the export's status bar, because the safe area decides
// where a header's targets reach; the export's photographs, already decoded.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/design/tokens.dart';

import 'export_fixtures.dart' as fx;
import 'fake_photos.dart';

/// The size the export draws a phone at, in logical points.
const phoneSize = Size(390, 844);

/// The export's status bar, and the one a browser does not have.
const exportStatusBar = 46.0;

/// The test binding draws every glyph as a box unless real fonts are loaded, and
/// a picture of boxes is no use for comparing a design. The SDK ships the fonts
/// the app uses; find them next to the tester binary rather than by an absolute
/// path, so this works on any machine. Symbols — ★ ♥ ⇄ → ✓ — come from the
/// system on a phone; here DejaVu stands in, when the machine has it.
Future<void> loadFonts() async {
  final engine = File(Platform.resolvedExecutable).parent; // …/artifacts/engine/<host>
  final fonts = Directory('${engine.parent.parent.path}/material_fonts');

  Future<void> load(String family, List<String> files) async {
    final loader = FontLoader(family);
    var any = false;
    for (final name in files) {
      final file = File(name.startsWith('/') ? name : '${fonts.path}/$name');
      if (file.existsSync()) {
        any = true;
        loader.addFont(file.readAsBytes().then((b) => ByteData.view(Uint8List.fromList(b).buffer)));
      }
    }
    if (any) await loader.load();
  }

  await load('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Black.ttf']);
  await load('MaterialIcons', ['MaterialIcons-Regular.otf']);
  await load('Symbols', ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']);
}

/// The app's theme with the symbol font as a fallback.
ThemeData phoneTheme() {
  final t = swaplyTheme();
  return t.copyWith(
    textTheme: t.textTheme.apply(fontFamilyFallback: const ['Symbols']),
    primaryTextTheme: t.primaryTextTheme.apply(fontFamilyFallback: const ['Symbols']),
  );
}

/// Sets the test's surface to [phoneSize] at three pixels a point, and puts it
/// back when the test ends.
void holdPhone(WidgetTester tester) {
  tester.view.physicalSize = phoneSize * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// The photographs: decoded for real, outside the test's fake clock, and left
/// in the image cache for the screen to find. The hook is put back at once —
/// the binding checks it is unset when the test body ends. The app's own S
/// too, which 01 draws: an asset is decoded outside the clock as well, and a
/// golden taken before it has been leaves a hole where it goes.
Future<void> precachePhotos(WidgetTester tester) async {
  debugNetworkImageHttpClientProvider = PhotoClient.new;
  await tester.pumpWidget(const MaterialApp(home: SizedBox()));
  await tester.runAsync(() async {
    final context = tester.element(find.byType(SizedBox));
    for (final file in fx.photoFiles) {
      await precacheImage(NetworkImage('${fx.photos}$file'), context);
    }
    await precacheImage(const AssetImage('assets/brand/s.png'), context);
  });
  debugNetworkImageHttpClientProvider = null;
}

/// The export's status bar: «9:41» and a battery, [statusBar] tall, white on
/// the green screens. The app is told it is there, so its safe areas match.
/// At nought it is a browser, which draws none and reports none.
class PhoneFrame extends StatelessWidget {
  const PhoneFrame(
      {super.key, required this.light, required this.child, this.statusBar = exportStatusBar});

  final bool light;
  final double statusBar;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final ink = light ? Colors.white : SwaplyColors.ink;
    return Stack(
      children: [
        MediaQuery(
          data: mq.copyWith(
            padding: mq.padding.copyWith(top: statusBar),
            viewPadding: mq.viewPadding.copyWith(top: statusBar),
            // A picture cannot drift: the confetti holds still, as on a phone
            // that has asked for less motion.
            disableAnimations: true,
          ),
          child: child,
        ),
        // The system's, not the app's: a touch there goes on to the app.
        if (statusBar > 0) ...[
          Positioned(
            left: 26,
            top: 15,
            // Outside any Material, so the family has to be said.
            child: IgnorePointer(
              child: Text('9:41',
                  style: TextStyle(
                      fontFamily: 'Roboto',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: ink,
                      decoration: TextDecoration.none)),
            ),
          ),
          Positioned(
            right: 26,
            top: 15,
            child: IgnorePointer(
              child: Container(
                width: 29,
                height: 17,
                padding: const EdgeInsets.all(1.5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: ink.withValues(alpha: light ? 0.5 : 0.35)),
                ),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 16,
                    height: 12,
                    decoration:
                        BoxDecoration(color: ink, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
