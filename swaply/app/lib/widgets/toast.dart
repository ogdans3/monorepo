import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../design/tokens.dart';
import 'common.dart' show TapArea;

/// What the app says in passing: a refusal, something that landed, something
/// worth knowing.
///
/// It used to be a bare `SnackBar` — a black rectangle with square corners,
/// glued to the bottom edge across the button that had just been pressed,
/// carrying whatever string came back. Nothing else in the product looks like
/// that. This is a card in the palette the rest of the app is drawn in: a
/// hairline, a round corner, a soft shadow, and a coloured mark that says which
/// of the three this is before a word of it is read.
enum ToastTone {
  /// A refusal, and anything that did not happen. Coral, which is the «no»
  /// colour — never [SwaplyColors.red], which belongs to report and block and
  /// must not come to mean «error» as well.
  error,

  /// It happened. Green.
  done,

  /// Neither: a link copied, a number on the clipboard, a state explained.
  note,
}

class _Marks {
  const _Marks(this.icon, this.accent, this.fill, this.edge, this.seconds);
  final IconData icon;
  final Color accent, fill, edge;
  final int seconds;
}

const _marks = <ToastTone, _Marks>{
  // Five seconds rather than three: a refusal is the one of these worth
  // reading twice, and it is usually the longest sentence.
  ToastTone.error: _Marks(
      Icons.error_outline, SwaplyColors.coral, Color(0xFFFFF0EE), SwaplyColors.declineLine, 5),
  ToastTone.done: _Marks(
      Icons.check_rounded, SwaplyColors.greenPressed, SwaplyColors.greenSoft, SwaplyColors.line, 3),
  ToastTone.note: _Marks(
      Icons.info_outline, SwaplyColors.inkBody, SwaplyColors.chip, SwaplyColors.cardLine, 3),
};

/// A way back from what the toast says just happened — «Angre» — as one word
/// at the card's right edge. Pressing it takes the toast down first.
class ToastAction {
  const ToastAction(this.label, this.onPressed);
  final String label;
  final VoidCallback onPressed;
}

/// The card itself, pulled out so a widget test can find it by type.
class SwaplyToast extends StatelessWidget {
  const SwaplyToast(this.message, {super.key, this.tone = ToastTone.note, this.action});

  final String message;
  final ToastTone tone;
  final ToastAction? action;

  static const _text = TextStyle(
      fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w600, color: SwaplyColors.ink);

  /// The link colour and weight, the size of the message beside it.
  static const _actionText = TextStyle(
      fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w700, color: SwaplyColors.greenText);

  @override
  Widget build(BuildContext context) {
    final marks = _marks[tone]!;
    final action = this.action;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 11, 14, 11),
      decoration: BoxDecoration(
        color: Colors.white,
        // 18, which is the radius of every card in the export.
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: marks.edge),
        // The one shadow in the app: nothing else here casts one, and a toast
        // is the only thing that lies on top of a screen rather than in it.
        // Pulled in by a negative spread and barely offset — a wide, dropped
        // shadow under a card this wide draws a grey band under the whole
        // width instead of lifting it.
        boxShadow: const [
          BoxShadow(
              color: Color(0x22064E3B), blurRadius: 18, spreadRadius: -6, offset: Offset(0, 4)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 26,
            width: 26,
            decoration: BoxDecoration(color: marks.fill, shape: BoxShape.circle),
            child: Icon(marks.icon, size: 15, color: marks.accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: _text,
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: _actionGap),
            // A word, as a link is everywhere else in the app, level with the
            // first line of the message. It answers across 44 around itself,
            // which the card is tall enough to hold.
            TapArea(
              onTap: action.onPressed,
              child: Text(action.label, style: _actionText),
            ),
          ],
        ],
      ),
    );
  }

  static const _actionGap = 12.0;

  /// How tall the card comes out for [message] in [width], worked out the way
  /// it is laid out — for placing it before it has been.
  static double heightFor(BuildContext context, String message, double width,
      {String? action}) {
    final base = Theme.of(context).textTheme.bodyMedium ?? const TextStyle();
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.maybeOf(context) ?? TextDirection.ltr;
    var room = width - 2 - 12 - 14 - 26 - 10;
    if (action != null) {
      final word = TextPainter(
          text: TextSpan(text: action, style: base.merge(_actionText)),
          textDirection: direction,
          textScaler: scaler)
        ..layout();
      room -= _actionGap + word.width;
      word.dispose();
    }
    final text = TextPainter(
        text: TextSpan(text: message, style: base.merge(_text)),
        textDirection: direction,
        textScaler: scaler,
        maxLines: 4,
        ellipsis: '…')
      ..layout(maxWidth: math.max(0, room));
    final height = math.max(26.0, text.height) + 11 + 11 + 2;
    text.dispose();
    return height;
  }
}

