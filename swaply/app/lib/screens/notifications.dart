import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
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

  Future<void> _load() async {
    final api = context.read<SwaplyApi>();
    try {
      final result = await api.notifications();
      await api.markNotificationsRead();
      if (mounted) setState(() => _items = result.notifications);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;

    return Scaffold(
      appBar: swaplyAppBar(context, 'Varsler'),
      body: _error != null
          ? EmptyState(
              title: 'Fikk ikke kontakt', body: _error!, icon: Icons.wifi_off)
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
                      onRefresh: _load,
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
        'item_liked' => (
            '${n.actorName ?? 'Noen'} likte ${n.itemTitle ?? 'noe av ditt'}',
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
        'counter_offer' => (
            'Nytt forslag i byttet',
            'Motparten har foreslått noe annet. Godta, avslå eller foreslå på nytt.',
          ),
        'withdrawal_requested' => (
            'Noen vil trekke seg',
            'Byttet er pauset mens du svarer.',
          ),
        'message' => ('Ny melding', 'Åpne samtalen for å svare.'),
        _ => ('Varsel', 'Åpne Swaply for å se hva som skjedde.'),
      };

  void _open(AppNotification n) {
    final tradeId = n.payload['tradeId'] as String?;
    final itemId = n.payload['itemId'] as String?;

    if (n.type == 'item_liked') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LikedScreen()));
    } else if (tradeId != null) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => TradeDetailScreen(tradeId: tradeId)));
    } else if (itemId != null) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: itemId)));
    }
  }

  String _ago(DateTime? when) {
    if (when == null) return '';
    final diff = DateTime.now().difference(when);
    if (diff.inMinutes < 1) return 'nå';
    if (diff.inHours < 1) return '${diff.inMinutes} min';
    if (diff.inDays < 1) return '${diff.inHours} t';
    return '${diff.inDays} d';
  }
}
