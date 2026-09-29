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
import 'sheets/tags_sheet.dart';
import 'sheets/text_sheet.dart';
import 'widgets/bits.dart';
import 'widgets/composer.dart';
import 'widgets/item_row.dart';
import 'widgets/tags.dart';

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
      // Nothing to build a controller around. The build method explains it.
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
      // Grouping and the folded shelf are this device's view of the list.
      // They go to a store of their own, never through the library, which
      // notifies the home screen underneath every time it changes.
      views: widget.library.views,
      listId: widget.listId,
    );
    _messages = _controller.messages.listen(_say);
    _tokens = _controller.tokenChanges.listen((token) {
      // Rotation minted a new link. Persist it before anything else, because
      // losing it here would lock this device out of its own list.
      widget.library.record(id: widget.listId, token: token);
    });
    _controller.addListener(_persist);
    unawaited(_controller.open());

    // Touching the library notifies its listeners, and the home screen is one
    // of them, sitting underneath this route. Doing that from initState means
    // marking a widget dirty while the framework is already building, which
    // throws. It can wait one frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.library.record(id: widget.listId, touch: true);
    });
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
    // Fires on every change to the list, including timer ticks. The library
    // drops it on the floor when nothing actually changed.
    widget.library.record(
      id: widget.listId,
      title: list.title,
      doneCount: _controller.doneCount,
      totalCount: _controller.totalCount,
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
    // Closing a list is exactly when its summary should reach disk, and it
    // settles the debounce rather than leaving a timer running behind a screen
    // nobody is looking at any more.
    unawaited(widget.library.flush());
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  Future<void> _openItem(ChecklistItem item) async {
    final open = _controller.visibleOpen;
    final at = open.indexWhere((candidate) => candidate.id == item.id);
    // A checked item is not in the open list, and the done shelf is ordered by
    // being done rather than by hand, so it gets no position controls. Nor
    // does a list grouped by tag: Move up and Move down move rows in your
    // order, which that view is not showing.
    final movable =
        _controller.canWrite &&
        !_controller.groupByTag &&
        at >= 0 &&
        open.length > 1;

    final result = await itemSheet(
      context,
      item: item,
      controller: _controller,
      onToggle: () => _controller.toggle(item),
      onMove: movable
          ? (direction) => _controller.stepItem(item, direction)
          : null,
      canMoveUp: movable && at > 0,
      canMoveDown: movable && at < open.length - 1,
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

  Future<void> _editTags() => tagsSheet(context, controller: _controller);

  Future<void> _clearChecked() async {
    final count = _controller.doneCount;
    if (count == 0) return;
    // Clear takes every done row, not only the ones a filter is showing, and
    // the heading it sits beside counts only those. Say so.
    final hidden = count - _controller.visibleDone.length;
    final confirmed = await confirmSheet(
      context,
      title: 'Clear $count done ${count == 1 ? 'item' : 'items'}?',
      consequence: hidden > 0
          ? 'They are removed for everyone on the list, straight away, '
                'including ${hidden == 1 ? 'one' : '$hidden'} the tag filter is '
                'hiding. There is no undo.'
          : 'They are removed for everyone on the list, straight away. There is '
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

        if (status == ListStatus.gone ||
            status == ListStatus.invalid ||
            status == ListStatus.copyOnly) {
          return _DeadEnd(
            status: status,
            reason: _controller.goneReason,
            onLeave: _leave,
          );
        }

        final list = _controller.list;

        return Scaffold(
          appBar: AppBar(
            title: InkWell(
              onTap: list == null || !_controller.canWrite ? null : _rename,
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
              if (list != null && !_controller.canWrite)
                Padding(
                  padding: const EdgeInsets.only(right: Space.sm),
                  child: Text(
                    'Read only',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
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
                  const PopupMenuItem(
                    value: 'rename',
                    child: Text('Rename list'),
                  ),
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
              // Only once the list has a tag, so an untagged list looks
              // exactly as it did before there were tags.
              if (list != null && _controller.tags.isNotEmpty)
                _TagBar(
                  controller: _controller,
                  onEditTags: _controller.canWrite ? _editTags : null,
                ),
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
                          controller: _controller,
                          onOpenItem: _openItem,
                          onClearChecked: _clearChecked,
                        ),
                      ),
              ),
              // A field you are not allowed to submit is a lie, so a read link
              // gets a sentence instead of a disabled composer.
              if (!_controller.canWrite && list != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(
                    Space.gutter,
                    Space.lg,
                    Space.gutter,
                    Space.lg,
                  ),
                  decoration: BoxDecoration(
                    border: Border(top: BorderSide(color: colors.line)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Text(
                      'This link can look at the list, and cannot change it.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                  ),
                )
              else
                Composer(
                  enabled: list != null,
                  hint: composerHintFor(_controller.filterTags),
                  onSubmit: (text) {
                    // Whether to follow the new row down, decided before
                    // anything moves.
                    //
                    // It used to jump to the bottom every time. The composer is
                    // pinned there, so somebody can scroll up to check what is
                    // already on the list, type the thing they just remembered,
                    // and be thrown to the end for their trouble, losing the
                    // place they were reading. Following only when they were
                    // already at the bottom keeps the common case, add after
                    // add after add, and drops the annoying one.
                    final stick =
                        !_scroll.hasClients ||
                        _scroll.position.maxScrollExtent -
                                _scroll.position.pixels <
                            _stickSlack;
                    _controller.addItem(text);
                    if (!stick) return;
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

/// How close to the bottom still counts as being at the bottom. A row is 56dp,
/// so this is "the last row is in view" rather than "pixel perfect".
const double _stickSlack = 72;

class _Body extends StatelessWidget {
  const _Body({
    required this.scroll,
    required this.controller,
    required this.onOpenItem,
    required this.onClearChecked,
  });

  final ScrollController scroll;
  final ListController controller;
  final Future<void> Function(ChecklistItem) onOpenItem;
  final Future<void> Function() onClearChecked;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);

    if (controller.items.isEmpty) {
      return ListView(
        controller: scroll,
        children: const [
          SizedBox(height: 80),
          EmptyState(
            title: 'Nothing on the list yet',
            body:
                'Type below and press enter. Keep going. The field stays put '
                'so you can add several without stopping.',
          ),
        ],
      );
    }

    final byTag = controller.groupByTag;
    final open = controller.visibleOpen;
    final done = controller.visibleDone;

    // Declared before rowFor so the done rows can reserve the same left column
    // the open rows spend on their handle. Grouped by tag there is nothing to
    // drag, since the groups are the order, so no grips and no reserved
    // column to line up with.
    final canReorder = controller.canWrite && !byTag && open.length > 1;

    Widget rowFor(ChecklistItem item, {int? reorderIndex}) => ItemRow(
      key: ValueKey(item.id),
      item: item,
      tags: controller.tagsOf(item),
      washing: controller.isWashing(item.id),
      readOnly: !controller.canWrite,
      reorderIndex: reorderIndex,
      reserveGrip: canReorder,
      onToggle: () => controller.toggle(item),
      onOpen: () => onOpenItem(item),
    );

    Widget separated(List<ChecklistItem> rows) => SliverList.separated(
      itemCount: rows.length,
      separatorBuilder: (_, _) => Divider(color: colors.line, height: 1),
      itemBuilder: (_, index) => rowFor(rows[index]),
    );

    final groups = byTag ? controller.groups : const <TagGroup>[];

    return CustomScrollView(
      controller: scroll,
      slivers: [
        if (byTag)
          for (final (index, group) in groups.indexed) ...[
            SliverToBoxAdapter(
              child: TagGroupHeading(
                tag: group.tag,
                count: group.items.length,
                first: index == 0,
              ),
            ),
            separated(group.items),
          ]
        // Only the open items reorder. A reorderable list draws its own
        // separators, so the divider rides along under each row rather than
        // between them, which is what keeps the hairline where it was.
        else if (canReorder)
          SliverReorderableList(
            itemCount: open.length,
            onReorder: (from, to) {
              // Flutter reports the destination in the pre-removal list, so a
              // downward move is one past where the row actually lands.
              controller.moveItem(open[from], to > from ? to - 1 : to);
            },
            proxyDecorator: (child, index, animation) => Material(
              color: colors.surfaceHover,
              elevation: 4,
              shadowColor: Colors.black26,
              child: child,
            ),
            itemBuilder: (_, index) => Column(
              key: ValueKey('reorder-${open[index].id}'),
              mainAxisSize: MainAxisSize.min,
              children: [
                rowFor(open[index], reorderIndex: index),
                Divider(color: colors.line, height: 1),
              ],
            ),
          )
        else
          separated(open),
        if (controller.isFiltering && open.isEmpty)
          SliverToBoxAdapter(
            child: _NothingLeft(
              message: nothingLeftFor(controller.filterTags),
              onShowEveryRow: controller.clearFilter,
            ),
          ),
        if (done.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: Space.xl),
              child: DoneShelfHeader(
                count: done.length,
                folded: controller.doneFolded,
                onFold: () => controller.setDoneFolded(!controller.doneFolded),
                trailing: controller.canWrite
                    ? TextButton(
                        onPressed: onClearChecked,
                        style: TextButton.styleFrom(
                          foregroundColor: colors.inkMuted,
                          minimumSize: const Size(Space.minTarget, 36),
                          textStyle: Theme.of(context).textTheme.bodySmall,
                        ),
                        child: const Text('Clear'),
                      )
                    : null,
              ),
            ),
          ),
          // Folded, the rows go at once rather than sliding shut.
          if (!controller.doneFolded) separated(done),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: Space.giant)),
      ],
    );
  }
}

/// A filter that leaves nothing open says which, and offers the way back,
/// rather than showing a blank that reads as an empty list.
class _NothingLeft extends StatelessWidget {
  const _NothingLeft({required this.message, required this.onShowEveryRow});

  final String message;
  final VoidCallback onShowEveryRow;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Space.gutter,
        28,
        Space.gutter,
        Space.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: text.bodyLarge?.copyWith(color: colors.inkMuted),
          ),
          const SizedBox(height: Space.xs),
          TextButton(
            onPressed: onShowEveryRow,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, Space.minTarget),
            ),
            child: const Text('Show every row'),
          ),
        ],
      ),
    );
  }
}

