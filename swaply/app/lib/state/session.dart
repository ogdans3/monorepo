import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';

/// Who is signed in, plus the two counters the bottom bar draws: unread chats
/// and trades waiting on you.
class Session extends ChangeNotifier {
  Session(this.api);

  final SwaplyApi api;

  Me? me;
  bool loading = true;
  int unreadChats = 0;
  int tradesNeedingYou = 0;
  int unreadNotifications = 0;

  bool get signedIn => me != null;

  /// True until the interest picker has been through once. Screen 02 is the
  /// first thing a new account sees, and it is skippable.
  bool interestsPending = false;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('token');
    if (saved != null) {
      api.token = saved;
      try {
        await refresh();
      } on ApiException {
        // A token that no longer resolves is the same as no token at all.
        api.token = null;
        await prefs.remove('token');
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    if (api.token == null) {
      await prefs.remove('token');
    } else {
      await prefs.setString('token', api.token!);
    }
  }

  Future<void> register({
    required String displayName,
    required String email,
    String? phone,
    required String password,
    String? postalCode,
    String? town,
  }) async {
    me = await api.register(
      displayName: displayName,
      email: email,
      phone: phone,
      password: password,
      postalCode: postalCode,
      town: town,
    );
    interestsPending = me!.interests.isEmpty;
    await _persist();
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    me = await api.login(email, password);
    interestsPending = me!.interests.isEmpty;
    await _persist();
    await refresh();
  }

  Future<void> logout() async {
    try {
      await api.logout();
    } on ApiException {
      // Signing out locally must work even if the server cannot be reached.
    }
    me = null;
    api.token = null;
    unreadChats = 0;
    tradesNeedingYou = 0;
    await _persist();
    notifyListeners();
  }

  Future<void> refresh() async {
    me = await api.me();
    unreadChats = me!.unreadMessages;
    tradesNeedingYou = me!.tradesNeedingYou;
    notifyListeners();
  }

  Future<void> setInterests(List<String> interests) async {
    me = await api.setInterests(interests);
    interestsPending = false;
    notifyListeners();
  }

  void dismissInterests() {
    interestsPending = false;
    notifyListeners();
  }
}
