import 'dart:async';
import 'dart:js_interop';

/// The browser's `storage` event, for the keys `shared_preferences` keeps the
/// session under; see `other_tabs.dart`. Straight through `dart:js_interop`
/// rather than a package, as `reduced_motion_web.dart` is: one event and two
/// of its fields.
Stream<void>? tokenChangedElsewhere(List<String> keys) {
  // `shared_preferences_web` keeps every key under this prefix, in
  // `localStorage`. A key of null is the whole storage cleared — by the
  // browser's own «clear site data», or by a page calling `clear()`.
  final watched = {for (final key in keys) 'flutter.$key'};
  late final StreamController<void> changes;
  final listener = ((_StorageEvent event) {
    final key = event.key;
    if (key == null || watched.contains(key)) changes.add(null);
  }).toJS;
  changes = StreamController<void>.broadcast(
    onListen: () => _window.addEventListener('storage', listener),
    onCancel: () => _window.removeEventListener('storage', listener),
  );
  return changes.stream;
}

@JS('window')
external _Window get _window;

extension type _Window._(JSObject _) implements JSObject {
  external void addEventListener(String type, JSFunction listener);
  external void removeEventListener(String type, JSFunction listener);
}

extension type _StorageEvent._(JSObject _) implements JSObject {
  external String? get key;
}
