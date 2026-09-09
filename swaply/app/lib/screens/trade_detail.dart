import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'agreement.dart';
import 'chat.dart';
import 'counter_offer.dart';
import 'profile.dart';
import 'review.dart';

/// 06a Swap toveis and 07i Swap treveis. The celebration, and the only screen
/// that has to make a three-person loop legible.
class MatchScreen extends StatefulWidget {
  const MatchScreen({super.key, required this.tradeId});

  final String tradeId;

  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> {
  Trade? _trade;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final trade = await context.read<SwaplyApi>().trade(widget.tradeId);
      if (mounted) setState(() => _trade = trade);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trade = _trade;
    if (trade == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final chain = trade.isChain;
    final theyGive = trade.youGet.map((i) => i.title).join(' og ');
    final youGive = trade.youGive.map((i) => i.title).join(' og ');

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Insets.screen),
          child: Column(
            children: [
              const Spacer(),
              Text(
                chain ? 'Dere kan gjøre en\ntreveis-swap!' : 'Dere kan swappe!',
                style: Type.display.copyWith(fontSize: 30),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: Insets.md),
              Text(
                chain
                    ? 'Vi fant et bytte med tre personer.'
                    : '${trade.receivingFrom.displayName} vil ha $youGive, '
                        'du vil ha $theyGive.',
                style: Type.secondary,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: Insets.xl),
              _loop(trade),
              const SizedBox(height: Insets.xl),
              if (chain)
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
                          'Dette byttet kan ikke Swaply fasilitere, men vi kan starte en '
                          'chat så dere avtaler det selv.',
                          style: TextStyle(fontSize: 13, height: 1.4, color: SwaplyColors.amber),
                        ),
                      ),
                    ],
                  ),
                ),
              const Spacer(),
              PrimaryButton(
                chain ? 'Start chat' : 'Se byttet',
                onPressed: () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => TradeDetailScreen(tradeId: trade.id))),
              ),
              const SizedBox(height: Insets.sm),
              SecondaryButton('Fortsett å sveipe',
                  onPressed: () => Navigator.of(context).maybePop()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _loop(Trade trade) {
    if (trade.isChain) {
      return Column(
        children: [
          for (final p in trade.participants)
            Padding(
              padding: const EdgeInsets.only(bottom: Insets.sm),
              child: Row(
                children: [
                  Avatar(p.displayName, size: 34),
                  const SizedBox(width: Insets.sm),
                  Expanded(
                    child: Text(
                      '${p.position == trade.youPosition ? 'Du' : p.displayName} gir '
                      '${p.gives.map((i) => i.title).join(' og ')}',
                      style: Type.body,
                    ),
                  ),
                  const Icon(Icons.arrow_downward, size: 16, color: SwaplyColors.grey),
                ],
              ),
            ),
        ],
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _side(trade.youGive, 'Du', trade.youGive.length),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Insets.md),
          child: Text('⇄', style: TextStyle(fontSize: 30, color: SwaplyColors.greenPressed)),
        ),
        _side(trade.youGet, trade.receivingFrom.displayName, trade.youGet.length),
      ],
    );
  }

  Widget _side(List<Item> items, String label, int count) => Column(
        children: [
          Wrap(
            spacing: 6,
            children: items.take(2).map((i) => ItemThumb(i, size: 62)).toList(),
          ),
          const SizedBox(height: Insets.sm),
          Text(count > 1 ? '$label · $count ting' : label,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        ],
      );
}

/// The one trade screen, in every state the export draws: 06b your turn, 06e
/// waiting, 06f handover, 09e a counter arrived, 09f declined, 09i finished,
/// 07j the chain overview, 08b paused and 08c refused.
class TradeDetailScreen extends StatefulWidget {
  const TradeDetailScreen({super.key, required this.tradeId});

  final String tradeId;

  @override
  State<TradeDetailScreen> createState() => _TradeDetailScreenState();
}

