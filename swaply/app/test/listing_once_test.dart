// One «Legg ut» is one listing.
//
// The product owner, 27.09.2026: «Fix every known bug.» Two of them were one
// listing going out twice. «Legg ut» made the listing and then asked the
// server who this is, for 13 and the bar's counts, inside the same `try`: no
// answer to that second question said «Vi får ikke kontakt» over the button
// after the listing had been made, the form stayed full, and pressing again
// made it a second time. And an answer lost on the way back from the listing
// itself — no contact, or the app killed while it was out — says nothing about
// whether the listing was made, so pressing again made it twice whenever it
// had been.
//
// So the rule held here: the listing being made is the whole answer, and what
// is asked after it is quiet. And every draft names the listing it becomes —
// a UUID kept with the draft and sent as `Idempotency-Key`, which the server
// makes one listing of, per account — so «Legg ut» pressed again, in the same
// form or in the one that comes back after a kill, asks for the same one. A
// draft that is listed, or emptied, is done with, and the next one has a new
// name.
//
// And the listing handed back for a name is the one the first press made,
// whatever the form says now. Somebody who fixes the title after «Vi får ikke
// kontakt», adds a picture and presses again was told «Lagt ut» over the old
// words and lost the new ones without a word. The server says which it did —
// 201 for a listing made, 200 for one handed back — and a listing handed back
// is corrected to the form, as «Rediger annonsen» would, before the draft is
// let go of.
//
// Unless a trade has reserved it since. A reserved listing cannot be
// corrected, so every press after that was handed the same listing and
// refused the same correction, the draft could never finish, and once the key
// stopped answering (48 hours) the same press listed the thing a second time.
// A listing handed back reserved — or reserved between the answer and the
// correction — is out, as it was first listed: the draft is let go of, and the
// person is told why the form's words did not go with it.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/post_item.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/draft_store.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;

/// The app's support directory, a folder of this test's own.
late Directory support;

/// A version 4 UUID, which is what the server takes as a key.
final uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

/// One start of the app, over the same server and the same phone.
class Phone {
  Phone() {
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api, drafts: DraftStore(directory: () async => support));
  }

  late final SwaplyApi api;
  late final Session session;
}

/// What `main.dart` does, with the account's token kept from last time.
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

/// The app killed: nothing on screen, and the preferences read back from
/// what was written rather than from memory.
Future<void> kill(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump();
  SharedPreferences.resetStatic();
}

/// 10b alone, the way `draft_test.dart` mounts it, for a form that picks
/// pictures: the app's own tab asks the platform's picker.
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

final bar = find.byType(SwaplyNavBar);

Future<void> openLeggUt(WidgetTester tester) async {
  await tester.tap(find.descendant(of: bar, matching: find.text('Legg ut')));
  await tester.pumpAndSettle();
}

/// A title, and the typing held still long enough to be kept.
Future<void> title(WidgetTester tester, String text) async {
  await tester.enterText(find.byType(TextField).first, text);
  await tester.pump(const Duration(seconds: 1));
}

Future<void> leggUt(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
  await tester.pumpAndSettle();
}

/// Until the toast the last listing put up has gone, and the form under it
/// is free to be pressed.
Future<void> toastGone(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 10));
  await tester.pumpAndSettle();
}

/// The draft kept for Ola, as the preferences hold it.
Future<Map<String, dynamic>?> kept() async {
  final raw = (await SharedPreferences.getInstance()).getString('listingDraft:me-1');
  return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
}

String? toast(WidgetTester tester) {
  final shown = find.byType(SwaplyToast);
  return shown.evaluate().isEmpty ? null : tester.widget<SwaplyToast>(shown).message;
}

ToastTone? tone(WidgetTester tester) {
  final shown = find.byType(SwaplyToast);
  return shown.evaluate().isEmpty ? null : tester.widget<SwaplyToast>(shown).tone;
}

/// What a listing handed back reserved says instead of «Lagt ut».
const heldByTrade =
    'Den var allerede lagt ut, og er reservert i et bytte nå. Den kan ikke endres før byttet er over.';

/// The server's refusal of a correction to a listing a trade is holding.
const reservedRefusal =
    Refusal(400, 'item_reserved', 'Gjenstanden er reservert i et bytte og kan ikke endres.');

