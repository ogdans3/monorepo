import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import 'discover.dart';

/// 01 Splash. Deep green, the wordmark, nothing else.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: SwaplyColors.greenDeep,
        body: Center(
          child: Text('swaply',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.4)),
        ),
      );
}

/// The screen a link opens: somebody was handed a key, and this is the door.
///
/// Two ways in, and the order is the product's: looking around costs nothing
/// and needs no account, and 10c waits until there is a reason for it.
class InviteScreen extends StatefulWidget {
  const InviteScreen({super.key, required this.token});

  final String token;

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  InvitePreview? _invite;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final invite = await context.read<SwaplyApi>().invite(widget.token);
      if (!mounted) return;
      setState(() => _invite = invite);
      // A spent invitation is not ours to hold on to. Letting it sit in the
      // session would only turn every later attempt into the same refusal.
      if (invite.used) context.read<Session>().pendingInvite = null;
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _lookAround() async {
    setState(() => _busy = true);
    try {
      final session = context.read<Session>();
      await session.lookAround();
      if (!mounted) return;
      // 02 first, the same as any new account gets: Oppdag is one row per
      // interest, so arriving there with none chosen is an empty screen. It is
      // skippable, as the export draws it.
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
              builder: (_) =>
                  session.interestsPending ? const InterestsScreen() : const DiscoverScreen()),
          (r) => false);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invite = _invite;
    final inviter = invite?.inviterName;

    return Scaffold(
      backgroundColor: SwaplyColors.greenDeep,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              Insets.screen, Insets.xl * 2, Insets.screen, Insets.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('swaply',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.1)),
              const SizedBox(height: Insets.xl * 1.5),
              Text(
                inviter == null
                    ? 'Du er invitert til Swaply.'
                    : '$inviter inviterer deg til Swaply.',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    height: 1.15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.8),
              ),
              const SizedBox(height: Insets.md),
              const Text(
                'Si hva du vil ha. Når ønskene lukker en sirkel, bytter dere.',
                style: TextStyle(color: Color(0xB8FFFFFF), fontSize: 15, height: 1.45),
              ),
              if (invite?.itemTitle != null) ...[
                const SizedBox(height: Insets.lg),
                Container(
                  padding: const EdgeInsets.all(Insets.md),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(Radii.card),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.favorite, color: SwaplyColors.green, size: 18),
                      const SizedBox(width: Insets.sm),
                      Expanded(
                        child: Text('Delt med deg: ${invite!.itemTitle}',
                            style: const TextStyle(color: Colors.white, fontSize: 14.5)),
                      ),
                    ],
                  ),
                ),
              ],
              if (invite?.used == true) ...[
                const SizedBox(height: Insets.lg),
                Text(
                  inviter == null
                      ? 'Invitasjonen er allerede brukt. Be om en ny lenke.'
                      : 'Invitasjonen er allerede brukt. Be $inviter om en ny lenke.',
                  style: const TextStyle(color: SwaplyColors.coral, fontSize: 14),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: Insets.lg),
                Text(_error!, style: const TextStyle(color: SwaplyColors.coral, fontSize: 14)),
              ],
              const SizedBox(height: Insets.xl),
              PrimaryButton('Se deg rundt', busy: _busy, onPressed: _lookAround),
              const SizedBox(height: Insets.sm),
              SizedBox(
                height: 52,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CreateProfileScreen())),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0x55FFFFFF)),
                    shape:
                        RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
                  ),
                  child: const Text('Lag profil med en gang',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: Insets.sm),
              TextButton(
                onPressed: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('Jeg har konto fra før',
                    style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 16c Logg inn. E-mail and a password, with the three social buttons the
/// export draws beside them.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Session>().login(_email.text.trim(), _password.text);
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const DiscoverScreen()), (r) => false);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.code == 'unauthorized'
          ? 'Feil e-post eller passord.'
          : e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              Insets.screen, Insets.xl * 2, Insets.screen, Insets.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(
                child: Text('swaply',
                    style: TextStyle(
                        color: SwaplyColors.greenDeep,
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.2)),
              ),
              const SizedBox(height: Insets.xl * 1.5),
              const Text('E-post', style: Type.small),
              const SizedBox(height: 6),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(hintText: 'ola@epost.no'),
              ),
              const SizedBox(height: Insets.md),
              const Text('Passord', style: Type.small),
              const SizedBox(height: 6),
              TextField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(hintText: '••••••••'),
                onSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (_) => const _ComingSoonDialog(
                        title: 'Glemt passord?',
                        body: 'Vi sender deg en lenke på e-post så snart utsendingen er på plass.'),
                  ),
                  child: const Text('Glemt passord?',
                      style: TextStyle(color: SwaplyColors.greenPressed)),
                ),
              ),
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: SwaplyColors.red, fontSize: 13)),
                const SizedBox(height: Insets.sm),
              ],
              PrimaryButton('Logg inn', busy: _busy, onPressed: _submit),
              const SizedBox(height: Insets.lg),
              const _OrDivider(),
              const SizedBox(height: Insets.md),
              const _SocialButtons(),
              const SizedBox(height: Insets.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Ny her?', style: Type.secondary),
                  TextButton(
                    onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CreateProfileScreen())),
                    child: const Text('Opprett konto',
                        style: TextStyle(
                            color: SwaplyColors.greenPressed, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) => const Row(
        children: [
          Expanded(child: Divider(color: SwaplyColors.line)),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: Insets.md),
            child: Text('eller', style: Type.small),
          ),
          Expanded(child: Divider(color: SwaplyColors.line)),
        ],
      );
}

