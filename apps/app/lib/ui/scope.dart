import 'package:flutter/widgets.dart';

import '../data/api_client.dart';

/// Makes the single [CheckpostApi] reachable from any screen.
///
/// Looked up with `getInheritedWidgetOfExactType` rather than
/// `dependOnInheritedWidgetOfExactType`: the client is created once at startup
/// and never replaced, so nothing needs to rebuild when it is read — and that
/// is what makes reading it from `initState` legal.
class CheckpostApiScope extends InheritedWidget {
  const CheckpostApiScope({required this.api, required super.child, super.key});

  final CheckpostApi api;

  static CheckpostApi of(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<CheckpostApiScope>();
    assert(scope != null, 'No CheckpostApiScope found in context');
    return scope!.api;
  }

  @override
  bool updateShouldNotify(CheckpostApiScope oldWidget) => api != oldWidget.api;
}
