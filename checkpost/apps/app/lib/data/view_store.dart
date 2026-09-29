import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// How this device looks at one list: whether the open rows are grouped by
/// tag, and whether the done shelf is folded.
///
/// Remembered per list and per device, because they are a way of reading the
/// list rather than a change to it. Nobody else on the list sees them. The tag
/// filter is deliberately not in here: a filter left on and forgotten hides
/// rows, which is the one thing a shared list must not do quietly, so it lasts
/// as long as the screen does.
@immutable
class DeviceView {
  const DeviceView({this.byTag = false, this.doneFolded = false});

  final bool byTag;
  final bool doneFolded;

  static const standard = DeviceView();

  bool get isStandard => !byTag && !doneFolded;

  DeviceView copyWith({bool? byTag, bool? doneFolded}) => DeviceView(
    byTag: byTag ?? this.byTag,
    doneFolded: doneFolded ?? this.doneFolded,
  );

  Map<String, dynamic> toJson() => {
    if (byTag) 'byTag': true,
    if (doneFolded) 'doneFolded': true,
  };

  factory DeviceView.fromJson(Map<String, dynamic> json) => DeviceView(
    byTag: json['byTag'] == true,
    doneFolded: json['doneFolded'] == true,
  );

  @override
  bool operator ==(Object other) =>
      other is DeviceView &&
      other.byTag == byTag &&
      other.doneFolded == doneFolded;

  @override
  int get hashCode => Object.hash(byTag, doneFolded);
}

abstract interface class DeviceViewStore {
  Future<DeviceView> read(String listId);
  Future<void> write(String listId, DeviceView view);
}

/// The same `SharedPreferencesAsync` the list index uses, under a key of its
/// own. Losing this costs a list its grouping and its folded shelf, nothing
/// more, so unlike the index it can be thrown away when it will not parse.
class PrefsDeviceViewStore implements DeviceViewStore {
  PrefsDeviceViewStore({SharedPreferencesAsync? prefs})
    : _prefs = prefs ?? SharedPreferencesAsync();

  static const _key = 'checkpost.views.v1';

  final SharedPreferencesAsync _prefs;

  /// Read once, then kept, so opening a list does not wait on the platform
  /// channel twice and two writes in a row cannot interleave their reads.
  Future<Map<String, DeviceView>>? _all;

  Future<Map<String, DeviceView>> _load() => _all ??= () async {
    try {
      final raw = await _prefs.getString(_key);
      if (raw == null || raw.isEmpty) return <String, DeviceView>{};
      final decoded = (jsonDecode(raw) as Map).cast<String, dynamic>();
      return {
        for (final entry in decoded.entries)
          if (entry.value is Map)
            entry.key: DeviceView.fromJson(
              (entry.value as Map).cast<String, dynamic>(),
            ),
      };
    } catch (_) {
      return <String, DeviceView>{};
    }
  }();

  @override
  Future<DeviceView> read(String listId) async =>
      (await _load())[listId] ?? DeviceView.standard;

  @override
  Future<void> write(String listId, DeviceView view) async {
    final all = await _load();
    // Only lists looked at some other way than the standard one are kept, so
    // the entry for a list nobody changed the view of never exists at all.
    if (view.isStandard) {
      all.remove(listId);
    } else {
      all[listId] = view;
    }
    await _prefs.setString(
      _key,
      jsonEncode({
        for (final entry in all.entries) entry.key: entry.value.toJson(),
      }),
    );
  }
}

/// For tests and previews, and the default when no store is given.
class MemoryDeviceViewStore implements DeviceViewStore {
  final Map<String, DeviceView> _views = {};

  @override
  Future<DeviceView> read(String listId) async =>
      _views[listId] ?? DeviceView.standard;

  @override
  Future<void> write(String listId, DeviceView view) async =>
      _views[listId] = view;
}
