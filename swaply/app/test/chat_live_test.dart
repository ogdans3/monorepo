// 06g keeps up while it is open.
//
// It asked for the conversation when it opened and after a send, and never
// again: a reply landed on the server and not on the screen until the person
// left and came back. And «read» was whatever was newest when the read call
// reached the server, a message that arrived after the screen asked
// included, which then never counted as unread.
//
// Now it asks every `ThreadScreen.pollEvery` while it is the screen on top
// and the app is in front, at once when the app comes back, and when the
// list is pulled down; it stops when the screen goes, the app goes to the
// background or something opens over it. It tells the server it has read up
// to the last message it has drawn (`upTo`), and only when that changes.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

/// 06g opened over a first page, so it has somewhere to go back to.
Future<void> open(WidgetTester tester) async {
  tester.view.physicalSize = const Size(430, 900);
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
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => const ThreadScreen(threadId: 'thread-1'))),
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

/// The conversation with [more] messages from Kari after the canned two.
Map<String, Object?> thread({int more = 1}) => {
      ...FakeServer.thread,
      'messages': [
        ...FakeServer.thread['messages'] as List,
        for (var i = 1; i <= more; i++)
          {
            'id': 'k$i',
            'senderId': 'kari-1',
            'senderName': 'Kari N.',
            'body': 'Melding $i fra Kari',
            'mine': false,
            'createdAt': '2026-09-09T07:${(10 + i).toString().padLeft(2, '0')}:00Z',
          },
      ],
    };

int asked(String request) => server.asked(request);

Future<void> waitAPoll(WidgetTester tester, [int polls = 1]) async {
  await tester.pump(ThreadScreen.pollEvery * polls);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. it reads up to the last message it drew', (tester) async {
    await open(tester);

    expect(server.bodies['POST /threads/thread-1/read'], {'upTo': 'm2'});
  });

  testWidgets('2. a reply that lands while it is open is on screen within a poll, and read',
      (tester) async {
    await open(tester);
    server.overrides['GET /threads/thread-1'] = thread();

    await waitAPoll(tester);

    expect(find.text('Melding 1 fra Kari'), findsOneWidget);
    expect(server.bodies['POST /threads/thread-1/read'], {'upTo': 'k1'});
    expect(asked('POST /threads/thread-1/read'), 2);
  });

  testWidgets('3. a poll that brings nothing new tells the server nothing', (tester) async {
    await open(tester);
    final me = asked('GET /me');

    await waitAPoll(tester, 3);

    expect(asked('GET /threads/thread-1'), 4);
    expect(asked('POST /threads/thread-1/read'), 1);
    expect(asked('GET /me'), me);
  });

  testWidgets('4. nothing is asked from the background, and all of it on the way back',
      (tester) async {
    await open(tester);
    for (final state in [
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
    ]) {
      tester.binding.handleAppLifecycleStateChanged(state);
    }
    server.overrides['GET /threads/thread-1'] = thread();
    final before = asked('GET /threads/thread-1');

    await waitAPoll(tester, 3);
    expect(asked('GET /threads/thread-1'), before);

    for (final state in [
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]) {
      tester.binding.handleAppLifecycleStateChanged(state);
    }
    await tester.pumpAndSettle();
    expect(asked('GET /threads/thread-1'), before + 1);
    expect(find.text('Melding 1 fra Kari'), findsOneWidget);

    // And it goes on asking from there.
    await waitAPoll(tester);
    expect(asked('GET /threads/thread-1'), before + 2);
  });

  testWidgets('5. nothing is asked while a sheet is open over it', (tester) async {
    await open(tester);
    await tester.tap(find.text('Foreslå mellomlegg'));
    await tester.pumpAndSettle();
    final before = asked('GET /threads/thread-1');

    await waitAPoll(tester, 3);

    expect(asked('GET /threads/thread-1'), before);
  });

  testWidgets('6. nothing is asked once it is closed', (tester) async {
    await open(tester);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(ThreadScreen), findsNothing);
    final before = asked('GET /threads/thread-1');

    await waitAPoll(tester, 3);

    expect(asked('GET /threads/thread-1'), before);
  });

  testWidgets('7. pulled down, it asks at once', (tester) async {
    await open(tester);
    server.overrides['GET /threads/thread-1'] = thread();
    final before = asked('GET /threads/thread-1');

    await tester.fling(find.text('Passer bra! Kl. 17?'), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(asked('GET /threads/thread-1'), before + 1);
    expect(find.text('Melding 1 fra Kari'), findsOneWidget);
  });

  testWidgets('8. a poll with no answer says nothing, and keeps the conversation',
      (tester) async {
    await open(tester);
    server.overrides['GET /threads/thread-1'] = unreachable;

    await waitAPoll(tester);

    expect(find.byType(SwaplyToast), findsNothing);
    expect(find.text('Passer bra! Kl. 17?'), findsOneWidget);
  });

  testWidgets('9. a reply does not pull the list away from what was scrolled up to',
      (tester) async {
    server.overrides['GET /threads/thread-1'] = thread(more: 30);
    await open(tester);
    final list = tester.state<ScrollableState>(find.byType(Scrollable).last).position;
    // Opened at the newest message.
    expect(list.pixels, list.maxScrollExtent);

    list.jumpTo(0);
    await tester.pump();
    server.overrides['GET /threads/thread-1'] = thread(more: 31);
    await waitAPoll(tester);
    expect(list.pixels, 0);

    // At the end it follows the conversation.
    list.jumpTo(list.maxScrollExtent);
    await tester.pump();
    server.overrides['GET /threads/thread-1'] = thread(more: 32);
    await waitAPoll(tester);
    expect(list.pixels, list.maxScrollExtent);
    expect(find.text('Melding 32 fra Kari'), findsOneWidget);
  });
}
