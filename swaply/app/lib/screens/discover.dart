import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'item_detail.dart';
import 'profile.dart';
import 'post_item.dart';
import 'trade_detail.dart';

/// 05 Oppdag. One page under Discover's name with the search page's behaviour:
/// the field is always there, and before a search the rows come from the
/// interests picked on screen 02.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> with RefetchOnTabReturn {
  final _search = TextEditingController();
  SearchFilters _filters = const SearchFilters();

  bool _loading = true;
  String? _error;
  int _total = 0;
  List<Item> _results = const [];

  /// «Alt» is null. The chip row is a filter on one grid, which is what the
  /// export draws: one home tab, not a shelf per interest.
  String? _chip;

  /// How many times the collage has been asked for, and which asking the one
  /// on screen is the answer to. Only the newest asking is taken: two can be
  /// on their way at once — a chip tapped while the grid was asked for behind
  /// it, a search sent while the last one was still out — and the older one,
  /// landing last, put back a grid for a search nobody was looking at.
  int _asked = 0, _shown = 0;

  /// The hearts pressed on this collage, by item: what the person made it,
  /// and the last asking sent before the server had said yes or no to it —
  /// null while it is still on its way. The grid stays live while it is
  /// asked for again behind it, so a heart can be newer than the answer on
  /// its way, and that answer, landing after, turned the heart back. A
  /// collage asked for no later than [until] is out of date about that card;
  /// one asked for after it is the server's word again.
  final _hearts = <String, ({bool liked, int? until})>{};

  void _heard(String id, bool liked, {required bool answered}) =>
      _hearts[id] = (liked: liked, until: answered ? _asked : null);

  bool _likedOn(Item item) {
    final heart = _hearts[item.id];
    if (heart == null) return item.likedByMe;
    final until = heart.until;
    return until == null || _shown <= until ? heart.liked : item.likedByMe;
  }

  /// «Ikke vis meg slike» pressed on this collage, kept the way a heart is: a
  /// collage asked for no later than [until] was asked before the server had
  /// the kind, and still has its listings in it. They are left out here until
  /// a collage asked for after it — which the server leaves them out of — is
  /// on screen. Kept here and not in the grid itself, so the grid goes on
  /// being the server's answer, and a kind shown again comes straight back.
  final _hidden = <({HiddenKind kind, int? until})>[];

  /// How many times «Ikke vis meg slike» has been pressed here. «Angre» on a
  /// toast shows everything again, so it is that hide's to undo only while no
  /// other has been pressed since: a second kind, hidden while the first
  /// one's toast was still up, would have come back with it.
  int _hides = 0;

  List<Item> get _visible => [
        for (final item in _results)
          if (!_hidden.any((h) => (h.until == null || _shown <= h.until!) && h.kind.covers(item)))
            item,
      ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  // Behind the grid rather than instead of it: a spinner in its place would
  // also throw away how far down it you were.
  @override
  void onTabReturn() => _load(quiet: true);

  /// [quiet] keeps what is on screen while it asks, and keeps it if the asking
  /// fails: coming back to the tab is not the moment to be told the network
  /// dropped out a minute ago. [say] tells it anyway, in a toast over the
  /// grid, for a pull that asked for the grid in so many words.
  ///
  /// Only a grid that is on screen, and is the answer to what is asked, is
  /// kept. Under a spinner — a chip tapped, a search sent — [_results] is
  /// still the grid from before, and a quiet asking that overtook the spinner
  /// and then failed left that grid standing under the new chip, with its
  /// count and no word of what had happened. Under «Fikk ikke kontakt» there
  /// is no grid to keep.
  Future<void> _load({bool quiet = false, bool say = false}) async {
    if (!mounted) return;
    final behind = quiet && !_loading && _error == null && _results.isNotEmpty;
    if (!behind) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    final api = context.read<SwaplyApi>();
    final asked = ++_asked;
    try {
      final res = await api.discover(
        q: _search.text.trim(),
        // The chip wins over the filter sheet's category: it is the one the
        // person can see.
        category: _chip ?? _filters.category,
        subcategory: _filters.subcategory,
        minValue: _filters.minValue,
        maxValue: _filters.maxValue,
        condition: _filters.condition,
        sort: _filters.sort,
      );
      if (!mounted || asked != _asked) return;
      setState(() {
        _total = res.total;
        _results = res.items;
        _shown = asked;
        _loading = false;
        _error = null;
        // Asked for after the server had them: the answer is its word again.
        _hidden.removeWhere((h) => h.until != null && h.until! < asked);
      });
    } on ApiException catch (e) {
      // A newer asking is on its way, and it is the one that says.
      if (!mounted || asked != _asked) return;
      setState(() {
        _loading = false;
        if (!behind) _error = e.message;
      });
      if (behind && say) showError(context, e);
    }
  }

  /// Pulled down: asked again behind the grid, which stays where it was with
  /// the pull's own spinner over it. It used to be the first load over again,
  /// so the grid went, a spinner stood in its place and the scroll was lost.
  Future<void> _refresh() => _load(quiet: true, say: true);

  /// «Ikke vis meg slike» from a card's long press. The kind goes from the
  /// grid at once, the way a heart turns at once, and comes back if the
  /// server does not take it.
  Future<void> _hide(Item item) async {
    final api = context.read<SwaplyApi>();
    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    final by = session.me?.id;
    final press = ++_hides;
    final guess = (kind: HiddenKind.of(item), until: null);
    setState(() => _hidden.add(guess));
    try {
      final hid = await api.hide(item.id);
      if (mounted) {
        setState(() {
          _hidden
            ..remove(guess)
            ..add((kind: hid.kind, until: _asked));
        });
      }
      // The count 16b shows.
      unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
      // Undoing it is «show me everything again», because that is the one way
      // back the server keeps. So it is offered only when the server, having
      // just written this down, counts one thing hidden: anything hidden
      // before it, here or on another phone or brought along by a sign-in,
      // would come back with it. It used to go by the session's own count,
      // which could be from before a sign-in whose answer never gave one.
      final alone = hid.count == 1;
      showDoneOn(
          messenger,
          // A listing with no subcategory is hidden alone, and «flere slike»
          // promised every other one in its category too.
          hid.kind.itemId != null
              ? 'Vi viser deg ikke denne igjen.'
              : 'Vi viser deg ikke flere slike.',
          action: alone
              ? ToastAction(
                  'Angre', () => _showAgain(api, session, messenger, by: by, press: press))
              : null);
    } on ApiException catch (e) {
      if (mounted) setState(() => _hidden.remove(guess));
      showErrorOn(messenger, e);
    }
  }

  /// «Angre» on the toast: everything hidden is shown again, which [_hide]
  /// only offers while that is this one kind. The toast can outlive the
  /// account it was said to — it is the app's, not the tab's — and «Angre»
  /// pressed after a switch would show somebody else everything they hid.
  /// Nor after another hide here, [press] being the one it was offered for.
  Future<void> _showAgain(SwaplyApi api, Session session, ScaffoldMessengerState messenger,
      {required String? by, required int press}) async {
    if (session.me?.id != by || press != _hides) return;
    try {
      await api.showEverything();
    } on ApiException catch (e) {
      showErrorOn(messenger, e);
      return;
    }
    unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
    if (!mounted) return;
    // What the grid still holds comes back at once; what a collage asked for
    // since left out comes with the next.
    setState(_hidden.clear);
    await _load(quiet: true);
  }

  Future<void> _openFilters() async {
    // 05b is drawn without the bar, so it covers it.
    final result = await pushOverBar<SearchFilters>(
        context, AdvancedSearchScreen(initial: _filters, query: _search.text));
    if (result != null) {
      setState(() {
        _filters = result;
        // The sheet's «Vis 24 treff» counted with the category chosen in it,
        // and the chip above the grid used to win afterwards — so the button
        // promised one number and the page showed another. Whichever was
        // touched last is the one that means something.
        _chip = result.category;
      });
      if (result.query != null) _search.text = result.query!;
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return SwaplyScaffold(
      currentTab: 0,
      child: Column(
        children: [
          Padding(
            // 18 at the sides on this screen, 6 above and 10 below the field —
            // the 10 below inside the chips, which answer across it.
            padding: const EdgeInsets.fromLTRB(18, 6, 18, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600, color: SwaplyColors.ink),
                    decoration: InputDecoration(
                      hintText: 'Søk etter ting du vil ha',
                      hintStyle: const TextStyle(fontSize: 15, color: SwaplyColors.greyLight),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(Radii.pill),
                          borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(Radii.pill),
                          borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(Radii.pill),
                          borderSide: const BorderSide(color: SwaplyColors.greenPressed)),
                      prefixIcon: const Icon(Icons.search, size: 20, color: SwaplyColors.greenPressed),
                      contentPadding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                _SquareIconButton(
                  icon: Icons.tune,
                  active: _filters.isActive,
                  onTap: _openFilters,
                ),
              ],
            ),
          ),
          _categoryChips(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  /// «Alt» and then the twelve, scrolling sideways. A filter on one grid, the
  /// way the export draws the home tab.
  /// The order the export lines the chips up in on 05 — not the order of the
  /// interest grid, and not alphabetical.
  static const _chipOrder = [
    'gaming', 'klaer', 'verktoy', 'sykling', 'bat', 'friluft',
    'barn', 'hjem', 'sport', 'musikk', 'boker', 'diverse',
  ];

  // The chip row keeps the export's order rather than leading with the
  // interests: round 5 draws «Alt · Gaming · Klær · Verktøy · Sykling · Båt»
  // for somebody whose interests are Sykling, Gaming and Verktøy, so that row
  // is deliberately not personalised. The personalisation DESIGN.md asks for
  // sits in what the grid shows first, which the export does not draw — see
  // `/discover` in the backend.

  /// A 29-tall chip answers across 51: the 10 over it from the field's row,
  /// the 12 under it, and half of the 7 to the chip on either side, so a
  /// finger in the gap gets the nearer chip. The row scrolls, so it cannot be
  /// a [TapRoom]; each chip lays its halves out inside itself, and the list's
  /// padding is short by the same. Nothing is drawn anywhere else: 18 in, 7
  /// apart, and 25 past the last chip at the end of the scroll.
  static const _halfGap = 7 / 2;

  Widget _categoryChips() => SizedBox(
        height: 10 + 29 + 12,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18 - _halfGap, 0, 18 + 7 - _halfGap, 0),
          children: [
            _chipButton('Alt', null),
            for (final key in _chipOrder) _chipButton(categoryLabels[key]!, key),
          ],
        ),
      );

  Widget _chipButton(String label, String? category) => TapArea(
        room: const EdgeInsets.fromLTRB(_halfGap, 10, _halfGap, 12),
        onTap: () {
          if (_chip == category) return;
          setState(() => _chip = category);
          _load();
        },
        child: Center(child: Pill(label, selected: _chip == category)),
      );

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return EmptyState(
        icon: Icons.wifi_off,
        title: 'Fikk ikke kontakt',
        body: _error!,
        actionLabel: 'Prøv igjen',
        onAction: _load,
      );
    }

    final results = _visible;
    if (results.isEmpty) {
      final filtered = _search.text.trim().isNotEmpty || _chip != null || _filters.isActive;
      return EmptyState(
        icon: filtered ? Icons.search_off : Icons.explore_outlined,
        title: filtered ? 'Ingen treff' : 'Ingenting å vise ennå',
        body: filtered
            ? 'Prøv et annet ord, eller løsne på filtrene.'
            : 'Søk etter noe du vil ha, eller legg ut en ting så folk finner deg.',
        actionLabel: filtered ? null : 'Legg ut en ting',
        onAction: filtered ? null : () => openListingForm(context),
      );
    }

    // Two columns that fill independently, so cards of different heights sit
    // beside each other the way the collage in the export does. A grid with one
    // aspect ratio would line them up in rows and lose that.
    final left = <Item>[];
    final right = <Item>[];
    for (var i = 0; i < results.length; i++) {
      (i.isEven ? left : right).add(results[i]);
    }
    Widget column(List<Item> items, int offset) => Expanded(
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                ItemCard(
                  key: ValueKey(items[i].id),
                  item: items[i],
                  liked: _likedOn(items[i]),
                  onHeart: (liked, {required answered}) =>
                      _heard(items[i].id, liked, answered: answered),
                  // Behind the grid, like a tab coming back: coming back from
                  // a card's page is not a new search, and a spinner in the
                  // grid's place would redraw every picture and lose how far
                  // down it you were.
                  onChanged: () => _load(quiet: true),
                  onHide: () => _hide(items[i]),
                  // Three heights, cycling: a collage is made of things that
                  // are not the same shape.
                  // Never taller than square: the export's collage runs from
                  // 1:1 to about 1.4:1, and a portrait card would stand out.
                  aspect: const [1.0, 1.42, 1.21, 1.06, 1.13][(i * 2 + offset) % 5],
                ),
                const SizedBox(height: 16),
              ],
            ],
          ),
        );

    // Less what is hidden here and still in the answer, so the count is of
    // the grid under it.
    final total = _total - (_results.length - results.length);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, Insets.xl),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('$total treff', style: const TextStyle(fontSize: 12.5, color: SwaplyColors.grey)),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              column(left, 0),
              const SizedBox(width: 14),
              column(right, 1),
            ],
          ),
        ],
      ),
    );
  }
}

