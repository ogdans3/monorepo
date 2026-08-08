import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import 'check_mark.dart';

/// One line of the checklist.
///
/// Anatomy: checkbox · text · right-edge affordance. Tapping the row or the
/// box ticks it off. Swiping the row, or tapping the right edge, opens it.
/// The chevron is always drawn, because this is a touch product and a
/// hover-revealed affordance is no affordance at all.
class ItemRow extends StatelessWidget {
  const ItemRow({
    required this.item,
    required this.onToggle,
    required this.onOpen,
    this.washing = false,
    this.readOnly = false,
    super.key,
  });

  final ChecklistItem item;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  /// Somebody else just changed this row.
  final bool washing;

  /// A read link. The row shows everything and responds to nothing.
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;
    final instant = MediaQuery.disableAnimationsOf(context);

    final row = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: readOnly ? null : onToggle,
        splashColor: colors.primaryQuiet.withValues(alpha: 0.5),
        highlightColor: colors.surfaceHover,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: Space.rowHeight),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              Space.gutter,
              Space.md,
              0,
              Space.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // The box has its own 48dp target inside the row's tap area,
                // so the two never fight over a near-miss.
                Semantics(
                  checked: item.checked,
                  label: item.text,
                  child: ExcludeSemantics(
                    child: CheckMark(checked: item.checked),
                  ),
                ),
                const SizedBox(width: Space.md + 1),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedDefaultTextStyle(
                        duration: instant ? Duration.zero : Motion.base,
                        curve: Motion.curve,
                        style: (text.bodyLarge ?? const TextStyle()).copyWith(
                          color: item.checked ? colors.inkMuted : colors.ink,
                          // Checked is carried by the mark, the strikethrough
                          // *and* the dimming. Never colour alone.
                          decoration: item.checked
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                          decorationColor: colors.inkMuted,
                          decorationThickness: 1.4,
                        ),
                        child: Text(item.text),
                      ),
                      if (item.hasNote) ...[
                        const SizedBox(height: Space.xxs),
                        Text(
                          item.note.trim(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // 44dp of always-present chevron: the non-gesture way to open
                // an item, so nothing here is swipe-only.
                if (readOnly)
                  const SizedBox(width: Space.sm)
                else
                  Semantics(
                    button: true,
                    label: 'Open ${item.text}',
                    child: InkResponse(
                      onTap: onOpen,
                      radius: 24,
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: Icon(
                          Icons.chevron_right_rounded,
                          size: 20,
                          color: colors.inkFaint,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );

    return AnimatedContainer(
      duration: instant ? Duration.zero : Motion.base,
      curve: Motion.curve,
      // The wash is information, not decoration. It is how you notice what
      // somebody else did, so it survives Reduce Motion as a flat tint.
      color: washing ? colors.primaryQuiet : colors.bg,
      child: readOnly
          ? row
          : Dismissible(
              key: ValueKey('swipe-${item.id}'),
              direction: DismissDirection.startToEnd,
              dismissThresholds: const {DismissDirection.startToEnd: 0.4},
              background: _SwipeHint(colors: colors),
              confirmDismiss: (_) async {
                // Swipe opens the item, and never destroys anything. Returning false
                // springs the row back, which is the correct end state.
                onOpen();
                return false;
              },
              child: row,
            ),
    );
  }
}

class _SwipeHint extends StatelessWidget {
  const _SwipeHint({required this.colors});

  final CheckpostColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.surface,
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
      child: Icon(Icons.more_horiz_rounded, size: 20, color: colors.inkMuted),
    );
  }
}
