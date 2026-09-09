import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
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

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _search = TextEditingController();
  SearchFilters _filters = const SearchFilters();

  bool _loading = true;
  String? _error;
  int _total = 0;
  List<Item> _results = const [];

  /// «Alt» is null. The chip row is a filter on one grid, which is what the
  /// export draws: one home tab, not a shelf per interest.
  String? _chip;

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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<SwaplyApi>();
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
      if (!mounted) return;
      setState(() {
        _total = res.total;
        _results = res.items;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openFilters() async {
    final result = await Navigator.of(context).push<SearchFilters>(
      MaterialPageRoute(
        builder: (_) => AdvancedSearchScreen(initial: _filters, query: _search.text),
      ),
    );
    if (result != null) {
      setState(() => _filters = result);
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
            padding: const EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, Insets.sm),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      hintText: 'Søk etter ting du vil ha',
                      prefixIcon: const Icon(Icons.search, size: 20, color: SwaplyColors.grey),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _search.clear();
                                setState(() => _filters = const SearchFilters());
                                _load();
                              },
                            ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: Insets.sm),
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
  Widget _categoryChips() => SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
          children: [
            _chipButton('Alt', null),
            for (final entry in categoryLabels.entries) _chipButton(entry.value, entry.key),
          ],
        ),
      );

  Widget _chipButton(String label, String? category) => Padding(
        padding: const EdgeInsets.only(right: Insets.sm),
        child: GestureDetector(
          onTap: () {
            if (_chip == category) return;
            setState(() => _chip = category);
            _load();
          },
          child: Center(child: Pill(label, selected: _chip == category)),
        ),
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

    if (_results.isEmpty) {
      final filtered = _search.text.trim().isNotEmpty || _chip != null || _filters.isActive;
      return EmptyState(
        icon: filtered ? Icons.search_off : Icons.explore_outlined,
        title: filtered ? 'Ingen treff' : 'Ingenting å vise ennå',
        body: filtered
            ? 'Prøv et annet ord, eller løsne på filtrene.'
            : 'Søk etter noe du vil ha, eller legg ut en ting så folk finner deg.',
        actionLabel: filtered ? null : 'Legg ut en ting',
        onAction: filtered
            ? null
            : () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const PostItemScreen())),
      );
    }

    // Two columns that fill independently, so cards of different heights sit
    // beside each other the way the collage in the export does. A grid with one
    // aspect ratio would line them up in rows and lose that.
    final left = <Item>[];
    final right = <Item>[];
    for (var i = 0; i < _results.length; i++) {
      (i.isEven ? left : right).add(_results[i]);
    }
    Widget column(List<Item> items, int offset) => Expanded(
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                ItemCard(
                  item: items[i],
                  onChanged: _load,
                  // Three heights, cycling: a collage is made of things that
                  // are not the same shape.
                  aspect: const [1.0, 1.25, 0.85][(i * 2 + offset) % 3],
                ),
                const SizedBox(height: Insets.md),
              ],
            ],
          ),
        );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, Insets.xl),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: Insets.md),
            child: Text('$_total treff', style: Type.secondary),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              column(left, 0),
              const SizedBox(width: Insets.md),
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

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.card),
        child: Container(
          height: 50,
          width: 50,
          decoration: BoxDecoration(
            color: active ? SwaplyColors.greenPressed : Colors.white,
            borderRadius: BorderRadius.circular(Radii.card),
            border: Border.all(color: SwaplyColors.line),
          ),
          child: Icon(icon, size: 20, color: active ? Colors.white : SwaplyColors.ink),
        ),
      );
}

class ItemCard extends StatefulWidget {
  const ItemCard({super.key, required this.item, required this.onChanged, this.aspect});

  final Item item;
  final VoidCallback onChanged;

  /// Width over height for the picture. Given by the collage so that cards are
  /// not all the same shape; null lets the card fill whatever it is put in.
  final double? aspect;

  @override
  State<ItemCard> createState() => _ItemCardState();
}

class _ItemCardState extends State<ItemCard> {
  late bool _liked = widget.item.likedByMe;
  bool _busy = false;