class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({required this.icon, required this.onTap, this.active = false});

  final IconData icon;
  final VoidCallback onTap;
  final bool active;

  // An icon, so it is named: 05b is «Avansert søk».
  @override
  Widget build(BuildContext context) => TapArea(
        label: 'Avansert søk',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.pill),
          child: Container(
            height: 48,
            width: 48,
            decoration: BoxDecoration(
              color: active ? SwaplyColors.greenPressed : Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: SwaplyColors.fieldLine),
            ),
            child: Icon(icon, size: 20, color: active ? Colors.white : SwaplyColors.inkBody),
          ),
        ),
      );
}

class ItemCard extends StatefulWidget {
  const ItemCard(
      {super.key,
      required this.item,
      required this.onChanged,
      this.liked,
      this.onHeart,
      this.onHide,
      this.aspect});

  final Item item;

  /// Whether the heart is on, where the collage knows better than [item]: a
  /// heart pressed here since [item] was asked for.
  final bool? liked;

  /// Told as the heart is pressed, here or on this card's page, with what it
  /// was made, and again once the server has answered, with what it is now.
  /// The collage keeps it, since this card may be gone by the answer.
  final void Function(bool liked, {required bool answered})? onHeart;

  /// When this card's page, or its owner's profile, has been opened and
  /// closed again, and when a report from its long press has landed with a
  /// block: a block changes what the grid should show. Never for a heart, on the card or
  /// on the page, which changes the card and nothing else — the page's comes
  /// back through [onHeart] like the card's own.
  final VoidCallback onChanged;

