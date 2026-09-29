import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
//
// Word for word what the web client says, because it is one product whichever
// door somebody came in by.

/// What the composer says while a filter is on, which is also what it does.
String composerHintFor(List<Tag> filterTags) => switch (filterTags) {
  [] => 'Add something',
  [final only] => 'Add to ${only.name}',
  [final first, final second] => 'Add to ${first.name} and ${second.name}',
  _ => 'Add with ${filterTags.length} tags',
};

/// What the open rows say when a filter leaves none of them, rather than
/// showing a blank that looks like an empty list.
String nothingLeftFor(List<Tag> filterTags) => switch (filterTags) {
  [final only] => 'Nothing left tagged ${only.name}.',
  [final first, final second] =>
    'Nothing left tagged ${first.name} or ${second.name}.',
  _ => 'Nothing left with those ${filterTags.length} tags.',
};

/// "4 rows", "1 row", "No rows".
String rowCount(int count) => switch (count) {
  0 => 'No rows',
  1 => '1 row',
  _ => '$count rows',
};

/// The words that stand between a tap and deleting a tag for everyone.
String deleteTagConsequence(Tag tag, int rows) => rows == 0
    ? 'No rows wear it. It goes for everyone, and there is no undo.'
    : 'Takes ${tag.name} off ${rowCount(rows).toLowerCase()}, for everyone. '
          'There is no undo.';

String tagClash(Tag other) => 'There is already a tag called “${other.name}”.';

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/// The mark that stands for a tag where there is no chip: a group heading, a
/// filter that is off, a done row, the colour picker.
class TagDot extends StatelessWidget {
  const TagDot({required this.color, this.size = 8, super.key});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

/// A tag on a row: the dot and the name on the tag's tint, in its ink.
///
/// On a done row the tint goes and the name dims with the rest of the row,
/// and the dot stays, so the row still says which tag it is while it reads as
/// finished. Without its fill the chip also gives up its left padding, so the
/// dot lines up with the text above it instead of floating in from it.
class TagChip extends StatelessWidget {
  const TagChip({required this.tag, this.done = false, super.key});

  final Tag tag;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final tone = colors.tag(tag.color);
    final label = Theme.of(context).textTheme.labelLarge;

