import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// The server said no, and said why in a sentence meant for a person.
class ApiException implements Exception {
  ApiException(this.code, this.message);

  final String code;
  final String message;

  bool get isUnauthorized => code == 'unauthorized';

  @override
  String toString() => message;
}

/// The network could not be reached at all, which is a different thing from
/// being refused and is never shown as an error.
class OfflineException implements Exception {
  const OfflineException();
}

/// The API, which the app can live without.
///
/// Every method here is optional to the product: taps are written locally and
/// are already true before any of this is called. Nothing in the UI waits on it.
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      // Same origin as the page. The Flutter build and this API are served by
      // one process, which is why there is no origin to configure and no CORS.
      _base = baseUrl ?? const String.fromEnvironment('API_BASE', defaultValue: '');

  final http.Client _client;
  final String _base;

  Uri _url(String path) => Uri.parse('$_base/api$path');

  Future<Map<String, Object?>> _send(
    String method,
    String path, {
    String? token,
    Map<String, Object?>? body,
  }) async {
    final request = http.Request(method, _url(path));
    if (token != null) request.headers['authorization'] = 'Bearer $token';
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request));
    } catch (_) {
      throw const OfflineException();
    }

    if (response.statusCode == 204 || response.body.isEmpty) return const {};

    Map<String, Object?> decoded;
    try {
      decoded = jsonDecode(response.body) as Map<String, Object?>;
    } catch (_) {
      throw ApiException('internal', 'Something broke on our side. Try again.');
    }

    if (response.statusCode >= 400) {
      final error = decoded['error'];
      if (error is Map) {
        throw ApiException(
          error['code'] as String? ?? 'internal',
          error['message'] as String? ?? 'Something broke on our side. Try again.',
        );
      }
      throw ApiException('internal', 'Something broke on our side. Try again.');
    }
    return decoded;
  }

  Future<({String token, String username})> register(String username, String password) async {
    final made = await _send('POST', '/register', body: {
      'username': username,
      'password': password,
    });
    return _session(made);
  }

  Future<({String token, String username})> login(String username, String password) async {
    final made = await _send('POST', '/login', body: {
      'username': username,
      'password': password,
    });
    return _session(made);
  }

  ({String token, String username}) _session(Map<String, Object?> body) {
    final token = body['token'] as String?;
    final user = body['user'] as Map<String, Object?>?;
    final username = user?['username'] as String?;
    if (token == null || username == null) {
      throw ApiException('internal', 'Something broke on our side. Try again.');
    }
    return (token: token, username: username);
  }

  Future<void> logout(String token) => _send('POST', '/logout', token: token);

  Future<void> deleteAccount(String token) => _send('DELETE', '/me', token: token);

  /// Pushes a batch. The ids came from the device, so sending one twice is safe.
  Future<void> push(String token, List<Tap> taps) => _send(
    'POST',
    '/choices',
    token: token,
    body: {'choices': [for (final tap in taps) tap.toWire()]},
  );

  /// Everything the account has. Runs when somebody signs in on a second
  /// device, and almost never again.
  Future<List<Tap>> pull(String token) async {
    final body = await _send('GET', '/choices', token: token);
    final raw = body['choices'];
    if (raw is! List) return const [];
    final taps = <Tap>[];
    for (final entry in raw) {
      if (entry is! Map) continue;
      final tap = Tap.fromWire(entry.cast<String, Object?>());
      if (tap != null) taps.add(tap);
    }
    return taps;
  }
}
