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

  static const quickChips = ['Kom som avtalt', 'God kommunikasjon', 'Møtte ikke opp'];

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

    return Scaffold(
      appBar: AppBar(
        backgroundColor: SwaplyColors.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('Senere', style: TextStyle(color: SwaplyColors.greySoft)),
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
                  Text(
                    chain
                        ? 'Ble byttet gjennomført?'
                        : 'Hvordan var byttet\nmed ${_others.first.displayName.split(' ').first}?',
                    style: Type.display,
                  ),
                  if (chain) ...[
                    const SizedBox(height: Insets.sm),
                    const Text(
                      'Vi var ikke med på dette byttet, så si fra hvordan det gikk med de '
                      'to du byttet med.',
                      style: Type.secondary,
                    ),
                  ],
                  const SizedBox(height: Insets.xl),
                  for (final person in _others)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Insets.lg),
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
                          const SizedBox(height: Insets.sm),
                          StarRow(
                            value: (_scores[person.id] ?? 0).toDouble(),
                            size: 34,
                            onChanged: (v) => setState(() => _scores[person.id] = v),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: Insets.sm),
                  Wrap(
                    spacing: Insets.sm,
                    children: quickChips
                        .map((c) => FilterChip(
                              label: Text(c),
                              selected: _chips.contains(c),
                              onSelected: (on) =>
                                  setState(() => on ? _chips.add(c) : _chips.remove(c)),
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
                    decoration:
                        const InputDecoration(hintText: 'Si et par ord (valgfritt)…'),
                  ),
                  const SizedBox(height: Insets.sm),
                  const Text('Vurderinger bygger tillit i Swaply.', style: Type.small),
                  const SizedBox(height: Insets.lg),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Insets.screen),
              child: Column(
                children: [
                  PrimaryButton(chain ? 'Ja, send vurdering' : 'Send vurdering',
                      busy: _busy,
                      enabled: _scores.length == _others.length,
                      onPressed: _submit),
                  const SizedBox(height: Insets.sm),
                  SecondaryButton(chain ? 'Byttet ble ikke noe av' : 'Hopp over',
                      onPressed: () => Navigator.of(context).maybePop()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 06i. About us, not about the counterparty, and shown far less often.
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
