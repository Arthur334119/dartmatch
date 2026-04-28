import 'package:flutter/material.dart';

class AppState extends ChangeNotifier {
  AppState._();
  static final AppState instance = AppState._();

  ThemeMode _themeMode = ThemeMode.light;
  ThemeMode get themeMode => _themeMode;
  bool get isDark => _themeMode == ThemeMode.dark;

  void setDarkMode(bool dark) {
    _themeMode = dark ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  int _unreadMessages = 0;
  int get unreadMessages => _unreadMessages;

  void setUnreadMessages(int count) {
    if (_unreadMessages != count) {
      _unreadMessages = count;
      notifyListeners();
    }
  }
}
