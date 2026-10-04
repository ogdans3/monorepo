import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../state/list_controller.dart';
import '../widgets/check_mark.dart';
import '../widgets/tags.dart';
import 'confirm_sheet.dart';
import 'sheet_scaffold.dart';
import 'tags_sheet.dart';

/// What the right-hand edge of a row opens: the item itself.
///
/// Editing happens here rather than inline because a checklist row has to stay
/// a one-tap target. Turning every row into a text field would cost the
/// gesture the whole product is built around.
class ItemSheetResult {
  const ItemSheetResult({this.text, this.note, this.deleted = false});

  final String? text;
  final String? note;
  final bool deleted;

  bool get hasEdits => text != null || note != null;
}

Future<ItemSheetResult?> itemSheet(
  BuildContext context, {
  required ChecklistItem item,
  required ListController controller,
  required VoidCallback onToggle,
  void Function(int direction)? onMove,
  bool canMoveUp = false,
  bool canMoveDown = false,
}) {
  return showCheckpostSheet<ItemSheetResult>(
    context: context,
    builder: (context) => _ItemSheet(
      item: item,
      controller: controller,
      onToggle: onToggle,
      onMove: onMove,
      canMoveUp: canMoveUp,
      canMoveDown: canMoveDown,
    ),
  );
}

class _ItemSheet extends StatefulWidget {
  const _ItemSheet({
    required this.item,
    required this.controller,
    required this.onToggle,
    this.onMove,
    this.canMoveUp = false,
    this.canMoveDown = false,
  });

  final ChecklistItem item;

  /// Where the row's tags are read from and written to. Unlike the text
  /// fields, a tag lands at a tap, so what the chips show has to be the row as
  /// it is now rather than as it was when the sheet opened.
  final ListController controller;
  final VoidCallback onToggle;

  /// Step the item one place. Absent on a checked item, on a read link, and
  /// when the list is grouped by tag, which is not showing your order.
  final void Function(int direction)? onMove;
  final bool canMoveUp;
  final bool canMoveDown;

  @override
  State<_ItemSheet> createState() => _ItemSheetState();
}

class _ItemSheetState extends State<_ItemSheet> {
  late final _text = TextEditingController(text: widget.item.text);
  late final _note = TextEditingController(text: widget.item.note);

  /// The name in the tag field, kept here rather than in the tags section so
  /// that Save can add a tag typed and not yet added.
  final _tagName = TextEditingController();
  late bool _checked = widget.item.checked;

  @override
  void dispose() {
    _text.dispose();
    _note.dispose();
    _tagName.dispose();
    super.dispose();
  }

  void _save() {
    // A tag typed and not yet added is added by Save too: whoever typed it
    // meant it, and Save is where a sheet says it is done.
    final row = widget.controller.itemById(widget.item.id) ?? widget.item;
    if (canAddTagNamed(widget.controller, row, _tagName.text)) {
      widget.controller.addTagToItem(row, _tagName.text);
    }
    final text = _text.text.trim();
    final note = _note.text;
    Navigator.of(context).pop(
      ItemSheetResult(
        text: text.isEmpty || text == widget.item.text ? null : text,
        note: note == widget.item.note ? null : note,
      ),
    );
  }

  Future<void> _delete() async {
    final confirmed = await confirmSheet(
      context,
      title: 'Remove this item?',
      consequence:
          'It disappears for everyone on the list, straight away. There is no undo.',
      confirmLabel: 'Remove it',
    );
    if (!confirmed || !mounted) return;
    Navigator.of(context).pop(const ItemSheetResult(deleted: true));
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return SheetScaffold(
      title: 'Item',
      trailing: TextButton(onPressed: _save, child: const Text('Save')),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          Space.gutter,
          0,
          Space.gutter,
          Space.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              onTap: () {
                setState(() => _checked = !_checked);
                widget.onToggle();
              },
              borderRadius: Radii.mdAll,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: Space.md),
                child: Row(
                  children: [
                    CheckMark(checked: _checked),
                    const SizedBox(width: Space.md + 1),
                    Text(
                      _checked ? 'Done' : 'Not done yet',
                      style: text.titleMedium,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: Space.sm),
            _Field(
              label: 'Item',
              controller: _text,
              hint: 'What is it?',
              maxLength: 500,
              autofocus: false,
            ),
            const SizedBox(height: Space.lg),
            _Field(
              label: 'Note',
              controller: _note,
              hint:
                  'Anything worth remembering. Size, aisle, who’s bringing it',
              maxLength: 4000,
              minLines: 3,
            ),
            const SizedBox(height: Space.lg),
            _TagsSection(
              item: widget.item,
              controller: widget.controller,
              name: _tagName,
            ),
            if (widget.onMove != null) ...[
              const SizedBox(height: Space.lg),
              // The same job as the grip, without the drag. The handle is a
              // shortcut, not the only way in, which is what the design
              // contract means by no gesture-only affordance. It is also the
              // only way to move something a long way in a list that does not
              // fit on one screen.
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Position',
                      style: text.bodyMedium?.copyWith(color: colors.inkMuted),
                    ),
                  ),
                  TextButton(
                    onPressed: widget.canMoveUp
                        ? () {
                            widget.onMove!(-1);
                            Navigator.of(context).pop();
                          }
                        : null,
                    child: const Text('Move up'),
                  ),
                  const SizedBox(width: Space.xs),
                  TextButton(
                    onPressed: widget.canMoveDown
                        ? () {
                            widget.onMove!(1);
                            Navigator.of(context).pop();
                          }
                        : null,
                    child: const Text('Move down'),
                  ),
                ],
              ),
            ],
            const SizedBox(height: Space.xxl),
            TextButton(
              onPressed: _delete,
              style: TextButton.styleFrom(
                foregroundColor: colors.inkMuted,
                minimumSize: const Size.fromHeight(Space.minTarget),
              ),
              child: const Text('Remove from list'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.hint,
    required this.maxLength,
    this.minLines = 1,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final int maxLength;
  final int minLines;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: text.bodySmall),
        const SizedBox(height: Space.xs + 2),
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: Radii.mdAll,
            border: Border.all(color: colors.line),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: Space.lg,
            vertical: Space.md,
          ),
          child: TextField(
            controller: controller,
            autofocus: autofocus,
            minLines: minLines,
            maxLines: null,
            maxLength: maxLength,
            textCapitalization: TextCapitalization.sentences,
            buildCounter:
                (_, {required currentLength, required isFocused, maxLength}) =>
                    null,
            style: text.bodyLarge,
            decoration: InputDecoration(
              hintText: hint,
              // Placeholders are held to the same 4.5:1 as body text.
              hintStyle: text.bodyLarge?.copyWith(color: colors.inkMuted),
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
      ],
    );
  }
}

