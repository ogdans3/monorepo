// «Del» on 04 and «Inviter en venn» on 16b: the share sheet.
//
// A link is an invitation from somebody, so the server makes one only for a
// profile. A device looking around pressed «Del» and was told why in coral,
// with nothing to press: a dead end on the one screen that is meant to bring
// people in. It gets «Lag profil» there now — 10c, as writing a message on 04
// is — and the link once the profile is made. No answer gets «Prøv igjen».
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = true}) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  if (signedIn) await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        home: screen,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The share route as the real one answers: a link for a profile, and the
/// refusal for a device.
void shareAnswers() {
  server.overrides['POST /items/item-console/share'] = (http.Request request) =>
      request.headers['authorization'] == 'Bearer ${FakeServer.deviceToken}'
          ? Refusal.accountRequired
          : {
              'token': FakeServer.shareToken,
              'url': 'http://web/i/${FakeServer.shareToken}',
              'text': 'Se denne på Swaply: Retro spillkonsoll, verdi 1 200 kr. '
                  'http://web/i/${FakeServer.shareToken}',
            };
}

Finder get sheet => find.byType(BottomSheet);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. a device is offered «Lag profil», and gets the link once it has one',
      (tester) async {
    shareAnswers();
    await session.lookAround();
    await mount(tester, const ItemDetailScreen(itemId: 'item-console'), signedIn: false);

    await tester.tap(find.bySemanticsLabel('Del'));
    await tester.pumpAndSettle();
    expect(find.text(Refusal.accountRequired.message), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.text('Lag profil')), findsOneWidget);

    await tester.tap(find.descendant(of: sheet, matching: find.text('Lag profil')));
    await tester.pumpAndSettle();
    expect(sheet, findsNothing);
    expect(find.byType(CreateProfileScreen), findsOneWidget);

    for (final (field, text) in [
      (0, 'Ola N.'),
      (1, 'ola@epost.no'),
      (2, '412 34 567'),
      (3, 'drillbits123'),
    ]) {
      await tester.enterText(find.byType(TextField).at(field), text);
    }
    await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
    await tester.pumpAndSettle();

    // Back on 04, with the sheet up again and the link in it.
    expect(find.byType(CreateProfileScreen), findsNothing);
    expect(session.anonymous, isFalse);
    expect(find.textContaining('Se denne på Swaply: Retro spillkonsoll'), findsOneWidget);
    expect(find.text('Kopier lenke'), findsOneWidget);
    expect(server.bearers['POST /items/item-console/share'], 'Bearer tok');
  });

  testWidgets('2. …and 10c left without a profile asks nothing more', (tester) async {
    shareAnswers();
    await session.lookAround();
    await mount(tester, const ItemDetailScreen(itemId: 'item-console'), signedIn: false);

    await tester.tap(find.bySemanticsLabel('Del'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: sheet, matching: find.text('Lag profil')));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Tilbake'));
    await tester.pumpAndSettle();

    expect(find.byType(ItemDetailScreen), findsOneWidget);
    expect(sheet, findsNothing);
    expect(server.asked('POST /items/item-console/share'), 1);
  });

  testWidgets('3. no answer is «Prøv igjen», and the link comes when it is pressed',
      (tester) async {
    var answer = false;
    server.overrides['POST /items/item-drill/share'] =
        (http.Request _) => answer ? asUsual : unreachable;
    await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));

    await tester.tap(find.bySemanticsLabel('Del'));
    await tester.pumpAndSettle();
    expect(find.text(noContact), findsOneWidget);
    expect(find.text('Lag profil'), findsNothing);

    answer = true;
    await tester.tap(find.text('Prøv igjen'));
    await tester.pumpAndSettle();
    expect(find.text(noContact), findsNothing);
    expect(find.textContaining('Se denne på Swaply: Bosch drill 18V'), findsOneWidget);
    expect(server.asked('POST /items/item-drill/share'), 2);
  });

  testWidgets('4. 16b\'s invitation gets «Prøv igjen» too', (tester) async {
    var answer = false;
    server.overrides['POST /invites'] = (http.Request _) => answer ? asUsual : unreachable;
    await mount(tester, const SettingsScreen());

    await tester.tap(find.text('Inviter en venn'));
    await tester.pumpAndSettle();
    answer = true;
    await tester.tap(find.text('Prøv igjen'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Ola N. inviterer deg til Swaply'), findsOneWidget);
  });

  testWidgets('5. any other refusal is only said: it is the server\'s last word', (tester) async {
    server.overrides['POST /items/item-drill/share'] =
        const Refusal(404, 'not_found', 'Fant ikke gjenstanden.');
    await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));

    await tester.tap(find.bySemanticsLabel('Del'));
    await tester.pumpAndSettle();

    expect(find.descendant(of: sheet, matching: find.text('Fant ikke gjenstanden.')),
        findsOneWidget);
    expect(find.text('Prøv igjen'), findsNothing);
    expect(find.text('Lag profil'), findsNothing);
  });
}
