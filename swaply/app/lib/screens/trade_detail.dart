import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../util/clock.dart';
import '../state/session.dart';
import '../widgets/admin_chrome.dart';
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
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// The trade has opened on the server whether or not this page gets to
  /// show it, so a failure here is the page's and not the trade's. It used to
  /// be a toast over a spinner that went on turning on deep green, with no
  /// header and nothing to press — the way out was the phone's own back, and
  /// a browser has none on the page.
  Future<void> _load() async {
    try {
      final trade = await context.read<SwaplyApi>().trade(widget.tradeId);
      if (mounted) {
        setState(() {
          _trade = trade;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final trade = _trade;
    // The app's own failed page, as 06b draws it: «‹», and «Prøv igjen» for
    // no answer. Not the celebration's green — nothing is being celebrated.
    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Bytte'),
        body: LoadFailure(_error!, missing: 'Fant ikke byttet', onRetry: _retry),
      );
    }
    if (trade == null) {
      return const AnnotatedRegion<SystemUiOverlayStyle>(
        value: onDarkStatusBar,
        child: Scaffold(
          backgroundColor: SwaplyColors.greenDeep,
          body: Center(child: CircularProgressIndicator(color: Colors.white)),
        ),
      );
    }

    final chain = trade.isChain;

    // The one screen the export drenches: deep green, white type, the two
    // things tilted like photographs somebody put on a table. «The moment is
    // the product», and a moment does not look like the rest of the app.
    // Light over the green; see [onDarkStatusBar].
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: onDarkStatusBar,
      child: Scaffold(
        backgroundColor: SwaplyColors.greenDeep,
        body: Stack(
          children: [
            // Confetti, starting at the four spots the export puts it and
            // drifting up from there.
            const Positioned.fill(child: Confetti()),
            SafeArea(
              child: Column(
                children: [
                  // Drawn for 390×844, from the top down: 153 over the
                  // title and the table under it, about 550 for a pair. That
                  // ran under «Se byttet» on a 375×667 phone and a hundred
                  // points under it on a 360×640 one. The 153 is room the
                  // phone can spare, so it gives way first, down to nothing;
                  // past that the words and the table scroll above the
                  // buttons rather than under them.
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, box) => SingleChildScrollView(
                        // 30 at the sides on 06a, 28 on 07i.
                        padding: EdgeInsets.symmetric(horizontal: chain ? 28 : 30),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minHeight: box.maxHeight),
                          child: IntrinsicHeight(
                              child: _moment(trade, width: box.maxWidth - (chain ? 56 : 60))),
                        ),
                      ),
                    ),
                  ),
                  // The button and the words under it are both ways on, and a
                  // toast goes up over the two of them.
                  KeepClear(
                    child: Padding(
                      // 34 at the foot, 11 of it inside «Fortsett å sveipe».
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 34 - 11),
                      child: Column(
                        children: [
                          PrimaryButton(
                            chain ? 'Start chat' : 'Se byttet',
                            // 07i offers a chat, and means it: the three of them
                            // arrange this one themselves, so the button goes to
                            // the conversation rather than to an overview of a
                            // trade nobody is facilitating.
                            // The chat covers the bar, as this does; the trade is
                            // drawn with it, so it goes into the tab underneath.
                            onPressed: () => chain && trade.threadId != null
                                ? Navigator.of(context).pushReplacement(MaterialPageRoute(
                                    builder: (_) => ThreadScreen(threadId: trade.threadId!)))
                                : pushInTab<void>(context, TradeDetailScreen(tradeId: trade.id),
                                    replace: true),
                          ),
                          // Words under the button, answering across the 12
                          // over them and the top of the foot.
                          TapArea(
                            room: const EdgeInsets.fromLTRB(12, 12, 12, 11),
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
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The words and the table, [width] across, over the buttons.
  Widget _moment(Trade trade, {required double width}) {
    final chain = trade.isChain;
    final other = trade.receivingFrom.displayName.split(' ').first;
    // «A, B og C», as a sentence lists three things, not «A og B og C».
    final theyGive = andList([for (final i in trade.youGet) i.title]);
    final youGive = andList([for (final i in trade.youGive) i.title]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Up to 153 as laid out — 126 on 07i, whose title is two lines —
        // and nothing as an intrinsic height, so it gives way before
        // anything has to scroll.
        Flexible(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: chain ? 126 : 153),
            child: const SizedBox.expand(),
          ),
        ),
        Text(
          chain ? 'Dere kan gjøre en treveis-swap!' : 'Dere kan swappe!',
          style: TextStyle(
              fontSize: chain ? 32 : 36,
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
          style: const TextStyle(fontSize: 15, height: 1.45, color: Color(0xBFFFFFFF)),
          textAlign: TextAlign.center,
        ),
        SizedBox(height: chain ? 35 : 51),
        if (chain) ..._ring(trade) else _table(trade, other, width: width),
      ],
    );
  }

  /// 07i: what you get and from whom, what you give and to whom, each in a
  /// card, and under them that the three of them arrange it. It used to be
  /// three lines of who gives what — «Kari gir …», «Per gir …» — which in a
  /// ring of three never said who gets it.
  List<Widget> _ring(Trade trade) {
    String whereabouts(String word, UserRef person) {
      final town = person.town?.trim() ?? '';
      final name = person.displayName.split(' ').first;
      return town.isEmpty ? '$word $name' : '$word $name i $town';
    }

    return [
      _ringCard('Du får', const Color(0xFF9BD9BE), trade.youGet,
          whereabouts('fra', trade.receivingFrom)),
      const SizedBox(height: 12),
      _ringCard('Du gir', const Color(0xFFF5B5AF), trade.youGive,
          whereabouts('til', trade.givingTo)),
      const SizedBox(height: 20),
      const Text(
        'Dette byttet kan ikke Swaply fasilitere, men vi kan starte en chat så dere avtaler '
        'det selv.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 15, height: 1.45, color: Color(0xBFFFFFFF)),
      ),
    ];
  }

  /// One of 07i's two cards: a 60 picture, the kicker in its colour, the
  /// things and who they come from or go to.
  Widget _ringCard(String kicker, Color colour, List<Item> items, String who) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
        ),
        child: Row(
          children: [
            if (items.isNotEmpty) ...[
              ItemThumb(items.first, size: 60, radius: 16),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(kicker.toUpperCase(),
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.69,
                          color: colour)),
                  const SizedBox(height: 2),
                  Text(items.isEmpty ? 'ingenting ennå' : andList([for (final i in items) i.title]),
                      style: const TextStyle(
                          fontSize: 16.5, fontWeight: FontWeight.w700, color: Colors.white)),
                  Text(who,
                      style: const TextStyle(fontSize: 12.5, color: Color(0xA6FFFFFF))),
                ],
              ),
            ),
          ],
        ),
      );

  /// The table is drawn 330 across, the export's 390 less its margins.
  static const _tableWidth = 330.0, _tableHeight = 251.0;

  /// Your things on the left, tilted a little to the left; theirs on the
  /// right, tilted a little to the right; the swap sign where they overlap.
  /// The second thing you give peeks out from behind the first.
  ///
  /// Placed for [_tableWidth], and shrunk as a whole where [width] is less:
  /// at 320 across the right card ran off the screen. Its height shrinks
  /// with it, so the page knows how much room it takes.
  Widget _table(Trade trade, String other, {required double width}) {
    final scale = math.min(1.0, width / _tableWidth);
    return SizedBox(
      height: _tableHeight * scale,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: SizedBox(
          width: _tableWidth,
          height: _tableHeight,
          child: _cards(trade, other),
        ),
      ),
    );
  }

  Widget _cards(Trade trade, String other) {
    final give = trade.youGive;
    final get = trade.youGet;
    // Laid out 330 by 251, in the box [_table] gives it.
    return Stack(
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
            // The name gives way, never the count: a long first name at 130 %
            // ran the whole label off the screen.
            Flexible(
              child: Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
            if (count > 1)
              Text(' · $count ting',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
          ],
        ),
      );
}

