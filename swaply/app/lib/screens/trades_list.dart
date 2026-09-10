import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'trade_detail.dart';

/// 11 Mine handler, and 17a when there is nothing in any of the three tabs.
class TradesScreen extends StatefulWidget {
  const TradesScreen({super.key});

  @override
  State<TradesScreen> createState() => _TradesScreenState();
}

class _TradesScreenState extends State<TradesScreen> with SingleTickerProviderStateMixin {
  // Created eagerly rather than `late final`: with nothing to show, the tab bar
  // is never built, and a lazy field would first run its initialiser inside
  // dispose() — building a ticker against an element that is already gone.
  late final TabController _tabs;
  ({List<Trade> waiting, List<Trade> active, List<Trade> done, int yourTurn})? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<SwaplyApi>().trades();
      if (!mounted) return;
      setState(() => _data = data);
      await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final empty = data != null &&
        data.waiting.isEmpty &&
        data.active.isEmpty &&
        data.done.isEmpty;

    return SwaplyScaffold(
      currentTab: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, Insets.sm),
            child: Text('Mine handler', style: Type.screen),
          ),
          if (data != null && !empty)
            // A segmented control, not an underline: the export draws a grey
            // track with the chosen one as a white pill inside it.
            Padding(
              padding: const EdgeInsets.fromLTRB(Insets.screen, 0, Insets.screen, Insets.md),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: SwaplyColors.chip,
                  borderRadius: BorderRadius.circular(Radii.pill),
                ),
                child: TabBar(
                  controller: _tabs,
                  labelColor: SwaplyColors.ink,
                  unselectedLabelColor: SwaplyColors.chipInk,
                  labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  unselectedLabelStyle:
                      const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  dividerHeight: 0,
                  indicatorSize: TabBarIndicatorSize.tab,
                  splashBorderRadius: BorderRadius.circular(Radii.pill),
                  indicator: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(Radii.pill),
                  ),
                  tabs: [
                    Tab(height: 38, text: 'Venter · ${data.waiting.length}'),
                    Tab(height: 38, text: 'Aktive · ${data.active.length}'),
                    Tab(height: 38, text: 'Fullført · ${data.done.length}'),
                  ],
                ),
              ),
            ),
          Expanded(
            child: _error != null
                ? EmptyState(
                    title: 'Fikk ikke kontakt',
                    body: _error!,
                    icon: Icons.wifi_off,
                    actionLabel: 'Prøv igjen',
                    onAction: _load)
                : data == null
                    ? const Center(child: CircularProgressIndicator())
                    : empty
                        ? EmptyState(
                            icon: Icons.swap_horiz,
                            title: 'Ingen bytter ennå',
                            body: 'Lik noe på Oppdag, eller legg ut en ting. Når noen vil '
                                'bytte, havner det her.',
                            actionLabel: 'Gå til Oppdag',
                            onAction: () => Navigator.of(context)
                                .pushNamedAndRemoveUntil('/discover', (r) => false),
                          )
                        : TabBarView(
                            controller: _tabs,
                            children: [
                              _list(data.waiting),
                              _list(data.active),
                              _list(data.done),
                            ],
                          ),
          ),
        ],
      ),
    );
  }

  Widget _list(List<Trade> trades) {
    if (trades.isEmpty) {
      return const EmptyState(
        icon: Icons.inbox_outlined,
        title: 'Ingenting her',
        body: 'Bytter dukker opp her når de kommer i denne tilstanden.',
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(Insets.screen),
        itemCount: trades.length,
        itemBuilder: (context, i) => _card(trades[i]),
      ),
    );
  }

  Widget _card(Trade trade) {
    final yourTurn = !trade.youAccepted &&
        ['pending', 'countered'].contains(trade.state);
    final other = trade.receivingFrom.displayName.split(' ').first;

    final (label, colour) = switch (trade.state) {
      'talking' => ('Samtale', SwaplyColors.greySoft),
      'pending' => yourTurn
          ? ('Din tur', SwaplyColors.amber)
          : ('Venter på $other', SwaplyColors.greySoft),
      'countered' => ('Endret', SwaplyColors.amber),
      'accepted' => ('Godtatt', SwaplyColors.greenPressed),
      'paused' => ('Pauset', SwaplyColors.amber),
      'completed' => ('Gjennomført', SwaplyColors.greenPressed),
      _ => ('Avsluttet', SwaplyColors.red),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: () async {
          await Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => TradeDetailScreen(tradeId: trade.id)));
          await _load();
        },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Insets.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(Radii.card),
            // The one waiting on you wears a green edge, as the export draws it.
            border: Border.all(
                color: yourTurn ? SwaplyColors.greenPressed : SwaplyColors.cardLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(trade.isChain ? 'Bytte via kjede' : 'Direkte bytte',
                      style: Type.small),
                  const Spacer(),
                  StatePill(label, color: colour),
                ],
              ),
              const SizedBox(height: Insets.md),
              // «det du får → deg → det du gir», with the name over each thing.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _leg('${trade.receivingFrom.displayName.split(' ').first} gir',
                        trade.youGet, SwaplyColors.greenText),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: Insets.sm),
                    child: Column(
                      children: [
                        SizedBox(height: 30),
                        Icon(Icons.arrow_forward, size: 20, color: SwaplyColors.greenPressed),
                        SizedBox(height: 2),
                        Text('deg',
                            style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: SwaplyColors.inkBody)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _leg('${trade.givingTo.displayName.split(' ').first} får',
                        trade.youGive, SwaplyColors.amber),
                  ),
                ],
              ),
              if (yourTurn) ...[
                const SizedBox(height: Insets.md),
                PrimaryButton('Godta byttet', onPressed: () async {
                  await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => TradeDetailScreen(tradeId: trade.id)));
                  await _load();
                }),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// One side of the row: whose it is, the picture, and what it is. The name
  /// sits *over* the thing, as the export's caption says it should.
  Widget _leg(String label, List<Item> items, Color labelColour) => Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: labelColour),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 6),
          if (items.isEmpty)
            Container(
              height: 74,
              width: 74,
              decoration: BoxDecoration(
                color: SwaplyColors.chip,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.more_horiz, color: SwaplyColors.greyLight),
            )
          else
            ItemThumb(items.first, size: 74, radius: 14),
          const SizedBox(height: 6),
          Text(
            items.isEmpty ? 'ingenting ennå' : items.map((i) => i.title).join(' + '),
            style: const TextStyle(
                fontSize: 12.5, fontWeight: FontWeight.w700, color: SwaplyColors.ink),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      );
}