/// The row's tags: every tag on the list as a toggle that lands at a tap, and
/// a field that makes a new one or finds the one the list already has.
class _TagsSection extends StatefulWidget {
  const _TagsSection({
    required this.item,
    required this.controller,
    required this.name,
  });

  final ChecklistItem item;
  final ListController controller;

  /// The tag field's text, owned by the sheet, whose Save adds it too.
  final TextEditingController name;

  @override
  State<_TagsSection> createState() => _TagsSectionState();
}

class _TagsSectionState extends State<_TagsSection> {
  final _focus = FocusNode();

  /// The list changing, or the name being typed. Made once, so the builder
  /// below is not handed a new listenable, and resubscribed, on every frame.
  late final _changes = Listenable.merge([widget.controller, widget.name]);

  ListController get _controller => widget.controller;
  TextEditingController get _name => widget.name;

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  ChecklistItem get _row => _controller.itemById(widget.item.id) ?? widget.item;

  void _add() {
    if (!canAddTagNamed(_controller, _row, _name.text)) return;
    _controller.addTagToItem(_row, _name.text);
    _name.clear();
    // Straight back to an empty field, like the composer, so three tags are
    // three names and three presses of Enter.
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return ListenableBuilder(
      listenable: _changes,
      builder: (context, _) {
        final row = _row;
        final tags = _controller.tags;
        final atLimit = row.tagIds.length >= Limits.tagsPerItem;
        final typed = normaliseTagName(_name.text);
        final known = typed.isEmpty ? null : _controller.tagNamed(typed);
        final listFull = tags.length >= Limits.tagsPerList;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Tags', style: text.bodySmall),
            // The toggles are padded out to 48dp for a finger, and that
            // padding already makes the gap every other label here has.
            SizedBox(height: tags.isEmpty ? Space.xs + 2 : 0),
            if (tags.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: Space.sm),
                child: Text(
                  'Tags group the list and filter it, for everyone on it.',
                  style: text.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              )
            else
              Wrap(
                spacing: Space.sm,
                children: [
                  for (final tag in tags)
                    TagToggle(
                      tag: tag,
                      on: row.tagIds.contains(tag.id),
                      // At ten, only the ones already on can be taken off.
                      enabled: row.tagIds.contains(tag.id) || !atLimit,
                      onTap: () => _controller.toggleItemTag(row, tag),
                    ),
                ],
              ),
            if (tags.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: Space.xs),
                child: Text(
                  'Tags save as you tap them, for everyone on the list.',
                  style: text.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              ),
            const SizedBox(height: Space.xs),
            Row(
              children: [
                Expanded(
                  child: TagNameField(
                    controller: _name,
                    focusNode: _focus,
                    hint: 'Add a tag',
                    enabled: !atLimit,
                    onSubmitted: _add,
                  ),
                ),
                const SizedBox(width: Space.sm),
                FieldButton(
                  label: 'Add',
                  onPressed: canAddTagNamed(_controller, row, _name.text)
                      ? _add
                      : null,
                ),
              ],
            ),
            if (atLimit)
              const TagHint('A row holds ${Limits.tagsPerItem} tags.')
            else if (listFull && typed.isNotEmpty && known == null)
              const TagHint(
                'This list holds ${Limits.tagsPerList} tags. Delete one in '
                'Edit tags to make room.',
              ),
            if (tags.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => tagsSheet(context, controller: _controller),
                  style: TextButton.styleFrom(
                    foregroundColor: colors.inkMuted,
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, Space.minTarget),
                    textStyle: text.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: const Text('Edit tags'),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Whether [name] can go on [row]: a name at all, room on the row, and either
/// a tag the list already has that the row does not wear, or room on the list
/// for a new one.
bool canAddTagNamed(ListController controller, ChecklistItem row, String name) {
  if (normaliseTagName(name).isEmpty) return false;
  if (row.tagIds.length >= Limits.tagsPerItem) return false;
  final known = controller.tagNamed(name);
  if (known != null) return !row.tagIds.contains(known.id);
  return controller.tags.length < Limits.tagsPerList;
}
