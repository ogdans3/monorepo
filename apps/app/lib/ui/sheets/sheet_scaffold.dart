import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';

/// The shell every bottom sheet in the app shares: a drag handle, a title, and
/// content that gets out of the way of the keyboard.
///
/// Sheets are rationed. Modals are usually laziness, so only two things earn
/// one here — opening an item, and confirming something you cannot undo.
class SheetScaffold extends StatelessWidget {
  const SheetScaffold({
    required this.title,
    required this.child,
    this.trailing,
    super.key,
  });

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);

    return Padding(
      // The sheet rides above the keyboard rather than hiding behind it.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: Space.md, bottom: Space.sm),
                decoration: BoxDecoration(
                  color: colors.lineStrong,
                  borderRadius: const BorderRadius.all(Radius.circular(2)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Space.gutter,
                Space.sm,
                Space.sm,
                Space.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  ?trailing,
                ],
              ),
            ),
            Flexible(child: child),
            const SizedBox(height: Space.sm),
          ],
        ),
      ),
    );
  }
}

/// Opens a sheet with the product's standard shape and scrim.
Future<T?> showCheckpostSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: CheckpostTheme.of(context).bg,
    barrierColor: CheckpostTheme.of(context).scrim,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radii.lg),
    ),
    builder: builder,
  );
}
