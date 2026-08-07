import 'package:flutter/material.dart';

import '../../design/theme.dart';
import '../../design/tokens.dart';

/// The add-an-item bar, pinned to the bottom of the list.
///
/// Not a modal and not a floating button: adding items is the second-most
/// common thing anyone does here, and it usually happens five times in a row.
/// Submitting keeps the keyboard up and the focus in the field.
class Composer extends StatefulWidget {
  const Composer({required this.onSubmit, this.enabled = true, super.key});

  final void Function(String text) onSubmit;
  final bool enabled;

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final has = _controller.text.trim().isNotEmpty;
      if (has != _hasText) setState(() => _hasText = has);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty || !widget.enabled) return;
    widget.onSubmit(text);
    _controller.clear();
    // Straight back to an empty field, still focused: type, enter, type.
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final text = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        color: colors.bg,
        border: Border(top: BorderSide(color: colors.line)),
        boxShadow: [
          BoxShadow(
            color: colors.ink.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            Space.gutter,
            Space.sm,
            Space.sm,
            Space.sm,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
                  textInputAction: TextInputAction.done,
                  textCapitalization: TextCapitalization.sentences,
                  keyboardType: TextInputType.text,
                  maxLines: 4,
                  minLines: 1,
                  maxLength: 500,
                  buildCounter:
                      (
                        _, {
                        required currentLength,
                        required isFocused,
                        maxLength,
                      }) => null,
                  onSubmitted: (_) => _submit(),
                  style: text.bodyLarge,
                  decoration: InputDecoration(
                    hintText: 'Add something',
                    hintStyle: text.bodyLarge?.copyWith(color: colors.inkMuted),
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: Space.md + 2,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: Space.sm),
              _AddButton(enabled: _hasText && widget.enabled, onTap: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = CheckpostTheme.of(context);
    final instant = MediaQuery.disableAnimationsOf(context);

    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Add item',
      child: InkResponse(
        onTap: enabled ? onTap : null,
        radius: 26,
        child: AnimatedContainer(
          duration: instant ? Duration.zero : Motion.fast,
          curve: Motion.curve,
          width: Space.minTarget,
          height: Space.minTarget,
          decoration: BoxDecoration(
            // Disabled is a full-strength shape at low contrast, not a washed
            // out accent. Heavy colour on an inactive control is a lie.
            color: enabled ? colors.primary : colors.surface,
            borderRadius: Radii.mdAll,
          ),
          child: Icon(
            Icons.arrow_upward_rounded,
            size: 22,
            color: enabled ? colors.onPrimary : colors.inkFaint,
          ),
        ),
      ),
    );
  }
}
