import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../api/client.dart' show ApiException;
import '../api/models.dart';
import '../design/tokens.dart';
import 'toast.dart' show KeepClear;

// Handed on rather than re-exported by hand: every screen that shows an error
// already imports this file, and the toast itself is its own thing.
export 'toast.dart';

/// The smallest thing a finger is asked to hit, in logical points: Apple's
/// 44. The export draws plenty of controls smaller than that — a «Hopp over»
/// 21 tall, a heart 34 across — and they stay drawn that way. What grows is
/// the area that answers, never the pixels: see [TapArea] and [TapRoom].
/// `test/tap_targets_test.dart` holds every screen to it.
const kTapTarget = 44.0;

/// One target, answering a finger across more than its ink.
///
/// With [onTap] the target is the app's own drawing — a word, a glyph, a chip
/// — and this is the button. Without, [child] handles its own touches — an
/// [InkWell] whose ripple is drawn to its box, a text field, a Material
/// button — and this only widens where it answers.
///
/// The area comes from one of three places:
///
/// - [room] is free space the screen already had, laid out inside this: the
///   gap that used to sit beside the target as a `SizedBox` or a padding
///   moves in, so everything is drawn exactly where it was and the box is the
///   bigger one.
/// - [reach] is not laid out at all: the box answers that much further out.
///   A parent only asks its children about touches inside its own box, and a
///   [Column] or a [Stack] asks its last child first, so the reach has to fit
///   in every parent above this and nothing after it may lie over it.
/// - Inside a [TapRoom], the room decides: the area is its share of the room,
///   as much of the part closer to it than to any other target as makes it
///   [kTapTarget] across. A [reach] as well is added to the share, for the
///   side of the target the room does not cover — with [above], the top of
///   the screen over a list's first row.
///
/// Without any of them the box answers across [kTapTarget] square around its
/// centre. A touch in the area but not on the ink goes to the ink's nearest
/// point, and failing that — the corner of a round button — to its middle,
/// the way Material's padded buttons pass one on.
///
/// [above] is for the one place none of that can reach: a header, which the
/// Scaffold lays out in a slot exactly its own height, or the first row of a
/// list, which its viewport cuts off at the status bar. There the part of the
/// area outside the box is answered from the route's overlay, over the page,
/// wherever the page has nothing of its own that answers, and only while a
/// touch on the box itself would get to it: a box scrolled out of sight, or
/// on a page on its way out, answers nothing from above either.
///
/// The area is also the target's size to a screen reader, and everything
/// under this is one node, named [label] if it is given. A label replaces
/// what the drawing would say, so it is for a glyph or an icon.
///
/// [keepsKeyboard] is for a target that is part of the typing, «Send» beside
/// a message, pressed between one message and the next. A tap on it is not a
/// tap away from the field (`widgets/keyboard.dart` has that rule), so the
/// keyboard stays up. That holds across the whole area, and also while the
/// target cannot be pressed: a second tap on «Send» while the first message
/// is still on its way does not take the keyboard down either. It lands on
/// the target and does nothing, instead of passing through to whatever is
/// under it.
class TapArea extends StatefulWidget {
  const TapArea({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.label,
    this.room = EdgeInsets.zero,
    this.reach,
    this.above = false,
    this.keepsKeyboard = false,
  });

  final Widget child;
  final VoidCallback? onTap, onLongPress;
  final String? label;
  final EdgeInsets room;
  final EdgeInsets? reach;
  final bool above;
  final bool keepsKeyboard;

  @override
  State<TapArea> createState() => _TapAreaState();
}

class _TapAreaState extends State<TapArea> {
  final _portal = OverlayPortalController();
  final _link = _AreaLink();

  @override
  void initState() {
    super.initState();
    if (widget.above) _portal.show();
  }

