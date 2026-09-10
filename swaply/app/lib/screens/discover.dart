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
            // 18 at the sides on this screen, 6 above and 10 below the field.
            padding: const EdgeInsets.fromLTRB(18, 6, 18, 10),
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

  Widget _categoryChips() => SizedBox(
        height: 41,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
          children: [
            _chipButton('Alt', null),
            for (final key in _chipOrder) _chipButton(categoryLabels[key]!, key),
          ],
        ),
      );

  Widget _chipButton(String label, String? category) => Padding(
        padding: const EdgeInsets.only(right: 7),
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
                  // Never taller than square: the export's collage runs from
                  // 1:1 to about 1.4:1, and a portrait card would stand out.
                  aspect: const [1.0, 1.42, 1.21, 1.06, 1.13][(i * 2 + offset) % 5],
                ),
                const SizedBox(height: 16),
              ],
            ],
          ),
        );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, Insets.xl),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('$_total treff', style: const TextStyle(fontSize: 12.5, color: SwaplyColors.grey)),
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

  @override
  Widget build(BuildContext context) => InkWell(
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
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() {
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
          }),
          child: const Padding(
            padding: EdgeInsets.only(top: 5),
            child: Text('Nullstill',
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
          ),
        ),
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
                    Text('Underkategori i ${categoryLabels[_category]}', style: Type.section),
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
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: conditionLabels.entries
                        .map((e) => _choice(e.value, _condition == e.key, () {
                              setState(() => _condition = _condition == e.key ? null : e.key);
                              _countPreview();
                            }))
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  const Text('Sorter etter', style: Type.section),
                  const SizedBox(height: 8),
                  // A segmented track, the same as on «Mine handler».
                  Container(
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
                            child: GestureDetector(
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
                  const SizedBox(height: 20),
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

  /// The chips on 05: filled green when chosen, the chip grey otherwise.
  Widget _choice(String label, bool selected, VoidCallback onTap) =>
      GestureDetector(onTap: onTap, child: Pill(label, selected: selected));
}
