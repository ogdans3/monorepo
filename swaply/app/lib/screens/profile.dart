import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'item_detail.dart';
import 'liked.dart';
import 'notifications.dart';
import 'onboarding.dart';
import 'post_item.dart';

/// 13 Profil, and 17c before anything has been listed.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<Session>().refresh());
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<Session>().me;

    if (me == null) {
      return const SwaplyScaffold(
        currentTab: 4,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    return SwaplyScaffold(
      currentTab: 4,
      child: RefreshIndicator(
        onRefresh: () => context.read<Session>().refresh(),
        child: ListView(
          padding: const EdgeInsets.all(Insets.screen),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_none),
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  child: const Text('Innstillinger',
                      style: TextStyle(color: SwaplyColors.greySoft)),
                ),
              ],
            ),
            Row(
              children: [
                Avatar(me.displayName ?? '?', size: 64),
                const SizedBox(width: Insets.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(me.displayName ?? 'Uten navn', style: Type.title),
                      if (me.bankidVerified)
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: StatePill('BankID-verifisert'),
                        ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          StarRow(value: me.ratingAvg ?? 0),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              me.ratingCount == 0
                                  ? 'Ingen vurderinger ennå'
                                  : '${me.ratingAvg!.toStringAsFixed(1).replaceAll('.', ',')} · '
                                      '${me.ratingCount} vurderinger',
                              style: Type.small,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        [
                          if (me.town != null) me.town!,
                          if (me.memberSince != null) 'medlem siden ${_month(me.memberSince!)}',
                        ].join(' · '),
                        style: Type.small,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: Insets.lg),
            InkWell(
              borderRadius: BorderRadius.circular(Radii.card),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const LikedScreen())),
              child: SectionCard(
                child: Row(
                  children: [
                    const Icon(Icons.favorite, size: 18, color: SwaplyColors.coral),
                    const SizedBox(width: Insets.sm),
                    Expanded(
                      child: Text(
                        me.likedByCount == 0
                            ? 'Ingen har likt tingene dine ennå'
                            : '${me.likedByCount} har likt tingene dine',
                        style: Type.body,
                      ),
                    ),
                    const Text('Se hvem ›',
                        style: TextStyle(fontSize: 13, color: SwaplyColors.greenPressed)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: Insets.lg),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Interesser', style: Type.heading),
                TextButton(
                  onPressed: () async {
                    final session = context.read<Session>();
                    await Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const InterestsScreen()));
                    await session.refresh();
                  },
                  child: const Text('Endre',
                      style: TextStyle(color: SwaplyColors.greenPressed)),
                ),
              ],
            ),
            Wrap(
              spacing: Insets.sm,
              runSpacing: Insets.sm,
              children: me.interests
                  .map((c) => StatePill(categoryLabels[c] ?? c,
                      color: SwaplyColors.greenDeep))
                  .toList(),
            ),
            if (me.interests.isEmpty)
              const Text('+ fylles ut mens du bruker appen', style: Type.small),
            const SizedBox(height: Insets.lg),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text('Mine gjenstander · ${me.items.length}',
                      style: Type.heading, overflow: TextOverflow.ellipsis),
                ),
                TextButton.icon(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const PostItemScreen())),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Legg ut'),
                  style: TextButton.styleFrom(foregroundColor: SwaplyColors.greenPressed),
                ),
              ],
            ),
            if (me.items.isEmpty)
              EmptyState(
                icon: Icons.inventory_2_outlined,
                title: 'Du har ingen ting ute',
                body: 'Legg ut den første tingen din. Det tar under et minutt.',
                actionLabel: 'Legg ut',
                onAction: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const PostItemScreen())),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 200,
                  mainAxisSpacing: Insets.md,
                  crossAxisSpacing: Insets.md,
                  childAspectRatio: 0.78,
                ),
                itemCount: me.items.length,
                itemBuilder: (context, i) => _ownItem(me.items[i]),
              ),
            const SizedBox(height: Insets.xl),
          ],
        ),
      ),
    );
  }

  Widget _ownItem(Item item) {
    final (label, colour) = switch (item.status) {
      'reserved' => ('Reservert', SwaplyColors.amber),
      'traded' => ('Byttet', SwaplyColors.greySoft),
      'withdrawn' => ('Trukket', SwaplyColors.greySoft),
      _ => ('Tilgjengelig', SwaplyColors.greenPressed),
    };

    return GestureDetector(
      onTap: () => Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: item.id))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(child: ItemThumb(item, size: 400, radius: Radii.card)),
                Positioned(left: 6, top: 6, child: StatePill(label, color: colour, soft: Colors.white)),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
          Text('Verdi ${kr(item.estimatedValueNok)}', style: Type.small),
        ],
      ),
    );
  }
}

