import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/local_store.dart';
import '../data/models.dart';

/// Everything the app knows.
///
/// One controller, because there is one thing to know: a list of taps, and
/// optionally a name to keep it under. Splitting that into three would mean
/// three objects coordinating a sync between them.
class AppState extends ChangeNotifier {
  AppState({required LocalStore store, required ApiClient api}) : _store = store, _api = api;

  final LocalStore _store;
  final ApiClient _api;

  List<Tap> _taps = const [];
  String? _token;
  String? _username;
  bool _colourBlind = false;
  bool _loading = true;
  bool _syncing = false;
  String? _message;

  Timer? _save;
  Timer? _push;
  bool _disposed = false;

  /// Disk writes are coalesced. A run of taps is a run of rewrites of the whole
  /// history otherwise, and the history is the one thing worth not churning.
  static const _saveDelay = Duration(milliseconds: 400);

  /// Sending is coalesced harder. Nothing on screen waits for it, and somebody
  /// tapping three times in a row should cost one request.
  static const _pushDelay = Duration(seconds: 3);

  /// Oldest first, always. Every screen that draws them reads like a page.
  List<Tap> get taps => _taps;
  bool get isLoading => _loading;
  bool get isSignedIn => _token != null;
  String? get username => _username;
  bool get colourBlind => _colourBlind;
  bool get isSyncing => _syncing;

  /// One sentence for the person, cleared once it has been shown.
  String? get message => _message;

  int get unsynced => _taps.where((tap) => !tap.synced).length;

  Future<void> load() async {
    _taps = _sorted(await _store.loadTaps());
    _token = await _store.loadToken();
    _username = await _store.loadUsername();
    _colourBlind = await _store.loadColourBlind();
    _loading = false;
    _notify();
    if (_token != null) unawaited(sync());
  }

  // ---------------------------------------------------------------------------
  // The only thing the product does
  // ---------------------------------------------------------------------------

  /// Records a tap and returns it, so the caller can animate the one it made.
  ///
  /// Synchronous on purpose. This is the whole product and it happens under a
  /// thumb: it lands in memory, the screen is already redrawing, and the disk
  /// and the network catch up on their own time.
  Tap record(Choice kind) {
    final tap = Tap(id: newId(), kind: kind, at: DateTime.now(), synced: false);
    _taps = [..._taps, tap];
    _notify();
    _scheduleSave();
    if (_token != null) _schedulePush();
    return tap;
  }

  /// Undoes the most recent tap, if it is recent enough to have been a slip.
  ///
  /// Only the last one, and only for a moment. A history you can edit is a
  /// history that flatters you, and the point of the grid is that it does not.
  static const undoWindow = Duration(seconds: 6);

  Tap? get undoable {
    if (_taps.isEmpty) return null;
    final last = _taps.last;
    if (last.synced) return null;
    return DateTime.now().difference(last.at) <= undoWindow ? last : null;
  }

  void undo(Tap tap) {
    if (_taps.isEmpty || _taps.last.id != tap.id || _taps.last.synced) return;
    _taps = _taps.sublist(0, _taps.length - 1);
    _notify();
    _scheduleSave();
  }

