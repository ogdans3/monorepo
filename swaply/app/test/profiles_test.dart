// The people in a conversation or a trade open who they are.
//
// Report and block live on 13b, and nothing in a chat or a trade under way
// led there: somebody who turned unpleasant in a conversation could be
// reported from a listing of theirs, or from a trade once it was finished,
// and from nowhere in between. The export draws no button for it, and the
// brief has 13b reached «fra en avatar i en samtale». So the face and name in
// 06g's header open their 13b; in a ring, 07k's title asks which of the two;
// and the people on a trade page open theirs, and the trade is asked for
// again on the way back, since a block made there ends it.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/chat.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/screens/trade_detail.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
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
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

/// The face and the name at the top of the conversation.
final header = find.descendant(of: find.byType(AppBar), matching: find.byType(TapArea));

String? profileShown(WidgetTester tester) =>
    tester.widgetList<OtherProfileScreen>(find.byType(OtherProfileScreen)).singleOrNull?.userId;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
    server.overrides['GET /users/per-1'] = {
      'id': 'per-1',
      'displayName': 'Per H.',
      'town': 'Stjørdal',
      'items': const [],
    };
  });

  testWidgets('1. in 06g, the face and the name open their profile', (tester) async {
    await mount(tester, const ThreadScreen(threadId: 'thread-1'));

    await tester.tap(header);
    await tester.pumpAndSettle();

    expect(profileShown(tester), 'kari-1');
    // Where report and block are: «⋯».
    await tester.tap(find.byIcon(Icons.more_horiz));
    await tester.pumpAndSettle();
    expect(find.text('Rapporter Kari N.'), findsOneWidget);
    expect(find.text('Blokkér Kari N.'), findsOneWidget);
  });

  testWidgets('2. in 07k, the title asks which of the two, and opens theirs', (tester) async {
    server.overrides['GET /threads/thread-1'] = {
      ...FakeServer.thread,
      'kind': 'chain',
      'participants': [
        {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
        {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
        {'id': 'per-1', 'displayName': 'Per H.', 'position': 2},
      ],
    };
    server.overrides['GET /trades/trade-1'] = chainTrade();
    await mount(tester, const ThreadScreen(threadId: 'thread-1'));

    await tester.tap(header);
    await tester.pumpAndSettle();
    expect(find.text('Se profil'), findsOneWidget);
    expect(find.text('Kari N.'), findsWidgets);

    await tester.tap(find.text('Per H.').last);
    await tester.pumpAndSettle();
    expect(profileShown(tester), 'per-1');
  });

  testWidgets('3. in the app, 13b goes into the tab under the chat, with the bar, as drawn',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await session.login('ola@epost.no', 'passord');
    await tester.pumpWidget(
        ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)));
    await tester.pumpAndSettle();
    await tester
        .tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Chats')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kari'));
    await tester.pumpAndSettle();
    expect(find.byType(ThreadScreen), findsOneWidget);

    await tester.tap(header);
    await tester.pumpAndSettle();

    // The chat covers the bar, so it is taken down first.
    expect(find.byType(ThreadScreen), findsNothing);
    expect(profileShown(tester), 'kari-1');
    expect(find.byType(SwaplyNavBar), findsOneWidget);
    // Back is the Chats list it was opened from.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(OtherProfileScreen), findsNothing);
    expect(find.byType(ChatsScreen), findsOneWidget);
  });

  testWidgets('4. on a trade page, the person opens their profile, and the trade is asked '
      'for again on the way back', (tester) async {
    await mount(tester, const TradeDetailScreen(tradeId: 'trade-1'));
    final asked = server.asked('GET /trades/trade-1');

    // The person on the card: her name, «Kari».
    await tester.tap(find.text('Kari'));
    await tester.pumpAndSettle();
    expect(profileShown(tester), 'kari-1');

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(OtherProfileScreen), findsNothing);
    expect(server.asked('GET /trades/trade-1'), asked + 1);
  });
}
