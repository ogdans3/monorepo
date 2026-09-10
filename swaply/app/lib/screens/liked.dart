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
      appBar: swaplyAppBar(context, 'Likt',
          subtitle: 'Folk som har likt tingene dine', big: true, showBack: false),
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
                        padding: const EdgeInsets.fromLTRB(22, 14, 22, 14),
                        children: [
                          ...rows.map(_row),
                          const SizedBox(height: Insets.md),
                          // A green-soft box in the export, with the word
                          // «Tips:» carrying the weight.
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: SwaplyColors.tileSelected,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFC9EBDA)),
                            ),
                            child: const Text.rich(
                              TextSpan(children: [
                                TextSpan(text: 'Tips: ', style: TextStyle(fontWeight: FontWeight.w700)),
                                TextSpan(text: 'lik tilbake, det lukker bytter raskere.'),
                              ]),
                              style: TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF0B6B41)),
                            ),
                          ),
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
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color: open ? SwaplyColors.greenPressed : SwaplyColors.cardLine),
        ),
        child: Column(
          children: [
            InkWell(
              onTap: count == 0
                  ? null
                  : () => setState(() =>
                      open ? _expanded.remove(row.item.id) : _expanded.add(row.item.id)),
              child: Row(
                children: [
                  ItemThumb(row.item, size: 52, radius: 14),
                  const SizedBox(width: 12),
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
                          // Green and bold when somebody has: it is the good
                          // news on this screen.
                          style: count == 0
                              ? Type.small
                              : const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: SwaplyColors.greenText),
                        ),
                      ],
                    ),
                  ),
                  // «⌄» when open, «›» when there is something to open.
                  if (count > 0)
                    Icon(open ? Icons.expand_more : Icons.chevron_right,
                        size: 20, color: SwaplyColors.grey),
                ],
              ),
            ),
            if (open)
              // Ruled off from the thing, 44-tall rows 11 apart.
              Container(
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.only(top: 12),
                decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: Color(0xFFF0F2EE)))),
                child: Column(
                  children: [
                    for (final (i, liker) in row.likers.indexed) ...[
                      if (i > 0) const SizedBox(height: 11),
                      InkWell(
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => OtherProfileScreen(userId: liker.id))),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 44),
                          child: Row(
                            children: [
                              Avatar(liker.displayName, size: 36),
                              const SizedBox(width: 11),
                              Expanded(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(liker.displayName.split(' ').first,
                                        style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: SwaplyColors.ink)),
                                    Text(
                                      [
                                        if (liker.itemCount != null)
                                          '${liker.itemCount} gjenstander',
                                        if (liker.town != null) liker.town!,
                                      ].join(' · '),
                                      style: const TextStyle(
                                          fontSize: 11.5, color: SwaplyColors.grey),
                                    ),
                                  ],
                                ),
                              ),
                              const Text('Se tingene deres ›', style: Type.link),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
