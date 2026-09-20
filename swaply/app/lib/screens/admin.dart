import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/admin_chrome.dart';
import '../widgets/common.dart';
import 'trade_detail.dart';

/// Testverktøy — the admin section.
///
/// Not a product screen, and it is not dressed as one: `docs/round-5-screens.md`
/// draws forty-five screens and none of them is this. It exists because testing
/// a two-sided marketplace alone means being the second person, and every lever
/// on it removes a step that is otherwise done by hand.
///
/// Nothing here is reachable without `users.is_admin`, which is set by
/// `pnpm admin` and by nothing the API can reach — see
/// `backend/drizzle/0004_admin.sql`. For everybody else the routes answer 404
/// and this screen is never drawn.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  AdminOverview? _overview;
  AdminState? _state;
  String? _error;
  String? _busy;
  final _said = <String>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final overview = await context.read<SwaplyApi>().adminOverview();
      if (mounted) setState(() => _overview = overview);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// Every lever reports what it did, in order, in the log at the foot of the
  /// screen: a tool whose buttons do things silently is a tool you stop
  /// trusting the first time one of them seems not to have worked.
  Future<void> _run(String key, Future<String> Function(SwaplyApi api) action) async {
    setState(() => _busy = key);
    try {
      final said = await action(context.read<SwaplyApi>());
      if (mounted) setState(() => _said.insert(0, said));
      await _load();
      if (mounted) await context.read<Session>().refresh();
    } on ApiException catch (e) {
      if (mounted) setState(() => _said.insert(0, '✕ ${e.message}'));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final overview = _overview;

    return Scaffold(
      backgroundColor: AdminColors.surface,
      appBar: AppBar(
        backgroundColor: AdminColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: AdminColors.ink),
        title: const Row(
          children: [
            AdminBadge('admin'),
            SizedBox(width: 10),
            Text('Testverktøy',
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w800, color: AdminColors.ink)),
          ],
        ),
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(Insets.xl),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AdminColors.muted)),
              ),
            )
          : overview == null
              ? const Center(child: CircularProgressIndicator(color: AdminColors.accent))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
                    children: [
                      _accounts(overview),
                      _scenarios(),
                      _jobs(),
                      _inspector(),
                      _device(),
                      if (_said.isNotEmpty) _log(),
                    ],
                  ),
                ),
    );
  }

  // --- Kontoer ---------------------------------------------------------------

  Widget _accounts(AdminOverview overview) => AdminCard(
        title: 'Kontoer',
        note: 'Du er ${overview.youName}. Trykk på en testkonto for å bli den — '
            'du kommer alltid tilbake fra linjen nederst på skjermen.',
        children: [
          for (final account in overview.accounts) _accountRow(account),
          if (overview.accounts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 10),
              child: Text('Ingen testkontoer ennå.',
                  style: TextStyle(fontSize: 13, color: AdminColors.muted)),
            ),
          Row(
            children: [
              Expanded(
                child: AdminButton('Lag testkonto',
                    filled: true,
                    busy: _busy == 'create',
                    onPressed: () => _run('create', (api) async {
                          final made = await api.createTestAccount();
                          return 'Lagde ${made.displayName} med 2 gjenstander';
                        })),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AdminButton('Uten profil',
                    busy: _busy == 'create-anon',
                    onPressed: () => _run('create-anon', (api) async {
                          await api.createTestAccount(claimed: false, withItems: 0);
                          return 'Lagde en enhet som bare ser seg rundt (10c-flyten)';
                        })),
              ),
            ],
          ),
        ],
      );

  Widget _accountRow(TestAccount account) {
    final facts = [
      if (!account.claimed) 'uten profil',
      if (account.town != null) account.town!,
      '${account.itemCount} ting',
      if (account.openTrades > 0) '${account.openTrades} åpne bytter',
      if (account.bankid) 'BankID',
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AdminColors.hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(account.displayName,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w700, color: AdminColors.ink)),
                Text(facts,
                    style: const TextStyle(fontSize: 11.5, color: AdminColors.muted)),
              ],
            ),
          ),
          AdminButton('Bli denne',
              busy: _busy == 'switch-${account.id}',
              onPressed: () async {
                setState(() => _busy = 'switch-${account.id}');
                try {
                  await context.read<Session>().switchTo(account.id);
                  if (mounted) {
                    Navigator.of(context)
                        .pushNamedAndRemoveUntil('/', (route) => false);
                  }
                } on ApiException catch (e) {
                  if (mounted) showError(context, e);
                } finally {
                  if (mounted) setState(() => _busy = null);
                }
              }),
          IconButton(
            tooltip: 'Nullstill eller slett',
            icon: const Icon(Icons.more_horiz, color: AdminColors.muted, size: 20),
            onPressed: () => _accountMenu(account),
          ),
        ],
      ),
    );
  }

  Future<void> _accountMenu(TestAccount account) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AdminColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
              child: Text(account.displayName,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800, color: AdminColors.ink)),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                'Nullstill åpner dørene produktet bare lar deg gå gjennom én gang: '
                'interesser kan ikke tømmes, og BankID kan ikke settes tilbake.',
                style: TextStyle(fontSize: 12.5, height: 1.4, color: AdminColors.muted),
              ),
            ),
            for (final part in const [
              ('likes', 'Nullstill likes'),
              ('items', 'Nullstill gjenstander'),
              ('trades', 'Avslutt åpne bytter'),
              ('interests', 'Nullstill interesser — skjerm 02 kommer igjen'),
              ('bankid', 'Nullstill BankID — spørsmålet kommer igjen'),
              ('notifications', 'Slett varsler'),
            ])
              ListTile(
                dense: true,
                title: Text(part.$2,
                    style: const TextStyle(fontSize: 14, color: AdminColors.ink)),
                onTap: () {
                  Navigator.of(sheet).pop();
                  _run('reset', (api) async {
                    final done = await api.adminReset(account.id, [part.$1]);
                    return '${account.displayName}: ${done.join(', ')}';
                  });
                },
              ),
            const Divider(color: AdminColors.hairline, height: 1),
            ListTile(
              dense: true,
              title: const Text('Slett testkontoen',
                  style: TextStyle(fontSize: 14, color: SwaplyColors.coral)),
              subtitle: const Text('Går gjennom den ekte sletterutinen og frigjør enhets-id-en',
                  style: TextStyle(fontSize: 11.5, color: AdminColors.muted)),
              onTap: () {
                Navigator.of(sheet).pop();
                _run('delete', (api) async {
                  await api.adminDeleteAccount(account.id);
                  return 'Slettet ${account.displayName}';
                });
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  // --- Bygg et bytte ---------------------------------------------------------

  static const _states = [
    ('talking', 'Samtale'),
    ('pending', 'Venter på svar'),
    ('countered', 'Motbytte mottatt'),
    ('accepted', 'Godtatt'),
    ('handover', 'Overlevering'),
    ('paused', 'Pauset — noen vil trekke seg'),
    ('completed', 'Gjennomført'),
    ('declined', 'Avslått'),
    ('displaced', 'Fortrengt av et annet bytte'),
  ];

  Widget _scenarios() => AdminCard(
        title: 'Bygg et bytte',
        note: 'Bygges ved å trykke produktets egne knapper i rekkefølge — ikke ved å '
            'skrive en tilstand rett i databasen. Du er alltid med i byttet.',
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final state in _states)
                _chip(state.$2, busy: _busy == 'sc-${state.$1}', onTap: () {
                  _run('sc-${state.$1}', (api) async {
                    final built = await api.adminScenario(state.$1);
                    if (built.tradeId != null && mounted) {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => TradeDetailScreen(tradeId: built.tradeId!)));
                    }
                    return '${state.$2}: ${built.steps.join(' → ')}';
                  });
                }),
            ],
          ),
          const SizedBox(height: 10),
          AdminButton('Treveis-bytte (07i · 07j · 07k)',
              busy: _busy == 'sc-three',
              onPressed: () => _run('sc-three', (api) async {
                    final built = await api.adminScenario('pending', shape: 'three-way');
                    if (built.tradeId != null && mounted) {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => TradeDetailScreen(tradeId: built.tradeId!)));
                    }
                    return 'Treveis: ${built.steps.join(' → ')}';
                  })),
        ],
      );

  // --- Tid og jobber ---------------------------------------------------------

  Widget _jobs() => AdminCard(
        title: 'Tid og jobber',
        note: 'To tilstander ingen mengde trykking når: sweepen går én gang i timen, '
            'og svarfristen på en uttrekksforespørsel er 72 timer.',
        children: [
          AdminButton('Kjør sweepen nå',
              busy: _busy == 'sweep',
              onPressed: () => _run('sweep', (api) async {
                    final opened = await api.adminRunSweep();
                    return opened == 0
                        ? 'Sweepen fant ingen nye sirkler'
                        : 'Sweepen åpnet $opened bytter';
                  })),
        ],
      );

  // --- Tilstand --------------------------------------------------------------

  Widget _inspector() => AdminCard(
        title: 'Tilstand',
        note: 'Det skjermene med vilje skjuler: hva som holder hva, hvilken versjon av '
            'forslaget som ligger på bordet, og hvem som har godtatt den.',
        children: [
          if (_state == null)
            AdminButton('Hent tilstand',
                busy: _busy == 'state',
                onPressed: () => _run('state', (api) async {
                      final state = await api.adminState();
                      if (mounted) setState(() => _state = state);
                      return 'Leste ${state.items.length} gjenstander og ${state.trades.length} bytter';
                    }))
          else ...[
            for (final item in _state!.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '${item.ownerName} · ${item.title} · ${item.status}'
                  '${item.activeTradeState == null ? '' : ' → holdt av et bytte i ${item.activeTradeState}'}',
                  style: const TextStyle(fontSize: 11.5, height: 1.4, color: AdminColors.muted),
                ),
              ),
            const SizedBox(height: 8),
            for (final trade in _state!.trades)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  '${trade.kind} · ${trade.state} · forslag #${trade.offerSeq ?? 0}\n'
                  '${trade.participants.map((p) => '${p.position}:${p.displayName}'
                      '${p.accepted ? ' ✓godtatt' : ''}${p.sent ? ' ✓sendt' : ''}'
                      '${p.received ? ' ✓mottatt' : ''}').join('   ')}',
                  style: const TextStyle(fontSize: 11.5, height: 1.5, color: AdminColors.ink),
                ),
              ),
            const SizedBox(height: 4),
            AdminButton('Oppdater',
                busy: _busy == 'state',
                onPressed: () => _run('state', (api) async {
                      final state = await api.adminState();
                      if (mounted) setState(() => _state = state);
                      return 'Oppdaterte tilstanden';
                    })),
          ],
        ],
      );

  // --- Denne enheten ---------------------------------------------------------

  Widget _device() => AdminCard(
        title: 'Denne enheten',
        note: 'Enhets-id-en lagres én gang og beholdes. Når kontoen bak den har fått '
            'en profil, kommer du aldri inn i «se deg rundt» igjen på denne '
            'maskinen — med mindre du glemmer den.',
        children: [
          AdminButton('Glem denne enheten',
              busy: _busy == 'device',
              onPressed: () => _run('device', (api) async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.remove('deviceId');
                    return 'Enhets-id-en er glemt — «Se deg rundt» virker igjen';
                  })),
        ],
      );

  Widget _log() => AdminCard(
        title: 'Hva verktøyet gjorde',
        children: [
          for (final line in _said.take(12))
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text(line,
                  style: const TextStyle(fontSize: 11.5, height: 1.45, color: AdminColors.muted)),
            ),
        ],
      );

  Widget _chip(String label, {required VoidCallback onTap, bool busy = false}) => GestureDetector(
        onTap: busy ? null : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: busy ? AdminColors.accent : AdminColors.cardFill,
            borderRadius: BorderRadius.circular(Radii.pill),
            border: Border.all(color: AdminColors.hairline),
          ),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12.5, fontWeight: FontWeight.w600, color: AdminColors.ink)),
        ),
      );
}