  /// «Ikke vis meg slike» from the long press. The collage takes the kind out
  /// of the grid; without one there is nowhere to hide it from, and the long
  /// press leaves it out.
  final VoidCallback? onHide;

  /// Width over height for the picture. Given by the collage so that cards are
  /// not all the same shape; null lets the card fill whatever it is put in.
  final double? aspect;

  @override
  State<ItemCard> createState() => _ItemCardState();
}

class _ItemCardState extends State<ItemCard> {
  late bool _liked = widget.liked ?? widget.item.likedByMe;
  bool _busy = false;

  /// Bumped by every press of this card's heart, here or on its page. An
  /// answer is the card's to act on only while no press has come since the
  /// one it answers: a refusal of the card's own heart used to land after the
  /// page's heart and turn the card back over it — and tell the collage so.
  int _turns = 0;

  /// Hearts from here or from the page on their way. While any is, what the
  /// page was told when it opened may be from before it landed.
  int _inFlight = 0;

  @override
  void didUpdateWidget(ItemCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The grid is fetched again behind the cards when the tab comes back, and
    // a heart taken back somewhere else in the meantime is the server's to
    // tell. Not while a tap here is still on its way.
    if (!_busy && !identical(oldWidget.item, widget.item)) {
      _liked = widget.liked ?? widget.item.likedByMe;
    }
  }

