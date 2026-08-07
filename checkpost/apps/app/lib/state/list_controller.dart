import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/fractional_index.dart';
import '../data/ids.dart';
import '../data/models.dart';
import '../data/realtime.dart';
import '../design/tokens.dart';

/// Builds the change feed for a token, or returns null for no live feed.
typedef RealtimeFactory = RealtimeClient? Function(String token);

enum ListStatus {
  /// First load, nothing on screen yet.
  loading,
  ready,

  /// We have the list, but cannot reach the server right now.
  offline,

  /// The link was replaced or the list was deleted. A dead end with an exit.
  gone,

  /// The link is not valid at all.
  invalid,
}

/// One open list.
///
/// Every edit lands on local state first and is sent afterwards. The user never
/// waits on a spinner to tick a box. The network is allowed to correct us, and
/// when it does we say so rather than silently reverting.
class ListController extends ChangeNotifier {
  ListController({
    required this.api,
    required String token,
    RealtimeFactory? realtimeFactory,
  }) : _token = token,
       _realtimeFactory =
           realtimeFactory ?? ((token) => RealtimeClient(token: token));

  final CheckpostApi api;
  final RealtimeFactory _realtimeFactory;

  String _token;
  String get token => _token;

  RealtimeClient? _realtime;
  StreamSubscription<RealtimeFrame>? _frames;
  final _messages = StreamController<String>.broadcast();
  final _tokenChanges = StreamController<String>.broadcast();

  Checklist? _list;
  List<ChecklistItem> _items = const [];
  ListStatus _status = ListStatus.loading;
  String? _goneReason;
  int _presence = 1;
  bool _disposed = false;

  /// Ids whose section move is deferred, so a row you just ticked stays under
  /// your thumb long enough to see, and to untick.
  final Set<String> _settling = {};
  final Map<String, Timer> _settleTimers = {};

  /// Ids changed by somebody else recently, highlighted so you can see what
  /// happened without re-reading the whole list.
  final Set<String> _washing = {};
  final Map<String, Timer> _washTimers = {};

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  Checklist? get list => _list;
  ListStatus get status => _status;
  String? get goneReason => _goneReason;

  /// How many people are on this list, including you. Never names, never faces.
  int get presence => _presence;
  bool get hasCompany => _presence > 1;

  Stream<String> get messages => _messages.stream;

  /// Fires when rotation mints a new token, so the caller can persist it.
  Stream<String> get tokenChanges => _tokenChanges.stream;

  List<ChecklistItem> get items => _items;
  List<ChecklistItem> get openItems => [
    for (final item in _items)
      if (!_showAsDone(item)) item,
  ];
  List<ChecklistItem> get doneItems => [
    for (final item in _items)
      if (_showAsDone(item)) item,
  ];

  int get doneCount => _items.where((item) => item.checked).length;
  int get totalCount => _items.length;

  bool isWashing(String id) => _washing.contains(id);

  /// An item that was just toggled keeps its old section until the grace
  /// period expires.
  bool _showAsDone(ChecklistItem item) =>
      _settling.contains(item.id) ? !item.checked : item.checked;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /// Loads the list and opens its change feed.
  Future<void> open() async {
    await load();
    if (_status == ListStatus.ready || _status == ListStatus.offline) {
      _connect();
    }
  }

  /// Fetches the snapshot without opening a socket. Split out from [open] so a
  /// caller, or a test, can have the list without the connection.
  Future<void> load() async {
    try {
      _apply(await api.snapshot(_token));
      _status = ListStatus.ready;
    } on ApiException catch (error) {
      _handleApiError(error);
    } on OfflineException {
      // Keep whatever we already had. A blank screen is worse than stale.
      _status = ListStatus.offline;
    }
    _notify();
  }

  void _connect() {
    _frames?.cancel();
    _realtime?.dispose();
    final realtime = _realtimeFactory(_token);
    _realtime = realtime;
    // A null client means "no live feed". Used by tests, and the seam any
    // future no-socket mode would use. Everything still works. Changes just
    // arrive on reconcile instead of instantly.
    if (realtime == null) return;
    _frames = realtime.frames.listen(_onFrame);
    realtime.start();
  }

  void _onFrame(RealtimeFrame frame) {
    switch (frame) {
      case RealtimeConnected():
        if (_status == ListStatus.offline) {
          _status = ListStatus.ready;
          _notify();
        }
        // A fresh socket proves nothing about what happened while it was down.
        unawaited(reconcile());
      case RealtimeHello(:final revision, :final presence):
        _presence = presence;
        if (_list != null && revision > _list!.revision) unawaited(reconcile());
        _notify();
      case RealtimePresence(:final presence):
        _presence = presence;
        _notify();
      case RealtimeChange(:final event):
        _applyEvent(event, remote: event.actor != api.clientId);
        _notify();
      case RealtimeRevoked(:final reason):
        _status = ListStatus.gone;
        _goneReason = reason;
        _notify();
      case RealtimeDisconnected():
        if (_status == ListStatus.ready) {
          _status = ListStatus.offline;
          _notify();
        }
    }
  }

