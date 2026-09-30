import 'dart:ui' show PointerDeviceKind;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import 'common.dart';

/// Every photograph of a listing, big, one at a time. They are swiped
/// between, pinched or double-tapped closer, and pulled down, or «✕», to go
/// back. The gallery on 04 opens it and so does 10b's strip, each at the
/// picture that was tapped.
///
/// It answers with the picture last looked at, so what opened it can be left
/// on that one too.
Future<int?> showPhotos(BuildContext context, List<ImageProvider> photos, {int initial = 0}) {
  final still = MediaQuery.disableAnimationsOf(context);
  return Navigator.of(context, rootNavigator: true).push<int>(PageRouteBuilder<int>(
    // Not opaque: the page stays under it, and shows through as it is pulled
    // away.
    opaque: false,
    transitionDuration: still ? Duration.zero : const Duration(milliseconds: 220),
    reverseTransitionDuration: still ? Duration.zero : const Duration(milliseconds: 180),
    pageBuilder: (_, _, _) => PhotoViewer(photos: photos, initial: initial),
    transitionsBuilder: (_, animation, _, child) {
      final eased = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
      return FadeTransition(
        opacity: eased,
        child: ScaleTransition(scale: Tween(begin: 0.96, end: 1.0).animate(eased), child: child),
      );
    },
  ));
}

class PhotoViewer extends StatefulWidget {
  const PhotoViewer({super.key, required this.photos, this.initial = 0});

  final List<ImageProvider> photos;
  final int initial;