  /// The heart turns on the tap and changes this card and nothing else. It
  /// used to fetch the whole collage again once the answer came, which put a
  /// spinner in the grid's place and built it back from nothing — every
  /// picture drawn again and the scroll back at the top, for one heart.
  /// Nothing else on the page depends on a wish: it reserves nothing, so no
  /// card comes or goes because of one, and whether this one is wished is
  /// [_liked].
  Future<void> _toggle() async {
    if (_busy) return;
    final want = !_liked;
    final turn = ++_turns;
    _inFlight++;
    setState(() {
      _busy = true;
      _liked = want;
    });
    final heard = widget.onHeart;
    heard?.call(want, answered: false);
    var answered = false;
    // Through the session, which holds a sign-in back until the heart lands.
    final session = context.read<Session>();
    final by = session.me?.id;
    // For what comes after, which is owed to this heart even if the card is
    // gone by the time the answer comes; see [followWish].
    final root = Navigator.of(context, rootNavigator: true);
    LikeAnswer? wished;
    try {
      if (want) {
        wished = await session.like(widget.item.id);
      } else {
        await session.unlike(widget.item.id);
      }
      answered = true;
      if (turn == _turns) heard?.call(want, answered: true);
    } on ApiException catch (e) {
      // Refused, or never heard: [ApiException.noContact] is one of these.
      answered = true;
      if (turn == _turns) {
        heard?.call(!want, answered: true);
        if (mounted) setState(() => _liked = !want);
      }
      if (mounted) showError(context, e);
    } finally {
      // Anything else is a fault in this app, not an answer. The card goes on
      // showing what was pressed, and the next collage says what is so.
      if (!answered && turn == _turns) heard?.call(want, answered: true);
      _inFlight--;
      if (mounted) setState(() => _busy = false);
    }
    // After the heart is done with, not inside it: what comes next is a
    // screen on top, and the heart is free to be pressed again under it.
    if (wished != null) await followWish(mounted ? context : null, root, session, wished, by: by);
  }

