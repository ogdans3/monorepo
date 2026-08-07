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
    await _upsert(saved);
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
    await _upsert(saved, replacingId: existing?.id);
    return saved;
  }

  /// Records what an open list currently looks like, so the home screen has
  /// something true to show before the network answers next time.
  Future<void> record({
    required String id,
    String? token,
    String? title,
    int? doneCount,
    int? totalCount,
    bool touch = false,
  }) async {
    final current = byId(id);
    if (current == null) return;
    final updated = current.copyWith(
      token: token,
      title: title,
      doneCount: doneCount,
      totalCount: totalCount,
      lastOpenedAt: touch ? DateTime.now() : null,
    );
    await _upsert(updated);
  }

  /// Removes the list from this device only. The list itself is untouched.
  /// Anyone else holding the link still has it.
  Future<void> forget(String id) async {
    _lists = [
      for (final list in _lists)
        if (list.id != id) list,
    ];
    notifyListeners();
    await _store.save(_lists);
  }

  Future<void> _upsert(SavedList list, {String? replacingId}) async {
    _lists = _sorted([
      list,
      for (final existing in _lists)
        if (existing.id != list.id && existing.id != replacingId) existing,
    ]);
    notifyListeners();
    await _store.save(_lists);
  }

  static List<SavedList> _sorted(List<SavedList> lists) =>
      List.of(lists)..sort((a, b) => b.lastOpenedAt.compareTo(a.lastOpenedAt));
}
