import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

/// Something the user is meant to read. The API writes its messages for a
/// person, so they are shown verbatim rather than translated into our own
/// guess at what went wrong.
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});

  final String code;
  final String message;
  final int? status;

  /// This link never worked.
  bool get isInvalidLink => code == 'unauthorized';

  /// This link was replaced, or the list was deleted.
  bool get isGone => code == 'gone';

  /// A real link, but not one allowed to do this.
  bool get isForbidden => code == 'forbidden';

  /// A template link. It mints copies and cannot open the list it came from.
  bool get isCopyLink => code == 'copy_link';

  bool get isRateLimited => code == 'too_many_requests';

  @override
  String toString() => message;
}

/// The device could not reach the server, as opposed to the server saying no.
class OfflineException implements Exception {
  OfflineException([this.cause]);
  final Object? cause;

  @override
  String toString() => 'Offline';
}

/// What to tell someone when the server cannot be reached.
///
/// A debug build names the origin it tried. "Check your connection" is useless
/// advice when the real answer is that the API is not running, or that this
/// build is pointed at the wrong host, and that is nearly always the case
/// while developing. Release builds keep the plain sentence.
String offlineMessage([String nextStep = 'Check your connection.']) =>
    kDebugMode
    ? 'Can’t reach the API at ${AppConfig.apiOrigin}. Is it running?'
    : 'Can’t reach Checkpost right now. $nextStep';

/// Everything the app knows how to ask the server.
///
/// One share token per client instance: the token *is* the list, so there is
/// no list id in any of these calls.
class CheckpostApi {
  CheckpostApi({required this.clientId, http.Client? httpClient})
    : _http = httpClient ?? http.Client();

  /// Opaque, per-install. Sent on every write so the change feed can tell us
  /// which events we caused ourselves.
  final String clientId;
  final http.Client _http;

  static const _timeout = Duration(seconds: 15);

  void close() => _http.close();

  Map<String, String> _headers(String? token, {bool json = false}) => {
    if (token != null) 'authorization': 'Bearer $token',
    'x-checkpost-client': clientId,
    if (json) 'content-type': 'application/json',
    'accept': 'application/json',
  };

  Future<dynamic> _send(
    String method,
    Uri url, {
    String? token,
    Map<String, dynamic>? body,
  }) async {
    final request = http.Request(method, url)
      ..headers.addAll(_headers(token, json: body != null));
    if (body != null) request.body = jsonEncode(body);

    http.Response response;
    try {
      final streamed = await _http.send(request).timeout(_timeout);
      response = await http.Response.fromStream(streamed);
    } on TimeoutException catch (error) {
      throw OfflineException(error);
    } on SocketException catch (error) {
      throw OfflineException(error);
    } on http.ClientException catch (error) {
      throw OfflineException(error);
    }

    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 400) {
        throw ApiException(
          'internal',
          'Something broke on our side. Try again.',
          status: response.statusCode,
        );
      }
      return null;
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode >= 400) {
      final error = (decoded is Map ? decoded['error'] : null) as Map?;
      throw ApiException(
        (error?['code'] as String?) ?? 'internal',
        (error?['message'] as String?) ??
            'Something broke on our side. Try again.',
        status: response.statusCode,
      );
    }
    return decoded;
  }

  // ---------------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------------

  Future<({Snapshot snapshot, String token, String url})> createList(
    String title, {
    List<String>? items,
  }) async {
    final json =
        await _send(
              'POST',
              AppConfig.api('/lists'),
              body: {
                'title': title,
                if (items != null && items.isNotEmpty) 'items': items,
              },
            )
            as Map<String, dynamic>;
    return (
      snapshot: Snapshot.fromJson({
        'list': json['list'],
        'items': json['items'],
      }),
      token: json['token'] as String,
      url: json['url'] as String,
    );
  }

  Future<Snapshot> snapshot(String token) async {
    final json = await _send('GET', AppConfig.api('/list'), token: token);
    return Snapshot.fromJson(json as Map<String, dynamic>);
  }

  Future<Changes> changesSince(String token, int since) async {
    final json = await _send(
      'GET',
      AppConfig.api('/list/changes', {'since': '$since'}),
      token: token,
    );
    return Changes.fromJson(json as Map<String, dynamic>);
  }

  Future<Checklist> renameList(String token, String title) async {
    final json = await _send(
      'PATCH',
      AppConfig.api('/list'),
      token: token,
      body: {'title': title},
    );
    return Checklist.fromJson(json as Map<String, dynamic>);
  }

  Future<void> deleteList(String token) =>
      _send('DELETE', AppConfig.api('/list'), token: token);

  Future<({String token, String url})> rotateLink(String token) async {
    final json =
        await _send('POST', AppConfig.api('/list/rotate'), token: token)
            as Map<String, dynamic>;
    return (token: json['token'] as String, url: json['url'] as String);
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  Future<ChecklistItem> createItem(
    String token, {
    required String id,
    required String text,
    String? afterId,
    Object? beforeId = _absent,
  }) async {
    final json = await _send(
      'POST',
      AppConfig.api('/list/items'),
      token: token,
      body: {
        // The id is ours, so a retry updates nothing and returns the item that
        // already exists rather than creating a twin.
        'id': id,
        'text': text,
        'afterId': ?afterId,
        if (beforeId != _absent) 'beforeId': beforeId,
      },
    );
    return ChecklistItem.fromJson(json as Map<String, dynamic>);
  }

  Future<ChecklistItem> updateItem(
    String token,
    String itemId, {
    String? text,
    String? note,
    bool? checked,
    String? afterId,
    Object? beforeId = _absent,
  }) async {
    final json = await _send(
      'PATCH',
      AppConfig.api('/list/items/$itemId'),
      token: token,
      body: {
        'text': ?text,
        'note': ?note,
        'checked': ?checked,
        'afterId': ?afterId,
        if (beforeId != _absent) 'beforeId': beforeId,
      },
    );
    return ChecklistItem.fromJson(json as Map<String, dynamic>);
  }

  Future<void> deleteItem(String token, String itemId) =>
      _send('DELETE', AppConfig.api('/list/items/$itemId'), token: token);

  Future<List<String>> clearChecked(String token) async {
    final json = await _send(
      'POST',
      AppConfig.api('/list/items/clear-checked'),
      token: token,
    );
    return [
      for (final id in (json as Map<String, dynamic>)['removed'] as List)
        id as String,
    ];
  }
}

const _absent = Object();

/// Exponential backoff with jitter, capped. Used by the realtime client and by
/// the reconnect-and-reconcile path.
Duration backoff(int attempt, {Duration max = const Duration(seconds: 30)}) {
  final base = min(1000 * pow(2, attempt).toInt(), max.inMilliseconds);
  final jitter = Random().nextInt((base ~/ 3) + 1);
  return Duration(milliseconds: (base ~/ 2) + jitter);
}
