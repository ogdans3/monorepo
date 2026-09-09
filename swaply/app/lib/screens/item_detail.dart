import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'chat.dart';
import 'profile.dart';
import 'trade_detail.dart';

/// 04 Gjenstand detalj. The gallery, the owner strip, the conversation box that
/// opens a negotiation, and the two big buttons at the bottom.
class ItemDetailScreen extends StatefulWidget {
  const ItemDetailScreen({super.key, required this.itemId});

  final String itemId;

  @override
  State<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends State<ItemDetailScreen> {
  Item? _item;
  String? _error;
  bool _liking = false;
  int _photo = 0;
  final _message = TextEditingController();
  bool _sending = false;
  String? _openedThreadId;

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
      final item = await context.read<SwaplyApi>().item(widget.itemId);
      if (mounted) setState(() => _item = item);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _like() async {
    final item = _item;
    if (item == null || _liking) return;
    setState(() => _liking = true);
    final api = context.read<SwaplyApi>();
    try {
      if (item.likedByMe) {
        await api.unlike(item.id);
      } else {
        final result = await api.like(item.id);
        if (!mounted) return;
        if (result.tradeId != null) {
          await Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => MatchScreen(tradeId: result.tradeId!)));
        }
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  Future<void> _send() async {
    final text = _message.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final result = await context.read<SwaplyApi>().messageAboutItem(widget.itemId, text);
      _message.clear();
      if (mounted) setState(() => _openedThreadId = result.threadId);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Gjenstand'),
        body: EmptyState(title: 'Fant ikke gjenstanden', body: _error!, icon: Icons.error_outline),
      );
    }
    if (item == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final owner = item.owner;

    return SwaplyScaffold(
      currentTab: 0,
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _gallery(item),
                Padding(
                  padding: const EdgeInsets.all(Insets.screen),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title, style: Type.display),
                      const SizedBox(height: 6),
                      Text('Verdi ${kr(item.estimatedValueNok)}',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: SwaplyColors.greenPressed)),
                      const SizedBox(height: Insets.md),
                      Wrap(
                        spacing: Insets.sm,
                        runSpacing: Insets.sm,
                        children: [
                          _fact([
                            categoryLabels[item.category] ?? item.category,
                            if (item.subcategory != null) item.subcategory!,
                          ].join(' · ')),
                          if (item.condition != null)
                            _fact(conditionLabels[item.condition] ?? item.condition!),
                          if (item.town != null) _fact(item.town!),
                          if (item.kind == 'service') _fact('Tjeneste'),
                        ],
                      ),
                      if (item.description != null && item.description!.isNotEmpty) ...[
                        const SizedBox(height: Insets.md),
                        Text(item.description!, style: Type.body),
                      ],
                      if (owner != null) ...[
                        const SizedBox(height: Insets.lg),
                        _ownerStrip(owner),
                      ],
                      const SizedBox(height: Insets.lg),
                      _conversationBox(owner),
                      const SizedBox(height: Insets.lg),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _actionBar(item),
        ],
      ),
    );
  }

  Widget _gallery(Item item) {
    final photos = item.media.isEmpty ? <String>[] : item.media;

    return SizedBox(
      height: 300,
      child: Stack(
        children: [
          Positioned.fill(
            child: photos.isEmpty
                ? Container(
                    color: SwaplyColors.greenSoft,
                    child: Center(
                      child: Icon(categoryIcons[item.category] ?? Icons.category_outlined,
                          size: 64, color: SwaplyColors.greenDeep),
                    ),
                  )
                : PageView.builder(
                    onPageChanged: (i) => setState(() => _photo = i),
                    itemCount: photos.length,
                    itemBuilder: (_, i) => Image.network(photos[i],
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(color: SwaplyColors.greenSoft)),
                  ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top,
            left: 4,
            right: 4,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _round(Icons.chevron_left, () => Navigator.of(context).maybePop()),
                _round(Icons.more_horiz, () {
                  showReportSheet(context,
                      itemId: item.id, personName: item.owner?.displayName);
                }),
              ],
            ),
          ),
          if (photos.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  photos.length,
                  (i) => Container(
                    height: 6,
                    width: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i == _photo ? Colors.white : Colors.white54,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _round(IconData icon, VoidCallback onTap) => Material(
        color: Colors.white.withValues(alpha: 0.92),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(height: 38, width: 38, child: Icon(icon, size: 22)),
        ),
      );

  Widget _fact(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(Radii.pill),
          border: Border.all(color: SwaplyColors.line),
        ),
        child: Text(text, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
      );

  Widget _ownerStrip(UserRef owner) => InkWell(
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => OtherProfileScreen(userId: owner.id))),
        borderRadius: BorderRadius.circular(Radii.card),
        child: SectionCard(
          child: Row(
            children: [
              Avatar(owner.displayName, size: 42),
              const SizedBox(width: Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(owner.displayName, style: Type.heading),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        StarRow(value: owner.ratingAvg ?? 0),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            [
                              if (owner.ratingAvg != null)
                                owner.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                              if (owner.tradeCount != null) '${owner.tradeCount} bytter',
                              if (owner.bankidVerified) 'BankID-verifisert',
                            ].join(' · '),
                            style: Type.small,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Text('Se profil ›', style: TextStyle(fontSize: 13, color: SwaplyColors.greenPressed)),
            ],
          ),
        ),
      );

  /// The box that opens a negotiation. Writing here is what creates the trade,
  /// which is why the chips are trade actions and not emoji.
  Widget _conversationBox(UserRef? owner) {
    final name = owner?.displayName.split(' ').first ?? 'eieren';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Kicker('Samtale med $name'),
              if (_openedThreadId != null)
                GestureDetector(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ThreadScreen(threadId: _openedThreadId!))),
                  child: const Text('Åpne ›',
                      style: TextStyle(fontSize: 13, color: SwaplyColors.greenPressed)),
                ),
            ],
          ),
          const SizedBox(height: Insets.md),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _message,
                  minLines: 1,
                  maxLines: 3,
                  decoration: InputDecoration(hintText: 'Skriv en melding til $name…'),
                ),
              ),
              const SizedBox(width: Insets.sm),
              SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed: _sending ? null : _send,
                  style: FilledButton.styleFrom(
                    backgroundColor: SwaplyColors.greenPressed,
                    shape:
                        RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
                  ),
                  child: const Text('Send'),
                ),
              ),
            ],
          ),
          if (_openedThreadId != null) ...[
            const SizedBox(height: Insets.sm),
            const Text('Meldingen er sendt. Samtalen ligger under Chats.', style: Type.small),
          ],
        ],
      ),
    );
  }

  Widget _actionBar(Item item) => Container(
        padding: const EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, Insets.md),
        decoration: const BoxDecoration(
          color: SwaplyColors.surface,
          border: Border(top: BorderSide(color: SwaplyColors.line)),
        ),
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 54,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0x22064E3B)),
                    shape:
                        RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
                  ),
                  child: const Icon(Icons.close, color: SwaplyColors.coral),
                ),
              ),
            ),
            const SizedBox(width: Insets.md),
            Expanded(
              flex: 2,
              child: PrimaryButton(
                item.likedByMe ? 'Du vil ha denne' : 'Jeg vil ha',
                icon: item.likedByMe ? Icons.favorite : Icons.favorite_border,
                busy: _liking,
                onPressed: _like,
              ),
            ),
          ],
        ),
      );
}
