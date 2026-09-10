import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/share_sheet.dart';
import '../widgets/shell.dart';
import '../state/session.dart';
import 'chat.dart';
import 'onboarding.dart';
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

    // Writing the first message opens a trade, and a trade has two named people
    // in it. This is the moment a device becomes a person.
    if (context.read<Session>().anonymous) {
      await Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const CreateProfileScreen()));
      if (!mounted || context.read<Session>().anonymous) return;
    }
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
    // Your own listing is a real thing to land on — from your profile, or from
    // a link you sent yourself — and the two buttons at the bottom are both
    // things the server will refuse. So it says what it is instead.
    final mine = owner != null && owner.id == context.watch<Session>().me?.id;

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
                  padding: const EdgeInsets.fromLTRB(22, 14, 22, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name and price share a line, and the price is grey:
                      // this is a barter app, so the number is a fact about the
                      // thing and not the point of it.
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(item.title, style: Type.display)),
                          if (item.estimatedValueNok != null) ...[
                            const SizedBox(width: 10),
                            Padding(
                              padding: const EdgeInsets.only(top: 9),
                              child: Text('Verdi ${kr(item.estimatedValueNok)}',
                                  style: Type.value),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 11),
                      Wrap(
                        spacing: 7,
                        runSpacing: 7,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Pill([
                            categoryLabels[item.category] ?? item.category,
                            if ((item.subcategory ?? '').isNotEmpty) item.subcategory!,
                          ].join(' · '), small: true),
                          if (item.condition != null)
                            Pill(conditionLabels[item.condition] ?? item.condition!, small: true),
                          if (item.kind == 'service') const Pill('Tjeneste', small: true),
                          // The town is not a pill in the export: where a thing
                          // is, is a note, not a label on it.
                          if (item.town != null) Text(item.town!, style: Type.secondary),
                        ],
                      ),
                      if (item.description != null && item.description!.isNotEmpty) ...[
                        const SizedBox(height: 11),
                        Text(item.description!, style: Type.body),
                      ],
                      if (owner != null) ...[
                        const SizedBox(height: 11),
                        _ownerStrip(owner),
                      ],
                      const SizedBox(height: 11),
                      if (mine)
                        const SectionCard(
                          child: Text(
                            'Dette er din egen ting. Slik ser andre den.',
                            style: Type.secondary,
                          ),
                        )
                      else
                        _conversationBox(owner),
                      const SizedBox(height: Insets.lg),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (!mine) _actionBar(item),
        ],
      ),
    );
  }

  Widget _gallery(Item item) {
    final photos = item.media.isEmpty ? <String>[] : item.media;

    return SizedBox(
      // 330 in the export, and the picture runs up under the status bar.
      height: 330,
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
            top: MediaQuery.of(context).padding.top + 10,
            left: 14,
            right: 14,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _round(Icons.chevron_left, () => Navigator.of(context).maybePop()),
                Row(
                  children: [
                    _round(Icons.ios_share, () {
                      showShareSheet(
                        context,
                        title: 'Del ${item.title}',
                        mint: (api) => api.shareItem(item.id),
                      );
                    }),
                    const SizedBox(width: 8),
                    _round(Icons.more_horiz, () {
                      showReportSheet(context,
                          itemId: item.id, personName: item.owner?.displayName);
                    }),
                  ],
                ),
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
                    height: 5,
                    width: i == _photo ? 14 : 5,
                    margin: const EdgeInsets.symmetric(horizontal: 2.5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      color: i == _photo ? Colors.white : Colors.white.withValues(alpha: 0.6),
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
        color: SwaplyColors.bg.withValues(alpha: 0.92),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(height: 38, width: 38, child: Icon(icon, size: 20, color: SwaplyColors.ink)),
        ),
      );

  Widget _ownerStrip(UserRef owner) => InkWell(
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => OtherProfileScreen(userId: owner.id))),
        borderRadius: BorderRadius.circular(Radii.card),
        child: SectionCard(
          child: Row(
            children: [
              Avatar(owner.displayName, size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(owner.displayName, style: Type.heading),
                    const SizedBox(height: 2),
                    // «★ 4,8 · 23 bytter · BankID-verifisert», one grey line.
                    Text(
                      [
                        if (owner.ratingAvg != null)
                          '★ ${owner.ratingAvg!.toStringAsFixed(1).replaceAll('.', ',')}',
                        if (owner.tradeCount != null) '${owner.tradeCount} bytter',
                        if (owner.bankidVerified) 'BankID-verifisert',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, height: 1.35, color: SwaplyColors.grey),
                    ),
                  ],
                ),
              ),
              const Text('Se profil ›', style: Type.link),
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
                  child: const Text('Åpne ›', style: Type.link),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _message,
                  minLines: 1,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13, color: SwaplyColors.ink),
                  decoration: InputDecoration(
                    hintText: 'Skriv en melding til $name…',
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
              const SizedBox(width: Insets.md),
              // A word, not a filled button: the box already invites you to
              // write, and a green slab beside it competes with the heart.
              GestureDetector(
                onTap: _sending ? null : _send,
                child: Text(
                  'Send',
                  style: Type.link.copyWith(
                    fontSize: 13,
                    color: _sending ? SwaplyColors.greyLight : SwaplyColors.greenText,
                  ),
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

  /// Two circles, centred. The heart is the biggest thing on the screen because
  /// it is the only action that means anything — the ✕ beside it just goes back.
  Widget _actionBar(Item item) => Container(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 10),
        decoration: const BoxDecoration(
          color: SwaplyColors.surface,
          border: Border(top: BorderSide(color: Color(0xFFF0F2EE))),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAction(
              icon: Icons.close,
              size: 58,
              iconSize: 22,
              color: SwaplyColors.badge,
              borderColor: SwaplyColors.declineLine,
              semanticLabel: 'Ikke interessert',
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(width: 26),
            CircleAction(
              icon: item.likedByMe ? Icons.favorite : Icons.favorite_border,
              size: 62,
              iconSize: 26,
              filled: true,
              busy: _liking,
              semanticLabel: item.likedByMe ? 'Du vil ha denne' : 'Jeg vil ha',
              onPressed: _like,
            ),
          ],
        ),
      );
}
