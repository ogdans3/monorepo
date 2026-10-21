// 02, 10c and 16c: the ways in.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/onboarding.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/common.dart';

import 'fake_server.dart';

late FakeServer server;
late SwaplyApi api;
late Session session;

Future<void> mount(WidgetTester tester, Widget screen, {bool signedIn = false}) async {
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

Finder get password => find.descendant(of: find.byType(PasswordField), matching: find.byType(TextField));

bool hidden(WidgetTester tester) => tester.widget<TextField>(password).obscureText;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    api = SwaplyApi(baseUrl: 'http://test', client: server.client);
    session = Session(api)..loading = false;
  });

  group('the password can be seen before it counts', () {
    // There is no reset yet, so one letter wrong in the password made on 10c
    // locked a tester out for good.
    for (final (name, screen) in [
      ('10c', const CreateProfileScreen(continuingToListing: true) as Widget),
      ('16c', const LoginScreen()),
    ]) {
      testWidgets('$name hides it as drawn, and the eye shows it and hides it again',
          (tester) async {
        await mount(tester, screen);
        await tester.enterText(password, 'drillbits123');
        expect(hidden(tester), isTrue);

        await tester.tap(find.bySemanticsLabel('Vis passordet'));
        await tester.pump();
        expect(hidden(tester), isFalse);
        expect(find.text('drillbits123'), findsOneWidget);
        // Typed is typed: the eye changes nothing in it.
        expect(tester.widget<TextField>(password).controller!.text, 'drillbits123');

        await tester.tap(find.bySemanticsLabel('Skjul passordet'));
        await tester.pump();
        expect(hidden(tester), isTrue);
      });

      testWidgets('$name keeps the field the height the export draws it', (tester) async {
        await mount(tester, screen);
        final fields = find.byType(TextField);
        // The address field over it has no eye.
        final address = tester.getSize(fields.at(screen is LoginScreen ? 0 : 1)).height;
        expect(tester.getSize(password).height, address);
        // And the eye answers across a finger, inside the field.
        final eye = tester.getSemantics(find.bySemanticsLabel('Vis passordet')).rect;
        expect(eye.height, greaterThanOrEqualTo(kTapTarget));
        expect(eye.width, greaterThanOrEqualTo(kTapTarget));
      });

      testWidgets('$name leaves the keyboard up when the eye is pressed', (tester) async {
        await mount(tester, screen);
        await tester.tap(password);
        await tester.pump();
        expect(tester.testTextInput.isVisible, isTrue);

        await tester.tap(find.bySemanticsLabel('Vis passordet'));
        await tester.pump();
        expect(tester.testTextInput.isVisible, isTrue);
        expect(hidden(tester), isFalse);
      });
    }

    testWidgets('10c asks for it once: no second field to type it again', (tester) async {
      await mount(tester, const CreateProfileScreen(continuingToListing: true));

      expect(find.byType(TextField), findsNWidgets(4));
      expect(find.byType(PasswordField), findsOneWidget);
    });

    testWidgets('10c sends the password as typed, whichever way it was shown', (tester) async {
      await session.lookAround();
      await mount(tester, const CreateProfileScreen());
      for (final (field, text) in [
        (0, 'Ola N.'),
        (1, 'ola@epost.no'),
        (2, '412 34 567'),
        (3, 'drillbits123'),
      ]) {
        await tester.enterText(find.byType(TextField).at(field), text);
      }
      await tester.tap(find.bySemanticsLabel('Vis passordet'));
      await tester.pump();
      await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
      await tester.pumpAndSettle();

      expect(server.bodies['POST /auth/register']!['password'], 'drillbits123');
    });
  });

  // The button spins and takes no second press while the answer is on its
  // way; the return key on the password field went past it, and asked again.
  group('the return key does not ask twice', () {
    testWidgets('16c signs in once', (tester) async {
      await session.lookAround();
      await mount(tester, const LoginScreen());
      final answer = Completer<void>();
      server.overrides['POST /auth/login'] =
          (http.Request _) => answer.future.then((_) => asUsual);

      await tester.enterText(find.byType(TextField).first, 'ola@epost.no');
      await tester.enterText(password, 'passord1');
      await tester.tap(find.widgetWithText(PrimaryButton, 'Logg inn'));
      await tester.pump();
      await tester.showKeyboard(password);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(server.asked('POST /auth/login'), 1);
      answer.complete();
      await tester.pumpAndSettle();
      expect(server.asked('POST /auth/login'), 1);
    });

    testWidgets('10c makes the profile once', (tester) async {
      await session.lookAround();
      await mount(tester, const CreateProfileScreen());
      final answer = Completer<void>();
      server.overrides['POST /auth/register'] =
          (http.Request request) => answer.future.then((_) => asUsual);
      for (final (field, text) in [
        (0, 'Ola N.'),
        (1, 'ola@epost.no'),
        (3, 'drillbits123'),
      ]) {
        await tester.enterText(find.byType(TextField).at(field), text);
      }

      await tester.tap(find.widgetWithText(PrimaryButton, 'Lag profil'));
      await tester.pump();
      await tester.showKeyboard(password);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(server.asked('POST /auth/register'), 1);
      answer.complete();
      await tester.pumpAndSettle();
      expect(server.asked('POST /auth/register'), 1);
    });
  });
}
