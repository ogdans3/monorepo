import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../util/clock.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'profile.dart';
import 'proposal_sheets.dart';

/// 11a Chats. One row per conversation, with what the trade is about under the
/// last message, because that is how you tell two of them apart.
class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> with RefetchOnTabReturn {
  List<ChatSummary>? _threads;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void onTabReturn() => _load();

  /// Asked for on opening, on coming back to the tab or from a conversation,
  /// and on a pull. Only with nothing on screen yet can it fail into «Fikk
  /// ikke kontakt»; otherwise the list stays, and [say] tells a failed pull in
  /// a toast over it. As on Bytter, the error used to replace a list that was
  /// there and outlive the connection coming back.
  Future<void> _load({bool say = false}) async {
    try {
      final result = await context.read<SwaplyApi>().threads();
      if (!mounted) return;
      setState(() {
        _threads = result.threads;
        _error = null;
      });
      await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_threads == null) {
        setState(() => _error = e.message);
      } else if (say) {
        showError(context, e);
      }
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load();
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
                    onAction: _retry)
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
                            onRefresh: () => _load(say: true),
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
        // 06g is drawn without the bar: the composer is at the foot instead.
        await pushOverBar<void>(context, ThreadScreen(threadId: thread.id));
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

  /// How often an open conversation asks whether anything was said. It
  /// never asked: a reply landed on the server and not on the screen until
  /// the person left and came back. Not a socket — there is none to listen
  /// on — and not every second, on a server shared with real testers;
  /// pulling the list down asks at once.
  static const pollEvery = Duration(seconds: 10);

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> with WidgetsBindingObserver {
  Thread? _thread;
  Trade? _trade;
  ApiException? _error;
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;

  Timer? _poll;

  /// Whether the app is in front. Nothing is asked from the background.
  bool _inFront = true;

  /// The newest asking, so an older answer landing late does not put an
  /// older conversation back; and how many are on their way, so a poll
  /// does not pile onto a slow one.
  int _asking = 0, _inFlight = 0;

  /// The last message the server has been told this person has read.
  String? _readUpTo;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    _inFront = state == null || state == AppLifecycleState.resumed;
    _load(toEnd: true);
    _startPolling();
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final inFront = state == AppLifecycleState.resumed;
    if (inFront == _inFront) return;
    _inFront = inFront;
    if (inFront) {
      // Back from the background: what was said meanwhile, at once.
      _load(quiet: true);
      _startPolling();
    } else {
      _poll?.cancel();
    }
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(ThreadScreen.pollEvery, (_) {
      // Only while this is the screen on top: not under a sheet, and not
      // under a page opened over it.
      if (!mounted || !_inFront || _inFlight > 0) return;
      if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
      _load(quiet: true);
    });
  }

  /// Asked for when the page opens, after a message or a proposal is sent,
  /// on a pull, every [ThreadScreen.pollEvery] while it is on screen, and
  /// when the app comes back. Only the first asking can fail into
  /// [LoadFailure]: after that the conversation stays and the failure is a
  /// toast over it — or nothing, when [quiet], for the askings nobody
  /// pressed anything for. A message that went, followed by a reload that
  /// did not, used to replace the conversation with «Fant ikke samtalen».
  ///
  /// The list goes to the newest message on opening and after a send, with
  /// [toEnd]; otherwise only when something new arrived and the list was at
  /// its end already, so a poll does not pull somebody away from what they
  /// had scrolled up to read.
  Future<void> _load({bool quiet = false, bool toEnd = false}) async {
    final api = context.read<SwaplyApi>();
    final session = context.read<Session>();
    final asking = ++_asking;
    _inFlight++;
    try {
      final thread = await api.thread(widget.threadId);
      final trade = await api.trade(thread.tradeId);
      if (!mounted || asking != _asking) return;
      final before = _thread?.messages.lastOrNull?.id;
      final atEnd = !_scroll.hasClients ||
          _scroll.position.pixels >= _scroll.position.maxScrollExtent - 24;
      setState(() {
        _thread = thread;
        _trade = trade;
        _error = null;
      });
      final last = thread.messages.lastOrNull?.id;
      if (toEnd || (last != before && atEnd)) _scrollToEnd();
      await _markRead(api, session, last);
    } on ApiException catch (e) {
      if (!mounted || asking != _asking) return;
      if (_thread == null) {
        setState(() => _error = e);
      } else if (!quiet) {
        showError(context, e);
      }
    } finally {
      _inFlight--;
    }
  }