/// 13b Annen profil. Their things are the point of the screen: it is where a
/// loop gets closed from the other side.
class OtherProfileScreen extends StatefulWidget {
  const OtherProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  State<OtherProfileScreen> createState() => _OtherProfileScreenState();
}

class _OtherProfileScreenState extends State<OtherProfileScreen> {
  UserRef? _user;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await context.read<SwaplyApi>().user(widget.userId);
      if (mounted) setState(() => _user = user);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Profil'),
        body: EmptyState(title: 'Fant ikke profilen', body: _error!, icon: Icons.error_outline),
      );
    }
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return SwaplyScaffold(
      currentTab: 0,
      appBar: swaplyAppBar(context, user.displayName, actions: [
        IconButton(
          icon: const Icon(Icons.more_horiz),
          onPressed: () => showReportSheet(context,
              userId: user.id, personName: user.displayName, alreadyBlocked: user.blockedByYou),
        ),
      ]),
      child: ListView(
        padding: const EdgeInsets.all(Insets.screen),
        children: [
          Row(
            children: [
              Avatar(user.displayName, size: 64),
              const SizedBox(width: Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.displayName, style: Type.title),
                    if (user.bankidVerified)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: StatePill('BankID-verifisert'),
                      ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        StarRow(value: user.ratingAvg ?? 0),
                        const SizedBox(width: 5),
                        Text(
                          [
                            if (user.ratingAvg != null)
                              user.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                            if (user.tradeCount != null) '${user.tradeCount} bytter',
                          ].join(' · '),
                          style: Type.small,
                        ),
                      ],
                    ),
                    Text(
                      [
                        if (user.town != null) user.town!,
                        if (user.memberSince != null)
                          'medlem siden ${_month(user.memberSince!)}',
                      ].join(' · '),
                      style: Type.small,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (user.interests.isNotEmpty) ...[
            const SizedBox(height: Insets.md),
            Wrap(
              spacing: Insets.sm,
              runSpacing: Insets.sm,
              children: user.interests
                  .map((c) => StatePill(categoryLabels[c] ?? c))
                  .toList(),
            ),
          ],
          const SizedBox(height: Insets.lg),
          Text('${user.displayName.split(' ').first} sine gjenstander · ${user.items.length}',
              style: Type.heading),
          const SizedBox(height: Insets.sm),
          if (user.items.isEmpty)
            const Text('Ingen ting ute akkurat nå.', style: Type.secondary)
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 200,
                mainAxisSpacing: Insets.md,
                crossAxisSpacing: Insets.md,
                childAspectRatio: 0.78,
              ),
              itemCount: user.items.length,
              itemBuilder: (context, i) {
                final item = user.items[i];
                return GestureDetector(
                  onTap: () async {
                    await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: item.id)));
                    await _load();
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: ItemThumb(item, size: 400, radius: Radii.card)),
                      const SizedBox(height: 6),
                      Text(item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13.5, fontWeight: FontWeight.w600)),
                      Text('Verdi ${kr(item.estimatedValueNok)}', style: Type.small),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: Insets.xl),
        ],
      ),
    );
  }
}

