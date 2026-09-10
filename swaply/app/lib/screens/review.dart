import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';

/// 09h Fullført. The moment the trade lands, before anything is asked of you.
class TradeCompletedScreen extends StatelessWidget {
  const TradeCompletedScreen({super.key, required this.trade});

  final Trade trade;

  @override
  Widget build(BuildContext context) {
    final other = trade.receivingFrom.displayName.split(' ').first;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Insets.screen),
          child: Column(
            children: [
              const Spacer(),
              Container(
                height: 76,
                width: 76,
                decoration: const BoxDecoration(
                    color: SwaplyColors.greenSoft, shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 40, color: SwaplyColors.greenPressed),
              ),
              const SizedBox(height: Insets.lg),
              const Text('Byttet er gjennomført!',
                  style: Type.display, textAlign: TextAlign.center),
              const SizedBox(height: Insets.sm),
              Text(
                'Du og $other har begge bekreftet. '
                '${trade.youGet.map((i) => i.title).join(' og ')} er din, '
                '${trade.youGive.map((i) => i.title).join(' og ')} er hans.',
                style: Type.secondary,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: Insets.xl),
              SectionCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Column(
                      children: [
                        Text(kr(trade.youGetValue), style: Type.title),
                        const Text('verdi inn', style: Type.small),
                      ],
                    ),
                    Column(
                      children: [
                        Text(kr(trade.youGiveValue), style: Type.title),
                        const Text('verdi ut', style: Type.small),
                      ],
                    ),
                  ],
                ),
              ),
              const Spacer(),
              PrimaryButton('Vurder $other', onPressed: () {
                Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => ReviewScreen(trade: trade)));
              }),
              const SizedBox(height: Insets.sm),
              SecondaryButton('Senere', onPressed: () => Navigator.of(context).maybePop()),
            ],
          ),
        ),
      ),
    );
  }
}

/// 06h Vurdering, and 07l when the trade was a chain and there are two people
/// to rate. The second screen exists because we were not part of that trade.
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.trade});

  final Trade trade;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final _scores = <String, int>{};
  final _comment = TextEditingController();
  final _chips = <String>{};
  bool _busy = false;


  List<UserRef> get _others =>
      widget.trade.participants.where((p) => p.position != widget.trade.youPosition).toList();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    final api = context.read<SwaplyApi>();
    try {
      for (final entry in _scores.entries) {
        await api.review(widget.trade.id,
            ratee: entry.key,
            score: entry.value,
            comment: _comment.text.trim().isEmpty ? null : _comment.text.trim(),
            chips: _chips.toList());
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => AppFeedbackScreen(trade: widget.trade)));
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final chain = widget.trade.isChain;
    final first = _others.first;

    // Centred and quiet: a face, a question, five stars, a box for a few
    // words. The chain variant asks the same of two people.
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(15, 0, 15, 0),
                children: [
                  if (!chain) ...[
                    const SizedBox(height: 143),
                    Center(child: Avatar(first.displayName, size: 76)),
                    const SizedBox(height: 18),
                    // Held to 280 so the question breaks after «byttet», as drawn.
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 280),
                        child: Text(
                            'Hvordan var byttet med ${first.displayName.split(' ').first}?',
                            style: Type.screen,
                            textAlign: TextAlign.center),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Center(child: _stars(first.id, 38, 10)),
                    const SizedBox(height: 28),
                  ] else ...[
                    const SizedBox(height: 60),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 15),
                      child: Text('Ble byttet gjennomført?',
                          style: Type.screen, textAlign: TextAlign.center),
                    ),
                    const SizedBox(height: 8),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 15),
                      child: Text(
                        'Vi var ikke med på dette byttet, så si fra hvordan det gikk med de '
                        'to du byttet med.',
                        style: TextStyle(fontSize: 14, height: 1.45, color: SwaplyColors.inkMuted),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 24),
                    for (final person in _others)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(15, 0, 15, 20),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Avatar(person.displayName, size: 40),
                                const SizedBox(width: Insets.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(person.displayName, style: Type.heading),
                                      Text(
                                        person.gives.isEmpty
                                            ? 'byttet med deg'
                                            : 'ga ${person.gives.map((i) => i.title).join(' og ')}',
                                        style: Type.small,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            _stars(person.id, 32, 8),
                          ],
                        ),
                      ),
                  ],
                  TextField(
                    controller: _comment,
                    minLines: 4,
                    maxLines: 6,
                    style: const TextStyle(fontSize: 14, color: SwaplyColors.ink),
                    decoration: InputDecoration(
                      hintText: 'Si et par ord (valgfritt)…',
                      hintStyle: const TextStyle(fontSize: 14, color: SwaplyColors.greyLight),
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: SwaplyColors.greenPressed)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('Vurderinger bygger tillit i Swaply.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: SwaplyColors.greyLight)),
                  const SizedBox(height: 20),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 34),
              child: Column(
                children: [
                  PrimaryButton('Send vurdering',
                      busy: _busy,
                      enabled: _others.every((p) => _scores.containsKey(p.id)),
                      onPressed: _submit),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      // A chain we were not part of may simply not have happened.
                      child: Text(chain ? 'Byttet ble ikke noe av' : 'Hopp over',
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
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

  /// Five «★» as text, green when given and pale when not, the way the
  /// export draws them.
  Widget _stars(String personId, double size, double gap) {
    final score = _scores[personId] ?? 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var n = 1; n <= 5; n++)
          GestureDetector(
            onTap: () => setState(() => _scores[personId] = n),
            child: Padding(
              padding: EdgeInsets.only(right: n < 5 ? gap : 0),
              child: Text('★',
                  style: TextStyle(
                      fontSize: size,
                      height: 1,
                      color: n <= score ? SwaplyColors.greenPressed : const Color(0xFFDCE1DB))),
            ),
          ),
      ],
    );
  }
}

