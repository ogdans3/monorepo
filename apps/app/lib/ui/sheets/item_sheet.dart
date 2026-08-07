import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../widgets/check_mark.dart';
import 'confirm_sheet.dart';
import 'sheet_scaffold.dart';

/// What the right-hand edge of a row opens: the item itself.
///
/// Editing happens here rather than inline because a checklist row has to stay
/// a one-tap target — turning every row into a text field would cost the
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
  required VoidCallback onToggle,
}) {
  return showCheckpostSheet<ItemSheetResult>(
    context: context,
    builder: (context) => _ItemSheet(item: item, onToggle: onToggle),
  );
}

class _ItemSheet extends StatefulWidget {
  const _ItemSheet({required this.item, required this.onToggle});

  final ChecklistItem item;
  final VoidCallback onToggle;

  @override
  State<_ItemSheet> createState() => _ItemSheetState();
}

class _ItemSheetState extends State<_ItemSheet> {
  late final _text = TextEditingController(text: widget.item.text);
  late final _note = TextEditingController(text: widget.item.note);
  late bool _checked = widget.item.checked;

  @override
  void dispose() {
    _text.dispose();
    _note.dispose();
    super.dispose();
  }

  void _save() {
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
              hint: 'Anything worth remembering — size, aisle, who’s bringing it',
              maxLength: 4000,
              minLines: 3,
            ),
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
