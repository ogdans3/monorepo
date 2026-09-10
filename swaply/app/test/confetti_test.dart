// The confetti moves — slowly — and holds still when the phone asks for less
// motion, which is also what lets every other test call pumpAndSettle.
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/widgets/confetti.dart';

void main() {
  Future<Uint8List> pixels(WidgetTester tester, GlobalKey key) async {
    late Uint8List bytes;
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage();
      bytes = (await image.toByteData())!.buffer.asUint8List();
    });
    return bytes;
  }

  Widget frame(GlobalKey key, {required bool still}) => MediaQuery(
        data: MediaQueryData(size: const Size(390, 844), disableAnimations: still),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: const ColoredBox(color: Color(0xFF064E3B), child: Confetti()),
          ),
        ),
      );

  testWidgets('drifts upward over a few seconds', (tester) async {
    final key = GlobalKey();
    await tester.pumpWidget(frame(key, still: false));
    final before = await pixels(tester, key);
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    final after = await pixels(tester, key);
    expect(after, isNot(equals(before)));
  });

  testWidgets('holds still when the phone asks for less motion', (tester) async {
    final key = GlobalKey();
    await tester.pumpWidget(frame(key, still: true));
    final before = await pixels(tester, key);
    await tester.pump(const Duration(seconds: 3));
    final after = await pixels(tester, key);
    expect(after, equals(before));
    // And nothing is left ticking, so pumpAndSettle returns.
    await tester.pumpAndSettle();
  });
}
