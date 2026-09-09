import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/main.dart';

void main() {
  testWidgets('the app builds and names itself', (tester) async {
    await tester.pumpWidget(const SwaplyApp());

    expect(find.text('Swaply'), findsOneWidget);
  });
}
