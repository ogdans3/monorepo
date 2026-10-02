// 13 Profil and what opens from it.
//
// Everything on 13 is the session's — the things, the likes, the rating — so
// 13 is only as current as the last time the session asked who you are.
import 'dart:convert';

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
        onGenerateRoute: (settings) => MaterialPageRoute(
            settings: settings,
            builder: (_) => Scaffold(body: Center(child: Text(settings.name ?? '')))),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The drill, as its owner opens it: their own.
const ownDrill = {
  ...FakeServer.drill,
  'owner': {'id': 'me-1', 'displayName': 'Ola N.'},
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('a listing changed on 04 is changed on 13', () {
    testWidgets('1. taken down, 04 says so, and 13 no longer has it', (tester) async {
      var gone = false;
      server.overrides['GET /items/item-drill'] = ownDrill;
      server.overrides['DELETE /items/item-drill'] = (http.Request _) {
        gone = true;
        return <String, Object?>{};
      };
      server.overrides['GET /me'] =
          (http.Request _) => {...FakeServer.me, if (gone) 'items': const <Object>[]};
      await mount(tester, const ProfileScreen());
      expect(find.text('Mine gjenstander · 1'), findsOneWidget);

      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fjern annonsen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SecondaryButton, 'Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(server.requests, contains('DELETE /items/item-drill'));
      expect(find.byType(ItemDetailScreen), findsNothing);
      expect(find.text('Annonsen er fjernet.'), findsOneWidget);
      expect(find.text('Mine gjenstander · 0'), findsOneWidget);
      expect(find.text('Bosch drill 18V'), findsNothing);
      expect(session.me!.items, isEmpty);
    });

    testWidgets('2. …and a refusal leaves the page, and says why', (tester) async {
      server.overrides['GET /items/item-drill'] = ownDrill;
      server.overrides['DELETE /items/item-drill'] = const Refusal(
          400, 'item_reserved', 'Gjenstanden er reservert i et bytte.');
      await mount(tester, const ItemDetailScreen(itemId: 'item-drill'));

      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fjern annonsen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SecondaryButton, 'Fjern annonsen'));
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsOneWidget);
      expect(find.text('Gjenstanden er reservert i et bytte.'), findsOneWidget);
      expect(find.text('Annonsen er fjernet.'), findsNothing);
    });

    testWidgets('3. corrected, 13 has the new words once 04 is closed', (tester) async {
      var title = 'Bosch drill 18V';
      server.overrides['GET /items/item-drill'] = (http.Request _) => {...ownDrill, 'title': title};
      server.overrides['PATCH /items/item-drill'] = (http.Request _) {
        title = 'Bosch drill 18V med koffert';
        return {...FakeServer.drill, 'title': title};
      };
      server.overrides['GET /me'] = (http.Request _) => {
            ...FakeServer.me,
            'items': [
              {...FakeServer.drill, 'title': title},
            ],
          };
      await mount(tester, const ProfileScreen());

      await tester.tap(find.text('Bosch drill 18V'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.more_horiz));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rediger annonsen'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Bosch drill 18V med koffert');
      await tester.tap(find.text('Lagre endringene'));
      await tester.pumpAndSettle();

      final asked = server.asked('GET /me');
      await tester.tap(find.bySemanticsLabel('Tilbake'));
      await tester.pumpAndSettle();

      expect(find.byType(ItemDetailScreen), findsNothing);
      expect(server.asked('GET /me'), asked + 1);
      expect(find.text('Bosch drill 18V med koffert'), findsOneWidget);
    });
  });

  group('an empty town is no town', () {
    Finder field(int i) => find.byType(TextField).at(i);
    const town = 3;

    testWidgets('1. «Rediger profil» clears an emptied town with null, not \'\'', (tester) async {
      await mount(tester, const EditProfileScreen());
      expect(tester.widget<TextField>(field(town)).controller!.text, 'Trondheim');

      await tester.enterText(field(town), '  ');
      await tester.tap(find.text('Lagre'));
      await tester.pumpAndSettle();

      final sent = server.bodies['PATCH /me']!;
      expect(sent.containsKey('town'), isTrue);
      expect(sent['town'], isNull);
      expect(find.byType(EditProfileScreen), findsNothing);
    });

    testWidgets('2. …and a server that does not take null saves the rest without it',
        (tester) async {
      // Before the server cleared on null it refused one for the town, and
      // «Lagre» failed over a field that was only being emptied.
      server.overrides['PATCH /me'] = (http.Request request) {
        final body = jsonDecode(request.body) as Map;
        return body.containsKey('town') && body['town'] == null
            ? const Refusal(400, 'invalid_request', 'Noe mangler i det du sendte.')
            : FakeServer.profileOnly(FakeServer.me);
      };
      await mount(tester, const EditProfileScreen());

      await tester.enterText(field(0), 'Ola Nordmann');
      await tester.enterText(field(town), '');
      await tester.tap(find.text('Lagre'));
      await tester.pumpAndSettle();

      expect(server.asked('PATCH /me'), 2);
      expect(server.bodies['PATCH /me']!.containsKey('town'), isFalse);
      expect(server.bodies['PATCH /me']!['displayName'], 'Ola Nordmann');
      expect(find.text('Noe mangler i det du sendte.'), findsNothing);
      expect(find.byType(EditProfileScreen), findsNothing);
    });

    testWidgets('3. none to clear is not sent at all', (tester) async {
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': FakeServer.profileOnly({...FakeServer.me, 'town': null}),
      };
      server.overrides['GET /me'] = {...FakeServer.me, 'town': null};
      await mount(tester, const EditProfileScreen());

      await tester.tap(find.text('Lagre'));
      await tester.pumpAndSettle();

      expect(server.bodies['PATCH /me']!.containsKey('town'), isFalse);
    });

    testWidgets('4. 13 and 13b leave an empty town out of the line under the name',
        (tester) async {
      // Real testers may have '' stored already, from before.
      server.overrides['GET /me'] = {...FakeServer.me, 'town': ''};
      server.overrides['GET /users/kari-1'] = {
        ...FakeServer.kari,
        'town': '',
        'items': [FakeServer.console],
      };
      await mount(tester, const ProfileScreen());
      expect(find.text('medlem siden mai'), findsOneWidget);
      expect(find.textContaining(' · medlem siden'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      await mount(tester, const OtherProfileScreen(userId: 'kari-1'), signedIn: false);
      expect(find.text('medlem siden februar'), findsOneWidget);
      expect(find.textContaining(' · medlem siden'), findsNothing);
    });
  });

  group('the interests can be changed later, as 02 says', () {
    testWidgets('1. 13\'s interests open 02 with them chosen, and what is chosen there is on 13 '
        'after', (tester) async {
      // 02 says «Du kan endre dette senere», and nothing could.
      server.overrides['PUT /me/interests'] = (http.Request request) => FakeServer.profileOnly({
            ...FakeServer.me,
            'interests': (jsonDecode(request.body) as Map)['interests'],
          });
      await mount(tester, const ProfileScreen());
      expect(find.text('Mine gjenstander · 1'), findsOneWidget);

      await tester.tap(find.text('Verktøy'));
      await tester.pumpAndSettle();
      expect(find.byType(InterestsScreen), findsOneWidget);
      expect(find.text('3 valgt'), findsOneWidget);

      await tester.tap(find.text('Båt'));
      await tester.pump();
      await tester.tap(find.text('Fortsett'));
      await tester.pumpAndSettle();

      expect(server.bodies['PUT /me/interests'], {
        'interests': ['verktoy', 'gaming', 'sykling', 'bat'],
      });
      expect(find.byType(InterestsScreen), findsNothing);
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Båt'), findsOneWidget);
      // The answer to it is the profile alone; 13 keeps its things.
      expect(find.text('Mine gjenstander · 1'), findsOneWidget);
      expect(find.text('Bosch drill 18V'), findsOneWidget);
    });

    testWidgets('2. «Hopp over» there changes nothing', (tester) async {
      await mount(tester, const ProfileScreen());
      await tester.tap(find.text('Gaming'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Båt'));
      await tester.pump();
      await tester.tap(find.text('Hopp over'));
      await tester.pumpAndSettle();

      expect(server.requests, isNot(contains('PUT /me/interests')));
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Båt'), findsNothing);
      expect(session.me!.interests, ['verktoy', 'gaming', 'sykling']);
    });

    test('3. the answer to the choice is merged in: the things, the counts and who is acting stay',
        () async {
      // PUT /me/interests answers with the profile alone. Taken as the whole
      // of who this is, 13 lost its things and an admin acting as somebody
      // lost the floor under every screen until the next refresh.
      final acting = {...FakeServer.actingAsTest, 'items': [FakeServer.drill]};
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': acting};
      server.overrides['GET /me'] = acting;
      server.overrides['PUT /me/interests'] = FakeServer.profileOnly({
        ...acting,
        'interests': ['bat'],
      });
      await session.login('ola@epost.no', 'passord');
      expect(session.actingAs, isTrue);

      await session.setInterests(['bat']);

      expect(session.me!.interests, ['bat']);
      expect(session.me!.items.single.id, FakeServer.drill['id']);
      expect(session.actingAs, isTrue);
      expect(session.actingAsAdminName, 'Ola N.');
      expect(session.interestsPending, isFalse);
    });
  });
}

