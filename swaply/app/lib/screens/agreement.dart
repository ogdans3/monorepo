import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';

/// 06c Avtalen. The explicit agreement, in words, with a checkbox and a swipe.
///
/// The sentence about not facilitating is not decoration: it is the one thing
/// this screen exists to put in front of someone before they commit.
class AgreementScreen extends StatefulWidget {
  const AgreementScreen({super.key, required this.trade});

  final Trade trade;

  @override
  State<AgreementScreen> createState() => _AgreementScreenState();
}

class _AgreementScreenState extends State<AgreementScreen> {
  bool _accepted = false;
  bool _busy = false;

  static const termsVersion = '2026-09-06';

  Future<void> _accept() async {
    setState(() => _busy = true);
    try {
      await context.read<SwaplyApi>().accept(widget.trade.id, termsVersion: termsVersion);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final trade = widget.trade;
    final other = trade.givingTo.displayName.split(' ').first;
    final from = trade.receivingFrom.displayName.split(' ').first;

    return Scaffold(
      appBar: swaplyAppBar(context, 'Avtalen', subtitle: 'Med $other'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(22, 14, 22, 14),
                children: [
                  SectionCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _line(_thumbs(trade.youGive), 'Du gir',
                            '${trade.youGive.map((i) => i.title).join(' og ')} til $other'),
                        const SizedBox(height: 10),
                        _line(_thumbs(trade.youGet), 'Du får',
                            '${trade.youGet.map((i) => i.title).join(' og ')} fra $from'),
                        if (trade.cash != null) ...[
                          const SizedBox(height: 10),
                          _line(
                            Container(
                              width: 40,
                              height: 40,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F6F2),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text('kr',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: SwaplyColors.inkBody)),
                            ),
                            trade.cash!.youPay ? 'Du betaler' : '$from betaler',
                            trade.cash!.youPay
                                ? '${kr(trade.cash!.amountNok)} i mellomlegg via Vipps'
                                : 'deg ${kr(trade.cash!.amountNok)} i mellomlegg via Vipps',
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Dette godtar du', style: Type.section),
                  const SizedBox(height: 12),
                  for (final (i, t) in _terms(other).indexed) ...[
                    if (i > 0) const SizedBox(height: 8),
                    _term(t),
                  ],
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => showDialog<void>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('Byttevilkår', style: Type.heading),
                        content: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Versjon $termsVersion', style: Type.small),
                              const SizedBox(height: Insets.sm),
                              ..._terms(other).map((t) => Padding(
                                    padding: const EdgeInsets.only(bottom: Insets.sm),
                                    child: Text('• $t', style: Type.body),
                                  )),
                              const Text(
                                'Swaply er ikke part i byttet og fasiliterer ikke frakt eller '
                                'betaling. Avtalen er mellom dere.',
                                style: Type.body,
                              ),
                            ],
                          ),
                        ),
                        actions: [
                          TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Lukk')),
                        ],
                      ),
                    ),
                    child: const Text('Les hele byttevilkårene ›', style: Type.link),
                  ),
                  const SizedBox(height: 12),
                  // The consent is a card of its own with a square tick, not a
                  // Material checkbox.
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _accepted = !_accepted),
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: SwaplyColors.cardLine),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _accepted ? SwaplyColors.greenPressed : null,
                              borderRadius: BorderRadius.circular(7),
                              border: _accepted
                                  ? null
                                  : Border.all(color: SwaplyColors.chevron, width: 2),
                            ),
                            child: _accepted
                                ? const Text('✓',
                                    style: TextStyle(
                                        fontSize: 13,
                                        height: 1.5,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white))
                                : null,
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text('Jeg har lest og godtar vilkårene',
                                style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: SwaplyColors.ink)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 12),
              child: Column(
                children: [
                  SwipeToConfirm(
                    label: 'Sveip for å godta byttet',
                    enabled: _accepted && !_busy,
                    onConfirmed: _accept,
                  ),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(false),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 2),
                      child: Text('Avbryt',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: SwaplyColors.grey)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _terms(String other) => [
        'Jeg leverer eller sender tingene mine innen 7 dager etter at begge har godtatt',
        'Tingene mine er som beskrevet i annonsen',
        'Mellomlegg betales når begge har godtatt, før noe sendes',
        'Trekker jeg meg etterpå, må $other si ja først. Er noe sendt, kan jeg ikke trekke meg',
      ];

  /// Up to two 40px pictures, the second tucked behind the first.
  Widget _thumbs(List<Item> items) {
    if (items.isEmpty) return const SizedBox(width: 40, height: 40);
    if (items.length == 1) return ItemThumb(items.first, size: 40, radius: 10);
    return SizedBox(
      width: 68,
      height: 40,
      child: Stack(
        children: [
          Positioned(left: 28, child: ItemThumb(items[1], size: 40, radius: 10)),
          ItemThumb(items.first, size: 40, radius: 10),
        ],
      ),
    );
  }

  Widget _line(Widget lead, String bold, String rest) => Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          lead,
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: '$bold ', style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: rest),
              ]),
              style: const TextStyle(fontSize: 13.5, height: 1.4, color: SwaplyColors.ink),
            ),
          ),
        ],
      );

  Widget _term(String text) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3),
            child: Text('✓',
                style: TextStyle(
                    fontSize: 13,
                    height: 1.15,
                    fontWeight: FontWeight.w800,
                    color: SwaplyColors.greenText)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 13.5, height: 1.5, color: SwaplyColors.inkBody)),
          ),
        ],
      );
}

