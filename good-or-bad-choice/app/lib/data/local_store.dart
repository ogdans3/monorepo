import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Where the taps live.
///
/// This is not a cache. Until somebody makes an account it is the only copy
/// there is, and after that it is still the copy every screen reads from. The
/// server is a second home for the same facts, never a source of truth this has
/// to agree with.
abstract interface class LocalStore {
  Future<List<Tap>> loadTaps();
  Future<void> saveTaps(List<Tap> taps);

  Future<String?> loadToken();
  Future<void> saveToken(String? token);

  Future<String?> loadUsername();
  Future<void> saveUsername(String? username);

  Future<bool> loadColourBlind();
  Future<void> saveColourBlind(bool value);
}

class PrefsStore implements LocalStore {
  PrefsStore({SharedPreferencesAsync? prefs}) : _prefs = prefs ?? SharedPreferencesAsync();

  static const _taps = 'gobc.taps.v1';
  static const _token = 'gobc.token.v1';
  static const _username = 'gobc.username.v1';
  static const _colourBlind = 'gobc.colourBlind.v1';

  final SharedPreferencesAsync _prefs;

  @override
  Future<List<Tap>> loadTaps() async {
    final raw = await _prefs.getString(_taps);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw) as List;
      final taps = <Tap>[];
      for (final entry in decoded) {
        if (entry is! Map) continue;
        // One unreadable row is one lost tap, not a lost history.
        final tap = Tap.fromJson(entry.cast<String, Object?>());
        if (tap != null) taps.add(tap);
      }
      return taps;
    } catch (_) {
      // A history this cannot read is a history that is gone, and that is sad.
      // A crash loop on every launch is worse, and it takes the history with it
      // anyway because nobody can get to the screen that would export it.
      return const [];
    }
  }

  @override
  Future<void> saveTaps(List<Tap> taps) =>
      _prefs.setString(_taps, jsonEncode([for (final tap in taps) tap.toJson()]));

  @override
  Future<String?> loadToken() => _prefs.getString(_token);

  @override
  Future<void> saveToken(String? token) async {
    if (token == null) {
      await _prefs.remove(_token);
    } else {
      await _prefs.setString(_token, token);
    }
  }

  @override
  Future<String?> loadUsername() => _prefs.getString(_username);

  @override
  Future<void> saveUsername(String? username) async {
    if (username == null) {
      await _prefs.remove(_username);
    } else {
      await _prefs.setString(_username, username);
    }
  }

  @override
  Future<bool> loadColourBlind() async => await _prefs.getBool(_colourBlind) ?? false;

  @override
  Future<void> saveColourBlind(bool value) => _prefs.setBool(_colourBlind, value);
}

/// For tests and previews.
class MemoryStore implements LocalStore {
  MemoryStore([List<Tap> initial = const []]) : _taps = List.of(initial);

  List<Tap> _taps;
  String? _token;
  String? _username;
  bool _colourBlind = false;

  @override
  Future<List<Tap>> loadTaps() async => List.unmodifiable(_taps);

  @override
  Future<void> saveTaps(List<Tap> taps) async => _taps = List.of(taps);

  @override
  Future<String?> loadToken() async => _token;

  @override
  Future<void> saveToken(String? token) async => _token = token;

  @override
  Future<String?> loadUsername() async => _username;

  @override
  Future<void> saveUsername(String? username) async => _username = username;

  @override
  Future<bool> loadColourBlind() async => _colourBlind;

  @override
  Future<void> saveColourBlind(bool value) async => _colourBlind = value;
}
