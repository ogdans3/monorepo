import 'dart:js_interop';

import 'address.dart' show inviteParameter;

/// The browser's address without the invitation; see `address.dart`. Straight
/// through `dart:js_interop`, as `other_tabs_web.dart` is: two members of
/// `window` and one method of `history`.
///
/// `replaceState` rather than a navigation, so nothing loads again, and with
/// the entry's own state: Flutter keeps its place in the history there, and a
/// state of null made the browser's back lose count.
void forgetInviteInAddress() {
  final url = Uri.parse(_window.location.href);
  if (!url.queryParameters.containsKey(inviteParameter)) return;
  final rest = {...url.queryParametersAll}..remove(inviteParameter);
  final query = rest.isEmpty ? '' : '?${Uri(queryParameters: rest).query}';
  final hash = url.hasFragment ? '#${url.fragment}' : '';
  _window.history.replaceState(_window.history.state, '', '${url.path}$query$hash');
}

@JS('window')
external _Window get _window;

extension type _Window._(JSObject _) implements JSObject {
  external _Location get location;
  external _History get history;
}

extension type _Location._(JSObject _) implements JSObject {
  external String get href;
}

extension type _History._(JSObject _) implements JSObject {
  external JSAny? get state;
  external void replaceState(JSAny? data, String unused, String url);
}