/// Ola's «Legg ut» with no answer, and the title put right after it: a form
/// whose first press may have reached the server, and that no longer says
/// what that press carried. The draft's key, as kept.
Future<String> lostAnswer(WidgetTester tester, Phone phone) async {
  await boot(tester, phone);
  await openLeggUt(tester);
  await title(tester, 'Fiskestang');
  server.overrides['POST /items'] = unreachable;
  await leggUt(tester);
  expect(find.text(noContact), findsOneWidget);
  await title(tester, 'Fiskestang, 2 m');
  return (await kept())!['key'] as String;
}

/// On 13 with the draft done with, and nothing left to press a second time:
/// the Legg ut tab starts over, empty, with a new name.
Future<void> letGo(WidgetTester tester, String key) async {
  expect(find.byType(ProfileScreen), findsOneWidget);
  expect(find.byType(PostItemScreen), findsNothing);
  expect(await kept(), isNull);
  await toastGone(tester);
  await openLeggUt(tester);
  expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, isEmpty);
  await title(tester, 'Telt');
  expect((await kept())!['key'], isNot(key));
}

void main() {
  setUp(() {
    // Ola, signed in from last time.
    SharedPreferences.setMockInitialValues({'token': 'tok'});
    server = FakeServer();
    support = Directory.systemTemp.createTempSync('swaply-listing-test-');
    addTearDown(() => support.deleteSync(recursive: true));
  });

  testWidgets('1. made, and no answer about who this is after it: it says listed, and the form is done',
      (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');
    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
    // The line goes the moment the listing has been made.
    server.overrides['GET /me'] = unreachable;

    await leggUt(tester);

    expect(server.asked('POST /items'), 1);
    expect(toast(tester), 'Lagt ut. Nå kan folk like den.');
    expect(find.text(noContact), findsNothing);
    // On 13, where it now is, and the form is gone with the draft: there is
    // no «Legg ut» left to press a second time.
    expect(find.byType(ProfileScreen), findsOneWidget);
    expect(find.byType(PostItemScreen), findsNothing);
    expect(await kept(), isNull);
    expect(phone.session.signedIn, isTrue);

    // The Legg ut tab starts over, empty.
    await openLeggUt(tester);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, isEmpty);
    expect(server.asked('POST /items'), 1);
  });

  testWidgets('2. «Legg ut» names the listing, and the name is kept with the draft',
      (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');

    final key = (await kept())!['key'] as String;
    expect(key, matches(uuid));

    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
    await leggUt(tester);

    expect(server.listingKeys, [key]);
    // In a header, not in the listing: the body is what the listing is.
    expect(server.bodies['POST /items']!.containsKey('key'), isFalse);
  });

  testWidgets('3. no answer to «Legg ut»: pressed again, the same listing is asked for',
      (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');

    // The first press may well have reached the server: the answer is what
    // was lost.
    server.overrides['POST /items'] = unreachable;
    await leggUt(tester);
    expect(find.text(noContact), findsOneWidget);
    expect(find.byType(PostItemScreen), findsOneWidget);

    // The server hands back the first listing for the same key, and the
    // phone, which cannot tell what that press carried, sends the form as a
    // correction to it.
    server.overrides['POST /items'] = Replayed({...FakeServer.drill, 'title': 'Fiskestang'});
    server.overrides['PATCH /items/item-drill'] = {...FakeServer.drill, 'title': 'Fiskestang'};
    await leggUt(tester);

    expect(server.listingKeys, hasLength(2));
    expect(server.listingKeys.first, matches(uuid));
    expect(server.listingKeys.last, server.listingKeys.first);
    expect(server.asked('PATCH /items/item-drill'), 1);
    expect(server.bodies['PATCH /items/item-drill']!['title'], 'Fiskestang');
    expect(toast(tester), 'Lagt ut. Nå kan folk like den.');
    expect(find.byType(ProfileScreen), findsOneWidget);
  });

  testWidgets('4. killed with the answer on its way: the form that comes back asks with the same name',
      (tester) async {
    final before = Phone();
    await boot(tester, before);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');
    server.overrides['POST /items'] = (http.Request _) => Completer<Object?>().future;
    await tester.tap(find.widgetWithText(PrimaryButton, 'Legg ut'));
    await tester.pump();
    await tester.pump();
    expect(server.asked('POST /items'), 1);
    await kill(tester);
    await tester.pump(SwaplyApi.patience);

    final after = Phone();
    await boot(tester, after);
    // Not sent on its own — it may have gone — but the form is back.
    expect(server.asked('POST /items'), 1);
    await openLeggUt(tester);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, 'Fiskestang');

    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};
    await leggUt(tester);

    expect(server.listingKeys, hasLength(2));
    expect(server.listingKeys.last, server.listingKeys.first);
    expect(server.listingKeys.first, matches(uuid));
  });

  testWidgets('5. the next draft is another listing: listed, or emptied, a new name', (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};

    await openLeggUt(tester);
    await title(tester, 'Fiskestang');
    await leggUt(tester);
    await toastGone(tester);
    await openLeggUt(tester);
    await title(tester, 'Telt');
    await leggUt(tester);
    await toastGone(tester);
    expect(server.listingKeys, hasLength(2));
    expect(server.listingKeys.last, isNot(server.listingKeys.first));

    // Emptied: the draft is thrown away, and so is its name.
    await openLeggUt(tester);
    await title(tester, 'Kajakk');
    final first = (await kept())!['key'];
    await title(tester, '');
    expect(await kept(), isNull);
    await title(tester, 'Sykkel');
    final second = (await kept())!['key'];
    expect(second, matches(uuid));
    expect(second, isNot(first));
    await leggUt(tester);
    expect(server.listingKeys.last, second);
  });

  testWidgets('6. a draft kept by an app from before there were names gets one', (tester) async {
    SharedPreferences.setMockInitialValues({
      'token': 'tok',
      'listingDraft:me-1': jsonEncode({
        'v': 1,
        'kind': 'item',
        'category': 'friluft',
        'condition': 'good',
        'title': 'Fiskestang',
        'description': '',
        'subcategory': '',
        'value': '',
        'postalCode': '',
        'photos': const <Object>[],
      }),
    });
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, 'Fiskestang');
    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};

    await leggUt(tester);

    expect(server.listingKeys.single, matches(uuid));
  });

  testWidgets('7. no answer, the form changed, pressed again: the listing is corrected to the form',
      (tester) async {
    final phone = Phone();
    await phone.session.login('ola@epost.no', 'passord');
    var picked = 0;
    await open(
        tester,
        phone,
        PostItemScreen(
            pickImage: () async => PickedPhoto([picked, 1, 2, 3], 'bilde${picked++}.jpg')));
    await tester.tap(find.text('Legg til bilder'));
    await tester.pumpAndSettle();
    await title(tester, 'Fiskestang');
    server.overrides['POST /items'] = unreachable;
    await leggUt(tester);
    expect(find.text(noContact), findsOneWidget);

    // The title put right, and a second picture, which goes up as it is
    // picked.
    await title(tester, 'Fiskestang, 2 m');
    await tester.tap(find.text('Legg til bilder'));
    await tester.pumpAndSettle();
    expect(server.uploads, 2);

    // The first press had reached the server.
    server.overrides['POST /items'] = Replayed({
      ...FakeServer.drill,
      'title': 'Fiskestang',
      'media': ['http://test/media/${FakeServer.storedPhoto}'],
    });
    server.overrides['PATCH /items/item-drill'] = {...FakeServer.drill, 'title': 'Fiskestang, 2 m'};
    await leggUt(tester);

    expect(server.asked('POST /items'), 2);
    expect(server.listingKeys.last, server.listingKeys.first);
    // One listing, reading as the form does now.
    expect(server.asked('PATCH /items/item-drill'), 1);
    expect(server.bodies['PATCH /items/item-drill']!['title'], 'Fiskestang, 2 m');
    expect(server.bodies['PATCH /items/item-drill']!['media'], [
      '/media/${FakeServer.storedPhoto}',
      '/media/${FakeServer.storedPhotoAt(1)}',
    ]);
    expect(toast(tester), 'Lagt ut. Nå kan folk like den.');
    expect(await kept(), isNull);
  });

  testWidgets('8. a listing made from scratch is not corrected: it is the form already', (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');
    server.overrides['POST /items'] = {...FakeServer.drill, 'title': 'Fiskestang'};

    await leggUt(tester);

    expect(server.asked('POST /items'), 1);
    expect(server.requests.where((r) => r.startsWith('PATCH')), isEmpty);
    expect(toast(tester), 'Lagt ut. Nå kan folk like den.');
  });

  testWidgets('9. no answer to the correction: the form and its draft stay, and the next press asks for both',
      (tester) async {
    final phone = Phone();
    await boot(tester, phone);
    await openLeggUt(tester);
    await title(tester, 'Fiskestang');
    server.overrides['POST /items'] = unreachable;
    await leggUt(tester);
    await title(tester, 'Fiskestang, 2 m');
    final key = (await kept())!['key'];

    server.overrides['POST /items'] = Replayed({...FakeServer.drill, 'title': 'Fiskestang'});
    server.overrides['PATCH /items/item-drill'] = unreachable;
    await leggUt(tester);

    // Not «Lagt ut»: the listing out there still has the old title.
    expect(find.text(noContact), findsOneWidget);
    expect(toast(tester), isNull);
    expect(find.byType(PostItemScreen), findsOneWidget);
    expect((await kept())!['key'], key);
    expect((await kept())!['title'], 'Fiskestang, 2 m');

    server.overrides['PATCH /items/item-drill'] = {...FakeServer.drill, 'title': 'Fiskestang, 2 m'};
    await leggUt(tester);

    expect(server.asked('POST /items'), 3);
    expect(server.listingKeys.toSet(), {key});
    expect(server.asked('PATCH /items/item-drill'), 2);
    expect(server.bodies['PATCH /items/item-drill']!['title'], 'Fiskestang, 2 m');
    expect(toast(tester), 'Lagt ut. Nå kan folk like den.');
    expect(await kept(), isNull);
  });

  testWidgets('10. handed back reserved by a trade: not corrected, the draft is let go of, and it says why',
      (tester) async {
    final phone = Phone();
    final key = await lostAnswer(tester, phone);

    // The first press had reached the server, and Ola has accepted a trade
    // with the listing since, from another phone.
    server.overrides['POST /items'] = Replayed(
        {...FakeServer.drill, 'title': 'Fiskestang', 'status': 'reserved', 'reserved': true});
    server.overrides['PATCH /items/item-drill'] = reservedRefusal;
    await leggUt(tester);

    // Not asked: the answer already says it would be refused.
    expect(server.asked('PATCH /items/item-drill'), 0);
    expect(toast(tester), heldByTrade);
    expect(tone(tester), ToastTone.note);
    expect(find.text('Lagt ut. Nå kan folk like den.'), findsNothing);
    await letGo(tester, key);
    // One listing, asked for twice under one name, and never again.
    expect(server.asked('POST /items'), 2);
    expect(server.listingKeys.toSet(), {key});
  });

  testWidgets('11. reserved between the answer and the correction: the refusal ends the draft the same way',
      (tester) async {
    final phone = Phone();
    final key = await lostAnswer(tester, phone);

    server.overrides['POST /items'] = Replayed({...FakeServer.drill, 'title': 'Fiskestang'});
    server.overrides['PATCH /items/item-drill'] = reservedRefusal;
    await leggUt(tester);

    expect(server.asked('PATCH /items/item-drill'), 1);
    // The server's refusal is not put over the button: pressing again would
    // only be refused again.
    expect(find.text(reservedRefusal.message), findsNothing);
    expect(toast(tester), heldByTrade);
    expect(tone(tester), ToastTone.note);
    await letGo(tester, key);
    expect(server.asked('POST /items'), 2);
  });

  testWidgets('12. any other refusal of the correction keeps the form and its draft, as no answer does',
      (tester) async {
    final phone = Phone();
    final key = await lostAnswer(tester, phone);

    server.overrides['POST /items'] = Replayed({...FakeServer.drill, 'title': 'Fiskestang'});
    server.overrides['PATCH /items/item-drill'] =
        const Refusal(400, 'invalid_request', 'Noe manglet i forespørselen.');
    await leggUt(tester);

    expect(find.text('Noe manglet i forespørselen.'), findsOneWidget);
    expect(toast(tester), isNull);
    expect(find.byType(PostItemScreen), findsOneWidget);
    expect((await kept())!['key'], key);
    expect((await kept())!['title'], 'Fiskestang, 2 m');
  });
}
