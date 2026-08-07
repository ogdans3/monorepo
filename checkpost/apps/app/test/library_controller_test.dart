import 'package:checkpost/data/library_store.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/state/library_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

/// A store that counts, so a test can assert on how often the index is written
/// rather than only on what it ends up containing.
class CountingStore implements LibraryStore {
  CountingStore([List<SavedList> initial = const []])
    : _lists = List.of(initial);

  List<SavedList> _lists;
  int saves = 0;

  @override
  Future<List<SavedList>> load() async => List.unmodifiable(_lists);

  @override
  Future<void> save(List<SavedList> lists) async {
    saves++;
    _lists = List.of(lists);
  }
}

void main() {
  late FakeServer server;

  SavedList entry({String title = 'Cabin, Friday', int done = 0, int total = 0}) =>
      SavedList(
        id: '11111111-1111-4111-8111-111111111111',
        token: 'a' * 43,
        title: title,
        doneCount: done,
        totalCount: total,
        lastOpenedAt: DateTime(2026, 8, 1),
      );

  setUp(() => server = FakeServer());

  test('an unchanged report notifies nobody and writes nothing', () async {
    // An open list reports its title and counts on every change, including
    // every timer tick. Treating each of those as a change rebuilt the home
    // screen underneath and wrote the whole index to disk, which is most of
    // where the app felt slow.
    final store = CountingStore([entry(done: 2, total: 5)]);
    final library = LibraryController(store: store, api: server.client());
    await library.load();

    var notifications = 0;
    library.addListener(() => notifications++);

    for (var i = 0; i < 20; i++) {
      library.record(
        id: entry().id,
        title: 'Cabin, Friday',
        doneCount: 2,
        totalCount: 5,
      );
    }

    expect(notifications, 0);
    expect(store.saves, 0);
    library.dispose();
  });

  test('a real change notifies once and is coalesced into one write', () async {
    final store = CountingStore([entry(total: 5)]);
    final library = LibraryController(store: store, api: server.client());
    await library.load();

    var notifications = 0;
    library.addListener(() => notifications++);

    // Ticking five boxes in a row is one burst, not five trips to disk.
    for (var done = 1; done <= 5; done++) {
      library.record(id: entry().id, doneCount: done, totalCount: 5);
    }
    expect(notifications, 5, reason: 'the screen updates on every change');
    expect(store.saves, 0, reason: 'the write is still pending');

    await Future<void>.delayed(const Duration(milliseconds: 600));
    expect(store.saves, 1);
    expect((await store.load()).single.doneCount, 5);
    library.dispose();
  });

  test('a new token skips the debounce, because losing it locks you out', () async {
    final store = CountingStore([entry()]);
    final library = LibraryController(store: store, api: server.client());
    await library.load();

    library.record(id: entry().id, token: 'b' * 43);

    // No waiting. If the app died here the device would have lost its own list.
    await Future<void>.delayed(Duration.zero);
    expect(store.saves, 1);
    expect((await store.load()).single.token, 'b' * 43);
    library.dispose();
  });

  test('flush writes a pending change straight away', () async {
    final store = CountingStore([entry(total: 3)]);
    final library = LibraryController(store: store, api: server.client());
    await library.load();

    library.record(id: entry().id, doneCount: 1, totalCount: 3);
    expect(store.saves, 0);

    await library.flush();
    expect(store.saves, 1);
    library.dispose();
  });

  test('forgetting a list removes it and writes immediately', () async {
    final store = CountingStore([entry()]);
    final library = LibraryController(store: store, api: server.client());
    await library.load();

    await library.forget(entry().id);

    expect(library.lists, isEmpty);
    expect(await store.load(), isEmpty);
    library.dispose();
  });
}
