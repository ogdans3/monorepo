import 'dart:convert';

import 'package:checkpost/data/api_client.dart';
import 'package:checkpost/data/fractional_index.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/data/realtime.dart';
import 'package:checkpost/state/list_controller.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// An in-memory stand-in for the Checkpost API, wired in through `http`'s
/// MockClient so the tests exercise the real [CheckpostApi], with its headers,
/// its JSON and its error mapping, rather than a hand-rolled double.
///
/// It implements the same contract as `docs/API.md`, including the bits the
/// client's behaviour actually depends on: 410 for a replaced link, echoing
/// the actor back on change events, and appending with a fractional index.
class FakeServer {
  FakeServer({this.title = 'Test list'});

  final String title;

  String token = 'a' * 43;

  /// What the main token may do. Tests set it to render a read-only list.
  String access = 'admin';
  String listId = '11111111-1111-4111-8111-111111111111';
  int revision = 0;
  final List<Map<String, dynamic>> items = [];
  final List<Map<String, dynamic>> events = [];

  /// Set to make the next call fail the way the server would.
  int? failNextStatus;
  String failNextCode = 'internal';
  String failNextMessage = 'Something broke on our side. Try again.';

  /// Set to make every call look like a dead connection.
  bool offline = false;

  /// Tokens that used to work. They answer 410, not 401. The difference is
  /// what lets the app say "this link was replaced".
  final Set<String> revoked = {};

  int requestCount = 0;

  CheckpostApi client({String clientId = 'test-device'}) =>
      CheckpostApi(clientId: clientId, httpClient: MockClient(_handle));

  // ---------------------------------------------------------------------------

  Map<String, dynamic> get listJson => {
    'id': listId,
    'title': _title,
    'revision': revision,
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
  };

  late String _title = title;

  Map<String, dynamic> addItem(
    String text, {
    bool checked = false,
    String? id,
    String note = '',
  }) {
    final item = {
      'id':
          id ??
          '22222222-2222-4222-8222-${items.length.toString().padLeft(12, '0')}',
      'listId': listId,
      'text': text,
      'note': note,
      'checked': checked,
      'checkedAt': checked ? '2026-01-01T00:00:00.000Z' : null,
      'position': keyBetween(
        items.isEmpty ? null : items.last['position'] as String,
        null,
      ),
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    };
    items.add(item);
    return item;
  }

  /// Records a change as if somebody else made it, so `GET /changes` returns it.
  void recordEvent(String type, Map<String, dynamic> data, {String? actor}) {
    revision++;
    events.add({
      'type': type,
      'revision': revision,
      'actor': actor,
      'at': '2026-01-01T00:00:00.000Z',
      'data': data,
    });
  }

  // ---------------------------------------------------------------------------

  Future<http.Response> _handle(http.Request request) async {
    requestCount++;
    if (offline) throw http.ClientException('offline');

    final failure = failNextStatus;
    if (failure != null) {
      failNextStatus = null;
      return _error(failure, failNextCode, failNextMessage);
    }

    final path = request.url.path;
    final auth = request.headers['authorization'];
    final presented = auth?.replaceFirst('Bearer ', '');

    if (path.endsWith('/lists') && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      _title = body['title'] as String;
      return _json(201, {
        'list': listJson,
        'items': items,
        'token': token,
        'url': 'https://checkpost.app/l/$token',
      });
    }

    if (presented == null) {
      return _error(
        401,
        'unauthorized',
        'This request needs a valid share link.',
      );
    }
    if (revoked.contains(presented)) {
      return _error(
        410,
        'gone',
        'This link was replaced. Ask whoever shared it for the new one.',
      );
    }
    if (presented != token) {
      return _error(401, 'unauthorized', 'That link is not valid.');
    }

    if (path.endsWith('/list') && request.method == 'GET') {
      if (access == 'copy') {
        return _error(403, 'copy_link', 'This link makes you your own copy.');
      }
      return _json(200, {'list': listJson, 'items': items, 'access': access});
    }

    // Everything past here changes something, so a read link is refused the
    // same way the real API refuses it.
    if (access == 'read' && request.method != 'GET') {
      return _error(403, 'forbidden', 'This link can only look at the list.');
    }

    if (path.endsWith('/list/changes')) {
      final since =
          int.tryParse(request.url.queryParameters['since'] ?? '0') ?? 0;
      return _json(200, {
        'kind': 'events',
        'revision': revision,
        'events': [
          for (final event in events)
            if ((event['revision'] as int) > since) event,
        ],
      });
    }

    if (path.endsWith('/list') && request.method == 'PATCH') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      _title = body['title'] as String;
      revision++;
      return _json(200, listJson);
    }

    if (path.endsWith('/list') && request.method == 'DELETE') {
      revoked.add(token);
      return http.Response('', 204);
    }

    if (path.endsWith('/list/rotate')) {
      revoked.add(token);
      token = String.fromCharCodes(
        List.generate(43, (i) => 'b'.codeUnitAt(0) + (i % 20)),
      );
      revision++;
      return _json(200, {
        'token': token,
        'url': 'https://checkpost.app/l/$token',
      });
    }

    if (path.endsWith('/list/items/clear-checked')) {
      final removed = [
        for (final item in items)
          if (item['checked'] == true) item['id'] as String,
      ];
      items.removeWhere((item) => item['checked'] == true);
      revision++;
      return _json(200, {'removed': removed});
    }

    if (path.endsWith('/list/items') && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final item = addItem(body['text'] as String, id: body['id'] as String?);
      revision++;
      return _json(201, item);
    }

    if (path.contains('/list/items/') && request.method == 'PATCH') {
      final id = path.split('/').last;
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final index = items.indexWhere((item) => item['id'] == id);
      if (index == -1) {
        return _error(404, 'not_found', 'That item is gone.');
      }
      final item = Map<String, dynamic>.of(items[index]);
      if (body.containsKey('text')) item['text'] = body['text'];
      if (body.containsKey('note')) item['note'] = body['note'];
      if (body.containsKey('checked')) {
        item['checked'] = body['checked'];
        item['checkedAt'] = body['checked'] == true
            ? '2026-01-02T00:00:00.000Z'
            : null;
      }
      items[index] = item;
      revision++;
      return _json(200, item);
    }

    if (path.contains('/list/items/') && request.method == 'DELETE') {
      final id = path.split('/').last;
      items.removeWhere((item) => item['id'] == id);
      revision++;
      return http.Response('', 204);
    }

    return _error(404, 'not_found', 'No such endpoint.');
  }

  http.Response _json(int status, Object body) => http.Response(
    jsonEncode(body),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );

  http.Response _error(int status, String code, String message) =>
      _json(status, {
        'error': {'code': code, 'message': message},
      });
}

/// Builds a `ChecklistItem` without needing a server.
ChecklistItem itemOf({
  required String id,
  required String text,
  bool checked = false,
  String position = 'a0',
  String note = '',
}) => ChecklistItem(
  id: id,
  listId: 'list',
  text: text,
  note: note,
  checked: checked,
  checkedAt: checked ? DateTime(2026) : null,
  position: position,
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
);

/// A [RealtimeFactory] that opens no socket at all.
///
/// Widget and golden tests must not dial a real server: it would leave
/// reconnect timers pending after the tree is torn down, and make every
/// assertion depend on the network. Changes still arrive, via reconcile.
RealtimeClient? noRealtime(String token) => null;
