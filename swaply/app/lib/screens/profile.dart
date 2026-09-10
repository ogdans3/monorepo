import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/share_sheet.dart';
import '../widgets/shell.dart';
import 'item_detail.dart';
import 'liked.dart';
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

    // Looking around has no profile to show, and an empty one drawn as if it
    // were a person's is worse than saying what is going on.
    if (me.anonymous) {
      return SwaplyScaffold(
        currentTab: 4,
        child: EmptyState(
          icon: Icons.person_outline,
          title: 'Du ser deg rundt',
          body: 'Tingene du liker er lagret her på enheten din. Lag en profil når du '
              'vil legge ut noe eller snakke med noen — du beholder alt du har likt.',
          actionLabel: 'Lag profil',
          onAction: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const CreateProfileScreen())),
        ),
      );
    }

    return SwaplyScaffold(
      currentTab: 4,
      // «+ Legg ut» floats at the bottom right, 20 in from the edge and 44
      // above the tab bar, exactly where the export leaves it.
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(right: 4, bottom: 28),
        child: GestureDetector(
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const PostItemScreen())),
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: SwaplyColors.greenPressed,
              borderRadius: BorderRadius.circular(Radii.pill),
            ),
            child: const Center(
              widthFactor: 1,
              child: Text('+ Legg ut',
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ),
      ),
      child: RefreshIndicator(
        onRefresh: () => context.read<Session>().refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 0, 22, Insets.xl),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Only «Innstillinger» up here; the list of notifications is
                // reached from the settings, since the export draws no bell.
                GestureDetector(
                  onTap: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  child: const Padding(
                    padding: EdgeInsets.zero,
                    child: Text('Innstillinger',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700, color: SwaplyColors.greenText)),
                  ),
                ),
              ],
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 84 across, the initial at 32/800.
                Avatar(me.displayName ?? '?', size: 84, mine: true),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: Text(me.displayName ?? 'Uten navn',
                                style: Type.title, overflow: TextOverflow.ellipsis),
                          ),
                          if (me.bankidVerified) ...[
                            const SizedBox(width: 8),
                            // Green words on the name's line, not a badge.
                            const Text('BankID-verifisert',
                                style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                    color: SwaplyColors.greenText)),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(children: [
                          TextSpan(text: '${_stars(me.ratingAvg)} '),
                          if (me.ratingCount == 0)
                            const TextSpan(text: 'Ingen vurderinger ennå')
                          else ...[
                            TextSpan(
                                text: me.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            TextSpan(text: ' · ${me.ratingCount} vurderinger'),
                          ],
                        ]),
                        style: const TextStyle(fontSize: 13, color: SwaplyColors.inkBody),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (me.town != null) me.town!,
                          if (me.memberSince != null) 'medlem siden ${_month(me.memberSince!)}',
                        ].join(' · '),
                        style: Type.secondary,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 11),
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const LikedScreen())),
              child: SectionCard(
                radius: 16,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        me.likedByCount == 0
                            ? '♥ Ingen har likt tingene dine ennå'
                            : '♥ ${me.likedByCount} har likt tingene dine',
                        style: const TextStyle(
                            fontSize: 13.5, fontWeight: FontWeight.w700, color: SwaplyColors.ink),
                      ),
                    ),
                    const Text('Se hvem ›', style: Type.link),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 11),
            const Text('Interesser', style: Type.section),
            const SizedBox(height: 7),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                ...me.interests.map((c) => Pill(categoryLabels[c] ?? c, small: true)),
                if (me.interests.length < 5)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      border: Border.all(color: SwaplyColors.chevron),
                    ),
                    child: const Text('+ fylles ut mens du bruker appen',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
                  ),
              ],
            ),
            const SizedBox(height: 11),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text('Mine gjenstander · ${me.items.length}',
                      style: Type.section, overflow: TextOverflow.ellipsis),
                ),
                GestureDetector(
                  onTap: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                  child: const Text('Rediger profil',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: SwaplyColors.greenText)),
                ),
              ],
            ),
            const SizedBox(height: 11),
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
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  // 166 across, 110 of picture and 36 of caption.
                  childAspectRatio: 166 / 146,
                ),
                itemCount: me.items.length,
                itemBuilder: (context, i) => _ownItem(me.items[i]),
              ),
            const SizedBox(height: 70),
          ],
        ),
      ),
    );
  }

  Widget _ownItem(Item item) {
    final (label, colour) = switch (item.status) {
      'reserved' => ('Reservert', SwaplyColors.amberText),
      'traded' => ('Byttet', SwaplyColors.inkMuted),
      'withdrawn' => ('Trukket', SwaplyColors.inkMuted),
      _ => ('Tilgjengelig', SwaplyColors.greenText),
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
                Positioned.fill(child: ItemThumb(item, size: 400, radius: 16)),
                Positioned(left: 8, top: 8, child: StatePill(label, color: colour)),
              ],
            ),
          ),
          _caption(item),
        ],
      ),
    );
  }
}

/// 13b Annen profil. Their things are the point of the screen: it is where a
/// loop gets closed from the other side.
/// Title and value on one line under a 166-wide picture, as 13 and 13b draw it.
Widget _caption(Item item) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 7, 2, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Text(item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13, height: 1.15, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
          ),
          if (item.estimatedValueNok != null) ...[
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text('Verdi ${kr(item.estimatedValueNok)}',
                  style: const TextStyle(
                      fontSize: 10.5, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
            ),
          ],
        ],
      ),
    );