/// The export draws Google, Facebook and Apple. They need provider credentials
/// and a registered bundle id, neither of which exists yet, so they say so
/// rather than failing silently or pretending to work.
class _SocialButtons extends StatelessWidget {
  const _SocialButtons();

  @override
  Widget build(BuildContext context) {
    Widget button(String label, IconData icon) => Padding(
          padding: const EdgeInsets.only(bottom: Insets.sm),
          child: SizedBox(
            height: 50,
            child: OutlinedButton.icon(
              icon: Icon(icon, size: 18, color: SwaplyColors.ink),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => _ComingSoonDialog(
                  title: label,
                  body: 'Innlogging med $label krever en avtale med leverandøren, '
                      'og den er ikke på plass ennå. Bruk e-post og passord så lenge.',
                ),
              ),
              label: Text(label,
                  style: const TextStyle(
                      color: SwaplyColors.ink, fontSize: 14.5, fontWeight: FontWeight.w600)),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                side: const BorderSide(color: Color(0x22064E3B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
              ),
            ),
          ),
        );

    return Column(
      children: [
        button('Fortsett med Google', Icons.g_mobiledata),
        button('Fortsett med Facebook', Icons.facebook),
        button('Fortsett med Apple', Icons.apple),
      ],
    );
  }
}

class _ComingSoonDialog extends StatelessWidget {
  const _ComingSoonDialog({required this.title, required this.body});
  final String title, body;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(title, style: Type.heading),
        content: Text(body, style: Type.body),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(), child: const Text('Greit')),
        ],
      );
}

/// 10c Lag profil. Reached from the listing flow, which is why the button says
/// «Lag profil og legg ut».
class CreateProfileScreen extends StatefulWidget {
  const CreateProfileScreen({super.key, this.continuingToListing = false});

  final bool continuingToListing;

  @override
  State<CreateProfileScreen> createState() => _CreateProfileScreenState();
}

class _CreateProfileScreenState extends State<CreateProfileScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Session>().register(
            displayName: _name.text.trim(),
            email: _email.text.trim(),
            phone: _phone.text.trim(),
            password: _password.text,
          );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const InterestsScreen()), (r) => false);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: SwaplyColors.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, size: 30, color: SwaplyColors.ink),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        titleSpacing: 0,
        title: const Text('Lag profil', style: Type.heading),
        actions: [
          if (widget.continuingToListing)
            const Padding(
              padding: EdgeInsets.only(right: Insets.screen),
              child: Center(child: Text('2/2', style: Type.small)),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(Insets.screen, 0, Insets.screen, Insets.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                context.watch<Session>().anonymous
                    // Nobody starts over. The account this device has been using
                    // is the one that gets a name, and the wishes come with it.
                    ? 'Profilen legges på kontoen du allerede ser deg rundt med, så alt '
                        'du har likt blir med videre.'
                    : 'For å legge ut noe trenger du en profil, så folk vet hvem de '
                        'bytter med.',
                style: Type.secondary,
              ),
              const SizedBox(height: Insets.lg),
              _field('Visningsnavn', _name, 'Ola N.'),
              _field('E-post', _email, 'ola@epost.no',
                  keyboard: TextInputType.emailAddress),
              _field('Telefonnummer', _phone, '412 34 567', keyboard: TextInputType.phone),
              _field('Passord', _password, 'Velg et passord', obscure: true),
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: SwaplyColors.red, fontSize: 13)),
                const SizedBox(height: Insets.sm),
              ],
              PrimaryButton(
                widget.continuingToListing ? 'Lag profil og legg ut' : 'Lag profil',
                busy: _busy,
                onPressed: _submit,
              ),
              const SizedBox(height: Insets.lg),
              const _OrDivider(),
              const SizedBox(height: Insets.md),
              const _SocialButtons(),
              const SizedBox(height: Insets.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Har du konto?', style: Type.secondary),
                  TextButton(
                    onPressed: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const LoginScreen())),
                    child: const Text('Logg inn',
                        style: TextStyle(
                            color: SwaplyColors.greenPressed, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: Insets.sm),
              const Text(
                'Vi varsler deg om swaps, aldri spam. BankID bekreftes ved ditt første bytte.',
                style: Type.small,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController controller, String hint,
      {TextInputType? keyboard, bool obscure = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Type.small),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            keyboardType: keyboard,
            obscureText: obscure,
            decoration: InputDecoration(hintText: hint),
          ),
        ],
      ),
    );
  }
}

