import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';

/// 09a Foreslå motbytte, with 09b «Legg til ting», 09c «Foreslå ting»,
/// 09c2 «Be om ekstra» and 09d «Foreslå mellomlegg» folded into it as sheets.
///
/// A counter-offer is a new version of the deal, never an edit of the old one,
/// which is why the copy says the other party has to accept again.
class CounterOfferScreen extends StatefulWidget {
  const CounterOfferScreen({super.key, required this.trade});

  final Trade trade;

  @override
  State<CounterOfferScreen> createState() => _CounterOfferScreenState();
}

class _CounterOfferScreenState extends State<CounterOfferScreen> {
  List<Item> _mine = const [];
  List<Item> _theirs = const [];
  final _chosenMine = <String>{};
  final _chosenTheirs = <String>{};
  int _cash = 0;
  bool _iPay = true;
  bool _loading = true;
  bool _busy = false;

  int get _theirPosition {
    final p = widget.trade.receivingFrom.position;
    return p ?? (widget.trade.youPosition == 0 ? 1 : 0);
  }

  @override
  void initState() {
    super.initState();
    _chosenMine.addAll(widget.trade.youGive.map((i) => i.id));
    _chosenTheirs.addAll(widget.trade.youGet.map((i) => i.id));
    _cash = widget.trade.cash?.amountNok ?? 0;
    _iPay = widget.trade.cash?.youPay ?? true;
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<SwaplyApi>().candidates(widget.trade.id);
      if (!mounted) return;
      setState(() {
        _mine = result.yours;
        _theirs = result.theirs;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _loading = false);
      }
    }
  }

  int _sum(Iterable<Item> items) =>
      items.fold(0, (total, i) => total + (i.estimatedValueNok ?? 0));

  List<Item> get _selectedMine => _mine.where((i) => _chosenMine.contains(i.id)).toList();
  List<Item> get _selectedTheirs => _theirs.where((i) => _chosenTheirs.contains(i.id)).toList();

  Future<void> _send() async {
    if (_selectedMine.isEmpty && _selectedTheirs.isEmpty) return;
    setState(() => _busy = true);
    try {
      await context.read<SwaplyApi>().counter(
        widget.trade.id,
        [
          for (final i in _selectedMine)
            {'itemId': i.id, 'giverPosition': widget.trade.youPosition},
          for (final i in _selectedTheirs) {'itemId': i.id, 'giverPosition': _theirPosition},
        ],
        _cash <= 0
            ? null
            : {
                'payerPosition': _iPay ? widget.trade.youPosition : _theirPosition,
                'payeePosition': _iPay ? _theirPosition : widget.trade.youPosition,
                'amountNok': _cash,
              },
      );
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
    final other = widget.trade.receivingFrom.displayName.split(' ').first;
    final getValue = _sum(_selectedTheirs);
    final giveValue = _sum(_selectedMine);

    return Scaffold(
      appBar: swaplyAppBar(context, 'Motbytte', subtitle: 'Til $other'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(22, 12, 22, 12),
                      children: [
                        Text(
                          'Endre hva som byttes. $other får forslaget og må godta på nytt.',
                          style: const TextStyle(
                              fontSize: 13, height: 1.5, color: SwaplyColors.inkMuted),
                        ),
                        const SizedBox(height: 9),
                        _side('Du får · ${other}s ting', SwaplyColors.greenText, _theirs,
                            _chosenTheirs),
                        const SizedBox(height: 9),
                        _side('Du gir · dine ting', SwaplyColors.amberText, _mine, _chosenMine),
                        const SizedBox(height: 9),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Row(
                            children: [
                              Expanded(child: _value('Du får', SwaplyColors.greenText, getValue)),
                              Text('differanse ${kr((getValue - giveValue).abs())}',
                                  style: const TextStyle(
                                      fontSize: 11, color: SwaplyColors.greyLight)),
                              Expanded(
                                  child: _value('Du gir', SwaplyColors.amberText, giveValue,
                                      end: true)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 9),
                        _cashPicker(other),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 12),
                    child: Column(
                      children: [
                        PrimaryButton('Send motbytte',
                            busy: _busy,
                            enabled: _selectedMine.isNotEmpty || _selectedTheirs.isNotEmpty,
                            onPressed: _send),
                        const SizedBox(height: 8),
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

  Widget _value(String label, Color colour, int value, {bool end = false}) => Text.rich(
        TextSpan(children: [
          TextSpan(text: '$label ', style: TextStyle(fontWeight: FontWeight.w700, color: colour)),
          TextSpan(text: 'verdi ${kr(value)}'),
        ]),
        textAlign: end ? TextAlign.end : TextAlign.start,
        style: const TextStyle(fontSize: 12, color: SwaplyColors.inkMuted),
      );

  /// One card per side, the kicker inside it, a row per thing with a square
  /// tick at the right.
  Widget _side(String kicker, Color colour, List<Item> items, Set<String> selection) =>
      SectionCard(
        radius: 16,
        padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(kicker.toUpperCase(),
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.66, color: colour)),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const Text('Ingenting å velge mellom.', style: Type.secondary),
            for (final (i, item) in items.indexed) ...[
              if (i > 0) const SizedBox(height: 9),
              _pickRow(item, selection),
            ],
          ],
        ),
      );

  /// 09b: things another trade is holding are shown, and locked, rather than
  /// hidden — otherwise it looks like they were never there.
  Widget _pickRow(Item item, Set<String> selection) {
    final locked = item.lockedByOtherTrade;
    final selected = selection.contains(item.id);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: locked
          ? null
          : () => setState(() => selected ? selection.remove(item.id) : selection.add(item.id)),
      child: Opacity(
        opacity: locked ? 0.55 : 1,
        child: Row(
          children: [
            ItemThumb(item, size: 44, radius: 11),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
                  Text(
                    [
                      'verdi ${kr(item.estimatedValueNok)}',
                      if (locked) 'reservert i annet bytte',
                      if (item.inOffer && !locked) 'allerede i byttet',
                    ].join(' · '),
                    style: const TextStyle(fontSize: 11.5, color: SwaplyColors.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (locked)
              const StatePill('Låst', color: SwaplyColors.inkMuted)
            else
              _tick(selected),
          ],
        ),
      ),
    );
  }

  /// 26 across with a two-pixel edge when off; 22, filled, with a white tick
  /// when on. The box shrinks a little as it fills, the way the export draws it.
  Widget _tick(bool on) => SizedBox(
        width: 26,
        height: 26,
        child: Center(
          child: Container(
            width: on ? 22 : 26,
            height: on ? 22 : 26,
            decoration: BoxDecoration(
              color: on ? SwaplyColors.greenPressed : null,
              borderRadius: BorderRadius.circular(7),
              border: on ? null : Border.all(color: SwaplyColors.chevron, width: 2),
            ),
            child: on
                ? const Text('✓',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        fontWeight: FontWeight.w800,
                        color: Colors.white))
                : null,
          ),
        ),
      );

  /// 09d. «MELLOMLEGG · Du betaler Ola» and a stepper; the words flip who pays
  /// when tapped. The suggested amount is the difference, because that is the
  /// number both people are already looking at.
  Widget _cashPicker(String other) => SectionCard(
        radius: 16,
        padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _iPay = !_iPay),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('MELLOMLEGG',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.66,
                            color: SwaplyColors.greyLight)),
                    const SizedBox(height: 2),
                    Text(
                      _cash == 0
                          ? 'Ingen mellomlegg'
                          : _iPay
                              ? 'Du betaler $other'
                              : '$other betaler deg',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: SwaplyColors.ink),
                    ),
                  ],
                ),
              ),
            ),
            _step('−', () => setState(() => _cash = (_cash - 50).clamp(0, 1000000))),
            const SizedBox(width: 8),
            SizedBox(
              width: 60,
              child: Text(kr(_cash),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: SwaplyColors.ink)),
            ),
            const SizedBox(width: 8),
            _step('+', () => setState(() => _cash += 50)),
          ],
        ),
      );

  Widget _step(String glyph, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: SwaplyColors.fieldLine),
          ),
          child: Text(glyph,
              style: const TextStyle(
                  fontSize: 16, height: 1, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
        ),
      );
}
