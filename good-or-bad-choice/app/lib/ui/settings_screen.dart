import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../main.dart';
import '../state/app_state.dart';

/// The account, and the one setting there is.
///
/// Nothing here is needed to use the product. Somebody can tap for a year and
/// never open this screen, which is why it is behind a 48dp button in a corner
/// rather than in front of the first tap.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _registering = false;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final state = AppScope.read(context);
    setState(() => _busy = true);
    final ok = _registering
        ? await state.register(_username.text, _password.text)
        : await state.signIn(_username.text, _password.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _password.clear();
      FocusScope.of(context).unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final palette = PaletteScope.of(context);

    final message = state.message;
    if (message != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(message)));
        state.clearMessage();
      });
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: palette.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'settings',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: palette.ink),
        ),
        iconTheme: IconThemeData(color: palette.ink),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            _Section(
              title: 'keeping it',
              child: state.isSignedIn
                  ? _SignedIn(state: state)
                  : _SignInForm(
                      username: _username,
                      password: _password,
                      registering: _registering,
                      busy: _busy,
                      onSubmit: _submit,
                      onSwap: () => setState(() => _registering = !_registering),
                    ),
            ),
            const SizedBox(height: 28),
            _Section(
              title: 'colours',
              child: SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: state.colourBlind,
                onChanged: state.setColourBlind,
                activeTrackColor: palette.good,
                title: Text(
                  'blue and orange',
                  style: TextStyle(fontSize: 15, color: palette.ink),
                ),
                subtitle: Text(
                  'Swaps green and red for a pair that stays apart with red-green colour blindness.',
                  style: TextStyle(fontSize: 13, color: palette.inkMuted),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Every tap is on this device whether you sign in or not. '
              'An account is a second home for the same taps, so they survive a lost phone '
              'and show up on another one.',
              style: TextStyle(fontSize: 13, height: 1.5, color: palette.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: palette.inkMuted),
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _SignInForm extends StatelessWidget {
  const _SignInForm({
    required this.username,
    required this.password,
    required this.registering,
    required this.busy,
    required this.onSubmit,
    required this.onSwap,
  });

  final TextEditingController username;
  final TextEditingController password;
  final bool registering;
  final bool busy;
  final VoidCallback onSubmit;
  final VoidCallback onSwap;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: username,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: TextInputAction.next,
          decoration: _field('name', palette),
          style: TextStyle(color: palette.ink),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: password,
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => onSubmit(),
          decoration: _field(registering ? 'password, eight or more' : 'password', palette),
          style: TextStyle(color: palette.ink),
        ),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: busy ? null : onSubmit,
          style: FilledButton.styleFrom(
            backgroundColor: palette.good,
            foregroundColor: palette.onColour,
            minimumSize: const Size.fromHeight(48),
          ),
          child: Text(busy ? '…' : (registering ? 'make an account' : 'sign in')),
        ),
        TextButton(
          onPressed: busy ? null : onSwap,
          child: Text(
            registering ? 'I already have one' : 'I need an account',
            style: TextStyle(color: palette.inkMuted),
          ),
        ),
      ],
    );
  }

  InputDecoration _field(String hint, Palette palette) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: palette.inkMuted),
    filled: true,
    fillColor: palette.surface,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );
}

class _SignedIn extends StatelessWidget {
  const _SignedIn({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final palette = PaletteScope.of(context);
    final unsynced = state.unsynced;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.username ?? '',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: palette.ink,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      state.isSyncing
                          ? 'sending…'
                          : unsynced == 0
                              ? 'everything is backed up'
                              : '$unsynced still to send',
                      style: TextStyle(fontSize: 13, color: palette.inkMuted),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => state.sync(),
                child: Text('sync now', style: TextStyle(color: palette.ink)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => state.signOut(),
          style: OutlinedButton.styleFrom(
            foregroundColor: palette.ink,
            side: BorderSide(color: palette.line),
            minimumSize: const Size.fromHeight(46),
          ),
          child: const Text('sign out'),
        ),
        const SizedBox(height: 6),
        TextButton(
          onPressed: () => _confirmDelete(context),
          child: Text('delete the account', style: TextStyle(color: palette.bad)),
        ),
      ],
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final palette = PaletteScope.of(context);
    final go = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: palette.bg,
        title: Text('Delete the account?', style: TextStyle(color: palette.ink)),
        // Spelled out rather than shouted in red. The button that does it looks
        // like every other button; the sentence is what makes it clear.
        content: Text(
          'The copy on the server goes, and so does the account. '
          'The taps on this device stay exactly where they are.',
          style: TextStyle(color: palette.inkMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text('keep it', style: TextStyle(color: palette.inkMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('delete', style: TextStyle(color: palette.ink)),
          ),
        ],
      ),
    );
    if (go == true) await state.deleteAccount();
  }
}
