import 'dart:convert';

import 'package:checkpost/data/api_client.dart';
import 'package:checkpost/data/fractional_index.dart';
import 'package:checkpost/data/models.dart';
import 'package:checkpost/data/realtime.dart';
import 'package:checkpost/state/list_controller.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// One request as the fake server saw it, so a test can assert on what the
/// client sent and in what order.
typedef SeenRequest = ({String method, String path, Map<String, dynamic>? body});

/// An in-memory stand-in for the Checkpost API, wired in through `http`'s
/// MockClient so the tests exercise the real [CheckpostApi], with its headers,
/// its JSON and its error mapping, rather than a hand-rolled double.
///
/// It implements the same contract as `docs/API.md`, including the bits the
/// client's behaviour actually depends on: 410 for a replaced link, echoing
/// the actor back on change events, appending with a fractional index, and
/// for tags the parts that are easy to get subtly wrong: a name the list
/// already has answers 200 with the tag it has, a row is only ever given ids
/// of tags that exist, and deleting a tag strips it from every row in one
/// event.
class FakeServer {
  FakeServer({this.title = 'Test list'});

  final String title;

  String token = 'a' * 43;

  /// What the main token may do. Tests set it to render a read-only list.
  String access = 'admin';
  String listId = '11111111-1111-4111-8111-111111111111';
  int revision = 0;
  final List<Map<String, dynamic>> items = [];
  final List<Map<String, dynamic>> tags = [];
  final List<Map<String, dynamic>> events = [];

  /// Every list minted from the copy link, as `POST /list/copy` answered it.
  final List<Map<String, dynamic>> copies = [];

  /// Every request, in the order it arrived.
  final List<SeenRequest> log = [];

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
      CheckpostApi(clientId: clientId, httpClient: httpClient());

