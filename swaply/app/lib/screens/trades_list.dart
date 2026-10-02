import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
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

class _TradesScreenState extends State<TradesScreen>
    with SingleTickerProviderStateMixin, RefetchOnTabReturn {
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

  /// A trade's page has closed, and the list is to be asked for again once
  /// the frame is over — unless the tab has landed here meanwhile and asked
  /// for it already; see [_back].
  bool _backPending = false;

  @override
  void onTabReturn() {
    _backPending = false;
    _load();
  }

  /// Opens a trade, and asks for the list again when it closes: what it says
  /// has probably changed. A flow finished there — «Tilbake til Bytter», a
  /// review sent — closes it by landing on this tab, and landing asks as
  /// well, so the list was fetched twice for one way back. The landing is
  /// told in the frame the page closes in, so this waits out that frame and
  /// asks only if nothing else has.
  Future<void> _openTrade(Trade trade) async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => TradeDetailScreen(tradeId: trade.id)));
    await _back();
  }

  Future<void> _back() async {
    _backPending = true;
    await SchedulerBinding.instance.endOfFrame;
    if (!mounted || !_backPending) return;
    _backPending = false;
    await _load();
  }

  /// Asked for on opening, on coming back to the tab, when a trade page
  /// closes, and on a pull. Only with nothing on screen yet can it fail into
  /// «Fikk ikke kontakt»: otherwise the list stays, as the tab's return
  /// promises — behind what is on screen, not instead of it — and [say] tells
  /// a failed pull in a toast over it. The error used to replace a list that
  /// was there, and stayed after the connection came back, since an answer
  /// never cleared it: «Prøv igjen» fetched the list and went on showing the
  /// error.
  Future<void> _load({bool say = false}) async {
    try {
      final data = await context.read<SwaplyApi>().trades();
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
      });
      await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_data == null) {
        setState(() => _error = e.message);
      } else if (say) {
        showError(context, e);
      }
    }
  }

  /// «Prøv igjen»: the spinner while it asks, not the error it is asking past.
  void _retry() {
    setState(() => _error = null);
    _load();
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
          // 12 under the heading, 9 of them inside the track's room.
          Padding(
            padding: EdgeInsets.fromLTRB(22, 6, 22, data != null && !empty ? 3 : 12),
            child: const Text('Mine handler', style: Type.screen),
          ),
          if (data != null && !empty)
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 0),
              child: _Segments(
                controller: _tabs,
                labels: [
                  'Venter · ${data.waiting.length}',
                  'Aktive · ${data.active.length}',
                  'Fullført · ${data.done.length}',
                ],
              ),
            ),
          Expanded(
            child: _error != null
                ? EmptyState(
                    title: 'Fikk ikke kontakt',
                    body: _error!,
                    icon: Icons.wifi_off,
                    actionLabel: 'Prøv igjen',
                    onAction: _retry)
                : data == null
                    ? const Center(child: CircularProgressIndicator())
                    : empty
                        ? EmptyState(
                            icon: Icons.swap_horiz,
                            title: 'Ingen bytter ennå',
                            body: 'Lik noe på Oppdag, eller legg ut en ting. Når noen vil '
                                'bytte, havner det her.',
                            actionLabel: 'Gå til Oppdag',
                            onAction: () => goToTab(context, 0),
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
      onRefresh: () => _load(say: true),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(22, 16, 22, 16),
        itemCount: trades.length,
        itemBuilder: (context, i) => _card(trades[i]),
      ),
    );
  }

  Widget _card(Trade trade) {
    // A deal you could say yes to and have not, by the rule the server
    // counts «Din tur» by: both sides hold something. An offer with an
    // empty side has no yes in it, and «Godta byttet» on one opened a
    // trade with nothing to accept.
    final canAccept = !trade.youAccepted &&
        ['pending', 'countered'].contains(trade.state) &&
        trade.youGive.isNotEmpty &&
        trade.youGet.isNotEmpty;
    // Somebody else has asked to be let out, and the answer is yours: the
    // trade waits on it, as the badge counts it.
    final w = trade.withdrawal;
    final asked = trade.state == 'paused' && w != null && w.state == 'waiting' && !w.byYou;
    final yourTurn = canAccept || asked;
    final other = trade.receivingFrom.displayName.split(' ').first;

    final (label, colour) = switch (trade.state) {
      'talking' => ('Samtale', SwaplyColors.greySoft),
      'pending' => canAccept
          ? ('Din tur', SwaplyColors.amberText)
          : ('Venter på $other', SwaplyColors.inkMuted),
      'countered' => ('Endret', SwaplyColors.amberText),
      'accepted' => ('Godtatt', SwaplyColors.greenText),
      'paused' => asked ? ('Svar', SwaplyColors.amberText) : ('Pauset', SwaplyColors.amberText),
      'completed' => ('Gjennomført', SwaplyColors.greenText),
      _ => ('Avsluttet', SwaplyColors.redText),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      // Its own node, the card and not the 12 under it, and «Godta byttet»
      // inside it a node of its own.
      child: Semantics(
        container: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openTrade(trade),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
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
                        style: const TextStyle(fontSize: 12, color: SwaplyColors.grey)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: colour == SwaplyColors.amberText
                            ? SwaplyColors.amberBg
                            : colour == SwaplyColors.greenText
                                ? SwaplyColors.availableBg
                                : SwaplyColors.chip,
                        borderRadius: BorderRadius.circular(Radii.pill),
                      ),
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: colour)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // «det du får → deg → det du gir», with the name over each thing.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _leg('${trade.receivingFrom.displayName.split(' ').first} gir',
                          trade.youGet, SwaplyColors.greenText),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Column(
                        children: [
                          SizedBox(height: 37),
                          Text('→',
                              style: TextStyle(
                                  fontSize: 34,
                                  height: 1,
                                  fontWeight: FontWeight.w800,
                                  color: SwaplyColors.greenPressed)),
                          SizedBox(height: 5),
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
                          trade.youGive, SwaplyColors.amberText),
                    ),
                  ],
                ),
                if (canAccept) ...[
                  const SizedBox(height: Insets.md),
                  PrimaryButton('Godta byttet', onPressed: () => _openTrade(trade)),
                ],
              ],
            ),
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
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: labelColour),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 6),
          if (items.isEmpty)
            Container(
              height: 86,
              width: 86,
              decoration: BoxDecoration(
                color: SwaplyColors.chip,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.more_horiz, color: SwaplyColors.greyLight),
            )
          else
            ItemThumb(items.first, size: 86, radius: 16),
          const SizedBox(height: 6),
          Text(
            items.isEmpty ? 'ingenting ennå' : items.map((i) => i.title).join(' + '),
            style: const TextStyle(
                fontSize: 11.5, fontWeight: FontWeight.w600, color: SwaplyColors.inkBody),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      );
}

