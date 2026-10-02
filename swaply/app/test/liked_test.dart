// 12 Likt: who liked your things.
//
// Round 5 draws it as a tab's first screen, and on 10.09 it was built as one,
// with no «‹». It is only ever opened over something now — 13's «Se hvem ›»,
// or a like on 12a — and it was the one screen there with no way back but the
// bar. It has a «‹» whenever it has somewhere to go back to, and is drawn as
// the export draws it when it does not.
//
// A device looking around may like things too, and has no profile: no name to
// send and no things to see. It came back as «Slettet bruker», somebody who
// had deleted their account, with «Se tingene deres ›» to nothing.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/liked.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await session.login('ola@epost.no', 'passord');
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

/// A device that liked the drill: what the server sends for one, with the
/// word that says what it is.
const device = {
  'id': 'anon-7',
  'displayName': null,
  'town': null,
  'itemCount': 0,
  'anonymous': true,
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. opened from 13, it has the way back, under the title as 16b has it',
      (tester) async {
    await mount(tester, const ProfileScreen());
    await tester.tap(find.text('Se hvem ›'));
    await tester.pumpAndSettle();

    expect(find.byType(LikedScreen), findsOneWidget);
    expect(find.text('‹'), findsOneWidget);
    // The line under the title starts where the title does.
    expect(tester.getTopLeft(find.text('Folk som har likt tingene dine')).dx,
        tester.getTopLeft(find.text('Likt')).dx);

    await tester.tap(find.bySemanticsLabel('Tilbake'));
    await tester.pumpAndSettle();
    expect(find.byType(LikedScreen), findsNothing);
    expect(find.byType(ProfileScreen), findsOneWidget);
  });

  testWidgets('2. on its own, as the export draws it, it has none', (tester) async {
    await mount(tester, const LikedScreen());

    expect(find.text('‹'), findsNothing);
    expect(find.text('Likt'), findsOneWidget);
  });

  testWidgets('3. a device that liked a thing is «Noen», with nothing to open', (tester) async {
    server.overrides['GET /me/liked-by'] = {
      'items': [
        {
          'item': FakeServer.drill,
          'likers': [FakeServer.kari, device],
        },
      ],
    };
    await mount(tester, const LikedScreen());

    expect(find.text('2 har likt denne'), findsOneWidget);
    expect(find.text('Kari'), findsOneWidget);
    expect(find.text('Noen'), findsOneWidget);
    expect(find.text('Slettet bruker'), findsNothing);
    expect(find.text('Slettet'), findsNothing);
    // Kari's things are a tap away; the device has none, and no profile.
    expect(find.text('Se tingene deres ›'), findsOneWidget);
    expect(find.text('0 gjenstander'), findsNothing);

    await tester.tap(find.text('Noen'));
    await tester.pumpAndSettle();
    expect(find.byType(OtherProfileScreen), findsNothing);
    expect(server.requests.where((r) => r.startsWith('GET /users/')), isEmpty);
  });

  testWidgets('4. …and a server from before it said so is a person, as before', (tester) async {
    // A liker without the word is not anonymous.
    server.overrides['GET /me/liked-by'] = {
      'items': [
        {
          'item': FakeServer.drill,
          'likers': [
            {...device, 'displayName': 'Per H.', 'anonymous': null},
          ],
        },
      ],
    };
    await mount(tester, const LikedScreen());

    expect(find.text('Per'), findsOneWidget);
    expect(find.text('Noen'), findsNothing);
    expect(find.text('Se tingene deres ›'), findsOneWidget);
  });

  testWidgets('5. one thing listed is «1 gjenstand»', (tester) async {
    server.overrides['GET /me/liked-by'] = {
      'items': [
        {
          'item': FakeServer.drill,
          'likers': [
            {...FakeServer.kari, 'itemCount': 1},
            {...FakeServer.kari, 'id': 'anne-1', 'displayName': 'Anne B.', 'itemCount': 4},
          ],
        },
      ],
    };
    await mount(tester, const LikedScreen());

    expect(find.text('1 gjenstand · Bergen'), findsOneWidget);
    expect(find.text('4 gjenstander · Bergen'), findsOneWidget);
    expect(find.textContaining('1 gjenstander'), findsNothing);
  });
}
