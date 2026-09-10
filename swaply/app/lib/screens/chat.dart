import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'proposal_sheets.dart';

/// 11a Chats. One row per conversation, with what the trade is about under the
/// last message, because that is how you tell two of them apart.
class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  List<ChatSummary>? _threads;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<SwaplyApi>().threads();
      if (!mounted) return;
      setState(() => _threads = result.threads);
      await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final threads = _threads;

    return SwaplyScaffold(
      currentTab: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, Insets.sm),
            child: Text('Chats', style: Type.screen),
          ),
          Expanded(
            child: _error != null
                ? EmptyState(
                    title: 'Fikk ikke kontakt',
                    body: _error!,
                    icon: Icons.wifi_off,
                    actionLabel: 'Prøv igjen',
                    onAction: _load)
                : threads == null
                    ? const Center(child: CircularProgressIndicator())
                    : threads.isEmpty
                        ? const EmptyState(
                            icon: Icons.chat_bubble_outline,
                            title: 'Ingen samtaler ennå',
                            body: 'Skriv til noen om en ting du vil ha, så starter '
                                'samtalen her.',
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              itemCount: threads.length,
                              separatorBuilder: (_, _) => const Divider(
                                  height: 1, indent: 76, color: SwaplyColors.line),
                              itemBuilder: (context, i) => _row(threads[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _row(ChatSummary thread) {
    // First names in the list, the way the export writes them: «Ola», not
    // «Ola N.» — the full name belongs on a profile.
    final name = thread.others.isEmpty
        ? 'Samtale'
        : thread.others.map((o) => o.split(' ').first).join(', ');
    final subtitle = switch (thread.state) {
      'completed' => 'Fullført bytte',
      'cancelled' => 'Avsluttet bytte',
      _ when thread.kind == 'chain' => 'Treveis-swap · avtales i chat',
      _ => thread.subject == null ? 'Bytte' : 'Bytte · ${thread.subject}',
    };

    return ListTile(
      // 14 above and below, 8 at the sides inside a 16 margin; the picture is
      // 54 across with 12 to the words.
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      horizontalTitleGap: 12,
      leading: Avatar(thread.others.isEmpty ? '?' : thread.others.first, size: 54),
      title: Text(name, style: Type.heading),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          if (thread.lastMessage != null)
            Text(thread.lastMessage!.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, height: 1.2, color: SwaplyColors.inkMuted)),
          const SizedBox(height: 2),
          Text(subtitle,
              style: const TextStyle(fontSize: 11, color: SwaplyColors.greyLight),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(_relative(thread.lastMessage?.createdAt),
              style: const TextStyle(fontSize: 11, color: SwaplyColors.greyLight)),
          const SizedBox(height: 6),
          // A dot, not a count: the number is already on the tab in the nav,
          // and a red badge on every row makes a quiet list look like an alarm.
          if (thread.unread > 0)
            Container(
              height: 9,
              width: 9,
              decoration: const BoxDecoration(
                  color: SwaplyColors.greenPressed, shape: BoxShape.circle),
            ),
        ],
      ),
      onTap: () async {
        await Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => ThreadScreen(threadId: thread.id)));
        await _load();
      },
    );
  }
}

/// 06g Samtale and 07k Gruppesamtale. The chain thread carries a banner that
/// cannot be dismissed, because it is a trade we are not part of.
class ThreadScreen extends StatefulWidget {
  const ThreadScreen({super.key, required this.threadId});

