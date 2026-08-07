import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/library_store.dart';
import '../data/models.dart';

/// "Your lists": the index of every list this device knows a link to.
///
/// Ordered most-recently-opened first, because the list you want is almost
/// always the one you just had.
class LibraryController extends ChangeNotifier {
  LibraryController({required LibraryStore store, required CheckpostApi api})
    : _store = store,
      _api = api;

  final LibraryStore _store;
  final CheckpostApi _api;

  List<SavedList> _lists = const [];
  bool _loading = true;
  Timer? _save;
  bool _disposed = false;

  /// Writes to disk are coalesced. An open list reports its title and counts on
  /// every change, and encoding the whole index and pushing it through the
  /// platform channel on each of those was enough to make the app feel slow.
  static const _saveDelay = Duration(milliseconds: 400);

  List<SavedList> get lists => _lists;
  bool get isLoading => _loading;
  bool get isEmpty => !_loading && _lists.isEmpty;

  Future<void> load() async {
    _lists = _sorted(await _store.load());
    _loading = false;
    notifyListeners();
  }

  SavedList? byId(String id) {
    for (final list in _lists) {
      if (list.id == id) return list;
    }
    return null;
  }

  SavedList? byToken(String token) {
    for (final list in _lists) {
      if (list.token == token) return list;
    }
    return null;
  }

  /// Creates a list on the server and files the link away.
  Future<SavedList> create(String title) async {
    final created = await _api.createList(title.trim());
    final saved = SavedList(
      id: created.snapshot.list.id,
      token: created.token,
      title: created.snapshot.list.title,
      doneCount: 0,
      totalCount: created.snapshot.items.length,
      lastOpenedAt: DateTime.now(),
    );
    _upsert(saved, immediate: true);
    return saved;
  }

  /// Adds a list from a link somebody sent. Fetching the snapshot first means
  /// a dead or mistyped link fails here, where we can explain it, rather than
  /// leaving a broken row on the home screen.
  Future<SavedList> addByToken(String token) async {
    final existing = byToken(token);
    final snapshot = await _api.snapshot(token);

    final saved = SavedList(
      id: snapshot.list.id,
      token: token,
      title: snapshot.list.title,
      doneCount: snapshot.items.where((item) => item.checked).length,
      totalCount: snapshot.items.length,
      lastOpenedAt: DateTime.now(),
    );
    // Same list arriving on a new link. Replace the old token rather than
    // showing the list twice.
    _upsert(saved, replacingId: existing?.id, immediate: true);
    return saved;
  }

  /// Records what an open list currently looks like, so the home screen has
  /// something true to show before the network answers next time.
  ///
  /// Called on every change to an open list, so it has to be cheap and it has
  /// to be silent when nothing actually changed.
  void record({
    required String id,
    String? token,
    String? title,
    int? doneCount,
    int? totalCount,
    bool touch = false,
  }) {
    final current = byId(id);
    if (current == null) return;
    final updated = current.copyWith(
      token: token,
      title: title,
      doneCount: doneCount,
      totalCount: totalCount,
      lastOpenedAt: touch ? DateTime.now() : null,
    );
    // A new token is the one thing here that cannot wait. Losing it would lock
    // this device out of its own list, so that write skips the debounce.
    _upsert(updated, immediate: token != null);
  }

  /// Removes the list from this device only. The list itself is untouched.
  /// Anyone else holding the link still has it.
  Future<void> forget(String id) async {
    _lists = [
      for (final list in _lists)
        if (list.id != id) list,
    ];
    notifyListeners();
    await flush();
  }

  /// Writes any pending change to disk now. Call before the app goes away.
  Future<void> flush() async {
    _save?.cancel();
    _save = null;
    await _store.save(_lists);
  }

  void _upsert(SavedList list, {String? replacingId, bool immediate = false}) {
    // Nothing changed, so there is nothing to rebuild and nothing to write.
    // Without this the home screen rebuilt underneath every open list on every
    // tick of every timer, which is most of where the app felt heavy.
    if (replacingId == null && byId(list.id) == list) return;

    _lists = _sorted([
      list,
      for (final existing in _lists)
        if (existing.id != list.id && existing.id != replacingId) existing,
    ]);
    notifyListeners();

    _save?.cancel();
    if (immediate) {
      unawaited(_store.save(_lists));
    } else {
      _save = Timer(_saveDelay, () => unawaited(_store.save(_lists)));
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _save?.cancel();
    // The index is worth more than a clean shutdown, so this write is fired
    // rather than awaited.
    unawaited(_store.save(_lists));
    super.dispose();
  }

  bool get isDisposed => _disposed;

  static List<SavedList> _sorted(List<SavedList> lists) =>
      List.of(lists)..sort((a, b) => b.lastOpenedAt.compareTo(a.lastOpenedAt));
}
