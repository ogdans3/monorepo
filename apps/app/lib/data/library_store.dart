import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Persistence for the device's list index.
///
/// There are no accounts, so this is the only record that a list exists. Lose
/// it and the lists are still there, but only for whoever still holds a link.
/// That trade is the product, not a bug, and it is why the share sheet puts the
/// link in front of you rather than burying it.
abstract interface class LibraryStore {
  Future<List<SavedList>> load();
  Future<void> save(List<SavedList> lists);
}

class PrefsLibraryStore implements LibraryStore {
  PrefsLibraryStore({SharedPreferencesAsync? prefs})
    : _prefs = prefs ?? SharedPreferencesAsync();

  static const _key = 'checkpost.lists.v1';

  final SharedPreferencesAsync _prefs;

  @override
  Future<List<SavedList>> load() async {
    final raw = await _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw) as List;
      return [
        for (final entry in decoded)
          SavedList.fromJson((entry as Map).cast<String, dynamic>()),
      ];
    } catch (_) {
      // A corrupt index must not brick the app. Losing the index is survivable
      // (the lists themselves are on the server), but a crash loop is not.
      return const [];
    }
  }

  @override
  Future<void> save(List<SavedList> lists) =>
      _prefs.setString(_key, jsonEncode([for (final l in lists) l.toJson()]));
}

/// For tests and previews.
class MemoryLibraryStore implements LibraryStore {
  MemoryLibraryStore([List<SavedList> initial = const []])
    : _lists = List.of(initial);

  List<SavedList> _lists;

  @override
  Future<List<SavedList>> load() async => List.unmodifiable(_lists);

  @override
  Future<void> save(List<SavedList> lists) async => _lists = List.of(lists);
}

/// The device's opaque client id, minted once and reused. It is sent with
/// every write so the change feed can tell us which events we caused, and it
/// identifies nothing about the person holding the phone.
class ClientIdStore {
  ClientIdStore({SharedPreferencesAsync? prefs})
    : _prefs = prefs ?? SharedPreferencesAsync();

  static const _key = 'checkpost.clientId.v1';
  final SharedPreferencesAsync _prefs;

  Future<String> read(String Function() generate) async {
    final existing = await _prefs.getString(_key);
    if (existing != null && existing.length >= 4) return existing;
    final fresh = generate();
    await _prefs.setString(_key, fresh);
    return fresh;
  }
}