  final String threadId;

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  Thread? _thread;
  Trade? _trade;
  String? _error;
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<SwaplyApi>();
    try {
      final thread = await api.thread(widget.threadId);
      final trade = await api.trade(thread.tradeId);
      await api.markThreadRead(widget.threadId);
      if (!mounted) return;
      setState(() {
        _thread = thread;
        _trade = trade;
      });
      await context.read<Session>().refresh();
      _scrollToEnd();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await context.read<SwaplyApi>().sendMessage(widget.threadId, text);
      _input.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final thread = _thread;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Samtale'),
        body: EmptyState(title: 'Fant ikke samtalen', body: _error!, icon: Icons.error_outline),
      );
    }
    if (thread == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final others = thread.participants
        .where((p) => p.id != context.read<Session>().me?.id)
        .map((p) => p.displayName)
        .toList();
    final title = thread.kind == 'chain'
        ? 'Du, ${others.join(' og ')}'
        : (others.firstOrNull ?? 'Samtale');

    final me = context.read<Session>().me?.id;
    final faces = thread.participants.where((p) => p.id != me).take(2).toList();

    return Scaffold(
      appBar: AppBar(
        // 59 tall on #FCFCFB with 18 at the sides: «‹», a 38 face, the name.
        backgroundColor: SwaplyColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 59,
        leadingWidth: 44,
        leading: IconButton(
          padding: const EdgeInsets.only(left: 10),
          icon: const Icon(Icons.chevron_left, size: 26, color: SwaplyColors.ink),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            for (final p in faces)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Avatar(p.displayName, size: faces.length > 1 ? 30 : 38),
              ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title,
                      style: Type.heading, maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (_trade != null)
                    Text(_tradeLine(_trade!),
                        style: const TextStyle(fontSize: 11.5, color: SwaplyColors.grey),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (thread.banner != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(Insets.screen, 0, Insets.screen, Insets.sm),
                padding: const EdgeInsets.all(Insets.md),
                decoration: BoxDecoration(
                  color: SwaplyColors.amberSoft,
                  borderRadius: BorderRadius.circular(Radii.card),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, size: 18, color: SwaplyColors.amber),
                    const SizedBox(width: Insets.sm),
                    Expanded(
                      child: Text(thread.banner!,
                          style: const TextStyle(
                              fontSize: 12.5, height: 1.4, color: SwaplyColors.amber)),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                itemCount: thread.messages.length,
                itemBuilder: (context, i) => Column(
                  children: [
                    if (i == 0) _dayLabel(thread.messages[i].createdAt),
                    _bubble(thread.messages[i], thread.kind == 'chain'),
                  ],
                ),
              ),
            ),
            _composer(),
          ],
        ),
      ),
    );
  }

  String _tradeLine(Trade trade) {
    final give = trade.youGive.map((i) => i.title).join(' + ');
    final get = trade.youGet.map((i) => i.title).join(' + ');
    final state = switch (trade.state) {
      'accepted' => 'godtatt',
      'completed' => 'gjennomført',
      'cancelled' => 'avsluttet',
      'paused' => 'pauset',
      _ => 'under avtale',
    };
    if (trade.isChain) return 'Bytte avtales her · $state';
    return '$give ⇄ $get · $state';
  }

  /// «I dag 14:02» over the first message, as the export sets the scene.
  Widget _dayLabel(DateTime? when) {
    if (when == null) return const SizedBox.shrink();
    final local = when.toLocal();
    final now = DateTime.now();
    final days = DateTime(now.year, now.month, now.day)
        .difference(DateTime(local.year, local.month, local.day))
        .inDays;
    final time =
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    final label = switch (days) {
      0 => 'I dag $time',
      1 => 'I går $time',
      _ => '${local.day}.${local.month}. $time',
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Center(
        child: Text(label,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, color: SwaplyColors.greyLight)),
      ),
    );
  }

  Widget _bubble(ChatMessage message, bool showName) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          mainAxisAlignment:
              message.mine ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!message.mine) ...[
              Avatar(message.senderName ?? '?', size: 28),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 280),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: message.mine ? SwaplyColors.greenPressed : Colors.white,
                  // 18 all round but the corner nearest the sender, which is 6.
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(message.mine ? 18 : 6),
                    bottomRight: Radius.circular(message.mine ? 6 : 18),
                  ),
                  border: message.mine ? null : Border.all(color: SwaplyColors.cardLine),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showName && !message.mine)
                      Text(message.senderName ?? '',
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: SwaplyColors.greySoft)),
                    Text(message.body,
                        style: TextStyle(
                            fontSize: 14.5,
                            height: 1.35,
                            color: message.mine ? Colors.white : SwaplyColors.ink)),
                  ],
                ),
              ),
            ),
          ],
        ),
      );

  /// The three chips over the field. They are trade actions, not decoration:
  /// this is where a conversation turns into a proposal.
  Widget _composer() {
    final trade = _trade;
    final negotiable =
        trade != null && ['talking', 'pending', 'countered'].contains(trade.state);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.barLine)),
      ),
      child: Column(
        children: [
          if (negotiable)
            // Filled pills that wrap onto a second line, as the export draws
            // them — not a row that scrolls sideways and hides the third one.
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                  // Each chip is its own sheet in the export, not three routes
                  // into the same screen.
                  _chip('♥ Jeg vil ha',
                      () => _propose(trade, ProposalKind.askTheirs)),
                  _chip('Foreslå ting',
                      () => _propose(trade, ProposalKind.offerMine)),
                  _chip('Foreslå mellomlegg',
                      () => _propose(trade, ProposalKind.cash)),
                  ],
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 4,
                  style: const TextStyle(fontSize: 14.5, color: SwaplyColors.ink),
                  decoration: InputDecoration(
                    hintText: _thread?.kind == 'chain' ? 'Skriv til begge…' : 'Skriv en melding…',
                    hintStyle: const TextStyle(fontSize: 14.5, color: SwaplyColors.greyLight),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
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
                onTap: _sending ? null : _send,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
                  child: Text('Send',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: _sending ? SwaplyColors.greyLight : SwaplyColors.greenText)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: SwaplyColors.chip,
            borderRadius: BorderRadius.circular(Radii.pill),
          ),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: SwaplyColors.chipInk)),
        ),
      );

  Future<void> _propose(Trade trade, ProposalKind kind) async {
    if (trade.isChain) {
      // A chain has no offer to counter: it is agreed here, which is what the
      // banner above the thread says.
      showError(context, 'Treveis-bytter avtales her i chatten.');
      return;
    }
    final sent = await showProposalSheet(context, trade: trade, kind: kind);
    if (sent) await _load();
  }

}

String _relative(DateTime? when) {
  if (when == null) return '';
  final now = DateTime.now();
  final diff = now.difference(when);
  if (diff.inMinutes < 1) return 'nå';
  if (diff.inHours < 1) return '${diff.inMinutes} min';
  if (now.day == when.day && diff.inHours < 24) {
    return '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
  }
  if (diff.inDays < 2) return 'i går';
  const days = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  if (diff.inDays < 7) return days[when.weekday - 1];
  return '${when.day}.${when.month}.';
}
