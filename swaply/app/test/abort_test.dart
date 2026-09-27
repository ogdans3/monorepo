// A request the app has given up on is called off.
//
// Until `http` 1.5 a request could not be aborted, so one that ran past the
// api's patience went on in the background and could reach the server after
// the app had said it failed: «Ikke vis meg slike» said «Vi får ikke kontakt»
// and was applied a minute later, with nothing on screen to show it. Now the
// connection is closed when the api gives up.
//
// Closing it cannot take back what already reached the server — a request
// sent whole is carried out whether or not anybody still waits for the answer
// — so no answer is still not a no. A screen that changed itself on the tap
// says it has no contact, and asks again behind what it shows, and what the
// server says then is what stays on screen.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:swaply_app/api/client.dart';
import 'package:swaply_app/screens/discover.dart';
import 'package:swaply_app/state/session.dart';
import 'package:swaply_app/widgets/toast.dart';

import 'fake_server.dart';

/// What a call came to, looked at without waiting for it.
class Outcome<T> {
  Outcome(Future<T> call) {
    call.then<void>((_) => done = true, onError: (Object e) {
      done = true;
      error = e;
    });
  }

  bool done = false;
  Object? error;

  ApiException get refusal => error! as ApiException;
}

/// A client that hands every request to [answer], and remembers whether the
/// request was called off — which [MockClient] leaves to whoever answers.
class Line {
  Line(this.answer);

  final Future<http.StreamedResponse> Function(http.BaseRequest) answer;
  final sent = <http.BaseRequest>[];
  final calledOff = <http.BaseRequest>{};

  http.Client get client => MockClient.streaming((request, _) {
        sent.add(request);
        if (request case http.Abortable(:final abortTrigger?)) {
          abortTrigger.then((_) => calledOff.add(request));
        }
        return answer(request);
      });
}

/// No answer, ever.
Future<http.StreamedResponse> silence(http.BaseRequest _) => Completer<http.StreamedResponse>().future;