/// «★★★★★» for 4,6 and up, «★★★★☆» below: the export writes the stars as
/// text and puts the number beside them.
String _stars(double? rating) {
  if (rating == null) return '☆☆☆☆☆';
  final full = rating.round().clamp(0, 5);
  return '★' * full + '☆' * (5 - full);
}

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
      // «‹» and «⋯» and nothing between them: the name is in the body.
      appBar: swaplyAppBar(context, '', actions: [
        headerAction(
            Icons.more_horiz,
            () => showReportSheet(context,
                userId: user.id, personName: user.displayName, alreadyBlocked: user.blockedByYou)),
      ]),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 6, 22, Insets.xl),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Avatar(user.displayName, size: 76),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(user.displayName,
                              style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.4,
                                  color: SwaplyColors.ink),
                              overflow: TextOverflow.ellipsis),
                        ),
                        if (user.bankidVerified) ...[
                          const SizedBox(width: 8),
                          const Text('BankID-verifisert',
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: SwaplyColors.greenText)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${_stars(user.ratingAvg)} '),
                        if (user.ratingAvg != null)
                          TextSpan(
                              text: user.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (user.tradeCount != null)
                          TextSpan(text: ' · ${user.tradeCount} bytter'),
                      ]),
                      style: const TextStyle(fontSize: 13, color: SwaplyColors.inkBody),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (user.town != null) user.town!,
                        if (user.memberSince != null)
                          'medlem siden ${_month(user.memberSince!)}',
                      ].join(' · '),
                      style: Type.secondary,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (user.interests.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: user.interests
                  .map((c) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: SwaplyColors.chip,
                          borderRadius: BorderRadius.circular(Radii.pill),
                        ),
                        child: Text(categoryLabels[c] ?? c,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: SwaplyColors.chipInk)),
                      ))
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          // A 44-tall «Send melding» between the chips and the things.
          SizedBox(
            height: 44,
            child: PrimaryButton('Send melding',
                onPressed: user.items.isEmpty
                    ? null
                    : () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ItemDetailScreen(itemId: user.items.first.id)))),
          ),
          const SizedBox(height: 12),
          Text('${user.displayName.split(' ').first} sine gjenstander · ${user.items.length}',
              style: Type.section),
          const SizedBox(height: 12),
          if (user.items.isEmpty)
            const Text('Ingen ting ute akkurat nå.', style: Type.secondary)
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 166 / 146,
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
                      Expanded(child: ItemThumb(item, size: 400, radius: 16)),
                      _caption(item),
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
      appBar: swaplyAppBar(context, 'Innstillinger', big: true),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
        children: [
          const SizedBox(height: 2),
          const Kicker('Konto'),
          const SizedBox(height: 7),
          _group([
          _tile(context, 'Profil', null,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile(context, 'E-post og telefon', null,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile(
            context,
            'BankID-verifisering',
            me?.bankidVerified == true ? 'Verifisert' : 'Ikke verifisert',
            good: me?.bankidVerified == true,
            onTap: me?.bankidVerified == true
                ? null
                : () => _verifyBankid(context),
          ),
          // Round 5 took the colour off this row: an invitation is an ordinary
          // thing you do, not a promotion.
          _tile(context, 'Inviter en venn', null,
              onTap: () => showShareSheet(context,
                  title: 'Inviter en venn', mint: (api) => api.createInvite())),
          ]),
          const SizedBox(height: 16),
          const Kicker('Varsler'),
          const SizedBox(height: 7),
          _group([
            const _NotificationToggle(label: 'Swaps og bytter'),
            const _NotificationToggle(label: 'Meldinger'),
            const _NotificationToggle(label: 'Likes på tingene mine'),
          ]),
          const SizedBox(height: 16),
          _group([
            _tile(context, 'Juridisk og personvern', null, onTap: () => _showLegal(context)),
            // A red row in the last card, not a button of its own: that is
            // where the export puts it, and it is not something to advertise.
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: const Text('Logg ut',
                  style: TextStyle(
                      fontSize: 14.5, fontWeight: FontWeight.w700, color: SwaplyColors.redText)),
              onTap: () async {
                await context.read<Session>().logout();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()), (r) => false);
                }
              },
            ),
          ]),
          const SizedBox(height: Insets.xl),
        ],
      ),
    );
  }

  /// The export keeps a group of rows inside one card rather than letting them
  /// float on the background with dividers between.
  Widget _group(List<Widget> rows) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: SwaplyColors.cardLine),
        ),
        child: Column(children: rows),
      );

  /// A 48-tall row: the label, a word at the right if there is one
  /// («Verifisert», green), and the chevron.
  Widget _tile(BuildContext context, String title, String? value,
          {VoidCallback? onTap, bool good = false}) =>
      InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 48,
          child: Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w600, color: SwaplyColors.ink)),
              ),
              if (value != null && value.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(value,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: good ? SwaplyColors.greenText : SwaplyColors.grey)),
                ),
              const Icon(Icons.chevron_right, size: 20, color: SwaplyColors.chevron),
            ],
          ),
        ),
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
  // A 58-tall row with the export's own switch: 50×31, green when on, the
  // field-line grey when off, a 23px white thumb.
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _on = !_on),
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              Expanded(
                child: Text(widget.label,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w600, color: SwaplyColors.ink)),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 50,
                height: 31,
                padding: const EdgeInsets.all(4),
                alignment: _on ? Alignment.centerRight : Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: _on ? SwaplyColors.greenPressed : SwaplyColors.fieldLine,
                  borderRadius: BorderRadius.circular(Radii.pill),
                ),
                child: Container(
                  width: 23,
                  height: 23,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                ),
              ),
            ],
          ),
        ),
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