  @override
  void didUpdateWidget(TapArea oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.above != oldWidget.above) widget.above ? _portal.show() : _portal.hide();
  }

  @override
  Widget build(BuildContext context) {
    final own = widget.onTap != null || widget.onLongPress != null;
    final drawn =
        own && widget.label != null ? ExcludeSemantics(child: widget.child) : widget.child;
    final laidOut = Padding(padding: widget.room, child: drawn);
    Widget target = own || widget.keepsKeyboard
        ? GestureDetector(
            // Opaque, or the room would only answer where something is painted.
            behavior: HitTestBehavior.opaque,
            onTap: widget.onTap,
            onLongPress: widget.onLongPress,
            child: laidOut,
          )
        : laidOut;
    // In the group every text field is in, and inside the area rather than
    // round it: a room hands a touch in its share straight to the area, past
    // anything wrapped round it.
    if (widget.keepsKeyboard) target = TextFieldTapRegion(child: target);
    final area = _Area(
      link: _link,
      room: widget.room,
      // Room without a reach is the whole area; neither is the 44 square.
      reach: widget.room == EdgeInsets.zero ? widget.reach : widget.reach ?? EdgeInsets.zero,
      label: widget.label,
      button: own,
      child: target,
    );
    if (!widget.above) return area;
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (_) => _AreaAbove(link: _link),
      child: area,
    );
  }
}

/// Space shared by the targets inside it — a row of chips, a segmented
/// control, a field and the «Send» beside it — so that between them they
/// answer across all of it, and each across its own share.
///
/// [room] is laid out around [child], as a [TapArea]'s is: the gaps above and
/// below the group move inside. A target's share is the part of the room
/// closer to it than to its neighbours — the gap between two chips split down
/// the middle, the room above a row given to whatever is under it — and of
/// that, only as much as makes it [kTapTarget] across, so what lies between
/// targets and answers nothing goes on answering nothing. A touch in a share
/// is that target's. The share is its area, to a finger and to a screen
/// reader.
///
/// Its targets are the [TapArea]s inside it. Not through a scroll view: a
/// target in a list keeps to the list, and the list keeps its own room.
class TapRoom extends SingleChildRenderObjectWidget {
  TapRoom({super.key, EdgeInsets room = EdgeInsets.zero, required Widget child})
      : super(child: Padding(padding: room, child: child));

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderRoom();
}

/// How the overlay's half of a [TapArea] finds the target it answers for.
class _AreaLink {
  _RenderArea? area;
}

class _Area extends SingleChildRenderObjectWidget {
  const _Area({
    required this.link,
    required this.room,
    required this.button,
    this.reach,
    this.label,
    super.child,
  });

  final _AreaLink link;
  final EdgeInsets room;
  final EdgeInsets? reach;
  final String? label;
  final bool button;

  @override
  _RenderArea createRenderObject(BuildContext context) => _RenderArea(
      link: link,
      room: room,
      reach: reach,
      label: label,
      button: button,
      textDirection: Directionality.maybeOf(context));

  @override
  void updateRenderObject(BuildContext context, _RenderArea renderObject) => renderObject
    ..link = link
    ..room = room
    ..reach = reach
    ..label = label
    ..button = button
    ..textDirection = Directionality.maybeOf(context);
}

class _RenderArea extends RenderProxyBox {
  _RenderArea({
    required _AreaLink link,
    required EdgeInsets room,
    required bool button,
    EdgeInsets? reach,
    String? label,
    TextDirection? textDirection,
  })  : _link = link,
        _room = room,
        _reach = reach,
        _label = label,
        _button = button,
        _textDirection = textDirection;

  _AreaLink _link;
  set link(_AreaLink value) {
    if (identical(value, _link)) return;
    if (identical(_link.area, this)) _link.area = null;
    _link = value;
    if (attached) _link.area = this;
  }

  /// The padding around the ink, which a touch is passed on from.
  EdgeInsets _room;
  set room(EdgeInsets value) => _room = value;

  EdgeInsets? _reach;
  set reach(EdgeInsets? value) {
    if (value == _reach) return;
    _reach = value;
    markNeedsSemanticsUpdate();
  }

