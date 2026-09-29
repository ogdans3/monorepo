import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../state/list_controller.dart';
import '../widgets/tags.dart';
import 'sheet_scaffold.dart';

/// Every tag on the list, to rename, recolour or delete, and a field to make
/// a new one. Reached from "Edit tags", in the tag bar and in any row's sheet.
Future<void> tagsSheet(
  BuildContext context, {
  required ListController controller,
}) {
  return showCheckpostSheet<void>(
    context: context,
    builder: (_) => TagsSheet(controller: controller),
  );
}

class TagsSheet extends StatefulWidget {
  const TagsSheet({required this.controller, super.key});

  final ListController controller;

  @override
  State<TagsSheet> createState() => _TagsSheetState();
}

class _TagsSheetState extends State<TagsSheet> {
  /// One tag open for editing at a time, so the sheet stays a list.
  String? _open;
  bool _confirming = false;
  final _name = TextEditingController();
  final _fresh = TextEditingController();
  final _freshFocus = FocusNode();

  /// The list changing, or either field being typed in. Made once, so the
  /// builder is not handed a new listenable on every frame.
  late final _changes = Listenable.merge([widget.controller, _name, _fresh]);

  ListController get _controller => widget.controller;

  @override
  void dispose() {
    _name.dispose();
    _fresh.dispose();
    _freshFocus.dispose();
    super.dispose();
  }

  void _toggle(Tag tag) {
    setState(() {
      _confirming = false;
      if (_open == tag.id) {
        _open = null;
        return;
      }
      _open = tag.id;
      // Taken once, when it opens. A rename arriving from somebody else while
      // the field is being typed in must not rewrite it under the cursor.
      _name.text = tag.name;
    });
  }

  /// The other tag a rename would collide with, which the server would refuse
  /// rather than merge. Checked here so the refusal never has to happen.
  Tag? _clash(Tag editing) {
    final draft = normaliseTagName(_name.text);
    if (draft.isEmpty) return null;
    return _controller.tagNamed(draft, except: editing.id);
  }

  bool _renameable(Tag editing) {
    final draft = normaliseTagName(_name.text);
    return draft.isNotEmpty && draft != editing.name && _clash(editing) == null;
  }

  void _rename(Tag editing) {
    if (!_renameable(editing)) return;
    _controller.renameTag(editing, _name.text);
    // The field keeps what was typed, now the tag's name. Nothing to clear.
    setState(() {});
  }

  bool get _full => _controller.tags.length >= Limits.tagsPerList;

  /// A new name the list already has, which Add would do nothing with.
  Tag? get _freshKnown => normaliseTagName(_fresh.text).isEmpty
      ? null
      : _controller.tagNamed(_fresh.text);

  bool get _creatable =>
      normaliseTagName(_fresh.text).isNotEmpty && !_full && _freshKnown == null;

  void _create() {
    if (!_creatable) return;
    _controller.createTag(_fresh.text);
    _fresh.clear();
    // Straight back to an empty field, like the composer, so three tags are
    // three names and three presses of Enter.
    _freshFocus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return ListenableBuilder(
      listenable: _changes,
      builder: (context, _) {
        final tags = _controller.tags;
        // Somebody else deleted the one that was open.
        if (_open != null && _controller.tagById(_open!) == null) {
          _open = null;
          _confirming = false;
        }

        return SheetScaffold(
          title: 'Tags',
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Flexible(
                child: tags.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(
                          Space.gutter,
                          0,
                          Space.gutter,
                          Space.sm,
                        ),
                        child: Text(
                          'No tags yet. Make one here, or from any row’s sheet.',
                          style: text.bodyLarge?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: tags.length,
                        separatorBuilder: (_, _) =>
                            Divider(color: colors.line, height: 1),
                        itemBuilder: (context, index) {
                          final tag = tags[index];
                          final open = tag.id == _open;
                          return Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _TagHead(
                                tag: tag,
                                rows: _controller.rowsWearing(tag.id),
                                open: open,
                                onTap: () => _toggle(tag),
                              ),
                              if (open) _editor(context, tag),
                            ],
                          );
                        },
                      ),
              ),
              Container(
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: colors.line)),
                ),
                padding: const EdgeInsets.fromLTRB(
                  Space.gutter,
                  Space.md,
                  Space.gutter,
                  Space.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TagNameField(
                            controller: _fresh,
                            focusNode: _freshFocus,
                            hint: 'New tag',
                            enabled: !_full,
                            onSubmitted: _create,
                          ),
                        ),
                        const SizedBox(width: Space.sm),
                        FieldButton(
                          label: 'Add',
                          onPressed: _creatable ? _create : null,
                        ),
                      ],
                    ),
                    if (_full)
                      const TagHint(
                        'This list holds ${Limits.tagsPerList} tags. Delete one '
                        'to make room.',
                      )
                    else if (_freshKnown case final known?)
                      TagHint(tagClash(known)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _editor(BuildContext context, Tag tag) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;
    final rows = _controller.rowsWearing(tag.id);
    final clash = _clash(tag);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Space.gutter,
        0,
        Space.gutter,
        Space.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Name', style: text.bodySmall),
          const SizedBox(height: Space.xs + 2),
          Row(
            children: [
              Expanded(
                child: TagNameField(
                  controller: _name,
                  hint: tag.name,
                  onSubmitted: () => _rename(tag),
                ),
              ),
              const SizedBox(width: Space.sm),
              FieldButton(
                label: 'Save name',
                onPressed: _renameable(tag) ? () => _rename(tag) : null,
              ),
            ],
          ),
          if (clash != null) TagHint(tagClash(clash)),
          const SizedBox(height: Space.md),
          _Swatches(
            chosen: tag.color,
            onPick: (color) => _controller.recolorTag(tag, color),
          ),
          const SizedBox(height: Space.sm),
          if (_confirming)
            Container(
              padding: const EdgeInsets.fromLTRB(
                Space.lg,
                Space.lg,
                Space.lg,
                Space.sm,
              ),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: Radii.mdAll,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // No second red, as everywhere else. The words carry the
                  // warning, and the button that acts on them is the accent.
                  Text(
                    deleteTagConsequence(tag, rows),
                    style: text.bodyLarge?.copyWith(color: colors.inkMuted),
                  ),
                  const SizedBox(height: Space.lg),
                  FilledButton(
                    onPressed: () {
                      setState(() {
                        _open = null;
                        _confirming = false;
                      });
                      _controller.deleteTag(tag);
                    },
                    child: const Text('Delete the tag'),
                  ),
                  const SizedBox(height: Space.xs),
                  TextButton(
                    onPressed: () => setState(() => _confirming = false),
                    style: TextButton.styleFrom(
                      foregroundColor: colors.inkMuted,
                      minimumSize: const Size.fromHeight(Space.minTarget),
                    ),
                    child: const Text('Keep it'),
                  ),
                ],
              ),
            )
          else
            TextButton(
              onPressed: () => setState(() => _confirming = true),
              style: TextButton.styleFrom(
                foregroundColor: colors.inkMuted,
                minimumSize: const Size.fromHeight(Space.minTarget),
              ),
              child: const Text('Delete tag'),
            ),
        ],
      ),
    );
  }
}

