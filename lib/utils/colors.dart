import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFFFF6B35);
  static const Color secondary = Color(0xFF2E86AB);
  static const Color accent = Color(0xFFFFB347);

  static const Color lightBackground = Color(0xFFF7F7F7);
  static const Color lightSurface = Colors.white;
  static const Color lightCard = Colors.white;

  static const Color darkBackground = Color(0xFF1A1A1A);
  static const Color darkSurface = Color(0xFF242424);
  static const Color darkCard = Color(0xFF2E2E2E);

  static const Color textLight = Color(0xFF1A1A1A);
  static const Color textDark = Color(0xFFF7F7F7);
  static const Color textMuted = Color(0xFF888888);

  static const Color success = Color(0xFF4CAF50);
  static const Color error = Color(0xFFE53935);
  static const Color warning = Color(0xFFFFC107);

  static const Color divider = Color(0xFFE0E0E0);
  static const Color dividerDark = Color(0xFF3A3A3A);

  static Color primaryWithOpacity(double opacity) =>
      primary.withValues(alpha: opacity);
}