    return Container(
      constraints: const BoxConstraints(minHeight: 24),
      padding: EdgeInsets.fromLTRB(done ? 0 : 7, 2.5, 8, 2.5),
      decoration: done
          ? null
          : BoxDecoration(color: tone.tint, borderRadius: Radii.smAll),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          TagDot(color: tone.dot),
          const SizedBox(width: 5),
          // A name is the one thing a tag is, so it wraps rather than
          // truncating when a large text size makes it wider than the row.
          Flexible(
            child: Text(
              tag.name,
              style: label?.copyWith(color: done ? colors.inkMuted : tone.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// A row's tags, under its text and note, wrapping onto more lines rather
/// than truncating.
class TagChips extends StatelessWidget {
  const TagChips({required this.tags, this.done = false, super.key});

  /// Already in [compareTags] order.
  final List<Tag> tags;
  final bool done;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Tagged ${tags.map((tag) => tag.name).join(', ')}',
    excludeSemantics: true,
    child: Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [for (final tag in tags) TagChip(tag: tag, done: done)],
    ),
  );
}

/// One control for both jobs, the filter and a row's tags, so they look like
/// the same thing because they are.
///
/// Off is the dot and the name on a hairline. On takes the tag's own tint and
/// ink and the dot becomes a tick, so on and off differ in shape and not only
/// in colour. 36dp drawn, and padded out to the 48 a finger needs.
class TagToggle extends StatelessWidget {
  const TagToggle({
    required this.tag,
    required this.on,
    required this.onTap,
    this.enabled = true,
    this.semanticLabel,
    super.key,
  });

  final Tag tag;
  final bool on;
  final VoidCallback onTap;
  final bool enabled;

  /// What a screen reader hears, when the name alone does not say it.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final tone = colors.tag(tag.color);
    final instant = MediaQuery.disableAnimationsOf(context);
    final ink = !enabled
        ? colors.inkFaint
        : on
        ? tone.ink
        : colors.ink;

    return Semantics(
      button: true,
      toggled: on,
      enabled: enabled,
      label: semanticLabel ?? tag.name,
      excludeSemantics: true,
      child: TextButton(
        onPressed: enabled ? onTap : null,
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(0, 36)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.fromLTRB(10, 0, 12, 0),
          ),
          tapTargetSize: MaterialTapTargetSize.padded,
          animationDuration: instant ? Duration.zero : Motion.fast,
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: Radii.smAll),
          ),
          side: WidgetStatePropertyAll(
            BorderSide(
              color: on
                  ? tone.tint
                  : enabled
                  ? colors.lineStrong
                  : colors.line,
            ),
          ),
          backgroundColor: WidgetStatePropertyAll(on ? tone.tint : colors.bg),
          foregroundColor: WidgetStatePropertyAll(ink),
          overlayColor: WidgetStatePropertyAll(
            (on ? tone.ink : colors.ink).withValues(alpha: 0.08),
          ),
          textStyle: WidgetStatePropertyAll(
            Theme.of(context).textTheme.labelLarge,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // The tick is wider than the dot. Both are laid out in the dot's
            // 8dp, so switching one for the other never nudges the name.
            SizedBox(
              width: 8,
              height: 14,
              child: OverflowBox(
                maxWidth: 14,
                child: on
                    ? Icon(Icons.check_rounded, size: 14, color: tone.ink)
                    : Opacity(
                        opacity: enabled ? 1 : 0.5,
                        child: TagDot(color: tone.dot),
                      ),
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                tag.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: ink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A two-way choice, drawn as the order control on Your lists is: a surface
/// track with the chosen side raised on it.
///
/// 42dp segments in a 48dp track, and each segment answers across the whole
/// height of the track, so the target is the 48 a finger needs even though
/// the pill is smaller.
class TwoWayChoice extends StatelessWidget {
  const TwoWayChoice({
    required this.first,
    required this.second,
    required this.secondChosen,
    required this.onChanged,
    super.key,
  });

  final String first;
  final String second;
  final bool secondChosen;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: Radii.mdAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Segment(
            label: first,
            chosen: !secondChosen,
            padding: const EdgeInsets.fromLTRB(3, 3, 1, 3),
            onTap: () => onChanged(false),
          ),
          _Segment(
            label: second,
            chosen: secondChosen,
            padding: const EdgeInsets.fromLTRB(1, 3, 3, 3),
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.chosen,
    required this.padding,
    required this.onTap,
  });

  final String label;
  final bool chosen;
  final EdgeInsets padding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final instant = MediaQuery.disableAnimationsOf(context);

    return Semantics(
      button: true,
      selected: chosen,
      inMutuallyExclusiveGroup: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        // The track's own 3dp edge is part of the target too.
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: padding,
          child: AnimatedContainer(
            duration: instant ? Duration.zero : Motion.fast,
            curve: Motion.curve,
            height: 42,
            decoration: BoxDecoration(
              // In the dark scheme the page is the darkest surface there is,
              // so a pill painted with it reads as a hole punched in the track.
              // Whichever way the scheme runs, chosen is a step up from what
              // it sits on.
              color: !chosen
                  ? colors.surface.withValues(alpha: 0)
                  : dark
                  ? colors.surfaceHover
                  : colors.bg,
              borderRadius: Radii.smAll,
              boxShadow: chosen && !dark
                  ? [
                      BoxShadow(
                        color: colors.ink.withValues(alpha: 0.08),
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                    ]
                  : const [],
            ),
            child: Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: onTap,
                borderRadius: Radii.smAll,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Center(
                    widthFactor: 1,
                    child: Text(
                      label,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: chosen ? colors.ink : colors.inkMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The heading over one tag's rows when the list is grouped by tag: the tag
/// as it appears everywhere else, at the size of a label rather than a title,
/// because a group is a way of reading the list and not a section of it.
class TagGroupHeading extends StatelessWidget {
  const TagGroupHeading({
    required this.tag,
    required this.count,
    this.first = false,
    super.key,
  });

  /// Null for the rows with no tag, which go last.
  final Tag? tag;
  final int count;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final label = Theme.of(context).textTheme.labelLarge;
    final tag = this.tag;
    final name = tag?.name ?? 'No tag';

    return Semantics(
      header: true,
      label: '$name, ${rowCount(count).toLowerCase()}',
      excludeSemantics: true,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          Space.gutter,
          first ? 14 : 22,
          Space.gutter,
          8,
        ),
        child: Row(
          children: [
            if (tag != null) ...[
              TagDot(color: colors.tag(tag.color).dot),
              const SizedBox(width: Space.sm),
            ],
            Flexible(
              child: Text(
                name,
                style: label?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: tag == null ? colors.inkMuted : colors.ink,
                ),
              ),
            ),
            const SizedBox(width: Space.sm),
            Text(
              '$count',
              style: label?.copyWith(
                fontWeight: FontWeight.w400,
                color: colors.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A one-line field for a tag's name: "Add a tag" in the item sheet, and the
/// rename and "New tag" fields in the Tags sheet. Held to the contract's 30.
class TagNameField extends StatelessWidget {
  const TagNameField({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
    this.focusNode,
    this.enabled = true,
    super.key,
  });

  final TextEditingController controller;
  final String hint;
  final VoidCallback onSubmitted;
  final FocusNode? focusNode;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: Radii.mdAll,
        border: Border.all(color: colors.line),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11.5),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        enabled: enabled,
        maxLength: Limits.tagName,
        buildCounter:
            (_, {required currentLength, required isFocused, maxLength}) =>
                null,
        textCapitalization: TextCapitalization.sentences,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => onSubmitted(),
        style: text.bodyLarge?.copyWith(
          color: enabled ? colors.ink : colors.inkFaint,
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: text.bodyLarge?.copyWith(
            color: enabled ? colors.inkMuted : colors.inkFaint,
          ),
          border: InputBorder.none,
          isDense: true,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }
}

/// The accent button beside a field, at the field's height. Disabled is a
/// full-strength shape at low contrast, as the composer's button is, rather
/// than a washed-out accent.
class FieldButton extends StatelessWidget {
  const FieldButton({required this.label, required this.onPressed, super.key});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, Space.minTarget),
        padding: const EdgeInsets.symmetric(horizontal: Space.lg),
        disabledBackgroundColor: colors.surface,
        disabledForegroundColor: colors.inkFaint,
      ),
      child: Text(label),
    );
  }
}

/// A hint under a tag field: why it is not taking more, or what it found.
class TagHint extends StatelessWidget {
  const TagHint(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Space.sm),
    child: Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: CheckpostTheme.of(context).inkMuted,
      ),
    ),
  );
}