/// 16b Innstillinger.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final me = session.me;

    return Scaffold(
      appBar: swaplyAppBar(context, 'Innstillinger'),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
        children: [
          const Kicker('Konto'),
          _tile(context, 'Profil', me?.displayName,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile(context, 'E-post og telefon',
              [me?.email, me?.phone].where((s) => s != null).join(' · '),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile(
            context,
            'BankID-verifisering',
            me?.bankidVerified == true ? 'Verifisert' : 'Ikke verifisert',
            onTap: me?.bankidVerified == true
                ? null
                : () => _verifyBankid(context),
          ),
          const SizedBox(height: Insets.lg),
          const Kicker('Varsler'),
          const _NotificationToggle(label: 'Swaps og bytter'),
          const _NotificationToggle(label: 'Meldinger'),
          const _NotificationToggle(label: 'Likes på tingene mine'),
          const SizedBox(height: Insets.lg),
          _tile(context, 'Juridisk og personvern', null, onTap: () => _showLegal(context)),
          const SizedBox(height: Insets.lg),
          SecondaryButton('Logg ut', destructive: true, onPressed: () async {
            await context.read<Session>().logout();
            if (context.mounted) {
              Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()), (r) => false);
            }
          }),
          const SizedBox(height: Insets.xl),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, String title, String? value, {VoidCallback? onTap}) =>
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(title, style: Type.body),
        subtitle: value == null || value.isEmpty ? null : Text(value, style: Type.small),
        trailing: onTap == null
            ? null
            : const Icon(Icons.chevron_right, color: SwaplyColors.grey),
        onTap: onTap,
      );

  Future<void> _verifyBankid(BuildContext context) async {
    // A real BankID check goes through a provider we do not have a contract
    // with yet. What we store either way is a pseudonym, never a fødselsnummer.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('BankID-verifisering', style: Type.heading),
        content: const Text(
          'Vi har ikke avtale med en BankID-leverandør ennå. Denne knappen '
          'markerer kontoen som verifisert med en pseudonym referanse, slik '
          'flyten vil fungere når avtalen er på plass. Vi lagrer aldri '
          'fødselsnummer.',
          style: Type.body,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialog).pop(false),
              child: const Text('Avbryt')),
          TextButton(
              onPressed: () => Navigator.of(dialog).pop(true),
              child: const Text('Verifiser')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final session = context.read<Session>();
    try {
      await context
          .read<SwaplyApi>()
          .verifyBankid('dev-${session.me!.id}');
      await session.refresh();
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  void _showLegal(BuildContext context) => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Juridisk og personvern', style: Type.heading),
          content: const SingleChildScrollView(
            child: Text(
              'Swaply er ikke part i byttene og fasiliterer verken frakt eller betaling. '
              'Avtalen er mellom deg og den du bytter med.\n\n'
              'Vi lagrer aldri fødselsnummer. BankID gir oss en pseudonym referanse og et '
              'tidspunkt.\n\n'
              'Sletter du kontoen, tømmes profilen din med en gang. En minimal '
              'identitetspost beholdes adskilt i tre år etter siste gjennomførte bytte, '
              'slik at et krav kan fremmes eller forsvares.',
              style: Type.body,
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(), child: const Text('Lukk')),
          ],
        ),
      );
}

class _NotificationToggle extends StatefulWidget {
  const _NotificationToggle({required this.label});
  final String label;

  @override
  State<_NotificationToggle> createState() => _NotificationToggleState();
}

class _NotificationToggleState extends State<_NotificationToggle> {
  bool _on = true;

  @override
  Widget build(BuildContext context) => SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(widget.label, style: Type.body),
        value: _on,
        activeThumbColor: SwaplyColors.greenPressed,
        onChanged: (v) => setState(() => _on = v),
      );
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final _name = TextEditingController(text: context.read<Session>().me?.displayName);
  late final _email = TextEditingController(text: context.read<Session>().me?.email);
  late final _phone = TextEditingController(text: context.read<Session>().me?.phone);
  late final _town = TextEditingController(text: context.read<Session>().me?.town);
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _town]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await context.read<SwaplyApi>().updateMe({
        'displayName': _name.text.trim(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'town': _town.text.trim(),
      });
      if (!mounted) return;
      await context.read<Session>().refresh();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: swaplyAppBar(context, 'Rediger profil'),
        body: ListView(
          padding: const EdgeInsets.all(Insets.screen),
          children: [
            const Text('Visningsnavn', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _name),
            const SizedBox(height: Insets.md),
            const Text('E-post', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _email, keyboardType: TextInputType.emailAddress),
            const SizedBox(height: Insets.md),
            const Text('Telefonnummer', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _phone, keyboardType: TextInputType.phone),
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Brukes til Vipps-mellomlegg. Vises bare i bytter du er med i.',
                  style: Type.small),
            ),
            const SizedBox(height: Insets.md),
            const Text('Sted', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _town),
            const SizedBox(height: Insets.lg),
            PrimaryButton('Lagre', busy: _busy, onPressed: _save),
          ],
        ),
      );
}

