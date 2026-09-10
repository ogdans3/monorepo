// On a phone the app fills the window; on a desk it is held at 430 across.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/widgets/desk.dart';

void main() {
  Widget app() => const MaterialApp(
        builder: _desk,
        home: Scaffold(body: SizedBox.expand(key: Key('screen'))),
      );

  testWidgets('fills a phone', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app());
    expect(tester.getSize(find.byKey(const Key('screen'))).width, 390);
  });

  testWidgets('is a phone on a desk', (tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app());
    expect(tester.getSize(find.byKey(const Key('screen'))).width, Desk.width);
    expect(tester.getSize(find.byKey(const Key('screen'))).height, 852);
  });
}

Widget _desk(BuildContext context, Widget? child) => Desk(child: child!);