  String? _label;
  set label(String? value) {
    if (value == _label) return;
    _label = value;
    markNeedsSemanticsUpdate();
  }

  bool _button;
  set button(bool value) {
    if (value == _button) return;
    _button = value;
    markNeedsSemanticsUpdate();
  }

  TextDirection? _textDirection;
  set textDirection(TextDirection? value) {
    if (value == _textDirection) return;
    _textDirection = value;
    markNeedsSemanticsUpdate();
  }

  /// The [TapRoom] this target shares, if it is in one.
  _RenderRoom? _shared;

  /// Where this target answers, in its own coordinates.
  Rect get area {
    final box = Offset.zero & size;
    final reach = _reach;
    final share = _shared?._shareOf(this);
    if (share != null) return reach == null ? share : share.expandToInclude(reach.inflateRect(box));
    if (reach != null) return reach.inflateRect(box);
    return Rect.fromCenter(
      center: box.center,
      width: math.max(box.width, kTapTarget),
      height: math.max(box.height, kTapTarget),
    );
  }

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _link.area = this;
    // The nearest room, unless a scroll view comes first.
    for (var o = parent; o != null; o = o.parent) {
      if (o is RenderAbstractViewport) break;
      if (o is _RenderRoom) {
        _shared = o.._members.add(this);
        break;
      }
    }
  }

  @override
  void detach() {
    if (identical(_link.area, this)) _link.area = null;
    _shared?._members.remove(this);
    _shared = null;
    super.detach();
  }

  @override
  void performLayout() {
    super.performLayout();
    // The area moves with the box, and a screen reader is told where it is.
    markNeedsSemanticsUpdate();
  }

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) =>
      area.contains(position) && _answer(result, position);

  /// A touch known to be this target's.
  bool _answer(BoxHitTestResult result, Offset position) {
    final child = this.child;
    if (child == null) return false;
    // Where the finger is, if something there listens: a card's decoration
    // takes a touch as readily as the field inside it, and answers nothing.
    if (size.contains(position) && _listens(child, position)) {
      hitTestChildren(result, position: position);
      result.add(BoxHitTestEntry(this, position));
      return true;
    }
    // Pinned to one point for the whole gesture, as Material's padded buttons
    // do: the child sees a touch on itself however far out the finger was.
    final ink = _room.deflateRect(Offset.zero & size);
    final nearest = Offset(
      position.dx.clamp(ink.left, math.max(ink.left, ink.right - 0.01)),
      position.dy.clamp(ink.top, math.max(ink.top, ink.bottom - 0.01)),
    );
    for (final point in {nearest, ink.center}) {
      if (!_listens(child, point)) continue;
      final hit = result.addWithRawTransform(
        transform: MatrixUtils.forceToPoint(point),
        position: position,
        hitTest: (result, position) => child.hitTest(result, position: position),
      );
      if (hit) {
        result.add(BoxHitTestEntry(this, position));
        return true;
      }
    }
    return false;
  }

  /// Whether a touch at [position] would reach something under [child] that
  /// listens for one.
  static bool _listens(RenderBox child, Offset position) {
    final probe = BoxHitTestResult();
    child.hitTest(probe, position: position);
    return probe.path.any((entry) => entry.target is RenderPointerListener);
  }

  @override
  Rect get semanticBounds => area;

  @override
  void describeSemanticsConfiguration(SemanticsConfiguration config) {
    super.describeSemanticsConfiguration(config);
    // One target, one node, and its size is the area — not the drawn box, and
    // not the ink inside it with a node of its own.
    config
      ..isSemanticBoundary = true
      ..isMergingSemanticsOfDescendants = true;
    if (_button) config.isButton = true;
    if (_label != null) {
      config
        ..label = _label!
        ..textDirection = _textDirection;
    }
  }
}

class _RenderRoom extends RenderProxyBox {
  final _members = <_RenderArea>[];

  @override
  void performLayout() {
    super.performLayout();
    for (final member in _members) {
      member.markNeedsSemanticsUpdate();
    }
  }

