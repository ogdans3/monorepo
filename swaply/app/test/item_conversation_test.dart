// The box on 04 is the conversation about the listing, once there is one.
//
// It opens on what was said there last, with «Åpne ›» to the rest, drawn the
// way the card on 06b draws it. So a message sent from here is still there
// when the listing is opened again, and one sent now shows as soon as the
// server has it, in the server's words. The box used to say «Meldingen er
// sendt» and show nothing of what was sent, and on the next visit it did not
// even say that.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/item_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: const MaterialApp(home: ItemDetailScreen(itemId: 'item-console')),
    ),
  );
  await tester.pumpAndSettle();
}

/// The words in the box's bubble, and nowhere else.
Finder said(String words) =>
    find.descendant(of: find.byType(LastMessage), matching: find.text(words));

Finder get field => find.widgetWithText(TextField, 'Skriv en melding til Kari…');

Future<void> send(WidgetTester tester, String words) async {
  await tester.ensureVisible(field);
  await tester.enterText(field, words);
  await tester.tap(find.text('Send'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. a listing you have written about opens on what was said last', (tester) async {
    server.overrides['GET /items/item-console'] = {
      ...FakeServer.console,
      'owner': FakeServer.kari,
      'conversation': {
        'tradeId': 'trade-1',
        'threadId': 'thread-1',
        'lastMessage': {'body': 'Den er ledig, ja!', 'senderName': 'Kari N.', 'mine': false},
      },
    };
    await mount(tester);

    expect(said('Den er ledig, ja!'), findsOneWidget);
    expect(find.text('Åpne ›'), findsOneWidget);
  });

  testWidgets('2. «Åpne ›» opens the conversation itself', (tester) async {
    server.overrides['GET /items/item-console'] = {
      ...FakeServer.console,
      'owner': FakeServer.kari,
      'conversation': {'tradeId': 'trade-1', 'threadId': 'thread-1', 'lastMessage': null},
    };
    await mount(tester);
    expect(find.byType(LastMessage), findsNothing);

    await tester.ensureVisible(find.text('Åpne ›'));
    await tester.tap(find.text('Åpne ›'));
    await tester.pumpAndSettle();

    expect(find.byType(ThreadScreen), findsOneWidget);
    expect(tester.widget<ThreadScreen>(find.byType(ThreadScreen)).threadId, 'thread-1');
  });

  testWidgets('3. a message sent is the last thing said, in the server\'s words',
      (tester) async {
    await mount(tester);
    expect(find.byType(LastMessage), findsNothing);
    expect(find.text('Åpne ›'), findsNothing);

    await send(tester, 'Er den ledig?  ');

    expect(said('Er den ledig?'), findsOneWidget);
    expect(find.text('Åpne ›'), findsOneWidget);
    // The field is cleared for the next one.
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
  });

  testWidgets('4. an API that answers without the message still shows what was typed',
      (tester) async {
    server.overrides['POST /items/item-console/message'] = {
      'tradeId': 'trade-1',
      'threadId': 'thread-1',
    };
    await mount(tester);

    await send(tester, 'Er den ledig?');

    expect(said('Er den ledig?'), findsOneWidget);
    expect(find.text('Åpne ›'), findsOneWidget);
  });

  testWidgets('5. a message that did not go is not drawn as said, and stays in the field',
      (tester) async {
    server.overrides['POST /items/item-console/message'] = unreachable;
    await mount(tester);

    await send(tester, 'Er den ledig?');

    expect(find.byType(LastMessage), findsNothing);
    expect(find.text('Åpne ›'), findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Er den ledig?');
  });
}
