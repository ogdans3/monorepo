import 'package:flutter/material.dart';

import 'design/tokens.dart';

void main() => runApp(const SwaplyApp());

class SwaplyApp extends StatelessWidget {
  const SwaplyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Swaply',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: SwaplyColors.greenDeep,
          primary: SwaplyColors.green,
        ),
        scaffoldBackgroundColor: SwaplyColors.bg,
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

/// Placeholder. The first real screen is the interest picker, which is where a
/// first run starts now that the onboarding slides are gone.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Swaply',
              style: TextStyle(
                color: SwaplyColors.greenDeep,
                fontSize: 34,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Si hva du vil ha.',
              style: TextStyle(color: SwaplyColors.grey, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}