  /// Each target's box, in this room's coordinates, and the share of the room
  /// it answers across. Two boxes side by side split the gap between them;
  /// two above one another, the gap across; two that are neither — chips in
  /// two rows — the wider of the two gaps, so every share is a rectangle and
  /// no two overlap. A gap is split down the middle, unless one of the two is
  /// short of [kTapTarget] with the room it has on its far side and the other
  /// is not: then the gap goes to the one that needs it, as far as it goes.
  Map<_RenderArea, Rect> _shares() {
    final room = Offset.zero & size;
    final boxes = <_RenderArea, Rect>{
      for (final m in _members)
        if (m.hasSize && m.attached)
          m: MatrixUtils.transformRect(m.getTransformTo(this), Offset.zero & m.size),
    };

    /// Where the gap from [end] to [start] is cut, for a target needing
    /// [before] of it and one needing [after].
    double cut(double end, double start, double before, double after) {
      final gap = start - end;
      return end + gap / 2 + ((before - after) / 2).clamp(-gap / 2, gap / 2);
    }

    double need(double extent, double far) => math.max(0, kTapTarget - extent - far);

    final shares = <_RenderArea, Rect>{};
    for (final MapEntry(key: m, value: box) in boxes.entries) {
      var share = room;
      for (final MapEntry(key: other, value: them) in boxes.entries) {
        if (identical(other, m)) continue;
        final (left, right) = box.right <= them.left ? (box, them) : (them, box);
        final (upper, lower) = box.bottom <= them.top ? (box, them) : (them, box);
        final across = right.left - left.right;
        final down = lower.top - upper.bottom;
        if (across >= 0 && (down < 0 || across >= down)) {
          final x = cut(left.right, right.left, need(left.width, left.left - room.left),
              need(right.width, room.right - right.right));
          share = identical(left, box)
              ? Rect.fromLTRB(share.left, share.top, math.min(share.right, x), share.bottom)
              : Rect.fromLTRB(math.max(share.left, x), share.top, share.right, share.bottom);
        } else if (down >= 0) {
          final y = cut(upper.bottom, lower.top, need(upper.height, upper.top - room.top),
              need(lower.height, room.bottom - lower.bottom));
          share = identical(upper, box)
              ? Rect.fromLTRB(share.left, share.top, share.right, math.min(share.bottom, y))
              : Rect.fromLTRB(share.left, math.max(share.top, y), share.right, share.bottom);
        }
      }
      shares[m] = _atLeast(box, share);
    }
    return shares;
  }

  /// No more of [cell] than [box] needs to be [kTapTarget] across: grown
  /// evenly round it, and moved over where one side of the cell is short. A
  /// share that took all its cell would make targets of what lies between
  /// them — the amount between «−» and «+», a heading over a field.
  static Rect _atLeast(Rect box, Rect cell) {
    (double, double) fit(double start, double end, double from, double to) {
      final grow = math.max(0.0, kTapTarget - (end - start)) / 2;
      var a = start - grow, b = end + grow;
      if (a < from) (a, b) = (from, b + from - a);
      if (b > to) (a, b) = (a - (b - to), to);
      return (math.max(a, from), math.min(b, to));
    }

    final (left, right) = fit(box.left, box.right, cell.left, cell.right);
    final (top, bottom) = fit(box.top, box.bottom, cell.top, cell.bottom);
    return Rect.fromLTRB(left, top, right, bottom);
  }

  /// [member]'s share, in its own coordinates.
  Rect? _shareOf(_RenderArea member) {
    final share = _shares()[member];
    if (share == null) return null;
    final back = Matrix4.tryInvert(member.getTransformTo(this));
    return back == null ? null : MatrixUtils.transformRect(back, share);
  }

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    if (!size.contains(position)) return false;
    for (final MapEntry(key: member, value: share) in _shares().entries) {
      if (!share.contains(position)) continue;
      final back = Matrix4.tryInvert(member.getTransformTo(this));
      if (back == null) break;
      final hit = result.addWithRawTransform(
        transform: back,
        position: position,
        hitTest: (result, position) => member._answer(result, position),
      );
      if (hit) {
        result.add(BoxHitTestEntry(this, position));
        return true;
      }
      break;
    }
    return super.hitTest(result, position: position);
  }
}

