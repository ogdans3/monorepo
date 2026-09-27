import 'package:flutter/foundation.dart';

/// Off the web the platform says it itself; see `reduced_motion.dart`.
ValueListenable<bool> askedForLessMotion() => ValueNotifier(false);
