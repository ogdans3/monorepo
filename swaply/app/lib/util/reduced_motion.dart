import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'reduced_motion_stub.dart' if (dart.library.js_interop) 'reduced_motion_web.dart'
    as platform;

/// Whether somebody has asked for less motion where Flutter is not told so
/// itself: in a browser. On a phone the system's setting reaches
/// [MediaQueryData.disableAnimations] on its own; the web engine reports high
/// contrast and nothing else, so the tab fade and the confetti ran for people
/// whose browser says `prefers-reduced-motion: reduce`. Follows the setting
/// while the page is open, as the phone's does. Always false off the web.
///
/// Made once and kept: each call listens to the browser anew.
ValueListenable<bool> askedForLessMotion() => platform.askedForLessMotion();

/// [asked], added to what the platform already says, for everything under
/// it — so every place that honours [MediaQueryData.disableAnimations] honours
/// the browser's setting too. Wired once, into the `MaterialApp` builder.
///
/// Only ever adds: a phone that asks for less motion is not overruled by a
/// browser that does not exist.
class LessMotion extends StatelessWidget {
  const LessMotion({super.key, required this.asked, required this.child});

  final ValueListenable<bool> asked;
  final Widget child;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
        valueListenable: asked,
        child: child,
        // Always a MediaQuery, whatever the answer: a tree that gained one
        // when the setting changed would build the whole app again from
        // nothing, stacks and half-typed fields included.
        builder: (context, less, child) {
          final media = MediaQuery.of(context);
          return MediaQuery(
            data: media.copyWith(disableAnimations: media.disableAnimations || less),
            child: child!,
          );
        },
      );
}
