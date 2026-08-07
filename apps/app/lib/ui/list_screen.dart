import 'dart:async';

import 'package:flutter/material.dart';

import '../data/api_client.dart';
import '../data/config.dart';
import '../data/models.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../state/library_controller.dart';
import '../state/list_controller.dart';
import 'sheets/confirm_sheet.dart';
import 'sheets/item_sheet.dart';
import 'sheets/share_sheet.dart';
import 'sheets/sheet_scaffold.dart';
import 'scope.dart';
import 'sheets/text_sheet.dart';
import 'widgets/bits.dart';
import 'widgets/composer.dart';
import 'widgets/item_row.dart';

/// One open list.
class ListScreen extends StatefulWidget {
  const ListScreen({
    required this.library,
    required this.listId,
    this.realtimeFactory,
    super.key,
  });

  final LibraryController library;
  final String listId;

  /// Overridden in tests to keep the live feed out of the way.
  final RealtimeFactory? realtimeFactory;

  @override
  State<ListScreen> createState() => _ListScreenState();
}

class _ListScreenState extends State<ListScreen> with WidgetsBindingObserver {
  late final ListController _controller;
  late final StreamSubscription<String> _messages;
  late final StreamSubscription<String> _tokens;
  final _scroll = ScrollController();
  bool _missing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    final saved = widget.library.byId(widget.listId);
    if (saved == null) {
      _missing = true;
      // Nothing to build a controller around; the build method explains it.
      _controller = ListController(
        api: _apiOf(context),
        token: 'x' * 43,
        realtimeFactory: widget.realtimeFactory,
      );
      _messages = const Stream<String>.empty().listen((_) {});
      _tokens = const Stream<String>.empty().listen((_) {});
      return;
    }