  /// Asks for everything that happened since our revision. Called on every
  /// reconnect and whenever the app comes back to the foreground.
  Future<void> reconcile() async {
    final current = _list;
    if (current == null || _disposed) return;
    try {
      final changes = await api.changesSince(_token, current.revision);
      switch (changes) {
        case ChangesResync(:final snapshot):
          _apply(snapshot);
        case ChangesEvents(:final events):
          for (final event in events) {
            // Replaying our own writes is harmless but pointless, and washing
            // them would show you your own edits as somebody else's.
            _applyEvent(event, remote: event.actor != api.clientId);
          }
      }
      if (_status == ListStatus.offline) _status = ListStatus.ready;
    } on ApiException catch (error) {
      _handleApiError(error);
    } on OfflineException {
      _status = ListStatus.offline;
    }
    _notify();
  }

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  Future<void> toggle(ChecklistItem item) async {
    final next = !item.checked;
    _replace(
      item.copyWith(checked: next, checkedAt: next ? DateTime.now() : null),
    );
    _holdInPlace(item.id);
    _notify();

    await _write(
      () => api.updateItem(_token, item.id, checked: next),
      onResult: _replace,
      onFailure: () => _replace(item),
      whenGone: 'This list is gone, so nothing was saved.',
    );
  }

  /// Adds an item to the end of the list. Returns immediately. The row is on
  /// screen before the request leaves the device.
  Future<void> addItem(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final id = newUuidV4();
    final lastPosition = _items.isEmpty ? null : _items.last.position;
    final now = DateTime.now();
    final optimistic = ChecklistItem(
      id: id,
      listId: _list?.id ?? '',
      text: trimmed,
      note: '',
      checked: false,
      checkedAt: null,
      position: keyBetween(lastPosition, null),
      createdAt: now,
      updatedAt: now,
    );
    _items = _sorted([..._items, optimistic]);
    _notify();

    await _write(
      () => api.createItem(_token, id: id, text: trimmed),
      onResult: _replace,
      onFailure: () => _remove(id),
      whenGone: 'This list is gone, so the item was not added.',
    );
  }

  Future<void> editItem(
    ChecklistItem item, {
    String? text,
    String? note,
  }) async {
    final trimmedText = text?.trim();
    if (trimmedText != null && trimmedText.isEmpty) return;
    _replace(item.copyWith(text: trimmedText, note: note));
    _notify();

    await _write(
      () => api.updateItem(_token, item.id, text: trimmedText, note: note),
      onResult: _replace,
      onFailure: () => _replace(item),
      whenGone: 'This list is gone, so the change was not saved.',
    );
  }

  Future<void> deleteItem(ChecklistItem item) async {
    final index = _items.indexWhere((candidate) => candidate.id == item.id);
    _remove(item.id);
    _notify();

    await _write(
      () async => api.deleteItem(_token, item.id),
      onFailure: () {
        // Put it back exactly where it was, not at the end.
        final restored = List.of(_items);
        restored.insert(index.clamp(0, restored.length), item);
        _items = _sorted(restored);
      },
      whenGone: 'This list is already gone.',
    );
  }

  Future<void> rename(String title) async {
    final trimmed = title.trim();
    final previous = _list;
    if (previous == null || trimmed.isEmpty || trimmed == previous.title) {
      return;
    }
    _list = previous.copyWith(title: trimmed);
    _notify();

    await _write(
      () => api.renameList(_token, trimmed),
      onResult: (updated) => _list = updated,
      onFailure: () => _list = previous,
      whenGone: 'This list is gone, so the name was not changed.',
    );
  }

  Future<void> clearChecked() async {
    final removed = _items.where((item) => item.checked).toList();
    if (removed.isEmpty) return;
    final previous = _items;
    _items = [
      for (final item in _items)
        if (!item.checked) item,
    ];
    _notify();

    await _write(
      () async => api.clearChecked(_token),
      onFailure: () => _items = previous,
      whenGone: 'This list is already gone.',
    );
  }

  /// Replaces the share link. Everyone else is disconnected the moment this
  /// returns. This device reconnects with the token it just received.
  Future<String> rotateLink() async {
    final rotated = await api.rotateLink(_token);
    _token = rotated.token;
    _tokenChanges.add(rotated.token);
    _status = ListStatus.ready;
    _goneReason = null;
    _connect();
    _notify();
    return rotated.url;
  }

