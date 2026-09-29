import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/fractional_index.dart';
import '../data/ids.dart';
import '../data/models.dart';
import '../data/realtime.dart';
import '../data/view_store.dart';
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

  /// A template link. It cannot open this list, only make a copy of it, and
  /// the app cannot yet take that copy.
  copyOnly,
}

/// The open rows under one tag's heading, when the list is grouped by tag.
/// [tag] is null for the rows that carry none, which go last.
@immutable
class TagGroup {
  const TagGroup(this.tag, this.items);

  final Tag? tag;
  final List<ChecklistItem> items;
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
    DeviceViewStore? views,
    String? listId,
  }) : _token = token,
       _views = views,
       _viewKey = listId,
       _realtimeFactory =
           realtimeFactory ?? ((token) => RealtimeClient(token: token));

  final CheckpostApi api;
  final RealtimeFactory _realtimeFactory;

  /// Where this device keeps how it looks at the list. Null keeps the view for
  /// as long as the controller lives and no longer.
  final DeviceViewStore? _views;
  final String? _viewKey;

  String _token;
  String get token => _token;

  RealtimeClient? _realtime;
  StreamSubscription<RealtimeFrame>? _frames;
  final _messages = StreamController<String>.broadcast();
  final _tokenChanges = StreamController<String>.broadcast();

  Checklist? _list;
  List<ChecklistItem> _items = const [];
  ListStatus _status = ListStatus.loading;
  Access _access = Access.read;
  String? _goneReason;
  int _presence = 1;
  bool _disposed = false;

  /// Always in [compareTags] order, so everything that shows tags can take
  /// them as they come.
  List<Tag> _tags = const [];

  /// Tags made here that the server has not answered for yet, by the id they
  /// were made with. What completes is the tag as the server has it, which
  /// can be one the list already had under another id, or null if it refused.
  final Map<String, Future<Tag?>> _pendingTags = {};

  /// Rows whose tags have changed here and are still on their way to the
  /// server, by row id. While a row is in here its tags on this device are
  /// newer than anything the server says about it.
  final Map<String, _TagSync> _tagSyncs = {};

  /// Which tags the rows are being looked at through. Never persisted: a
  /// filter left on and forgotten hides rows, which is the one thing a shared
  /// list must not do quietly.
  final Set<String> _filter = {};

  DeviceView _view = DeviceView.standard;
  bool _viewLoaded = false;

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

  /// What this link may do. Until the server says otherwise, assume the least.
  Access get access => _access;
  bool get canWrite => _access.canWrite;
  bool get canAdmin => _access.canAdmin;
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

  /// The open rows the filter lets through. Without a filter, every open row.
  List<ChecklistItem> get visibleOpen => [
    for (final item in _items)
      if (!_showAsDone(item) && _passes(item)) item,
  ];

  /// The done shelf is filtered too, and its count follows.
  List<ChecklistItem> get visibleDone => [
    for (final item in _items)
      if (_showAsDone(item) && _passes(item)) item,
  ];

  int get doneCount => _items.where((item) => item.checked).length;
  int get totalCount => _items.length;

  bool isWashing(String id) => _washing.contains(id);

  ChecklistItem? itemById(String id) => _itemById(id);

  /// Every tag on the list, in [compareTags] order.
  List<Tag> get tags => _tags;

  Tag? tagById(String id) {
    for (final tag in _tags) {
      if (tag.id == id) return tag;
    }
    return null;
  }

  /// The tag the list already has by this name, whatever its case or spacing.
  Tag? tagNamed(String name, {String? except}) {
    final key = tagKey(name);
    for (final tag in _tags) {
      if (tag.id != except && tagKey(tag.name) == key) return tag;
    }
    return null;
  }

  /// A row's tags as the chips show them: in [compareTags] order, and only
  /// ones the list still has.
  List<Tag> tagsOf(ChecklistItem item) => [
    for (final tag in _tags)
      if (item.tagIds.contains(tag.id)) tag,
  ];

  /// How many rows wear a tag, done or not.
  int rowsWearing(String tagId) =>
      _items.where((item) => item.tagIds.contains(tagId)).length;

  Set<String> get filter => UnmodifiableSetView(_filter);
  bool get isFiltering => _filter.isNotEmpty;

  /// The tags the filter is on, in [compareTags] order.
  List<Tag> get filterTags => [
    for (final tag in _tags)
      if (_filter.contains(tag.id)) tag,
  ];

  /// Whether the open rows are grouped under their tags. A list with no tags
  /// has nothing to group by, and no tag bar to change it back with, so it
  /// shows your order whatever this device last chose.
  bool get groupByTag => _view.byTag && _tags.isNotEmpty;

  bool get doneFolded => _view.doneFolded;

  /// The open rows the filter lets through, under one heading per tag in
  /// [compareTags] order. A row with several tags sits under the first of
  /// them, and rows with none go under a last group with no tag.
  List<TagGroup> get groups {
    final byTag = <String, List<ChecklistItem>>{};
    final untagged = <ChecklistItem>[];
    for (final item in visibleOpen) {
      final first = _firstTagOf(item);
      if (first == null) {
        untagged.add(item);
      } else {
        byTag.putIfAbsent(first.id, () => []).add(item);
      }
    }
    return [
      for (final tag in _tags)
        if (byTag[tag.id] case final rows?) TagGroup(tag, rows),
      if (untagged.isNotEmpty) TagGroup(null, untagged),
    ];
  }

  Tag? _firstTagOf(ChecklistItem item) {
    for (final tag in _tags) {
      if (item.tagIds.contains(tag.id)) return tag;
    }
    return null;
  }

  /// Several filters on means rows with any of them.
  bool _passes(ChecklistItem item) =>
      _filter.isEmpty || item.tagIds.any(_filter.contains);

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
    // Before the snapshot, so the first frame with the list in it is already
    // grouped and folded the way this device left it rather than jumping.
    await _loadView();
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

  Future<void> _loadView() async {
    if (_viewLoaded) return;
    _viewLoaded = true;
    final key = _viewKey;
    final views = _views;
    if (key == null || views == null) return;
    try {
      _view = await views.read(key);
    } catch (_) {
      // A view that will not load is the standard view, not a broken list.
    }
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
  //
  // Each write starts from the row as it is now rather than the one it was
  // handed, and a refusal puts back only what that write changed. The item
  // sheet holds the row it was opened with while tags change underneath it,
  // and a tick from the sheet used to write that stale copy back over them.

  Future<void> toggle(ChecklistItem item) async {
    final current = _itemById(item.id) ?? item;
    final next = !current.checked;
    _replace(
      current.copyWith(checked: next, checkedAt: next ? DateTime.now() : null),
    );
    _holdInPlace(item.id);
    _notify();

    await _write(
      () => api.updateItem(_token, item.id, checked: next),
      onResult: _replaceFromServer,
      onFailure: () => _patch(
        item.id,
        (now) => now.copyWith(
          checked: current.checked,
          checkedAt: current.checkedAt,
        ),
      ),
      whenGone: 'This list is gone, so nothing was saved.',
    );
  }

  /// Adds an item to the end of the list. Returns immediately. The row is on
  /// screen before the request leaves the device.
  ///
  /// While a tag filter is on, the row is made with the filter's tags, so it
  /// stays in view instead of vanishing as it lands.
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
      tagIds: [
        for (final tag in filterTags) tag.id,
      ].take(Limits.tagsPerItem).toList(),
    );
    _items = _sorted([..._items, optimistic]);
    _notify();

    // A filter tag made here a moment ago may still be on its way to the
    // server, and the row has to be sent the id it ends up with.
    final tagIds = await _settledTagIdsOf(id);
    // Deleted here while it waited. Sending it now would make a row on the
    // server that this device has already thrown away.
    if (tagIds == null || _disposed) return;

    await _write(
      () => api.createItem(_token, id: id, text: trimmed, tagIds: tagIds),
      onResult: _replaceFromServer,
      onFailure: () => _remove(id),
      whenGone: 'This list is gone, so the item was not added.',
    );
  }

  /// Moves an item to a new place among the open rows on screen.
  ///
  /// The position is worked out here rather than waited for, because this app
  /// carries the same fractional-index algorithm the API does and can name the
  /// key between two neighbours itself. The server is still told in terms of
  /// neighbours, not the key: two people dragging into the same gap at once
  /// have to end up with different keys, and only the server can see both.
  ///
  /// [toIndex] counts the rows a filter lets through, because those are the
  /// ones the finger is moving among. The neighbours named are the visible
  /// ones, and the server puts it next to the one it was dropped beside.
  ///
  /// Only the open items reorder. The done shelf is ordered by the fact of
  /// being done.
  Future<void> moveItem(ChecklistItem item, int toIndex) async {
    final open = visibleOpen;
    final from = open.indexWhere((candidate) => candidate.id == item.id);
    if (from < 0) return;
    final to = toIndex.clamp(0, open.length - 1);
    if (from == to) return;

    final current = open[from];
    final reordered = List.of(open)..removeAt(from);
    reordered.insert(to, current);

    // The neighbours in the new arrangement, not the old one. Naming the row it
    // used to sit after would put it straight back where it came from.
    final before = to > 0 ? reordered[to - 1] : null;
    final after = to + 1 < reordered.length ? reordered[to + 1] : null;

    _replace(
      current.copyWith(position: keyBetween(before?.position, after?.position)),
    );
    _notify();

    await _write(
      () => api.updateItem(
        _token,
        item.id,
        afterId: before?.id,
        beforeId: before == null ? after?.id : null,
      ),
      onResult: _replaceFromServer,
      onFailure: () =>
          _patch(item.id, (now) => now.copyWith(position: current.position)),
      whenGone: 'This list is gone, so nothing was moved.',
    );
  }

  /// One place up or down, for the sheet's buttons and for a screen reader.
  Future<void> stepItem(ChecklistItem item, int direction) async {
    final at = visibleOpen.indexWhere((candidate) => candidate.id == item.id);
    if (at < 0) return;
    await moveItem(item, at + direction);
  }

  Future<void> editItem(
    ChecklistItem item, {
    String? text,
    String? note,
  }) async {
    final trimmedText = text?.trim();
    if (trimmedText != null && trimmedText.isEmpty) return;
    final current = _itemById(item.id) ?? item;
    _replace(current.copyWith(text: trimmedText, note: note));
    _notify();

    await _write(
      () => api.updateItem(_token, item.id, text: trimmedText, note: note),
      onResult: _replaceFromServer,
      onFailure: () => _patch(
        item.id,
        (now) => now.copyWith(text: current.text, note: current.note),
      ),
      whenGone: 'This list is gone, so the change was not saved.',
    );
  }

  Future<void> deleteItem(ChecklistItem item) async {
    final index = _items.indexWhere((candidate) => candidate.id == item.id);
    final current = _itemById(item.id) ?? item;
    _remove(item.id);
    _notify();

    await _write(
      () async => api.deleteItem(_token, item.id),
      onFailure: () {
        // Put it back exactly where it was, not at the end.
        final restored = List.of(_items);
        restored.insert(index.clamp(0, restored.length), current);
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
  // Tags
  // ---------------------------------------------------------------------------

  /// Makes a tag on its own, from the Tags sheet. A name the list already has
  /// makes nothing and answers with the tag it has.
  ///
  /// Completes with the tag as the server has it, or null if it refused.
  Future<Tag?> createTag(String name) async {
    final normal = normaliseTagName(name);
    if (normal.isEmpty || normal.length > Limits.tagName) return null;
    final existing = tagNamed(normal);
    if (existing != null) return existing;
    if (_tags.length >= Limits.tagsPerList) return null;
    return _startTag(normal).made;
  }

  /// Puts a tag on a row by name: the one the list already has by that name,
  /// or a new one.
  ///
  /// A new tag is on the row at once, in the colour it will have, but the
  /// server is told in order: the tag first, and the row only once the tag
  /// exists, under whatever id the server says it has. Two people typing the
  /// same new tag at the same moment get one tag, and the row that asked
  /// second is tagged with the first one's id, not with an id the server
  /// never kept.
  Future<void> addTagToItem(ChecklistItem item, String name) async {
    final current = _itemById(item.id);
    final normal = normaliseTagName(name);
    if (current == null || normal.isEmpty || normal.length > Limits.tagName) {
      return;
    }
    final existing = tagNamed(normal);
    if (existing != null && current.tagIds.contains(existing.id)) return;
    if (current.tagIds.length >= Limits.tagsPerItem) return;
    if (existing != null) {
      return setItemTags(current, [...current.tagIds, existing.id]);
    }
    if (_tags.length >= Limits.tagsPerList) return;
    final pending = _startTag(normal).tag;
    return setItemTags(current, [...current.tagIds, pending.id]);
  }

  /// Puts a tag on a row, or takes it off. Lands at once, like a tick.
  Future<void> toggleItemTag(ChecklistItem item, Tag tag) {
    final current = _itemById(item.id) ?? item;
    final has = current.tagIds.contains(tag.id);
    if (!has && current.tagIds.length >= Limits.tagsPerItem) {
      return Future.value();
    }
    return setItemTags(current, [
      for (final id in current.tagIds)
        if (id != tag.id) id,
      if (!has) tag.id,
    ]);
  }

  /// Sets the whole set of tags a row carries, which is how the server takes
  /// it too.
  ///
  /// Writes to one row's tags go one at a time and each sends the row as it
  /// is by then, so taps made while one is in flight are folded into the next
  /// rather than racing it. Two requests in flight at once could land in
  /// either order, and the whole-set semantics would let the older one win.
  Future<void> setItemTags(ChecklistItem item, List<String> tagIds) {
    final current = _itemById(item.id);
    if (current == null) return Future.value();
    final next = [
      for (final id in {...tagIds})
        if (tagById(id) != null) id,
    ].take(Limits.tagsPerItem).toList();

    final sync = _tagSyncs.putIfAbsent(item.id, () => _TagSync(current.tagIds));
    _replace(current.copyWith(tagIds: next));
    _notify();

    if (!sync.queued) {
      sync.queued = true;
      // A flush that threw must not stop the ones queued behind it. Its error
      // has already reached whoever was waiting on it.
      sync.done = sync.done
          .catchError((Object _) {})
          .then((_) => _flushTags(item.id, sync));
    }
    return sync.done;
  }

  Future<void> renameTag(Tag tag, String name) async {
    final current = tagById(tag.id);
    final normal = normaliseTagName(name);
    if (current == null || normal.isEmpty || normal == current.name) return;
    if (normal.length > Limits.tagName) return;
    // Refused rather than merged, as the server would: folding two tags into
    // one is a bigger act than a rename.
    if (tagNamed(normal, except: tag.id) != null) return;

    _upsertTag(current.copyWith(name: normal));
    _notify();
    if (!await _tagExists(tag.id)) return;

    await _write(
      () => api.updateTag(_token, tag.id, name: normal),
      onResult: _upsertTag,
      onFailure: () {
        final now = tagById(tag.id);
        if (now != null) _upsertTag(now.copyWith(name: current.name));
      },
      whenGone: 'This list is gone, so the tag was not renamed.',
    );
  }

  Future<void> recolorTag(Tag tag, TagColor color) async {
    final current = tagById(tag.id);
    if (current == null || current.color == color) return;

    _upsertTag(current.copyWith(color: color));
    _notify();
    if (!await _tagExists(tag.id)) return;

    await _write(
      () => api.updateTag(_token, tag.id, color: color),
      onResult: _upsertTag,
      onFailure: () {
        final now = tagById(tag.id);
        if (now != null) _upsertTag(now.copyWith(color: current.color));
      },
      whenGone: 'This list is gone, so the colour was not changed.',
    );
  }

  /// Deletes a tag for everyone, and takes it off every row that wore it.
  Future<void> deleteTag(Tag tag) async {
    final current = tagById(tag.id);
    if (current == null) return;
    final wearing = [
      for (final item in _items)
        if (item.tagIds.contains(tag.id)) item.id,
    ];
    final pending = _pendingTags[tag.id];
    _dropTag(tag.id);
    _notify();
    // A tag still being made is deleted once it exists. Deleting it first
    // would be deleting nothing, and then it would arrive.
    if (pending != null) {
      final made = await pending;
      if (made == null || made.id != tag.id) return;
    }

    await _write(
      () async => api.deleteTag(_token, tag.id),
      onFailure: () {
        _upsertTag(current);
        for (final id in wearing) {
          _patch(
            id,
            (now) => now.tagIds.contains(tag.id)
                ? now
                : now.copyWith(tagIds: [...now.tagIds, tag.id]),
          );
        }
      },
      whenGone: 'This list is gone, so the tag was not deleted.',
    );
  }

  // ---------------------------------------------------------------------------
  // How this device looks at the list
  // ---------------------------------------------------------------------------

  void toggleFilter(Tag tag) {
    if (!_filter.remove(tag.id)) {
      if (tagById(tag.id) == null) return;
      _filter.add(tag.id);
    }
    _notify();
  }

  void clearFilter() {
    if (_filter.isEmpty) return;
    _filter.clear();
    _notify();
  }

  void setGroupByTag(bool value) {
    if (_view.byTag == value) return;
    _view = _view.copyWith(byTag: value);
    _notify();
    _saveView();
  }

  void setDoneFolded(bool value) {
    if (_view.doneFolded == value) return;
    _view = _view.copyWith(doneFolded: value);
    _notify();
    _saveView();
  }

  void _saveView() {
    final key = _viewKey;
    if (key == null) return;
    unawaited(_views?.write(key, _view));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /// Runs a write, keeping the optimistic state if it succeeds and undoing it
  /// if it does not. An offline failure is *not* undone: the edit is still
  /// true on this device, and reconcile will settle it when the network is
  /// back. Anything the server actively refused is undone, and said out loud.
  ///
  /// True when the server took it.
  Future<bool> _write<T>(
    Future<T> Function() send, {
    void Function(T result)? onResult,
    void Function()? onFailure,
    String? whenGone,
  }) async {
    try {
      final result = await send();
      if (_disposed) return false;
      if (onResult != null) onResult(result);
      if (_status == ListStatus.offline) _status = ListStatus.ready;
      _notify();
      return true;
    } on OfflineException {
      if (_disposed) return false;
      _status = ListStatus.offline;
      _notify();
      return false;
    } on ApiException catch (error) {
      if (_disposed) return false;
      onFailure?.call();
      if (error.isGone || error.isInvalidLink) {
        _status = error.isGone ? ListStatus.gone : ListStatus.invalid;
        _goneReason ??= 'rotated';
        _messages.add(whenGone ?? error.message);
      } else {
        _messages.add(error.message);
      }
      _notify();
      return false;
    }
  }

  void _handleApiError(ApiException error) {
    if (error.isCopyLink) {
      _status = ListStatus.copyOnly;
      return;
    }
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
    _items = _sorted([for (final item in snapshot.items) _withLocalTags(item)]);
    // A tag made here a moment ago may not be in a snapshot that left the
    // server before it did. It stays until the server answers for it.
    final known = {for (final tag in snapshot.tags) tag.id};
    _tags = _sortedTags([
      ...snapshot.tags,
      for (final tag in _tags)
        if (_pendingTags.containsKey(tag.id) && !known.contains(tag.id)) tag,
    ]);
    _filter.removeWhere((id) => tagById(id) == null);
    _access = snapshot.access;
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
          _replaceFromServer(item);
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
      case ChangeType.tagCreated:
      case ChangeType.tagUpdated:
        final raw = event.data['tag'];
        if (raw is Map) _upsertTag(Tag.fromJson(raw.cast<String, dynamic>()));
      case ChangeType.tagDeleted:
        // One event for the tag and every row it was on, so the rows are
        // stripped here rather than each being sent again.
        final id = event.data['id'];
        if (id is String) _dropTag(id);
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

  /// Adds a tag made here to the list at once, and starts making it on the
  /// server. The colour is chosen here, the way the server would choose it,
  /// and sent, so the chip never changes colour when the answer arrives.
  ({Tag tag, Future<Tag?> made}) _startTag(String name) {
    final now = DateTime.now();
    final tag = Tag(
      id: newUuidV4(),
      listId: _list?.id ?? '',
      name: name,
      color: nextTagColor(_tags.map((tag) => tag.color)),
      createdAt: now,
      updatedAt: now,
    );
    _tags = _sortedTags([..._tags, tag]);
    _notify();
    final made = _makeTag(tag);
    _pendingTags[tag.id] = made;
    return (tag: tag, made: made);
  }

  Future<Tag?> _makeTag(Tag pending) async {
    Tag? made;
    await _write(
      () => api.createTag(
        _token,
        id: pending.id,
        name: pending.name,
        color: pending.color,
      ),
      onResult: (tag) {
        made = tag;
        _settleTag(pending, tag);
      },
      onFailure: () => _dropTag(pending.id),
      whenGone: 'This list is gone, so the tag was not made.',
    );
    // Gone before this completes, so anything waiting on it and looking again
    // sees a settled tag rather than waiting for ever.
    _pendingTags.remove(pending.id);
    return made;
  }

  /// The server's answer to a tag made here. Usually the same tag. When the
  /// list already had one by that name, perhaps made by somebody else a
  /// moment ago, theirs is the tag and ours never existed: every row and the
  /// filter move over to its id.
  void _settleTag(Tag pending, Tag made) {
    // Deleted here while it was being made. Its delete follows this.
    if (tagById(pending.id) == null) return;
    if (made.id != pending.id) {
      _tags = [
        for (final tag in _tags)
          if (tag.id != pending.id) tag,
      ];
      for (final item in _items) {
        if (!item.tagIds.contains(pending.id)) continue;
        _replace(
          item.copyWith(
            tagIds: [
              for (final id in {
                for (final id in item.tagIds) id == pending.id ? made.id : id,
              })
                id,
            ],
          ),
        );
      }
      if (_filter.remove(pending.id)) _filter.add(made.id);
    }
    _upsertTag(made);
  }

  /// Takes a tag off the list, every row and the filter, here only.
  void _dropTag(String id) {
    _tags = [
      for (final tag in _tags)
        if (tag.id != id) tag,
    ];
    for (final item in _items) {
      if (!item.tagIds.contains(id)) continue;
      _replace(
        item.copyWith(
          tagIds: [
            for (final tagId in item.tagIds)
              if (tagId != id) tagId,
          ],
        ),
      );
    }
    for (final sync in _tagSyncs.values) {
      sync.before = [
        for (final tagId in sync.before)
          if (tagId != id) tagId,
      ];
    }
    _filter.remove(id);
  }

  /// Waits for a tag made here to exist on the server. False if it never
  /// will, because the server refused it or answered with another tag.
  Future<bool> _tagExists(String id) async {
    final pending = _pendingTags[id];
    if (pending == null) return tagById(id) != null;
    final made = await pending;
    return made?.id == id;
  }

  /// A row's tags once every one of them exists on the server, under the ids
  /// the server gave them. Null if the row has gone.
  Future<List<String>?> _settledTagIdsOf(String itemId) async {
    while (true) {
      final item = _itemById(itemId);
      if (item == null) return null;
      final waiting = [for (final id in item.tagIds) ?_pendingTags[id]];
      if (waiting.isEmpty) return item.tagIds;
      await Future.wait(waiting);
    }
  }

  Future<void> _flushTags(String itemId, _TagSync sync) async {
    // Anything tapped from here on waits for the next flush.
    sync.queued = false;
    try {
      final sent = await _settledTagIdsOf(itemId);
      if (sent == null || _disposed) return;
      // Put back as it was, or refused and reverted: nothing to say.
      if (_sameSet(sent, sync.before)) return;

      await _write(
        () => api.updateItem(_token, itemId, tagIds: sent),
        onResult: (server) {
          sync.before = server.tagIds;
          // Another change is queued behind this one, so the tags here are
          // newer than the ones this answer carries.
          if (sync.queued) {
            _replaceFromServer(server);
          } else {
            _replace(server);
          }
        },
        onFailure: () =>
            _patch(itemId, (now) => now.copyWith(tagIds: sync.before)),
        whenGone: 'This list is gone, so the tags were not saved.',
      );
    } finally {
      if (!sync.queued && identical(_tagSyncs[itemId], sync)) {
        _tagSyncs.remove(itemId);
      }
    }
  }

  static bool _sameSet(List<String> a, List<String> b) =>
      a.length == b.length && a.toSet().containsAll(b);

  void _upsertTag(Tag tag) {
    _tags = _sortedTags([
      for (final existing in _tags)
        if (existing.id != tag.id) existing,
      tag,
    ]);
  }

  ChecklistItem? _itemById(String id) {
    for (final item in _items) {
      if (item.id == id) return item;
    }
    return null;
  }

  /// A row as the server has it, except for its tags while a change to them
  /// is still on its way there. Those are newer here, and taking the server's
  /// would flick the chip off and on again.
  void _replaceFromServer(ChecklistItem server) =>
      _replace(_withLocalTags(server));

  ChecklistItem _withLocalTags(ChecklistItem server) {
    if (!_tagSyncs.containsKey(server.id)) return server;
    final local = _itemById(server.id);
    return local == null ? server : server.copyWith(tagIds: local.tagIds);
  }

  /// Changes a row that may have changed since the write began, or does
  /// nothing if it has gone.
  void _patch(String id, ChecklistItem Function(ChecklistItem now) change) {
    final now = _itemById(id);
    if (now != null) _replace(change(now));
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

  static List<Tag> _sortedTags(List<Tag> tags) =>
      List.of(tags)..sort(compareTags);

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

/// One row's tags on their way to the server.
class _TagSync {
  _TagSync(this.before);

  /// What the server last said the row carries. Put back if it refuses.
  List<String> before;

  /// A flush is waiting behind the one in flight.
  bool queued = false;

  /// The end of the chain of flushes for this row.
  Future<void> done = Future.value();
}