  Future<void> _toggle() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _liked = !_liked;
    });
    final api = context.read<SwaplyApi>();
    try {
      if (_liked) {
        final result = await api.like(widget.item.id);
        if (!mounted) return;
        if (result.tradeId != null) {
          await Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => MatchScreen(tradeId: result.tradeId!)));
        } else if (result.promptToList) {
          await _showListingPrompt(result.likedCount);
        }
      } else {
        await api.unlike(widget.item.id);
      }
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _liked = !_liked);
        showError(context, e);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// 10a. Ten wishes and nothing to give is a dead end, so we say so once.
  Future<void> _showListingPrompt(int likedCount) async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => Padding(
        padding: const EdgeInsets.all(Insets.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Du har likt $likedCount ting. På tide å legge ut noe selv',
                style: Type.title),
            const SizedBox(height: Insets.sm),
            const Text(
              'Bytter skjer først når du har noe å gi. Legg ut én ting, så kan vi begynne '
              'å lete etter swaps for deg.',
              style: Type.secondary,
            ),
            const SizedBox(height: Insets.lg),
            PrimaryButton('Legg ut en gjenstand', onPressed: () {
              Navigator.of(sheet).pop();
              Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const PostItemScreen()));
            }),
            const SizedBox(height: Insets.sm),
            SecondaryButton('Senere', onPressed: () => Navigator.of(sheet).pop()),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    return GestureDetector(
      onTap: () async {
        await Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: item.id)));
        widget.onChanged();
      },
      onLongPress: () => _showContextMenu(context, item, widget.onChanged),
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
                Positioned(
                  right: 8,
                  top: 8,
                  child: GestureDetector(
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
          const SizedBox(height: Insets.sm),
          // Name and value run on together and wrap, which is how the export
          // sets them: the value is a note after the name, not a second line
          // of its own.
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 6,
            children: [
              Text(item.title,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
              if (item.estimatedValueNok != null)
                Text('Verdi ${kr(item.estimatedValueNok)}',
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
            ],
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
Future<void> _showContextMenu(BuildContext context, Item item, VoidCallback onChanged) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.visibility_off_outlined),
            title: const Text('Ikke vis meg slike'),
            onTap: () => Navigator.of(sheet).pop(),
          ),
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('Se profil'),
            onTap: () {
              Navigator.of(sheet).pop();
              if (item.ownerId != null) {
                Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => OtherProfileScreen(userId: item.ownerId!)));
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.flag_outlined, color: SwaplyColors.red),
            title: const Text('Rapporter', style: TextStyle(color: SwaplyColors.red)),
            onTap: () {
              Navigator.of(sheet).pop();
              showReportSheet(context, itemId: item.id, personName: item.owner?.displayName);
            },
          ),
        ],
      ),
    ),
  );
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
    super.dispose();
  }

  Future<void> _loadSubcategories() async {
    final list = await context.read<SwaplyApi>().subcategories(_category!);
    if (mounted) setState(() => _subcategories = list);
  }

  Future<void> _countPreview() async {
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
      if (mounted) setState(() => _preview = res.total);
    } on ApiException {
      if (mounted) setState(() => _preview = null);
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
        TextButton(
          onPressed: () => setState(() {
            _text.clear();
            _category = null;
            _subcategory = null;
            _min = null;
            _max = null;
            _condition = null;
            _sort = 'newest';
            _countPreview();
          }),
          child: const Text('Nullstill', style: TextStyle(color: SwaplyColors.greySoft)),
        ),
      ]),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
                children: [
                  const Text('Fritekst', style: Type.small),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _text,
                    onChanged: (_) => _countPreview(),
                    decoration: const InputDecoration(hintText: 'sykkel'),
                  ),
                  const SizedBox(height: Insets.md),
                  const Text('Hovedkategori', style: Type.small),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String?>(
                    initialValue: _category,
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
                    const SizedBox(height: Insets.md),
                    Text('Underkategori i ${categoryLabels[_category]}', style: Type.small),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: Insets.sm,
                      runSpacing: Insets.sm,
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
                  const SizedBox(height: Insets.md),
                  const Text('Verdi', style: Type.small),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(hintText: '0', suffixText: 'kr'),
                          onChanged: (v) {
                            _min = int.tryParse(v);
                            _countPreview();
                          },
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: Insets.sm),
                        child: Text('–', style: Type.body),
                      ),
                      Expanded(
                        child: TextField(
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(hintText: 'Ingen grense', suffixText: 'kr'),
                          onChanged: (v) {
                            _max = int.tryParse(v);
                            _countPreview();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: Insets.md),
                  const Text('Tilstand', style: Type.small),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: Insets.sm,
                    children: conditionLabels.entries
                        .map((e) => _choice(e.value, _condition == e.key, () {
                              setState(() => _condition = _condition == e.key ? null : e.key);
                              _countPreview();
                            }))
                        .toList(),
                  ),
                  const SizedBox(height: Insets.md),
                  const Text('Sorter etter', style: Type.small),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: Insets.sm,
                    children: [
                      _choice('Nyeste', _sort == 'newest', () {
                        setState(() => _sort = 'newest');
                        _countPreview();
                      }),
                      _choice('Nærmest', _sort == 'nearest', () {
                        setState(() => _sort = 'nearest');
                        _countPreview();
                      }),
                      _choice('Verdi', _sort == 'value', () {
                        setState(() => _sort = 'value');
                        _countPreview();
                      }),
                    ],
                  ),
                  const SizedBox(height: Insets.xl),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Insets.screen),
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

  Widget _choice(String label, bool selected, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
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
                color: selected ? Colors.white : SwaplyColors.ink,
              )),
        ),
      );
}
