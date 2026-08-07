/// Build-time configuration.
///
/// Override with `--dart-define`, e.g.
/// `flutter run --dart-define=CHECKPOST_API_ORIGIN=http://10.0.2.2:4000`
/// (10.0.2.2 is how the Android emulator reaches the host machine).
abstract final class AppConfig {
  static const apiOrigin = String.fromEnvironment(
    'CHECKPOST_API_ORIGIN',
    defaultValue: 'https://api.checkpost.app',
  );

  /// Where share links point. Only used when the server has not told us. The
  /// API returns the canonical URL with every token it mints.
  static const webOrigin = String.fromEnvironment(
    'CHECKPOST_WEB_ORIGIN',
    defaultValue: 'https://checkpost.app',
  );

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
