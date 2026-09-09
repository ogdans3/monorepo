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
                      padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
                      children: [
                        Text(
                          'Endre hva som byttes. $other får forslaget og må godta på nytt.',
                          style: Type.secondary,
                        ),
                        const SizedBox(height: Insets.lg),
                        Kicker('Du får · ${other}s ting'),
                        const SizedBox(height: Insets.sm),
                        ..._theirs.map((i) => _pickRow(i, _chosenTheirs)),
                        const SizedBox(height: Insets.lg),
                        const Kicker('Du gir · dine ting'),
                        const SizedBox(height: Insets.sm),
                        ..._mine.map((i) => _pickRow(i, _chosenMine)),
                        const SizedBox(height: Insets.lg),
                        SectionCard(
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Du får verdi', style: Type.secondary),
                                  Text(kr(getValue), style: Type.heading),
                                ],
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: Insets.sm),
                                child: Divider(height: 1, color: SwaplyColors.line),
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Du gir verdi', style: Type.secondary),
                                  Text(kr(giveValue), style: Type.heading),
                                ],
                              ),
                              const SizedBox(height: Insets.sm),
                              Align(
                                alignment: Alignment.centerRight,
                                child: Text(
                                    'differanse ${kr((getValue - giveValue).abs())}',
                                    style: Type.small),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: Insets.lg),
                        const Kicker('Mellomlegg'),
                        const SizedBox(height: Insets.sm),
                        _cashPicker(other, (getValue - giveValue).abs()),
                        const SizedBox(height: Insets.lg),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(Insets.screen),
                    child: Column(
                      children: [
                        PrimaryButton('Send motbytte',
                            busy: _busy,
                            enabled: _selectedMine.isNotEmpty || _selectedTheirs.isNotEmpty,
                            onPressed: _send),
                        const SizedBox(height: Insets.sm),
                        SecondaryButton('Avbryt',
                            onPressed: () => Navigator.of(context).pop(false)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  /// 09b: things another trade is holding are shown, and locked, rather than
  /// hidden — otherwise it looks like they were never there.
  Widget _pickRow(Item item, Set<String> selection) {
    final locked = item.lockedByOtherTrade;
    final selected = selection.contains(item.id);

    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.sm),
      child: InkWell(
        onTap: locked
            ? null
            : () => setState(() =>
                selected ? selection.remove(item.id) : selection.add(item.id)),
        borderRadius: BorderRadius.circular(Radii.card),
        child: Opacity(
          opacity: locked ? 0.55 : 1,
          child: SectionCard(
            padding: const EdgeInsets.all(Insets.sm + 2),
            child: Row(
              children: [
                ItemThumb(item, size: 48),
                const SizedBox(width: Insets.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title, style: Type.heading),
                      Text(
                        [
                          'verdi ${kr(item.estimatedValueNok)}',
                          if (locked) 'reservert i annet bytte',
                          if (item.inOffer && !locked) 'allerede i byttet',
                        ].join(' · '),
                        style: Type.small,
                      ),
                    ],
                  ),
                ),
                if (locked)
                  const StatePill('Låst', color: SwaplyColors.greySoft)
                else
                  Container(
                    height: 24,
                    width: 24,
                    decoration: BoxDecoration(
                      color: selected ? SwaplyColors.greenPressed : Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: selected
                              ? SwaplyColors.greenPressed
                              : const Color(0x33064E3B)),
                    ),
                    child: selected
                        ? const Icon(Icons.check, size: 15, color: Colors.white)
                        : null,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 09d. The suggested amount is the difference, because that is the number
  /// both people are already looking at.
  Widget _cashPicker(String other, int difference) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: _toggle('Jeg betaler', _iPay, () => setState(() => _iPay = true)),
                ),
                const SizedBox(width: Insets.sm),
                Expanded(
                  child: _toggle('$other betaler', !_iPay, () => setState(() => _iPay = false)),
                ),
              ],
            ),
            const SizedBox(height: Insets.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: () => setState(() => _cash = (_cash - 50).clamp(0, 1000000)),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text(_cash == 0 ? 'Ingen' : kr(_cash), style: Type.title),
                IconButton(
                  onPressed: () => setState(() => _cash += 50),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
            const SizedBox(height: Insets.sm),
            Wrap(
              spacing: Insets.sm,
              children: [
                for (final amount in {100, difference, 400}.where((a) => a > 0).toList()..sort())
                  ActionChip(
                    label: Text(kr(amount)),
                    onPressed: () => setState(() => _cash = amount),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: SwaplyColors.line),
                  ),
                ActionChip(
                  label: const Text('Ingen'),
                  onPressed: () => setState(() => _cash = 0),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: SwaplyColors.line),
                ),
              ],
            ),
            const SizedBox(height: Insets.sm),
            const Text(
              'Mellomlegget avtales mellom dere og betales utenfor appen. '
              'Swaply tar ikke imot penger.',
              style: Type.small,
            ),
          ],
        ),
      );

  Widget _toggle(String label, bool selected, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? SwaplyColors.greenPressed : Colors.white,
            borderRadius: BorderRadius.circular(Radii.pill),
            border: Border.all(
                color: selected ? SwaplyColors.greenPressed : const Color(0x22064E3B)),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : SwaplyColors.ink)),
        ),
      );
}