class _TradeDetailScreenState extends State<TradeDetailScreen> {
  Trade? _trade;
  String? _error;
  bool _busy = false;
  final _message = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final trade = await context.read<SwaplyApi>().trade(widget.tradeId);
      if (mounted) setState(() => _trade = trade);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _run(Future<Trade> Function(SwaplyApi api) action) async {
    setState(() => _busy = true);
    try {
      final trade = await action(context.read<SwaplyApi>());
      if (!mounted) return;
      setState(() => _trade = trade);
      await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trade = _trade;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Bytte'),
        body: EmptyState(title: 'Fant ikke byttet', body: _error!, icon: Icons.error_outline),
      );
    }
    if (trade == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final other = trade.receivingFrom;
    final title = trade.isChain ? 'Ditt bytte' : 'Bytte med ${other.displayName.split(' ').first}';

    return SwaplyScaffold(
      currentTab: 2,
      appBar: swaplyAppBar(context, title,
          actions: [Padding(padding: const EdgeInsets.only(right: Insets.md), child: _statePill(trade))]),
      child: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(Insets.screen, 0, Insets.screen, Insets.lg),
                children: _sections(trade),
              ),
            ),
          ),
          _actions(trade),
        ],
      ),
    );
  }

  Widget _statePill(Trade trade) {
    final (label, colour) = switch (trade.state) {
      'talking' => ('Samtale', SwaplyColors.greySoft),
      'pending' => (trade.youAccepted ? 'Venter' : 'Din tur', SwaplyColors.greenDeep),
      'countered' => ('Endret', SwaplyColors.amber),
      'accepted' => ('Godtatt', SwaplyColors.greenPressed),
      'paused' => ('Pauset', SwaplyColors.amber),
      'completed' => ('Gjennomført', SwaplyColors.greenPressed),
      _ => ('Avslått', SwaplyColors.red),
    };
    return Center(child: StatePill(label, color: colour));
  }

  List<Widget> _sections(Trade trade) {
    final chain = trade.isChain;

    return [
      // 08b: the trade is paused while the other side answers.
      if (trade.state == 'paused' && trade.withdrawal != null) _withdrawalBanner(trade),
      // 08c: asked too late, because something had already been sent.
      if (trade.withdrawal?.state == 'rejected' && trade.withdrawal!.blockedBySent)
        _blockedBanner(trade),
      // 09e: a new proposal is on the table.
      if (trade.state == 'countered' && trade.counterOfferBy != trade.participants
              .firstWhere((p) => p.position == trade.youPosition, orElse: () => trade.receivingFrom).id)
        _noticeCard('Nytt forslag fra ${trade.receivingFrom.displayName.split(' ').first}. '
            'Godta, avslå eller foreslå noe annet.'),
      // 09f: it ended.
      if (trade.state == 'cancelled') _cancelledCard(trade),
      if (trade.state == 'completed') _completedHeader(trade),

      const SizedBox(height: Insets.md),
      Kicker(trade.state == 'completed' ? 'Du fikk' : 'Du får'),
      const SizedBox(height: Insets.sm),
      ...trade.youGet.map((i) => _itemRow(i,
          from: 'fra ${trade.receivingFrom.displayName.split(' ').first}',
          done: trade.youReceivedAt != null ? 'Mottatt' : null)),

      const SizedBox(height: Insets.lg),
      Kicker(trade.state == 'completed'
          ? 'Du ga'
          : trade.youGive.length > 1
              ? 'Du gir · ${trade.youGive.length} ting'
              : 'Du gir'),
      const SizedBox(height: Insets.sm),
      ...trade.youGive.map((i) => _itemRow(i,
          from: 'til ${trade.givingTo.displayName.split(' ').first}',
          done: trade.youSentAt != null ? 'Levert' : null)),

      if (!chain && ['talking', 'pending', 'countered'].contains(trade.state)) ...[
        const SizedBox(height: Insets.sm),
        TextButton.icon(
          onPressed: () => _openCounterOffer(trade),
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Legg til flere av dine ting'),
          style: TextButton.styleFrom(foregroundColor: SwaplyColors.greenPressed),
        ),
      ],

      // 07j: the leg that is neither yours to give nor yours to receive.
      for (final leg in trade.otherLegs) ...[
        const SizedBox(height: Insets.lg),
        Kicker('${leg.giver.displayName.split(' ').first} gir'),
        const SizedBox(height: Insets.sm),
        ...leg.items.map((i) =>
            _itemRow(i, from: 'til ${leg.receiver.displayName.split(' ').first}')),
      ],

      const SizedBox(height: Insets.lg),
      _valueSummary(trade),
      if (trade.cash != null) ...[
        const SizedBox(height: Insets.lg),
        _cashSection(trade),
      ],
      if (trade.state == 'accepted' && !chain) ...[
        const SizedBox(height: Insets.lg),
        _handoverSection(trade),
      ],
      if (trade.state != 'completed' && trade.state != 'cancelled') ...[
        const SizedBox(height: Insets.lg),
        _statusSection(trade),
      ],
      const SizedBox(height: Insets.lg),
      _conversationSection(trade),
      if (trade.state == 'completed') ...[
        const SizedBox(height: Insets.lg),
        _reviewSection(trade),
      ],
    ];
  }

  Widget _noticeCard(String text) => Padding(
        padding: const EdgeInsets.only(top: Insets.sm),
        child: Container(
          padding: const EdgeInsets.all(Insets.md),
          decoration: BoxDecoration(
            color: SwaplyColors.amberSoft,
            borderRadius: BorderRadius.circular(Radii.card),
          ),
          child: Text(text,
              style: const TextStyle(fontSize: 13.5, height: 1.4, color: SwaplyColors.amber)),
        ),
      );

  Widget _withdrawalBanner(Trade trade) {
    final w = trade.withdrawal!;
    final other = trade.receivingFrom.displayName.split(' ').first;
    final left = w.respondsBy?.difference(DateTime.now());

    return Padding(
      padding: const EdgeInsets.only(top: Insets.sm),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(w.byYou ? 'Vi hører med $other' : '$other vil trekke seg', style: Type.heading),
            const SizedBox(height: 6),
            Text(
              w.byYou
                  ? 'Byttet er pauset mens $other svarer på om det er greit at du trekker deg.'
                  : '$other har bedt om å trekke seg. Svarer du ja og ingenting er sendt, '
                      'avbrytes byttet.',
              style: Type.secondary,
            ),
            if (left != null && !left.isNegative) ...[
              const SizedBox(height: Insets.sm),
              Row(
                children: [
                  StatePill('${left.inDays}d ${left.inHours % 24}t igjen',
                      color: SwaplyColors.amber),
                  const SizedBox(width: Insets.sm),
                  const Expanded(
                    child: Text('Svarer ingen innen fristen, fortsetter byttet som vanlig.',
                        style: Type.small),
                  ),
                ],
              ),
            ],
            if (!w.byYou) ...[
              const SizedBox(height: Insets.md),
              Row(
                children: [
                  Expanded(
                    child: SecondaryButton('Nei',
                        onPressed: _busy
                            ? null
                            : () => _run((api) => api.respondToWithdrawal(trade.id, false))),
                  ),
                  const SizedBox(width: Insets.sm),
                  Expanded(
                    child: PrimaryButton('Ja, greit',
                        busy: _busy,
                        onPressed: () => _run((api) => api.respondToWithdrawal(trade.id, true))),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _blockedBanner(Trade trade) => Padding(
        padding: const EdgeInsets.only(top: Insets.sm),
        child: SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Du kan ikke trekke deg', style: Type.heading),
              const SizedBox(height: 6),
              Text(
                '${trade.receivingFrom.displayName.split(' ').first} har allerede sendt sin ting. '
                'Byttet fortsetter som normalt.',
                style: Type.secondary,
              ),
              const SizedBox(height: Insets.sm),
              const Text(
                'Fullfør din del av byttet ved å sende tingene dine. Er noe galt, kontakt support.',
                style: Type.small,
              ),
            ],
          ),
        ),
      );

  Widget _cancelledCard(Trade trade) => Padding(
        padding: const EdgeInsets.only(top: Insets.sm),
        child: SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Byttet er avsluttet', style: Type.heading),
              const SizedBox(height: 6),
              Text(
                trade.closeReason ??
                    'Tingene dine er tilgjengelige for andre igjen.',
                style: Type.secondary,
              ),
              const SizedBox(height: Insets.sm),
              const Text(
                'Angret du? Du kan sende et nytt forslag fra samtalen.',
                style: Type.small,
              ),
            ],
          ),
        ),
      );

  Widget _completedHeader(Trade trade) => Padding(
        padding: const EdgeInsets.only(top: Insets.sm),
        child: Text(
          trade.closedAt == null
              ? 'Gjennomført'
              : 'Fullført ${_longDate(trade.closedAt!)}',
          style: Type.small,
        ),
      );

  Widget _itemRow(Item item, {required String from, String? done}) => Padding(
        padding: const EdgeInsets.only(bottom: Insets.sm),
        child: SectionCard(
          padding: const EdgeInsets.all(Insets.sm + 2),
          child: Row(
            children: [
              ItemThumb(item, size: 52),
              const SizedBox(width: Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: Type.heading),
                    const SizedBox(height: 2),
                    Text('$from · verdi ${kr(item.estimatedValueNok)}', style: Type.small),
                  ],
                ),
              ),
              if (done != null)
                Row(
                  children: [
                    const Icon(Icons.check, size: 15, color: SwaplyColors.greenPressed),
                    const SizedBox(width: 3),
                    Text(done,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: SwaplyColors.greenPressed)),
                  ],
                ),
            ],
          ),
        ),
      );

  Widget _valueSummary(Trade trade) => SectionCard(
        child: Column(
          children: [
            _valueRow('Du får verdi', kr(trade.youGetValue)),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: Insets.sm),
              child: Divider(height: 1, color: SwaplyColors.line),
            ),
            _valueRow('Du gir verdi', kr(trade.youGiveValue)),
            if (trade.difference > 0) ...[
              const SizedBox(height: Insets.sm),
              Align(
                alignment: Alignment.centerRight,
                child: Text('differanse ${kr(trade.difference)}', style: Type.small),
              ),
            ],
          ],
        ),
      );

  Widget _valueRow(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Type.secondary),
          Text(value, style: Type.heading),
        ],
      );

  /// The cash difference. We show a number and a phone number; we never move it.
  Widget _cashSection(Trade trade) {
    final cash = trade.cash!;
    final settled = trade.youPaidAt != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Kicker('Mellomlegg'),
        const SizedBox(height: Insets.sm),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                cash.youPay
                    ? 'Du betaler ${kr(cash.amountNok)} til ${cash.payee.displayName.split(' ').first}'
                    : '${cash.payer.displayName.split(' ').first} betaler deg ${kr(cash.amountNok)}',
                style: Type.heading,
              ),
              const SizedBox(height: 4),
              Text(
                settled
                    ? '✓ betalt via Vipps'
                    : trade.state == 'accepted'
                        ? 'Betales direkte mellom dere, før noe sendes'
                        : 'betales når begge har godtatt',
                style: Type.small,
              ),
              if (cash.youPay && trade.state == 'accepted') ...[
                const SizedBox(height: Insets.md),
                Row(
                  children: [
                    Expanded(
                      child: Text('Vipps til ${cash.payee.displayName.split(' ').first}'
                          '${cash.payeePhone == null ? '' : ' · ${cash.payeePhone}'}',
                          style: Type.body),
                    ),
                    if (cash.payeePhone != null)
                      IconButton(
                        icon: const Icon(Icons.copy, size: 18),
                        tooltip: 'Kopiér',
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: cash.payeePhone!));
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Nummeret er kopiert')));
                        },
                      ),
                  ],
                ),
                const SizedBox(height: Insets.sm),
                SecondaryButton(
                  settled ? 'Marker som ikke betalt' : 'Marker som betalt',
                  onPressed: _busy
                      ? null
                      : () => _run((api) async =>
                          (await api.mark(trade.id, 'paid', value: !settled)).trade),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// 06f. Shipping is a link out and a checkbox: we do not carry anything.
  Widget _handoverSection(Trade trade) {
    final sent = trade.youSentAt != null;
    final received = trade.youReceivedAt != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Kicker('Du sender'),
        const SizedBox(height: Insets.sm),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(trade.youGive.map((i) => i.title).join(' + '), style: Type.heading),
              const SizedBox(height: 4),
              Text(
                'til ${trade.givingTo.displayName.split(' ').first} · frakt avtales utenfor '
                'appen, f.eks. PostNord',
                style: Type.small,
              ),
              const SizedBox(height: Insets.md),
              SecondaryButton(sent ? 'Marker som ikke sendt' : 'Marker som sendt',
                  onPressed: _busy
                      ? null
                      : () => _run((api) async =>
                          (await api.mark(trade.id, 'sent', value: !sent)).trade)),
            ],
          ),
        ),
        const SizedBox(height: Insets.lg),
        const Kicker('På vei til deg'),
        const SizedBox(height: Insets.sm),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(trade.youGet.map((i) => i.title).join(' + '), style: Type.heading),
              const SizedBox(height: 4),
              Text('fra ${trade.receivingFrom.displayName.split(' ').first} · '
                  'avtal detaljer i samtalen', style: Type.small),
              const SizedBox(height: Insets.md),
              SecondaryButton(received ? 'Marker som ikke mottatt' : 'Marker som mottatt',
                  onPressed: _busy
                      ? null
                      : () => _run((api) async {
                            final result = await api.mark(trade.id, 'received', value: !received);
                            if (result.complete && mounted) {
                              await Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) => TradeCompletedScreen(trade: result.trade)));
                            }
                            return result.trade;
                          })),
            ],
          ),
        ),
      ],
    );
  }

  Widget _statusSection(Trade trade) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Kicker('Status'),
          const SizedBox(height: Insets.sm),
          SectionCard(
            child: Column(
              children: [
                for (final p in trade.participants)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Avatar(p.displayName, size: 32),
                        const SizedBox(width: Insets.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  p.position == trade.youPosition
                                      ? 'Du'
                                      : p.displayName,
                                  style: const TextStyle(
                                      fontSize: 14, fontWeight: FontWeight.w600)),
                              Text('gir ${p.gives.map((i) => i.title).join(' og ')}',
                                  style: Type.small),
                            ],
                          ),
                        ),
                        StatePill(
                          p.accepted == true ? '✓ Har godtatt' : 'Venter',
                          color: p.accepted == true
                              ? SwaplyColors.greenPressed
                              : SwaplyColors.greySoft,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      );

  /// The conversation is available at every stage, including while you wait.
  Widget _conversationSection(Trade trade) {
    final name = trade.isChain
        ? 'alle'
        : trade.receivingFrom.displayName.split(' ').first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Kicker(trade.isChain ? 'Chat · alle tre' : 'Samtale med $name'),
            if (trade.threadId != null)
              GestureDetector(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ThreadScreen(threadId: trade.threadId!))),
                child: const Text('Åpne ›',
                    style: TextStyle(fontSize: 13, color: SwaplyColors.greenPressed)),
              ),
          ],
        ),
        const SizedBox(height: Insets.sm),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (trade.lastMessage != null) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Avatar(trade.lastMessage!.senderName ?? '?', size: 26),
                    const SizedBox(width: Insets.sm),
                    Expanded(child: Text(trade.lastMessage!.body, style: Type.body)),
                  ],
                ),
                const SizedBox(height: Insets.md),
              ],
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _message,
                      decoration: InputDecoration(
                          hintText: trade.isChain ? 'Skriv til begge…' : 'Skriv en melding…'),
                    ),
                  ),
                  const SizedBox(width: Insets.sm),
                  SizedBox(
                    height: 48,
                    child: FilledButton(
                      onPressed: trade.threadId == null
                          ? null
                          : () async {
                              final text = _message.text.trim();
                              if (text.isEmpty) return;
                              try {
                                await context
                                    .read<SwaplyApi>()
                                    .sendMessage(trade.threadId!, text);
                                _message.clear();
                                await _load();
                              } on ApiException catch (e) {
                                if (mounted) showError(context, e);
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: SwaplyColors.greenPressed,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(Radii.pill)),
                      ),
                      child: const Text('Send'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reviewSection(Trade trade) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Kicker('Din vurdering av ${trade.receivingFrom.displayName.split(' ').first}'),
          const SizedBox(height: Insets.sm),
          SectionCard(
            child: trade.yourReviewScore == null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Du har ikke vurdert byttet ennå.', style: Type.secondary),
                      const SizedBox(height: Insets.sm),
                      SecondaryButton('Vurder byttet',
                          onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => ReviewScreen(trade: trade)))),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (trade.yourReviewComment != null)
                        Text('«${trade.yourReviewComment}»', style: Type.body),
                      const SizedBox(height: 6),
                      StarRow(value: trade.yourReviewScore!.toDouble(), size: 16),
                    ],
                  ),
          ),
          const SizedBox(height: Insets.md),
          TextButton.icon(
            onPressed: () => showReportSheet(context,
                userId: trade.receivingFrom.id, personName: trade.receivingFrom.displayName),
            icon: const Icon(Icons.flag_outlined, size: 17, color: SwaplyColors.red),
            label: const Text('Rapporter et problem med byttet',
                style: TextStyle(color: SwaplyColors.red)),
          ),
        ],
      );

  Widget _actions(Trade trade) {
    final children = <Widget>[];

    if (['talking', 'pending', 'countered'].contains(trade.state)) {
      if (!trade.youAccepted) {
        children.add(Row(
          children: [
            Expanded(
              child: SecondaryButton('Avslå',
                  destructive: true,
                  onPressed: _busy ? null : () => _confirmDecline(trade)),
            ),
            const SizedBox(width: Insets.sm),
            Expanded(
              flex: 2,
              child: PrimaryButton('Godta byttet',
                  busy: _busy,
                  onPressed: () async {
                    final session = context.read<Session>();
                    final accepted = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => AgreementScreen(trade: trade)));
                    if (accepted == true) await _load();
                    await session.refresh();
                  }),
            ),
          ],
        ));
        children.add(const SizedBox(height: Insets.sm));
      }
      if (!trade.isChain) {
        children.add(SecondaryButton('Foreslå motbytte',
            onPressed: _busy ? null : () => _openCounterOffer(trade)));
      }
      if (trade.youAccepted) {
        children.add(const SizedBox(height: Insets.sm));
        children.add(SecondaryButton('Trekk deg fra byttet',
            destructive: true, onPressed: _busy ? null : () => _confirmWithdrawEarly(trade)));
      }
    } else if (trade.state == 'accepted') {
      if (trade.isChain) {
        children.add(PrimaryButton('Marker byttet som gjennomført',
            busy: _busy,
            onPressed: () => _run((api) => api.completeChainTrade(trade.id))));
        children.add(const SizedBox(height: Insets.sm));
      }
      children.add(SecondaryButton('Trekk deg fra byttet',
          destructive: true, onPressed: _busy ? null : () => _confirmWithdrawLate(trade)));
    } else if (trade.state == 'paused' && (trade.withdrawal?.byYou ?? false)) {
      children.add(SecondaryButton('Angre forespørselen',
          onPressed: _busy ? null : () => _run((api) => api.cancelWithdrawal(trade.id))));
    } else if (trade.state == 'cancelled') {
      children.add(SecondaryButton('Tilbake til Bytter',
          onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil('/trades', (r) => false)));
    } else if (trade.state == 'completed' && trade.yourReviewScore == null) {
      children.add(PrimaryButton(
          'Vurder ${trade.receivingFrom.displayName.split(' ').first}',
          onPressed: () async {
            await Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => ReviewScreen(trade: trade)));
            await _load();
          }));
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(Insets.screen, Insets.md, Insets.screen, Insets.md),
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.line)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }

  Future<void> _openCounterOffer(Trade trade) async {
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => CounterOfferScreen(trade: trade)));
    if (changed == true) await _load();
  }

  Future<void> _confirmDecline(Trade trade) async {
    final yes = await _confirm(
      title: 'Avslå byttet?',
      body: 'Tingene deres blir tilgjengelige for andre igjen, og '
          '${trade.receivingFrom.displayName.split(' ').first} får beskjed.',
      confirm: 'Avslå byttet',
    );
    if (yes == true) await _run((api) => api.decline(trade.id));
  }

  /// 09g. Nobody has committed anything, so it just ends.
  Future<void> _confirmWithdrawEarly(Trade trade) async {
    final other = trade.receivingFrom.displayName.split(' ').first;
    final yes = await _confirm(
      title: 'Trekke deg fra byttet?',
      body: '$other har ikke godtatt ennå, så byttet avbrytes med en gang. '
          'Ingen har sendt noe.',
      bullets: const [
        'Tingene dine blir tilgjengelige igjen',
        'Den andre får beskjed, samtalen beholdes',
      ],
      confirm: 'Trekk meg fra byttet',
    );
    if (yes == true) await _run((api) => api.withdrawEarly(trade.id));
  }

  /// 08a. Everyone accepted, so it is a question, not a decision.
  Future<void> _confirmWithdrawLate(Trade trade) async {
    // Read before the sheet: after awaiting it, the context may be gone.
    final api = context.read<SwaplyApi>();
    final other = trade.receivingFrom.displayName.split(' ').first;
    final yes = await _confirm(
      title: 'Vil du trekke deg fra byttet?',
      body: 'Dere har begge godtatt, og $other kan allerede ha sendt tingen sin. '
          'Vi spør $other om det er greit at du trekker deg.',
      bullets: [
        'Har $other ikke sendt noe, avbrytes byttet når han sier ja',
        'Har $other allerede sendt, kan du ikke trekke deg',
      ],
      confirm: 'Spør om å trekke meg',
    );
    if (yes != true) return;

    setState(() => _busy = true);
    try {
      final result = await api.requestWithdrawal(trade.id);
      if (!mounted) return;
      setState(() => _trade = result.trade);
      if (result.blocked) {
        await _confirm(
          title: 'Du kan ikke trekke deg',
          body: '$other har allerede sendt sin ting. Byttet fortsetter som normalt.',
          confirm: 'Tilbake til byttet',
          cancel: null,
        );
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool?> _confirm({
    required String title,
    required String body,
    required String confirm,
    String? cancel = 'Avbryt',
    List<String> bullets = const [],
  }) =>
      showModalBottomSheet<bool>(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
        builder: (sheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Insets.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(title, style: Type.title),
                const SizedBox(height: Insets.sm),
                Text(body, style: Type.secondary),
                if (bullets.isNotEmpty) ...[
                  const SizedBox(height: Insets.md),
                  for (final line in bullets)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.check, size: 16, color: SwaplyColors.greenPressed),
                          const SizedBox(width: Insets.sm),
                          Expanded(child: Text(line, style: Type.body)),
                        ],
                      ),
                    ),
                ],
                const SizedBox(height: Insets.lg),
                PrimaryButton(confirm, onPressed: () => Navigator.of(sheet).pop(true)),
                if (cancel != null) ...[
                  const SizedBox(height: Insets.sm),
                  SecondaryButton(cancel, onPressed: () => Navigator.of(sheet).pop(false)),
                ],
              ],
            ),
          ),
        ),
      );
}

const _months = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

String _longDate(DateTime date) => '${date.day}. ${_months[date.month - 1]} ${date.year}';