/// A screen's primary action, which a toast never lies over. [PrimaryButton]
/// is one of these by itself; a screen whose primary action is something else
/// — the composer on 06g, the heart at the foot of 04 — says so with this.
///
/// It draws nothing and lays nothing out. A toast used to sit 14 above the
/// foot of whatever screen it was on, and on a screen drawn without the bar —
/// 02, 10b, 10c, a form — that is where the button is: a refusal of
/// «Fortsett» on 02 covered «Fortsett» for as long as it was up, which is
/// exactly when the person wants to press it again.
class KeepClear extends StatefulWidget {
  const KeepClear({super.key, required this.child});

  final Widget child;

  @override
  State<KeepClear> createState() => _KeepClearState();
}

class _KeepClearState extends State<KeepClear> {
  /// Every one mounted, on every screen. A toast looks for the ones that are
  /// on screen at the moment it goes up.
  static final _mounted = <_KeepClearState>{};

  ValueListenable<ScaffoldGeometry>? _geometry;

  /// Where the Scaffold's own bottom bar begins, as it was last painted, which
  /// is the only time a Scaffold says so. Null without one — the bar under
  /// the tabs is the shell's, and a tab's Scaffold ends where it begins.
  double? _barTop;

  @override
  void initState() {
    super.initState();
    _mounted.add(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _geometry = Scaffold.maybeOf(context) == null ? null : Scaffold.geometryOf(context);
  }

  @override
  void dispose() {
    _mounted.remove(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _OnPaint(
        () => _barTop = _geometry?.value.bottomNavigationBarTop,
        child: widget.child,
      );
}

/// Calls [painted] each time [child] is painted, and draws it as it is.
class _OnPaint extends SingleChildRenderObjectWidget {
  const _OnPaint(this.painted, {required super.child});

  final VoidCallback painted;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderOnPaint(painted);

  @override
  void updateRenderObject(BuildContext context, _RenderOnPaint renderObject) =>
      renderObject.painted = painted;
}

class _RenderOnPaint extends RenderProxyBox {
  _RenderOnPaint(this.painted);

  VoidCallback painted;

  @override
  void paint(PaintingContext context, Offset offset) {
    painted();
    super.paint(context, offset);
  }
}

/// Between a toast and the foot of its screen, and between a toast and the top
/// of whatever it keeps clear of.
const _edge = 14.0;

/// How far above the foot of its screen a toast goes up for [message]: [_edge],
/// or higher, to clear every [KeepClear] on screen it would otherwise lie on.
///
/// Measured as the toast goes up, against the screen as it stands, the way the
/// Scaffold will place it: over the keyboard, over a bottom bar, inside the
/// safe area. A tab's screen ends at the shell's bar already, so the foot is
/// the bar there. Nothing that is off screen counts — a tab not showing, a
/// page under another, a button scrolled out of its list — and nothing that
/// would push the toast off the top of the screen: covering is better than
/// not being seen.
double _footMargin(ScaffoldMessengerState messenger, String message, String? action) {
  final clear = <({double base, Rect rect, double height, double ceiling})>[];
  for (final keep in _KeepClearState._mounted) {
    final found = _onScreen(keep, messenger, message, action);
    if (found != null) clear.add(found);
  }

  var margin = _edge;
  for (var changed = true; changed;) {
    changed = false;
    for (final c in clear) {
      final bottom = c.base - margin;
      if (c.rect.top >= bottom || c.rect.bottom <= bottom - c.height) continue;
      final lifted = c.base - c.rect.top + _edge;
      if (lifted > margin && c.base - lifted - c.height >= c.ceiling) {
        margin = lifted;
        changed = true;
      }
    }
  }
  return margin;
}

/// Where [keep] is on the screen a toast would be drawn over, with where that
/// screen puts the foot of a toast: null when it is not on screen at all.
({double base, Rect rect, double height, double ceiling})? _onScreen(
    _KeepClearState keep, ScaffoldMessengerState messenger, String message, String? action) {
  if (!keep.mounted) return null;
  final context = keep.context;
  // Laid out and in the tree — asked first, since nothing else may be asked
  // of an element that is not.
  final box = (context as Element).renderObject;
  if (box is! RenderBox || !box.attached || !box.hasSize) return null;
  // Offstage — a tab not showing, a page under an opaque one — holds its
  // tickers; a page on its way out is no longer current.
  if (!TickerMode.valuesOf(context).enabled) return null;
  if (!(ModalRoute.of(context)?.isCurrent ?? true)) return null;
  if (ScaffoldMessenger.maybeOf(context) != messenger) return null;
  final scaffold = Scaffold.maybeOf(context);
  // A toast is drawn in the outermost Scaffold of a nested set only.
  if (scaffold == null || scaffold.context.findAncestorStateOfType<ScaffoldState>() != null) {
    return null;
  }
  final frame = scaffold.context.findRenderObject();
  if (frame is! RenderBox || !frame.attached || !frame.hasSize) return null;

  // In the Scaffold's own terms, cut to every list it is inside.
  var rect = Offset.zero & frame.size;
  RenderObject? node = box.parent;
  for (; node != null && node != frame; node = node.parent) {
    if (node is RenderBox && node is RenderAbstractViewport) {
      rect = rect.intersect(
          MatrixUtils.transformRect(node.getTransformTo(frame), Offset.zero & node.size));
    }
  }
  // Somewhere else — an overlay, a portal — and not under this Scaffold.
  if (node != frame) return null;
  rect = rect.intersect(
      MatrixUtils.transformRect(box.getTransformTo(frame), Offset.zero & box.size));
  if (rect.width <= 0 || rect.height <= 0) return null;

  // Where the Scaffold puts the foot of a floating toast.
  final media = MediaQuery.of(scaffold.context);
  final resize = scaffold.widget.resizeToAvoidBottomInset ?? true;
  final keyboard = resize ? media.viewInsets.bottom : 0.0;
  final safe = resize && keyboard != 0 ? 0.0 : media.viewPadding.bottom;
  final height = frame.size.height;
  final barTop = keep._barTop;
  final bar = barTop == null ? 0.0 : height - barTop;
  final base = math.min(height - math.max(keyboard, bar), height - safe);

  return (
    base: base,
    rect: rect,
    height: SwaplyToast.heightFor(scaffold.context, message, frame.size.width - 2 * _edge,
        action: action),
    ceiling: media.padding.top,
  );
}

/// Shown through the messenger rather than an overlay of our own, so a swipe
/// dismisses it and a screen that leaves takes its toast with it.
void showToastOn(ScaffoldMessengerState? messenger, ToastTone tone, String message,
    {ToastAction? action}) {
  if (messenger == null) return;
  final marks = _marks[tone]!;
  late final ScaffoldFeatureController<SnackBar, SnackBarClosedReason> shown;
  // Replace rather than queue: two refusals in a row means the second one is
  // the one you are waiting for.
  messenger.hideCurrentSnackBar();
  shown = messenger.showSnackBar(SnackBar(
    content: SwaplyToast(
      message,
      tone: tone,
      action: action == null
          ? null
          : ToastAction(action.label, () {
              shown.close();
              action.onPressed();
            }),
    ),
    // A way back needs time to be found as well as read.
    duration: Duration(seconds: action == null ? marks.seconds : math.max(marks.seconds, 5)),
    backgroundColor: Colors.transparent,
    elevation: 0,
    padding: EdgeInsets.zero,
    behavior: SnackBarBehavior.floating,
    // The room under the card is the margin's, which a touch goes through:
    // lifted over a button, the button still answers under it.
    margin: EdgeInsets.fromLTRB(_edge, 0, _edge, _footMargin(messenger, message, action?.label)),
    dismissDirection: DismissDirection.horizontal,
  ));
}

/// An [ApiException] already carries Norwegian a person can read, so the
/// message is the whole of it; anything else is stringified the same way.
void showError(BuildContext context, Object error) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.error, '$error');

void showDone(BuildContext context, String message, {ToastAction? action}) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.done, message, action: action);

void showNote(BuildContext context, String message) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.note, message);

// The same three for a caller that took the messenger before an await: a sheet
// that pops itself has no context left to look one up with.
void showErrorOn(ScaffoldMessengerState messenger, Object error) =>
    showToastOn(messenger, ToastTone.error, '$error');

void showDoneOn(ScaffoldMessengerState messenger, String message, {ToastAction? action}) =>
    showToastOn(messenger, ToastTone.done, message, action: action);

void showNoteOn(ScaffoldMessengerState messenger, String message) =>
    showToastOn(messenger, ToastTone.note, message);