  @override
  State<PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<PhotoViewer> with SingleTickerProviderStateMixin {
  late final _pages = PageController(initialPage: widget.initial);
  late int _page = widget.initial;

  /// The picture on screen is zoomed in: a finger then moves round it rather
  /// than on to the next one, or down and away.
  bool _zoomed = false;

  /// How far it has been pulled, down or up, to go back.
  double _pull = 0;

  /// A pull let go of too early goes back into place from here.
  double _from = 0;
  late final AnimationController _back;

  /// Past this, or thrown, a pull goes back to the page under.
  static const _away = 120.0;

  @override
  void initState() {
    super.initState();
    _back = AnimationController(vsync: this, duration: const Duration(milliseconds: 200))
      ..addListener(() =>
          setState(() => _pull = _from * (1 - Curves.easeOutCubic.transform(_back.value))));
  }

  @override
  void dispose() {
    _back.dispose();
    _pages.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop(_page);

  void _go(int by) {
    final to = (_page + by).clamp(0, widget.photos.length - 1);
    if (to == _page) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _pages.jumpToPage(to);
    } else {
      _pages.animateToPage(to, duration: const Duration(milliseconds: 240), curve: Curves.easeOutCubic);
    }
  }

  void _let(DragEndDetails end) {
    if (_pull.abs() > _away || (end.primaryVelocity ?? 0).abs() > 900) {
      _close();
    } else if (MediaQuery.disableAnimationsOf(context)) {
      setState(() => _pull = 0);
    } else {
      _from = _pull;
      _back.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.photos.length;
    // The page under shows more the further it is pulled, and the words go
    // first: what is being pulled is the picture.
    final through = (_pull.abs() / 600).clamp(0.0, 0.6);
    final chrome = (1 - _pull.abs() / 60).clamp(0.0, 1.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: onDarkStatusBar,
      // Arrows and Escape for a browser on a desk, which has no swipe.
      child: CallbackShortcuts(
        bindings: {
          const SingleActivator(LogicalKeyboardKey.arrowRight): () => _go(1),
          const SingleActivator(LogicalKeyboardKey.arrowLeft): () => _go(-1),
          const SingleActivator(LogicalKeyboardKey.escape): _close,
        },
        child: Focus(
          autofocus: true,
          child: Material(
            color: SwaplyColors.ink.withValues(alpha: 1 - through),
            child: Stack(
              children: [
                Positioned.fill(
                  child: GestureDetector(
                    onVerticalDragUpdate: _zoomed
                        ? null
                        : (d) {
                            _back.stop();
                            setState(() => _pull += d.delta.dy);
                          },
                    onVerticalDragEnd: _zoomed ? null : _let,
                    child: Transform.translate(
                      offset: Offset(0, _pull),
                      // A mouse drags it too: Flutter swipes with a finger
                      // only, and in a browser on a desk there is no finger.
                      child: ScrollConfiguration(
                        behavior: ScrollConfiguration.of(context).copyWith(
                            dragDevices: {...PointerDeviceKind.values}),
                        child: PageView.builder(
                          controller: _pages,
                          physics: _zoomed
                              ? const NeverScrollableScrollPhysics()
                              : const PageScrollPhysics(),
                          onPageChanged: (i) => setState(() {
                            _page = i;
                            _zoomed = false;
                          }),
                          itemCount: count,
                          itemBuilder: (_, i) => _Photo(
                            image: widget.photos[i],
                            label: count == 1 ? 'Bildet' : 'Bilde ${i + 1} av $count',
                            onZoomed: (zoomed) {
                              if (i == _page && zoomed != _zoomed) {
                                setState(() => _zoomed = zoomed);
                              }
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: IgnorePointer(
                    ignoring: chrome < 1,
                    child: Opacity(
                      opacity: chrome,
                      child: SafeArea(
                        bottom: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
                          child: Row(
                            children: [
                              TapArea(
                                label: 'Lukk',
                                onTap: _close,
                                child: const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Icon(Icons.close, color: Colors.white, size: 26),
                                ),
                              ),
                              Expanded(
                                child: count > 1
                                    ? Text('${_page + 1} av $count',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600))
                                    : const SizedBox.shrink(),
                              ),
                              const SizedBox(width: 44),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One picture, whole on the screen, and as close as a pinch or a double tap
/// takes it: twice as close from a double tap, where it was tapped, and four
/// times at most. A second double tap puts it back.
class _Photo extends StatefulWidget {
  const _Photo({required this.image, required this.label, required this.onZoomed});

  final ImageProvider image;
  final String label;
  final ValueChanged<bool> onZoomed;

  @override
  State<_Photo> createState() => _PhotoState();
}

class _PhotoState extends State<_Photo> with SingleTickerProviderStateMixin {
  final _view = TransformationController();
  late final _zoom = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  Animation<Matrix4>? _towards;
  Offset _tapped = Offset.zero;
  bool _in = false;

  @override
  void initState() {
    super.initState();
    _view.addListener(_changed);
    _zoom.addListener(() {
      final to = _towards;
      if (to != null) _view.value = to.value;
    });
  }

  @override
  void dispose() {
    _zoom.dispose();
    _view.dispose();
    super.dispose();
  }

  void _changed() {
    final zoomed = _view.value.getMaxScaleOnAxis() > 1.01;
    if (zoomed != _in) {
      _in = zoomed;
      widget.onZoomed(zoomed);
    }
  }

  void _doubleTap() {
    final Matrix4 to;
    if (_in) {
      to = Matrix4.identity();
    } else {
      const s = 2.0;
      to = Matrix4.identity()
        ..translateByDouble(-_tapped.dx * (s - 1), -_tapped.dy * (s - 1), 0, 1)
        ..scaleByDouble(s, s, 1, 1);
    }
    if (MediaQuery.disableAnimationsOf(context)) {
      _view.value = to;
      return;
    }
    _towards = Matrix4Tween(begin: _view.value, end: to)
        .animate(CurvedAnimation(parent: _zoom, curve: Curves.easeOutCubic));
    _zoom.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) => Semantics(
        image: true,
        label: widget.label,
        child: GestureDetector(
          onDoubleTapDown: (d) => _tapped = d.localPosition,
          onDoubleTap: _doubleTap,
          child: InteractiveViewer(
            transformationController: _view,
            maxScale: 4,
            // Held while it is not zoomed, so a finger that moves is the
            // swipe to the next picture and not a pan that goes nowhere.
            panEnabled: _in,
            child: SizedBox.expand(
              child: Image(
                image: widget.image,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
                errorBuilder: (_, _, _) => const Center(
                  child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 40),
                ),
              ),
            ),
          ),
        ),
      );
}
