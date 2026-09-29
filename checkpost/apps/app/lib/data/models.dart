import 'package:flutter/foundation.dart';

import 'js_case.dart';

/// The wire model, mirroring `packages/contract/src/index.ts`.
/// See `docs/API.md`. That document and this file are the contract.

/// What the contract holds a list and a row to.
abstract final class Limits {
  /// A tag is a word or two on a chip, not a sentence.
  static const tagName = 30;

  /// Enough to cross-file a row, not so many that the chips outgrow it.
  static const tagsPerItem = 10;
  static const tagsPerList = 50;
}

/// A share token: 32 random bytes, base64url, giving 43 characters.
final shareTokenPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');

/// Pulls a token out of anything a person might paste: the bare token, an
/// https share URL, or a `checkpost://` deep link.
String? parseShareToken(String input) {
  final trimmed = input.trim();
  if (shareTokenPattern.hasMatch(trimmed)) return trimmed;
  final match = RegExp(r'/l/([A-Za-z0-9_-]{43})').firstMatch(trimmed);
  return match?.group(1);
}

@immutable
class Checklist {
  const Checklist({
    required this.id,
    required this.title,
    required this.revision,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;

  /// Monotonic per-list counter. Everything the client knows is "as of" this.
  final int revision;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Checklist.fromJson(Map<String, dynamic> json) => Checklist(
    id: json['id'] as String,
    title: json['title'] as String,
    revision: (json['revision'] as num).toInt(),
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
  );

  Checklist copyWith({String? title, int? revision}) => Checklist(
    id: id,
    title: title ?? this.title,
    revision: revision ?? this.revision,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}

@immutable
class ChecklistItem {
  const ChecklistItem({
    required this.id,
    required this.listId,
    required this.text,
    required this.note,
    required this.checked,
    required this.checkedAt,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
    this.tagIds = const [],
  });

  final String id;
  final String listId;
  final String text;
  final String note;
  final bool checked;
  final DateTime? checkedAt;

  /// Opaque fractional index. Compare with [String.compareTo] for byte order,
  /// exactly what Postgres produces under `COLLATE "C"`.
  final String position;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// The list's tags this row carries, by id. A set, so the order means
  /// nothing: rows show them in [compareTags] order.
  final List<String> tagIds;

  bool get hasNote => note.trim().isNotEmpty;

  factory ChecklistItem.fromJson(Map<String, dynamic> json) => ChecklistItem(
    id: json['id'] as String,
    listId: json['listId'] as String,
    text: json['text'] as String,
    note: (json['note'] as String?) ?? '',
    checked: json['checked'] as bool,
    checkedAt: json['checkedAt'] == null
        ? null
        : DateTime.parse(json['checkedAt'] as String),
    position: json['position'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    // Absent from a server older than tags, which is a row with none.
    tagIds: [
      for (final id in (json['tagIds'] as List?) ?? const []) id as String,
    ],
  );

  ChecklistItem copyWith({
    String? text,
    String? note,
    bool? checked,
    String? position,
    Object? checkedAt = _unset,
    List<String>? tagIds,
  }) => ChecklistItem(
    id: id,
    listId: listId,
    text: text ?? this.text,
    note: note ?? this.note,
    checked: checked ?? this.checked,
    checkedAt: checkedAt == _unset ? this.checkedAt : checkedAt as DateTime?,
    position: position ?? this.position,
    createdAt: createdAt,
    updatedAt: updatedAt,
    tagIds: tagIds ?? this.tagIds,
  );
}

const _unset = Object();

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/// The colours a tag can take, stored by name.
///
/// Declared in wheel order, which is the order a picker shows them in. The
/// values for each live in `tokens.dart`, `DESIGN.md` and the web's `app.css`,
/// which is the palette rule: change them together.
enum TagColor {
  clay('Clay'),
  ochre('Ochre'),
  olive('Olive'),
  sage('Sage'),
  teal('Teal'),
  steel('Steel'),
  iris('Iris'),
  plum('Plum');

  const TagColor(this.label);

  /// What a screen reader says for the swatch. A colour is never the only way
  /// to tell a tag apart, but the picker is where it is the whole point.
  final String label;

  String get wire => name;

  /// A colour this build does not know is from a newer server. It is shown as
  /// the first colour rather than refused, because the tag's name still says
  /// which tag it is.
  static TagColor parse(String? value) => TagColor.values.firstWhere(
    (color) => color.name == value,
    orElse: () => TagColor.clay,
  );
}

/// The order new tags are handed colours in. Alternating across the wheel, so
/// the first few tags on a list never sit next to their own neighbour.
const tagColorOrder = [
  TagColor.clay,
  TagColor.teal,
  TagColor.ochre,
  TagColor.steel,
  TagColor.olive,
  TagColor.iris,
  TagColor.sage,
  TagColor.plum,
];

/// The colour a new tag gets when nobody picked one: the one used least on the
/// list so far, and among equals the earliest in [tagColorOrder].
///
/// The same function as the contract's, because a tag made here has to show
/// its colour before the server has answered, and the two must not disagree
/// about which colour that is. The app always sends the colour it chose.
TagColor nextTagColor(Iterable<TagColor> existing) {
  final used = <TagColor, int>{};
  for (final color in existing) {
    used[color] = (used[color] ?? 0) + 1;
  }
  var best = tagColorOrder.first;
  for (final color in tagColorOrder) {
    if ((used[color] ?? 0) < (used[best] ?? 0)) best = color;
  }
  return best;
}

/// JavaScript's `\s` and `trim()`, which are the same set, spelled out. Dart's
/// own `String.trim` also strips U+0085, which JavaScript keeps, and a name the
/// two clients trim differently is a name they file under different tags.
const _jsSpace =
    r'[\t\n\v\f\r \u00a0\u1680\u2000-\u200a'
    r'\u2028\u2029\u202f\u205f\u3000\ufeff]';
final _spaceRun = RegExp('$_jsSpace+');
final _edgeSpace = RegExp('^$_jsSpace+|$_jsSpace+\$');

/// A name as the server stores it: trimmed, with inner runs of whitespace
/// folded to one space.
String normaliseTagName(String name) =>
    name.replaceAll(_edgeSpace, '').replaceAll(_spaceRun, ' ');

/// A tag's name as the list compares it. Two names that differ only in case
/// or spacing are the same tag, so "Kitchen" and "kitchen " cannot both exist.
///
/// Byte for byte the contract's `tagKey`: the same whitespace, and
/// JavaScript's lowercasing rather than Dart's, which differ past Latin-1.
String tagKey(String name) => jsLowerCase(normaliseTagName(name));

/// The one order tags are shown in, everywhere: by [tagKey], then by id when
/// two names compare equal.
///
/// Code-unit order, which is what both [String.compareTo] and JavaScript's `<`
/// give. There is no locale collator on either side to agree with, and the two
/// clients have to put the chips and the groups in the same place.
int compareTags(Tag a, Tag b) {
  final byName = tagKey(a.name).compareTo(tagKey(b.name));
  if (byName != 0) return byName;
  return a.id.compareTo(b.id);
}

/// A tag belongs to one list and is shared by everyone on it, like the items.
@immutable
class Tag {
  const Tag({
    required this.id,
    required this.listId,
    required this.name,
    required this.color,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String listId;
  final String name;
  final TagColor color;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
    id: json['id'] as String,
    listId: json['listId'] as String,
    name: json['name'] as String,
    color: TagColor.parse(json['color'] as String?),
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
  );

  Tag copyWith({String? name, TagColor? color}) => Tag(
    id: id,
    listId: listId,
    name: name ?? this.name,
    color: color ?? this.color,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Tag &&
          other.id == id &&
          other.listId == listId &&
          other.name == name &&
          other.color == color &&
          other.createdAt == createdAt &&
          other.updatedAt == updatedAt;

  @override
  int get hashCode =>
      Object.hash(id, listId, name, color, createdAt, updatedAt);

  @override
  String toString() => 'Tag($name, ${color.name})';
}

/// What a link is allowed to do. One list can have several live links at
/// different levels, so this belongs to the link rather than to the list.
///
/// `read`, `write` and `admin` are a ladder. `copy` is not on it: a copy link
/// cannot see the list it came from, only mint a fresh one.
enum Access {
  read,
  write,
  admin,
  copy;

  static Access parse(String? value) => switch (value) {
    'write' => Access.write,
    'admin' => Access.admin,
    'copy' => Access.copy,
    // Anything unrecognised is treated as the least it could be, because a
    // client that guesses upwards offers edits the server will refuse.
    _ => Access.read,
  };

  bool get canWrite => this == Access.write || this == Access.admin;
  bool get canAdmin => this == Access.admin;
}

@immutable
class Snapshot {
  const Snapshot({
    required this.list,
    required this.items,
    this.tags = const [],
    this.access = Access.admin,
  });

  final Checklist list;
  final List<ChecklistItem> items;

  /// In the order they were made. Show them in [compareTags] order.
  final List<Tag> tags;

  /// What the link this was fetched with may do.
  final Access access;

  factory Snapshot.fromJson(Map<String, dynamic> json) => Snapshot(
    list: Checklist.fromJson(json['list'] as Map<String, dynamic>),
    items: [
      for (final item in json['items'] as List)
        ChecklistItem.fromJson(item as Map<String, dynamic>),
    ],
    tags: [
      for (final tag in (json['tags'] as List?) ?? const [])
        Tag.fromJson((tag as Map).cast<String, dynamic>()),
    ],
    access: Access.parse(json['access'] as String?),
  );
}

enum ChangeType {
  listUpdated('list.updated'),
  listDeleted('list.deleted'),
  itemCreated('item.created'),
  itemUpdated('item.updated'),
  itemDeleted('item.deleted'),
  linkRotated('link.rotated'),
  tagCreated('tag.created'),
  tagUpdated('tag.updated'),

  /// Also takes the tag off every row, so the client drops its id locally.
  tagDeleted('tag.deleted'),
  unknown('');

  const ChangeType(this.wire);
  final String wire;

  static ChangeType parse(String value) => ChangeType.values.firstWhere(
    (type) => type.wire == value,
    orElse: () => ChangeType.unknown,
  );
}

@immutable
class ChangeEvent {
  const ChangeEvent({
    required this.type,
    required this.revision,
    required this.actor,
    required this.at,
    required this.data,
  });

  final ChangeType type;
  final int revision;

  /// The device that made the change, or null for anonymous writers. A client
  /// skips events it caused itself, because it already applied them.
  final String? actor;
  final DateTime at;
  final Map<String, dynamic> data;

  factory ChangeEvent.fromJson(Map<String, dynamic> json) => ChangeEvent(
    type: ChangeType.parse(json['type'] as String),
    revision: (json['revision'] as num).toInt(),
    actor: json['actor'] as String?,
    at: DateTime.parse(json['at'] as String),
    data: (json['data'] as Map).cast<String, dynamic>(),
  );
}

/// Either the events a client missed, or a whole fresh snapshot when the log
/// no longer reaches back far enough to prove what was missed.
@immutable
sealed class Changes {
  const Changes();

  factory Changes.fromJson(Map<String, dynamic> json) =>
      json['kind'] == 'resync'
      ? ChangesResync(
          Snapshot.fromJson(json['snapshot'] as Map<String, dynamic>),
        )
      : ChangesEvents(
          revision: (json['revision'] as num).toInt(),
          events: [
            for (final event in json['events'] as List)
              ChangeEvent.fromJson(event as Map<String, dynamic>),
          ],
        );
}

class ChangesEvents extends Changes {
  const ChangesEvents({required this.revision, required this.events});
  final int revision;
  final List<ChangeEvent> events;
}

class ChangesResync extends Changes {
  const ChangesResync(this.snapshot);
  final Snapshot snapshot;
}

/// One entry in this device's list index. There are no accounts, so this is
/// the only record that a list exists.
@immutable
class SavedList {
  const SavedList({
    required this.id,
    required this.token,
    required this.title,
    required this.doneCount,
    required this.totalCount,
    required this.lastOpenedAt,
  });

  final String id;
  final String token;
  final String title;

  /// Cached counts so the home screen has something true to show before the
  /// network answers. An empty skeleton on every launch would be a lie about
  /// how much this app knows.
  final int doneCount;
  final int totalCount;
  final DateTime lastOpenedAt;

  SavedList copyWith({
    String? token,
    String? title,
    int? doneCount,
    int? totalCount,
    DateTime? lastOpenedAt,
  }) => SavedList(
    id: id,
    token: token ?? this.token,
    title: title ?? this.title,
    doneCount: doneCount ?? this.doneCount,
    totalCount: totalCount ?? this.totalCount,
    lastOpenedAt: lastOpenedAt ?? this.lastOpenedAt,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'token': token,
    'title': title,
    'doneCount': doneCount,
    'totalCount': totalCount,
    'lastOpenedAt': lastOpenedAt.toIso8601String(),
  };

  /// Value equality, so the controller can tell a real change from a repeat.
  /// An open list reports its state constantly, and without this every report
  /// counted as a change and rebuilt the home screen behind it.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SavedList &&
          other.id == id &&
          other.token == token &&
          other.title == title &&
          other.doneCount == doneCount &&
          other.totalCount == totalCount &&
          other.lastOpenedAt == lastOpenedAt;

  @override
  int get hashCode =>
      Object.hash(id, token, title, doneCount, totalCount, lastOpenedAt);

  factory SavedList.fromJson(Map<String, dynamic> json) => SavedList(
    id: json['id'] as String,
    token: json['token'] as String,
    title: json['title'] as String,
    doneCount: (json['doneCount'] as num?)?.toInt() ?? 0,
    totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
    lastOpenedAt:
        DateTime.tryParse(json['lastOpenedAt'] as String? ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0),
  );
}
