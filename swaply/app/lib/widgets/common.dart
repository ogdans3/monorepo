import 'package:flutter/material.dart';

import '../api/models.dart';
import '../design/tokens.dart';

/// The pill button every screen ends with.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label,
      {super.key, this.onPressed, this.enabled = true, this.busy = false, this.icon});

  final String label;
  final VoidCallback? onPressed;
  final bool enabled, busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final on = enabled && !busy && onPressed != null;
    return SizedBox(
      height: 54,
      width: double.infinity,
      child: FilledButton(
        onPressed: on ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: SwaplyColors.greenPressed,
          disabledBackgroundColor: const Color(0xFFD8DEDA),
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
        ),
        child: busy
            ? const SizedBox(
                height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
            : Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
                  // Norwegian labels run long — «Marker byttet som gjennomført» —
                  // and a button is not allowed to overflow because of a word.
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton(this.label, {super.key, this.onPressed, this.destructive = false});

  final String label;
  final VoidCallback? onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: destructive ? SwaplyColors.red : SwaplyColors.ink,
          side: const BorderSide(color: Color(0x22064E3B)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
        ),
        child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// «O» in a circle. The export never shows a profile photo, only an initial —
/// and it gives other people a colour of their own, so a face in a list is not
/// the same green as everything else on the screen. Yours stays deep green.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40, this.color, this.mine = false});

  final String name;
  final double size;
  final Color? color;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: size,
      width: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color ?? (mine ? SwaplyColors.greenDeep : SwaplyColors.avatarGold),
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
        style: TextStyle(
            color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.42),
      ),
    );
  }
}

class Kicker extends StatelessWidget {
  const Kicker(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Type.kicker);
}

class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.value, this.size = 14, this.onChanged});

  final double value;
  final double size;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final filled = value >= i + 1;
        final star = Icon(
          filled ? Icons.star_rounded : Icons.star_outline_rounded,
          size: size,
          color: filled ? const Color(0xFFF0A92B) : SwaplyColors.grey,
        );
        if (onChanged == null) return star;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onChanged!(i + 1),
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: star),
        );
      }),
    );
  }
}

/// A listing without a photo is not a hole in the collage: it gets a card of
/// its own, with the category mark on deep green.
class ItemThumb extends StatelessWidget {
  const ItemThumb(this.item, {super.key, this.size = 56, this.radius = 12});

  final Item item;
  final double size, radius;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    if (item.cover != null) {
      return ClipRRect(
        borderRadius: shape,
        child: Image.network(item.cover!,
            height: size, width: size, fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _placeholder(shape)),
      );
    }
    return _placeholder(shape);
  }

  Widget _placeholder(BorderRadius shape) => Container(
        height: size,
        width: size,
        decoration: BoxDecoration(color: SwaplyColors.greenSoft, borderRadius: shape),
        child: Icon(categoryIcons[item.category] ?? Icons.category_outlined,
            color: SwaplyColors.greenDeep, size: size * 0.42),
      );
}

/// A category, a condition, an interest. Filled, never outlined: in the export
/// the fill is the shape, and a border on top of it makes it look like a button.
class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.selected = false});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? SwaplyColors.greenPressed : SwaplyColors.chip,
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? Colors.white : SwaplyColors.chipInk,
          ),
        ),
      );
}

/// The two round buttons at the bottom of a listing: a ✕ that passes, and the
/// heart. Circles, because the export draws the heart as the one big thing on
/// the screen and a pill with a word in it is not that.
class CircleAction extends StatelessWidget {
  const CircleAction({
    super.key,
    required this.icon,
    required this.onPressed,
    this.filled = false,
    this.busy = false,
    this.size = 62,
    this.iconSize = 26,
    this.color,
    this.borderColor,
    this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled, busy;
  final double size, iconSize;
  final Color? color, borderColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? SwaplyColors.greenPressed;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: filled ? tint : Colors.white,
        shape: CircleBorder(
          side: filled
              ? BorderSide.none
              : BorderSide(color: borderColor ?? SwaplyColors.cardLine),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: busy ? null : onPressed,
          child: SizedBox(
            height: size,
            width: size,
            child: busy
                ? const Center(
                    child: SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    ),
                  )
                : Icon(icon, size: iconSize, color: filled ? Colors.white : tint),
          ),
        ),
      ),
    );
  }
}

class StatePill extends StatelessWidget {
  const StatePill(this.label, {super.key, this.color = SwaplyColors.greenDeep, this.soft});

  final String label;
  final Color color;
  final Color? soft;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: soft ?? color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(label,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
      );
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(Insets.md),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(Radii.card),
          border: Border.all(color: SwaplyColors.cardLine),
        ),
        child: child,
      );
}

/// Empty states teach the interface: what this place is for, and one way out.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.inbox_outlined,
  });

  final String title, body;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(Insets.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 64, width: 64,
                decoration: const BoxDecoration(color: SwaplyColors.greenSoft, shape: BoxShape.circle),
                child: Icon(icon, color: SwaplyColors.greenDeep),
              ),
              const SizedBox(height: Insets.lg),
              Text(title, style: Type.title, textAlign: TextAlign.center),
              const SizedBox(height: Insets.sm),
              Text(body, style: Type.secondary, textAlign: TextAlign.center),
              if (actionLabel != null) ...[
                const SizedBox(height: Insets.lg),
                SizedBox(width: 230, child: PrimaryButton(actionLabel!, onPressed: onAction)),
              ],
            ],
          ),
        ),
      );
}

Future<void> showError(BuildContext context, Object error) async {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('$error'),
      backgroundColor: SwaplyColors.ink,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
