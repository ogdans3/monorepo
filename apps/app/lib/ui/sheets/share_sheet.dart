import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';
import 'confirm_sheet.dart';
import 'sheet_scaffold.dart';

/// The link is the product, so this is a first-class screen rather than a
/// setting buried three taps down: the QR to hold across a table, the URL to
/// paste into a thread, and the one control that makes link-only sharing safe.
class ShareSheet extends StatefulWidget {
  const ShareSheet({
    required this.url,
    required this.listTitle,
    required this.onRotate,
    super.key,
  });

  final String url;
  final String listTitle;

  /// Mints a new link and returns its URL. Everyone on the old one is cut off.
  final Future<String> Function() onRotate;

  @override
  State<ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<ShareSheet> {
  late String _url = widget.url;
  bool _rotating = false;
  String? _status;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _url));
    if (!mounted) return;
    setState(() => _status = 'Link copied.');
  }

  Future<void> _share() async {
    final box = context.findRenderObject() as RenderBox?;
    await SharePlus.instance.share(
      ShareParams(
        uri: Uri.parse(_url),
        subject: widget.listTitle,
        // iPad needs an anchor or the share sheet has nowhere to come from.
        sharePositionOrigin: box == null
            ? null
            : box.localToGlobal(Offset.zero) & box.size,
      ),
    );
  }

  Future<void> _rotate() async {
    final confirmed = await confirmSheet(
      context,
      title: 'Replace this link?',
      consequence:
          'The current link stops working immediately. Anyone still using it — '
          'including your own other devices — is told the link was replaced and '
          'has to be sent the new one. There is no undo.',
      confirmLabel: 'Replace the link',
    );
    if (!confirmed || !mounted) return;

    setState(() {
      _rotating = true;
      _status = null;
    });
    try {
      final next = await widget.onRotate();
      if (!mounted) return;
      setState(() {
        _url = next;
        _status = 'Link replaced. The old one no longer works.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _status = 'Could not replace the link. Try again.');
    } finally {
      if (mounted) setState(() => _rotating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return SheetScaffold(
      title: 'Share this list',
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          Space.gutter,
          0,
          Space.gutter,
          Space.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Anyone with this link can read and edit the list. There is no '
              'sign-up — the link is the key.',
              style: text.bodyLarge?.copyWith(color: colors.inkMuted),
            ),
            const SizedBox(height: Space.xl),
            Center(
              child: Container(
                padding: const EdgeInsets.all(Space.lg),
                decoration: BoxDecoration(
                  color: colors.primaryQuiet,
                  borderRadius: Radii.lgAll,
                ),
                // A QR code is invisible to a screen reader, so it carries the
                // URL as its label rather than the word "QR code".
                child: Semantics(
                  label: 'QR code for $_url',
                  image: true,
                  child: QrImageView(
                    data: _url,
                    version: QrVersions.auto,
                    size: 208,
                    padding: EdgeInsets.zero,
                    backgroundColor: Colors.transparent,
                    eyeStyle: QrEyeStyle(
                      eyeShape: QrEyeShape.square,
                      color: colors.ink,
                    ),
                    dataModuleStyle: QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: colors.ink,
                    ),
                    // Never silently render a broken code.
                    errorStateBuilder: (context, _) => SizedBox(
                      width: 208,
                      height: 208,
                      child: Center(
                        child: Text(
                          'Could not draw the QR code — use the link below.',
                          textAlign: TextAlign.center,
                          style: text.bodySmall,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: Space.xl),
            Container(
              padding: const EdgeInsets.all(Space.lg),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: Radii.mdAll,
              ),
              child: SelectableText(
                _url,
                // The one place monospace appears: a token you might read
                // aloud or check character by character. 'monospace' resolves
                // on Android; the fallbacks cover iOS and macOS.
                style: text.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  fontFamilyFallback: const ['Menlo', 'Courier New', 'Courier'],
                  color: colors.ink,
                  height: 1.55,
                ),
              ),
            ),
            const SizedBox(height: Space.lg),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _share,
                    child: const Text('Send link'),
                  ),
                ),
                const SizedBox(width: Space.md),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _copy,
                    child: const Text('Copy'),
                  ),
                ),
              ],
            ),
            if (_status != null) ...[
              const SizedBox(height: Space.md),
              Text(
                _status!,
                style: text.bodySmall?.copyWith(color: colors.ink),
              ),
            ],
            const SizedBox(height: Space.xxl),
            Divider(color: colors.line),
            const SizedBox(height: Space.lg),
            Text('If it ended up somewhere it shouldn’t', style: text.labelLarge),
            const SizedBox(height: Space.xs + 2),
            Text(
              'Replace the link and the old one stops working for everyone, at '
              'once. You then send the new link to the people you meant.',
              style: text.bodySmall?.copyWith(color: colors.inkMuted),
            ),
            const SizedBox(height: Space.md),
            OutlinedButton(
              onPressed: _rotating ? null : _rotate,
              child: _rotating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Replace link'),
            ),
          ],
        ),
      ),
    );
  }
}
