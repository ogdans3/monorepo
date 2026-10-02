import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../widgets/common.dart';

/// The byttevilkår, and the version a yes is recorded against. 06c shows
/// them in full above its swipe; a counter-offer is a yes too — whoever
/// proposes a version has agreed to it, as 09e draws them «✓ Har godtatt» —
/// so 09a and the proposals from the chat say so and link here. Change the
/// version with the terms, and with `TERMS_VERSION` on the server.
const termsVersion = '2026-09-06';

/// The terms as one person agrees to them, [other] being whoever they trade
/// with, by first name.
List<String> tradeTerms(String other) => [
  'Jeg leverer eller sender tingene mine innen 7 dager etter at begge har godtatt',
  'Tingene mine er som beskrevet i annonsen',
  'Mellomlegg betales når begge har godtatt, før noe sendes',
  'Trekker jeg meg etterpå, må $other si ja først. Er noe sendt, kan jeg ikke trekke meg',
];

/// «Byttevilkår», whole, over whatever screen asked.
Future<void> showTradeTerms(BuildContext context, {required String other}) => showDialog<void>(
  context: context,
  builder: (dialog) => AlertDialog(
    title: const Text('Byttevilkår', style: Type.heading),
    content: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Versjon $termsVersion', style: Type.small),
          const SizedBox(height: Insets.sm),
          ...tradeTerms(other).map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: Insets.sm),
              child: Text('• $t', style: Type.body),
            ),
          ),
          const Text(
            'Swaply er ikke part i byttet og fasiliterer ikke frakt eller '
            'betaling. Avtalen er mellom dere.',
            style: Type.body,
          ),
        ],
      ),
    ),
    actions: [TextButton(onPressed: () => Navigator.of(dialog).pop(), child: const Text('Lukk'))],
  ),
);

/// The line over a button that sends a proposal: sending it is agreeing to it.
/// Without it a person would hold their own things for a deal by pressing
/// «Send motbytte», and never be told. The whole line opens the terms — a word
/// linked inside a sentence is a target no finger can be sure of.
class AgreesBySending extends StatelessWidget {
  const AgreesBySending({super.key, required this.other});

  /// Whoever the proposal goes to, by first name, for the terms' last line.
  final String other;

  @override
  Widget build(BuildContext context) => KeepClear(
    // An action, wherever it stands: a toast rising over the button under
    // it rises over this too, as it does over the button.
    child: TapArea(
      // 17 of text and 13.5 over and under it: a finger's 44, in its own
      // box, so it reaches into neither the list above nor the button under.
      room: const EdgeInsets.symmetric(vertical: 13.5),
      onTap: () => showTradeTerms(context, other: other),
      child: const Text.rich(
        TextSpan(
          children: [
            TextSpan(text: 'Når du sender forslaget, har du godtatt det og '),
            TextSpan(
              text: 'byttevilkårene',
              style: TextStyle(fontWeight: FontWeight.w700, color: SwaplyColors.greenText),
            ),
            TextSpan(text: '.'),
          ],
        ),
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 12, height: 1.4, color: SwaplyColors.grey),
      ),
    ),
  );
}
