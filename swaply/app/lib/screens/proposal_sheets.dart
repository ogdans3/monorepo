import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';

/// The three sheets behind the chips over the message field: 09c «Foreslå
/// ting», 09c2 «Be om ekstra» and 09d «Foreslå mellomlegg».
///
/// Each one writes a new offer version and drops a line in the conversation, so
/// the other side sees a card they can answer rather than a silent change.
enum ProposalKind { offerMine, askTheirs, cash }

Future<bool> showProposalSheet(
  BuildContext context, {
  required Trade trade,
  required ProposalKind kind,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (_) => _ProposalSheet(
      trade: trade,
      kind: kind,
      api: context.read<SwaplyApi>(),
    ),
  );
  return result ?? false;
}

class _ProposalSheet extends StatefulWidget {
  const _ProposalSheet({required this.trade, required this.kind, required this.api});

  final Trade trade;
  final ProposalKind kind;
  final SwaplyApi api;

  @override
  State<_ProposalSheet> createState() => _ProposalSheetState();
}

class _ProposalSheetState extends State<_ProposalSheet> {
  List<Item> _mine = const [];
  List<Item> _theirs = const [];
  Item? _chosen;
  late int _amount = widget.trade.cash?.amountNok ?? widget.trade.difference;
  late bool _iPay = widget.trade.cash?.youPay ?? (widget.trade.youGetValue > widget.trade.youGiveValue);
  bool _loading = true;
  bool _busy = false;

  String get _other => widget.trade.receivingFrom.displayName.split(' ').first;

  int get _theirPosition =>
      widget.trade.receivingFrom.position ?? (widget.trade.youPosition == 0 ? 1 : 0);

