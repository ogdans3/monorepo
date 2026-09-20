import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// What the app says in passing: a refusal, something that landed, something
/// worth knowing.
///
/// It used to be a bare `SnackBar` — a black rectangle with square corners,
/// glued to the bottom edge across the button that had just been pressed,
/// carrying whatever string came back. Nothing else in the product looks like
/// that. This is a card in the palette the rest of the app is drawn in: a
/// hairline, a round corner, a soft shadow, and a coloured mark that says which
/// of the three this is before a word of it is read.
enum ToastTone {
  /// A refusal, and anything that did not happen. Coral, which is the «no»
  /// colour — never [SwaplyColors.red], which belongs to report and block and
  /// must not come to mean «error» as well.
  error,

  /// It happened. Green.
  done,

  /// Neither: a link copied, a number on the clipboard, a state explained.
  note,
}

class _Marks {
  const _Marks(this.icon, this.accent, this.fill, this.edge, this.seconds);
  final IconData icon;
  final Color accent, fill, edge;
  final int seconds;
}

const _marks = <ToastTone, _Marks>{
  // Five seconds rather than three: a refusal is the one of these worth
  // reading twice, and it is usually the longest sentence.
  ToastTone.error: _Marks(
      Icons.error_outline, SwaplyColors.coral, Color(0xFFFFF0EE), SwaplyColors.declineLine, 5),
  ToastTone.done: _Marks(
      Icons.check_rounded, SwaplyColors.greenPressed, SwaplyColors.greenSoft, SwaplyColors.line, 3),
  ToastTone.note: _Marks(
      Icons.info_outline, SwaplyColors.inkBody, SwaplyColors.chip, SwaplyColors.cardLine, 3),
};

/// The card itself, pulled out so a widget test can find it by type.
class SwaplyToast extends StatelessWidget {
  const SwaplyToast(this.message, {super.key, this.tone = ToastTone.note});

  final String message;
  final ToastTone tone;

  @override
  Widget build(BuildContext context) {
    final marks = _marks[tone]!;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 11, 14, 11),
      decoration: BoxDecoration(
        color: Colors.white,
        // 18, which is the radius of every card in the export.
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: marks.edge),
        // The one shadow in the app: nothing else here casts one, and a toast
        // is the only thing that lies on top of a screen rather than in it.
        // Pulled in by a negative spread and barely offset — a wide, dropped
        // shadow under a card this wide draws a grey band under the whole
        // width instead of lifting it.
        boxShadow: const [
          BoxShadow(
              color: Color(0x22064E3B), blurRadius: 18, spreadRadius: -6, offset: Offset(0, 4)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 26,
            width: 26,
            decoration: BoxDecoration(color: marks.fill, shape: BoxShape.circle),
            child: Icon(marks.icon, size: 15, color: marks.accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.35,
                  fontWeight: FontWeight.w600,
                  color: SwaplyColors.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown through the messenger rather than an overlay of our own, so a swipe
/// dismisses it and a screen that leaves takes its toast with it.
void showToastOn(ScaffoldMessengerState? messenger, ToastTone tone, String message) {
  if (messenger == null) return;
  // Replace rather than queue: two refusals in a row means the second one is
  // the one you are waiting for.
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: SwaplyToast(message, tone: tone),
      duration: Duration(seconds: _marks[tone]!.seconds),
      backgroundColor: Colors.transparent,
      elevation: 0,
      padding: EdgeInsets.zero,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      dismissDirection: DismissDirection.horizontal,
    ));
}

/// An [ApiException] already carries Norwegian a person can read, so the
/// message is the whole of it; anything else is stringified the same way.
void showError(BuildContext context, Object error) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.error, '$error');

void showDone(BuildContext context, String message) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.done, message);

void showNote(BuildContext context, String message) =>
    showToastOn(ScaffoldMessenger.maybeOf(context), ToastTone.note, message);

// The same three for a caller that took the messenger before an await: a sheet
// that pops itself has no context left to look one up with.
void showErrorOn(ScaffoldMessengerState messenger, Object error) =>
    showToastOn(messenger, ToastTone.error, '$error');

void showDoneOn(ScaffoldMessengerState messenger, String message) =>
    showToastOn(messenger, ToastTone.done, message);

void showNoteOn(ScaffoldMessengerState messenger, String message) =>
    showToastOn(messenger, ToastTone.note, message);
