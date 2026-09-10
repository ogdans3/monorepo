import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// The app is drawn for a phone, 390 across. In a browser on a desk it would
/// otherwise stretch a «Logg inn» button to the width of the window, so past
/// a phone's width it is held at 430 in the middle of the deep green, with
/// the corners of a phone — the same drawing the export makes, at the same
/// size, wherever it is opened. The screens are told the narrower size, so
/// sheets, dialogs and safe areas stay inside it.
class Desk extends StatelessWidget {
  const Desk({super.key, required this.child});

  final Widget child;

  static const width = 430.0;
  static const _phoneUp = 600.0;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < _phoneUp) return child;

          final mq = MediaQuery.of(context);
          final height = (constraints.maxHeight - 48).clamp(480.0, 932.0);
          return ColoredBox(
            color: SwaplyColors.greenDeep,
            child: Center(
              child: Container(
                width: width,
                height: height,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: const [
                    BoxShadow(color: Color(0x40000000), blurRadius: 40, offset: Offset(0, 20)),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: MediaQuery(
                  data: mq.copyWith(
                    size: Size(width, height),
                    padding: EdgeInsets.zero,
                    viewPadding: EdgeInsets.zero,
                  ),
                  child: child,
                ),
              ),
            ),
          );
        },
      );
}
