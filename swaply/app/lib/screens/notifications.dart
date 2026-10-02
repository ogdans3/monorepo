import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../util/clock.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'chat.dart';
import 'item_detail.dart';
import 'liked.dart';
import 'trade_detail.dart';

/// 12a Varsler. The server sends ids; the sentence is assembled here, so a push
/// through Google or Apple never carries somebody's name.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Only with nothing on screen yet can this fail into «Fikk ikke kontakt»,
  /// which asks again from there; a failed pull keeps the list and says so in
  /// a toast. The error used to replace the list, with no way to ask again.
  Future<void> _load({bool say = false}) async {
    final api = context.read<SwaplyApi>();
    try {
      final result = await api.notifications();
      await api.markNotificationsRead();
      if (mounted) {
        setState(() {
          _items = result.notifications;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_items == null) {
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
    final items = _items;

    return Scaffold(
      appBar: swaplyAppBar(context, 'Varsler'),
      body: _error != null
          ? EmptyState(
              title: 'Fikk ikke kontakt',
              body: _error!,
              icon: Icons.wifi_off,
              actionLabel: 'Prøv igjen',
              onAction: _retry)
          : items == null
              ? const Center(child: CircularProgressIndicator())
              : items.isEmpty
                  ? const EmptyState(
                      icon: Icons.notifications_none,
                      title: 'Ingen varsler',
                      body: 'Vi sier fra når noen liker tingene dine eller et bytte '
                          'trenger deg.',
                    )
                  : RefreshIndicator(
                      onRefresh: () => _load(say: true),
                      child: ListView.separated(
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 1, indent: 72, color: SwaplyColors.line),
                        itemBuilder: (context, i) => _row(items[i]),
                      ),
                    ),
    );
  }

  Widget _row(AppNotification n) {
    final (title, body) = _copy(n);

    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: Insets.screen, vertical: Insets.sm),
      leading: Container(
        height: 40,
        width: 40,
        decoration: const BoxDecoration(
            color: SwaplyColors.greenDeep, shape: BoxShape.circle),
        child: const Center(
          child: Text('s',
              style: TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
        ),
      ),
      title: Text(title, style: Type.heading),
      subtitle: Text(body, style: Type.secondary),
      trailing: Text(_ago(n.createdAt), style: Type.small),
      onTap: () => _open(n),
    );
  }

  (String, String) _copy(AppNotification n) => switch (n.type) {
        // By first name, as the export writes it and every other screen
        // names people: the server sends the whole name, «Kari N.».
        'item_liked' => (
            '${_firstName(n.actorName)} likte ${n.itemTitle ?? 'noe av ditt'}',
            'Se tingene deres og lik tilbake, det lukker bytter raskere.',
          ),
        'trade_opened' => (
            'Dere kan swappe!',
            'Vi fant et bytte. Åpne det for å se hva som byttes.',
          ),
        'trade_accepted' => (
            'Byttet er godtatt',
            'Alle har godtatt. Nå kan dere avtale overleveringen.',
          ),
        'trade_partly_accepted' => (
            'Noen godtok byttet',
            'Nå er det din tur. Sveip for å godta avtalen.',
          ),
        'acceptance_revoked' => (
            'Noen angret godkjenningen',
            'Byttet står fortsatt, men det er ikke godtatt av alle lenger.',
          ),
        'counter_offer' => (
            'Nytt forslag i byttet',
            'Motparten har foreslått noe annet. Godta, avslå eller foreslå på nytt.',
          ),
        'withdrawal_requested' => (
            'Noen vil trekke seg',
            'Byttet er pauset mens du svarer.',
          ),
        // To the one who asked to pull out, when the answer was no: 08c's
        // own words, and «noen» for a ring.
        'withdrawal_rejected' => (
            'Du kan ikke trekke deg',
            'Noen i byttet sa nei, så byttet fortsetter som vanlig.',
          ),
        // To everybody in it, once the 72 hours to answer are up: as 08b
        // says it will, the trade goes on.
        'withdrawal_lapsed' => (
            'Byttet fortsetter',
            'Fristen for å svare gikk ut, så byttet fortsetter som vanlig.',
          ),
        'message' => ('Ny melding', 'Åpne samtalen for å svare.'),
        // A trade that ended, said to everybody in it the server tells. The
        // payload says why with a code and the words are ours, as for every
        // other kind; see [_whyEnded].
        'trade_cancelled' => ('Byttet er avsluttet', _whyEnded(n.payload['reason'])),
        _ => ('Varsel', 'Åpne Swaply for å se hva som skjedde.'),
      };

  /// Why a trade ended, from its code, in words true for everybody it is
  /// sent to: «noen i byttet», not «den andre parten», since a ring has three
  /// people in it, and nothing that names who blocked whom. And nothing about
  /// the things coming free: most trades that end were still a conversation
  /// or an offer, where nothing was ever held, and a thing reserved by
  /// another trade still is. A reason this app does not know yet still says
  /// the trade ended, and the trade says the rest — its own reason is on it,
  /// in words.
  static String _whyEnded(Object? reason) => switch (reason) {
        'declined' => 'Noen i byttet avslo det.',
        'withdrawn_early' => 'Noen i byttet trakk seg før det var godtatt.',
        'displaced' => 'En av tingene i byttet ble reservert i et annet bytte.',
        'withdrawal_approved' => 'Dere ble enige om å avbryte det.',
        'blocked' => 'Det kan ikke fortsette mellom dere.',
        'listing_removed' => 'En av tingene i byttet ble tatt ned.',
        'account_deleted' => 'Noen i byttet slettet kontoen sin.',
        'ended_by_admin' => 'Det ble avsluttet fra testverktøyet.',
        _ => 'Åpne byttet for å se hvorfor.',
      };

  static String _firstName(String? name) {
    final whole = (name ?? '').trim();
    return whole.isEmpty ? 'Noen' : whole.split(' ').first;
  }

  void _open(AppNotification n) {
    final tradeId = n.payload['tradeId'] as String?;
    final itemId = n.payload['itemId'] as String?;
    // A message notification carries the thread it was written in, not the
    // trade around it — so «Ny melding», the one people get most often, used
    // to fall past every branch below and do nothing.
    final threadId = n.payload['threadId'] as String?;

    // What a notification opens is drawn with the bar, and it opens where it
    // lives — Likt under Profil, a trade under Bytter, a thing under Oppdag —
    // the way a push notification on the lock screen, which is what the export
    // drew 12a as, would. A chat is drawn without it, and stays over this list.
    if (n.type == 'item_liked') {
      pushInTab<void>(context, const LikedScreen(), tab: 4);
    } else if (threadId != null) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => ThreadScreen(threadId: threadId)));
    } else if (tradeId != null) {
      pushInTab<void>(context, TradeDetailScreen(tradeId: tradeId), tab: 2);
    } else if (itemId != null) {
      openListingInTab(context, itemId, tab: 0);
    }
  }

  String _ago(DateTime? when) {
    if (when == null) return '';
    final diff = now().difference(when);
    if (diff.inMinutes < 1) return 'nå';
    if (diff.inHours < 1) return '${diff.inMinutes} min';
    if (diff.inDays < 1) return '${diff.inHours} t';
    return '${diff.inDays} d';
  }
}
