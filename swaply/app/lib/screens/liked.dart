import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'post_item.dart';
import 'profile.dart';

/// 12 Likt, and 17b when nobody has liked anything yet. Reached from the
/// profile and from the like notification — the two ways in that survived the
/// tab being taken by Chats.
class LikedScreen extends StatefulWidget {
  const LikedScreen({super.key});

  @override
  State<LikedScreen> createState() => _LikedScreenState();
}

class _LikedScreenState extends State<LikedScreen> {
  List<LikedByRow>? _rows;
  String? _error;
  final _expanded = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await context.read<SwaplyApi>().likedBy();
      if (mounted) {
        setState(() {
          _rows = rows;
          // The first thing with likes opens by itself: an accordion where
          // everything is shut says nothing.
          final first = rows.where((r) => r.likers.isNotEmpty).firstOrNull;
          if (first != null) _expanded.add(first.item.id);
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    final anyLikes = rows != null && rows.any((r) => r.likers.isNotEmpty);

    return SwaplyScaffold(
      currentTab: 4,
      appBar: swaplyAppBar(context, 'Likt', subtitle: 'Folk som har likt tingene dine'),
      child: _error != null
          ? EmptyState(
              title: 'Fikk ikke kontakt',
              body: _error!,
              icon: Icons.wifi_off,
              actionLabel: 'Prøv igjen',
              onAction: _load)
          : rows == null
              ? const Center(child: CircularProgressIndicator())
              : !anyLikes
                  ? EmptyState(
                      icon: Icons.favorite_border,
                      title: 'Ingen likes ennå',
                      body: rows.isEmpty
                          ? 'Legg ut noe folk vil ha. Gode bilder og ærlig tilstand gir '
                              'flest likes.'
                          : 'Ingen har likt tingene dine ennå. Gode bilder og ærlig '
                              'tilstand gir flest likes.',
                      actionLabel: 'Legg ut en ting',
                      onAction: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => const PostItemScreen())),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(Insets.screen),
                        children: [
                          ...rows.map(_row),
                          const SizedBox(height: Insets.md),
                          const Text('Tips: lik tilbake, det lukker bytter raskere.',
                              style: Type.small),
                        ],
                      ),
                    ),
    );
  }

  Widget _row(LikedByRow row) {
    final open = _expanded.contains(row.item.id);
    final count = row.likers.length;

    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: SectionCard(
        child: Column(
          children: [
            InkWell(
              onTap: count == 0
                  ? null
                  : () => setState(() =>
                      open ? _expanded.remove(row.item.id) : _expanded.add(row.item.id)),
              child: Row(
                children: [
                  ItemThumb(row.item, size: 48),
                  const SizedBox(width: Insets.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(row.item.title, style: Type.heading),
                        Text(
                          count == 0
                              ? 'Ingen likes ennå'
                              : count == 1
                                  ? '1 har likt denne'
                                  : '$count har likt denne',
                          style: Type.small,
                        ),
                      ],
                    ),
                  ),
                  if (count > 0)
                    Icon(open ? Icons.expand_less : Icons.expand_more,
                        color: SwaplyColors.grey),
                ],
              ),
            ),
            if (open)
              ...row.likers.map((liker) => Padding(
                    padding: const EdgeInsets.only(top: Insets.md),
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => OtherProfileScreen(userId: liker.id))),
                      child: Row(
                        children: [
                          Avatar(liker.displayName, size: 38),
                          const SizedBox(width: Insets.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(liker.displayName, style: Type.heading),
                                Text(
                                  [
                                    if (liker.itemCount != null)
                                      '${liker.itemCount} gjenstander',
                                    if (liker.town != null) liker.town!,
                                  ].join(' · '),
                                  style: Type.small,
                                ),
                              ],
                            ),
                          ),
                          const Text('Se tingene deres ›',
                              style: TextStyle(
                                  fontSize: 12.5, color: SwaplyColors.greenPressed)),
                        ],
                      ),
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}
