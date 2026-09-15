import 'package:flutter/material.dart';

import 'data/api_client.dart';
import 'data/local_store.dart';
import 'design/tokens.dart';
import 'state/app_state.dart';
import 'ui/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState(store: PrefsStore(), api: ApiClient());
  await state.load();
  runApp(GoodOrBadChoice(state: state));
}

/// Hands [AppState] down the tree and rebuilds what listens to it.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({required AppState super.notifier, required super.child, super.key});

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope above this widget');
    return scope!.notifier!;
  }

  /// For callbacks that only want to *do* something, without subscribing.
  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope above this widget');
    return scope!.notifier!;
  }
}

class GoodOrBadChoice extends StatefulWidget {
  const GoodOrBadChoice({required this.state, super.key});

  final AppState state;

  @override
  State<GoodOrBadChoice> createState() => _GoodOrBadChoiceState();
}

class _GoodOrBadChoiceState extends State<GoodOrBadChoice> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Leaving is the last moment anything is guaranteed to run, and there may
    // be a debounced write outstanding.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      widget.state.flush();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      notifier: widget.state,
      child: AnimatedBuilder(
        animation: widget.state,
        builder: (context, _) {
          final dark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
          final palette = Palette.resolve(dark: dark, colourBlind: widget.state.colourBlind);
          return PaletteScope(
            palette: palette,
            child: MaterialApp(
              title: 'good or bad choice',
              debugShowCheckedModeBanner: false,
              theme: _theme(palette, dark),
              home: const HomeScreen(),
            ),
          );
        },
      ),
    );
  }

  ThemeData _theme(Palette palette, bool dark) {
    final base = dark ? ThemeData.dark() : ThemeData.light();
    return base.copyWith(
      scaffoldBackgroundColor: palette.bg,
      colorScheme: base.colorScheme.copyWith(
        surface: palette.bg,
        primary: palette.good,
        error: palette.bad,
      ),
      textTheme: base.textTheme.apply(bodyColor: palette.ink, displayColor: palette.ink),
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
    );
  }
}
