import 'package:flutter/material.dart';

/// The console's palette, copied token for token from src/app/globals.css so a
/// reader moving between the office screen and the handset sees one system.
abstract final class Kuwe {
  static const ink = Color(0xFF0F1E24);
  static const canvas = Color(0xFFEEF1F0);

  static const line = Color(0xFFE1E8E6);
  static const lineSoft = Color(0xFFEDF1F0);

  static const muted = Color(0xFF8B9A98);
  static const mutedDeep = Color(0xFF5F7371);

  static const brand50 = Color(0xFFF0F6F5);
  static const brand100 = Color(0xFFE3F0EF);
  static const brand200 = Color(0xFFCFE3E1);
  static const brand500 = Color(0xFF12807C);
  static const brand600 = Color(0xFF0E6E6B);
  static const brand700 = Color(0xFF0F3F3E);
  static const brand900 = Color(0xFF0B2A2C);

  static const okBg = Color(0xFFE6F2EC);
  static const okFg = Color(0xFF2F6B3F);

  static const warnBg = Color(0xFFFBF0DC);
  static const warnFg = Color(0xFF8A5A0B);

  static const badBg = Color(0xFFF8E3E0);
  static const badFg = Color(0xFFA6362B);

  static const infoBg = Color(0xFFE3EDF4);
  static const infoFg = Color(0xFF2C5A7A);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Kuwe.brand600,
      primary: Kuwe.brand600,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: Kuwe.canvas,
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Kuwe.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Kuwe.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Kuwe.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Kuwe.brand500, width: 1.5),
      ),
      labelStyle: const TextStyle(color: Kuwe.mutedDeep, fontSize: 13),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Kuwe.brand600,
        foregroundColor: Colors.white,
        // Thumb-sized: this gets pressed hundreds of times a day, often
        // one-handed, sometimes in the rain.
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    dividerTheme: const DividerThemeData(color: Kuwe.lineSoft, thickness: 1, space: 1),
  );
}