class _AreaAbove extends LeafRenderObjectWidget {
  const _AreaAbove({required this.link});

  final _AreaLink link;

  @override
  _RenderAreaAbove createRenderObject(BuildContext context) => _RenderAreaAbove(link);

  @override
  void updateRenderObject(BuildContext context, _RenderAreaAbove renderObject) =>
      renderObject.link = link;
}

/// The overlay's half of a [TapArea] with `above`: as big as the overlay,
/// drawing nothing, and answering only inside the target's area and outside
/// its box. The box itself is left to the ordinary hit test, which goes
/// through everything the page draws on top of it.
///
/// It lies over the whole page, so it asks the page first: where the page has
/// something of its own that answers a tap at that point — a list scrolled up
/// under the header, a field — the touch is that thing's, and the area gives
/// way. Only a point where nothing else would answer is taken.
///
/// The overlay hit-tests this on its own, past everything between the target
/// and the overlay that keeps a finger out: the route's own block while it
/// goes, a page transition's, a list's edge. So it also asks whether a touch
/// on the box itself would get through, and answers nothing when it would
/// not. Without that, a second tap on «‹» while its page was on the way out
/// took the page under it as well.
class _RenderAreaAbove extends RenderBox {
  _RenderAreaAbove(this.link);

  _AreaLink link;

  @override
  bool get sizedByParent => true;

  @override
  Size computeDryLayout(BoxConstraints constraints) => constraints.biggest;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    final area = link.area;
    if (area == null || !area.attached || !area.hasSize) return false;
    final toArea = Matrix4.tryInvert(area.getTransformTo(this));
    if (toArea == null) return false;
    final local = MatrixUtils.transformPoint(toArea, position);
    if (!area.area.contains(local) || area.size.contains(local)) return false;
    final page = _pageOf(area);
    if (page == null) return false;
    final toPage = Matrix4.tryInvert(page.getTransformTo(this));
    if (toPage == null) return false;
    final onPage = MatrixUtils.transformPoint(toPage, position);
    if (_answers(page, onPage) || !_reaches(page, area)) return false;
    final hit = result.addWithRawTransform(
      transform: toArea,
      position: position,
      hitTest: (result, position) => area._answer(result, position),
    );
    if (!hit) return false;
    // The page under the finger too, after the target: a drag or a wheel that
    // starts here is the list's, and a tap is the target's, the way two
    // listeners on the page settle it between them. Taken alone, the touch
    // never reached the list, and a page did not scroll from under a header.
    result.addWithRawTransform(
      transform: toPage,
      position: position,
      hitTest: (result, position) => page.hitTest(result, position: position),
    );
    return true;
  }

  /// The page under this — the overlay entry [area] is drawn in.
  RenderBox? _pageOf(RenderObject area) {
    final mine = <RenderObject>{};
    for (RenderObject? o = this; o != null; o = o.parent) {
      mine.add(o);
    }
    var page = area;
    while (page.parent != null && !mine.contains(page.parent)) {
      page = page.parent!;
    }
    return page is RenderBox ? page : null;
  }

  /// Whether [page] has a target of its own at [position].
  static bool _answers(RenderBox page, Offset position) {
    final probe = BoxHitTestResult();
    page.hitTest(probe, position: position);
    return probe.path.any((entry) => _answersTaps(entry.target));
  }

  /// Whether a touch in the middle of [area]'s box would get to it through
  /// [page]: not while the page is on its way out, nor with something of the
  /// page's own over the box, nor with the box scrolled out of sight.
  static bool _reaches(RenderBox page, _RenderArea area) {
    final middle = MatrixUtils.transformPoint(
        area.getTransformTo(page), (Offset.zero & area.size).center);
    final probe = BoxHitTestResult();
    page.hitTest(probe, position: middle);
    return probe.path.any((entry) => identical(entry.target, area));
  }
}

