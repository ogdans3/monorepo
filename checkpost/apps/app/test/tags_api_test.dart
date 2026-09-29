import 'dart:convert';

import 'package:checkpost/data/api_client.dart';
import 'package:checkpost/data/models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

/// The tag half of the API client, against the fake server. These are also
/// what keeps the fake honest: every widget and controller test about tags
/// leans on it behaving like `docs/API.md` says the real one does.
void main() {
  late FakeServer server;
  late CheckpostApi api;

  setUp(() {
    server = FakeServer();
    api = server.client();
  });

  List<String> eventTypes([int since = 0]) => [
    for (final event in server.events)
      if ((event['revision'] as int) > since) event['type'] as String,
  ];

  group('making a tag', () {
    test('a new name is a new tag, with the colour it was sent', () async {
      final made = await api.createTag(
        server.token,
        id: '77777777-7777-4777-8777-000000000001',
        name: '  Garden   shed ',
        color: TagColor.plum,
      );

      expect(made.id, '77777777-7777-4777-8777-000000000001');
      expect(made.name, 'Garden shed');
      expect(made.color, TagColor.plum);
      expect(eventTypes(), ['tag.created']);
      expect(server.events.single['actor'], 'test-device');
    });

    test('left without a colour, it gets the least used one', () async {
      server
        ..addTag('Kitchen', color: 'clay')
        ..addTag('Bath', color: 'teal');
      final made = await api.createTag(server.token, name: 'Garden');
      expect(made.color, TagColor.ochre);
    });

    test('a name the list already has answers with the tag it has', () async {
      final kitchen = server.addTag('Kitchen');
      final before = server.revision;

      final found = await api.createTag(
        server.token,
        id: '77777777-7777-4777-8777-000000000002',
        name: 'KITCHEN ',
      );

      // The id to tag rows with is the one that came back, not the one sent.
      expect(found.id, kitchen['id']);
      expect(server.tags, hasLength(1));
      // Not a change, so nobody is told, though the revision still moves.
      expect(eventTypes(before), isEmpty);
      expect(server.revision, before + 1);
    });

    test('folds letters outside ASCII the way the server does', () async {
      final first = await api.createTag(server.token, name: 'Ønsker');
      final again = await api.createTag(server.token, name: 'ønsker');
      expect(again.id, first.id);
    });

    test('a retry with the same id is the same tag', () async {
      const id = '77777777-7777-4777-8777-000000000003';
      final first = await api.createTag(server.token, id: id, name: 'Frozen');
      final retried = await api.createTag(server.token, id: id, name: 'Frozen');
      expect(retried.id, first.id);
      expect(server.tags, hasLength(1));
    });

    test('holds a list to fifty', () async {
      for (var i = 0; i < Limits.tagsPerList; i++) {
        server.addTag('Tag $i');
      }
      await expectLater(
        api.createTag(server.token, name: 'One more'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.code, 'code', 'limit_reached')
              .having((error) => error.status, 'status', 409),
        ),
      );
      // Finding one it already has is still fine at the limit.
      final found = await api.createTag(server.token, name: 'tag 0');
      expect(found.name, 'Tag 0');
    });

    test('needs a link that can write', () async {
      server.access = 'read';
      await expectLater(
        api.createTag(server.token, name: 'Nope'),
        throwsA(
          isA<ApiException>().having((e) => e.isForbidden, 'forbidden', true),
        ),
      );
    });
  });

  group('changing a tag', () {
    test('renames and recolours, and says so in one event each', () async {
      final veg = server.addTag('Veg');
      final renamed = await api.updateTag(
        server.token,
        veg['id'] as String,
        name: 'Vegetables',
      );
      final recoloured = await api.updateTag(
        server.token,
        veg['id'] as String,
        color: TagColor.olive,
      );

      expect(renamed.name, 'Vegetables');
      expect(recoloured.color, TagColor.olive);
      expect(eventTypes(), ['tag.updated', 'tag.updated']);
    });

    test('refuses a name another tag has, rather than merging', () async {
      server.addTag('Bread');
      final cakes = server.addTag('cakes');
      await expectLater(
        api.updateTag(server.token, cakes['id'] as String, name: 'BREAD'),
        throwsA(
          isA<ApiException>().having(
            (error) => error.message,
            'message',
            'There is already a tag called “Bread”.',
          ),
        ),
      );
      // Its own name in another case is fine.
      final recased = await api.updateTag(
        server.token,
        cakes['id'] as String,
        name: 'Cakes',
      );
      expect(recased.name, 'Cakes');
    });
  });

  group('tags on a row', () {
    test('a row is made with the tags it was sent', () async {
      final dairy = server.addTag('Dairy');
      final made = await api.createItem(
        server.token,
        id: '88888888-8888-4888-8888-000000000001',
        text: 'Butter',
        tagIds: [dairy['id'] as String],
      );
      expect(made.tagIds, [dairy['id']]);
    });

    test('an update sets the whole set, dropping ids the list lacks', () async {
      final mine = server.addTag('Mine');
      final row = server.addItem('Row');
      final updated = await api.updateItem(
        server.token,
        row['id'] as String,
        tagIds: [
          '99999999-9999-4999-8999-000000000000',
          mine['id'] as String,
          mine['id'] as String,
        ],
      );
      expect(updated.tagIds, [mine['id']]);

      final cleared = await api.updateItem(
        server.token,
        row['id'] as String,
        tagIds: const [],
      );
      expect(cleared.tagIds, isEmpty);
    });

    test('holds a row to ten', () async {
      final ids = [
        for (var i = 0; i <= Limits.tagsPerItem; i++)
          server.addTag('T$i')['id'] as String,
      ];
      final row = server.addItem('Busy row');
      await expectLater(
        api.updateItem(server.token, row['id'] as String, tagIds: ids),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 400)),
      );
      final ok = await api.updateItem(
        server.token,
        row['id'] as String,
        tagIds: ids.take(Limits.tagsPerItem).toList(),
      );
      expect(ok.tagIds, hasLength(Limits.tagsPerItem));
    });
  });

  group('deleting a tag', () {
    test('takes it off every row, in one event', () async {
      final doomed = server.addTag('Doomed');
      final kept = server.addTag('Kept');
      final a = server.addItem('A', tagIds: [doomed['id'], kept['id']].cast());
      final b = server.addItem('B', tagIds: [doomed['id'] as String]);
      final before = server.revision;

      await api.deleteTag(server.token, doomed['id'] as String);

      expect(server.tags.map((tag) => tag['name']), ['Kept']);
      expect(server.tagIdsOf(a['id'] as String), [kept['id']]);
      expect(server.tagIdsOf(b['id'] as String), isEmpty);
      expect(eventTypes(before), ['tag.deleted']);
      expect(server.events.last['data'], {'id': doomed['id']});
    });

    test('is not an error the second time', () async {
      final once = server.addTag('Once');
      await api.deleteTag(server.token, once['id'] as String);
      await api.deleteTag(server.token, once['id'] as String);
      expect(eventTypes().where((type) => type == 'tag.deleted'), hasLength(1));
    });
  });

  test('a snapshot carries the tags, and the rows carry their ids', () async {
    final kitchen = server.addTag('Kitchen', color: 'sage');
    server.addItem('Kettle', tagIds: [kitchen['id'] as String]);

    final snapshot = await api.snapshot(server.token);
    expect(snapshot.tags.single.name, 'Kitchen');
    expect(snapshot.tags.single.color, TagColor.sage);
    expect(snapshot.items.single.tagIds, [kitchen['id']]);
  });

  test('the change feed hands over tag events with their revisions', () async {
    await api.createTag(server.token, name: 'Kitchen');
    final changes = await api.changesSince(server.token, 0);
    final events = (changes as ChangesEvents).events;
    expect(events.single.type, ChangeType.tagCreated);
    expect(events.single.revision, server.revision);
  });

  test(
    'a copy brings its own copies of the tags, worn by the copied rows',
    () async {
      final room = server.addTag('Bedroom', color: 'iris');
      server.addItem('Sheets', checked: true, tagIds: [room['id'] as String]);
      server.access = 'copy';

      final response = await server.httpClient().post(
        Uri.parse('http://localhost/v1/list/copy'),
        headers: {'authorization': 'Bearer ${server.token}'},
      );
      expect(response.statusCode, 201);
      final copy = jsonDecode(response.body) as Map<String, dynamic>;
      final tags = (copy['tags'] as List).cast<Map<String, dynamic>>();
      final items = (copy['items'] as List).cast<Map<String, dynamic>>();

      expect(tags.single['name'], 'Bedroom');
      expect(tags.single['color'], 'iris');
      expect(tags.single['id'], isNot(room['id']));
      expect(items.single['tagIds'], [tags.single['id']]);
      // Nothing comes over ticked.
      expect(items.single['checked'], isFalse);

      // And the copy link still cannot read the list it came from.
      final refused = await server.httpClient().get(
        Uri.parse('http://localhost/v1/list'),
        headers: {'authorization': 'Bearer ${server.token}'},
      );
      expect(refused.statusCode, 403);
      expect((jsonDecode(refused.body) as Map)['error']['code'], 'copy_link');
    },
  );

  test('an older server with no tags at all still parses', () {
    final snapshot = Snapshot.fromJson({
      'list': {
        'id': 'l',
        'title': 'Old',
        'revision': 1,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      },
      'items': [
        {
          'id': 'i',
          'listId': 'l',
          'text': 'Row',
          'note': '',
          'checked': false,
          'checkedAt': null,
          'position': 'a0',
          'createdAt': '2026-01-01T00:00:00.000Z',
          'updatedAt': '2026-01-01T00:00:00.000Z',
        },
      ],
      'access': 'write',
    });
    expect(snapshot.tags, isEmpty);
    expect(snapshot.items.single.tagIds, isEmpty);
  });
}
