// «Slett kontoen», and the way back from «Ikke vis meg slike».
//
// `../docs/DESIGN.md`, «Erasure and retention»: a person deletes their own
// account with `DELETE /me`. An account with a password gives it, because a
// phone left unlocked on a table is not the person; every session dies, and
// the phone is then nobody's — so the gate makes whoever holds it next a new
// stranger, as after «Logg ut». What the server refuses, it refuses in words,
// and the words are said where the button was pressed.
//
// Round 5 left no room for it but the «Juridisk og personvern» row on 16b,
// which opened a dialog; it opens a screen now, and deletion is at its foot.
//
// And «Ikke vis meg slike» is a choice somebody can forget having made, so
// 16b offers «Vis alt på Oppdag igjen» for as long as anything is hidden, and
// only then: round 5's Ola has hidden nothing, and its 16b stays as drawn.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/main.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/screens/profile.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';
import 'package:swaply_app/widgets/shell.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

const password = 'drillbits123';
const oldDevice = '0123456789abcdef0123456789abcdef';

/// What `main.dart` does, with a token kept from last time.
Future<void> boot(WidgetTester tester,
    {Map<String, Object> saved = const {'token': 'tok'}, Size size = const Size(430, 1800)}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  SharedPreferences.setMockInitialValues({...saved, 'deviceId': oldDevice});
  await tester.pumpWidget(
    ChangeNotifierProvider<Session>.value(value: session, child: SwaplyApp(api: api)),
  );
  unawaited(session.restore());
  await tester.pumpAndSettle();
}

