import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/confetti.dart';
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
      return const Scaffold(
        backgroundColor: SwaplyColors.greenDeep,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    final chain = trade.isChain;
    final other = trade.receivingFrom.displayName.split(' ').first;
    final theyGive = trade.youGet.map((i) => i.title).join(' og ');
    final youGive = trade.youGive.map((i) => i.title).join(' og ');

    // The one screen the export drenches: deep green, white type, the two
    // things tilted like photographs somebody put on a table. «The moment is
    // the product», and a moment does not look like the rest of the app.
    return Scaffold(
      backgroundColor: SwaplyColors.greenDeep,
      body: Stack(
        children: [
          // Confetti, starting at the four spots the export puts it and
          // drifting up from there.
          const Positioned.fill(child: Confetti()),
          SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 30),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 153),
                        Text(
                          chain ? 'Dere kan gjøre en treveis-swap!' : 'Dere kan swappe!',
                          style: const TextStyle(
                              fontSize: 36,
                              height: 1.14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.8,
                              color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          chain
                              ? 'Vi fant et bytte med tre personer.'
                              : '$other vil ha $youGive, du vil ha $theyGive.',
                          style: const TextStyle(
                              fontSize: 15, height: 1.45, color: Color(0xBFFFFFFF)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 51),
                        if (chain) _chainList(trade) else _table(trade, other),
                        if (chain) ...[
                          const SizedBox(height: 24),
                          Container(
                            padding: const EdgeInsets.all(Insets.md),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(Radii.card),
                            ),
                            child: const Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.info_outline, size: 18, color: Colors.white70),
                                SizedBox(width: Insets.sm),
                                Expanded(
                                  child: Text(
                                    'Dette byttet kan ikke Swaply fasilitere, men vi kan '
                                    'starte en chat så dere avtaler det selv.',
                                    style: TextStyle(
                                        fontSize: 13, height: 1.4, color: Colors.white70),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 34),
                  child: Column(
                    children: [
                      PrimaryButton(
                        chain ? 'Start chat' : 'Se byttet',
                        onPressed: () => Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                                builder: (_) => TradeDetailScreen(tradeId: trade.id))),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: () => Navigator.of(context).maybePop(),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(vertical: 2),
                          child: Text('Fortsett å sveipe',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xA6FFFFFF))),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Your things on the left, tilted a little to the left; theirs on the
  /// right, tilted a little to the right; the swap sign where they overlap.
  /// The second thing you give peeks out from behind the first.
  Widget _table(Trade trade, String other) {
    final give = trade.youGive;
    final get = trade.youGet;
    return SizedBox(
      height: 251,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (give.length > 1)
            Positioned(
              left: 24,
              top: 14,
              child: Transform.rotate(angle: 8 * math.pi / 180, child: _card(give[1])),
            ),
          if (give.isNotEmpty)
            Positioned(
              left: 16,
              top: 2,
              child: Transform.rotate(angle: -4 * math.pi / 180, child: _card(give.first)),
            ),
          if (get.isNotEmpty)
            Positioned(
              left: 148,
              top: 0,
              child: Transform.rotate(angle: 3 * math.pi / 180, child: _card(get.first)),
            ),
          const Positioned(
            left: 149,
            top: 88,
            child: Text('⇄',
                style: TextStyle(
                    fontSize: 38,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF9BD9BE))),
          ),
          Positioned(
            left: 0,
            top: 217,
            width: 196,
            child: Center(child: _who('Du', give.length, mine: true)),
          ),
          Positioned(
            left: 126,
            top: 217,
            width: 204,
            child: Center(child: _who(other, get.length)),
          ),
        ],
      ),
    );
  }

  Widget _card(Item item) => SizedBox(
        width: 156,
        height: 204,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ItemThumb(item, size: 204, radius: 20),
            Positioned(
              left: 8,
              right: 8,
              bottom: 10,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: SwaplyColors.bg.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 9.5, color: SwaplyColors.inkMuted)),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _who(String name, int count, {bool mine = false}) => Container(
        padding: const EdgeInsets.fromLTRB(5, 5, 11, 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(Radii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Avatar(name, size: 24, color: mine ? SwaplyColors.greenPressed : null),
            const SizedBox(width: 6),
            Text(count > 1 ? '$name · $count ting' : name,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
          ],
        ),
      );

  /// The three-way loop: who gives what, one line each.
  Widget _chainList(Trade trade) => Column(
        children: [
          for (final p in trade.participants)
            Padding(
              padding: const EdgeInsets.only(bottom: Insets.sm),
              child: Row(
                children: [
                  Avatar(p.position == trade.youPosition ? 'Du' : p.displayName,
                      size: 28, color: SwaplyColors.greenPressed),
                  const SizedBox(width: Insets.sm),
                  Expanded(
                    child: Text(
                      '${p.position == trade.youPosition ? 'Du' : p.displayName.split(' ').first} '
                      'gir ${p.gives.map((i) => i.title).join(' og ')}',
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
}

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
      // «‹ Bytte med Ola» and nothing else: the state is told by the cards
      // and the buttons, not by a pill in the corner.
      appBar: swaplyAppBar(context, title),
      child: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(22, 8, 22, 12),
                children: _sections(trade),
              ),
            ),
          ),
          _actions(trade),
        ],
      ),
    );
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
      // One card per leg, the kicker inside it beside the first thing.
      _legCard(
        kicker: trade.state == 'completed' ? 'Du fikk' : 'Du får',
        colour: SwaplyColors.greenText,
        items: trade.youGet,
        from: 'fra ${trade.receivingFrom.displayName.split(' ').first}',
        done: trade.youReceivedAt != null ? 'Mottatt' : null,
      ),
      const SizedBox(height: 7),
      _legCard(
        kicker: trade.state == 'completed'
            ? 'Du ga'
            : trade.youGive.length > 1
                ? 'Du gir · ${trade.youGive.length} ting'
                : 'Du gir',
        colour: SwaplyColors.amberText,
        items: trade.youGive,
        from: 'til ${trade.givingTo.displayName.split(' ').first}',
        done: trade.youSentAt != null ? 'Levert' : null,
        // «Fjern» and «+ Legg til flere» both open the counter-offer, which is
        // the only way the set of things changes once a trade exists.
        edit: !chain && ['talking', 'pending', 'countered'].contains(trade.state)
            ? () => _openCounterOffer(trade)
            : null,
      ),

      // 07j: the leg that is neither yours to give nor yours to receive.
      for (final leg in trade.otherLegs) ...[
        const SizedBox(height: 7),
        _legCard(
          kicker: '${leg.giver.displayName.split(' ').first} gir',
          colour: SwaplyColors.greyLight,
          items: leg.items,
          from: 'til ${leg.receiver.displayName.split(' ').first}',
        ),
      ],

      const SizedBox(height: 7),
      _valueSummary(trade),
      if (trade.cash != null) ...[
        const SizedBox(height: 7),
        _cashSection(trade),
      ],
      if (trade.state == 'accepted' && !chain) ...[
        const SizedBox(height: 7),
        _handoverSection(trade),
      ],
      if (trade.state != 'completed' && trade.state != 'cancelled') ...[
        const SizedBox(height: 7),
        _statusSection(trade),
      ],
      const SizedBox(height: 7),
      _conversationSection(trade),
      if (trade.state == 'completed') ...[
        const SizedBox(height: 7),
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

  /// A leg of the trade: 48px thumbnails, the kicker beside the first one,
  /// «Fjern» beside the others, and the add-more line at the foot.
  Widget _legCard({
    required String kicker,
    required Color colour,
    required List<Item> items,
    required String from,
    String? done,
    VoidCallback? edit,
  }) =>
      SectionCard(
        radius: 16,
        padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (items.isEmpty)
              Text(kicker.toUpperCase(),
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.66, color: colour)),
            for (final (i, item) in items.indexed) ...[
              if (i > 0) const SizedBox(height: 9),
              Row(
                children: [
                  ItemThumb(item, size: 48, radius: 12),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (i == 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text(kicker.toUpperCase(),
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.66,
                                    color: colour)),
                          ),
                        Text(item.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
                        Text('$from · verdi ${kr(item.estimatedValueNok)}',
                            style: const TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                      ],
                    ),
                  ),
                  if (done != null)
                    Text('✓ $done',
                        style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: SwaplyColors.greenText))
                  else if (edit != null && i > 0)
                    GestureDetector(
                      onTap: edit,
                      child: const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Text('Fjern',
                            style: TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                      ),
                    ),
                ],
              ),
            ],
            if (edit != null) ...[
              const SizedBox(height: 9),
              GestureDetector(
                onTap: edit,
                child: const Text('+ Legg til flere av dine ting', style: Type.link),
              ),
            ],
          ],
        ),
      );

  /// «Du får · verdi 1 200 kr» left, the difference in the middle, «Du gir ·
  /// verdi 850 kr» right — a line, not a card.
  Widget _valueSummary(Trade trade) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: _valueCell('Du får', SwaplyColors.greenText, trade.youGetValue)),
            if (trade.difference > 0)
              Text('differanse ${kr(trade.difference)}',
                  style: const TextStyle(fontSize: 11, color: SwaplyColors.greyLight)),
            Expanded(
                child: _valueCell('Du gir', SwaplyColors.amberText, trade.youGiveValue, end: true)),
          ],
        ),
      );

  Widget _valueCell(String label, Color colour, int value, {bool end = false}) => Text.rich(
        TextSpan(children: [
          TextSpan(
              text: '$label ',
              style: TextStyle(fontWeight: FontWeight.w700, color: colour)),
          TextSpan(text: 'verdi ${kr(value)}'),
        ]),
        textAlign: end ? TextAlign.end : TextAlign.start,
        style: const TextStyle(fontSize: 12, color: SwaplyColors.inkMuted),
      );

  /// The cash difference. We show a number and a phone number; we never move it.
  Widget _cashSection(Trade trade) {
    final cash = trade.cash!;
    final settled = trade.youPaidAt != null;

    // The kicker lives inside the card, with the note to its right.
    return SectionCard(
      radius: 16,
      padding: const EdgeInsets.fromLTRB(14, 9, 14, 9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
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
                      cash.youPay
                          ? 'Du betaler ${kr(cash.amountNok)} til ${cash.payee.displayName.split(' ').first}'
                          : '${cash.payer.displayName.split(' ').first} betaler deg ${kr(cash.amountNok)}',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: SwaplyColors.ink),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 105,
                child: Text(
                  settled
                      ? '✓ betalt via Vipps'
                      : trade.state == 'accepted'
                          ? 'betales direkte mellom dere, før noe sendes'
                          : 'betales når begge har godtatt',
                  style: const TextStyle(fontSize: 11.5, height: 1.4, color: SwaplyColors.grey),
                ),
              ),
            ],
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
          // One small card per person, no kicker: face, name, what they give,
          // and whether they have said yes.
          for (final (i, p)
              in trade.participants.where((p) => p.position != trade.youPosition).indexed) ...[
            if (i > 0) const SizedBox(height: 7),
            SectionCard(
              radius: 16,
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
              child: Row(
                children: [
                  Avatar(p.displayName, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.displayName.split(' ').first,
                            style: const TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
                        Text(_personMeta(p),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11.5, color: SwaplyColors.grey)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    p.accepted == true ? '✓ Har godtatt' : 'Venter',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: p.accepted == true ? SwaplyColors.greenText : SwaplyColors.grey),
                  ),
                ],
              ),
            ),
          ],
        ],
      );

  /// «★ 4,7 · Trondheim» when the person has a rating and a town; what they
  /// give otherwise, so the line is never empty.
  String _personMeta(UserRef p) {
    final parts = [
      if (p.ratingAvg != null) '★ ${p.ratingAvg!.toStringAsFixed(1).replaceAll('.', ',')}',
      if (p.town != null) p.town!,
    ];
    return parts.isEmpty ? 'gir ${p.gives.map((i) => i.title).join(' og ')}' : parts.join(' · ');
  }

  /// The conversation is available at every stage, including while you wait.
  Widget _conversationSection(Trade trade) {
    final name = trade.isChain
        ? 'alle'
        : trade.receivingFrom.displayName.split(' ').first;

    Future<void> send() async {
      final text = _message.text.trim();
      if (text.isEmpty || trade.threadId == null) return;
      try {
        await context.read<SwaplyApi>().sendMessage(trade.threadId!, text);
        _message.clear();
        await _load();
      } on ApiException catch (e) {
        if (mounted) showError(context, e);
      }
    }

    // The same card as on the item screen: kicker and «Åpne ›» inside it,
    // the last line as a soft bubble, a pill field and «Send» as words.
    return SectionCard(
      padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text((trade.isChain ? 'Chat · alle tre' : 'Samtale med $name').toUpperCase(),
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.72,
                      color: SwaplyColors.greyLight)),
              if (trade.threadId != null)
                GestureDetector(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ThreadScreen(threadId: trade.threadId!))),
                  child: const Text('Åpne ›',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: SwaplyColors.greenText)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (trade.lastMessage != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Avatar(trade.lastMessage!.senderName ?? '?', size: 26),
                const SizedBox(width: 8),
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF3F6F2),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(14),
                        topRight: Radius.circular(14),
                        bottomRight: Radius.circular(14),
                        bottomLeft: Radius.circular(5),
                      ),
                    ),
                    child: Text(trade.lastMessage!.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13.5, height: 1.4, color: SwaplyColors.ink)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _message,
                  style: const TextStyle(fontSize: 13, color: SwaplyColors.ink),
                  onSubmitted: (_) => send(),
                  decoration: InputDecoration(
                    hintText: trade.isChain ? 'Skriv til begge…' : 'Skriv en melding…',
                    hintStyle: const TextStyle(fontSize: 13, color: SwaplyColors.greyLight),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(Radii.pill),
                        borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(Radii.pill),
                        borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(Radii.pill),
                        borderSide: const BorderSide(color: SwaplyColors.greenPressed)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: trade.threadId == null ? null : send,
                child: const Text('Send',
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700, color: SwaplyColors.greenText)),
              ),
            ],
          ),
        ],
      ),
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
            SizedBox(
              width: 113,
              child: SecondaryButton('Avslå',
                  destructive: true,
                  onPressed: _busy ? null : () => _confirmDecline(trade)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PrimaryButton('Godta byttet',
                  height: 50,
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
        children.add(const SizedBox(height: 6));
      }
      if (!trade.isChain) {
        children.add(SecondaryButton('Foreslå motbytte',
            accent: true,
            height: 42,
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
