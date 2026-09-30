import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// A tap away from the field being typed in puts the keyboard away, as it does
/// in other apps on a phone, and a scroll does not.
///
/// Flutter does not do this by itself on a phone. It follows the platforms,
/// and a text field on iOS or Android does not let go when somebody taps
/// somewhere else: the app has to say so, and nearly every app does. Android
/// has the back gesture to take the keyboard down as well. An iPhone has
/// nothing else, and where the return key makes a new line, in a description
/// or a message, the only way out was to leave the screen.
///
/// What counts as the field is what Flutter counts: its box, the handles and
/// the menu of a selection in it, and every other field, so going from one
/// field to the next hands the keyboard over instead of taking it down and
/// putting it up again. A `TapArea` that `keepsKeyboard` counts too: «Send»
/// beside a message. Everything else is away, a button as much as the empty
/// page, so what «Logg inn», a chip or a heart answers with is not under the
/// keyboard.
///
/// A tap, not a touch: the keyboard goes when the finger comes up no further
/// from where it went down than a list lets it move before taking it for a
/// scroll. On the way down it could still be a scroll, and a list moved to see
/// what is under the keyboard has not asked for it to go.
///
/// Wired once, into the `MaterialApp` builder, over every field there is:
/// every route and sheet, and the admin floor.
class KeyboardAway extends StatefulWidget {
  const KeyboardAway({super.key, required this.child});

  final Widget child;

  @override
  State<KeyboardAway> createState() => _KeyboardAwayState();
}

class _KeyboardAwayState extends State<KeyboardAway> {
  /// The finger that went down away from the field, until it comes up. One at
  /// a time: a second finger is not a tap.
  PointerDownEvent? _down;

  /// Made once: the finger that went down has to be the one found when it
  /// comes up, whatever was built in between.
  late final _actions = <Type, Action<Intent>>{
    EditableTextTapOutsideIntent: _Down((event) => _down = event),
    EditableTextTapUpOutsideIntent: CallbackAction<EditableTextTapUpOutsideIntent>(onInvoke: _up),
  };

  void _up(EditableTextTapUpOutsideIntent intent) {
    final down = _down, up = intent.pointerUpEvent;
    _down = null;
    if (down == null || down.pointer != up.pointer) return;
    final scroll = computeHitSlop(down.kind, MediaQuery.maybeGestureSettingsOf(context));
    if ((up.position - down.position).distance <= scroll) intent.focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) => Actions(actions: _actions, child: widget.child);
}

/// The way down: the finger remembered, and then what Flutter does there
/// anyway. A mouse or a pencil lets go of the field on the way down already,
/// and so does a finger in a browser; this leaves them to it.
class _Down extends Action<EditableTextTapOutsideIntent> {
  _Down(this.remember);

  final void Function(PointerDownEvent) remember;

  @override
  Object? invoke(EditableTextTapOutsideIntent intent) {
    remember(intent.pointerDownEvent);
    return callingAction?.invoke(intent);
  }
}