bool _answersTaps(HitTestTarget target) => switch (target) {
      RenderSemanticsGestureHandler(:final onTap, :final onLongPress) =>
        onTap != null || onLongPress != null,
      SemanticsAnnotationsMixin(:final properties) =>
        properties.onTap != null || properties.onLongPress != null,
      _ => false,
    };

/// The pill button every screen ends with, and so a thing a toast is never
/// laid over; see [KeepClear].
class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label,
      {super.key,
      this.onPressed,
      this.enabled = true,
      this.busy = false,
      this.icon,
      this.height = 54});

  final String label;
  final VoidCallback? onPressed;
  final bool enabled, busy;
  final IconData? icon;

  /// 54 as the export draws «Logg inn» and «Fortsett»; the trade screen's
  /// «Godta byttet» is 50 and the profile's «Send melding» 44.
  final double height;

  @override
  Widget build(BuildContext context) {
    final on = enabled && !busy && onPressed != null;
    return KeepClear(
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: FilledButton(
          onPressed: on ? onPressed : null,
          style: FilledButton.styleFrom(
            backgroundColor: SwaplyColors.greenPressed,
            disabledBackgroundColor: const Color(0xFFD8DEDA),
            disabledForegroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
          ),
          child: busy
              ? const SizedBox(
                  height: 20, width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
                    // Norwegian labels run long — «Marker byttet som gjennomført» —
                    // and a button is not allowed to overflow because of a word.
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Three outlined looks from the export: plain, «Avslå» (badge red on a pink
/// edge — the same pair as the ✕ on the item screen) and the green outline of
/// «Foreslå motbytte». Kept clear of by a toast as [PrimaryButton] is: at the
/// foot of the trade screen it is often the only button there.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton(this.label,
      {super.key, this.onPressed, this.destructive = false, this.accent = false, this.height = 52});

  final String label;
  final VoidCallback? onPressed;
  final bool destructive;
  final bool accent;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colour = destructive
        ? SwaplyColors.badge
        : accent
            ? SwaplyColors.greenText
            : SwaplyColors.ink;
    final edge = destructive
        ? SwaplyColors.declineLine
        : accent
            ? SwaplyColors.greenPressed
            : const Color(0x22064E3B);
    return KeepClear(
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: colour,
            backgroundColor: destructive ? Colors.white : null,
            side: BorderSide(color: edge),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: accent ? 14 : 15,
                  fontWeight: destructive || accent ? FontWeight.w700 : FontWeight.w600)),
        ),
      ),
    );
  }
}

/// The colours the export gives people. Not decoration: a list of chats is a
/// list of faces, and four identical green circles is not a list of faces.
const _avatarColours = [
  SwaplyColors.avatarGold,
  SwaplyColors.avatarTeal,
  SwaplyColors.avatarPurple,
];

/// «O» in a circle. The export never shows a profile photo, only an initial —
/// and it gives other people a colour of their own, so a face in a list is not
/// the same green as everything else on the screen. Yours stays deep green.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40, this.color, this.mine = false});

  final String name;
  final double size;
  final Color? color;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: size,
      width: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color ??
            (mine
                ? SwaplyColors.greenDeep
                // Same name, same colour, every screen: the person is
                // recognisable before the name is read.
                : _avatarColours[(name.isEmpty ? 0 : name.codeUnitAt(0)) % _avatarColours.length]),
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
        style: TextStyle(
            color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.42),
      ),
    );
  }
}

class Kicker extends StatelessWidget {
  const Kicker(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(),
      style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.92,
          color: SwaplyColors.greyLight));
}

class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.value, this.size = 14, this.onChanged});

  final double value;
  final double size;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final filled = value >= i + 1;
        final star = Icon(
          filled ? Icons.star_rounded : Icons.star_outline_rounded,
          size: size,
          color: filled ? const Color(0xFFF0A92B) : SwaplyColors.grey,
        );
        if (onChanged == null) return star;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onChanged!(i + 1),
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: star),
        );
      }),
    );
  }
}

