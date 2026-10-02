// What Flutter says itself, it says in Norwegian.
//
// Every word of the app's own is Norwegian, but the words Flutter brings —
// «Copy» and «Paste» over a field, «Dismiss» for the dimming behind a sheet,
// «Back» and «Close» for a screen reader — were English whatever the phone was
// set to, because the app never said which language it speaks. It says so
// now, Bokmål, in `main.dart`; on iOS `Info.plist` lists it too, so the
// system's own sheets (the photo picker, sharing) follow, and the web page is
// `lang="nb"` for a browser's screen reader.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

void main() {
  testWidgets('the app tells Flutter it speaks Bokmål, and Flutter answers in it', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    SharedPreferences.setMockInitialValues({});

    final server = FakeServer();
    final api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    final session = Session(api);
    await tester.pumpWidget(
      ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
    );
    await tester.pump();

    final context = tester.element(find.byType(Navigator).first);
    expect(Localizations.localeOf(context), const Locale('nb', 'NO'));

    final material = MaterialLocalizations.of(context);
    expect(material.copyButtonLabel, 'Kopiér');
    expect(material.pasteButtonLabel, 'Lim inn');
    expect(material.backButtonTooltip, 'Tilbake');
    expect(material.closeButtonTooltip, 'Lukk');
    expect(material.modalBarrierDismissLabel, 'Avvis');
  });
}