/// 16a Rapporter. Reporting and blocking are one gesture here, as in the export.
Future<void> showReportSheet(
  BuildContext context, {
  String? itemId,
  String? userId,
  String? personName,
  bool alreadyBlocked = false,
}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (_) => _ReportSheet(
        itemId: itemId,
        userId: userId,
        personName: personName,
        alreadyBlocked: alreadyBlocked,
        api: context.read<SwaplyApi>(),
        messenger: ScaffoldMessenger.of(context),
      ),
    );

/// The sheet owns its text controller. Disposing one from the caller after
/// `showModalBottomSheet` returns tears it down while the exit animation is
/// still building the field, which throws.
class _ReportSheet extends StatefulWidget {
  const _ReportSheet({
    required this.api,
    required this.messenger,
    this.itemId,
    this.userId,
    this.personName,
    this.alreadyBlocked = false,
  });

  final SwaplyApi api;
  final ScaffoldMessengerState messenger;
  final String? itemId, userId, personName;
  final bool alreadyBlocked;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  final _detail = TextEditingController();
  String _reason = 'spam';
  bool _block = false;
  bool _busy = false;

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => _busy = true);
    Navigator.of(context).pop();
    try {
      await widget.api.report(
        targetItem: widget.itemId,
        targetUser: widget.userId,
        reason: _reason,
        detail: _detail.text.trim().isEmpty ? null : _detail.text.trim(),
        block: _block,
      );
      widget.messenger
          .showSnackBar(const SnackBar(content: Text('Takk. Vi ser på rapporten.')));
    } on ApiException catch (e) {
      widget.messenger.showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: Insets.lg,
        right: Insets.lg,
        top: Insets.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + Insets.lg,
      ),
      // The sheet scrolls: on a small phone with the keyboard up there is not
      // room for four reasons, a note field and a block checkbox.
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.itemId != null
                  ? 'Rapporter denne gjenstanden'
                  : 'Rapporter ${widget.personName ?? 'brukeren'}',
              style: Type.title,
            ),
            const SizedBox(height: Insets.md),
            RadioGroup<String>(
              groupValue: _reason,
              onChanged: (v) => setState(() => _reason = v ?? _reason),
              child: Column(
                children: {
                  'spam': 'Spam',
                  'inappropriate': 'Upassende innhold',
                  'fraud': 'Svindel',
                  'other': 'Annet',
                }
                    .entries
                    .map((e) => RadioListTile<String>(
                          contentPadding: EdgeInsets.zero,
                          value: e.key,
                          activeColor: SwaplyColors.red,
                          title: Text(e.value, style: Type.body),
                        ))
                    .toList(),
              ),
            ),
            TextField(
              controller: _detail,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(hintText: 'Fortell mer (valgfritt)…'),
            ),
            if (widget.personName != null && !widget.alreadyBlocked) ...[
              const SizedBox(height: Insets.sm),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _block,
                activeColor: SwaplyColors.red,
                title: Text('Blokkér ${widget.personName}', style: Type.body),
                subtitle: const Text('Skjuler tingene deres og hindrer fremtidige swaps',
                    style: Type.small),
                onChanged: (v) => setState(() => _block = v ?? false),
              ),
            ],
            const SizedBox(height: Insets.md),
            SizedBox(
              height: 54,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: SwaplyColors.red,
                  shape:
                      RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
                ),
                onPressed: _busy ? null : _send,
                child: const Text('Send rapport',
                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: Insets.sm),
            SecondaryButton('Avbryt', onPressed: () => Navigator.of(context).pop()),
          ],
        ),
      ),
    );
  }
}

const _months = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

String _month(DateTime date) => _months[date.month - 1];