/// A listing without a photo is not a hole in the collage: it gets a card of
/// its own, with the category mark on deep green.
class ItemThumb extends StatelessWidget {
  const ItemThumb(this.item, {super.key, this.size = 56, this.radius = 12});

  final Item item;
  final double size, radius;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    if (item.cover != null) {
      return ClipRRect(
        borderRadius: shape,
        child: Image.network(item.cover!,
            height: size, width: size, fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _placeholder(shape)),
      );
    }
    return _placeholder(shape);
  }

  /// The icon is sized by the box it actually gets, not by `size`: a card
  /// hands this a tight 166×110 and the icon has to fit that, and stay
  /// inside the corners.
  Widget _placeholder(BorderRadius shape) => ClipRRect(
        borderRadius: shape,
        child: Container(
          height: size,
          width: size,
          color: SwaplyColors.greenSoft,
          child: LayoutBuilder(
            builder: (context, c) {
              final side = c.maxWidth.isFinite && c.maxHeight.isFinite
                  ? (c.maxWidth < c.maxHeight ? c.maxWidth : c.maxHeight)
                  : size;
              return Icon(categoryIcons[item.category] ?? Icons.category_outlined,
                  color: SwaplyColors.greenDeep, size: side * 0.42);
            },
          ),
        ),
      );
}

/// A category, a condition, an interest. Filled, never outlined: in the export
/// the fill is the shape, and a border on top of it makes it look like a button.
class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.selected = false, this.small = false});

  final String label;
  final bool selected;

  /// The export has two sizes: a filter chip on 05 is 12.5px with 7/13 of
  /// padding, and a fact on a listing is 12px with 5/11.
  final bool small;

  @override
  Widget build(BuildContext context) => Container(
        padding: small
            ? const EdgeInsets.symmetric(horizontal: 11, vertical: 5)
            : const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? SwaplyColors.greenPressed : SwaplyColors.chip,
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: small ? 12 : 12.5,
            height: 1.2,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? Colors.white : SwaplyColors.chipInk,
          ),
        ),
      );
}

/// The two round buttons at the bottom of a listing: a ✕ that passes, and the
/// heart. Circles, because the export draws the heart as the one big thing on
/// the screen and a pill with a word in it is not that.
class CircleAction extends StatelessWidget {
  const CircleAction({
    super.key,
    required this.icon,
    required this.onPressed,
    this.filled = false,
    this.busy = false,
    this.size = 62,
    this.iconSize = 26,
    this.color,
    this.borderColor,
    this.borderWidth = 1,
    this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled, busy;
  final double size, iconSize, borderWidth;
  final Color? color, borderColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? SwaplyColors.greenPressed;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: filled ? tint : Colors.white,
        shape: CircleBorder(
          side: filled
              ? BorderSide.none
              : BorderSide(color: borderColor ?? SwaplyColors.cardLine, width: borderWidth),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: busy ? null : onPressed,
          child: SizedBox(
            height: size,
            width: size,
            child: busy
                ? const Center(
                    child: SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    ),
                  )
                : Icon(icon, size: iconSize, color: filled ? Colors.white : tint),
          ),
        ),
      ),
    );
  }
}

/// A heart pressed on grows a little and settles, which is the heart saying
/// it took. Each time [pops] goes up, and so only on the press: a heart that
/// is already green when the page opens, or turns green because the server
/// said so, holds still. Not at all for somebody who asked for less motion.
class HeartPop extends StatefulWidget {
  const HeartPop({super.key, required this.pops, required this.child});

  final int pops;
  final Widget child;

  @override
  State<HeartPop> createState() => _HeartPopState();
}

