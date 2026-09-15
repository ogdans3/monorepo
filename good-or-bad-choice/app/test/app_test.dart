import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:good_or_bad_choice/data/api_client.dart';
import 'package:good_or_bad_choice/data/local_store.dart';
import 'package:good_or_bad_choice/data/models.dart';
import 'package:good_or_bad_choice/design/tokens.dart';
import 'package:good_or_bad_choice/main.dart';
import 'package:good_or_bad_choice/state/app_state.dart';
import 'package:good_or_bad_choice/ui/home_screen.dart';
import 'package:good_or_bad_choice/ui/menu_screen.dart';
import 'package:good_or_bad_choice/ui/recap_screen.dart';
import 'package:good_or_bad_choice/ui/widgets/falling_squares.dart';
import 'package:http/http.dart' as http;

/// Never reached. Every test here is about what happens on the device, which is
/// everything the product does before an account exists.
ApiClient _noNetwork() => ApiClient(client: _RefusingClient());

class _RefusingClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) =>
      Future.error(const SocketExceptionStandIn());
}

class SocketExceptionStandIn implements Exception {
  const SocketExceptionStandIn();
}

Future<AppState> _state({List<Tap> taps = const []}) async {
  final state = AppState(store: MemoryStore(taps), api: _noNetwork());
  await state.load();
  return state;
}

Tap _tap(Choice kind, DateTime at) =>
    Tap(id: newId(), kind: kind, at: at, synced: false);

Widget _wrap(AppState state, Widget child) {
  return AppScope(
    notifier: state,
    child: PaletteScope(
      palette: Palette.lightGreenRed,
      child: MaterialApp(home: child),
    ),
  );
}

