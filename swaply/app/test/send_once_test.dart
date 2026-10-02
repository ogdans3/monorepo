// A message is sent once, and a conversation closed while it went is left
// alone.
//
// The field in the trade page's conversation card had no guard while its
// message was on its way, as 06g and 04 have: «Send» pressed twice, or the
// return key and then «Send», sent the same words twice. And 06g, closed
// while its message was on its way, went on to clear a field that had gone
// with the screen and to ask for the conversation again.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// [screen] opened over a first page, so it has somewhere to go back to.
Future<void> open(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await session.login('ola@epost.no', 'passord');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: api),
        ChangeNotifierProvider<Session>.value(value: session),
      ],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () =>
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen)),
                child: const Text('Først'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Først'));
  await tester.pumpAndSettle();
}

/// The server's answer to a message, held until [answer] is completed.
Completer<void> holdMessages() {
  final answer = Completer<void>();
  server.overrides['POST /threads/thread-1/messages'] =
      (http.Request _) => answer.future.then((_) => asUsual);
  return answer;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. the trade page sends a message once, however often it is pressed',
      (tester) async {
    await open(tester, const TradeDetailScreen(tradeId: 'trade-1'));
    final answer = holdMessages();

    await tester.enterText(find.byType(TextField), 'Passer bra!');
    await tester.tap(find.text('Send'));
    await tester.pump();
    await tester.tap(find.text('Send'));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(server.asked('POST /threads/thread-1/messages'), 1);

    answer.complete();
    await tester.pumpAndSettle();

    expect(server.asked('POST /threads/thread-1/messages'), 1);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
    // And «Send» answers again for the next one.
    await tester.enterText(find.byType(TextField), 'Sees!');
    await tester.tap(find.text('Send'));
    await tester.pumpAndSettle();
    expect(server.asked('POST /threads/thread-1/messages'), 2);
  });

  testWidgets('2. 06g closed while its message is on its way is left alone', (tester) async {
    await open(tester, const ThreadScreen(threadId: 'thread-1'));
    final answer = holdMessages();
    await tester.enterText(find.byType(TextField).last, 'Passer bra!');
    await tester.tap(find.text('Send'));
    await tester.pump();

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(ThreadScreen), findsNothing);
    final asked = server.asked('GET /threads/thread-1');

    answer.complete();
    await tester.pumpAndSettle();

    // Nothing thrown at a field that went with the screen, and nothing
    // asked for on behalf of a screen that is not there.
    expect(tester.takeException(), isNull);
    expect(server.asked('GET /threads/thread-1'), asked);
  });
}
