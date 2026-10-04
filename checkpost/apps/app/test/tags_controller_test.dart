import 'package:checkpost/data/models.dart';
import 'package:checkpost/data/view_store.dart';
import 'package:checkpost/state/list_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

void main() {
  late FakeServer server;

  setUp(() => server = FakeServer());

  ListController controllerFor(FakeServer server, {DeviceViewStore? views}) {
    final controller = ListController(
      api: server.client(),
      token: server.token,
      realtimeFactory: noRealtime,
      views: views,
      listId: server.listId,
    );
    addTearDown(controller.dispose);
    return controller;
  }

  List<SeenRequest> writes() => [
    for (final request in server.log)
      if (request.method != 'GET') request,
  ];

  group('a new tag on a row', () {
    test('is on the row at once, in the colour it will keep', () async {
      server
        ..addTag('Bath', color: 'clay')
        ..addItem('Soap');
      final controller = controllerFor(server);
      await controller.load();
      final soap = controller.items.single;

      final pending = controller.addTagToItem(soap, 'Kitchen');

      // No await: the chip is there in the frame the finger lifts.
      final made = controller.tagNamed('Kitchen')!;
      expect(made.color, TagColor.teal, reason: 'clay is taken, teal is next');
      expect(controller.tagsOf(controller.items.single).map((t) => t.name), [
        'Kitchen',
      ]);

      await pending;
      // The colour was chosen here and sent, not left to the server.
      final create = writes().firstWhere((r) => r.path.endsWith('/list/tags'));
      expect(create.body!['color'], 'teal');
      expect(server.tagNamed('Kitchen')!['color'], 'teal');
    });

    test('is made first, and the row is told afterwards, with the id the '
        'server kept', () async {
      final soap = server.addItem('Soap');
      final controller = controllerFor(server);
      await controller.load();

      // Somebody else made "Kitchen" a moment ago, and this device has not
      // heard about it yet.
      final theirs = server.addTag('Kitchen');

      await controller.addTagToItem(controller.items.single, 'kitchen ');

      final paths = [for (final r in writes()) '${r.method} ${r.path}'];
      expect(paths, [
        'POST /v1/list/tags',
        'PATCH /v1/list/items/${soap['id']}',
      ]);
      // The row is tagged with their tag, not with an id the server never kept.
      expect(writes().last.body!['tagIds'], [theirs['id']]);
      expect(server.tagIdsOf(soap['id'] as String), [theirs['id']]);
      expect(controller.tags.map((tag) => tag.id), [theirs['id']]);
      expect(controller.items.single.tagIds, [theirs['id']]);
    });

    test('puts on the tag the list already has, making nothing', () async {
      final bath = server.addTag('Bath');
      server.addItem('Soap');
      final controller = controllerFor(server);
      await controller.load();

      await controller.addTagToItem(controller.items.single, '  BATH ');

      expect(writes().map((r) => r.method), ['PATCH']);
      expect(controller.items.single.tagIds, [bath['id']]);
      expect(controller.tags, hasLength(1));
    });

    test(
      'comes off again, said out loud, when the server refuses it',
      () async {
        for (var i = 0; i < Limits.tagsPerList - 1; i++) {
          server.addTag('Tag $i');
        }
        server.addItem('Soap');
        final controller = controllerFor(server);
        await controller.load();
        final messages = <String>[];
        controller.messages.listen(messages.add);
        // The fiftieth, made elsewhere, so this device thinks there is room.
        server.addTag('Tag 49');

        await controller.addTagToItem(controller.items.single, 'One more');
        await Future<void>.delayed(Duration.zero);

        expect(controller.tagNamed('One more'), isNull);
        expect(controller.items.single.tagIds, isEmpty);
        expect(writes().where((r) => r.method == 'PATCH'), isEmpty);
        expect(messages.single, contains('50 tags'));
      },
    );
  });

  group('tags on a row', () {
    test(
      'taps made while one write is out go in the next one, together',
      () async {
        final a = server.addTag('A');
        final b = server.addTag('B');
        final c = server.addTag('C');
        final row = server.addItem('Row');
        final controller = controllerFor(server);
        await controller.load();
        Tag tag(Map<String, dynamic> json) => controller.tagById(json['id'])!;

        final first = controller.toggleItemTag(controller.items.single, tag(a));
        // Let the first write leave, then tap twice more while it is out.
        await Future<void>.delayed(Duration.zero);
        final second = controller.toggleItemTag(
          controller.items.single,
          tag(b),
        );
        final third = controller.toggleItemTag(controller.items.single, tag(c));
        expect(controller.items.single.tagIds, [a['id'], b['id'], c['id']]);
        await Future.wait([first, second, third]);

        final patches = [
          for (final r in writes())
            if (r.method == 'PATCH') r.body!['tagIds'],
        ];
        expect(patches, [
          [a['id']],
          [a['id'], b['id'], c['id']],
        ]);
        expect(server.tagIdsOf(row['id'] as String), [
          a['id'],
          b['id'],
          c['id'],
        ]);
        expect(controller.items.single.tagIds, [a['id'], b['id'], c['id']]);
      },
    );

    test('a refused write puts the row back as the server has it', () async {
      final a = server.addTag('A');
      server.addItem('Row');
      final controller = controllerFor(server);
      await controller.load();

      server
        ..failNextStatus = 404
        ..failNextCode = 'not_found'
        ..failNextMessage = 'That item is gone. Someone else removed it.';
      await controller.toggleItemTag(
        controller.items.single,
        controller.tagById(a['id'] as String)!,
      );

      expect(controller.items.single.tagIds, isEmpty);
    });

    test('stops at ten', () async {
      final ids = [
        for (var i = 0; i <= Limits.tagsPerItem; i++)
          server.addTag('T$i')['id'] as String,
      ];
      server.addItem('Row', tagIds: ids.take(Limits.tagsPerItem).toList());
      final controller = controllerFor(server);
      await controller.load();

      await controller.toggleItemTag(
        controller.items.single,
        controller.tagById(ids.last)!,
      );
      await controller.addTagToItem(controller.items.single, 'Eleventh');

      expect(controller.items.single.tagIds, hasLength(Limits.tagsPerItem));
      expect(controller.tagNamed('Eleventh'), isNull);
      expect(writes(), isEmpty);
    });

    test(
      'a tick from a sheet opened before the tags changed keeps them',
      () async {
        final a = server.addTag('A');
        server.addItem('Row');
        final controller = controllerFor(server);
        await controller.load();
        // What the item sheet holds: the row as it was when it opened.
        final stale = controller.items.single;

        await controller.toggleItemTag(stale, controller.tagById(a['id'])!);
        await controller.toggle(stale);
        await controller.editItem(stale, note: 'The big one');

        final row = controller.items.single;
        expect(row.checked, isTrue);
        expect(row.note, 'The big one');
        expect(row.tagIds, [a['id']]);
      },
    );

    test('a sheet saved with nothing changed but its tags sends nothing more',
        () async {
      final a = server.addTag('A');
      server.addItem('Row');
      final controller = controllerFor(server);
      await controller.load();
      final stale = controller.items.single;

      await controller.toggleItemTag(stale, controller.tagById(a['id'])!);
      final tagged = writes().length;
      // What the sheet hands over when only a tag was tapped: no text, no
      // note. The server would refuse that as an empty update.
      await controller.editItem(stale);

      expect(writes(), hasLength(tagged));
      expect(controller.items.single.tagIds, [a['id']]);
    });

    test('the server only ever keeps ids of tags this list has', () async {
      server.addItem('Row');
      final controller = controllerFor(server);
      await controller.load();

      await controller.setItemTags(controller.items.single, const [
        '99999999-9999-4999-8999-000000000000',
      ]);

      // Not even sent: this device does not know that tag either.
      expect(controller.items.single.tagIds, isEmpty);
      expect(writes(), isEmpty);
    });
  });

  group('the tags themselves', () {
    test(
      'are kept in compareTags order, whatever order they arrive in',
      () async {
        server
          ..addTag('kitchen')
          ..addTag('Bath')
          ..addTag('10 min');
        final controller = controllerFor(server);
        await controller.load();

        expect(controller.tags.map((tag) => tag.name), [
          '10 min',
          'Bath',
          'kitchen',
        ]);

        // One made here goes straight into its place, not onto the end.
        final attic = controller.createTag('Attic');
        expect(controller.tags.map((tag) => tag.name), [
          '10 min',
          'Attic',
          'Bath',
          'kitchen',
        ]);
        await attic;
      },
    );

    test('rename and recolour land at once, and reach the server', () async {
      final veg = server.addTag('Veg');
      final controller = controllerFor(server);
      await controller.load();
      final tag = controller.tagById(veg['id'] as String)!;

      final renaming = controller.renameTag(tag, 'Vegetables');
      expect(controller.tagById(tag.id)!.name, 'Vegetables');
      await renaming;
      await controller.recolorTag(controller.tagById(tag.id)!, TagColor.olive);

      expect(server.tags.single['name'], 'Vegetables');
      expect(server.tags.single['color'], 'olive');
    });

    test('a rename onto another tag\'s name is not even sent', () async {
      server.addTag('Bread');
      final cakes = server.addTag('Cakes');
      final controller = controllerFor(server);
      await controller.load();

      await controller.renameTag(
        controller.tagById(cakes['id'] as String)!,
        'bread',
      );

      expect(writes(), isEmpty);
      expect(controller.tagById(cakes['id'] as String)!.name, 'Cakes');
    });

    test('deleting one takes it off every row and out of the filter', () async {
      final doomed = server.addTag('Doomed');
      final kept = server.addTag('Kept');
      server
        ..addItem('A', tagIds: [doomed['id'] as String, kept['id'] as String])
        ..addItem('B', tagIds: [doomed['id'] as String]);
      final controller = controllerFor(server);
      await controller.load();
      controller.toggleFilter(controller.tagById(doomed['id'] as String)!);

      final deleting = controller.deleteTag(
        controller.tagById(doomed['id'] as String)!,
      );
      expect(controller.tags.map((t) => t.name), ['Kept']);
      expect(controller.items.map((i) => i.tagIds), [
        [kept['id']],
        <String>[],
      ]);
      expect(controller.isFiltering, isFalse);
      await deleting;
      expect(server.tags.map((t) => t['name']), ['Kept']);
    });

    test('a refused delete puts it back on the rows that wore it', () async {
      final doomed = server.addTag('Doomed');
      server.addItem('A', tagIds: [doomed['id'] as String]);
      final controller = controllerFor(server);
      await controller.load();

      server
        ..failNextStatus = 403
        ..failNextCode = 'forbidden'
        ..failNextMessage = 'This link can only look at the list.';
      await controller.deleteTag(controller.tagById(doomed['id'] as String)!);

      expect(controller.tags.map((t) => t.name), ['Doomed']);
      expect(controller.items.single.tagIds, [doomed['id']]);
    });

    test(
      'somebody else deleting one strips it here, from the one event',
      () async {
        final doomed = server.addTag('Doomed');
        final row = server.addItem('A', tagIds: [doomed['id'] as String]);
        final controller = controllerFor(server);
        await controller.load();
        controller.toggleFilter(controller.tagById(doomed['id'] as String)!);

        server.tags.clear();
        server.items.single['tagIds'] = <String>[];
        server.recordEvent('tag.deleted', {'id': doomed['id']}, actor: 'them');
        await controller.reconcile();

        expect(controller.tags, isEmpty);
        expect(controller.itemById(row['id'] as String)!.tagIds, isEmpty);
        expect(controller.isFiltering, isFalse);
      },
    );

    test('somebody else making and renaming one lands here', () async {
      final controller = controllerFor(server);
      await controller.load();

      final made = server.addTag('Garden');
      server.recordEvent('tag.created', {'tag': made}, actor: 'them');
      await controller.reconcile();
      expect(controller.tags.single.name, 'Garden');

      final renamed = {...made, 'name': 'Allotment', 'color': 'sage'};
      server.recordEvent('tag.updated', {'tag': renamed}, actor: 'them');
      await controller.reconcile();
      expect(controller.tags.single.name, 'Allotment');
      expect(controller.tags.single.color, TagColor.sage);
    });
  });

  group('looking at the list through its tags', () {
    test(
      'a filter lets through rows with any of its tags, done ones too',
      () async {
        final kitchen = server.addTag('Kitchen');
        final bath = server.addTag('Bath');
        server
          ..addItem('Kettle', tagIds: [kitchen['id'] as String])
          ..addItem('Soap', tagIds: [bath['id'] as String])
          ..addItem('Stamps')
          ..addItem('Toast', checked: true, tagIds: [kitchen['id'] as String])
          ..addItem('Towel', checked: true, tagIds: [bath['id'] as String]);
        final controller = controllerFor(server);
        await controller.load();

        controller.toggleFilter(controller.tagById(kitchen['id'] as String)!);
        expect(controller.visibleOpen.map((i) => i.text), ['Kettle']);
        expect(controller.visibleDone.map((i) => i.text), ['Toast']);

        controller.toggleFilter(controller.tagById(bath['id'] as String)!);
        expect(controller.visibleOpen.map((i) => i.text), ['Kettle', 'Soap']);
        expect(controller.visibleDone.map((i) => i.text), ['Toast', 'Towel']);

        controller.clearFilter();
        expect(controller.visibleOpen, hasLength(3));
      },
    );

    test('a drag under a filter moves among the rows on screen', () async {
      final kitchen = server.addTag('Kitchen');
      server
        ..addItem('Kettle', tagIds: [kitchen['id'] as String])
        ..addItem('Stamps')
        ..addItem('Toaster', tagIds: [kitchen['id'] as String]);
      final controller = controllerFor(server);
      await controller.load();
      controller.toggleFilter(controller.tagById(kitchen['id'] as String)!);

      // The finger moves the second visible row to the top of what it sees.
      await controller.moveItem(controller.visibleOpen[1], 0);

      expect(controller.visibleOpen.map((i) => i.text), ['Toaster', 'Kettle']);
      // The server is told about the neighbour on screen, not the hidden row
      // between them.
      expect(writes().single.body!['beforeId'], server.items.first['id']);
      controller.clearFilter();
      expect(controller.openItems.map((i) => i.text), [
        'Toaster',
        'Kettle',
        'Stamps',
      ]);
    });

    test('a row added under a filter is made with its tags', () async {
      final kitchen = server.addTag('Kitchen');
      final controller = controllerFor(server);
      await controller.load();
      controller.toggleFilter(controller.tagById(kitchen['id'] as String)!);

      final adding = controller.addItem('Kettle');
      // On screen at once, and still in view.
      expect(controller.visibleOpen.single.text, 'Kettle');
      await adding;

      expect(writes().single.body!['tagIds'], [kitchen['id']]);
      expect(server.items.single['tagIds'], [kitchen['id']]);
    });

    test('grouped by tag, a row goes under its first tag and untagged rows '
        'go last', () async {
      final kitchen = server.addTag('Kitchen');
      final bath = server.addTag('Bath');
      server
        ..addItem('Stamps')
        ..addItem('Kettle', tagIds: [kitchen['id'] as String])
        ..addItem(
          'Towels',
          tagIds: [kitchen['id'] as String, bath['id'] as String],
        )
        ..addItem('Soap', tagIds: [bath['id'] as String]);
      final controller = controllerFor(server);
      await controller.load();
      controller.setGroupByTag(true);

      expect(controller.groupByTag, isTrue);
      expect(
        [
          for (final group in controller.groups)
            '${group.tag?.name ?? 'No tag'}: '
                '${group.items.map((i) => i.text).join(', ')}',
        ],
        ['Bath: Towels, Soap', 'Kitchen: Kettle', 'No tag: Stamps'],
      );
    });

    test('a list with no tags shows your order, whatever was chosen', () async {
      final controller = controllerFor(server);
      await controller.load();
      controller.setGroupByTag(true);
      expect(controller.groupByTag, isFalse);
    });

    test('grouping and the folded shelf are remembered for the list, and the '
        'filter is not', () async {
      final kitchen = server.addTag('Kitchen');
      final views = MemoryDeviceViewStore();
      final first = controllerFor(server, views: views);
      await first.load();
      first
        ..setGroupByTag(true)
        ..setDoneFolded(true)
        ..toggleFilter(first.tagById(kitchen['id'] as String)!);
      await Future<void>.delayed(Duration.zero);

      final again = controllerFor(server, views: views);
      await again.load();
      expect(again.groupByTag, isTrue);
      expect(again.doneFolded, isTrue);
      expect(again.isFiltering, isFalse);

      // Another list on the same device starts from the standard view.
      expect(await views.read('some-other-list'), DeviceView.standard);
    });
  });
}