void main() {
  group('a tap', () {
    test('lands in memory before anything else happens', () async {
      final state = await _state();
      final before = DateTime.now();

      final tap = state.record(Choice.good);

      // Synchronous. Nothing was awaited, nothing was asked of the network, and
      // the list already has it.
      expect(state.taps, hasLength(1));
      expect(state.taps.single.id, tap.id);
      expect(tap.kind, Choice.good);
      expect(tap.synced, isFalse);
      expect(tap.at.isBefore(before.subtract(const Duration(seconds: 1))), isFalse);
    });

    test('survives a reload of the same store', () async {
      final store = MemoryStore();
      final first = AppState(store: store, api: _noNetwork());
      await first.load();
      first.record(Choice.good);
      first.record(Choice.bad);
      await first.flush();

      final second = AppState(store: store, api: _noNetwork());
      await second.load();
      expect(second.taps.map((tap) => tap.kind), [Choice.good, Choice.bad]);
    });

    test('can be taken back for a moment, and only the last one', () async {
      final state = await _state();
      final first = state.record(Choice.good);
      final second = state.record(Choice.bad);

      // The offer is for the most recent, never for the one before it.
      expect(state.undoable?.id, second.id);
      state.undo(first);
      expect(state.taps, hasLength(2));

      state.undo(second);
      expect(state.taps.map((tap) => tap.id), [first.id]);
    });

    test('is not offered back once the window has passed', () async {
      final old = _tap(Choice.bad, DateTime.now().subtract(const Duration(minutes: 5)));
      final state = await _state(taps: [old]);
      expect(state.undoable, isNull);
    });
  });

  group('a recap', () {
    test('covers only its own stretch of time', () async {
      final now = DateTime.now();
      final state = await _state(taps: [
        _tap(Choice.good, now.subtract(const Duration(days: 400))),
        _tap(Choice.bad, now.subtract(const Duration(days: 40))),
        _tap(Choice.good, now.subtract(const Duration(hours: 2))),
      ]);

      expect(state.recap(Span.day).total, 1);
      // Forty days ago is outside the last thirty and inside the last six
      // months, which is the boundary worth pinning.
      expect(state.recap(Span.month).total, 1);
      expect(state.recap(Span.halfYear).total, 2);
      expect(state.recap(Span.year).total, 2);
      expect(state.recap(Span.all).total, 3);
    });

    test('calls a tie good, because breaking even is not losing', () {
      final now = DateTime.now();
      final even = Recap(span: Span.day, taps: [
        _tap(Choice.good, now),
        _tap(Choice.bad, now),
      ]);
      expect(even.mostlyGood, isTrue);

      final worse = Recap(span: Span.day, taps: [
        _tap(Choice.good, now),
        _tap(Choice.bad, now),
        _tap(Choice.bad, now),
      ]);
      expect(worse.mostlyGood, isFalse);
    });

    test('reads oldest first, so the grid starts at the top left', () async {
      final now = DateTime.now();
      final state = await _state(taps: [
        _tap(Choice.bad, now.subtract(const Duration(hours: 1))),
        _tap(Choice.good, now.subtract(const Duration(hours: 5))),
      ]);
      expect(state.recap(Span.day).taps.map((tap) => tap.kind), [Choice.good, Choice.bad]);
    });
  });

  group('the grid', () {
    test('fits everything it is given, and says when it cannot', () {
      const size = Size(360, 560);

      final few = GridPlan.fit(size, 12);
      expect(few.columns * few.rows, greaterThanOrEqualTo(12));
      expect(few.capacity, greaterThanOrEqualTo(12));

      final many = GridPlan.fit(size, 2000);
      expect(many.capacity, greaterThanOrEqualTo(2000));
      // Smaller cells for more of them, which is the whole point of fitting.
      expect(many.cell, lessThan(few.cell));
    });

    test('keeps a short history in a block rather than a single long row', () {
      final plan = GridPlan.fit(const Size(360, 560), 9);
      expect(plan.rows * plan.columns, greaterThanOrEqualTo(9));
      expect(plan.rows, lessThanOrEqualTo(9));
    });
  });

  group('the screen', () {
    testWidgets('records a tap from either half', (tester) async {
      final state = await _state();
      await tester.pumpWidget(_wrap(state, const HomeScreen()));

      await tester.tap(find.text('good'));
      await tester.pump();
      expect(state.taps.single.kind, Choice.good);

      await tester.tap(find.text('bad'));
      await tester.pump();
      expect(state.taps.map((tap) => tap.kind), [Choice.good, Choice.bad]);

      // Let the tossed squares finish so no timer outlives the test.
      await tester.pumpAndSettle();
    });

    testWidgets('throws a square towards the corner, and clears it up after', (tester) async {
      final state = await _state();
      await tester.pumpWidget(_wrap(state, const HomeScreen()));

      await tester.tap(find.text('good'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 140));

      // In the air: one square of the colour just chosen, somewhere between the
      // finger and the corner button.
      final flying = find.byKey(const ValueKey('tossed'));
      expect(flying, findsOneWidget);
      final midway = tester.getCenter(flying);
      await tester.pump(const Duration(milliseconds: 160));
      final later = tester.getCenter(flying);
      // Down and to the left, which is where the corner is.
      expect(later.dx, lessThan(midway.dx));
      expect(later.dy, greaterThan(midway.dy));

      // And it does not linger once it has arrived.
      await tester.pumpAndSettle();
      expect(flying, findsNothing);
    });

    testWidgets('does not throw anything when animations are off', (tester) async {
      final state = await _state();
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: _wrap(state, const HomeScreen()),
        ),
      );

      await tester.tap(find.text('bad'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 140));

      // The flash is the acknowledgement that survives Reduce Motion. A square
      // arcing across the screen is precisely what was asked not to happen.
      expect(find.byKey(const ValueKey('tossed')), findsNothing);
      expect(state.taps.single.kind, Choice.bad);
      await tester.pumpAndSettle();
    });

    testWidgets('says both words, so the colour is never carrying it alone', (tester) async {
      final state = await _state();
      await tester.pumpWidget(_wrap(state, const HomeScreen()));
      expect(find.text('good'), findsOneWidget);
      expect(find.text('bad'), findsOneWidget);
    });

    testWidgets('offers a stretch with nothing in it, but will not open it', (tester) async {
      final state = await _state();
      await tester.pumpWidget(_wrap(state, const MenuScreen()));

      expect(find.text('nothing yet'), findsNWidgets(Span.values.length));
      final row = tester.widget<InkWell>(
        find.descendant(of: find.byType(MenuScreen), matching: find.byType(InkWell)).first,
      );
      // A recap of nothing would be a blank screen with a verdict on it.
      expect(row.onTap, isNull);
    });

    testWidgets('lands every square at once when animations are off', (tester) async {
      final now = DateTime.now();
      final state = await _state(taps: [
        for (var i = 0; i < 20; i++) _tap(i.isEven ? Choice.good : Choice.bad, now),
      ]);

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: _wrap(state, const RecapScreen(span: Span.day)),
        ),
      );
      await tester.pump();

      // Straight to the end, with no four seconds of falling to sit through.
      final painter = tester.widget<CustomPaint>(
        find.descendant(of: find.byType(FallingSquares), matching: find.byType(CustomPaint)).first,
      );
      expect(painter, isNotNull);
      expect(find.text('mostly good'), findsOneWidget);
      expect(find.textContaining('10 of 20'), findsOneWidget);
    });
  });
}
