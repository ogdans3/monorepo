import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import 'data/api_client.dart';
import 'data/ids.dart';
import 'data/library_store.dart';
import 'data/models.dart';
import 'design/theme.dart';
import 'design/tokens.dart';
import 'state/library_controller.dart';
import 'ui/home_screen.dart';
import 'ui/list_screen.dart';
import 'ui/scope.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // One client id per install, minted once. It says nothing about the device
  // or its owner; it exists so the change feed can tell us which events we
  // caused ourselves.
  final clientId = await ClientIdStore().read(newClientId);
  final api = CheckpostApi(clientId: clientId);
  final library = LibraryController(store: PrefsLibraryStore(), api: api);
  await library.load();

  runApp(CheckpostApp(api: api, library: library));
}

class CheckpostApp extends StatefulWidget {
  const CheckpostApp({
    required this.api,
    required this.library,
    this.appLinks,
    super.key,
  });

  final CheckpostApi api;
  final LibraryController library;

  /// Injected in tests.
  final AppLinks? appLinks;

  @override
  State<CheckpostApp> createState() => _CheckpostAppState();
}

class _CheckpostAppState extends State<CheckpostApp> {
  final _navigator = GlobalKey<NavigatorState>();
  final _messenger = GlobalKey<ScaffoldMessengerState>();
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    unawaited(_listenForLinks());
  }

  /// A share link opened anywhere on the device lands here — both the verified
  /// https app link and the `checkpost://` fallback.
  Future<void> _listenForLinks() async {
    final links = widget.appLinks ?? AppLinks();
    try {
      final initial = await links.getInitialLink();
      if (initial != null) await _handleLink(initial);
    } catch (_) {
      // A platform that cannot report the launch link is not a fatal problem —
      // the "Open a link" action still works.
    }
    _links = links.uriLinkStream.listen(
      (uri) => unawaited(_handleLink(uri)),
      onError: (Object _) {},
    );
  }

  Future<void> _handleLink(Uri uri) async {
    final token = parseShareToken(uri.toString());
    if (token == null) return;

    // Already on this list? Just open it — re-fetching would be a round trip
    // for nothing, and the list screen reconciles anyway.
    final known = widget.library.byToken(token);
    if (known != null) {
      _push(known.id);
      return;
    }

    try {
      final saved = await widget.library.addByToken(token);
      _push(saved.id);
    } on ApiException catch (error) {
      _say(error.message);
    } on OfflineException {
      _say('Can’t reach Checkpost right now. Open the link again in a moment.');
    }
  }

  void _push(String listId) {
    final navigator = _navigator.currentState;
    if (navigator == null) return;
    // A second link while a list is open should replace it, not stack lists on
    // top of each other.
    navigator.popUntil((route) => route.isFirst);
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => ListScreen(library: widget.library, listId: listId),
      ),
    );
  }

  void _say(String message) {
    _messenger.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _links?.cancel();
    widget.api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CheckpostApiScope(
      api: widget.api,
      child: MaterialApp(
        title: 'Checkpost',
        debugShowCheckedModeBanner: false,
        navigatorKey: _navigator,
        scaffoldMessengerKey: _messenger,
        theme: buildTheme(CheckpostColors.light, Brightness.light),
        darkTheme: buildTheme(CheckpostColors.dark, Brightness.dark),
        // Light is the design's home — daylight, a phone flat on a counter —
        // but the OS setting always wins.
        themeMode: ThemeMode.system,
        builder: (context, child) {
          final dark = Theme.of(context).brightness == Brightness.dark;
          return CheckpostTheme(
            colors: dark ? CheckpostColors.dark : CheckpostColors.light,
            child: child ?? const SizedBox.shrink(),
          );
        },
        home: HomeScreen(library: widget.library),
      ),
    );
  }
}