  /// The card's page: its heart is this card's heart, and the card is under
  /// the page. It turns as the page's does, so the page slides away off the
  /// heart the person left it with instead of the one from before. The
  /// collage keeps it too, for an answer asked for before it that lands
  /// after — the same as a heart pressed on the card.
  Future<void> _open() async {
    final heard = widget.onHeart;
    // The turn the page's heart last took, so an answer to it that comes
    // after the card's own heart has been pressed again is not taken.
    var pressed = 0;
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ItemDetailScreen(
              itemId: widget.item.id,
              onHeart: (liked, {required answered}) {
                if (!answered) {
                  pressed = ++_turns;
                  _inFlight++;
                } else {
                  _inFlight--;
                  if (pressed != _turns) return;
                }
                heard?.call(liked, answered: answered);
                if (mounted) setState(() => _liked = liked);
              },
              // What the server told the page, which was asked for after the
              // collage this card came from. It used to be the page's alone:
              // a heart the collage had wrong stayed wrong on the card after
              // the page had shown it right. Not while a heart is on its way,
              // which the server may not have heard yet when it answered.
              onSeen: (liked) {
                if (_inFlight > 0 || liked == _liked) return;
                heard?.call(liked, answered: true);
                if (mounted) setState(() => _liked = liked);
              },
            )));
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    return GestureDetector(
      onTap: _open,
      onLongPress: () =>
          _showContextMenu(context, item, onChanged: widget.onChanged, onHide: widget.onHide),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sized(
            Stack(
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.card),
                    child: item.cover != null
                        ? Image.network(item.cover!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => _generatedCard(item))
                        : _generatedCard(item),
                  ),
                ),
                // 34 across, 8 in from the corner, and answering across 44:
                // five of the eight all round, which keeps the rest of the
                // picture the card's.
                Positioned(
                  right: 8 - 5,
                  top: 8 - 5,
                  // A drawn circle is an unnamed button to a screen reader,
                  // and this is the one on the card that matters. Named as on
                  // the item page, so a heart is called one thing everywhere.
                  child: TapArea(
                    room: const EdgeInsets.all(5),
                    label: _liked ? 'Du vil ha denne' : 'Jeg vil ha',
                    onTap: _toggle,
                    child: Container(
                      height: 34,
                      width: 34,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.92),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _liked ? Icons.favorite : Icons.favorite_border,
                        size: 18,
                        color: _liked ? SwaplyColors.coral : SwaplyColors.ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // The export's caption: 7 down and 2 in, the name at 13/700 with the
          // value at 10.5/600 beside it, and the name wraps while the value
          // stays put at the top right.
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 7, 2, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Flexible(
                  child: Text(item.title,
                      style: const TextStyle(
                          fontSize: 13,
                          height: 1.15,
                          fontWeight: FontWeight.w700,
                          color: SwaplyColors.ink)),
                ),
                if (item.estimatedValueNok != null) ...[
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Verdi ${kr(item.estimatedValueNok)}',
                        style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: SwaplyColors.grey)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// A collage gives every card a shape; a list of one item does not, and then
  /// the picture just fills the space it was given.
  Widget _sized(Widget child) =>
      widget.aspect == null ? Expanded(child: child) : AspectRatio(aspectRatio: widget.aspect!, child: child);

  Widget _generatedCard(Item item) => Container(
        color: SwaplyColors.greenSoft,
        child: Center(
          child: Icon(categoryIcons[item.category] ?? Icons.category_outlined,
              size: 34, color: SwaplyColors.greenDeep),
        ),
      );
}

/// Long press keeps the rare actions. The heart is not among them any more.
///
/// Each of them can change what the grid should hold, and the grid is told:
/// [onHide] takes a kind out of it, and [onChanged] asks for it again, behind
/// it, once a report that blocked has landed or the owner's profile is closed
/// — a block from either used to leave the owner's things in the grid until
/// the tab came back.
Future<void> _showContextMenu(BuildContext context, Item item,
    {required VoidCallback onChanged, VoidCallback? onHide}) async {
  await showModalBottomSheet<void>(
    context: context,
    // Over the bar, like every sheet: a sheet inside a tab stops at the bar
    // and leaves it tappable under the dimming.
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (onHide != null)
            ListTile(
              leading: const Icon(Icons.visibility_off_outlined),
              title: const Text('Ikke vis meg slike'),
              onTap: () {
                Navigator.of(sheet).pop();
                onHide();
              },
            ),
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('Se profil'),
            onTap: () async {
              Navigator.of(sheet).pop();
              final owner = item.ownerId;
              if (owner == null) return;
              await Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => OtherProfileScreen(userId: owner)));
              onChanged();
            },
          ),
          ListTile(
            leading: const Icon(Icons.flag_outlined, color: SwaplyColors.red),
            title: const Text('Rapporter', style: TextStyle(color: SwaplyColors.red)),
            onTap: () async {
              Navigator.of(sheet).pop();
              // Once the report has landed, and only if it blocked: asked for
              // as the sheet closed, the grid came back from before the block
              // was written, with the owner's things still in it.
              final blocked = await showReportSheet(context,
                  itemId: item.id, personName: item.owner?.displayName);
              if (blocked) onChanged();
            },
          ),
        ],
      ),
    ),
  );
}

