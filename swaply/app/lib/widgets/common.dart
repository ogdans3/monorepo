import 'package:flutter/material.dart';

import '../api/models.dart';
import '../design/tokens.dart';

/// The pill button every screen ends with.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label,
      {super.key,
      this.onPressed,
      this.enabled = true,
      this.busy = false,
      this.icon,
      this.height = 54});

  final String label;
  final VoidCallback? onPressed;
  final bool enabled, busy;
  final IconData? icon;

  /// 54 as the export draws «Logg inn» and «Fortsett»; the trade screen's
  /// «Godta byttet» is 50 and the profile's «Send melding» 44.
  final double height;

  @override
  Widget build(BuildContext context) {
    final on = enabled && !busy && onPressed != null;
    return SizedBox(
      height: height,
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
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Three outlined looks from the export: plain, «Avslå» (badge red on a pink
/// edge — the same pair as the ✕ on the item screen) and the green outline of
/// «Foreslå motbytte».
class SecondaryButton extends StatelessWidget {
  const SecondaryButton(this.label,
      {super.key, this.onPressed, this.destructive = false, this.accent = false, this.height = 52});

  final String label;
  final VoidCallback? onPressed;
  final bool destructive;
  final bool accent;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colour = destructive
        ? SwaplyColors.badge
        : accent
            ? SwaplyColors.greenText
            : SwaplyColors.ink;
    final edge = destructive
        ? SwaplyColors.declineLine
        : accent
            ? SwaplyColors.greenPressed
            : const Color(0x22064E3B);
    return SizedBox(
      height: height,
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: colour,
          backgroundColor: destructive ? Colors.white : null,
          side: BorderSide(color: edge),
          padding: EdgeInsets.zero,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: accent ? 14 : 15,
                fontWeight: destructive || accent ? FontWeight.w700 : FontWeight.w600)),
      ),
    );
  }
}

/// The colours the export gives people. Not decoration: a list of chats is a
/// list of faces, and four identical green circles is not a list of faces.
const _avatarColours = [
  SwaplyColors.avatarGold,
  SwaplyColors.avatarTeal,
  SwaplyColors.avatarPurple,
];

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
        color: color ??
            (mine
                ? SwaplyColors.greenDeep
                // Same name, same colour, every screen: the person is
                // recognisable before the name is read.
                : _avatarColours[(name.isEmpty ? 0 : name.codeUnitAt(0)) % _avatarColours.length]),
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
  Widget build(BuildContext context) => Text(text.toUpperCase(),
      style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.92,
          color: SwaplyColors.greyLight));
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
  const Pill(this.label, {super.key, this.selected = false, this.small = false});

  final String label;
  final bool selected;

  /// The export has two sizes: a filter chip on 05 is 12.5px with 7/13 of
  /// padding, and a fact on a listing is 12px with 5/11.
  final bool small;

  @override
  Widget build(BuildContext context) => Container(
        padding: small
            ? const EdgeInsets.symmetric(horizontal: 11, vertical: 5)
            : const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? SwaplyColors.greenPressed : SwaplyColors.chip,
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: small ? 12 : 12.5,
            height: 1.2,
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

/// The badge on a listing that says what state it is in: «Tilgjengelig»,
/// «Reservert». Smaller and tighter than a [Pill], because it sits on top of a
/// photograph rather than in a row of choices.
class StatePill extends StatelessWidget {
  const StatePill(this.label, {super.key, this.color = SwaplyColors.greenText, this.soft});

  final String label;
  final Color color;
  final Color? soft;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: soft ??
              switch (color) {
                SwaplyColors.greenText => SwaplyColors.availableBg,
                SwaplyColors.amberText || SwaplyColors.amber => SwaplyColors.amberBg,
                _ => SwaplyColors.chip,
              },
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 9.5, height: 1.2, fontWeight: FontWeight.w700, color: color)),
      );
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding, this.radius = 18, this.edge});

  final Widget child;
  final EdgeInsets? padding;
  final double radius;
  final Color? edge;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        // 11 top and bottom, 14 at the sides: the export's card, everywhere.
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: edge ?? SwaplyColors.cardLine),
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
