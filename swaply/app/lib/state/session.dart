import 'dart:math';

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

  /// Signed in as a device, with no profile behind it yet.
  bool get anonymous => me?.anonymous ?? false;

  /// The token from the link that brought you here, kept until an account is
  /// made with it. Set before [restore] runs.
  String? pendingInvite;

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

  /// Look around without making anything. The device id is a secret this app
  /// generates once and keeps: it is the only credential the account has, so it
  /// is not the phone's own identifier, which other apps can read.
  Future<void> lookAround() async {
    final prefs = await SharedPreferences.getInstance();
    var deviceId = prefs.getString('deviceId');
    if (deviceId == null) {
      final random = Random.secure();
      deviceId = List.generate(32, (_) => random.nextInt(16).toRadixString(16)).join();
      await prefs.setString('deviceId', deviceId);
    }

    me = await api.startAnonymously(deviceId: deviceId, invite: pendingInvite);
    pendingInvite = null;
    interestsPending = me!.interests.isEmpty;
    await _persist();
    notifyListeners();
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
      // Spent here unless this device already spent it looking around.
      invite: pendingInvite,
    );
    pendingInvite = null;
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