  Future<void> deleteList() async {
    await api.deleteList(_token);
    _status = ListStatus.gone;
    _goneReason = 'deleted';
    _notify();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /// Runs a write, keeping the optimistic state if it succeeds and undoing it
  /// if it does not. An offline failure is *not* undone: the edit is still
  /// true on this device, and reconcile will settle it when the network is
  /// back. Anything the server actively refused is undone, and said out loud.
  Future<void> _write<T>(
    Future<T> Function() send, {
    void Function(T result)? onResult,
    void Function()? onFailure,
    String? whenGone,
  }) async {
    try {
      final result = await send();
      if (_disposed) return;
      if (onResult != null) onResult(result);
      if (_status == ListStatus.offline) _status = ListStatus.ready;
      _notify();
    } on OfflineException {
      if (_disposed) return;
      _status = ListStatus.offline;
      _notify();
    } on ApiException catch (error) {
      if (_disposed) return;
      onFailure?.call();
      if (error.isGone || error.isInvalidLink) {
        _status = error.isGone ? ListStatus.gone : ListStatus.invalid;
        _goneReason ??= 'rotated';
        _messages.add(whenGone ?? error.message);
      } else {
        _messages.add(error.message);
      }
      _notify();
    }
  }

  void _handleApiError(ApiException error) {
    if (error.isGone) {
      _status = ListStatus.gone;
      _goneReason ??= 'rotated';
    } else if (error.isInvalidLink) {
      _status = ListStatus.invalid;
    } else {
      _messages.add(error.message);
      if (_list == null) _status = ListStatus.offline;
    }
  }

  void _apply(Snapshot snapshot) {
    _list = snapshot.list;
    _items = _sorted(snapshot.items);
  }

  void _applyEvent(ChangeEvent event, {required bool remote}) {
    final current = _list;
    if (current != null && event.revision > current.revision) {
      _list = current.copyWith(revision: event.revision);
    }

    switch (event.type) {
      case ChangeType.listUpdated:
        final title = event.data['title'] as String?;
        if (title != null && _list != null) {
          _list = _list!.copyWith(title: title);
        }
      case ChangeType.itemCreated:
      case ChangeType.itemUpdated:
        final raw = event.data['item'];
        if (raw is Map) {
          final item = ChecklistItem.fromJson(raw.cast<String, dynamic>());
          _replace(item);
          if (remote) _wash(item.id);
        }
      case ChangeType.itemDeleted:
        final single = event.data['id'];
        final many = event.data['ids'];
        if (single is String) _remove(single);
        if (many is List) {
          for (final id in many) {
            if (id is String) _remove(id);
          }
        }
      case ChangeType.listDeleted:
        _status = ListStatus.gone;
        _goneReason = 'deleted';
      case ChangeType.linkRotated:
        // Our own rotation, echoed back. Somebody else's rotation reaches us
        // as a socket close, not as an event we could still receive.
        break;
      case ChangeType.unknown:
        // A newer server than this build. Ignoring an event we do not
        // understand is safe. Reconcile will catch anything that mattered.
        break;
    }
  }

  void _replace(ChecklistItem item) {
    final index = _items.indexWhere((candidate) => candidate.id == item.id);
    if (index == -1) {
      _items = _sorted([..._items, item]);
      return;
    }
    final next = List.of(_items);
    next[index] = item;
    _items = _sorted(next);
  }

  void _remove(String id) {
    _items = [
      for (final item in _items)
        if (item.id != id) item,
    ];
    _settleTimers.remove(id)?.cancel();
    _settling.remove(id);
    _washTimers.remove(id)?.cancel();
    _washing.remove(id);
  }

  void _holdInPlace(String id) {
    _settling.add(id);
    _settleTimers[id]?.cancel();
    _settleTimers[id] = Timer(Motion.settleGrace, () {
      _settling.remove(id);
      _settleTimers.remove(id);
      _notify();
    });
  }

  void _wash(String id) {
    _washing.add(id);
    _washTimers[id]?.cancel();
    _washTimers[id] = Timer(Motion.remoteWash, () {
      _washing.remove(id);
      _washTimers.remove(id);
      _notify();
    });
  }

  /// Byte-wise, exactly like the server's `COLLATE "C"` index.
  static List<ChecklistItem> _sorted(List<ChecklistItem> items) =>
      List.of(items)..sort((a, b) => a.position.compareTo(b.position));

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final timer in _settleTimers.values) {
      timer.cancel();
    }
    for (final timer in _washTimers.values) {
      timer.cancel();
    }
    _frames?.cancel();
    _realtime?.dispose();
    _messages.close();
    _tokenChanges.close();
    super.dispose();
  }
}