/// What comes after a wish that landed: the match screen when it opened a
/// trade, and 10a when this count is one the server offers it at. Both are the
/// heart's, not the screen's it was pressed on — the server offers 10a on one
/// heart, the fifth or the fifteenth, and not on the next, and a match is a
/// trade that has opened either way. A heart on 04 turns on the tap, so ‹ can
/// come before the answer, and leaving cost the match screen and the sheet.
/// So they go up over [context] while it is still there, and over whatever is
/// on screen otherwise — null, or no longer mounted — through [root]: the
/// root navigator, taken before the heart went. Nothing goes up for somebody
/// the phone is no longer: a heart answered after a sign-out, or a switch of
/// account, belongs to whoever pressed it ([by]).
Future<void> followWish(BuildContext? context, NavigatorState root, Session session,
    LikeAnswer wished, {required String? by}) async {
  if (session.me?.id != by) return;
  BuildContext over() => context != null && context.mounted ? context : root.context;
  final tradeId = wished.tradeId;
  if (tradeId != null) {
    // A heart taken back and pressed again finds the ring its first press
    // opened, and the server answers with that trade rather than a second
    // one. 06a is the moment a trade opens, and this one has had it: put up
    // again, over whatever the offer has become since, it read as a new trade
    // with the same people. The heart just turns, and the trade is in Bytter
    // where it was. Nor 10a: somebody in a ring has something to give.
    if (!wished.tradeIsNew) return;
    // The bar counts the trades waiting on this person, and this one is new:
    // it went on counting as before the heart until something else asked.
    unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
    final on = over();
    if (on.mounted) await pushOverBar<void>(on, MatchScreen(tradeId: tradeId));
    return;
  }
  // 10a comes on the same hearts from the collage and from 04, and asks the
  // same session whether it has been shown at this count already.
  final due = await session.listingPromptDue(
      promptToList: wished.promptToList, likedCount: wished.likedCount);
  if (due) await showListingPrompt(over(), wished.likedCount);
}

/// 05b Avansert søk.
class SearchFilters {
  const SearchFilters({
    this.query,
    this.category,
    this.subcategory,
    this.minValue,
    this.maxValue,
    this.condition,
    this.sort = 'newest',
  });

  final String? query, category, subcategory, condition;
  final int? minValue, maxValue;
  final String sort;

  bool get isActive =>
      category != null ||
      subcategory != null ||
      minValue != null ||
      maxValue != null ||
      condition != null ||
      sort != 'newest';
}

class AdvancedSearchScreen extends StatefulWidget {
  const AdvancedSearchScreen({super.key, required this.initial, required this.query});

  final SearchFilters initial;
  final String query;

  @override
  State<AdvancedSearchScreen> createState() => _AdvancedSearchScreenState();
}

class _AdvancedSearchScreenState extends State<AdvancedSearchScreen> {
  late final _text = TextEditingController(text: widget.query);
  late String? _category = widget.initial.category;
  late String? _subcategory = widget.initial.subcategory;
  late final _minText = TextEditingController(text: widget.initial.minValue?.toString() ?? '');
  late final _maxText = TextEditingController(text: widget.initial.maxValue?.toString() ?? '');
  late int? _min = widget.initial.minValue;
  late int? _max = widget.initial.maxValue;
  late String? _condition = widget.initial.condition;
  late String _sort = widget.initial.sort;

  List<String> _subcategories = const [];
  int? _preview;

  @override
  void initState() {
    super.initState();
    if (_category != null) _loadSubcategories();
    _countPreview();
  }

  @override
  void dispose() {
    _text.dispose();
    _minText.dispose();
    _maxText.dispose();
    super.dispose();
  }

  Future<void> _loadSubcategories() async {
    final list = await context.read<SwaplyApi>().subcategories(_category!);
    if (mounted) setState(() => _subcategories = list);
  }

  /// How many times the count has been asked for. Typing asks at every
  /// letter, and the answer for «syk» landing after the one for «sykkel» put
  /// a number on the button for a search nobody was making any more.
  int _counted = 0;

  Future<void> _countPreview() async {
    final asked = ++_counted;
    try {
      final res = await context.read<SwaplyApi>().discover(
            q: _text.text.trim(),
            category: _category,
            subcategory: _subcategory,
            minValue: _min,
            maxValue: _max,
            condition: _condition,
            sort: _sort,
          );
      if (mounted && asked == _counted) setState(() => _preview = res.total);
    } on ApiException {
      if (mounted && asked == _counted) setState(() => _preview = null);
    }
  }

