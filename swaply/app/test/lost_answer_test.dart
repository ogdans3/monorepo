// A «Lag profil» whose answer never came back.
//
// The server can make the profile and the answer be lost on the way. The
// claim retires the device's session as it is made, so the next press went
// on a dead session, as a new account, and was refused as `email_taken` by
// the profile the first press had made: locked out of their own account, and
// the listing it was made for never went out. And once that dead session was
// let go of, the stranger made in its place threw away every draft on the
// phone — the one they were writing included — although the account the
// device id belongs to is theirs, and there to sign in to.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/state/listing_draft.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

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

const emailTaken =
    Refusal(409, 'email_taken', 'Det finnes allerede en konto med denne e-posten.');

/// The device's own account, once it has a profile: the claim keeps the id.
final claimed = {...FakeServer.me, 'id': FakeServer.lookingAround['id']};

/// A device on 10b with a title, on 10c after «Neste», and a server where the
/// first «Lag profil» makes the profile and its answer is lost.
Future<void> onTenC(WidgetTester tester) async {
  await session.lookAround();
  var made = false;
  server.overrides['POST /auth/register'] = (http.Request _) {
    if (made) return emailTaken;
    made = true;
    return unreachable;
  };
  server.overrides['POST /auth/login'] =
      (http.Request _) => {'token': 'tok', 'user': FakeServer.profileOnly(claimed)};
  server.overrides['GET /me'] = (http.Request _) => made ? claimed : FakeServer.lookingAround;
  server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
  await mount(tester, const PostItemScreen());

  await tester.enterText(find.byType(TextField).first, 'Fiskestang');
  await tester.tap(find.text('Neste'));
  await tester.pumpAndSettle();
  expect(find.byType(CreateProfileScreen), findsOneWidget);
}

Future<void> fill(WidgetTester tester, {String password = 'drillbits123'}) async {
  for (final (field, text) in [
    (0, 'Ola N.'),
    (1, 'Ola@epost.no '),
    (2, '412 34 567'),
    (3, password),
  ]) {
    await tester.enterText(find.byType(TextField).at(field), text);
  }
}

Future<void> press(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil og legg ut'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  testWidgets('1. pressed again after no answer, the profile it made lets the person in, and the '
      'listing goes out', (tester) async {
    await onTenC(tester);
    await fill(tester);
    await press(tester);
    expect(find.text(noContact), findsOneWidget);
    expect(session.anonymous, isTrue);

    await press(tester);

    expect(server.requests, contains('POST /auth/login'));
    expect(server.bodies['POST /auth/login'], {'email': 'Ola@epost.no', 'password': 'drillbits123'});
    expect(session.anonymous, isFalse);
    expect(session.me?.id, FakeServer.lookingAround['id']);
    expect(api.token, 'tok');
    expect(find.text(emailTaken.message), findsNothing);
    expect(find.byType(CreateProfileScreen), findsNothing);
    expect(server.requests, contains('POST /items'));
    expect(server.bodies['POST /items']!['title'], 'Fiskestang');
  });

  testWidgets('2. another password is somebody else\'s account, and is refused as it was',
      (tester) async {
    await onTenC(tester);
    server.overrides['POST /auth/login'] = Refusal.wrongCredentials;
    await fill(tester);
    await press(tester);
    await fill(tester, password: 'noeannet99');
    await press(tester);

    expect(find.text(emailTaken.message), findsOneWidget);
    expect(server.requests, isNot(contains('POST /auth/login')));
    expect(session.anonymous, isTrue);
    expect(server.requests, isNot(contains('POST /items')));
  });

  testWidgets('3. a taken address with no unanswered try before it is only refused',
      (tester) async {
    await session.lookAround();
    server.overrides['POST /auth/register'] = emailTaken;
    await mount(tester, const CreateProfileScreen(continuingToListing: true));
    await fill(tester);
    await press(tester);

    expect(find.text(emailTaken.message), findsOneWidget);
    expect(server.requests, isNot(contains('POST /auth/login')));
    expect(session.anonymous, isTrue);
  });

  test('4. a device id refused as claimed leaves the drafts on the phone', () async {
    // The account behind the id has a profile now and is the person's: they
    // sign in to it, and the draft is theirs still. The stranger made in its
    // place used to throw away every draft that was not its own.
    SharedPreferences.setMockInitialValues({'deviceId': '0123456789abcdef0123456789abcdef'});
    server.overrides['POST /auth/anonymous'] = (http.Request request) =>
        request.body.contains('0123456789abcdef0123456789abcdef')
            ? Refusal.deviceClaimed
            : {
                'token': FakeServer.deviceToken,
                'user': {...FakeServer.lookingAround, 'id': 'anon-2'},
              };
    await session.drafts.save('anon-1', draft);

    await session.lookAround();
    // The store takes one step at a time: anything it was asked to do as the
    // stranger was made is done before this.
    final kept = await session.drafts.load('anon-1');

    expect(session.me?.id, 'anon-2');
    expect(kept?.title, 'Fiskestang');
  });

  test('5. …and a stranger made for any other reason still forgets the last person\'s',
      () async {
    await session.drafts.save('anon-1', draft);
    server.overrides['POST /auth/anonymous'] = {
      'token': FakeServer.deviceToken,
      'user': {...FakeServer.lookingAround, 'id': 'anon-2'},
    };

    await session.lookAround();

    expect(await session.drafts.load('anon-1'), isNull);
  });
}

const draft = ListingDraft(
  kind: 'item',
  category: 'friluft',
  condition: 'good',
  title: 'Fiskestang',
  description: '',
  subcategory: '',
  value: '',
  postalCode: '',
  photos: [],
);