class TradeDetailScreen extends StatefulWidget {
  const TradeDetailScreen({super.key, required this.tradeId});

  final String tradeId;

  @override
  State<TradeDetailScreen> createState() => _TradeDetailScreenState();
}

class _TradeDetailScreenState extends State<TradeDetailScreen> with WidgetsBindingObserver {
  Trade? _trade;
  ApiException? _error;
  bool _busy = false;
  final _message = TextEditingController();

  /// A message from the card's field is on its way.
  bool _sending = false;

  /// The server's words for a conversation it takes no more messages in,
  /// once «Send» on the card was refused with them (`conversation_closed`).
  String? _closedByServer;

  /// Which asking for the trade is the newest. The page asks from several
  /// places now, and an answer to an older asking — or a trade an action
  /// handed back after it — must not be overwritten by one that lands late.
  int _asking = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _message.dispose();
    super.dispose();
  }

  /// Back from the background, the trade may have moved on without this
  /// phone: a counter-offer, a yes taken back, a question asked. It is asked
  /// for again quietly, as a tab coming back is.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _trade != null) _load(quiet: true);
  }

  /// Asked for when the page opens, and again after a pull or anything done
  /// on it, after the chat or 06c or 09a is left, and when the app comes
  /// back. Only the first asking can fail into [LoadFailure]: after that the
  /// trade on screen stays and the failure is a toast over it. A pull with no
  /// connection used to replace the trade with «Fant ikke byttet». [quiet]
  /// says nothing even then, for an asking whose news is already up.
  Future<void> _load({bool quiet = false}) async {
    final asking = ++_asking;
    try {
      final trade = await context.read<SwaplyApi>().trade(widget.tradeId);
      if (mounted && asking == _asking) {
        setState(() {
          _trade = trade;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (!mounted || asking != _asking) return;
      if (_trade == null) {
        setState(() => _error = e);
      } else if (!quiet) {
        showError(context, e);
      }
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load();
  }

  /// «Rapporter et problem med byttet». A report that blocked, once the
  /// server has it, asks for the trade again, quietly — the thanks and the
  /// block are the toast — so what is on screen is the trade as the server
  /// has it across the block, and not as it was before.
  Future<void> _report(Trade trade) async {
    final blocked = await showReportSheet(context,
        userId: trade.receivingFrom.id, personName: trade.receivingFrom.displayName);
    if (blocked && mounted) await _load(quiet: true);
  }

  Future<void> _run(Future<Trade> Function(SwaplyApi api) action) async {
    setState(() => _busy = true);
    try {
      final trade = await action(context.read<SwaplyApi>());
      if (!mounted) return;
      // Newer than any asking still on its way.
      _asking++;
      setState(() => _trade = trade);
      // The bar's counts, quietly and not waited for. Inside the action's
      // `try` it was the action's failure: a decline that had gone through
      // said «Vi får ikke kontakt» over the trade it had just ended, after
      // the button had spun for the whole of the asking's patience.
      _askSessionAgain();
    } on ApiException catch (e) {
      if (!mounted) return;
      showError(context, e);
      // A refusal is the server saying the trade is not what this page
      // shows — a yes already taken back on another phone, an offer changed,
      // a trade ended — so the page asks for it again, quietly, under the
      // server's words. It went on offering what had just been refused, and
      // «Trekk deg» on the strength of a yes that was no longer there. No
      // answer says nothing about the trade, and asks for nothing.
      if (!e.isNoContact) unawaited(_load(quiet: true));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// «Kari vil trekke seg» refused because something had been sent: the
  /// server answers her question with 08c, for her, and nothing on this side
  /// of the trade changes, so the chip did nothing anybody could see. Said,
  /// since this side is where it was pressed.
  void _refusedTheOther(Trade after, UserRef person) {
    final w = after.withdrawal;
    if (w == null || w.requestedBy != person.id || w.state != 'rejected' || !w.blockedBySent) {
      return;
    }
    if (!mounted) return;
    final name = _firstName(person);
    showNote(context,
        '$name får ikke trekke seg, for noe er allerede sendt. $name ser 08c, og byttet fortsetter.');
  }

  /// The trade as it stands after a lever of the tooling's, or [before] when
  /// there is no answer: the lever worked, and reading back is not the
  /// lever. Sharing its `try`, no answer said «Vi får ikke kontakt» over a
  /// move the server had made, and pressed again it was made twice. The next
  /// asking shows it.
  Future<Trade> _readBack(SwaplyApi api, Trade before) async {
    try {
      return await api.trade(before.id);
    } on ApiException catch (e) {
      if (!e.isNoContact) rethrow;
      return before;
    }
  }

  /// Who this is, asked again for the bar's badges, and nothing said either
  /// way: what the screen did is what the screen says, and no answer here is
  /// the next asking's to put right.
  void _askSessionAgain() =>
      unawaited(context.read<Session>().refresh().then((_) {}, onError: (Object _) {}));

  @override
  Widget build(BuildContext context) {
    final trade = _trade;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Bytte'),
        body: LoadFailure(_error!, missing: 'Fant ikke byttet', onRetry: _retry),
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

    // A finished trade is drawn from the copy taken as it finished, where
    // the server sent one; anything else from the offer as it stands.
    final gotCopy = _traded(trade, trade.receivingFrom.position);
    final gaveCopy = _traded(trade, trade.youPosition);
    final got = gotCopy ?? trade.youGet;
    final gave = gaveCopy ?? trade.youGive;

    final withdrawal = trade.withdrawal;
    final refusedWithdrawal = withdrawal != null &&
        withdrawal.byYou &&
        trade.state == 'accepted' &&
        withdrawal.state == 'rejected' &&
        withdrawal.blockedBySent;
    // 06f: a pair everybody has agreed to, which is handed over now.
    final handover = trade.state == 'accepted' && !chain;
    return [
      // 08b: the trade is paused while the question is answered.
      if (trade.state == 'paused' && withdrawal?.state == 'waiting') _withdrawalBanner(trade),
      // 08c: asked too late, because something had already been sent. Only
      // to the one who asked, and only while the trade carries on: it was
      // drawn for everybody in it — telling the one who had answered that
      // they could not withdraw — and stayed after the trade had ended.
      if (refusedWithdrawal)
        _blockedBanner(trade)
      // 06f: agreed, which nothing on the page said. 08c says it its own way.
      else if (trade.state == 'accepted')
        _agreedCard(),
      // 09e: a new proposal is on the table.
      // Named for whoever proposed it, which in a ring is not always the one
      // you receive from: «Ingrid foreslår» read «Nytt forslag fra Kari».
      if (_counteredByOther(trade))
        _noticeCard('Nytt forslag fra ${_firstName(_proposer(trade))}. '
            'Godta, avslå eller foreslå noe annet.'),
      // Nothing to accept yet: one side of the offer is still empty.
      if (['talking', 'pending', 'countered'].contains(trade.state) &&
          (trade.youGive.isEmpty || trade.youGet.isEmpty))
        _noticeCard(trade.youGive.isEmpty
            ? 'Du har ikke lagt noe i byttet ennå. Velg hva du vil gi, så kan '
                '${trade.receivingFrom.displayName.split(' ').first} godta.'
            : '${trade.receivingFrom.displayName.split(' ').first} har ikke lagt noe i '
                'byttet ennå. Foreslå hva dere skal bytte.')
      // In a ring the leg between the other two can be the empty one: a
      // version with a side still empty is a question, which nobody can say
      // yes to (DESIGN.md, 02.10.2026), and 07j offered «Godta byttet» on it.
      else if (_emptyLeg(trade) case final leg?
          when ['talking', 'pending', 'countered'].contains(trade.state))
        _noticeCard('${_firstName(leg.giver)} gir ingenting til ${_firstName(leg.receiver)} i '
            'dette forslaget, så det kan ikke godtas ennå. Avtal resten i chatten.'),
      // 09f: it ended.
      if (trade.state == 'cancelled') _cancelledCard(trade),
      if (trade.state == 'completed') _completedHeader(trade),

      const SizedBox(height: Insets.md),
      // 09f: an ended trade is what was not traded, in one card, with whether
      // each of your things is out there again. It drew «DU FÅR» and «DU GIR»
      // and the totals, as if the trade were still going on.
      if (trade.state == 'cancelled') ...[
        _notTradedCard(trade),
      ] else if (handover) ...[
        // 06f: what you send, in the place of what you give, with its button
        // in it. «DU FÅR» and «DU GIR» over «DU SENDER» and «PÅ VEI TIL DEG»
        // drew every thing twice, and put the buttons under the fold.
        _sendCard(trade),
        const SizedBox(height: 7),
        _valueSummary(
            anyUnvalued(trade.youGet) ? null : trade.youGetValue,
            anyUnvalued(trade.youGive) ? null : trade.youGiveValue),
      ] else ...[
        // One card per leg, the kicker inside it beside the first thing.
        _legCard(
          kicker: trade.state == 'completed' ? 'Du fikk' : 'Du får',
          colour: SwaplyColors.greenText,
          items: got,
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
          items: gave,
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
            items: _traded(trade, _positionOf(trade, leg.giver)) ?? leg.items,
            from: 'til ${leg.receiver.displayName.split(' ').first}',
          ),
        ],

        const SizedBox(height: 7),
        _valueSummary(
            anyUnvalued(got) ? null : gotCopy == null ? trade.youGetValue : _sum(got),
            anyUnvalued(gave) ? null : gaveCopy == null ? trade.youGiveValue : _sum(gave)),
      ],
      // Not on an ended trade: there is nothing left to pay, and «betales
      // når begge har godtatt» was a promise about a trade that is over.
      if (trade.cash != null && trade.state != 'cancelled') ...[
        const SizedBox(height: 7),
        _cashSection(trade),
      ],
      if (handover) ...[
        const SizedBox(height: 7),
        _receiveCard(trade),
      ],
      const SizedBox(height: 7),
      _conversationSection(trade,
          over: trade.state != 'completed' && trade.state != 'cancelled'
              ? _statusSection(trade)
              : null),
      // The tooling, at the very bottom of the scroll and nowhere near the
      // product's own buttons. Only for the admin, and never while being
      // somebody else — a tool acting on a tool is how you lose the thread.
      if (context.watch<Session>().isAdmin && !context.watch<Session>().actingAs)
        _adminActions(trade),
      if (trade.state == 'completed') ...[
        const SizedBox(height: 7),
        _reviewSection(trade),
      ],
    ];
  }

  /// «Som motparten» — the other side's move, without leaving this screen.
  ///
  /// Even with an account switcher, walking a negotiation is switch, act,
  /// switch back, look. Every chip goes through the same function the
  /// product's own route calls, and the server refuses any trade a real person
  /// is standing in — by name, so you can see whose it is.
  Widget _adminActions(Trade trade) {
    final others = trade.participants.where((p) => p.position != trade.youPosition).toList();
    if (others.isEmpty) return const SizedBox.shrink();

    const byState = {
      'talking': [('message', 'skriver')],
      'pending': [
        ('accept', 'godtar'),
        ('counter', 'foreslår motbytte'),
        ('decline', 'avslår'),
        ('message', 'skriver'),
      ],
      'countered': [('accept', 'godtar'), ('decline', 'avslår'), ('message', 'skriver')],
      'accepted': [
        ('mark-sent', 'markerer som sendt'),
        ('mark-received', 'markerer som mottatt'),
        ('request-withdrawal', 'vil trekke seg'),
        ('message', 'skriver'),
      ],
    };
    final actions = byState[trade.state] ?? const [('message', 'skriver')];

    // The card is the room its chips share, as on the tool's own screen.
    return Padding(
      padding: const EdgeInsets.only(top: Insets.lg),
      child: TapRoom(
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
          decoration: BoxDecoration(
            color: AdminColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AdminColors.accent),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  AdminBadge('admin'),
                  SizedBox(width: 8),
                  // Norwegian runs long and this sits inside a card: the title
                  // wraps rather than running off the edge of it.
                  Expanded(
                    child: Text('Som motparten',
                        style: TextStyle(
                            fontSize: 12.5, fontWeight: FontWeight.w800, color: AdminColors.ink)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // «Forfall fristen nå». WITHDRAWAL_RESPONSE_HOURS is 72, so 08b's
              // expiry branch — nobody answered and the trade carries on — is
              // otherwise three days away. The lever was documented and shipped
              // with no control anywhere in the app.
              if (trade.withdrawal?.state == 'waiting') ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AdminButton('Forfall svarfristen nå',
                      busy: _busy,
                      onPressed: () => _run((api) async {
                            await api.adminExpireWithdrawal(trade.id);
                            return _readBack(api, trade);
                          })),
                ),
              ],
              for (final person in others)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final action in actions)
                        TapArea(
                          onTap: _busy
                              ? null
                              : () => _run((api) async {
                                    await api.adminAct(trade.id,
                                        as: person.id, action: action.$1);
                                    final after = await _readBack(api, trade);
                                    if (action.$1 == 'request-withdrawal') {
                                      _refusedTheOther(after, person);
                                    }
                                    return after;
                                  }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                            decoration: BoxDecoration(
                              color: AdminColors.cardFill,
                              borderRadius: BorderRadius.circular(Radii.pill),
                              border: Border.all(color: AdminColors.hairline),
                            ),
                            child: Text(
                              '${person.displayName.split(' ').first} ${action.$2}',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AdminColors.ink),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// 09e: the version on the table was proposed by somebody else, which
  /// since 02.10.2026 also means they have said yes to it.
  bool _counteredByOther(Trade trade) =>
      trade.state == 'countered' &&
      trade.counterOfferBy != null &&
      trade.counterOfferBy !=
          trade.participants
              .firstWhere((p) => p.position == trade.youPosition, orElse: () => trade.receivingFrom)
              .id;

  /// The leg of a ring between the other two that has nothing on it, if any.
  TradeLeg? _emptyLeg(Trade trade) =>
      trade.otherLegs.where((leg) => leg.items.isEmpty).firstOrNull;

  /// Whoever proposed the version on the table: the participant the server
  /// names, or the one you receive from where it names nobody it sent.
  UserRef _proposer(Trade trade) =>
      trade.participants.where((p) => p.id == trade.counterOfferBy).firstOrNull ??
      trade.receivingFrom;

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

  /// Everybody in the trade but you.
  List<UserRef> _others(Trade trade) =>
      trade.participants.where((p) => p.position != trade.youPosition).toList();

  Widget _withdrawalBanner(Trade trade) {
    final w = trade.withdrawal!;
    final others = _others(trade);
    // Who asked, which in a ring is not always the one you receive from.
    final asker = others.where((p) => p.id == w.requestedBy).firstOrNull ?? trade.receivingFrom;
    final left = w.respondsBy?.difference(now());

    return Padding(
      padding: const EdgeInsets.only(top: Insets.sm),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                w.byYou
                    ? 'Vi hører med ${_firstNames(others)}'
                    : '${_firstName(asker)} vil trekke seg',
                style: Type.heading),
            const SizedBox(height: 6),
            Text(
              w.byYou
                  // In a ring two are asked, and the first answer decides.
                  ? others.length > 1
                      ? 'Byttet er pauset til en av dem svarer på om det er greit at du '
                          'trekker deg.'
                      : 'Byttet er pauset mens ${_firstName(asker)} svarer på om det er greit '
                          'at du trekker deg.'
                  : '${_firstName(asker)} har bedt om å trekke seg. Svarer du ja og ingenting '
                      'er sendt, avbrytes byttet.',
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
                        onPressed: () => _run((api) async {
                              final after = await api.respondToWithdrawal(trade.id, true);
                              _saidNoFor(after, askedBy: w.requestedBy);
                              return after;
                            })),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// 06f's first two lines: everybody has said yes, and the rest is between
  /// the people in it.
  Widget _agreedCard() => Padding(
        padding: const EdgeInsets.only(top: Insets.sm),
        // Deep green, as the export draws the moment everybody has said yes.
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: SwaplyColors.greenDeep,
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Byttet er godtatt!',
                  style: TextStyle(
                      fontSize: 22,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: Colors.white)),
              SizedBox(height: 6),
              Text('Dere kan også avtale å møtes i samtalen.',
                  style: TextStyle(fontSize: 13.5, height: 1.45, color: Color(0xBFFFFFFF))),
            ],
          ),
        ),
      );

  /// A yes that the server turned into a no, because something had been
  /// sent by then — the one answering, or in a ring the third — said, since
  /// the trade only carried on, and «Ja, greit» looked as if it had been lost.
  void _saidNoFor(Trade after, {String? askedBy}) {
    final w = after.withdrawal;
    if (w == null || w.state != 'rejected' || !w.blockedBySent || !mounted) return;
    final senders = after.participants
        .where((p) => p.position != after.youPosition && p.id != askedBy && p.sentAt != null)
        .toList();
    showNote(
        context,
        after.youSentAt != null
            ? 'Du har allerede sendt din ting, så svaret ble nei. Byttet fortsetter.'
            : senders.isEmpty
                ? 'Noe er allerede sendt, så svaret ble nei. Byttet fortsetter.'
                : '${_firstNames(senders)} har allerede sendt, så svaret ble nei. '
                    'Byttet fortsetter.');
  }

  /// «Kari har allerede sendt sin ting.», naming whoever has marked theirs
  /// sent: in a ring that is one of two, and not always the one you receive
  /// from.
  String _alreadySent(Trade trade) {
    final others = _others(trade);
    final sent = others.where((p) => p.sentAt != null).toList();
    if (sent.length > 1) return '${_firstNames(sent)} har allerede sendt tingene sine.';
    if (sent.length == 1) return '${_firstName(sent.single)} har allerede sendt sin ting.';
    // Nobody marked as sent on this phone's copy of the trade.
    return others.length > 1
        ? 'En av de andre har allerede sendt sin ting.'
        : '${_firstName(trade.receivingFrom)} har allerede sendt sin ting.';
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
                '${_alreadySent(trade)} Byttet fortsetter som normalt.',
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

  /// Ended, and why.
  ///
  /// Where the trade's `closeCode` has words of the app's own, they are
  /// said, true for whoever reads them; otherwise the server's sentence.
  /// Ended because somebody in it deleted their account, it says that — the
  /// server's sentence was «Den andre parten», which is wrong in a ring of
  /// three — and nothing about things coming free: most trades a deletion
  /// ends were still a conversation or an offer, with nothing held.
  ///
  /// The line under it, «Angret du? Du kan sende et nytt forslag fra
  /// samtalen.», is gone. 09f draws it, and it promised what this build does
  /// not do: the chips are not drawn on an ended trade, and the server
  /// refuses a counter-offer on one.
  Widget _cancelledCard(Trade trade) {
    final ring = trade.isChain || trade.participants.length > 2;
    return Padding(
      padding: const EdgeInsets.only(top: Insets.sm),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Byttet er avsluttet', style: Type.heading),
            const SizedBox(height: 6),
            Text(
              switch (trade.closeCode) {
                // A pair has one other person in it and a ring two, and the
                // one reading is never the one who left.
                Trade.closedByErasure => ring
                    ? 'En av de andre i byttet slettet kontoen sin.'
                    : 'Den andre i byttet slettet kontoen sin.',
                // Read by the one who blocked and the one blocked alike,
                // and by the third in a ring: it says what ended it and
                // not who.
                Trade.closedByBlock => 'Byttet ble avsluttet etter en blokkering.',
                // True for the owner too.
                Trade.closedByListingRemoved => 'En av tingene i byttet ble tatt ned av eieren.',
                // The server's «… ble reservert av et annet bytte» is said of a
                // trade that was completed with the thing, too, where it was
                // given away and not held.
                Trade.closedByDisplacement => 'En av tingene i byttet er med i et annet bytte nå.',
                _ => trade.closeReason ?? 'Tingene dine er tilgjengelige for andre igjen.',
              },
              style: Type.secondary,
            ),
          ],
        ),
      ),
    );
  }

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
        // With «+ Legg til flere» at the foot, the 11 under it is its own.
        padding: EdgeInsets.fromLTRB(12, 11, 12, edit != null ? 0 : 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (items.isEmpty) ...[
              Text(kicker.toUpperCase(),
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.66, color: colour)),
              // Said, not a card with a kicker and nothing under it.
              Text('ingenting ennå · $from',
                  style: const TextStyle(fontSize: 12, color: SwaplyColors.grey)),
            ],
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
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: SwaplyColors.ink)),
                        // A thing may have no value, and «verdi » with
                        // nothing after it read as a hole.
                        Text(
                            item.estimatedValueNok == null
                                ? from
                                : '$from · verdi ${kr(item.estimatedValueNok)}',
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
                    // A word in a row 48 tall: the row is its height, and
                    // the end of the title beside it — which does nothing —
                    // makes up the width.
                    TapArea(
                      room: const EdgeInsets.fromLTRB(8, 16, 0, 16),
                      reach: const EdgeInsets.fromLTRB(9, 1, 0, 1),
                      onTap: edit,
                      child: const Text('Fjern',
                          style: TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                    ),
                ],
              ),
            ],
            if (edit != null)
              // The 9 over it, the card's 11 under it, and the foot of the
              // row above, which has nothing of its own to tap.
              TapArea(
                room: const EdgeInsets.only(top: 9, bottom: 11),
                reach: const EdgeInsets.only(top: 9),
                onTap: edit,
                child: const Text('+ Legg til flere av dine ting', style: Type.link),
              ),
          ],
        ),
      );

  /// What a finished trade's side at [position] gave, from the copy the
  /// server took as it finished (`trade_item_snapshots`) rather than the
  /// listings as they are now. A listing can change after it was traded — a
  /// service is never «byttet» and stays up to be edited — and an erased
  /// account's pictures go with it; the copy is what lets the counterparty's
  /// history outlive both (DESIGN.md). Null where there is nothing to draw it
  /// from: a trade not finished, or a server that sent no copy.
  List<Item>? _traded(Trade trade, int? position) {
    if (trade.state != 'completed' || trade.snapshots.isEmpty || position == null) return null;
    final listed = [
      ...trade.youGet,
      ...trade.youGive,
      for (final leg in trade.otherLegs) ...leg.items,
    ];
    return [
      for (final (i, copy) in trade.snapshots.indexed)
        if (copy.giverPosition == position)
          Item.fromJson({
            'id': 'traded-$i',
            'title': copy.title,
            'estimatedValueNok': copy.estimatedValueNok,
            'cover': copy.cover,
            // The copy carries no category, which is the mark drawn on a
            // thing without a picture. The listing's, while it has the name
            // it was traded under.
            'category': listed.where((l) => l.title == copy.title).firstOrNull?.category ??
                'diverse',
          }),
    ];
  }

  /// Where [person] sits in the ring, from the participants, which carry it.
  int? _positionOf(Trade trade, UserRef person) =>
      person.position ??
      trade.participants.where((p) => p.id == person.id).firstOrNull?.position;

  int _sum(List<Item> items) => items.fold(0, (total, i) => total + (i.estimatedValueNok ?? 0));

  /// 09f's «IKKE BYTTET»: everything that was on the table, theirs with
  /// whose it is and yours with «din», and each of yours with where it stands
  /// now — «Tilgjengelig» is the export's, and a thing taken by another trade
  /// since, or traded, says so rather than claiming to be free.
  Widget _notTradedCard(Trade trade) {
    final rows = [
      for (final item in trade.youGet) (item, _firstName(trade.receivingFrom), false),
      for (final leg in trade.otherLegs)
        for (final item in leg.items) (item, _firstName(leg.giver), false),
      for (final item in trade.youGive) (item, 'din', true),
    ];
    return SectionCard(
      radius: 16,
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('IKKE BYTTET',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.66,
                  color: SwaplyColors.greyLight)),
          for (final (item, whose, mine) in rows) ...[
            const SizedBox(height: 9),
            Row(
              children: [
                ItemThumb(item, size: 48, radius: 12),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
                      Text(
                          item.estimatedValueNok == null
                              ? whose
                              : '$whose · verdi ${kr(item.estimatedValueNok)}',
                          style: const TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                    ],
                  ),
                ),
                if (mine) ...[
                  const SizedBox(width: 8),
                  switch (item.status) {
                    'traded' => const StatePill('Byttet', color: SwaplyColors.inkMuted),
                    'withdrawn' => const StatePill('Trukket', color: SwaplyColors.inkMuted),
                    _ when item.reserved || item.status == 'reserved' =>
                      const StatePill('Reservert', color: SwaplyColors.amberText),
                    _ => const StatePill('Tilgjengelig'),
                  },
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// «Du får · verdi 1 200 kr» left, the difference in the middle, «Du gir ·
  /// verdi 850 kr» right — a line, not a card. The server's sums, or a
  /// finished trade's copy's, whichever the cards above it are drawn from.
  /// Null is a side with a thing on it whose value nobody gave: «verdi ikke
  /// oppgitt», and no difference, since nobody has said what it is worth.
  Widget _valueSummary(int? getValue, int? giveValue) {
    final difference =
        getValue == null || giveValue == null ? 0 : (getValue - giveValue).abs();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: _valueCell('Du får', SwaplyColors.greenText, getValue)),
          if (difference > 0)
            Text('differanse ${kr(difference)}',
                style: const TextStyle(fontSize: 11, color: SwaplyColors.greyLight)),
          Expanded(child: _valueCell('Du gir', SwaplyColors.amberText, giveValue, end: true)),
        ],
      ),
    );
  }

  Widget _valueCell(String label, Color colour, int? value, {bool end = false}) => Text.rich(
        TextSpan(children: [
          TextSpan(
              text: '$label ',
              style: TextStyle(fontWeight: FontWeight.w700, color: colour)),
          TextSpan(text: value == null ? 'verdi ikke oppgitt' : 'verdi ${kr(value)}'),
        ]),
        textAlign: end ? TextAlign.end : TextAlign.start,
        style: const TextStyle(fontSize: 12, color: SwaplyColors.inkMuted),
      );

  /// The cash difference. We show a number and a phone number; we never move it.
  Widget _cashSection(Trade trade) {
    final cash = trade.cash!;
    // Paid is the payer's mark. It read the viewer's own, which the payee
    // never sets, so the one being paid never saw «✓ betalt».
    final paidAt = trade.participants.where((p) => p.id == cash.payer.id).firstOrNull?.paidAt ??
        (cash.youPay ? trade.youPaidAt : null);
    final settled = paidAt != null;
    final done = trade.state == 'completed';
    final payer = cash.payer.displayName.split(' ').first;
    final payee = cash.payee.displayName.split(' ').first;
    final amount = kr(cash.amountNok);
    // In a ring the mellomlegg may be between the other two: «Kari betaler
    // deg» said it was yours when it was Ingrid's.
    final paidToYou = cash.payee.position == null
        ? !cash.youPay && !trade.isChain
        : cash.payee.position == trade.youPosition;
    final to = paidToYou ? 'deg' : payee;

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
                      // 09i, once it is over: «Du betalte». Only when it was
                      // marked paid, though; otherwise what was agreed,
                      // without saying it happened.
                      switch ((cash.youPay, done, settled)) {
                        (true, true, true) => 'Du betalte $amount til $payee',
                        (true, true, false) => 'Du skulle betale $amount til $payee',
                        (true, false, _) => 'Du betaler $amount til $payee',
                        (false, true, true) => '$payer betalte $to $amount',
                        (false, true, false) => '$payer skulle betale $to $amount',
                        (false, false, _) => '$payer betaler $to $amount',
                      },
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
                      : done
                          ? 'ikke markert som betalt'
                          // Paused is still accepted by everybody, while
                          // a question about getting out is answered.
                          : trade.state == 'accepted' || trade.state == 'paused'
                              ? 'betales direkte mellom dere, før noe sendes'
                              : trade.isChain || trade.participants.length > 2
                                  ? 'betales når alle har godtatt'
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
                      // The server sends the number to the payer of an
                      // accepted trade, and only where the payee gave one.
                      child: Text(
                          cash.payeePhone == null
                              ? 'Vipps til $payee · spør etter nummeret i samtalen'
                              : 'Vipps til $payee · ${cash.payeePhone}',
                          style: Type.body),
                    ),
                    if (cash.payeePhone != null)
                      IconButton(
                        icon: const Icon(Icons.copy, size: 18),
                        tooltip: 'Kopiér',
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: cash.payeePhone!));
                          showNote(context, 'Nummeret er kopiert');
                        },
                      ),
                  ],
                ),
                const SizedBox(height: Insets.sm),
                // Green-edged, as the export draws it beside «Marker som
                // mottatt», and a finger's 44 where it draws 40.
                SecondaryButton(
                  settled ? 'Marker som ikke betalt' : 'Marker som betalt',
                  accent: true,
                  height: kTapTarget,
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

  /// 06f's «DU SENDER»: what you send and to whom, that the sending is
  /// arranged outside the app, and the mark for it, in one card as drawn.
  /// Shipping is a link out and a checkbox: we do not carry anything.
  Widget _sendCard(Trade trade) {
    final sent = trade.youSentAt != null;
    return _handoverCard(
      kicker: 'Du sender',
      colour: SwaplyColors.amberText,
      items: trade.youGive,
      line: 'til ${_firstName(trade.givingTo)} · frakt avtales utenfor appen, f.eks. PostNord',
      button: sent
          ? SecondaryButton('Marker som ikke sendt',
              height: kTapTarget,
              onPressed: _busy ? null : () => _run((api) => _mark(api, trade, 'sent', false)))
          : PrimaryButton('Marker som sendt',
              height: kTapTarget,
              busy: _busy,
              onPressed: () => _run((api) => _mark(api, trade, 'sent', true))),
    );
  }

  /// 06f's «PÅ VEI TIL DEG», and the mark for it.
  Widget _receiveCard(Trade trade) {
    final received = trade.youReceivedAt != null;
    final theirSent =
        trade.participants.where((p) => p.id == trade.receivingFrom.id).firstOrNull?.sentAt;
    return _handoverCard(
      kicker: 'På vei til deg',
      colour: SwaplyColors.greenText,
      items: trade.youGet,
      // Sent, once the one you receive from has marked it so: «sendt av Ola
      // i går», as 08c draws it. It said «avtal detaljer i samtalen»
      // whatever they had marked, and the one waiting learnt it only by
      // being refused a withdrawal.
      line: theirSent == null
          ? 'fra ${_firstName(trade.receivingFrom)} · avtal detaljer i samtalen'
          : 'sendt av ${_firstName(trade.receivingFrom)} ${_day(theirSent)}',
      button: SecondaryButton(received ? 'Marker som ikke mottatt' : 'Marker som mottatt',
          accent: true,
          height: kTapTarget,
          onPressed: _busy ? null : () => _run((api) => _mark(api, trade, 'received', !received))),
    );
  }

  /// A card of 06f: the first thing's picture, the kicker, the things, a
  /// line under them, and the card's button.
  Widget _handoverCard({
    required String kicker,
    required Color colour,
    required List<Item> items,
    required String line,
    required Widget button,
  }) =>
      SectionCard(
        radius: 18,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (items.isNotEmpty) ...[
                  ItemThumb(items.first, size: 48, radius: 12),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(kicker.toUpperCase(),
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.66,
                              color: colour)),
                      const SizedBox(height: 2),
                      Text(items.map((i) => i.title).join(' + '),
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
                      Text(line, style: const TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 9),
            button,
          ],
        ),
      );

  /// Sets or clears a handover mark. Whichever mark is the last one finishes
  /// the trade, and then 09h comes up: «Marker som sendt» used to leave that
  /// out, so a trade finished by it just turned completed under the person.
  Future<Trade> _mark(SwaplyApi api, Trade trade, String marker, bool value) async {
    final result = await api.mark(trade.id, marker, value: value);
    if (result.complete && result.trade.state == 'completed' && mounted) {
      await pushOverBar<void>(context, TradeCompletedScreen(trade: result.trade));
    }
    return result.trade;
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
              // 8 over and under the face, 6 of each inside its target.
              padding: const EdgeInsets.fromLTRB(14, 2, 14, 2),
              child: Row(
                children: [
                  // The face and the name open who it is, 13b, where report
                  // and block live: a trade under way had no way to either,
                  // short of finishing it. As wide as they are drawn and no
                  // wider: the rest of the card is where «Åpne ›» under it
                  // answers up into, as it did before the card answered.
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: TapArea(
                        room: const EdgeInsets.symmetric(vertical: 6),
                        onTap: () => _openProfile(p),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // The initial says nothing the name does not.
                            ExcludeSemantics(child: Avatar(p.displayName, size: 32)),
                            const SizedBox(width: 12),
                            Flexible(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.displayName.split(' ').first,
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: SwaplyColors.ink)),
                                  Text(_personMeta(p),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          fontSize: 11.5, color: SwaplyColors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
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

  /// 13b, over this page in its tab, as 13b is drawn with the bar. A block
  /// made there ends this trade, so the trade is asked for again on the way
  /// back — quietly, as the block's own toast is the news.
  Future<void> _openProfile(UserRef person) async {
    await Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => OtherProfileScreen(userId: person.id)));
    if (mounted) await _load(quiet: true);
  }

  /// «★ 4,7 · Trondheim» when the person has a rating and a town; what they
  /// give otherwise, so the line is never empty. A town may be there and
  /// empty, which read «★ 4,7 · ».
  String _personMeta(UserRef p) {
    final parts = [
      if (p.ratingAvg != null) '★ ${p.ratingAvg!.toStringAsFixed(1).replaceAll('.', ',')}',
      if (p.town?.trim().isNotEmpty ?? false) p.town!.trim(),
    ];
    return parts.isEmpty ? 'gir ${andList([for (final i in p.gives) i.title])}' : parts.join(' · ');
  }

  /// The conversation is available at every stage, including while you wait.
  ///
  /// [over] is what the screen shows above it — the people and whether they
  /// have said yes — which answers nothing, so «Åpne ›» may answer up into it.
  Widget _conversationSection(Trade trade, {Widget? over}) {
    final name = trade.isChain
        ? 'alle'
        : trade.receivingFrom.displayName.split(' ').first;

    // One message at a time, as on 06g and 04: «Send» pressed twice, or
    // the return key and then «Send», while the first was on its way sent
    // the same words twice.
    Future<void> send() async {
      final typed = _message.text;
      final text = typed.trim();
      if (text.isEmpty || trade.threadId == null || _sending) return;
      setState(() => _sending = true);
      try {
        await context.read<SwaplyApi>().sendMessage(trade.threadId!, text);
        if (!mounted) return;
        // What went, and not what has been typed since; see [takeSent].
        takeSent(_message, typed);
        await _load();
      } on ApiException catch (e) {
        if (!mounted) return;
        if (e.code == ApiException.conversationClosed) {
          // Nobody left to read it, as the server says: the field gives way
          // to its words rather than staying to be refused again.
          setState(() => _closedByServer = e.message);
        } else if (e.code == ApiException.blocked) {
          // Across a block the trade did not end, having finished: as 06g.
          setState(() => _closedByServer = closedAfterBlock);
        } else {
          showError(context, e);
        }
      } finally {
        if (mounted) setState(() => _sending = false);
      }
    }

    // The same card as on the item screen: kicker and «Åpne ›» inside it,
    // the last line as a soft bubble, a pill field and «Send» as words. The
    // three share the card: «Åpne ›» the top of it, the field and «Send» the
    // foot, split between them.
    final card = SectionCard(
      padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // The kicker gives way, never «Åpne ›»: at a large text size,
              // or with a long first name, a row that could not shrink ran
              // past the card and clipped the only way to the conversation.
              Flexible(
                child: Text((trade.isChain ? 'Chat · alle tre' : 'Samtale med $name').toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.72,
                        color: SwaplyColors.greyLight)),
              ),
              if (trade.threadId != null) const SizedBox(width: 8),
              if (trade.threadId != null)
                TapArea(
                  onTap: () async {
                    await pushOverBar<void>(context, ThreadScreen(threadId: trade.threadId!));
                    // A proposal from the chips, or the other side's answer
                    // read there, is the trade's now.
                    if (mounted) await _load(quiet: true);
                  },
                  child: const Text('Åpne ›',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: SwaplyColors.greenText)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (trade.lastMessage != null) ...[
            LastMessage(trade.lastMessage!),
            const SizedBox(height: 8),
          ],
          // Nobody left to write to, or nobody to write to across a block,
          // as the server says with the trade: said in 06g's words, before
          // «Send» is pressed. Or the server did when «Send» was refused. A
          // server from before it said so is read from how the trade ended,
          // and the card above says why.
          if (_closedByServer case final words?)
            Text(words, style: Type.small)
          else if (trade.conversationClosed)
            Text(
                trade.saysConversationClosed
                    ? closedLine(trade.conversationClosedWhy,
                        others: trade.participants.length - 1)!
                    : 'Samtalen er stengt.',
                style: Type.small)
          else
            Row(
              children: [
                Expanded(
                  child: TapArea(
                    child: TextField(
                      controller: _message,
                      maxLength: maxMessageLength,
                      buildCounter: nearLimit,
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
                ),
                const SizedBox(width: 10),
                TapArea(
                  onTap: trade.threadId == null || _sending ? null : send,
                  keepsKeyboard: true,
                  child: Text('Send',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _sending ? SwaplyColors.greyLight : SwaplyColors.greenText)),
                ),
              ],
            ),
        ],
      ),
    );
    return TapRoom(
      child: over == null
          ? card
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [over, const SizedBox(height: 7), card],
            ),
    );
  }

  Widget _reviewSection(Trade trade) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // In a ring 07l rates both of the others, so it is not one person's.
          Kicker(trade.isChain
              ? 'Din vurdering'
              : 'Din vurdering av ${trade.receivingFrom.displayName.split(' ').first}'),
          const SizedBox(height: Insets.sm),
          SectionCard(
            child: trade.yourReviewScore == null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The way to rate it is the button at the foot of the
                      // screen; a second one here opened the same 06h.
                      const Text('Du har ikke vurdert byttet ennå.', style: Type.secondary),
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
            onPressed: () => _report(trade),
            icon: const Icon(Icons.flag_outlined, size: 17, color: SwaplyColors.red),
            label: const Text('Rapporter et problem med byttet',
                style: TextStyle(color: SwaplyColors.red)),
          ),
        ],
      );

  Widget _actions(Trade trade) {
    final children = <Widget>[];
    // What the last button takes of the bar's foot as its own.
    var footRoom = 0.0;

    if (['talking', 'pending', 'countered'].contains(trade.state)) {
      // «Jeg vil ha» opens the trade with their listing on the table and
      // nothing back. There is nothing to accept there yet — offering it as
      // one tap was offering to give a thing away for nothing — so the whole
      // action is «Foreslå motbytte» until both sides have something in it.
      final halfFilled =
          trade.youGive.isEmpty || trade.youGet.isEmpty || _emptyLeg(trade) != null;
      // On every negotiation you have not said yes to. It was only beside
      // «Godta byttet», so a conversation, or an offer with a side still
      // empty, could not be closed from here at all; the server declines a
      // trade in any of the three states.
      final decline = SizedBox(
        width: 113,
        child: SecondaryButton('Avslå',
            destructive: true, onPressed: _busy ? null : () => _confirmDecline(trade)),
      );
      if (!trade.youAccepted && !halfFilled) {
        children.add(Row(
          children: [
            decline,
            const SizedBox(width: 10),
            Expanded(
              // 09e's words for a version somebody else proposed, and agreed
              // to by proposing it: what is left is to agree to the change.
              child: PrimaryButton(_counteredByOther(trade) ? 'Godta endringen' : 'Godta byttet',
                  height: 50,
                  busy: _busy,
                  onPressed: () async {
                    final session = context.read<Session>();
                    // 06c is drawn with the bar, so it opens in the tab,
                    // over this screen and under the bar.
                    final accepted = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => AgreementScreen(trade: trade)));
                    // Asked again however 06c was left, «Avbryt» and the
                    // phone's back included: a swipe that heard no answer
                    // may still have reached the server, and only the
                    // server can say. Quietly then, as there is no news.
                    if (mounted) await _load(quiet: accepted != true);
                    // The badges too, as quietly: waited for with nothing
                    // round it, no answer was an error nobody caught.
                    unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
                  }),
            ),
          ],
        ));
        children.add(const SizedBox(height: 6));
      }
      if (!trade.isChain && halfFilled && !trade.youAccepted) {
        // Nothing to accept yet: «Avslå» where it stands beside «Godta
        // byttet», and the way to fill the offer in where that would be.
        children.add(Row(
          children: [
            decline,
            const SizedBox(width: 10),
            Expanded(
              child: SecondaryButton('Sett sammen byttet',
                  accent: true, onPressed: _busy ? null : () => _openCounterOffer(trade)),
            ),
          ],
        ));
      } else if (!trade.isChain) {
        // 42 tall, and the 2 under it — the foot of the bar, or of the gap
        // to «Angre» — answer too.
        children.add(TapArea(
          room: const EdgeInsets.only(bottom: 2),
          child: SecondaryButton(
              halfFilled ? 'Sett sammen byttet' : 'Foreslå motbytte',
              accent: true,
              height: 42,
              onPressed: _busy ? null : () => _openCounterOffer(trade)),
        ));
        footRoom = trade.youAccepted ? 0 : 2;
      } else if (halfFilled && !trade.youAccepted) {
        // A ring is put together in its chat, so there is only the way out.
        children.add(SecondaryButton('Avslå',
            destructive: true, onPressed: _busy ? null : () => _confirmDecline(trade)));
      }
      if (trade.youAccepted) {
        // De-accept: the lifecycle goes backwards as well as forwards, and your
        // yes is what reserved your things. Undoing it leaves the trade
        // standing, which is what makes it different from withdrawing.
        children.add(SizedBox(height: Insets.sm - (trade.isChain ? 0 : 2)));
        children.add(SecondaryButton('Angre godkjenningen',
            onPressed: _busy ? null : () => _confirmRevoke(trade)));
        children.add(const SizedBox(height: Insets.sm));
        children.add(SecondaryButton('Trekk deg fra byttet',
            destructive: true, onPressed: _busy ? null : () => _confirmWithdrawEarly(trade)));
      }
    } else if (trade.state == 'accepted') {
      // No «Angre godkjenningen» here: once everyone has accepted, 06f gives
      // one way out and it is the negotiation on 08a. The endpoint still
      // exists — the lifecycle reverses — but this screen is not where the
      // export offers it.
      if (trade.isChain) {
        // Pressed, it marks your side sent and received, and the trade is
        // done once all three have pressed it. It used to look the same
        // after the press as before, and never said who was left.
        if (trade.youSentAt != null && trade.youReceivedAt != null) {
          final missing = _others(trade)
              .where((p) => p.sentAt == null || p.receivedAt == null)
              .toList();
          children.add(Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(
              missing.isEmpty
                  ? 'Du har markert byttet som gjennomført.'
                  : 'Du har markert byttet som gjennomført. Venter på ${_firstNames(missing)}.',
              style: Type.secondary,
              textAlign: TextAlign.center,
            ),
          ));
        } else {
          children.add(PrimaryButton('Marker byttet som gjennomført',
              busy: _busy,
              onPressed: () => _run((api) => api.completeChainTrade(trade.id))));
        }
        children.add(const SizedBox(height: Insets.sm));
      }
      children.add(SecondaryButton('Trekk deg fra byttet',
          destructive: true, onPressed: _busy ? null : () => _confirmWithdrawLate(trade)));
    } else if (trade.state == 'paused' && (trade.withdrawal?.byYou ?? false)) {
      children.add(SecondaryButton('Angre forespørselen',
          onPressed: _busy ? null : () => _run((api) => api.cancelWithdrawal(trade.id))));
    } else if (trade.state == 'cancelled') {
      children.add(SecondaryButton('Tilbake til Bytter',
          onPressed: () => goToTab(context, 2)));
    } else if (trade.state == 'completed' && trade.yourReviewScore == null) {
      children.add(PrimaryButton(
          // 07l, for a ring, rates both of the others: not «Vurder Kari».
          trade.isChain
              ? 'Vurder byttet'
              : 'Vurder ${trade.receivingFrom.displayName.split(' ').first}',
          onPressed: () async {
            await pushOverBar<void>(context, ReviewScreen(trade: trade));
            await _load();
          }));
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: EdgeInsets.fromLTRB(Insets.screen, Insets.md, Insets.screen, Insets.md - footRoom),
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.line)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }

  Future<void> _openCounterOffer(Trade trade) async {
    // 09a and 09b are drawn with the bar: in the tab, like 06c.
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => CounterOfferScreen(trade: trade)));
    // However it was left: a counter-offer refused because another had
    // landed first comes back with nothing sent, and that other one is
    // what the page has to show now.
    if (mounted) await _load(quiet: changed != true);
  }

  /// Undoing your own acceptance, which is not the same as ending the trade:
  /// the offer stays on the table and it is somebody's turn again.
  Future<void> _confirmRevoke(Trade trade) async {
    final yes = await _confirm(
      title: 'Angre godkjenningen?',
      body: 'Byttet står fortsatt, men du har ikke godtatt det lenger. '
          '${_firstNames(_others(trade))} får beskjed.',
      bullets: const [
        'Tingene dine blir tilgjengelige for andre igjen',
        'Du kan godta på nytt, eller foreslå noe annet',
      ],
      confirm: 'Angre godkjenningen',
    );
    if (yes == true) await _run((api) => api.revokeAcceptance(trade.id));
  }

  Future<void> _confirmDecline(Trade trade) async {
    // Everybody else is told, which in a ring is two.
    final other = _firstNames(_others(trade));
    final yes = await _confirm(
      title: 'Avslå byttet?',
      // With a side still empty nobody can have said yes, so nothing was
      // ever held, and nothing becomes free.
      body: trade.youGive.isEmpty || trade.youGet.isEmpty
          ? 'Byttet avsluttes, og $other får beskjed.'
          : 'Tingene deres blir tilgjengelige for andre igjen, og $other får beskjed.',
      confirm: 'Avslå byttet',
      destructive: true,
    );
    if (yes == true) await _run((api) => api.decline(trade.id));
  }

  /// 09g. Nobody has committed anything, so it just ends.
  ///
  /// Named from the people in it: in a ring the one you receive from may well
  /// have said yes, and it is the third who has not; and both are told.
  Future<void> _confirmWithdrawEarly(Trade trade) async {
    final others = _others(trade);
    final notYet = others.where((p) => p.accepted != true).toList();
    final yes = await _confirm(
      title: 'Trekke deg fra byttet?',
      body: '${_firstNames(notYet.isEmpty ? others : notYet)} har ikke godtatt ennå, så '
          'byttet avbrytes med en gang. Ingen har sendt noe.',
      bullets: [
        'Tingene dine blir tilgjengelige igjen',
        '${_firstNames(others)} får beskjed, samtalen beholdes',
      ],
      confirm: 'Trekk meg fra byttet',
      destructive: true,
    );
    if (yes == true) await _run((api) => api.withdrawEarly(trade.id));
  }

  /// 08a. Everyone accepted, so it is a question, not a decision.
  Future<void> _confirmWithdrawLate(Trade trade) async {
    // Read before the sheet: after awaiting it, the context may be gone.
    final api = context.read<SwaplyApi>();
    final others = _others(trade);
    final other = _firstName(trade.receivingFrom);
    // In a ring both of the others are asked, the first answer decides, and
    // one of them having sent is enough to keep you in: what 08b and 08c
    // say after it, said before it.
    final ring = others.length > 1;
    final either = others.map(_firstName).join(' eller ');
    final yes = await _confirm(
      title: 'Vil du trekke deg fra byttet?',
      body: ring
          ? 'Dere har alle godtatt, og $either kan allerede ha sendt tingen sin. '
              'Vi spør ${_firstNames(others)} om det er greit at du trekker deg.'
          : 'Dere har begge godtatt, og $other kan allerede ha sendt tingen sin. '
              'Vi spør $other om det er greit at du trekker deg.',
      bullets: [
        // The export's «når han sier ja» was written for Ola. Said of whoever
        // is on the other side, a pronoun is a guess, and a wrong one for
        // half of them; the answer is what the sentence is about anyway.
        if (ring) ...[
          'Har ingen av dem sendt noe, avbrytes byttet når en av dem svarer ja',
          '✕Har en av dem allerede sendt, kan du ikke trekke deg',
        ] else ...[
          'Har $other ikke sendt noe, avbrytes byttet når svaret er ja',
          '✕Har $other allerede sendt, kan du ikke trekke deg',
        ],
      ],
      confirm: 'Spør om å trekke meg',
      destructive: true,
    );
    if (yes != true) return;

    setState(() => _busy = true);
    try {
      final result = await api.requestWithdrawal(trade.id);
      if (!mounted) return;
      _asking++;
      setState(() => _trade = result.trade);
      if (result.blocked) {
        await _confirm(
          title: 'Du kan ikke trekke deg',
          body: '${_alreadySent(result.trade)} Byttet fortsetter som normalt.',
          confirm: 'Tilbake til byttet',
          cancel: null,
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      showError(context, e);
      // Refused because the trade has moved on — asked already on another
      // phone, or no longer agreed: the page asks for it again, as [_run]
      // does.
      if (!e.isNoContact) unawaited(_load(quiet: true));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// A sheet that asks before something is done to the trade. A bullet that
  /// starts with «✕» is something that cannot be done, and is marked so in
  /// red rather than ticked: 08a's «Har Kari allerede sendt, kan du ikke
  /// trekke deg» wore a green tick, as if it were one more thing granted.
  ///
  /// [destructive] is for leaving or declining, which is the app's
  /// destructive button and never the green way on, as «Avslå» and «Trekk
  /// deg fra byttet» are on the page under it, and «Fjern annonsen» and
  /// «Slett kontoen» are where they are asked.
  Future<bool?> _confirm({
    required String title,
    required String body,
    required String confirm,
    String? cancel = 'Avbryt',
    List<String> bullets = const [],
    bool destructive = false,
  }) =>
      showModalBottomSheet<bool>(
        context: context,
        // Over the bar, not inside the tab under it; see `pushOverBar`.
        useRootNavigator: true,
        // As tall as what is in it, and scrolling past that. Held to nine
        // sixteenths of the screen and not scrolling, 08a ran 31 points past
        // its foot on a 360×640 phone at the ordinary text size, and «Avbryt»
        // was cut off — at 130 % «Spør om å trekke meg» went with it.
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
        builder: (sheet) => SafeArea(
          child: SingleChildScrollView(
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
                          // ✓ and ✕ in the export's green and red, which a
                          // screen reader has in the words that follow.
                          ExcludeSemantics(
                            child: line.startsWith('✕')
                                ? const Icon(Icons.close, size: 16, color: SwaplyColors.redText)
                                : const Icon(Icons.check,
                                    size: 16, color: SwaplyColors.greenPressed),
                          ),
                          const SizedBox(width: Insets.sm),
                          Expanded(
                              child: Text(line.startsWith('✕') ? line.substring(1) : line,
                                  style: Type.body)),
                        ],
                      ),
                    ),
                ],
                const SizedBox(height: Insets.lg),
                destructive
                    ? SecondaryButton(confirm,
                        destructive: true, onPressed: () => Navigator.of(sheet).pop(true))
                    : PrimaryButton(confirm, onPressed: () => Navigator.of(sheet).pop(true)),
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

/// «Kari», as every line on the trade screen names somebody.
String _firstName(UserRef person) => person.displayName.split(' ').first;

/// «Kari», or «Kari og Per»: the two others in a ring.
String _firstNames(List<UserRef> people) {
  final names = people.map(_firstName).toList();
  if (names.length < 2) return names.firstOrNull ?? '';
  return '${names.sublist(0, names.length - 1).join(', ')} og ${names.last}';
}

String _longDate(DateTime date) => '${date.day}. ${_months[date.month - 1]} ${date.year}';

/// «i dag», «i går», or «4. september»: when something was marked, by the
/// calendar's days.
String _day(DateTime when) {
  final today = now();
  final days = DateTime.utc(today.year, today.month, today.day)
      .difference(DateTime.utc(when.year, when.month, when.day))
      .inDays;
  if (days == 0) return 'i dag';
  if (days == 1) return 'i går';
  return '${when.day}. ${_months[when.month - 1]}';
}