  @override
  void initState() {
    super.initState();
    if (widget.kind == ProposalKind.cash) {
      _loading = false;
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final result = await widget.api.candidates(widget.trade.id);
      if (!mounted) return;
      setState(() {
        _mine = result.yours.where((i) => !i.lockedByOtherTrade).toList();
        _theirs = result.theirs.where((i) => !i.lockedByOtherTrade).toList();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _send() async {
    setState(() => _busy = true);
    final trade = widget.trade;

    // A proposal is a whole new version of the deal, so it carries everything
    // already agreed plus the one thing being changed.
    final items = <Map<String, dynamic>>[
      for (final i in trade.youGive) {'itemId': i.id, 'giverPosition': trade.youPosition},
      for (final i in trade.youGet) {'itemId': i.id, 'giverPosition': _theirPosition},
    ];

    Map<String, dynamic>? cash = trade.cash == null
        ? null
        : {
            'payerPosition': trade.cash!.youPay ? trade.youPosition : _theirPosition,
            'payeePosition': trade.cash!.youPay ? _theirPosition : trade.youPosition,
            'amountNok': trade.cash!.amountNok,
          };

    switch (widget.kind) {
      case ProposalKind.offerMine:
        items.add({'itemId': _chosen!.id, 'giverPosition': trade.youPosition});
      case ProposalKind.askTheirs:
        items.add({'itemId': _chosen!.id, 'giverPosition': _theirPosition});
      case ProposalKind.cash:
        cash = _amount <= 0
            ? null
            : {
                'payerPosition': _iPay ? trade.youPosition : _theirPosition,
                'payeePosition': _iPay ? _theirPosition : trade.youPosition,
                'amountNok': _amount,
              };
    }

    try {
      await widget.api.counter(trade.id, items, cash);
      if (trade.threadId != null) {
        await widget.api.sendMessage(trade.threadId!, _messageLine());
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        showError(context, e);
        setState(() => _busy = false);
      }
    }
  }

  String _messageLine() => switch (widget.kind) {
        ProposalKind.offerMine => 'Jeg foreslår ${_chosen!.title} '
            '(verdi ${kr(_chosen!.estimatedValueNok)}) i byttet.',
        ProposalKind.askTheirs =>
          'Kan jeg få ${_chosen!.title} i tillegg? Da er vi nærmere skuls.',
        ProposalKind.cash => _amount == 0
            ? 'Jeg foreslår at vi dropper mellomlegget.'
            : _iPay
                ? 'Jeg foreslår at jeg legger til ${kr(_amount)} i mellomlegg.'
                : 'Jeg foreslår at du legger til ${kr(_amount)} i mellomlegg.',
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: Insets.lg,
        right: Insets.lg,
        top: Insets.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + Insets.lg,
      ),
      child: SingleChildScrollView(
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(Insets.xl),
                child: Center(child: CircularProgressIndicator()))
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(_title(), style: Type.title),
                  const SizedBox(height: Insets.sm),
                  Text(_blurb(), style: Type.secondary),
                  const SizedBox(height: Insets.lg),
                  if (widget.kind == ProposalKind.cash)
                    _cashBody()
                  else
                    ..._pickList(
                        widget.kind == ProposalKind.offerMine ? _mine : _theirs),
                  const SizedBox(height: Insets.lg),
                  PrimaryButton(
                    _confirmLabel(),
                    busy: _busy,
                    enabled: widget.kind == ProposalKind.cash || _chosen != null,
                    onPressed: _send,
                  ),
                  const SizedBox(height: Insets.sm),
                  SecondaryButton('Avbryt', onPressed: () => Navigator.of(context).pop(false)),
                ],
              ),
      ),
    );
  }

  String _title() => switch (widget.kind) {
        ProposalKind.offerMine => 'Foreslå en av dine ting',
        ProposalKind.askTheirs => 'Vil du ha noe mer av $_other?',
        ProposalKind.cash => 'Foreslå mellomlegg',
      };

  String _blurb() => switch (widget.kind) {
        ProposalKind.offerMine =>
          '$_other får et kort i samtalen og kan svare «Jeg vil ha» direkte.',
        ProposalKind.askTheirs => 'Velg blant tingene til $_other. $_other får et kort i '
            'samtalen og kan si ja eller foreslå mellomlegg.',
        ProposalKind.cash => _cashBlurb(),
      };

  String _cashBlurb() {
    final get = widget.trade.youGet.firstOrNull;
    final give = widget.trade.youGive.firstOrNull;
    if (get == null || give == null) {
      return 'Mellomlegget avtales mellom dere og betales utenfor appen.';
    }
    return '${get.title} er verdt ${kr(get.estimatedValueNok)}, ${give.title} '
        '${kr(give.estimatedValueNok)}. Differansen er ${kr(widget.trade.difference)}.';
  }

  String _confirmLabel() => switch (widget.kind) {
        ProposalKind.offerMine =>
          _chosen == null ? 'Foreslå' : 'Foreslå ${_chosen!.title}',
        ProposalKind.askTheirs =>
          _chosen == null ? 'Be om i tillegg' : 'Be om ${_chosen!.title} i tillegg',
        ProposalKind.cash => _amount == 0 ? 'Foreslå ingen mellomlegg' : 'Foreslå ${kr(_amount)}',
      };

  List<Widget> _pickList(List<Item> items) {
    if (items.isEmpty) {
      return [
        Text(
          widget.kind == ProposalKind.offerMine
              ? 'Du har ingen ledige ting å foreslå. Legg ut noe først.'
              : '$_other har ingenting annet ute akkurat nå.',
          style: Type.secondary,
        ),
      ];
    }
    return items
        .map((item) => Padding(
              padding: const EdgeInsets.only(bottom: Insets.sm),
              child: InkWell(
                borderRadius: BorderRadius.circular(Radii.card),
                onTap: () => setState(() => _chosen = item),
                child: SectionCard(
                  padding: const EdgeInsets.all(Insets.sm + 2),
                  child: Row(
                    children: [
                      ItemThumb(item, size: 44),
                      const SizedBox(width: Insets.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: Type.heading),
                            Text('Verdi ${kr(item.estimatedValueNok)}', style: Type.small),
                          ],
                        ),
                      ),
                      if (_chosen?.id == item.id)
                        const Icon(Icons.check_circle,
                            color: SwaplyColors.greenPressed, size: 22),
                    ],
                  ),
                ),
              ),
            ))
        .toList();
  }

  Widget _cashBody() => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _toggle('Jeg betaler', _iPay, () => setState(() => _iPay = true)),
              ),
              const SizedBox(width: Insets.sm),
              Expanded(
                child: _toggle('$_other betaler', !_iPay, () => setState(() => _iPay = false)),
              ),
            ],
          ),
          const SizedBox(height: Insets.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: () => setState(() => _amount = (_amount - 50).clamp(0, 1000000)),
                icon: const Icon(Icons.remove_circle_outline),
              ),
              Text(_amount == 0 ? 'Ingen' : kr(_amount), style: Type.title),
              IconButton(
                onPressed: () => setState(() => _amount += 50),
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          const SizedBox(height: Insets.sm),
          Wrap(
            spacing: Insets.sm,
            alignment: WrapAlignment.center,
            children: [
              for (final amount in {100, widget.trade.difference, 400}
                  .where((a) => a > 0)
                  .toList()
                ..sort())
                ActionChip(
                  label: Text(kr(amount)),
                  onPressed: () => setState(() => _amount = amount),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: SwaplyColors.line),
                ),
              ActionChip(
                label: const Text('Ingen'),
                onPressed: () => setState(() => _amount = 0),
                backgroundColor: Colors.white,
                side: const BorderSide(color: SwaplyColors.line),
              ),
            ],
          ),
        ],
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : SwaplyColors.ink)),
        ),
      );
}