    _controller = ListController(
      api: _apiOf(context),
      token: saved.token,
      realtimeFactory: widget.realtimeFactory,
    );
    _messages = _controller.messages.listen(_say);
    _tokens = _controller.tokenChanges.listen((token) {
      // Rotation minted a new link — persist it before anything else, because
      // losing it here would lock this device out of its own list.
      unawaited(widget.library.record(id: widget.listId, token: token));
    });
    _controller.addListener(_persist);
    unawaited(_controller.open());
    unawaited(widget.library.record(id: widget.listId, touch: true));
  }

  CheckpostApi _apiOf(BuildContext context) => CheckpostApiScope.of(context);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back to the app is exactly when the socket is most likely to have
    // died quietly, so this is where we ask what we missed.
    if (state == AppLifecycleState.resumed && !_missing) {
      unawaited(_controller.reconcile());
    }
  }

  void _persist() {
    final list = _controller.list;
    if (list == null) return;
    unawaited(
      widget.library.record(
        id: widget.listId,
        title: list.title,
        doneCount: _controller.doneCount,
        totalCount: _controller.totalCount,
      ),
    );
  }

  void _say(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _messages.cancel();
    _tokens.cancel();
    _controller.removeListener(_persist);
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  Future<void> _openItem(ChecklistItem item) async {
    final result = await itemSheet(
      context,
      item: item,
      onToggle: () => _controller.toggle(item),
    );
    if (result == null || !mounted) return;
    if (result.deleted) {
      await _controller.deleteItem(item);
    } else if (result.hasEdits) {
      await _controller.editItem(item, text: result.text, note: result.note);
    }
  }

  Future<void> _rename() async {
    final list = _controller.list;
    if (list == null) return;
    final title = await textSheet(
      context,
      title: 'Rename list',
      hint: 'Cabin, Friday',
      submitLabel: 'Save name',
      initialValue: list.title,
    );
    if (title == null) return;
    await _controller.rename(title);
  }

  Future<void> _share() async {
    final list = _controller.list;
    await showCheckpostSheet<void>(
      context: context,
      builder: (_) => ShareSheet(
        url: '${AppConfig.webOrigin}/l/${_controller.token}',
        listTitle: list?.title ?? 'Checkpost list',
        onRotate: () async {
          final url = await _controller.rotateLink();
          return url;
        },
      ),
    );
  }

  Future<void> _clearChecked() async {
    final count = _controller.doneCount;
    if (count == 0) return;
    final confirmed = await confirmSheet(
      context,
      title: 'Clear $count done ${count == 1 ? 'item' : 'items'}?',
      consequence:
          'They are removed for everyone on the list, straight away. There is '
          'no undo.',
      confirmLabel: 'Clear them',
    );
    if (!confirmed) return;
    await _controller.clearChecked();
  }

  Future<void> _deleteList() async {
    final confirmed = await confirmSheet(
      context,
      title: 'Delete this list?',
      consequence:
          'The list and everything on it is gone for everyone, immediately. '
          'The link stops working. There is no undo.',
      confirmLabel: 'Delete the list',
    );
    if (!confirmed) return;
    await _controller.deleteList();
    await widget.library.forget(widget.listId);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _leave() async {
    await widget.library.forget(widget.listId);
    if (mounted) Navigator.of(context).pop();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_missing) {
      return Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This list is not on this device',
          body: 'Open its link again to get back in.',
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Back to your lists'),
            ),
          ],
        ),
      );
    }

    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        final colors = CheckpostTheme.of(context);
        final status = _controller.status;

        if (status == ListStatus.gone || status == ListStatus.invalid) {
          return _DeadEnd(
            status: status,
            reason: _controller.goneReason,
            onLeave: _leave,
          );
        }

        final list = _controller.list;
        final open = _controller.openItems;
        final done = _controller.doneItems;

        return Scaffold(
          appBar: AppBar(
            title: InkWell(
              onTap: list == null ? null : _rename,
              borderRadius: Radii.smAll,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: Space.xs,
                  vertical: Space.xs,
                ),
                child: Text(
                  list?.title ?? ' ',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            actions: [
              PresencePill(count: _controller.presence),
              IconButton(
                onPressed: list == null ? null : _share,
                tooltip: 'Share this list',
                icon: const Icon(Icons.qr_code_rounded),
              ),
              PopupMenuButton<String>(
                tooltip: 'More',
                position: PopupMenuPosition.under,
                color: colors.bg,
                onSelected: (value) => switch (value) {
                  'rename' => _rename(),
                  'clear' => _clearChecked(),
                  'leave' => _leave(),
                  'delete' => _deleteList(),
                  _ => null,
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'rename', child: Text('Rename list')),
                  PopupMenuItem(
                    value: 'clear',
                    enabled: _controller.doneCount > 0,
                    child: const Text('Clear done items'),
                  ),
                  const PopupMenuItem(
                    value: 'leave',
                    child: Text('Remove from this device'),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete list for everyone'),
                  ),
                ],
              ),
            ],
          ),
          body: Column(
            children: [
              if (status == ListStatus.offline) const OfflineBanner(),
              Expanded(
                child: status == ListStatus.loading && list == null
                    ? const Padding(
                        padding: EdgeInsets.only(top: Space.sm),
                        child: ListSkeleton(),
                      )
                    : RefreshIndicator(
                        onRefresh: _controller.reconcile,
                        color: colors.primary,
                        backgroundColor: colors.bg,
                        child: _Body(
                          scroll: _scroll,
                          open: open,
                          done: done,
                          controller: _controller,
                          onOpenItem: _openItem,
                          onClearChecked: _clearChecked,
                        ),
                      ),
              ),
              Composer(
                enabled: list != null,
                onSubmit: (text) {
                  _controller.addItem(text);
                  // Land at the bottom, where the new row is.
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (!_scroll.hasClients) return;
                    _scroll.animateTo(
                      _scroll.position.maxScrollExtent,
                      duration: Motion.base,
                      curve: Motion.curve,
                    );
                  });
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.scroll,
    required this.open,
    required this.done,
    required this.controller,
    required this.onOpenItem,
    required this.onClearChecked,
  });

  final ScrollController scroll;
  final List<ChecklistItem> open;
  final List<ChecklistItem> done;
  final ListController controller;
  final Future<void> Function(ChecklistItem) onOpenItem;
  final Future<void> Function() onClearChecked;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);

    if (open.isEmpty && done.isEmpty) {
      return ListView(
        controller: scroll,
        children: const [
          SizedBox(height: 80),
          EmptyState(
            title: 'Nothing on the list yet',
            body:
                'Type below and press enter. Keep going — the field stays put '
                'so you can add several without stopping.',
          ),
        ],
      );
    }

    Widget rowFor(ChecklistItem item) => ItemRow(
      key: ValueKey(item.id),
      item: item,
      washing: controller.isWashing(item.id),
      onToggle: () => controller.toggle(item),
      onOpen: () => onOpenItem(item),
    );

    return CustomScrollView(
      controller: scroll,
      slivers: [
        SliverList.separated(
          itemCount: open.length,
          separatorBuilder: (_, _) => Divider(color: colors.line, height: 1),
          itemBuilder: (_, index) => rowFor(open[index]),
        ),
        if (done.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: Space.xl),
              child: ShelfHeader(
                label: 'Done · ${done.length}',
                trailing: TextButton(
                  onPressed: onClearChecked,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.inkMuted,
                    minimumSize: const Size(Space.minTarget, 36),
                    textStyle: Theme.of(context).textTheme.bodySmall,
                  ),
                  child: const Text('Clear'),
                ),
              ),
            ),
          ),
          SliverList.separated(
            itemCount: done.length,
            separatorBuilder: (_, _) => Divider(color: colors.line, height: 1),
            itemBuilder: (_, index) => rowFor(done[index]),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: Space.giant)),
      ],
    );
  }
}

/// A rotated link or a deleted list is a normal event here, not an error. It
/// gets a plain sentence and a way forward.
class _DeadEnd extends StatelessWidget {
  const _DeadEnd({
    required this.status,
    required this.reason,
    required this.onLeave,
  });

  final ListStatus status;
  final String? reason;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final deleted = reason == 'deleted';
    final invalid = status == ListStatus.invalid;

    return Scaffold(
      appBar: AppBar(),
      body: EmptyState(
        title: invalid
            ? 'That link isn’t valid'
            : deleted
            ? 'This list was deleted'
            : 'This link was replaced',
        body: invalid
            ? 'Check that you copied the whole thing, or ask for the link again.'
            : deleted
            ? 'Someone on the list deleted it. There is nothing left to open.'
            : 'Someone replaced the share link. Ask them for the new one and '
                  'open it — you will be back on the list straight away.',
        actions: [
          FilledButton(
            onPressed: onLeave,
            child: const Text('Remove from this device'),
          ),
          const SizedBox(height: Space.sm),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to your lists'),
          ),
        ],
      ),
    );
  }
}
