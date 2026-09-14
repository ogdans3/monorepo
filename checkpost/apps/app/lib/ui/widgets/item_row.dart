import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import 'check_mark.dart';

/// One line of the checklist.
///
/// Anatomy: grip · checkbox · text · right-edge affordance. **The box ticks it
/// off and nothing else does.** Tapping anywhere else on the row opens it, as
/// does swiping it or tapping the right edge.
///
/// That split is deliberate and it used to be the other way round: the whole
/// row toggled and only a 44dp chevron opened. Which made the cheap accident,
/// ticking something off by misjudging a tap, the easy one, and the deliberate
/// act the fiddly one. Ticking is the thing worth being sure about, so it gets
/// its own target and nothing else triggers it.
///
/// The chevron is always drawn, because this is a touch product and a
/// hover-revealed affordance is no affordance at all.
class ItemRow extends StatelessWidget {
  const ItemRow({
    required this.item,
    required this.onToggle,
    required this.onOpen,
    this.washing = false,
    this.readOnly = false,
    this.reorderIndex,
    this.reserveGrip = false,
    super.key,
  });

  final ChecklistItem item;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  /// Somebody else just changed this row.
  final bool washing;

  /// A read link. The row shows everything and responds to nothing.
  final bool readOnly;

  /// Where this row sits in the reorderable list, or null when it cannot be
  /// dragged: a read link, or the done shelf, which is ordered by being done.
  final int? reorderIndex;

  /// Keep the grip's width even without a grip.
  ///
  /// The done shelf never reorders, so its rows have no handle, and without
  /// this their checkboxes sat 24dp left of the open ones directly above them.
  /// Two lists on one screen with their columns not lining up reads as broken
  /// rather than as a distinction, which the golden caught.
  final bool reserveGrip;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;
    final instant = MediaQuery.disableAnimationsOf(context);

    final row = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: readOnly ? null : onOpen,
        splashColor: colors.primaryQuiet.withValues(alpha: 0.5),
        highlightColor: colors.surfaceHover,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: Space.rowHeight),
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              reorderIndex == null && !reserveGrip ? Space.gutter : Space.xs,
              Space.md,
              0,
              Space.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (reorderIndex == null && reserveGrip)
                  const SizedBox(width: 40)
                else if (reorderIndex != null) ...[
                  // Press and drag to carry the row. A handle of its own rather
                  // than a long press on the row, because the row's own job is
                  // opening the item now, and a gesture stacked on top of
                  // another one is a gesture people fire by accident. The item
                  // sheet carries Move up and Move down for the same job
                  // without a drag, so this is not gesture-only.
                  ReorderableDragStartListener(
                    index: reorderIndex!,
                    child: Semantics(
                      label: 'Reorder ${item.text}',
                      child: SizedBox(
                        width: 40,
                        height: Space.minTarget,
                        child: Icon(
                          Icons.drag_indicator_rounded,
                          size: 20,
                          color: colors.inkFaint,
                        ),
                      ),
                    ),
                  ),
                ],
                // The box owns ticking, with its own 48dp target. The row
                // around it opens the item, so the two never fight over a
                // near-miss and a miss costs a sheet rather than a change.
                Semantics(
                  checked: item.checked,
                  label: item.text,
                  button: true,
                  child: ExcludeSemantics(
                    child: InkResponse(
                      onTap: readOnly ? null : onToggle,
                      radius: 24,
                      child: SizedBox(
                        width: Space.minTarget,
                        height: Space.minTarget,
                        child: Center(child: CheckMark(checked: item.checked)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: Space.xs),
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
