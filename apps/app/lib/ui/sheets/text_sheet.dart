import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';
import 'sheet_scaffold.dart';

/// A single-field sheet: name a new list, rename one, or paste a share link.
/// Returns the trimmed text, or null if the person backed out.
Future<String?> textSheet(
  BuildContext context, {
  required String title,
  required String hint,
  required String submitLabel,
  String initialValue = '',
  String? help,
  int maxLength = 120,
  TextInputType keyboardType = TextInputType.text,
  String? Function(String value)? validate,
}) {
  return showCheckpostSheet<String>(
    context: context,
    builder: (context) => _TextSheet(
      title: title,
      hint: hint,
      submitLabel: submitLabel,
      initialValue: initialValue,
      help: help,
      maxLength: maxLength,
      keyboardType: keyboardType,
      validate: validate,
    ),
  );
}

class _TextSheet extends StatefulWidget {
  const _TextSheet({
    required this.title,
    required this.hint,
    required this.submitLabel,
    required this.initialValue,
    required this.maxLength,
    required this.keyboardType,
    this.help,
    this.validate,
  });

  final String title;
  final String hint;
  final String submitLabel;
  final String initialValue;
  final String? help;
  final int maxLength;
  final TextInputType keyboardType;
  final String? Function(String value)? validate;

  @override
  State<_TextSheet> createState() => _TextSheetState();
}

class _TextSheetState extends State<_TextSheet> {
  late final _controller = TextEditingController(text: widget.initialValue);
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(() => _error = 'This can’t be empty.');
      return;
    }
    final problem = widget.validate?.call(value);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return SheetScaffold(
      title: widget.title,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          Space.gutter,
          0,
          Space.gutter,
          Space.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: Radii.mdAll,
                border: Border.all(
                  color: _error == null ? colors.line : colors.primary,
                ),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: Space.lg,
                vertical: Space.md,
              ),
              child: TextField(
                controller: _controller,
                autofocus: true,
                keyboardType: widget.keyboardType,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.done,
                maxLength: widget.maxLength,
                maxLines: null,
                buildCounter:
                    (
                      _, {
                      required currentLength,
                      required isFocused,
                      maxLength,
                    }) => null,
                onSubmitted: (_) => _submit(),
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                style: text.bodyLarge,
                decoration: InputDecoration(
                  hintText: widget.hint,
                  hintStyle: text.bodyLarge?.copyWith(color: colors.inkMuted),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: Space.sm),
              Text(
                _error!,
                style: text.bodySmall?.copyWith(color: colors.primary),
              ),
            ] else if (widget.help != null) ...[
              const SizedBox(height: Space.sm),
              Text(widget.help!, style: text.bodySmall),
            ],
            const SizedBox(height: Space.xl),
            FilledButton(onPressed: _submit, child: Text(widget.submitLabel)),
          ],
        ),
      ),
    );
  }
}
