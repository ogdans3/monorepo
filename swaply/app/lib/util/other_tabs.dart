import 'other_tabs_stub.dart' if (dart.library.js_interop) 'other_tabs_web.dart' as platform;

/// Where the session keeps its token, and the account switcher the admin's
/// own while acting as somebody else: `SharedPreferences` keys, which the web
/// build keeps in the browser's storage under a prefix of its own.
const tokenKeys = ['token', 'adminToken'];

/// Rings each time another tab of the site changes who is signed in — signs
/// out, signs in, switches accounts, or drops a token the server refused —
/// and never for a change this tab made itself: the browser only tells the
/// other tabs. Null off the web, where this app is the only thing that
/// writes the preferences, so nothing else can change them under it.
///
/// Says only that something changed, not what to: the storage is read again
/// for that, since a tab can hear about two changes in the wrong order and
/// only the storage knows which came last.
Stream<void>? tokenChangedElsewhere() => platform.tokenChangedElsewhere(tokenKeys);
