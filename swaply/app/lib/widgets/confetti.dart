import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../design/tokens.dart';

/// A fleck of confetti: where it starts, in fractions of the screen, and what
/// it looks like.
class Fleck {
  const Fleck({
    required this.x,
    required this.y,
    required this.size,
    required this.colour,
    this.square = false,
  });

  final double x, y, size;
  final Color colour;
  final bool square;
}

/// The export scatters four flecks over the match screen — one of the press
/// green, one of the badge red, two of the pale green, one of them square.
/// Here they drift, slowly, up and off the top, and come back in from below:
/// a small thing that makes the moment feel like one rather than a still.
/// Ten pixels a second, so the eye catches it only when it rests. A few more
/// wait below the screen, so it never runs empty. Still when the phone has
/// been asked for less motion.
class Confetti extends StatefulWidget {
  const Confetti({super.key, this.flecks = Confetti.match, this.seed = 7});

  /// Where the export puts them on 06a, in fractions of a 390×844 frame.
  static const match = [
    Fleck(x: 44 / 390, y: 120 / 844, size: 8, colour: SwaplyColors.greenPressed),
    Fleck(x: 314 / 390, y: 88 / 844, size: 6, colour: SwaplyColors.badge),
    Fleck(x: 344 / 390, y: 189 / 844, size: 12, colour: Color(0xFF9BD9BE), square: true),
    Fleck(x: 40 / 390, y: 587 / 844, size: 7, colour: Color(0xFF9BD9BE)),
  ];

  final List<Fleck> flecks;
  final int seed;

  @override
  State<Confetti> createState() => _ConfettiState();
}

class _Moving {
  _Moving(this.fleck, this.x, this.y, this.speed, this.phase);

  final Fleck fleck;
  double x, y;

  /// Fractions of the height per second.
  double speed;

  /// Where in its sideways sway the fleck is.
  double phase;
  double angle = 0;
}

class _ConfettiState extends State<Confetti> with SingleTickerProviderStateMixin {
  static const _palette = [
    (SwaplyColors.greenPressed, false),
    (Color(0xFF9BD9BE), false),
    (SwaplyColors.badge, false),
    (Color(0xFF9BD9BE), true),
    (SwaplyColors.greenPressed, true),
  ];

  late final Ticker _ticker;
  late final math.Random _random;
  late final List<_Moving> _moving;
  final _repaint = ValueNotifier<int>(0);
  Duration _last = Duration.zero;
  double _time = 0;

  @override
  void initState() {
    super.initState();
    _random = math.Random(widget.seed);
    _moving = [
      for (final f in widget.flecks) _Moving(f, f.x, f.y, _speed(), _random.nextDouble() * math.pi * 2),
      // Queued below the frame, spread out, so they arrive one at a time.
      for (var i = 0; i < 5; i++)
        _Moving(
          Fleck(
            x: _random.nextDouble(),
            y: 1.05 + i * 0.18 + _random.nextDouble() * 0.1,
            size: 5 + _random.nextInt(7).toDouble(),
            colour: _palette[i % _palette.length].$1,
            square: _palette[i % _palette.length].$2,
          ),
          0,
          0,
          _speed(),
          _random.nextDouble() * math.pi * 2,
        )..x = 0,
    ];
    for (final m in _moving) {
      m.x = m.fleck.x;
      m.y = m.fleck.y;
    }
    _ticker = createTicker(_tick);
  }

  /// Eight to twelve pixels a second on an 844-tall screen.
  double _speed() => (8 + _random.nextDouble() * 4) / 844;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.disableAnimationsOf(context);
    if (still) {
      if (_ticker.isActive) _ticker.stop();
    } else if (!_ticker.isActive) {
      _ticker.start();
    }
  }

  void _tick(Duration elapsed) {
    final dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    _time += dt;
    for (final m in _moving) {
      m.y -= m.speed * dt;
      if (m.fleck.square) m.angle += 0.2 * dt;
      if (m.y < -0.03) {
        // Off the top: back in at the bottom, somewhere else, at its own pace.
        m.y = 1.03;
        m.x = 0.06 + _random.nextDouble() * 0.88;
        m.speed = _speed();
        m.phase = _random.nextDouble() * math.pi * 2;
      }
    }
    _repaint.value++;
  }

  @override
  void dispose() {
    _ticker.dispose();
    _repaint.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: CustomPaint(
          painter: _ConfettiPainter(_moving, () => _time, _repaint),
          size: Size.infinite,
        ),
      );
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.moving, this.time, Listenable repaint) : super(repaint: repaint);

  final List<_Moving> moving;
  final double Function() time;

  @override
  void paint(Canvas canvas, Size size) {
    final t = time();
    for (final m in moving) {
      final f = m.fleck;
      // A slow sway, six pixels either way over about eight seconds.
      final sway = math.sin(t * 0.8 + m.phase) * 6;
      final centre = Offset(m.x * size.width + f.size / 2 + sway, m.y * size.height + f.size / 2);
      final paint = Paint()..color = f.colour;
      if (f.square) {
        canvas.save();
        canvas.translate(centre.dx, centre.dy);
        canvas.rotate(m.angle);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromCenter(center: Offset.zero, width: f.size, height: f.size),
              const Radius.circular(2)),
          paint,
        );
        canvas.restore();
      } else {
        canvas.drawCircle(centre, f.size / 2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => true;
}