/// One tag's line in the sheet: its dot, its name and how many rows wear it.
/// Tapping it opens its editor underneath.
class _TagHead extends StatelessWidget {
  const _TagHead({
    required this.tag,
    required this.rows,
    required this.open,
    required this.onTap,
  });

  final Tag tag;
  final int rows;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;
    final instant = MediaQuery.disableAnimationsOf(context);

    return Semantics(
      button: true,
      expanded: open,
      label: '${tag.name}, ${rowCount(rows).toLowerCase()}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: Space.rowHeight),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              Space.gutter,
              Space.sm,
              Space.md,
              Space.sm,
            ),
            child: Row(
              children: [
                TagDot(color: colors.tag(tag.color).dot, size: 10),
                const SizedBox(width: Space.md),
                Expanded(child: Text(tag.name, style: text.titleMedium)),
                const SizedBox(width: Space.sm),
                Text(
                  rowCount(rows),
                  style: text.bodySmall?.copyWith(color: colors.inkMuted),
                ),
                const SizedBox(width: Space.xs),
                AnimatedRotation(
                  turns: open ? 0.5 : 0,
                  duration: instant ? Duration.zero : Motion.fold,
                  curve: Motion.curve,
                  child: Icon(
                    Icons.expand_more_rounded,
                    size: 20,
                    color: colors.inkFaint,
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

/// The eight colours, in wheel order, as eight equal columns so they always
/// share one line. As a wrapping row the last swatch dropped onto a line of its
/// own on a phone, which reads as a ninth thing rather than the end of the set.
///
/// A tap applies it, like a tick. The chosen one carries a ring and a tick, so
/// it is not told by colour alone.
class _Swatches extends StatelessWidget {
  const _Swatches({required this.chosen, required this.onPick});

  final TagColor chosen;
  final ValueChanged<TagColor> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);

    return Semantics(
      container: true,
      label: 'Colour',
      child: Row(
        children: [
          for (final color in TagColor.values)
            Expanded(
              child: Semantics(
                button: true,
                selected: color == chosen,
                inMutuallyExclusiveGroup: true,
                label: color.label,
                excludeSemantics: true,
                child: InkResponse(
                  onTap: () => onPick(color),
                  radius: 24,
                  child: SizedBox(
                    height: Space.minTarget,
                    child: Center(
                      child: Container(
                        width: 38,
                        height: 38,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: color == chosen
                                ? colors.ink
                                : colors.ink.withValues(alpha: 0),
                            width: 2,
                          ),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: colors.tag(color).dot,
                          ),
                          // The page colour is the one that clears 3:1 on
                          // every dot in both schemes: white on the light
                          // ones, near black on the dark.
                          child: color == chosen
                              ? Icon(
                                  Icons.check_rounded,
                                  size: 18,
                                  color: colors.bg,
                                )
                              : null,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