/// The swipe at the bottom of the agreement. Deliberately not a button: it is
/// the last thing between a person and a commitment, and it should take a
/// deliberate gesture. Disabled until the checkbox above it is ticked.
class SwipeToConfirm extends StatefulWidget {
  const SwipeToConfirm({
    super.key,
    required this.label,
    required this.onConfirmed,
    this.enabled = true,
  });

  final String label;
  final VoidCallback onConfirmed;
  final bool enabled;

  @override
  State<SwipeToConfirm> createState() => _SwipeToConfirmState();
}

class _SwipeToConfirmState extends State<SwipeToConfirm> {
  double _progress = 0;
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    const height = 60.0;
    const knob = 50.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final travel = constraints.maxWidth - knob - 10;

        return Opacity(
          opacity: widget.enabled ? 1 : 0.5,
          child: Container(
            height: height,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFFE4EFE7),
              borderRadius: BorderRadius.circular(Radii.pill),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 40),
                  child: Text(
                    _done ? 'Godtatt' : widget.label,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: SwaplyColors.greenText),
                  ),
                ),
                const Positioned(
                  right: 41,
                  child: Text('›››',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -2,
                          color: Color(0xFF9BC9B0))),
                ),
                Positioned(
                  left: 5 + _progress * travel,
                  child: GestureDetector(
                    onHorizontalDragUpdate: widget.enabled && !_done
                        ? (details) => setState(() {
                              _progress =
                                  (_progress + details.delta.dx / travel).clamp(0.0, 1.0);
                            })
                        : null,
                    onHorizontalDragEnd: widget.enabled && !_done
                        ? (_) {
                            if (_progress > 0.9) {
                              setState(() {
                                _progress = 1;
                                _done = true;
                              });
                              widget.onConfirmed();
                            } else {
                              setState(() => _progress = 0);
                            }
                          }
                        : null,
                    child: Container(
                      height: knob,
                      width: knob,
                      decoration: const BoxDecoration(
                        color: SwaplyColors.greenPressed,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: _done
                          ? const Icon(Icons.check, color: Colors.white, size: 26)
                          : const Text('›',
                              style: TextStyle(
                                  fontSize: 24,
                                  height: 1,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
