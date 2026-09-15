import 'dart:math';

/// Which button was pressed. There will never be a third.
enum Choice {
  good,
  bad;

  bool get isGood => this == Choice.good;

  static Choice? parse(String? raw) => switch (raw) {
    'good' => Choice.good,
    'bad' => Choice.bad,
    _ => null,
  };

  String get wire => name;
}

/// One press of one button.
///
/// The id is minted here, on the device, at the moment of the tap — before
/// anything is written and long before anything is sent. That is what makes
/// syncing an upsert rather than a conversation: a batch that is sent twice
/// because the first reply was lost carries the same ids and lands once.
class Tap {
  const Tap({required this.id, required this.kind, required this.at, required this.synced});

  final String id;
  final Choice kind;

  /// When the tap happened, not when the row arrived. A week offline and then a
  /// sync must not pile a week of choices onto today.
  final DateTime at;

  /// Whether the server has it. Meaningless until there is an account, and
  /// false for everything the moment one is made.
  final bool synced;

  Tap copyWith({bool? synced}) =>
      Tap(id: id, kind: kind, at: at, synced: synced ?? this.synced);

  /// Short keys. The whole history is one JSON array rewritten on a debounce,
  /// and a decade of it should stay small enough not to think about.
  Map<String, Object?> toJson() => {
    'i': id,
    'k': kind.index,
    'a': at.toUtc().millisecondsSinceEpoch,
    if (synced) 's': 1,
  };

  static Tap? fromJson(Map<String, Object?> json) {
    final id = json['i'];
    final kind = json['k'];
    final at = json['a'];
    if (id is! String || kind is! int || at is! int) return null;
    if (kind < 0 || kind >= Choice.values.length) return null;
    return Tap(
      id: id,
      kind: Choice.values[kind],
      at: DateTime.fromMillisecondsSinceEpoch(at, isUtc: true).toLocal(),
      synced: json['s'] == 1,
    );
  }

  Map<String, Object?> toWire() => {
    'id': id,
    'kind': kind.wire,
    'at': at.toUtc().toIso8601String(),
  };

  static Tap? fromWire(Map<String, Object?> json) {
    final id = json['id'];
    final kind = Choice.parse(json['kind'] as String?);
    final at = DateTime.tryParse(json['at'] as String? ?? '');
    if (id is! String || kind == null || at == null) return null;
    return Tap(id: id, kind: kind, at: at.toLocal(), synced: true);
  }
}

/// The stretches of time a recap can cover.
///
/// Trailing windows ending now, not calendar periods. "This week" on a Monday
/// morning is an empty screen, which is the one thing a recap must never be.
enum Span {
  day(Duration(days: 1), 'the last day'),
  week(Duration(days: 7), 'the last week'),
  month(Duration(days: 30), 'the last month'),
  halfYear(Duration(days: 182), 'the last six months'),
  year(Duration(days: 365), 'the last year'),
  all(null, 'everything');

  const Span(this.length, this.label);

  /// Null means no beginning: every tap there has ever been.
  final Duration? length;
  final String label;

  DateTime? startFrom(DateTime now) => length == null ? null : now.subtract(length!);
}

/// What a recap is about to draw.
class Recap {
  const Recap({required this.span, required this.taps});

  final Span span;

  /// Oldest first, so the grid reads like a page: the beginning top left.
  final List<Tap> taps;

  int get total => taps.length;
  int get good => taps.where((tap) => tap.kind.isGood).length;
  int get bad => total - good;

  bool get isEmpty => total == 0;

  /// Which way it went. Ties count as good, deliberately: a day you broke even
  /// is not a day you lost, and the alternative is a third state on a screen
  /// that has room for two.
  bool get mostlyGood => good >= bad;

  /// 0 to 1. Only ever shown as a count beside it, never on its own.
  double get share => total == 0 ? 0 : good / total;
}

final _random = Random.secure();

/// A version 4 UUID, because the server's `id` column is one and this is three
/// lines against a dependency.
String newId() {
  final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}'
      '-${hex.substring(16, 20)}-${hex.substring(20)}';
}