/// «Venter · Aktive · Fullført»: a segmented control, not an underline — the
/// export draws a grey track with the chosen one as a white pill inside it.
///
/// It was a [TabBar], which lays a tab out exactly as tall as its pill and
/// ripples across all of it, so a tab could answer across no more than the 35
/// it draws. This is laid out and styled as that TabBar was, to the pixel, and
/// driven by the same [TabController], so the pill still slides with a swipe;
/// each ripple stays on its pill, and a finger gets the 9 over the track too.
class _Segments extends StatelessWidget {
  const _Segments({required this.controller, required this.labels});

  final TabController controller;
  final List<String> labels;

  /// The TabBar's own sizes: a 33-tall tab over its 2-point indicator line.
  static const _tab = 33.0, _line = 2.0;

  /// What a label keeps clear of its pill's edges. The TabBar's 16 a side
  /// left «Fullført · 3» 58 points on a 320-wide phone, where it faded out
  /// before its count; the label is centred either way, so where it fits
  /// nothing moves.
  static const _labelPadding = EdgeInsets.symmetric(horizontal: 6);

  @override
  Widget build(BuildContext context) {
    // As the TabBar mixes them: the theme's titleSmall under the label style.
    final titleSmall = Theme.of(context).textTheme.titleSmall!;
    final on = titleSmall
        .merge(const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))
        .copyWith(inherit: true);
    final off = titleSmall
        .merge(const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))
        .copyWith(inherit: true);
    final animation = controller.animation!;

    return TapRoom(
      room: const EdgeInsets.only(top: 9),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: SwaplyColors.chip,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: AnimatedBuilder(
            animation: animation,
            builder: (context, _) => LayoutBuilder(builder: (context, box) {
              final width = box.maxWidth / labels.length;
              return Stack(
                children: [
                  Positioned(
                    left: animation.value * width,
                    top: 0,
                    width: width,
                    height: _tab + _line,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(11),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (final (i, label) in labels.indexed)
                        Expanded(child: _segment(i, label, on, off, animation.value)),
                    ],
                  ),
                ],
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _segment(int i, String label, TextStyle on, TextStyle off, double at) {
    final chosen = (1 - (at - i).abs()).clamp(0.0, 1.0);
    return TapArea(
      child: Semantics(
        selected: i == controller.index,
        child: InkWell(
          onTap: () => controller.animateTo(i),
          borderRadius: BorderRadius.circular(11),
          child: Padding(
            padding: const EdgeInsets.only(bottom: _line),
            child: Center(
              heightFactor: 1,
              child: Padding(
                padding: _labelPadding,
                child: DefaultTextStyle.merge(
                  style: TextStyle.lerp(on, off, 1 - chosen)!.copyWith(
                      color: Color.lerp(SwaplyColors.greySoft, SwaplyColors.ink, chosen)),
                  child: SizedBox(
                    height: _tab,
                    child: Center(
                      widthFactor: 1,
                      // Narrower still — a larger text size, a count in the
                      // hundreds — it gets smaller rather than losing the
                      // count, which is the point of it.
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(label, softWrap: false),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
