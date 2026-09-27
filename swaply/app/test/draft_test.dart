// A half-written 10b is kept on the phone until it goes out, is thrown away,
// or its person has gone.
//
// The product owner, 27.09.2026: «Add local storage of images.» A listing half
// written — the words, the choices, and the pictures a stranger's phone holds
// until 10c has made a profile — lived in memory and nowhere else. Closing the
// app, or the phone killing it in the background, threw all of it away, and
// 10c is exactly where somebody puts the phone down to go and find a password.
//
// So the rule held here: the app closed or killed on 10b, or with 10c open over
// it, opens on 10b as it was left; a listing that was on its way out when that
// happened goes out on the next start, as the account it was going out as; and
// nothing of it stays on the phone once it has been listed, emptied, or its
// account signed out or deleted — a draft is photographs of somebody's things,
// usually in somebody's home. A record that does not read is dropped, never a
// form that will not open, and a browser keeps the pictures only while they
// fit.
//
// A kill here is what a phone has after one: everything on screen gone, and a
// new session and store reading back only what reached the preferences and the
// folder.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/api/models.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/draft_store.dart';
import 'package:swaply_app/state/listing_draft.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/util/clock.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;

/// The app's support directory, a folder of this test's own.
late Directory support;

/// One start of the app: its own api, session and store, over the same server
/// and the same phone.
class Phone {
  Phone({bool web = false}) {
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api, drafts: DraftStore(directory: () async => support, web: web));
  }

  late final SwaplyApi api;
  late final Session session;
}

/// The app killed: nothing on screen any more, and the preferences read back
/// from what was written rather than from memory.
Future<void> kill(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump();
  SharedPreferences.resetStatic();
}

/// [screen] alone, the way `screens_test.dart` mounts one.
Future<void> open(WidgetTester tester, Phone phone, Widget screen) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  phone.session.loading = false;
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<SwaplyApi>.value(value: phone.api),
        ChangeNotifierProvider<Session>.value(value: phone.session),
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

/// What `main.dart` does: the gate, and the session restoring itself under it.
Future<void> boot(WidgetTester tester, Phone phone) async {
  tester.view.physicalSize = const Size(430, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: phone.session, child: SwaplyApp(api: phone.api)),
  );
  unawaited(phone.session.restore());
  await tester.pumpAndSettle();
}

/// 10b keyed by who is signed in, as the app's tabs are: a sign-in on 10c
/// makes the phone somebody else, and somebody else gets a new form.
Widget form({Future<PickedPhoto?> Function()? pick}) => Builder(
      builder: (context) => PostItemScreen(
          key: ValueKey(context.select<Session, String?>((s) => s.me?.id)), pickImage: pick),
    );

/// The [n]th picture a [picker] hands over.
List<int> picture(int n) => [for (var i = 0; i < 64; i++) (n * 31 + i) % 256];

/// Hands over a picture under each name in turn.
Future<PickedPhoto?> Function() picker(List<String> names) {
  var next = 0;
  return () async {
    final n = next++;
    return PickedPhoto(picture(n), names[n]);
  };
}

Future<void> addPhotos(WidgetTester tester, int count) async {
  for (var i = 0; i < count; i++) {
    await tester.tap(find.text('Legg til bilder'));
    await tester.pumpAndSettle();
  }
}

/// The form's fields, in the order it draws them.
enum Field { title, description, value, subcategory, postcode }

String typed(WidgetTester tester, Field field) =>
    tester.widget<TextField>(find.byType(TextField).at(field.index)).controller!.text;

/// The pictures in the strip, as they are drawn: bytes from the phone, or the
/// server's URL.
List<Object> strip(WidgetTester tester) => [
      for (final image in tester.widgetList<Image>(find.byType(Image)))
        switch (image.image) {
          MemoryImage(:final bytes) => bytes.toList(),
          NetworkImage(:final url) => url,
          final other => other,
        },
    ];

/// Whether [label] is the condition chosen: drawn heavier than the others.
bool chosen(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label)).style!.fontWeight == FontWeight.w700;

