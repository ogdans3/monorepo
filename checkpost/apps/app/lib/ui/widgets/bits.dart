import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';

/// How many people are on this list, including you. A dot and a count, never
/// avatars and never names. There are no accounts to put a face to.
class PresencePill extends StatelessWidget {
  const PresencePill({required this.count, super.key});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    if (count < 2) return const SizedBox.shrink();

    return Semantics(
      label: '$count people on this list',
      child: Padding(
        padding: const EdgeInsets.only(right: Space.sm),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: colors.primary,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: Space.sm - 2),
            ExcludeSemantics(
              child: Text(
                '$count here',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A quiet strip that says the connection is down. Not an error dialog: being
/// briefly offline is a normal event here, and everything still works.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    return Container(
      width: double.infinity,
      color: colors.surface,
      padding: const EdgeInsets.symmetric(
        horizontal: Space.gutter,
        vertical: Space.sm,
      ),
      child: Text(
        'Offline. Your changes are saved here and will sync when you’re back.',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
      ),
    );
  }
}

/// Three grey rows at the real row height, not a spinner in the middle of
/// nothing: the shape of what is coming is more useful than a wait animation.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    const widths = [0.62, 0.44, 0.71];

    return ExcludeSemantics(
      child: Column(
        children: [
          for (final width in widths)
            SizedBox(
              height: Space.rowHeight,
              child: Row(
                children: [
                  const SizedBox(width: Space.gutter),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: colors.surfaceHover,
                      borderRadius: Radii.smAll,
                    ),
                  ),
                  const SizedBox(width: Space.md + 1),
                  Expanded(
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: width,
                      child: Container(
                        height: 12,
                        decoration: BoxDecoration(
                          color: colors.surfaceHover,
                          borderRadius: const BorderRadius.all(
                            Radius.circular(6),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: Space.gutter),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// An empty state that teaches the interface instead of announcing a void.
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.title,
    required this.body,
    this.actions = const [],
    super.key,
  });

  final String title;
  final String body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(Space.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: text.titleLarge),
            const SizedBox(height: Space.sm),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 340),
              child: Text(
                body,
                style: text.bodyLarge?.copyWith(color: colors.inkMuted),
              ),
            ),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: Space.xxl),
              ...actions,
            ],
          ],
        ),
      ),
    );
  }
}

/// The done shelf's heading, which is also the button that folds it.
///
/// Folding puts a long run of finished rows away without clearing them.
/// Clear stays beside it, because putting them away and throwing them away
/// are different acts. The chevron turns a quarter and the rows go at once:
/// sliding a list's height shut is layout work that says nothing.
class DoneShelfHeader extends StatelessWidget {
  const DoneShelfHeader({
    required this.count,
    required this.folded,
    required this.onFold,
    this.trailing,
    super.key,
  });

  final int count;
  final bool folded;
  final VoidCallback onFold;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final instant = MediaQuery.disableAnimationsOf(context);

    return Container(
      color: colors.surface,
      padding: const EdgeInsets.fromLTRB(
        Space.gutter - Space.sm,
        Space.sm,
        Space.sm,
        Space.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              button: true,
              expanded: !folded,
              label: 'Done, $count',
              excludeSemantics: true,
              child: InkWell(
                onTap: onFold,
                borderRadius: Radii.smAll,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: Space.minTarget),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Space.sm),
                    child: Row(
                      children: [
                        // Down while it is open, pointing along the heading
                        // once it is folded.
                        AnimatedRotation(
                          turns: folded ? -0.25 : 0,
                          duration: instant ? Duration.zero : Motion.fold,
                          curve: Motion.curve,
                          child: Icon(
                            Icons.expand_more_rounded,
                            size: 20,
                            color: colors.inkMuted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Done · $count',
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(color: colors.inkMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
