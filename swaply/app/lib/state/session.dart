import 'dart:async';
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

  /// The test tooling's key. The server answers 404 on every admin route
  /// without it, so this only decides whether the app draws the section.
  bool get isAdmin => me?.isAdmin ?? false;

  /// «You are Kari right now.» Read off the session row rather than kept here,
  /// so a refresh, a restored token or a cold start cannot lose it.
  bool get actingAs => me?.actingAs ?? false;
  String? get actingAsAdminName => me?.actingAsAdminName;

  /// The admin's own token, parked while acting as somebody else. Kept next to
  /// the live one so «Tilbake til …» survives closing the app.
  String? _adminToken;
  bool get canReturnToAdmin => _adminToken != null;

  /// The token from the link that brought you here, kept until an account is
  /// made with it. Set before [restore] runs.
  String? pendingInvite;

  /// The same link once its key is spent, or turned out to be no good: a
  /// shared link is a listing as well as a key, and the listing is still worth
  /// opening. The gate opens it, once, when there is an app to open it in.
  String? linkToOpen;

  /// True until the interest picker has been through once. Screen 02 is the
  /// first thing a new account sees, and it is skippable.
  bool interestsPending = false;

  /// Whose 02 is still owed, kept on the phone next to the token. Held only in
  /// memory, closing the app on 02 — or reloading the page, on the web — came
  /// back past it into Oppdag, and the intro was never shown again. Neither the
  /// server nor [Me] can say it instead: «Hopp over» leaves the interests as
  /// empty as never having been asked. By account id, so it cannot outlive the
  /// account it was owed to.
  static const _pickerKey = 'interestsPendingFor';

  /// The splash could not get past itself: no answer from the server, either
  /// about the saved token or about making this device a stranger. Nothing is
  /// thrown away meanwhile, and [retry] asks again.
  bool stalled = false;

  /// The server lets nobody in without an invitation, and this device came
  /// without one. The app cannot start without asking after all, and the gate
  /// shows the sign-in, as it did before it started on its own.
  bool inviteRequired = false;

  /// A start in flight, from the gate or from «Prøv igjen». One at a time: the
  /// gate asks on every build while nobody is signed in, and two strangers for
  /// one device is one too many.
  Future<void>? _starting;
  bool get starting => _starting != null;

  /// How long the splash waits for an answer before it says it has none. A
  /// host that drops packets is not refused, and without this the splash
  /// stood there with nothing to tap until the phone gave up on the
  /// connection, which is a minute or two. Giving up here loses nothing: the
  /// device id is kept before it is sent, so an answer that was only late is
  /// the same account on «Prøv igjen».
  static const patience = Duration(seconds: 12);

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    _adminToken = prefs.getString('adminToken');
    final saved = prefs.getString('token');
    if (saved != null) {
      api.token = saved;
      await _check();
    }
    loading = false;
    notifyListeners();
  }

  /// Who the saved token belongs to, if the server can say.
  Future<void> _check() async {
    try {
      await _recognise().timeout(patience);
      stalled = false;
    } on ApiException catch (e) {
      // A server that is down has not said anything about the token.
      if (e.statusCode >= 500) {
        stalled = true;
        return;
      }
      // A token that no longer resolves is the same as no token at all.
      stalled = false;
      api.token = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('token');
    } catch (_) {
      // No answer at all. The token may well be good, and dropping it here
      // would turn somebody with an account into a stranger because a train
      // went into a tunnel.
      stalled = true;
    }
  }

  /// The saved token's owner, and whether 02 was still theirs to see when the
  /// app last closed. Decided before anybody is told who is signed in, so the
  /// gate goes to 02 or to the app, and not to one on its way to the other.
  Future<void> _recognise() async {
    final found = await api.me();
    final prefs = await SharedPreferences.getInstance();
    interestsPending = found.interests.isEmpty && prefs.getString(_pickerKey) == found.id;
    _become(found);
  }

  /// The gate's move when nobody is signed in: the device becomes a stranger,
  /// behind the splash, without asking. Nobody meets a sign-in before they
  /// have seen anything. Does nothing while a link waits to be answered, while
  /// the splash is saying why it is stuck, or on a server that wants a key.
  void begin() {
    if (loading || signedIn || stalled || inviteRequired || pendingInvite != null) return;
    _once(_becomeStranger);
  }

  /// «Prøv igjen» on the splash: whatever could not be done, again.
  Future<void> retry() => _once(() => api.token != null ? _check() : _becomeStranger());

  Future<void> _becomeStranger() async {
    try {
      await lookAround().timeout(patience);
      stalled = false;
    } on ApiException catch (e) {
      if (e.code == 'invite_required') {
        inviteRequired = true;
      } else {
        stalled = true;
      }
    } catch (_) {
      stalled = true;
    }
  }

  /// Runs [step] unless one is already running, and says so both ways: the
  /// splash's button spins meanwhile, and the gate decides again after.
  Future<void> _once(Future<void> Function() step) {
    final running = _starting;
    if (running != null) return running;
    final started = _starting = step().whenComplete(() {
      _starting = null;
      notifyListeners();
    });
    notifyListeners();
    return started;
  }

  Future<void> _persist() async {
    // The picker first: a phone that dies between the two writes then comes
    // back to 02 or to no token at all, never to a token without its 02.
    await _keepPicker();
    final prefs = await SharedPreferences.getInstance();
    if (api.token == null) {
      await prefs.remove('token');
    } else {
      await prefs.setString('token', api.token!);
    }
    if (_adminToken == null) {
      await prefs.remove('adminToken');
    } else {
      await prefs.setString('adminToken', _adminToken!);
    }
  }

  Future<void> _keepPicker() async {
    final prefs = await SharedPreferences.getInstance();
    final owed = interestsPending ? me?.id : null;
    if (owed == null) {
      await prefs.remove(_pickerKey);
    } else {
      await prefs.setString(_pickerKey, owed);
    }
  }

  /// Become one of your test accounts.
  ///
  /// The token comes from the server and carries who asked for it, so the floor
  /// is drawn from the session and not from anything this object remembers.
  /// What is remembered here is only the way back.
  Future<void> switchTo(String accountId) async {
    final mine = api.token;
    final session = await api.adminSession(accountId);
    _adminToken ??= mine;
    api.token = session.token;
    await _persist();
    await refresh();
    // Their first run, not yours. «Nullstill interesser» is sold as bringing
    // screen 02 back, and emptying the column is only half of that — somebody
    // has to walk through the gate again for anybody to see the picker.
    interestsPending = me!.interests.isEmpty;
    await _keepPicker();
    notifyListeners();
  }

  /// Back to your own account. The test account's session is left standing —
  /// it is not a credential anybody else holds, and dropping it would only
  /// cost the next switch a round trip.
  Future<void> returnToAdmin() async {
    final parked = _adminToken;
    if (parked == null) return logout();
    _adminToken = null;
    api.token = parked;
    await _persist();
    await refresh();
    interestsPending = me!.interests.isEmpty;
    await _keepPicker();
    notifyListeners();
  }

  /// Look around without making anything: the gate does this on its own, and
  /// the invitation page on «Se deg rundt».
  Future<void> lookAround() async {
    final prefs = await SharedPreferences.getInstance();
    Future<Me> start(String? invite) async =>
        api.startAnonymously(deviceId: await _deviceId(prefs), invite: invite);
    me = await _withInvite((invite) async {
      try {
        return await start(invite);
      } on ApiException catch (e) {
        if (e.code != 'device_claimed') rethrow;
        // This device's account has been given a name since and its token is
        // gone, so the device id is no longer a way into it: the password is,
        // and the account is still there to sign in to. A new id is a new
        // stranger. Once — the server would have to refuse an id nobody has
        // ever sent for this to fail twice.
        await prefs.remove('deviceId');
        return start(invite);
      }
    });
    letGoOfInvite();
    // An answer, if a late one: whatever the splash said about there being
    // none is no longer so.
    stalled = false;
    interestsPending = me!.interests.isEmpty;
    await _persist();
    notifyListeners();
  }

  /// Asks with the link's key, and without it if the key is no good: unknown
  /// — a link a chat app cut short — or spent between opening the link and
  /// pressing the button. On a server that lets people in without a key that
  /// is no reason to keep them out, and the invitation page would otherwise
  /// be the one wall left, with both of its ways in sending the same dead key.
  /// Where a key is required, what was wrong with this one is what to say.
  Future<Me> _withInvite(Future<Me> Function(String? invite) ask) async {
    final invite = pendingInvite;
    try {
      return await ask(invite);
    } on ApiException catch (e) {
      if (invite == null || (e.code != 'invite_unknown' && e.code != 'invite_used')) rethrow;
      letGoOfInvite();
      try {
        return await ask(null);
      } on ApiException catch (again) {
        if (again.code == 'invite_required') throw e;
        rethrow;
      }
    }
  }

  /// The key is spent, or no good. The link is kept to be opened.
  void letGoOfInvite() {
    linkToOpen ??= pendingInvite;
    pendingInvite = null;
  }

  /// The device id is a secret this app generates and keeps: it is the only
  /// credential an unclaimed account has, so it is not the phone's own
  /// identifier, which other apps can read. Kept before it is ever sent, so a
  /// start that is cut off halfway — the app killed, a hot restart — sends the
  /// same id next time and gets the same account back, not a second one.
  Future<String> _deviceId(SharedPreferences prefs) async {
    final kept = prefs.getString('deviceId');
    if (kept != null) return kept;
    final random = Random.secure();
    final fresh = List.generate(32, (_) => random.nextInt(16).toRadixString(16)).join();
    await prefs.setString('deviceId', fresh);
    return fresh;
  }

  Future<void> register({
    required String displayName,
    required String email,
    String? phone,
    required String password,
    String? postalCode,
    String? town,
  }) async {
    // A device claiming its own account has been through 02 already, at the
    // gate or behind a link. Asking again here, between 10c and the listing it
    // was made for, is the picker a second time — and the gate, seeing it
    // pending, would take the app down from under the half-filled form to
    // show it.
    final claiming = anonymous;
    me = await _withInvite((invite) => api.register(
          displayName: displayName,
          email: email,
          phone: phone,
          password: password,
          postalCode: postalCode,
          town: town,
          // Spent here unless this device already spent it looking around.
          invite: invite,
        ));
    letGoOfInvite();
    interestsPending = !claiming && me!.interests.isEmpty;
    await _persist();
    notifyListeners();
  }

  /// Signing in, from wherever. Comes back with how many things this device
  /// had liked that are now the account's — the server folds a device that
  /// was looking around into the account it signs in to.
  Future<int> login(String email, String password) async {
    // 02 is this phone's first run, not the account's. A stranger signing in
    // has walked through it at the gate: what it picked there has come along
    // if the account had none, and a skip is a skip on this phone as well.
    // Asking again showed the picker twice in a row, with the toast about the
    // likes lying across its «Fortsett». Signing in anywhere else — 16c at an
    // invite-only gate, or from the invitation page — nobody on this phone has
    // been through it yet.
    final walkedThrough = anonymous;
    final signed = await api.login(email, password);
    me = signed.me;
    interestsPending = !walkedThrough && me!.interests.isEmpty;
    await _persist();
    // Signed in from here on, whatever happens next. The server has said so
    // and the token is kept, and the stranger this phone was is gone: a second
    // try would sign in with nothing left to fold in, and nothing to tell.
    notifyListeners();
    try {
      // For the bar's badges, which the sign-in's answer does not carry.
      await refresh();
    } catch (_) {
      // They come with the next refresh; failing the sign-in over them told
      // somebody who was signed in that they were not.
    }
    return signed.carriedLikes;
  }

  Future<void> logout() async {
    try {
      await api.logout();
    } catch (_) {
      // Signing out locally must work even if the server cannot be reached —
      // refused or not answering at all.
    }
    me = null;
    api.token = null;
    _adminToken = null;
    unreadChats = 0;
    tradesNeedingYou = 0;
    // The gate makes the next person on this phone a stranger straight away,
    // and it has to be a new one: with the old id they would be let into the
    // last person's device account, or refused as a claimed one.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('deviceId');
    await _persist();
    notifyListeners();
  }

  Future<void> refresh() async => _become(await api.me());

  void _become(Me found) {
    me = found;
    stalled = false;
    unreadChats = found.unreadMessages;
    tradesNeedingYou = found.tradesNeedingYou;
    notifyListeners();
  }

  Future<void> setInterests(List<String> interests) async {
    me = await api.setInterests(interests);
    interestsPending = false;
    notifyListeners();
    await _keepPicker();
  }

  void dismissInterests() {
    interestsPending = false;
    notifyListeners();
    // Not waited for: the gate moves on now, and a write that has not landed
    // when the phone dies only shows 02 once more.
    unawaited(_keepPicker());
  }
}
