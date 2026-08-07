import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';
import 'sheet_scaffold.dart';

/// Confirmation for the things that cannot be undone.
///
/// There is no destructive red in this palette. A second red alongside a rose
/// accent would muddy both. The consequence is therefore stated in words, in
/// full, before the button that causes it. Words carry the warning, not hue.
Future<bool> confirmSheet(
  BuildContext context, {
  required String title,
  required String consequence,
  required String confirmLabel,
}) async {
  final result = await showCheckpostSheet<bool>(
    context: context,
    builder: (context) {
      final colors = CheckpostTheme.of(context);
      final text = Theme.of(context).textTheme;

      return SheetScaffold(
        title: title,
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
              Text(
                consequence,
                style: text.bodyLarge?.copyWith(color: colors.inkMuted),
              ),
              const SizedBox(height: Space.xxl),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(confirmLabel),
              ),
              const SizedBox(height: Space.sm),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                style: TextButton.styleFrom(
                  foregroundColor: colors.inkMuted,
                  minimumSize: const Size.fromHeight(Space.minTarget),
                ),
                child: const Text('Keep it'),
              ),
            ],
          ),
        ),
      );
    },
  );
  return result ?? false;
}