class _HeartPopState extends State<HeartPop> with SingleTickerProviderStateMixin {
  late final _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 320));

  // Out fast and back slower, with no overshoot on the way back: a pulse, not
  // a bounce.
  late final _scale = TweenSequence<double>([
    TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.14).chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 35),
    TweenSequenceItem(
        tween: Tween(begin: 1.14, end: 1.0).chain(CurveTween(curve: Curves.easeOutQuart)),
        weight: 65),
  ]).animate(_controller);

  @override
  void didUpdateWidget(HeartPop oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pops > oldWidget.pops && !MediaQuery.disableAnimationsOf(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(scale: _scale, child: widget.child);
}

/// The badge on a listing that says what state it is in: «Tilgjengelig»,
/// «Reservert». Smaller and tighter than a [Pill], because it sits on top of a
/// photograph rather than in a row of choices.
class StatePill extends StatelessWidget {
  const StatePill(this.label, {super.key, this.color = SwaplyColors.greenText, this.soft});

  final String label;
  final Color color;
  final Color? soft;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: soft ??
              switch (color) {
                SwaplyColors.greenText => SwaplyColors.availableBg,
                SwaplyColors.amberText || SwaplyColors.amber => SwaplyColors.amberBg,
                _ => SwaplyColors.chip,
              },
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 9.5, height: 1.2, fontWeight: FontWeight.w700, color: color)),
      );
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding, this.radius = 18, this.edge});

  final Widget child;
  final EdgeInsets? padding;
  final double radius;
  final Color? edge;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        // 11 top and bottom, 14 at the sides: the export's card, everywhere.
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: edge ?? SwaplyColors.cardLine),
        ),
        child: child,
      );
}

/// Empty states teach the interface: what this place is for, and one way out.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.inbox_outlined,
    this.footer,
  });

  final String title, body;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData icon;

  /// A quieter second way on, under the button — words, not another button.
  /// It is laid out with nothing around it: the 15 above it and half the foot
  /// under it are [footerRoom], for a footer that is a target to take.
  final Widget? footer;

  /// The free space around a [footer]: 15 under the button, as 10c keeps its
  /// own «Har du konto?», and 14 of the 28 below.
  static const footerRoom = EdgeInsets.only(top: 15, bottom: 14);

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: footer == null
              ? const EdgeInsets.all(Insets.xl)
              : EdgeInsets.fromLTRB(Insets.xl, Insets.xl, Insets.xl, Insets.xl - footerRoom.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 64, width: 64,
                decoration: const BoxDecoration(color: SwaplyColors.greenSoft, shape: BoxShape.circle),
                child: Icon(icon, color: SwaplyColors.greenDeep),
              ),
              const SizedBox(height: Insets.lg),
              Text(title, style: Type.title, textAlign: TextAlign.center),
              const SizedBox(height: Insets.sm),
              Text(body, style: Type.secondary, textAlign: TextAlign.center),
              if (actionLabel != null) ...[
                const SizedBox(height: Insets.lg),
                SizedBox(width: 230, child: PrimaryButton(actionLabel!, onPressed: onAction)),
              ],
              ?footer,
            ],
          ),
        ),
      );
}

/// A page that could not get the one thing it shows — a trade, a listing, a
/// conversation, a profile — drawn in its place. No answer is not an answer:
/// once every network failure arrived as [ApiException.noContact], a dropped
/// connection reached these pages, and «Fant ikke byttet» over «Vi får ikke
/// kontakt med Swaply akkurat nå.» said the trade was gone, with no way to
/// ask again but to leave and come back. A refusal is still the server's
/// word about the thing, and says [missing].
class LoadFailure extends StatelessWidget {
  const LoadFailure(this.error, {super.key, required this.missing, required this.onRetry});

  final ApiException error;

  /// What the page says when the server answered no: «Fant ikke byttet».
  final String missing;

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => error.isNoContact
      ? EmptyState(
          icon: Icons.wifi_off,
          title: 'Fikk ikke kontakt',
          body: error.message,
          actionLabel: 'Prøv igjen',
          onAction: onRetry)
      : EmptyState(icon: Icons.error_outline, title: missing, body: error.message);
}