  SearchFilters get _filters => SearchFilters(
        query: _text.text,
        category: _category,
        subcategory: _subcategory,
        minValue: _min,
        maxValue: _max,
        condition: _condition,
        sort: _sort,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: swaplyAppBar(context, 'Avansert søk', actions: [
        headerTextAction(
            'Nullstill',
            () => setState(() {
                  _text.clear();
                  _minText.clear();
                  _maxText.clear();
                  _category = null;
                  _subcategory = null;
                  _min = null;
                  _max = null;
                  _condition = null;
                  _sort = 'newest';
                  _countPreview();
                })),
      ]),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                children: [
                  const Text('Fritekst', style: Type.section),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _text,
                    onChanged: (_) => _countPreview(),
                    decoration: const InputDecoration(hintText: 'sykkel'),
                  ),
                  const SizedBox(height: 16),
                  const Text('Hovedkategori', style: Type.section),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String?>(
                    initialValue: _category,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: SwaplyColors.ink),
                    icon: const Icon(Icons.keyboard_arrow_down, size: 18, color: SwaplyColors.greySoft),
                    decoration: const InputDecoration(),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Alle')),
                      ...categoryLabels.entries.map(
                          (e) => DropdownMenuItem(value: e.key, child: Text(e.value))),
                    ],
                    onChanged: (value) {
                      setState(() {
                        _category = value;
                        _subcategory = null;
                        _subcategories = const [];
                      });
                      if (value != null) _loadSubcategories();
                      _countPreview();
                    },
                  ),
                  if (_category != null && _subcategories.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    // The chips can run to two rows, 7 apart, and a chip in
                    // the first row takes the heading over it as well as the
                    // gap: 8 and a 29-tall chip and half the 7 are not 44.
                    TapRoom(
                      room: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Underkategori i ${categoryLabels[_category]}',
                              style: Type.section),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 7,
                            runSpacing: 7,
                            children: [
                              _choice('Alle', _subcategory == null,
                                  () => setState(() {
                                        _subcategory = null;
                                        _countPreview();
                                      })),
                              ..._subcategories.map((s) => _choice(s, _subcategory == s,
                                  () => setState(() {
                                        _subcategory = s;
                                        _countPreview();
                                      }))),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ] else
                    const SizedBox(height: 16),
                  const Text('Verdi', style: Type.section),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _minText,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              hintText: '0',
                              // suffixText hides until focus; «kr» is always there.
                              suffixIcon: Padding(
                                  padding: EdgeInsets.only(right: 14),
                                  child: Text('kr',
                                      style: TextStyle(fontSize: 15, color: SwaplyColors.grey))),
                              suffixIconConstraints: BoxConstraints(minWidth: 0, minHeight: 0)),
                          onChanged: (v) {
                            _min = int.tryParse(v);
                            _countPreview();
                          },
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10),
                        child: Text('–', style: TextStyle(fontSize: 14, color: SwaplyColors.grey)),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _maxText,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(hintText: 'Ingen grense'),
                          onChanged: (v) {
                            _max = int.tryParse(v);
                            _countPreview();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Tilstand', style: Type.section),
                  // The 8 over the chips and the 16 under them are theirs.
                  TapRoom(
                    room: const EdgeInsets.only(top: 8, bottom: 16),
                    child: Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: conditionLabels.entries
                          .map((e) => _choice(e.value, _condition == e.key, () {
                                setState(() => _condition = _condition == e.key ? null : e.key);
                                _countPreview();
                              }))
                          .toList(),
                    ),
                  ),
                  const Text('Sorter etter', style: Type.section),
                  // A segmented track, the same as on «Mine handler». A
                  // 33-tall segment answers across its third of the track and
                  // the 8 over it and the 20 under it.
                  TapRoom(
                    room: const EdgeInsets.only(top: 8, bottom: 20),
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: SwaplyColors.chip,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          for (final (key, label) in const [
                            ('newest', 'Nyeste'),
                            ('nearest', 'Nærmest'),
                            ('value', 'Verdi'),
                          ])
                            Expanded(
                              child: TapArea(
                                onTap: () {
                                  setState(() => _sort = key);
                                  _countPreview();
                                },
                                child: Container(
                                  height: 33,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: _sort == key ? Colors.white : null,
                                    borderRadius: BorderRadius.circular(11),
                                  ),
                                  child: Text(label,
                                      style: TextStyle(
                                          fontSize: 13,
                                          fontWeight:
                                              _sort == key ? FontWeight.w700 : FontWeight.w600,
                                          color: _sort == key
                                              ? SwaplyColors.ink
                                              : SwaplyColors.greySoft)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 28),
              child: PrimaryButton(
                _preview == null ? 'Vis treff' : 'Vis $_preview treff',
                onPressed: () => Navigator.of(context).pop(_filters),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The chips on 05: filled green when chosen, the chip grey otherwise. Each
  /// is in a [TapRoom] with the ones beside it, which gives it its area.
  Widget _choice(String label, bool selected, VoidCallback onTap) =>
      TapArea(onTap: onTap, child: Pill(label, selected: selected));
}

/// 10a. Wishes and nothing to give is a dead end, so we say so: at the fifth
/// heart, and at every tenth after it for as long as nothing is listed. The
/// server says when a count is due and [Session.listingPromptDue] keeps it to
/// once a count. From the collage and from a listing alike — it used to live
/// on the discovery card only, so reaching the count from an item page was the
/// one way to get there and never be told.
Future<void> showListingPrompt(BuildContext context, int likedCount) async {
  if (!context.mounted) return;
  // Asked for before the sheet is up, so the pictures are usually there by
  // the time it has slid in, and asked for once: a sheet rebuilds.
  final liked = context
      .read<SwaplyApi>()
      .myLikes()
      .then((items) => items.take(3).toList(), onError: (Object _) => const <Item>[]);
  await showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    // The export's sheet is the screen's own off-white, rounded 28 at the top.
    backgroundColor: SwaplyColors.bg,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (sheet) => _ListingPrompt(
      likedCount: likedCount,
      liked: liked,
      onList: () {
        Navigator.of(sheet).pop();
        openListingForm(context);
      },
      onLater: () => Navigator.of(sheet).pop(),
    ),
  );
}

/// 10a as the export draws it: a handle, the count in the brand's green, and
/// the last three things liked — what the person has been wanting is the
/// argument for giving something, so the sheet shows it rather than says it.
class _ListingPrompt extends StatelessWidget {
  const _ListingPrompt({
    required this.likedCount,
    required this.liked,
    required this.onList,
    required this.onLater,
  });

  final int likedCount;
  final Future<List<Item>> liked;
  final VoidCallback onList, onLater;

  /// The export's tiles before a picture is in them.
  static const _waiting = [Color(0xFFEBEFEA), Color(0xFFE7E4DC), Color(0xFFE2E6EA)];

  @override
  Widget build(BuildContext context) => Padding(
        // 34 under «Senere» in the export, 12 of which are its own tap target
        // and 2 more its room.
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: const Color(0xFFD7DDD6),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Text('Du har likt $likedCount ting. På tide å legge ut noe selv',
                style: Type.screen.copyWith(fontSize: 24, height: 1.2)),
            const SizedBox(height: 14),
            const Text(
              'Bytter skjer først når du har noe å gi. Legg ut én ting, så kan vi begynne '
              'å lete etter swaps for deg.',
              style: TextStyle(fontSize: 14.5, height: 1.5, color: SwaplyColors.inkMuted),
            ),
            FutureBuilder<List<Item>>(
              future: liked,
              builder: (context, answer) {
                final items = answer.data;
                // No answer, or nothing left to show — a liked listing can
                // be taken down since — and the row is not drawn at all:
                // three empty tiles would read as pictures that failed.
                if (items != null && items.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 18),
                  child: SizedBox(
                    height: 88,
                    child: Row(
                      children: [
                        for (var i = 0; i < (items?.length ?? 3); i++) ...[
                          if (items == null)
                            Container(
                              width: 88,
                              height: 88,
                              decoration: BoxDecoration(
                                color: _waiting[i],
                                borderRadius: BorderRadius.circular(Radii.card),
                              ),
                            )
                          else
                            ItemThumb(items[i], size: 88, radius: Radii.card),
                          const SizedBox(width: 10),
                        ],
                        const Expanded(
                          child: Text('ting du\nhar likt',
                              style: TextStyle(
                                  fontSize: 11, height: 1.4, color: SwaplyColors.greyLight)),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 18),
            PrimaryButton('Legg ut en gjenstand', onPressed: onList),
            // Words, not a second button, as drawn: putting it off is
            // allowed rather than offered. 40 tall, and the 2 over it and the
            // 2 under it answer too.
            TapArea(
              room: const EdgeInsets.symmetric(vertical: 2),
              child: SizedBox(
                height: 40,
                child: TextButton(
                  onPressed: onLater,
                  style: TextButton.styleFrom(
                    foregroundColor: SwaplyColors.grey,
                    padding: EdgeInsets.zero,
                  ),
                  // On the label and not as the button's text style, which would
                  // replace the theme's and take its font family with it.
                  child: const Text('Senere',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ],
        ),
      );
}