class AppFeedbackScreen extends StatefulWidget {
  const AppFeedbackScreen({super.key, required this.trade});

  final Trade trade;

  @override
  State<AppFeedbackScreen> createState() => _AppFeedbackScreenState();
}

class _AppFeedbackScreenState extends State<AppFeedbackScreen> {
  int? _score;
  final _chips = <String>{};
  final _comment = TextEditingController();
  bool _busy = false;

  static const areas = [
    'Finne bytte',
    'Avtale i chat',
    'Mellomlegg',
    'Frakt',
    'Godta-flyten',
    'Ingenting',
  ];

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await context.read<SwaplyApi>().feedback(
            _score!,
            _chips.toList(),
            _comment.text.trim().isEmpty ? null : _comment.text.trim(),
          );
      if (mounted) {
        Navigator.of(context).pushNamedAndRemoveUntil('/trades', (r) => false);
      }
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final other = widget.trade.receivingFrom.displayName.split(' ').first;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: SwaplyColors.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil('/trades', (r) => false),
            child: const Text('Hopp over', style: TextStyle(color: SwaplyColors.greySoft)),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
                children: [
                  const Text('Hvordan var det å bytte med Swaply?', style: Type.display),
                  const SizedBox(height: Insets.sm),
                  Text('$other har fått sin. Et par sekunder fra deg gjør appen bedre.',
                      style: Type.secondary),
                  const SizedBox(height: Insets.xl),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(5, (i) {
                      final value = i + 1;
                      final selected = _score == value;
                      return GestureDetector(
                        onTap: () => setState(() => _score = value),
                        child: Container(
                          height: 52,
                          width: 52,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: selected ? SwaplyColors.greenPressed : Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: selected
                                    ? SwaplyColors.greenPressed
                                    : const Color(0x22064E3B)),
                          ),
                          child: Text('$value',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: selected ? Colors.white : SwaplyColors.ink)),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: Insets.sm),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Tungvint', style: Type.small),
                      Text('Sømløst', style: Type.small),
                    ],
                  ),
                  const SizedBox(height: Insets.xl),
                  const Text('Hva fungerte mindre bra?', style: Type.heading),
                  const SizedBox(height: Insets.sm),
                  Wrap(
                    spacing: Insets.sm,
                    runSpacing: Insets.sm,
                    children: areas
                        .map((a) => FilterChip(
                              label: Text(a),
                              selected: _chips.contains(a),
                              onSelected: (on) => setState(() {
                                // «Ingenting» is not one more thing that went
                                // wrong; it is the absence of them.
                                if (a == 'Ingenting') {
                                  _chips.clear();
                                  if (on) _chips.add(a);
                                } else {
                                  _chips.remove('Ingenting');
                                  on ? _chips.add(a) : _chips.remove(a);
                                }
                              }),
                              backgroundColor: Colors.white,
                              selectedColor: SwaplyColors.greenSoft,
                              side: const BorderSide(color: SwaplyColors.line),
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: Insets.md),
                  TextField(
                    controller: _comment,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                        hintText: 'Noe mer du vil si oss? (valgfritt)'),
                  ),
                  const SizedBox(height: Insets.lg),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Insets.screen),
              child: PrimaryButton('Send tilbakemelding',
                  busy: _busy, enabled: _score != null, onPressed: _submit),
            ),
          ],
        ),
      ),
    );
  }
}
