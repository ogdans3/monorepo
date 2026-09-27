import 'dart:js_interop';

import 'package:flutter/foundation.dart';

/// The browser's own answer; see `reduced_motion.dart`. Straight through
/// `dart:js_interop` rather than a package: two members of one object.
ValueListenable<bool> askedForLessMotion() {
  final query = _matchMedia('(prefers-reduced-motion: reduce)');
  final asked = ValueNotifier(query.matches);
  // Changed in the system's settings with the page open.
  query.addEventListener('change', ((JSAny? _) {
    asked.value = query.matches;
  }).toJS);
  return asked;
}

@JS('matchMedia')
external _MediaQueryList _matchMedia(String query);

extension type _MediaQueryList._(JSObject _) implements JSObject {
  external bool get matches;
  external void addEventListener(String type, JSFunction listener);
}