void main() {
  group('the api', () {
    testWidgets('1. a request with no answer is called off when the api gives up on it',
        (tester) async {
      final line = Line(silence);
      final api = SwaplyApi(baseUrl: 'http://test', client: line.client)..token = 'tok';
      final asked = Outcome(api.hide('item-a'));

      await tester.pump(SwaplyApi.patience - const Duration(seconds: 1));
      expect(line.sent, hasLength(1));
      expect(line.calledOff, isEmpty);
      expect(asked.done, isFalse);

      await tester.pump(const Duration(seconds: 1));
      expect(line.calledOff, {line.sent.single});
      expect(asked.refusal.isNoContact, isTrue);
      expect(asked.refusal.message, noContact);
    });

    testWidgets('2. one answered in time is never called off', (tester) async {
      final line = Line((request) async => http.StreamedResponse(
          Stream.value(utf8.encode(jsonEncode(FakeServer.me))), 200,
          headers: {'content-type': 'application/json'}));
      final api = SwaplyApi(baseUrl: 'http://test', client: line.client)..token = 'tok';
      final asked = Outcome(api.me());

      await tester.pump();
      expect(asked.done, isTrue);
      expect(asked.error, isNull);
      await tester.pump(SwaplyApi.uploadPatience);
      expect(line.calledOff, isEmpty);
    });

    testWidgets('3. a photograph is called off after its own, longer patience', (tester) async {
      final line = Line(silence);
      final api = SwaplyApi(baseUrl: 'http://test', client: line.client)..token = 'tok';
      final sent = Outcome(api.uploadImage([1, 2, 3], filename: 'a.jpg'));

      await tester.pump(SwaplyApi.patience);
      expect(line.calledOff, isEmpty);
      await tester.pump(SwaplyApi.uploadPatience - SwaplyApi.patience);
      expect(line.calledOff, {line.sent.single});
      expect(sent.refusal.isNoContact, isTrue);
    });

    testWidgets('4. what is written in Norwegian goes up as UTF-8, whatever the header says',
        (tester) async {
      // The same raise brought http 1.6, which stopped adding «charset=utf-8»
      // to an application/json body. JSON is UTF-8 without it, and the server
      // reads it so: the bytes have to be.
      final line = Line((request) async => http.StreamedResponse(
          Stream.value(utf8.encode(jsonEncode(FakeServer.me))), 200,
          headers: {'content-type': 'application/json'}));
      final api = SwaplyApi(baseUrl: 'http://test', client: line.client)..token = 'tok';
      final asked = Outcome(api.updateMe({'displayName': 'Øystein Åsli'}));

      await tester.pump();
      expect(asked.error, isNull);
      final sent = line.sent.single as http.Request;
      expect(sent.headers['content-type'], matches(RegExp(r'^application/json(; charset=utf-8)?$')));
      expect(sent.bodyBytes, utf8.encode(jsonEncode({'displayName': 'Øystein Åsli'})));
    });
  });

  group('«Ikke vis meg slike» with no answer', () {
    late FakeServer server;
    late SwaplyApi api;
    late Session session;

    final kinds = [
      {...FakeServer.console, 'id': 'item-a', 'title': 'Konsoll A', 'subcategory': 'Konsoller'},
      {...FakeServer.console, 'id': 'item-c', 'title': 'Spill C', 'subcategory': 'Spill'},
    ].map((t) => {'owner': FakeServer.kari, ...t}).toList();

    /// Whether the server has written the hide down.
    late bool hidden;

    List<Map<String, Object?>> shown() => [
          for (final t in kinds)
            if (!(hidden && t['id'] == 'item-a')) t,
        ];

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      server = FakeServer();
      api = SwaplyApi(baseUrl: 'http://test', client: server.client);
      session = Session(api)..loading = false;
      hidden = false;
      server.overrides['GET /discover'] =
          (http.Request _) => {'total': shown().length, 'items': shown()};
      server.overrides['GET /me'] =
          (http.Request _) => {...FakeServer.me, 'hiddenCount': hidden ? 1 : 0};
    });

    Finder card(String id) => find.byKey(ValueKey('item-$id'));

    Future<void> mount(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await session.login('ola@epost.no', 'passord');
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<SwaplyApi>.value(value: api),
            ChangeNotifierProvider<Session>.value(value: session),
          ],
          child: const MaterialApp(home: DiscoverScreen()),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> hide(WidgetTester tester) async {
      await tester.longPress(find.text('Konsoll A'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ikke vis meg slike'));
      await tester.pump();
    }

    String? toast(WidgetTester tester) =>
        tester.widgetList<SwaplyToast>(find.byType(SwaplyToast)).firstOrNull?.message;

    testWidgets('1. carried out on the server after all: said, then asked again, and it stays hidden',
        (tester) async {
      // The server has it written down; the answer is what never comes.
      server.overrides['POST /me/hidden'] = (http.Request _) {
        hidden = true;
        return Completer<Object?>().future;
      };
      await mount(tester);
      final discovered = server.asked('GET /discover');

      await hide(tester);
      expect(card('a'), findsNothing);
      await tester.pump(SwaplyApi.patience);
      await tester.pumpAndSettle();

      expect(toast(tester), noContact);
      expect(server.asked('GET /discover'), discovered + 1);
      expect(card('a'), findsNothing);
      expect(card('c'), findsOneWidget);
      // 16b's count is the server's too.
      expect(session.me?.hiddenCount, 1);
    });

    testWidgets('2. never got there: said, asked again, and the kind is back', (tester) async {
      server.overrides['POST /me/hidden'] = unreachable;
      await mount(tester);
      final discovered = server.asked('GET /discover');

      await hide(tester);
      await tester.pumpAndSettle();

      expect(toast(tester), noContact);
      expect(server.asked('GET /discover'), discovered + 1);
      expect(card('a'), findsOneWidget);
      expect(session.me?.hiddenCount, 0);
    });

    testWidgets('3. refused is an answer, and nothing is asked again', (tester) async {
      server.overrides['POST /me/hidden'] = 500;
      await mount(tester);
      final discovered = server.asked('GET /discover');

      await hide(tester);
      await tester.pumpAndSettle();

      expect(toast(tester), 'Noe gikk galt hos oss.');
      expect(server.asked('GET /discover'), discovered);
      expect(card('a'), findsOneWidget);
    });
  });
}