/// Between the header and the list, once the list has a tag: the order, the
/// filter, and the way to the tags themselves, on one row that scrolls
/// sideways rather than two that stack. Every line this takes is a line the
/// list does not get, on a screen that is mostly list.
class _TagBar extends StatefulWidget {
  const _TagBar({required this.controller, required this.onEditTags});

  final ListController controller;

  /// Null on a link that can only look.
  final VoidCallback? onEditTags;

  @override
  State<_TagBar> createState() => _TagBarState();
}

class _TagBarState extends State<_TagBar> {
  /// One per chip, so a chip keeps its place in the tree when Clear arrives in
  /// front of it, and can be found afterwards to be scrolled back into view.
  final _chips = <String, GlobalKey>{};

  void _toggle(Tag tag) {
    widget.controller.toggleFilter(tag);
    // Turning the first filter on puts Clear in front of the chips, and
    // turning the last one off takes it away, which moves every chip along.
    // The one just tapped is kept in view, or its tick lands off the edge of
    // the screen, out of reach of the finger that would take it off again.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chip = _chips[tag.id]?.currentContext;
      if (chip == null || !chip.mounted) return;
      final viewport = Scrollable.of(chip).context.findRenderObject();
      final box = chip.findRenderObject();
      if (viewport is! RenderBox || box is! RenderBox) return;
      final left = box.localToGlobal(Offset.zero, ancestor: viewport).dx;
      final right = left + box.size.width;
      final ScrollPositionAlignmentPolicy policy;
      if (right > viewport.size.width) {
        policy = ScrollPositionAlignmentPolicy.keepVisibleAtEnd;
      } else if (left < 0) {
        policy = ScrollPositionAlignmentPolicy.keepVisibleAtStart;
      } else {
        return;
      }
      Scrollable.ensureVisible(
        chip,
        alignmentPolicy: policy,
        duration: MediaQuery.disableAnimationsOf(chip)
            ? Duration.zero
            : Motion.base,
        curve: Motion.curve,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final colors = CheckpostTheme.of(context);
    final label = Theme.of(
      context,
    ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600);

    Widget quiet(String text, Color color, VoidCallback onPressed) =>
        TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            foregroundColor: color,
            minimumSize: const Size(Space.minTarget, Space.minTarget),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            textStyle: label,
          ),
          child: Text(text),
        );

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.line)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: Space.gutter - Space.xs,
          vertical: Space.xs,
        ),
        child: Row(
          children: [
            const SizedBox(width: Space.xs),
            TwoWayChoice(
              first: 'Your order',
              second: 'By tag',
              secondChosen: controller.groupByTag,
              onChanged: controller.setGroupByTag,
            ),
            const SizedBox(width: Space.sm),
            if (controller.isFiltering) ...[
              quiet('Clear', colors.primary, controller.clearFilter),
              const SizedBox(width: Space.xs),
            ],
            for (final tag in controller.tags) ...[
              TagToggle(
                key: _chips.putIfAbsent(tag.id, GlobalKey.new),
                tag: tag,
                on: controller.filter.contains(tag.id),
                semanticLabel: 'Show rows tagged ${tag.name}',
                onTap: () => _toggle(tag),
              ),
              const SizedBox(width: Space.sm),
            ],
            if (widget.onEditTags != null)
              quiet('Edit tags', colors.inkMuted, widget.onEditTags!),
          ],
        ),
      ),
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
    final copyOnly = status == ListStatus.copyOnly;

    return Scaffold(
      appBar: AppBar(),
      body: EmptyState(
        title: copyOnly
            ? 'This link hands out copies'
            : invalid
            ? 'That link isn’t valid'
            : deleted
            ? 'This list was deleted'
            : 'This link was replaced',
        body: copyOnly
            ? 'Opening it makes you a private copy of somebody else’s list. '
                  'Open it in a browser to take that copy. The app cannot yet.'
            : invalid
            ? 'Check that you copied the whole thing, or ask for the link again.'
            : deleted
            ? 'Someone on the list deleted it. There is nothing left to open.'
            : 'Someone replaced the share link. Ask them for the new one and '
                  'open it. You will be back on the list straight away.',
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