/// 02 Interesser. Three to five, and the counter says which.
class InterestsScreen extends StatefulWidget {
  const InterestsScreen({super.key});

  @override
  State<InterestsScreen> createState() => _InterestsScreenState();
}

class _InterestsScreenState extends State<InterestsScreen> {
  final _chosen = <String>{};
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _chosen.addAll(context.read<Session>().me?.interests ?? const []);
  }

  Future<void> _continue() async {
    setState(() => _busy = true);
    try {
      await context.read<Session>().setInterests(_chosen.toList());
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const DiscoverScreen()), (r) => false);
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final full = _chosen.length >= 5;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {
                  context.read<Session>().dismissInterests();
                  Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const DiscoverScreen()), (r) => false);
                },
                child: const Text('Hopp over', style: TextStyle(color: SwaplyColors.greySoft)),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Hva er du\ninteressert i?',
                        style: TextStyle(
                            fontSize: 28,
                            height: 1.15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            color: SwaplyColors.greenDeep)),
                    const SizedBox(height: Insets.sm),
                    const Text(
                      'Velg 3 til 5 kategorier, så viser vi deg de riktige tingene først.',
                      style: TextStyle(fontSize: 14, height: 1.45, color: Color(0xFF5B6862)),
                    ),
                    const SizedBox(height: Insets.lg),
                    // Two columns of wide, soft-cornered tiles — the export
                    // gives this screen room rather than a hedge of small pills.
                    // Selected is a green-soft fill with a green edge and a ✓;
                    // it never fills solid, which would make twelve choices
                    // look like twelve buttons.
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: Insets.sm + 2,
                      crossAxisSpacing: Insets.sm + 2,
                      childAspectRatio: 2.55,
                      children: categoryLabels.entries.map((entry) {
                        final selected = _chosen.contains(entry.key);
                        // At five the rest go quiet rather than shouting an
                        // error when they are tapped.
                        final locked = full && !selected;
                        return GestureDetector(
                          onTap: locked
                              ? null
                              : () => setState(() => selected
                                  ? _chosen.remove(entry.key)
                                  : _chosen.add(entry.key)),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 160),
                            curve: Curves.easeOut,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: selected ? SwaplyColors.greenSoft : Colors.white,
                              borderRadius: BorderRadius.circular(Radii.card),
                              border: Border.all(
                                  color: selected
                                      ? SwaplyColors.greenPressed
                                      : SwaplyColors.cardLine),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(entry.value,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: selected
                                          ? SwaplyColors.greenDeep
                                          : locked
                                              ? SwaplyColors.greyLight
                                              : SwaplyColors.inkBody,
                                    )),
                                if (selected) ...[
                                  const SizedBox(width: 6),
                                  const Text('✓',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: SwaplyColors.greenText)),
                                ],
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Insets.screen),
              child: Column(
                children: [
                  Text(
                    full
                        ? 'Fem er nok. Du kan endre dette senere.'
                        : '${_chosen.length} av 5 valgt',
                    style: Type.small,
                  ),
                  const SizedBox(height: Insets.sm),
                  PrimaryButton('Fortsett',
                      enabled: _chosen.length >= 3, busy: _busy, onPressed: _continue),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
