import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import 'common.dart';

/// 04 «Del» and 16b «Inviter en venn» — the same sheet, because they are the
/// same thing. A link to a listing carries an invitation with it, or it lands
/// with somebody who has no way in and the share button is worth nothing.
///
/// Drawn rather than handed to the system share sheet: the export puts «Kopier
/// lenke» at the top of it, that row is the whole of what we can promise on
/// every platform, and the web build has no system sheet at all.
///
/// A link is an invitation from somebody, so the server makes one only for a
/// profile, and a device looking around was shown why in words with nothing
/// to press. [makeProfile] is the way on from there — 10c, as writing a
/// message is — and says whether there is a profile now; with one, the sheet
/// comes back for the link that was asked for.
Future<void> showShareSheet(
  BuildContext context, {
  required String title,
  required Future<ShareLink> Function(SwaplyApi api) mint,
  Future<bool> Function()? makeProfile,
}) async {
  final toProfile = await showModalBottomSheet<bool>(
    context: context,
    // Over the bar, not inside the tab under it; see `pushOverBar`.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (_) => _ShareSheet(
      title: title,
      mint: mint,
      api: context.read<SwaplyApi>(),
      messenger: ScaffoldMessenger.of(context),
      canMakeProfile: makeProfile != null,
    ),
  );
  if (toProfile != true || makeProfile == null) return;
  if (!await makeProfile() || !context.mounted) return;
  await showShareSheet(context, title: title, mint: mint, makeProfile: makeProfile);
}

/// The sheet mints the link itself and holds it. Passing one in from the caller
/// would mean asking the server for a link every time the button is drawn.
class _ShareSheet extends StatefulWidget {
  const _ShareSheet({
    required this.title,
    required this.mint,
    required this.api,
    required this.messenger,
    required this.canMakeProfile,
  });

  final String title;
  final Future<ShareLink> Function(SwaplyApi api) mint;
  final SwaplyApi api;
  final ScaffoldMessengerState messenger;

  /// Whether «Lag profil» is offered when the link is refused for want of a
  /// profile; see [showShareSheet].
  final bool canMakeProfile;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  ShareLink? _link;
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    _mint();
  }

  Future<void> _mint() async {
    try {
      final link = await widget.mint(widget.api);
      if (mounted) setState(() => _link = link);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// No answer is not a no, and the link may well come the next time.
  void _again() {
    setState(() => _error = null);
    _mint();
  }

  /// The way on from a refusal, where there is one: a profile to make, or
  /// the same asking again. Any other refusal is the server's last word on
  /// it, and is only said.
  Widget? _wayOn(ApiException error) {
    if (error.code == 'account_required' && widget.canMakeProfile) {
      return PrimaryButton('Lag profil', onPressed: () => Navigator.of(context).pop(true));
    }
    if (error.isNoContact) return PrimaryButton('Prøv igjen', onPressed: _again);
    return null;
  }

  Future<void> _copy() async {
    final link = _link;
    if (link == null) return;
    await Clipboard.setData(ClipboardData(text: link.text));
    if (!mounted) return;
    Navigator.of(context).pop();
    showDoneOn(widget.messenger, 'Lenken er kopiert. Nå kan du lime den inn hvor du vil.');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          Insets.screen, Insets.md, Insets.screen, MediaQuery.of(context).padding.bottom + Insets.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              height: 4,
              width: 44,
              decoration: BoxDecoration(
                  color: SwaplyColors.line, borderRadius: BorderRadius.circular(Radii.pill)),
            ),
          ),
          const SizedBox(height: Insets.lg),
          Text(widget.title, style: Type.title),
          const SizedBox(height: Insets.md),
          if (_error case final error?) ...[
            Text(error.message, style: const TextStyle(color: SwaplyColors.coral, fontSize: 13.5)),
            if (_wayOn(error) case final way?) ...[
              const SizedBox(height: Insets.md),
              way,
            ],
          ] else if (_link == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: Insets.xl),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
            )
          else ...[
            // The card is where the text can be selected, not only the
            // words: two lines of it in a 42-tall box are not a target.
            TapArea(
              child: SectionCard(
                child: SelectableText(_link!.text, style: Type.body),
              ),
            ),
            const SizedBox(height: Insets.md),
            PrimaryButton('Kopier lenke', icon: Icons.link, onPressed: _copy),
            const SizedBox(height: Insets.md),
            const Text(
              'Lenken er også en invitasjon, og kan brukes én gang. Siden den åpner '
              'fungerer for alle du sender den til.',
              style: Type.secondary,
            ),
          ],
        ],
      ),
    );
  }
}