/// «Neste», 10c filled in, and «Lag profil og legg ut».
Future<void> throughProfile(WidgetTester tester) async {
  await tester.tap(find.text('Neste'));
  await tester.pumpAndSettle();
  for (final (field, text) in [
    (0, 'Ola N.'),
    (1, 'ola@epost.no'),
    (2, '412 34 567'),
    (3, 'drillbits123'),
  ]) {
    await tester.enterText(find.byType(TextField).at(field), text);
  }
  await tester.tap(find.text('Lag profil og legg ut'));
  await tester.pumpAndSettle();
}

/// «Neste», and «Logg inn» on 10c instead of a profile, sent without
/// waiting for what comes after.
Future<void> signInOn10c(WidgetTester tester) async {
  await tester.tap(find.text('Neste'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Logg inn'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
  await tester.enterText(find.byType(TextField).last, 'passord');
  await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
}

/// The record kept for [account], as the preferences hold it.
Future<Map<String, dynamic>?> kept(String account) async {
  final raw = (await SharedPreferences.getInstance()).getString('listingDraft:$account');
  return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
}

Future<Set<String>> drafts() async => {
      for (final key in (await SharedPreferences.getInstance()).getKeys())
        if (key.startsWith('listingDraft:')) key.substring('listingDraft:'.length),
    };

Directory get folder => Directory('${support.path}/drafts');

/// What is in the drafts folder, by name.
List<String> files() => folder.existsSync()
    ? [for (final f in folder.listSync()) f.path.substring(folder.path.length + 1)]
    : const [];

ListingDraft draft({String title = 'Fiskestang', List<ListingPhoto> photos = const []}) =>
    ListingDraft(
      kind: 'item',
      category: 'friluft',
      condition: 'good',
      title: title,
      description: '',
      subcategory: '',
      value: '',
      postalCode: '',
      photos: photos,
    );

UploadedImage storedAt(int n) => UploadedImage.fromJson({
      'path': '/media/${FakeServer.storedPhotoAt(n)}',
      'url': 'http://test/media/${FakeServer.storedPhotoAt(n)}',
      'bytes': 3,
    });

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    support = Directory.systemTemp.createTempSync('swaply-draft-test-');
    addTearDown(() => support.deleteSync(recursive: true));
  });

  group('the app closed or killed', () {
    testWidgets('1. half filled, 10b opens as it was left: the words, the choices, the pictures',
        (tester) async {
      final before = Phone();
      await before.session.lookAround();
      await open(tester, before, PostItemScreen(pickImage: picker(['sykkel.jpg', 'stang.jpg'])));
      await addPhotos(tester, 2);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(Field.title.index), 'Fiskestang');
      await tester.enterText(fields.at(Field.description.index), 'Med snelle og ny sene.');
      await tester.enterText(fields.at(Field.value.index), '350');
      await tester.enterText(fields.at(Field.subcategory.index), 'Stenger');
      await tester.enterText(fields.at(Field.postcode.index), '7030');
      await tester.tap(find.text('Slitt'));
      await tester.tap(find.text('Verktøy'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Friluft').last);
      await tester.pumpAndSettle();
      // The typing held still for a moment, as it does before a phone is put
      // down.
      await tester.pump(const Duration(seconds: 1));
      await kill(tester);

      final after = Phone();
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await after.session.restore();
      expect(after.session.me?.id, FakeServer.lookingAround['id']);
      await open(tester, after, PostItemScreen(pickImage: picker(['tre.jpg'])));
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      expect(typed(tester, Field.title), 'Fiskestang');
      expect(typed(tester, Field.description), 'Med snelle og ny sene.');
      expect(typed(tester, Field.value), '350');
      expect(typed(tester, Field.subcategory), 'Stenger');
      expect(typed(tester, Field.postcode), '7030');
      // The town beside the digits, as it was drawn.
      expect(find.text('Trondheim'), findsOneWidget);
      expect(chosen(tester, 'Slitt'), isTrue);
      expect(find.text('Friluft'), findsOneWidget);
      // The pictures, from the phone, in their order, the first the cover.
      expect(strip(tester), [picture(0), picture(1)]);
      expect(find.text('Forside'), findsOneWidget);
      // Still step one of two, and nothing sent anywhere yet.
      expect(find.text('Neste'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /media')));

      // And they are the real thing: 10c makes the profile, and out they go.
      server.overrides['GET /me'] = {...FakeServer.me, 'id': FakeServer.lookingAround['id']};
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await throughProfile(tester);

      expect(server.uploadedNames, ['sykkel.jpg', 'stang.jpg']);
      expect(server.bodies['POST /items'], {
        'kind': 'item',
        'title': 'Fiskestang',
        'description': 'Med snelle og ny sene.',
        'category': 'friluft',
        'subcategory': 'Stenger',
        'condition': 'worn',
        'estimatedValueNok': 350,
        'postalCode': '7030',
        'media': [
          '/media/${FakeServer.storedPhotoAt(0)}',
          '/media/${FakeServer.storedPhotoAt(1)}',
        ],
      });
      // Listed, and nothing of it left on the phone.
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });

    testWidgets('2. with 10c open over it, 10b comes back, and a sign-in on 10c from there lists it',
        (tester) async {
      final before = Phone();
      await before.session.lookAround();
      await open(tester, before, form(pick: picker(['en.jpg', 'to.jpg'])));
      await addPhotos(tester, 2);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await tester.tap(find.text('Neste'));
      // With no moment for the typing to hold still: 10c going up keeps the
      // form as it is. (A kill here runs no `dispose`; the test's does.)
      await tester.pump();
      expect((await kept(FakeServer.lookingAround['id'] as String))!['title'], 'Fiskestang');
      await tester.pumpAndSettle();
      expect(find.text('Lag profil og legg ut'), findsOneWidget);
      await kill(tester);

      final after = Phone();
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await after.session.restore();
      // Nothing was on its way out, so nothing is sent on its own.
      expect(after.session.listingToFinish, isNull);
      await open(tester, after, form(pick: picker(['tre.jpg'])));

      expect(typed(tester, Field.title), 'Fiskestang');
      expect(strip(tester), [picture(0), picture(1)]);
      expect(find.text('1/2'), findsOneWidget);
      expect(server.requests, isNot(contains('POST /items')));

      // Somebody with an account from another phone: «Logg inn» on 10c, and
      // the listing goes out as that account, pictures and all.
      server.overrides.remove('GET /me');
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.me};
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await signInOn10c(tester);
      await tester.pumpAndSettle();

      expect(server.uploadedNames, ['en.jpg', 'to.jpg']);
      expect(server.bearers['POST /media'], 'Bearer tok');
      expect(server.asked('POST /items'), 1);
      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
      expect(server.bodies['POST /items']!['media'], [
        '/media/${FakeServer.storedPhotoAt(0)}',
        '/media/${FakeServer.storedPhotoAt(1)}',
      ]);
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });

    testWidgets('3. signed in on 10c and killed while the pictures go up: the next start lists it',
        (tester) async {
      // «Logg inn» on 10c is the second step of listing, and the pictures go
      // up after it. Killed half-way, the next start opens on Legg ut and
      // finishes, sending only what had not gone.
      final before = Phone();
      await before.session.lookAround();
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.me};
      final second = Completer<Object?>();
      server.overrides['POST /media'] =
          (http.Request _) => server.uploads == 1 ? second.future : asUsual;
      await open(tester, before, form(pick: picker(['en.jpg', 'to.jpg'])));
      await addPhotos(tester, 2);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await signInOn10c(tester);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }

      expect(server.uploadedNames, ['en.jpg']);
      expect(server.requests, isNot(contains('POST /items')));
      // Handed to the account signed in to, marked as on its way out, with
      // the picture that got there kept as its path.
      expect(await kept(FakeServer.lookingAround['id'] as String), isNull);
      final record = (await kept(FakeServer.me['id'] as String))!;
      expect(record['finish'], isTrue);
      expect((record['photos'] as List).first['path'], '/media/${FakeServer.storedPhotoAt(0)}');

      await kill(tester);
      // What was on its way died with the app.
      second.complete(unreachable);
      await tester.pump();
      server.overrides.remove('POST /media');
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};

      final after = Phone();
      await boot(tester, after);

      expect(server.uploadedNames, ['en.jpg', 'to.jpg']);
      expect(server.bearers['POST /media'], 'Bearer tok');
      expect(server.asked('POST /items'), 1);
      expect(server.bodies['POST /items']!['title'], 'Fiskestang');
      expect(server.bodies['POST /items']!['media'], [
        '/media/${FakeServer.storedPhotoAt(0)}',
        '/media/${FakeServer.storedPhotoAt(1)}',
      ]);
      // On 13, where it now is, and nothing of it left on the phone.
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });

    testWidgets('4. once the listing has been asked for, the next start does not send it again',
        (tester) async {
      // An answer lost after the listing reached the server is the one case
      // where sending it again makes two listings of one thing. So a listing
      // is on its way out only while its pictures go up; killed after it was
      // asked for, the next start opens the form instead of sending, and 13
      // says whether it went.
      final before = Phone();
      await before.session.lookAround();
      server.overrides['POST /auth/login'] = {'token': 'tok', 'user': FakeServer.me};
      server.overrides['POST /items'] = (http.Request _) => Completer<Object?>().future;
      await open(tester, before, form(pick: picker(['en.jpg'])));
      await addPhotos(tester, 1);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump();
      await signInOn10c(tester);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(server.uploadedNames, ['en.jpg']);
      expect(server.asked('POST /items'), 1);
      expect((await kept(FakeServer.me['id'] as String))!['finish'], isNull);
      await kill(tester);
      await tester.pump(SwaplyApi.patience);

      final after = Phone();
      await boot(tester, after);
      expect(after.session.listingToFinish, isNull);
      expect(server.asked('POST /items'), 1);
      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Legg ut')));
      await tester.pumpAndSettle();
      expect(server.asked('POST /items'), 1);
      expect(typed(tester, Field.title), 'Fiskestang');
      // The picture is the server's by now, and is not sent again either.
      expect(strip(tester), [picture(0)]);
      expect((await kept(FakeServer.me['id'] as String))!['photos'].single['path'],
          '/media/${FakeServer.storedPhoto}');
    });

    testWidgets('5. a picture already sent is kept with its path and its bytes, and the background keeps the typing',
        (tester) async {
      // Somebody with a profile has each picture sent as it is picked. The
      // bytes are kept on the phone all the same: the server lets go of an
      // upload no listing has taken up after a day, and the phone is where
      // it goes up again from.
      final before = Phone();
      await before.session.login('ola@epost.no', 'passord');
      await open(tester, before, PostItemScreen(pickImage: picker(['drill.jpg'])));
      await addPhotos(tester, 1);
      await tester.enterText(find.byType(TextField).first, 'Bosch drill 18V');

      // Gone to the background straight after the last letter, before the
      // typing had held still: that is when a phone may kill the app.
      for (final state in [
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pump(Duration.zero);
      final record = (await kept(FakeServer.me['id'] as String))!;
      expect(record['title'], 'Bosch drill 18V');
      final photo = (record['photos'] as List).single as Map<String, dynamic>;
      expect(photo['path'], '/media/${FakeServer.storedPhoto}');
      expect(photo['url'], 'http://test/media/${FakeServer.storedPhoto}');
      expect(DateTime.parse(photo['storedAt'] as String).isAfter(DateTime.now().subtract(
          const Duration(minutes: 1))), isTrue);
      expect(photo['name'], 'drill.jpg');
      expect(files(), [photo['file']]);
      for (final state in [
        AppLifecycleState.hidden,
        AppLifecycleState.inactive,
        AppLifecycleState.resumed,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await kill(tester);

      final after = Phone();
      await after.session.restore();
      await open(tester, after, const PostItemScreen());
      expect(typed(tester, Field.title), 'Bosch drill 18V');
      expect(strip(tester), [picture(0)]);

      // Sent minutes ago: the server still has it, and it is not sent twice.
      server.overrides['POST /items'] = FakeServer.drill;
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pumpAndSettle();
      expect(server.uploadedNames, ['drill.jpg']);
      expect(server.bodies['POST /items']!['media'], ['/media/${FakeServer.storedPhoto}']);
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });
  });

  group('kept longer than the server keeps what it was sent', () {
    // The server sweeps an upload no listing took up after a day
    // (`backend/src/lib/media-sweep.ts`). A draft kept on the phone lives far
    // longer, and its paths went out on Wednesday as Monday's pictures — gone,
    // and listed broken for everybody. And a listing on its way out when the
    // app died was sent on its own whenever the app was next opened, however
    // much later.
    late DateTime clock;
    setUp(() {
      clock = DateTime(2026, 9, 28, 19);
      now = () => clock;
      addTearDown(() => now = DateTime.now);
    });

    testWidgets('1. Monday\'s pictures go up again on Wednesday, from the phone', (tester) async {
      final before = Phone();
      await before.session.login('ola@epost.no', 'passord');
      await open(tester, before, PostItemScreen(pickImage: picker(['sykkel.jpg', 'stang.jpg'])));
      await addPhotos(tester, 2);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump(const Duration(seconds: 1));
      await kill(tester);
      expect(server.uploadedNames, ['sykkel.jpg', 'stang.jpg']);

      clock = clock.add(const Duration(days: 2));
      final after = Phone();
      await after.session.restore();
      await open(tester, after, const PostItemScreen());
      // Drawn from the phone, not from a server that may no longer have them.
      expect(strip(tester), [picture(0), picture(1)]);

      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pumpAndSettle();

      expect(server.uploadedNames, ['sykkel.jpg', 'stang.jpg', 'sykkel.jpg', 'stang.jpg']);
      expect(server.bodies['POST /items']!['media'], [
        '/media/${FakeServer.storedPhotoAt(2)}',
        '/media/${FakeServer.storedPhotoAt(3)}',
      ]);
    });

    testWidgets('2. …and so does one from a form left open that long', (tester) async {
      final phone = Phone();
      await phone.session.login('ola@epost.no', 'passord');
      await open(tester, phone, PostItemScreen(pickImage: picker(['sykkel.jpg'])));
      await addPhotos(tester, 1);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump(const Duration(seconds: 1));

      clock = clock.add(const Duration(hours: 21));
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
      await tester.pumpAndSettle();

      expect(server.uploadedNames, ['sykkel.jpg', 'sykkel.jpg']);
      expect(server.bodies['POST /items']!['media'], ['/media/${FakeServer.storedPhotoAt(1)}']);
    });

    testWidgets('3. one kept only by its path, that old, is left out rather than drawn blank',
        (tester) async {
      // A browser whose storage had no room for the bytes keeps the path
      // alone. Within the day it comes back; after it, there is nothing on
      // the server to draw or to list.
      final store = DraftStore(directory: () async => support, web: true);
      await store.save(
          'me-1',
          draft(photos: [
            ListingPhoto.held(picture(0), 'en.jpg')..sent(storedAt(0)),
            ListingPhoto.stored(storedAt(1))..sent(storedAt(1)),
          ]));

      clock = clock.add(const Duration(hours: 19));
      final soon = (await store.load('me-1'))!;
      expect(soon.photos, hasLength(2));
      expect([for (final p in soon.photos) p.onServer], [isTrue, isTrue]);

      clock = clock.add(const Duration(hours: 2));
      final late = (await store.load('me-1'))!;
      expect(late.title, 'Fiskestang');
      // The one with its bytes stays, to be sent again; the other is gone.
      expect(late.photos, hasLength(1));
      expect(late.photos.single.bytes, picture(0));
      expect(late.photos.single.stored, isNull);
    });

    testWidgets('4. a listing on its way out when the app died goes out only if the app is back soon',
        (tester) async {
      // Swiping the app away is the one way to stop a «Legg ut» once it is
      // pressed. A week on, the app opened to look around is not the person
      // asking for it again: the form comes back, for them to press.
      SharedPreferences.setMockInitialValues({'token': 'tok'});
      final phone = Phone();
      await phone.session.drafts.save(
          'me-1',
          ListingDraft(
            kind: 'item',
            category: 'friluft',
            condition: 'good',
            title: 'Fiskestang',
            description: '',
            subcategory: '',
            value: '',
            postalCode: '',
            photos: [ListingPhoto.held(picture(0), 'en.jpg')],
            finish: true,
          ));
      expect((await phone.session.drafts.unfinished('me-1'))?.title, 'Fiskestang');

      clock = clock.add(const Duration(minutes: 6));
      expect(await phone.session.drafts.unfinished('me-1'), isNull);
      server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
      await boot(tester, phone);

      expect(phone.session.listingToFinish, isNull);
      expect(server.uploads, 0);
      expect(server.asked('POST /items'), 0);
      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Legg ut')));
      await tester.pumpAndSettle();
      expect(typed(tester, Field.title), 'Fiskestang');
      expect(strip(tester), [picture(0)]);
      expect(server.asked('POST /items'), 0);
      // And no longer on its way out, for the next start either.
      expect((await kept('me-1'))!['finish'], isNull);
    });
  });

  group('whose it is', () {
    testWidgets('1. signed in from Profil instead of 10c, the draft goes along and waits', (tester) async {
      // The stranger is folded into the account on the server, and a draft
      // kept by the stranger's id would stay with an account that is gone.
      // Nothing was on its way out, so nothing goes out on its own.
      final phone = Phone();
      await phone.session.lookAround();
      final stranger = FakeServer.lookingAround['id'] as String;
      await phone.session.drafts
          .save(stranger, draft(photos: [ListingPhoto.held(picture(0), 'en.jpg')]));
      server.overrides['POST /auth/login'] = {
        'token': 'tok',
        'user': FakeServer.me,
        'carried': {'likes': 0},
      };

      await phone.session.login('ola@epost.no', 'passord');

      expect(await drafts(), {'me-1'});
      final record = (await kept('me-1'))!;
      expect(record['finish'], isNull);
      expect(record['title'], 'Fiskestang');
      expect(files(), hasLength(1));
      expect(phone.session.listingToFinish, isNull);
      expect(server.requests, isNot(contains('POST /items')));
    });

    testWidgets('2. making a profile on 10c keeps the stranger\'s id, and the draft with it',
        (tester) async {
      final phone = Phone();
      await phone.session.lookAround();
      final stranger = FakeServer.lookingAround['id'] as String;
      await phone.session.drafts.save(stranger, draft());

      await phone.session.register(
          displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123');

      expect(phone.session.me?.id, stranger);
      expect(await drafts(), {stranger});
    });
  });

  group('nothing of it is left behind', () {
    testWidgets('1. emptied, the form is thrown away: no «Forkast» is drawn, and none is needed',
        (tester) async {
      final phone = Phone();
      await phone.session.lookAround();
      final stranger = FakeServer.lookingAround['id'] as String;
      await open(tester, phone, PostItemScreen(pickImage: picker(['en.jpg'])));
      await addPhotos(tester, 1);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump(const Duration(seconds: 1));
      expect(await kept(stranger), isNotNull);
      expect(files(), hasLength(1));

      // A choice is not something written, and keeps nothing on its own.
      await tester.tap(find.text('Tjeneste'));
      await tester.enterText(find.byType(TextField).first, '');
      await tester.tap(find.byIcon(Icons.close));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));

      expect(await kept(stranger), isNull);
      expect(files(), isEmpty);
      await kill(tester);
      final after = Phone();
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await after.session.restore();
      await open(tester, after, const PostItemScreen());
      expect(typed(tester, Field.title), isEmpty);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('2. «Logg ut» takes every draft on the phone, not only the account\'s',
        (tester) async {
      final phone = Phone();
      await phone.session.login('ola@epost.no', 'passord');
      final store = phone.session.drafts;
      await store.save('me-1', draft(photos: [ListingPhoto.held(picture(0), 'en.jpg')]));
      await store.save('test-1', draft(photos: [ListingPhoto.held(picture(1), 'to.jpg')]));
      expect(await drafts(), {'me-1', 'test-1'});
      expect(files(), hasLength(2));

      await phone.session.logout();

      expect(await drafts(), isEmpty);
      expect(folder.existsSync(), isFalse);
    });

    testWidgets('3. «Slett kontoen» takes it too', (tester) async {
      SharedPreferences.setMockInitialValues({'token': 'tok'});
      final phone = Phone();
      await phone.session.drafts
          .save('me-1', draft(photos: [ListingPhoto.held(picture(0), 'en.jpg')]));
      await boot(tester, phone);

      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Slett kontoen'));
      await tester.pumpAndSettle();
      await tester.enterText(
          find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField)),
          'drillbits123');
      await tester.tap(find.widgetWithText(OutlinedButton, 'Slett kontoen'));
      await tester.pumpAndSettle();

      expect(server.asked('DELETE /me'), 1);
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });

    testWidgets('…and as a test account, only the test account\'s', (tester) async {
      // The test tool retiring an account it made. The admin holding the
      // phone is still who they were, and so is their own draft.
      server.overrides['GET /me'] = (http.Request r) =>
          r.headers['authorization'] == 'Bearer tok-test-1'
              ? FakeServer.actingAsTest
              : FakeServer.admin;
      SharedPreferences.setMockInitialValues({'token': 'tok-test-1', 'adminToken': 'tok'});
      final phone = Phone();
      await phone.session.drafts
          .save('me-1', draft(title: 'Min', photos: [ListingPhoto.held(picture(0), 'en.jpg')]));
      await phone.session.drafts
          .save('test-1', draft(title: 'Test', photos: [ListingPhoto.held(picture(1), 'to.jpg')]));
      await boot(tester, phone);
      expect(phone.session.actingAs, isTrue);

      await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Slett kontoen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Slett kontoen'));
      await tester.pumpAndSettle();

      expect(phone.session.me?.id, 'me-1');
      expect(await drafts(), {'me-1'});
      expect(files(), hasLength(1));
      expect((await phone.session.drafts.load('me-1'))!.title, 'Min');
    });

    testWidgets('4. a phone made a new stranger lets go of what the last person left',
        (tester) async {
      // Their token no longer opens anything — the account deleted from
      // another phone, or a stranger unused for a year and erased — so the
      // app starts over as somebody new, and nobody can open the draft again.
      SharedPreferences.setMockInitialValues({'token': 'tok-gone'});
      server.overrides['GET /me'] = 401;
      final phone = Phone();
      await phone.session.drafts
          .save('gone-1', draft(photos: [ListingPhoto.held(picture(0), 'en.jpg')]));
      await boot(tester, phone);

      expect(phone.session.anonymous, isTrue);
      expect(await drafts(), isEmpty);
      expect(files(), isEmpty);
    });
  });

  group('what does not read is dropped, never a form that will not open', () {
    testWidgets('1. a record cut off half-way: the form opens empty, and the folder is swept',
        (tester) async {
      final stranger = FakeServer.lookingAround['id'] as String;
      SharedPreferences.setMockInitialValues({
        'token': FakeServer.deviceToken,
        'listingDraft:$stranger': '{"v":1,"kind":"item","title":"Fiskes',
      });
      folder.createSync(recursive: true);
      File('${folder.path}/0123456789abcdef0123456789abcdef').writeAsBytesSync(picture(0));
      File('${folder.path}/fedcba9876543210fedcba9876543210.part').writeAsBytesSync([1, 2]);
      server.overrides['GET /me'] = FakeServer.lookingAround;
      final phone = Phone();
      await phone.session.restore();

      await open(tester, phone, const PostItemScreen());

      expect(typed(tester, Field.title), isEmpty);
      expect(find.byType(Image), findsNothing);
      expect(await kept(stranger), isNull);
      expect(files(), isEmpty);
    });

    testWidgets('2. a picture missing or not whole is left out, and the rest comes back',
        (tester) async {
      final stranger = FakeServer.lookingAround['id'] as String;
      server.overrides['GET /me'] = FakeServer.lookingAround;
      SharedPreferences.setMockInitialValues({'token': FakeServer.deviceToken});
      final phone = Phone();
      await phone.session.drafts.save(
          stranger,
          draft(photos: [
            ListingPhoto.held(picture(0), 'en.jpg'),
            ListingPhoto.held(picture(1), 'to.jpg'),
            ListingPhoto.held(picture(2), 'tre.jpg'),
            ListingPhoto.stored(storedAt(0))..sent(storedAt(0)),
          ]));
      final record = (await kept(stranger))!;
      final photos = record['photos'] as List;
      File('${folder.path}/${photos[0]['file']}').deleteSync();
      File('${folder.path}/${photos[1]['file']}').writeAsBytesSync([1, 2, 3]);
      // And a category and a condition this app does not have — a record an
      // older one wrote.
      record['category'] = 'finnes-ikke';
      record['condition'] = 'knust';
      await (await SharedPreferences.getInstance())
          .setString('listingDraft:$stranger', jsonEncode(record));
      await phone.session.restore();

      await open(tester, phone, const PostItemScreen());

      expect(typed(tester, Field.title), 'Fiskestang');
      expect(strip(tester), [picture(2), 'http://test/media/${FakeServer.storedPhotoAt(0)}']);
      expect(find.text('Verktøy'), findsOneWidget);
      expect(chosen(tester, 'God'), isTrue);
    });
  });

  group('in a browser', () {
    testWidgets('1. the pictures ride in the record while they fit, and no folder is touched',
        (tester) async {
      final before = Phone(web: true);
      await before.session.lookAround();
      await open(tester, before, PostItemScreen(pickImage: picker(['en.jpg', 'to.jpg'])));
      await addPhotos(tester, 2);
      await tester.enterText(find.byType(TextField).first, 'Fiskestang');
      await tester.pump(const Duration(seconds: 1));
      await kill(tester);

      final after = Phone(web: true);
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await after.session.restore();
      await open(tester, after, const PostItemScreen());

      expect(typed(tester, Field.title), 'Fiskestang');
      expect(strip(tester), [picture(0), picture(1)]);
      expect(folder.existsSync(), isFalse);
    });

    testWidgets('2. past the limit the words are kept without the pictures, and nothing breaks',
        (tester) async {
      // A browser gives a site about five million characters, and the session
      // is kept there too. Two photographs the browser could not shrink come
      // to more than the draft may carry.
      final store = DraftStore(directory: () async => support, web: true);
      final big = [
        ListingPhoto.held(List.filled(1200000, 1), 'a.jpg'),
        ListingPhoto.held(List.filled(1200000, 2), 'b.jpg'),
        ListingPhoto.stored(storedAt(0))..sent(storedAt(0)),
      ];
      await store.save('anon-1', draft(title: 'Kajakk', photos: big));

      final raw = (await SharedPreferences.getInstance()).getString('listingDraft:anon-1')!;
      expect(raw.length, lessThan(2000));
      final back = (await store.load('anon-1'))!;
      expect(back.title, 'Kajakk');
      // The one the server has is only a path, and stays.
      expect(back.photos, hasLength(1));
      expect(back.photos.single.stored!.path, '/media/${FakeServer.storedPhotoAt(0)}');

      // Under it, they are kept.
      final small = [ListingPhoto.held(List.filled(100000, 3), 'c.jpg')];
      await store.save('anon-1', draft(title: 'Kajakk', photos: small));
      expect((await store.load('anon-1'))!.photos.single.bytes, small.single.bytes);
      expect(folder.existsSync(), isFalse);
    });

    testWidgets('3. «Logg ut» also takes a draft another tab kept after this one opened',
        (tester) async {
      // Two tabs of the site share one storage, and each answers from the
      // copy of it it read when it opened. «Logg ut» went by that copy, so a
      // draft the other tab kept afterwards stayed until the page was loaded
      // again.
      final otherTab = await SharedPreferences.getInstance();
      SharedPreferences.resetStatic();
      final phone = Phone(web: true);
      await phone.session.login('ola@epost.no', 'passord');
      await phone.session.drafts.save('me-1', draft(title: 'Kajakk'));

      await otherTab.setString('listingDraft:me-2', jsonEncode({'v': 1, 'title': 'Telt'}));
      // Not in this tab's copy, which is the whole of the trouble.
      expect((await SharedPreferences.getInstance()).getKeys(), isNot(contains('listingDraft:me-2')));

      await phone.session.logout();

      // What the storage holds, as the next page to open reads it.
      SharedPreferences.resetStatic();
      expect(await drafts(), isEmpty);
    });
  });
}