  /// The raw client, for a test that has to speak to an endpoint the app has
  /// no method for.
  http.Client httpClient() => MockClient(_handle);

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
    List<String> tagIds = const [],
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
      'tagIds': List<String>.of(tagIds),
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    };
    items.add(item);
    return item;
  }

  /// Puts a tag straight onto the list, as if it had been there all along.
  Map<String, dynamic> addTag(String name, {String? color, String? id}) {
    final tag = {
      'id':
          id ??
          '33333333-3333-4333-8333-${tags.length.toString().padLeft(12, '0')}',
      'listId': listId,
      'name': normaliseTagName(name),
      'color':
          color ??
          nextTagColor([
            for (final tag in tags) TagColor.parse(tag['color'] as String),
          ]).wire,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    };
    tags.add(tag);
    return tag;
  }

  Map<String, dynamic>? itemById(String id) {
    for (final item in items) {
      if (item['id'] == id) return item;
    }
    return null;
  }

  Map<String, dynamic>? tagNamed(String name) {
    final key = tagKey(name);
    for (final tag in tags) {
      if (tagKey(tag['name'] as String) == key) return tag;
    }
    return null;
  }

  List<String> tagIdsOf(String itemId) =>
      List<String>.from(itemById(itemId)!['tagIds'] as List);

  /// Records a change as if somebody else made it, so `GET /changes` returns it.
  void recordEvent(String type, Map<String, dynamic> data, {String? actor}) {
    revision++;
    _log(type, data, actor);
  }

  /// What every write does first, as `ListService.#mutate` does: bump the
  /// revision. A write that changed something also leaves an event, which is
  /// what `GET /changes` hands to everyone else. A write that changed nothing
  /// (a create that found the tag already there, a second delete) leaves the
  /// revision bumped and no event, exactly like the real one.
  void _commit(String? type, Map<String, dynamic>? data, String? actor) {
    revision++;
    if (type != null) _log(type, data ?? const {}, actor);
  }

  void _log(String type, Map<String, dynamic> data, String? actor) {
    events.add({
      'type': type,
      'revision': revision,
      'actor': actor,
      'at': '2026-01-01T00:00:00.000Z',
      // A copy, so later changes to a row do not rewrite history.
      'data': jsonDecode(jsonEncode(data)),
    });
  }

  /// The ids a request asked a row to carry, cut down to tags this list has,
  /// each once, in the order asked. Unknown ids are dropped rather than
  /// refused, as the real server does.
  List<String> _knownTagIds(Object? wanted) {
    final known = {for (final tag in tags) tag['id'] as String};
    final seen = <String>{};
    return [
      for (final id in (wanted as List?) ?? const [])
        if (known.contains(id) && seen.add(id as String)) id,
    ];
  }

  // ---------------------------------------------------------------------------

  Future<http.Response> _handle(http.Request request) async {
    requestCount++;
    if (offline) throw http.ClientException('offline');

    final path = request.url.path;
    final body = request.body.isEmpty
        ? null
        : (jsonDecode(request.body) as Map).cast<String, dynamic>();
    log.add((method: request.method, path: path, body: body));

    final failure = failNextStatus;
    if (failure != null) {
      failNextStatus = null;
      return _error(failure, failNextCode, failNextMessage);
    }

    final auth = request.headers['authorization'];
    final presented = auth?.replaceFirst('Bearer ', '');
    final actor = request.headers['x-checkpost-client'];

    if (path.endsWith('/lists') && request.method == 'POST') {
      _title = body!['title'] as String;
      return _json(201, {
        'list': listJson,
        'items': items,
        'tags': tags,
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

    // A copy link can do one thing, and it is the only link that can.
    if (path.endsWith('/list/copy')) {
      if (access != 'copy') {
        return _error(403, 'forbidden', 'This link is not a copy link.');
      }
      if (request.method == 'GET') {
        return _json(200, {'title': _title, 'itemCount': items.length});
      }
      return _json(201, _copy());
    }
    if (access == 'copy') {
      return _error(403, 'copy_link', 'This link makes you your own copy.');
    }

    if (path.endsWith('/list') && request.method == 'GET') {
      return _json(200, {
        'list': listJson,
        'items': items,
        'tags': tags,
        'access': access,
      });
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
      _title = body!['title'] as String;
      _commit('list.updated', {'title': _title}, actor);
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
      _commit('link.rotated', const {}, actor);
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
      _commit(removed.isEmpty ? null : 'item.deleted', {'ids': removed}, actor);
      return _json(200, {'removed': removed});
    }

    if (path.endsWith('/list/items') && request.method == 'POST') {
      final wanted = body!['tagIds'] as List?;
      if (wanted != null && wanted.length > Limits.tagsPerItem) {
        return _error(400, 'bad_request', 'tagIds: Too many tags.');
      }
      final id = body['id'] as String?;
      final existing = id == null ? null : itemById(id);
      if (existing != null) {
        // A retry: the row is already there, so nothing changes.
        _commit(null, null, actor);
        return _json(201, existing);
      }
      final item = addItem(
        body['text'] as String,
        id: id,
        tagIds: _knownTagIds(wanted),
      );
      _commit('item.created', {'item': item}, actor);
      return _json(201, item);
    }

    if (path.contains('/list/items/') && request.method == 'PATCH') {
      final id = path.split('/').last;
      final index = items.indexWhere((item) => item['id'] == id);
      if (index == -1) {
        return _error(404, 'not_found', 'That item is gone.');
      }
      final wanted = body!['tagIds'] as List?;
      if (wanted != null && wanted.length > Limits.tagsPerItem) {
        return _error(400, 'bad_request', 'tagIds: Too many tags.');
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
      if (body.containsKey('tagIds')) item['tagIds'] = _knownTagIds(wanted);
      // A move names its neighbours and the server works out the key, the same
      // way the real one does. Modelled here rather than stubbed, so a test of
      // reordering exercises the arithmetic instead of asserting that the
      // client sent what the client sent.
      if (body.containsKey('afterId') || body.containsKey('beforeId')) {
        final others = [
          for (final other in items)
            if (other['id'] != id) other,
        ]..sort(
          (a, b) => (a['position'] as String).compareTo(b['position'] as String),
        );
        final afterId = body['afterId'] as String?;
        final beforeId = body['beforeId'] as String?;

        String? lower;
        String? upper;
        if (afterId != null) {
          final at = others.indexWhere((other) => other['id'] == afterId);
          if (at == -1) {
            return _error(404, 'not_found', 'That neighbour is gone.');
          }
          lower = others[at]['position'] as String;
          upper = at + 1 < others.length
              ? others[at + 1]['position'] as String
              : null;
        } else if (beforeId != null) {
          final at = others.indexWhere((other) => other['id'] == beforeId);
          if (at == -1) {
            return _error(404, 'not_found', 'That neighbour is gone.');
          }
          lower = at > 0 ? others[at - 1]['position'] as String : null;
          upper = others[at]['position'] as String;
        } else {
          // beforeId: null means "put it first".
          upper = others.isEmpty ? null : others.first['position'] as String;
        }
        item['position'] = keyBetween(lower, upper);
      }
      items[index] = item;
      _commit('item.updated', {'item': item}, actor);
      return _json(200, item);
    }

    if (path.contains('/list/items/') && request.method == 'DELETE') {
      final id = path.split('/').last;
      final had = itemById(id) != null;
      items.removeWhere((item) => item['id'] == id);
      _commit(had ? 'item.deleted' : null, {'id': id}, actor);
      return http.Response('', 204);
    }

    if (path.endsWith('/list/tags') && request.method == 'POST') {
      final name = normaliseTagName(body!['name'] as String? ?? '');
      final problem = _nameProblem(name) ?? _colorProblem(body['color']);
      if (problem != null) return _error(400, 'bad_request', problem);

      // A retry with an id the list already has is the same tag.
      final id = body['id'] as String?;
      final retried = id == null
          ? null
          : tags.where((tag) => tag['id'] == id).firstOrNull;
      // And so is a name the list already has, whatever its case or spacing.
      final found = retried ?? tagNamed(name);
      if (found != null) {
        _commit(null, null, actor);
        return _json(200, found);
      }
      if (tags.length >= Limits.tagsPerList) {
        return _error(
          409,
          'limit_reached',
          'A list holds ${Limits.tagsPerList} tags. Delete one you are not '
              'using to make room.',
        );
      }
      final tag = addTag(name, color: body['color'] as String?, id: id);
      _commit('tag.created', {'tag': tag}, actor);
      return _json(201, tag);
    }

    if (path.contains('/list/tags/') && request.method == 'PATCH') {
      final id = path.split('/').last;
      final index = tags.indexWhere((tag) => tag['id'] == id);
      if (index == -1) {
        return _error(
          404,
          'not_found',
          'That tag is gone. Someone else deleted it.',
        );
      }
      final tag = Map<String, dynamic>.of(tags[index]);
      if (body!.containsKey('name')) {
        final name = normaliseTagName(body['name'] as String? ?? '');
        final problem = _nameProblem(name);
        if (problem != null) return _error(400, 'bad_request', problem);
        final clash = tags
            .where(
              (other) =>
                  other['id'] != id &&
                  tagKey(other['name'] as String) == tagKey(name),
            )
            .firstOrNull;
        // Refused rather than merged.
        if (clash != null) {
          return _error(
            400,
            'bad_request',
            'There is already a tag called “${clash['name']}”.',
          );
        }
        tag['name'] = name;
      }
      if (body.containsKey('color')) {
        final problem = _colorProblem(body['color']);
        if (problem != null) return _error(400, 'bad_request', problem);
        tag['color'] = body['color'];
      }
      tag['updatedAt'] = '2026-01-02T00:00:00.000Z';
      tags[index] = tag;
      _commit('tag.updated', {'tag': tag}, actor);
      return _json(200, tag);
    }

    if (path.contains('/list/tags/') && request.method == 'DELETE') {
      final id = path.split('/').last;
      final had = tags.any((tag) => tag['id'] == id);
      tags.removeWhere((tag) => tag['id'] == id);
      if (had) {
        // Off every row in the same breath, and one event says so.
        for (var i = 0; i < items.length; i++) {
          final ids = List<String>.from(items[i]['tagIds'] as List);
          if (ids.remove(id)) {
            items[i] = {...items[i], 'tagIds': ids};
          }
        }
      }
      _commit(had ? 'tag.deleted' : null, {'id': id}, actor);
      return http.Response('', 204);
    }

    return _error(404, 'not_found', 'No such endpoint.');
  }

  String? _nameProblem(String name) {
    if (name.isEmpty) return 'name: A tag needs a name.';
    if (name.length > Limits.tagName) {
      return 'name: String must contain at most ${Limits.tagName} '
          'character(s)';
    }
    return null;
  }

  String? _colorProblem(Object? color) {
    if (color == null) return null;
    return TagColor.values.any((known) => known.wire == color)
        ? null
        : 'color: Invalid enum value.';
  }

  /// A new list with the same title and rows, all unchecked, and new copies
  /// of the tags that the copied rows wear.
  Map<String, dynamic> _copy() {
    final n = copies.length;
    final copyId = '44444444-4444-4444-8444-${n.toString().padLeft(12, '0')}';
    final renamed = <String, String>{};
    final copiedTags = [
      for (final (index, tag) in tags.indexed)
        {
          ...tag,
          'id': renamed[tag['id'] as String] =
              '55555555-5555-4555-8555-${(n * 100 + index).toString().padLeft(12, '0')}',
          'listId': copyId,
        },
    ];
    final copiedItems = [
      for (final (index, item) in items.indexed)
        {
          ...item,
          'id':
              '66666666-6666-4666-8666-${(n * 1000 + index).toString().padLeft(12, '0')}',
          'listId': copyId,
          'checked': false,
          'checkedAt': null,
          'tagIds': [
            for (final id in item['tagIds'] as List) ?renamed[id],
          ],
        },
    ];
    final copyToken = String.fromCharCodes(
      List.generate(43, (i) => 'c'.codeUnitAt(0) + ((i + n) % 20)),
    );
    final made = {
      'list': {...listJson, 'id': copyId, 'revision': 0},
      'items': copiedItems,
      'tags': copiedTags,
      'token': copyToken,
      'url': 'https://checkpost.app/l/$copyToken',
    };
    copies.add(made);
    return made;
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
  List<String> tagIds = const [],
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
  tagIds: tagIds,
);

/// A [RealtimeFactory] that opens no socket at all.
///
/// Widget and golden tests must not dial a real server: it would leave
/// reconnect timers pending after the tree is torn down, and make every
/// assertion depend on the network. Changes still arrive, via reconcile.
RealtimeClient? noRealtime(String token) => null;