  Recap recap(Span span) {
    final from = span.startFrom(DateTime.now());
    if (from == null) return Recap(span: span, taps: List.unmodifiable(_taps));
    return Recap(
      span: span,
      taps: List.unmodifiable(_taps.where((tap) => tap.at.isAfter(from))),
    );
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  Future<void> setColourBlind(bool value) async {
    if (_colourBlind == value) return;
    _colourBlind = value;
    _notify();
    await _store.saveColourBlind(value);
  }

  // ---------------------------------------------------------------------------
  // The account, which is optional
  // ---------------------------------------------------------------------------

  Future<bool> register(String username, String password) =>
      _authenticate(() => _api.register(username.trim(), password));

  Future<bool> signIn(String username, String password) =>
      _authenticate(() => _api.login(username.trim(), password));

  Future<bool> _authenticate(Future<({String token, String username})> Function() attempt) async {
    try {
      final session = await attempt();
      _token = session.token;
      _username = session.username;
      // Straight to disk. Losing this means signing in again, which is a
      // nuisance rather than a loss, but it is an avoidable one.
      await _store.saveToken(_token);
      await _store.saveUsername(_username);
      _notify();
      await sync();
      return true;
    } on OfflineException {
      _say('No connection. Your taps are safe on this device either way.');
      return false;
    } on ApiException catch (error) {
      _say(error.message);
      return false;
    }
  }

  /// Signs out and leaves every tap where it is.
  ///
  /// Deleting the local history here would be the wrong reading of the button:
  /// somebody signing out on a shared laptop wants the account gone, and
  /// somebody signing out on their own phone wants their history. The second is
  /// far more common, and the first is served by clearing the browser.
  Future<void> signOut() async {
    final token = _token;
    _token = null;
    _username = null;
    await _store.saveToken(null);
    await _store.saveUsername(null);
    // Everything is local again, so nothing is "sent" any more.
    _taps = [for (final tap in _taps) tap.copyWith(synced: false)];
    _notify();
    _scheduleSave();
    if (token != null) {
      // Best effort. The session is already gone as far as this device cares.
      unawaited(_api.logout(token).catchError((_) {}));
    }
  }

  Future<bool> deleteAccount() async {
    final token = _token;
    if (token == null) return false;
    try {
      await _api.deleteAccount(token);
      await signOut();
      _say('Account deleted. The taps on this device are still here.');
      return true;
    } on OfflineException {
      _say('No connection. Try again when you have one.');
      return false;
    } on ApiException catch (error) {
      _say(error.message);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  /// Pulls what the account has, then pushes what it does not.
  ///
  /// A union by id, and nothing is ever deleted by a sync. Two devices tapping
  /// on the same account cannot conflict: a tap is a fact about a moment, and
  /// two facts are two rows.
  Future<void> sync() async {
    final token = _token;
    if (token == null || _syncing) return;
    _syncing = true;
    _notify();
    try {
      final theirs = await _api.pull(token);
      final byId = {for (final tap in _taps) tap.id: tap};
      for (final tap in theirs) {
        byId[tap.id] = tap;
      }

      final merged = _sorted(byId.values.toList());
      final mine = merged.where((tap) => !tap.synced).toList();
      for (var i = 0; i < mine.length; i += 500) {
        final batch = mine.sublist(i, (i + 500).clamp(0, mine.length));
        await _api.push(token, batch);
      }

      _taps = _sorted([
        for (final tap in merged) tap.synced ? tap : tap.copyWith(synced: true),
      ]);
      _scheduleSave();
    } on OfflineException {
      // Nothing to say. The taps are on the device and the next sync will do it.
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        await signOut();
        _say('That sign-in expired. Sign in again to keep syncing.');
      } else {
        _say(error.message);
      }
    } finally {
      _syncing = false;
      _notify();
    }
  }

  // ---------------------------------------------------------------------------

  void clearMessage() {
    if (_message == null) return;
    _message = null;
    _notify();
  }

  void _say(String message) {
    _message = message;
    _notify();
  }

  void _scheduleSave() {
    _save?.cancel();
    _save = Timer(_saveDelay, () => unawaited(_store.saveTaps(_taps)));
  }

  void _schedulePush() {
    _push?.cancel();
    _push = Timer(_pushDelay, () => unawaited(sync()));
  }

  /// Writes anything pending now. Call before the app goes away.
  Future<void> flush() async {
    _save?.cancel();
    _save = null;
    await _store.saveTaps(_taps);
  }

  void _notify() {
    if (_disposed) return;
    notifyListeners();
  }

  static List<Tap> _sorted(List<Tap> taps) =>
      List.of(taps)..sort((a, b) => a.at.compareTo(b.at));

  @override
  void dispose() {
    _disposed = true;
    _save?.cancel();
    _push?.cancel();
    // The history is worth more than a clean shutdown, so this is fired rather
    // than awaited.
    unawaited(_store.saveTaps(_taps));
    super.dispose();
  }
}