  /// Read up to [last], the newest message now on screen, and no further:
  /// the server used to mark read whatever was newest when the call reached
  /// it, a message that arrived after this screen asked included. Once per
  /// message, so a poll that brings nothing new tells the server nothing.
  /// The badge on Chats follows from the session.
  Future<void> _markRead(SwaplyApi api, Session session, String? last) async {
    if (last == null || last == _readUpTo) return;
    try {
      await api.markThreadRead(widget.threadId, upTo: last);
      _readUpTo = last;
      await session.refresh();
    } on ApiException {
      // Not read, as far as the server knows; the next asking tries again.
      // Nothing to say about it: the conversation is on screen.
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load(toEnd: true);
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
      // Closed while it was on its way: the field went with the screen,
      // and there is no conversation on screen to ask for again.
      if (!mounted) return;
      _input.clear();
      await _load(toEnd: true);
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
        body: LoadFailure(_error!, missing: 'Fant ikke samtalen', onRetry: _retry),
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
          tooltip: 'Tilbake',
          padding: const EdgeInsets.only(left: 10),
          icon: const Icon(Icons.chevron_left, size: 26, color: SwaplyColors.ink),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        titleSpacing: 0,
        // The face and the name open who it is, 13b, which is where report
        // and block live: a chat had no way to either. In a ring there are
        // two, so a small sheet asks which. Nothing new is drawn for it, as
        // a name in a header is where a person looks for them. A finger
        // tall, centred where the row was, so nothing moves.
        title: TapArea(
          onTap: () => _openPerson(thread),
          child: SizedBox(
            height: kTapTarget,
            child: Row(
              children: [
                for (final p in faces)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    // The initial says nothing the name does not.
                    child: ExcludeSemantics(
                        child: Avatar(p.displayName, size: faces.length > 1 ? 30 : 38)),
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
                      child: Text(_banner(thread),
                          style: const TextStyle(
                              fontSize: 12.5, height: 1.4, color: SwaplyColors.amber)),
                    ),
                  ],
                ),
              ),
            Expanded(
              // Pulled down, it asks at once, as every list in the app does,
              // and says so in a toast when there is no answer.
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView.builder(
                  controller: _scroll,
                  // A short conversation can be pulled as well.
                  physics: const AlwaysScrollableScrollPhysics(),
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
            ),
            // What a refusal of «Send» is about, so its toast goes up over
            // the composer rather than on it.
            if (_trade?.conversationClosed ?? false)
              _closed(_trade!)
            else
              KeepClear(child: _composer()),
          ],
        ),
      ),
    );
  }

  /// The banner over a ring's conversation, which the server words for a
  /// ring being arranged — «Dere avtaler overlevering … selv i denne
  /// chatten» — and which stayed so after the ring had ended. Once it has,
  /// it says that, and still that Swaply was not part of it.
  String _banner(Thread thread) => switch (thread.state) {
        'cancelled' => 'Byttet er avsluttet. Swaply var ikke part i det.',
        'completed' => 'Byttet er gjennomført. Swaply var ikke part i det.',
        _ => thread.banner!,
      };

  /// In the composer's place on a trade that ended with nobody left to
  /// write to: somebody in it deleted their account, or blocked another.
  /// The field stayed, and what was written there went to nobody.
  Widget _closed(Trade trade) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: const BoxDecoration(
          color: SwaplyColors.surface,
          border: Border(top: BorderSide(color: SwaplyColors.barLine)),
        ),
        child: Text(
          trade.closeCode == Trade.closedByBlock
              // Not who blocked whom: the one blocked reads it too.
              ? 'Samtalen er stengt etter en blokkering.'
              : trade.isChain
                  ? 'Samtalen er stengt fordi en av de andre i byttet slettet kontoen sin.'
                  : 'Samtalen er stengt fordi den andre i byttet slettet kontoen sin.',
          style: Type.secondary,
          textAlign: TextAlign.center,
        ),
      );

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
    final today = now();
    final days = DateTime(today.year, today.month, today.day)
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
  ///
  /// Not in a ring. 07k draws them, but each sheet behind them proposes to
  /// the one person you receive from, which a ring of three has no offer
  /// for: every tap ended in a toast saying so. A ring is agreed in words,
  /// which is what the banner over it says.
  Widget _composer() {
    final trade = _trade;
    final negotiable = trade != null &&
        !trade.isChain &&
        ['talking', 'pending', 'countered'].contains(trade.state);

    // 10 over the chips and 8 under them, and 8 under the field: the chips
    // share theirs, and the field and «Send» share the rest.
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: SwaplyColors.surface,
        border: Border(top: BorderSide(color: SwaplyColors.barLine)),
      ),
      child: Column(
        children: [
          if (negotiable)
            // Filled pills that wrap onto a second line, as the export draws
            // them — not a row that scrolls sideways and hides the third one.
            TapRoom(
              room: const EdgeInsets.only(top: 10, bottom: 8),
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
          TapRoom(
            room: EdgeInsets.only(top: negotiable ? 0 : 10, bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: TapArea(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      style: const TextStyle(fontSize: 14.5, color: SwaplyColors.ink),
                      decoration: InputDecoration(
                        hintText:
                            _thread?.kind == 'chain' ? 'Skriv til begge…' : 'Skriv en melding…',
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
                ),
                const SizedBox(width: 10),
                TapArea(
                  room: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
                  onTap: _sending ? null : _send,
                  keepsKeyboard: true,
                  child: Text('Send',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: _sending ? SwaplyColors.greyLight : SwaplyColors.greenText)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, VoidCallback onTap) => TapArea(
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

  /// 13b for the other person, or for the one of the two in a ring this
  /// person picks. 13b is drawn with the bar, so it goes into the tab under
  /// this conversation, which covers the bar and is taken down for it.
  Future<void> _openPerson(Thread thread) async {
    final me = context.read<Session>().me?.id;
    final others = thread.participants.where((p) => p.id != me).toList();
    final person = others.length > 1
        ? await choosePerson(context, title: 'Se profil', people: others)
        : others.firstOrNull;
    if (person == null || !mounted) return;
    await pushInTab<void>(context, OtherProfileScreen(userId: person.id));
  }

  Future<void> _propose(Trade trade, ProposalKind kind) async {
    final sent = await showProposalSheet(context, trade: trade, kind: kind);
    // Its line in the conversation is the newest thing in it.
    if (sent) await _load(toEnd: true);
  }

}

/// A small sheet with the people in a ring, for something that is about one
/// of them. Null when it is closed without a choice.
Future<UserRef?> choosePerson(
  BuildContext context, {
  required String title,
  required List<UserRef> people,
  String Function(UserRef person)? describe,
}) =>
    showModalBottomSheet<UserRef>(
      context: context,
      // Over the bar, not inside the tab under it; see `pushOverBar`.
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Insets.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: Type.title),
              const SizedBox(height: Insets.sm),
              for (final person in people)
                InkWell(
                  borderRadius: BorderRadius.circular(Radii.card),
                  onTap: () => Navigator.of(sheet).pop(person),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Avatar(person.displayName, size: 40),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(person.displayName, style: Type.heading),
                              if (describe != null) Text(describe(person), style: Type.small),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: Insets.md),
              SecondaryButton('Avbryt', onPressed: () => Navigator.of(sheet).pop()),
            ],
          ),
        ),
      ),
    );

String _relative(DateTime? when) {
  if (when == null) return '';
  final today = now();
  final diff = today.difference(when);
  if (diff.inMinutes < 1) return 'nå';
  if (diff.inHours < 1) return '${diff.inMinutes} min';
  if (today.day == when.day && diff.inHours < 24) {
    return '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
  }
  if (diff.inDays < 2) return 'i går';
  const days = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  if (diff.inDays < 7) return days[when.weekday - 1];
  return '${when.day}.${when.month}.';
}
