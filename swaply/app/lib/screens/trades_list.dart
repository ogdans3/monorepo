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
            child: Text('Mine handler', style: Type.display),
          ),
          if (data != null && !empty)
            TabBar(
              controller: _tabs,
              labelColor: SwaplyColors.greenDeep,
              unselectedLabelColor: SwaplyColors.grey,
              indicatorColor: SwaplyColors.greenPressed,
              labelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
              tabs: [
                Tab(text: 'Venter · ${data.waiting.length}'),
                Tab(text: 'Aktive · ${data.active.length}'),
                Tab(text: 'Fullført · ${data.done.length}'),
              ],
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
      'pending' => yourTurn ? ('Din tur', SwaplyColors.greenDeep) : ('Venter på $other', SwaplyColors.greySoft),
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
        child: SectionCard(
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
              _leg('${trade.receivingFrom.displayName.split(' ').first} gir',
                  trade.youGet, 'deg'),
              const SizedBox(height: Insets.sm),
              _leg('${trade.givingTo.displayName.split(' ').first} får',
                  trade.youGive, null),
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

  Widget _leg(String label, List<Item> items, String? to) => Row(
        children: [
          if (items.isNotEmpty) ...[
            ItemThumb(items.first, size: 40, radius: 10),
            const SizedBox(width: Insets.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Type.small),
                Text(
                  items.isEmpty ? 'ingenting ennå' : items.map((i) => i.title).join(' + '),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (to != null) ...[
            const Icon(Icons.arrow_forward, size: 15, color: SwaplyColors.grey),
            const SizedBox(width: 4),
            Text(to, style: Type.small),
          ],
        ],
      );
}
