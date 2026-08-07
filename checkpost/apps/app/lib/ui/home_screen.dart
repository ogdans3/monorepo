import 'package:flutter/material.dart';

import '../data/api_client.dart';
import '../data/models.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../state/library_controller.dart';
import 'list_screen.dart';
import 'sheets/confirm_sheet.dart';
import 'sheets/text_sheet.dart';
import 'widgets/bits.dart';

/// Your lists. Every list this device knows a link to, most recent first.
class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.library, super.key});

  final LibraryController library;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _busy = false;

  void _say(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (error) {
      _say(error.message);
    } on OfflineException {
      _say('Can’t reach Checkpost right now. Check your connection.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _newList() async {
    final title = await textSheet(
      context,
      title: 'New list',
      hint: 'Cabin, Friday',
      submitLabel: 'Create list',
      help: 'You can rename it later.',
    );
    if (title == null || !mounted) return;

    await _run(() async {
      final saved = await widget.library.create(title);
      if (!mounted) return;
      await _open(saved);
    });
  }

  Future<void> _openLink() async {
    final input = await textSheet(
      context,
      title: 'Open a link',
      hint: 'https://checkpost.app/l/…',
      submitLabel: 'Open list',
      maxLength: 300,
      keyboardType: TextInputType.url,
      help: 'Paste the whole link someone sent you.',
      validate: (value) => parseShareToken(value) == null
          ? 'That doesn’t look like a Checkpost link.'
          : null,
    );
    if (input == null || !mounted) return;
    final token = parseShareToken(input);
    if (token == null) return;

    await _run(() async {
      final saved = await widget.library.addByToken(token);
      if (!mounted) return;
      await _open(saved);
    });
  }

  Future<void> _open(SavedList list) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ListScreen(library: widget.library, listId: list.id),
      ),
    );
  }

  Future<void> _forget(SavedList list) async {
    final confirmed = await confirmSheet(
      context,
      title: 'Remove “${list.title}” from this device?',
      consequence:
          'The list itself is untouched. Anyone else with the link still has '
          'it. But this device forgets the link, and unless you have it saved '
          'somewhere else you will not get back in.',
      confirmLabel: 'Remove from this device',
    );
    if (!confirmed) return;
    await widget.library.forget(list.id);
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Your lists')),
      body: ListenableBuilder(
        listenable: widget.library,
        builder: (context, _) {
          if (widget.library.isLoading) {
            return const Padding(
              padding: EdgeInsets.only(top: Space.sm),
              child: ListSkeleton(),
            );
          }

          if (widget.library.isEmpty) {
            return EmptyState(
              title: 'No lists yet',
              body:
                  'A list is a link. Make one, send the link to whoever needs '
                  'it, and you are both on the same list. No accounts, nothing '
                  'to sign up for.',
              actions: [
                SizedBox(
                  width: 260,
                  child: FilledButton(
                    onPressed: _busy ? null : _newList,
                    child: const Text('New list'),
                  ),
                ),
                const SizedBox(height: Space.sm),
                SizedBox(
                  width: 260,
                  child: TextButton(
                    onPressed: _busy ? null : _openLink,
                    child: const Text('Open a link someone sent'),
                  ),
                ),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.only(bottom: Space.giant * 2),
            itemCount: widget.library.lists.length,
            separatorBuilder: (_, _) => Divider(color: colors.line, height: 1),
            itemBuilder: (context, index) {
              final list = widget.library.lists[index];
              return _ListRow(
                list: list,
                onOpen: () => _open(list),
                onForget: () => _forget(list),
              );
            },
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            Space.gutter,
            Space.sm,
            Space.gutter,
            Space.md,
          ),
          child: ListenableBuilder(
            listenable: widget.library,
            builder: (context, _) => widget.library.isEmpty
                ? const SizedBox.shrink()
                : Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: _busy ? null : _newList,
                          child: const Text('New list'),
                        ),
                      ),
                      const SizedBox(width: Space.md),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy ? null : _openLink,
                          child: const Text('Open a link'),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _ListRow extends StatelessWidget {
  const _ListRow({
    required this.list,
    required this.onOpen,
    required this.onForget,
  });

  final SavedList list;
  final VoidCallback onOpen;
  final VoidCallback onForget;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;
    final total = list.totalCount;
    final done = list.doneCount.clamp(0, total == 0 ? 0 : total);
    final allDone = total > 0 && done == total;

    return InkWell(
      onTap: onOpen,
      onLongPress: onForget,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          Space.gutter,
          Space.lg,
          Space.sm,
          Space.lg,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    list.title,
                    style: text.titleMedium,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: Space.xs + 2),
                  Row(
                    children: [
                      Text(
                        total == 0
                            ? 'Empty'
                            : allDone
                            ? 'All $total done'
                            : '$done of $total done',
                        style: text.bodySmall,
                      ),
                      if (total > 0) ...[
                        const SizedBox(width: Space.md),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: const BorderRadius.all(
                              Radius.circular(2),
                            ),
                            child: LinearProgressIndicator(
                              value: done / total,
                              minHeight: 3,
                              backgroundColor: colors.line,
                              // A meter, not a score. No percentage, no
                              // celebration. This is a fact about the list.
                              color: colors.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(
              width: 44,
              height: 44,
              child: Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: colors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