/// Profil › Innstillinger › Juridisk og personvern › Slett kontoen.
Future<void> openDeletion(WidgetTester tester) async {
  await tester.tap(find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Innstillinger'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Juridisk og personvern'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Slett kontoen'));
  await tester.pumpAndSettle();
}

Finder get sheet => find.byType(BottomSheet);
Finder get passwordField => find.descendant(of: sheet, matching: find.byType(TextField));
Finder get deleteButton => find.widgetWithText(OutlinedButton, 'Slett kontoen');

int asked(String request) => server.asked(request);

Future<SharedPreferences> prefs() => SharedPreferences.getInstance();

void main() {
  setUp(() {
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api);
  });

  group('«Slett kontoen»', () {
    testWidgets('1. «Juridisk og personvern» is a screen without the bar, with the way to delete',
        (tester) async {
      await boot(tester);
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();

      expect(find.byType(LegalScreen), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      // What the product already said about itself, kept.
      expect(find.textContaining('Swaply er ikke part i byttene'), findsOneWidget);
      expect(find.textContaining('Vi lagrer aldri fødselsnummer'), findsOneWidget);
      // Nothing about a BankID reference: there is none until BankID is real.
      expect(find.textContaining('BankID'), findsNothing);
      expect(find.textContaining('tre år etter siste gjennomførte bytte'), findsOneWidget);
      // And for somebody who never completed one, which is what the engine
      // keeps too: three years from the deletion.
      expect(find.textContaining('eller etter slettingen om du aldri har byttet'), findsOneWidget);
      // The other way an account ends: a device that only looked around, left
      // unopened for twelve months.
      expect(
          find.textContaining('uten å lage en profil, slettes kontoen når appen ikke har vært '
              'åpnet på tolv måneder'),
          findsOneWidget);
      // And what NLOD 2.0 asks of anybody using Bring's postcode register:
      // the licensor, the licence and where both are, and that it was changed.
      expect(
          find.textContaining('Inneholder data under norsk lisens for offentlige data (NLOD) 2.0 '
              'tilgjengeliggjort av Posten Bring AS.'),
          findsOneWidget);
      expect(find.textContaining('Lisens: data.norge.no/nlod/no/2.0'), findsOneWidget);
      expect(find.text('Slett kontoen'), findsOneWidget);
      // Over the bar, as 16b is: nothing of the bar answers under it.
      expect(find.byType(SwaplyNavBar).hitTestable(), findsNothing);
    });

    testWidgets('1b. a device looking around is told the twelve-month rule on its own 13, and reaches the screen from there',
        (tester) async {
      // The rule is only for a device that never made a profile, and such a
      // device has no 16b: the screen that said it was one it could not open.
      // Its 13 said the likes were kept «her på enheten din», when the
      // server holds them, on an account it deletes after twelve idle months.
      server.overrides['GET /me'] = FakeServer.lookingAround;
      await boot(tester, saved: const {'token': FakeServer.deviceToken});
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();

      expect(find.text('Du ser deg rundt'), findsOneWidget);
      expect(find.textContaining('lagret på en konto for denne enheten'), findsOneWidget);
      expect(
          find.textContaining('Åpner du ikke appen på tolv måneder, slettes kontoen, og det du '
              'har likt med den.'),
          findsOneWidget);
      expect(find.textContaining('her på enheten din'), findsNothing);

      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();

      expect(find.byType(LegalScreen), findsOneWidget);
      expect(find.textContaining('slettes kontoen når appen ikke har vært åpnet på tolv måneder'),
          findsOneWidget);
      // The postcode register's credit is for a device too: 10b looks up its
      // towns for anybody.
      expect(find.textContaining('tilgjengeliggjort av Posten Bring AS.'), findsOneWidget);
      // And a device may delete its account as anybody may: see 8.
      expect(find.text('Slett kontoen'), findsOneWidget);
      expect(find.byType(SwaplyNavBar).hitTestable(), findsNothing);
    });

    testWidgets('2. it asks for the password, and a wrong one is said in the sheet', (tester) async {
      await boot(tester);
      await openDeletion(tester);

      expect(find.text('Slette kontoen?'), findsOneWidget);
      // One sentence, and what is true of the erasure.
      expect(find.textContaining('Profilen din tømmes'), findsOneWidget);
      expect(find.textContaining('tre år etter siste gjennomførte bytte'), findsNWidgets(2));
      expect(find.textContaining('eller etter slettingen om du aldri har byttet'), findsNWidgets(2));

      // Nothing is sent without one.
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();
      expect(find.text('Skriv inn passordet ditt.'), findsOneWidget);
      expect(asked('DELETE /me'), 0);

      // A wrong one is the server's to say, and the person is still here.
      server.overrides['DELETE /me'] = const Refusal(403, 'wrong_password', 'Feil passord.');
      await tester.enterText(passwordField, 'feil');
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();
      expect(find.text('Feil passord.'), findsOneWidget);
      expect(find.text('Skriv inn passordet ditt.'), findsNothing);
      expect(session.me?.id, FakeServer.me['id']);
      expect((await prefs()).getString('token'), 'tok');
      expect(sheet, findsOneWidget);
    });

    testWidgets('3. the right one deletes, and the phone is a new stranger\'s', (tester) async {
      await boot(tester);
      await openDeletion(tester);
      await tester.enterText(passwordField, password);
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();

      expect(asked('DELETE /me'), 1);
      expect(server.bodies['DELETE /me'], {'password': password});
      expect(server.bearers['DELETE /me'], 'Bearer tok');

      // Signed out on the phone: the token and the device id are gone, and
      // the gate has made a new stranger with a new id — the old one belonged
      // to the account that is gone.
      expect(session.anonymous, isTrue);
      final sent = server.bodies['POST /auth/anonymous']!['deviceId'] as String;
      expect(sent, isNot(oldDevice));
      expect(server.bearers['POST /auth/anonymous'], isNull);
      expect((await prefs()).getString('token'), FakeServer.deviceToken);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      expect(find.byType(LegalScreen), findsNothing);
      expect(find.text('Kontoen er slettet.'), findsOneWidget);
    });

    testWidgets('4. what the server will not erase is said in its words, and nothing changes',
        (tester) async {
      // The erasure engine refuses the account holding the key to the test
      // tooling until `pnpm admin revoke`, with a 409 in words.
      const refusal = Refusal(409, 'admin_account',
          'Denne kontoen har nøkkelen til testverktøyet. Nøkkelen må tas fra den før kontoen kan slettes.');
      server.overrides['DELETE /me'] = refusal;
      await boot(tester);
      await openDeletion(tester);
      await tester.enterText(passwordField, password);
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();

      expect(find.text(refusal.message), findsOneWidget);
      expect(session.me?.id, FakeServer.me['id']);
      expect(asked('POST /auth/anonymous'), 0);

      // No contact is no answer, and the account is still there to try again.
      server.overrides['DELETE /me'] = unreachable;
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();
      expect(find.text(noContact), findsOneWidget);
      expect(session.me?.id, FakeServer.me['id']);
      expect((await prefs()).getString('token'), 'tok');
    });

    testWidgets('5. pulled down while the answer is on its way, the phone still lets go',
        (tester) async {
      // The account is gone once the server says so, whether or not the
      // sheet is still up to hear it: a phone left holding the token would
      // be signed in as nobody.
      final answer = Completer<Object?>();
      server.overrides['DELETE /me'] = (http.Request _) => answer.future;
      await boot(tester);
      await openDeletion(tester);
      await tester.enterText(passwordField, password);
      await tester.tap(deleteButton);
      await tester.pump();
      expect(find.text('Sletter kontoen …'), findsOneWidget);

      await tester.tapAt(const Offset(215, 20));
      await tester.pumpAndSettle();
      expect(sheet, findsNothing);
      expect(session.me?.id, FakeServer.me['id']);

      answer.complete(<String, Object?>{});
      await tester.pumpAndSettle();
      expect(session.anonymous, isTrue);
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
    });

    testWidgets('6. as a test account it is the tool: no password, and back to the admin after',
        (tester) async {
      // A session the switcher minted has the admin's key behind it, not the
      // test account's password, which the admin does not know.
      server.overrides['GET /me'] = (http.Request r) =>
          r.headers['authorization'] == 'Bearer tok-test-1'
              ? FakeServer.actingAsTest
              : FakeServer.admin;
      await boot(tester, saved: {'token': 'tok-test-1', 'adminToken': 'tok'});
      expect(session.actingAs, isTrue);
      await openDeletion(tester);

      expect(find.text('Slette testkontoen?'), findsOneWidget);
      expect(passwordField, findsNothing);
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();

      expect(asked('DELETE /me'), 1);
      expect(server.bodies['DELETE /me'], isNull);
      expect(server.bearers['DELETE /me'], 'Bearer tok-test-1');
      // Themselves again, on their own token, and no stranger made.
      expect(session.me?.id, FakeServer.admin['id']);
      expect(session.actingAs, isFalse);
      expect(api.token, 'tok');
      expect((await prefs()).getString('token'), 'tok');
      expect(asked('POST /auth/anonymous'), 0);
      expect(find.byType(LegalScreen), findsNothing);
      expect(find.text('Testkontoen er slettet.'), findsOneWidget);
    });

    testWidgets('7. «Kontoen er slettet.» goes up over 02\'s «Fortsett», not across it',
        (tester) async {
      // A toast is placed once, as it goes up. Put up as the phone let go,
      // it was measured against the splash the new stranger is made behind,
      // which has nothing at its foot, and then lay across «Fortsett» for as
      // long as it was up. Held here on its way, as a real network holds it.
      final stranger = Completer<void>();
      server.overrides['POST /auth/anonymous'] =
          (http.Request _) => stranger.future.then((_) => asUsual);
      await boot(tester, size: const Size(390, 844));
      await openDeletion(tester);
      await tester.enterText(passwordField, password);
      await tester.tap(deleteButton);
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }

      // Nothing said over the splash, which is not where it will be read.
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(SwaplyToast), findsNothing);

      stranger.complete();
      await tester.pumpAndSettle();
      expect(find.text('Hva er du\ninteressert i?'), findsOneWidget);
      expect(find.text('Kontoen er slettet.'), findsOneWidget);
      final toast = tester.getRect(find.byType(SwaplyToast));
      final fortsett = tester.getRect(find.widgetWithText(PrimaryButton, 'Fortsett'));
      expect(toast.bottom, lessThanOrEqualTo(fortsett.top - 14));
      // And the button answers all the way across while it is up.
      expect(find.widgetWithText(PrimaryButton, 'Fortsett').hitTestable(), findsOneWidget);
    });
  });

  group('«Slett kontoen» for a device looking around', () {
    // ARCHITECTURE and DESIGN promise `DELETE /me` to a device, with its
    // token alone, and the server asks it for nothing more. The row was drawn
    // only for an account with a profile, so a stranger had no way to it.
    testWidgets('8. it is asked once, with no password, and the phone is a new stranger after',
        (tester) async {
      server.overrides['GET /me'] =
          (http.Request r) => r.headers['authorization'] == 'Bearer ${FakeServer.deviceToken}'
              ? FakeServer.lookingAround
              : FakeServer.me;
      await boot(tester, saved: const {'token': FakeServer.deviceToken});
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Juridisk og personvern'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Slett kontoen'));
      await tester.pumpAndSettle();

      expect(find.text('Slette kontoen?'), findsOneWidget);
      expect(find.textContaining('Du har ikke laget en profil, så vi beholder ingenting.'),
          findsOneWidget);
      // Nothing about a sealed record, which a device does not leave.
      expect(find.descendant(of: sheet, matching: find.textContaining('identitetspost')),
          findsNothing);
      expect(passwordField, findsNothing);

      // Pulled down, it was not sent.
      await tester.tap(find.widgetWithText(OutlinedButton, 'Avbryt'));
      await tester.pumpAndSettle();
      expect(asked('DELETE /me'), 0);

      await tester.tap(find.text('Slett kontoen'));
      await tester.pumpAndSettle();
      await tester.tap(deleteButton);
      await tester.pumpAndSettle();

      expect(asked('DELETE /me'), 1);
      expect(server.bodies['DELETE /me'], isNull);
      expect(server.bearers['DELETE /me'], 'Bearer ${FakeServer.deviceToken}');
      // A new stranger, with a new id: the old one went with the account.
      final sent = server.bodies['POST /auth/anonymous']!['deviceId'] as String;
      expect(sent, isNot(oldDevice));
      expect(session.anonymous, isTrue);
      expect(find.byType(LegalScreen), findsNothing);
      expect(find.text('Kontoen er slettet.'), findsOneWidget);
    });
  });

  group('«Vis alt på Oppdag igjen»', () {
    testWidgets('1. it is on 16b only while something is hidden', (tester) async {
      await boot(tester);
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();

      expect(find.text('Vis alt på Oppdag igjen'), findsNothing);
      expect(find.text('OPPDAG'), findsNothing);
    });

    testWidgets('2. pressed, everything comes back, and the row goes with it', (tester) async {
      var hidden = 3;
      server.overrides['GET /me'] = (http.Request _) => {...FakeServer.me, 'hiddenCount': hidden};
      server.overrides['DELETE /me/hidden'] = (http.Request _) {
        hidden = 0;
        return <String, Object?>{};
      };
      await boot(tester);
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();

      expect(find.text('OPPDAG'), findsOneWidget);
      expect(find.text('3 skjult'), findsOneWidget);
      final before = asked('GET /me');
      await tester.tap(find.text('Vis alt på Oppdag igjen'));
      await tester.pumpAndSettle();

      expect(asked('DELETE /me/hidden'), 1);
      // Asked again, so the count — here and behind Oppdag's «Angre» — is
      // the server's.
      expect(asked('GET /me'), before + 1);
      expect(session.me?.hiddenCount, 0);
      expect(find.text('Vis alt på Oppdag igjen'), findsNothing);
      expect(find.text('Alt vises på Oppdag igjen.'), findsOneWidget);
    });

    testWidgets('3. a refusal leaves the row where it was and says why', (tester) async {
      server.overrides['GET /me'] = {...FakeServer.me, 'hiddenCount': 1};
      server.overrides['DELETE /me/hidden'] = unreachable;
      await boot(tester);
      await tester.tap(
          find.descendant(of: find.byType(SwaplyNavBar), matching: find.text('Profil')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Innstillinger'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Vis alt på Oppdag igjen'));
      await tester.pumpAndSettle();
      expect(find.text(noContact), findsOneWidget);
      expect(find.text('1 skjult'), findsOneWidget);
    });
  });
}
