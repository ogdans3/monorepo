import 'package:checkpost/design/tokens.dart';
import 'package:checkpost/state/list_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

void main() {
  late FakeServer server;

  setUp(() => server = FakeServer());

  /// The realtime socket is not what these tests are about, so it is stubbed
  /// out with a client that never connects. Everything here is the HTTP path
  /// and the optimistic-state machine on top of it.
  ListController controllerFor(FakeServer server) => ListController(
    api: server.client(),
    token: server.token,
    realtimeFactory: noRealtime,
  );

  group('loading', () {
    test('shows the list, in position order', () async {
      server
        ..addItem('Tent')
        ..addItem('Stove');
      final controller = ListController(
        api: server.client(),
        token: server.token,
      );
      await controller.load();

      expect(controller.status, ListStatus.ready);
      expect(controller.items.map((i) => i.text), ['Tent', 'Stove']);
      controller.dispose();
    });

    test('a replaced link is Gone, not an error', () async {
      server.revoked.add(server.token);
      final controller = controllerFor(server);
      await controller.load();

      expect(controller.status, ListStatus.gone);
      controller.dispose();
    });

    test('unreachable server leaves the app usable, not broken', () async {
      server.offline = true;
      final controller = controllerFor(server);
      await controller.load();

      expect(controller.status, ListStatus.offline);
      controller.dispose();
    });
  });

  group('optimistic editing', () {
    test('a tick lands before the request does', () async {
      server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();
      final item = controller.items.single;

      final pending = controller.toggle(item);
      // No await: this is the frame the user sees, and it must already be true.
      expect(controller.items.single.checked, isTrue);

      await pending;
      expect(controller.items.single.checked, isTrue);
      expect(server.items.single['checked'], isTrue);
      controller.dispose();
    });

    test(
      'a ticked row stays put briefly, then moves to the done shelf',
      () async {
        server
          ..addItem('Tent')
          ..addItem('Stove');
        final controller = controllerFor(server);
        await controller.load();

        await controller.toggle(controller.items.first);
        // Still under the thumb, so it can be un-ticked by looking at it.
        expect(controller.openItems.map((i) => i.text), ['Tent', 'Stove']);
        expect(controller.doneItems, isEmpty);

        await Future<void>.delayed(
          Motion.settleGrace + const Duration(milliseconds: 60),
        );
        expect(controller.openItems.map((i) => i.text), ['Stove']);
        expect(controller.doneItems.map((i) => i.text), ['Tent']);
        controller.dispose();
      },
    );

    test('a new item appears immediately and keeps its id', () async {
      final controller = controllerFor(server);
      await controller.load();

      final pending = controller.addItem('Firewood');
      expect(controller.items.single.text, 'Firewood');
      final optimisticId = controller.items.single.id;

      await pending;
      // The id the client invented is the id the server stored. That is what
      // makes a retry safe rather than a duplicate.
      expect(controller.items.single.id, optimisticId);
      expect(server.items.single['id'], optimisticId);
      controller.dispose();
    });

    test('a refused edit is undone and said out loud', () async {
      server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();
      final messages = <String>[];
      controller.messages.listen(messages.add);

      server
        ..failNextStatus = 409
        ..failNextCode = 'limit_reached'
        ..failNextMessage = 'This list is full.';

      await controller.toggle(controller.items.single);
      expect(controller.items.single.checked, isFalse, reason: 'reverted');
      await Future<void>.delayed(Duration.zero);
      expect(messages, contains('This list is full.'));
      controller.dispose();
    });

    test('an offline edit is kept, not thrown away', () async {
      server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();

      server.offline = true;
      await controller.toggle(controller.items.single);

      // The edit is still true on this device, and reconcile settles it later.
      expect(controller.items.single.checked, isTrue);
      expect(controller.status, ListStatus.offline);
      controller.dispose();
    });

    test(
      'a deleted item goes back where it was if the server refuses',
      () async {
        server
          ..addItem('A')
          ..addItem('B')
          ..addItem('C');
        final controller = controllerFor(server);
        await controller.load();

        server
          ..failNextStatus = 500
          ..failNextCode = 'internal'
          ..failNextMessage = 'Something broke on our side. Try again.';

        await controller.deleteItem(controller.items[1]);
        expect(controller.items.map((i) => i.text), ['A', 'B', 'C']);
        controller.dispose();
      },
    );
  });

  group('changes from other people', () {
    test('reconcile applies what we missed', () async {
      server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();

      final added = server.addItem('Stove');
      server.recordEvent('item.created', {
        'item': added,
      }, actor: 'someone-else');

      await controller.reconcile();
      expect(controller.items.map((i) => i.text), ['Tent', 'Stove']);
      expect(controller.isWashing(added['id'] as String), isTrue);
      controller.dispose();
    });

    test('our own change is applied but not highlighted', () async {
      final controller = ListController(
        api: server.client(clientId: 'me'),
        token: server.token,
      );
      await controller.load();

      final added = server.addItem('Stove');
      server.recordEvent('item.created', {'item': added}, actor: 'me');

      await controller.reconcile();
      expect(controller.items.map((i) => i.text), ['Stove']);
      // Washing your own edit would show it to you as somebody else's.
      expect(controller.isWashing(added['id'] as String), isFalse);
      controller.dispose();
    });

    test('a delete from someone else removes the row', () async {
      final tent = server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();

      server.items.removeWhere((item) => item['id'] == tent['id']);
      server.recordEvent('item.deleted', {'id': tent['id']}, actor: 'them');

      await controller.reconcile();
      expect(controller.items, isEmpty);
      controller.dispose();
    });

    test('a rename from someone else lands on the title', () async {
      final controller = controllerFor(server);
      await controller.load();

      server.recordEvent('list.updated', {
        'title': 'Cabin, Friday',
      }, actor: 'them');
      await controller.reconcile();

      expect(controller.list?.title, 'Cabin, Friday');
      controller.dispose();
    });

    test(
      'an event type this build does not know is ignored, not fatal',
      () async {
        final controller = controllerFor(server);
        await controller.load();

        server.recordEvent('item.teleported', {
          'nonsense': true,
        }, actor: 'them');
        await controller.reconcile();

        expect(controller.status, ListStatus.ready);
        controller.dispose();
      },
    );
  });

  group('replacing the link', () {
    test('mints a new token, reports it, and keeps working', () async {
      server.addItem('Tent');
      final controller = controllerFor(server);
      await controller.load();
      final before = controller.token;
      final reported = <String>[];
      controller.tokenChanges.listen(reported.add);

      await controller.rotateLink();
      await Future<void>.delayed(Duration.zero);

      expect(controller.token, isNot(before));
      expect(reported, [controller.token]);
      expect(server.revoked, contains(before));
      controller.dispose();
    });

    test('the old link is Gone for whoever still holds it', () async {
      final controller = controllerFor(server);
      await controller.load();
      final stale = ListController(
        api: server.client(),
        token: controller.token,
      );

      await controller.rotateLink();
      await stale.load();

      expect(stale.status, ListStatus.gone);
      controller.dispose();
      stale.dispose();
    });
  });

  group('clearing the done shelf', () {
    test('removes only checked items', () async {
      server
        ..addItem('A', checked: true)
        ..addItem('B')
        ..addItem('C', checked: true);
      final controller = controllerFor(server);
      await controller.load();

      await controller.clearChecked();
      expect(controller.items.map((i) => i.text), ['B']);
      controller.dispose();
    });
  });
}
