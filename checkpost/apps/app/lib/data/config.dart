import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Where the app talks to.
///
/// A debug build points at a local API by default, because that is what a debug
/// build is for. Shipping a default of `https://api.checkpost.app` meant every
/// simulator failed with "can't reach Checkpost" until you happened to know
/// about a `--dart-define`, which is a bad first five minutes.
///
/// Override any of it explicitly:
/// ```
/// flutter run --dart-define=CHECKPOST_API_ORIGIN=http://192.168.1.20:4000
/// ```
abstract final class AppConfig {
  static const _apiOverride = String.fromEnvironment('CHECKPOST_API_ORIGIN');
  static const _webOverride = String.fromEnvironment('CHECKPOST_WEB_ORIGIN');

  static const productionApiOrigin = 'https://api.checkpost.app';
  static const productionWebOrigin = 'https://checkpost.app';

  /// The Android emulator reaches the host machine on 10.0.2.2. The iOS
  /// simulator, and every desktop target, share the host's loopback.
  static String get _localHost =>
      !kIsWeb && Platform.isAndroid ? '10.0.2.2' : 'localhost';

  static String get apiOrigin {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    return kReleaseMode ? productionApiOrigin : 'http://$_localHost:4000';
  }

  /// Where share links point. Only used when the server has not told us. The
  /// API returns the canonical URL with every token it mints.
  static String get webOrigin {
    if (_webOverride.isNotEmpty) return _webOverride;
    return kReleaseMode ? productionWebOrigin : 'http://$_localHost:5173';
  }

  static const apiVersion = 'v1';

  static Uri api(String path, [Map<String, String>? query]) {
    final base = Uri.parse(apiOrigin);
    return base.replace(
      path: '${base.path.replaceAll(RegExp(r'/+$'), '')}/$apiVersion$path',
      queryParameters: query,
    );
  }

  /// The realtime endpoint, on ws/wss to match the API's scheme.
  static Uri socket() {
    final http = api('/list/socket');
    return http.replace(scheme: http.scheme == 'https' ? 'wss' : 'ws');
  }
}
