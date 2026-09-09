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
                padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
                children: [
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _line(Icons.north_east,
                            'Du gir ${trade.youGive.map((i) => i.title).join(' og ')} til $other'),
                        const SizedBox(height: Insets.sm),
                        _line(Icons.south_west,
                            'Du får ${trade.youGet.map((i) => i.title).join(' og ')} fra $from'),
                        if (trade.cash != null) ...[
                          const SizedBox(height: Insets.sm),
                          _line(
                            Icons.payments_outlined,
                            trade.cash!.youPay
                                ? 'Du betaler ${kr(trade.cash!.amountNok)} i mellomlegg via Vipps'
                                : '$from betaler deg ${kr(trade.cash!.amountNok)} i mellomlegg via Vipps',
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: Insets.lg),
                  const Text('Dette godtar du', style: Type.heading),
                  const SizedBox(height: Insets.sm),
                  ..._terms(other).map(_term),
                  const SizedBox(height: Insets.sm),
                  Container(
                    padding: const EdgeInsets.all(Insets.md),
                    decoration: BoxDecoration(
                      color: SwaplyColors.amberSoft,
                      borderRadius: BorderRadius.circular(Radii.card),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, size: 18, color: SwaplyColors.amber),
                        SizedBox(width: Insets.sm),
                        Expanded(
                          child: Text(
                            'Swaply er ikke part i byttet og fasiliterer ikke frakt eller '
                            'betaling. Avtalen er mellom dere.',
                            style: TextStyle(
                                fontSize: 13, height: 1.4, color: SwaplyColors.amber),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: Insets.sm),
                  TextButton(
                    onPressed: () => showDialog<void>(
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
                    style: TextButton.styleFrom(
                        foregroundColor: SwaplyColors.greenPressed,
                        padding: EdgeInsets.zero,
                        alignment: Alignment.centerLeft),
                    child: const Text('Les hele byttevilkårene ›'),
                  ),
                  const SizedBox(height: Insets.sm),
                  InkWell(
                    onTap: () => setState(() => _accepted = !_accepted),
                    child: Row(
                      children: [
                        Checkbox(
                          value: _accepted,
                          activeColor: SwaplyColors.greenPressed,
                          onChanged: (v) => setState(() => _accepted = v ?? false),
                        ),
                        const Expanded(
                          child: Text('Jeg har lest og godtar vilkårene', style: Type.body),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: Insets.lg),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Insets.screen, 0, Insets.screen, Insets.md),
              child: Column(
                children: [
                  SwipeToConfirm(
                    label: 'Sveip for å godta byttet',
                    enabled: _accepted && !_busy,
                    onConfirmed: _accept,
                  ),
                  const SizedBox(height: Insets.sm),
                  SecondaryButton('Avbryt', onPressed: () => Navigator.of(context).pop(false)),
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

  Widget _line(IconData icon, String text) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: SwaplyColors.greenPressed),
          const SizedBox(width: Insets.sm),
          Expanded(child: Text(text, style: Type.body)),
        ],
      );

  Widget _term(String text) => Padding(
        padding: const EdgeInsets.only(bottom: Insets.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check, size: 16, color: SwaplyColors.greenPressed),
            const SizedBox(width: Insets.sm),
            Expanded(child: Text(text, style: Type.body)),
          ],
        ),
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
    const height = 58.0;
    const knob = 50.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final travel = constraints.maxWidth - knob - 8;

        return Opacity(
          opacity: widget.enabled ? 1 : 0.5,
          child: Container(
            height: height,
            decoration: BoxDecoration(
              color: SwaplyColors.greenSoft,
              borderRadius: BorderRadius.circular(Radii.pill),
              border: Border.all(color: SwaplyColors.line),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Text(
                  _done ? 'Godtatt' : widget.label,
                  style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: SwaplyColors.greenDeep),
                ),
                Positioned(
                  left: 4 + _progress * travel,
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
                      child: Icon(_done ? Icons.check : Icons.chevron_right,
                          color: Colors.white, size: 26),
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
