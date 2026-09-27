import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../util/clock.dart';
import 'draft_store.dart';
import 'listing_draft.dart';

/// Who is signed in, plus the two counters the bottom bar draws: unread chats
/// and trades waiting on you.
class Session extends ChangeNotifier {
  Session(this.api, {DraftStore? drafts}) : drafts = drafts ?? DraftStore();

  final SwaplyApi api;

  /// 10b as each account on this phone left it. Here rather than in the form
  /// because who a draft belongs to changes here: a sign-in hands it on, and
  /// «Logg ut» forgets it.
  final DraftStore drafts;

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

  /// 10b as it stood when 10c went up over it, until 10c is done with. Here
  /// rather than in the form, because signing in on 10c builds a new app and
  /// the form goes with the old one; see [ListingDraft]. Also a listing the
  /// app was closed or killed in the middle of sending, found on the next
  /// start; see [_recognise].
  ListingDraft? listingToFinish;

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

  /// The highest like count 10a has been shown at, one key per account. The
  /// server says `promptToList` on every heart that lands on a count it asks
  /// at — the fifth, then every tenth after it — and a heart taken back and
  /// given again lands on the same count a second time. Only the phone knows
  /// it already asked.
  static const _listingPromptKey = 'listingPromptShownAt:';

  /// The splash could not get past itself: no answer from the server, either
  /// about the saved token or about making this device a stranger. Nothing is
  /// thrown away meanwhile, and [retry] asks again.
  bool stalled = false;

  /// The server lets nobody in without an invitation, and this device came
  /// without one. The app cannot start without asking after all, and the gate
  /// shows the sign-in, as it did before it started on its own.
  bool inviteRequired = false;

  /// A start in flight: the saved token being checked, or the device being
  /// made a stranger — by the gate, by «Prøv igjen» or by «Se deg rundt». One
  /// at a time: the gate asks on every build while nobody is signed in, and
  /// two strangers for one device is one too many. A sign-in waits for it; see
  /// [_settle].
  Future<void>? _starting;
  bool get starting => _starting != null;

  /// Bumped each time somebody signs in, makes a profile, signs out or
  /// switches accounts here. An answer about who this phone is that was asked
  /// for before and arrives after — a start the splash gave up waiting for, a
  /// `/me` sent on the stranger's token or on the admin's — is about somebody
  /// the phone no longer is. Taken, it made the person who had just signed in
  /// a stranger again, with none of what they had brought along.
  int _decided = 0;

  /// Hearts on their way to the server; see [like]. A sign-in waits for them
  /// the way it waits for a start: the server folds the stranger into the
  /// account and deletes it, so a heart still on its way on the stranger's
  /// token arrived for nobody and was lost, and one taken back arrived too
  /// late to keep it from being carried along.
  final _wishes = <Future<void>>{};

  /// A sign-in or a new profile on its way, from the tap until the phone holds
  /// the token it brings. A heart pressed meanwhile waits for it and goes to
  /// the account it lands on, rather than to a stranger it is folding away.
  Future<void>? _signingIn;

  /// How long the splash waits for an answer before it says it has none. A
  /// host that drops packets is not refused, and without this the splash
  /// stood there with nothing to tap until the phone gave up on the
  /// connection, which is a minute or two. Giving up here loses nothing: the
  /// device id is kept before it is sent, so an answer that was only late is
  /// the same account on «Prøv igjen».
  static const patience = Duration(seconds: 12);

  /// A start like any other, so a sign-in waits for it: 16c can be open over
  /// the splash from the first frame, by its address, and a check still on
  /// its way when that sign-in folds the saved token away comes back refused
  /// — which dropped the token the sign-in had just been given.
  Future<void> restore() => _once(_restore);

  Future<void> _restore() async {
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
      // A server that is down has not said anything about the token, and nor
      // has no answer at all.
      if (e.isNoContact || e.statusCode >= 500) {
        stalled = true;
        return;
      }
      // A token that no longer resolves is the same as no token at all.
      stalled = false;
      api.token = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('token');
    } catch (_) {
      // No answer within [patience]. The token may well be good, and dropping
      // it here would turn somebody with an account into a stranger because a
      // train went into a tunnel.
      stalled = true;
    }
  }

  /// The saved token's owner, and whether 02 was still theirs to see when the
  /// app last closed. Decided before anybody is told who is signed in, so the
  /// gate goes to 02 or to the app, and not to one on its way to the other.
  Future<void> _recognise() async {
    final asked = _decided;
    final found = await api.me();
    _lastHeard = now();
    final prefs = await SharedPreferences.getInstance();
    // A listing that was on its way out when the app was closed or killed —
    // signed in on 10c, pictures still going up — is finished now, as it
    // would have been: the gate opens on Legg ut, and the form sends it.
    final unfinished = found.anonymous ? null : await drafts.unfinished(found.id);
    if (asked != _decided) return;
    listingToFinish ??= unfinished;
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
      await _lookAround().timeout(patience);
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
  /// [quiet] says neither, for a start whose screen speaks for itself.
  Future<void> _once(Future<void> Function() step, {bool quiet = false}) {
    final running = _starting;
    if (running != null) return running;
    final started = _starting = step().whenComplete(() {
      _starting = null;
      if (!quiet) notifyListeners();
    });
    if (!quiet) notifyListeners();
    return started;
  }

  /// Until no start is in flight. A sign-in sent while this phone is still
  /// being made a stranger goes without the stranger's token, so nothing is
  /// folded in — and the stranger then lands on top of the account signed
  /// in to. Waited for, a sign-in carries whatever the phone did, however
  /// quick the person was.
  Future<void> _settle() async {
    for (var running = _starting; running != null; running = _starting) {
      try {
        await running;
      } catch (_) {
        // Said to whoever asked for it. Here it only matters that it is over.
      }
    }
  }

  /// A heart, sent the way a sign-in can wait for. The card's heart and the
  /// one on 04 both go through here rather than to [SwaplyApi.like]: the
  /// answer, and a refusal or [ApiException.noContact], are the api's own.
  ///
  /// Pressed while a sign-in is on its way, it goes once that is done, on
  /// the token it brought — the account the stranger is being folded into.
  Future<LikeAnswer> like(String itemId) => _wish(() => api.like(itemId));

  /// A heart taken back; see [like].
  Future<void> unlike(String itemId) => _wish(() => api.unlike(itemId));

  Future<T> _wish<T>(Future<T> Function() send) async {
    for (var signing = _signingIn; signing != null; signing = _signingIn) {
      await signing;
    }
    // Sent in the same turn as the look above, so no sign-in can start in
    // between and go without waiting for it.
    final sending = send();
    final landed = sending.then<void>((_) {}, onError: (_) {});
    _wishes.add(landed);
    unawaited(landed.whenComplete(() => _wishes.remove(landed)));
    return sending;
  }

  /// Until no heart is on its way. Bounded by the api's own patience, which
  /// every heart gets: a line that drops packets holds the sign-in no longer
  /// than it holds the heart.
  Future<void> _wishesLanded() async {
    while (_wishes.isNotEmpty) {
      await Future.wait(_wishes.toList());
    }
  }

  /// Runs a sign-in or a profile being made as [_signingIn], so hearts
  /// pressed meanwhile wait for it. Set before [step] starts, in the same
  /// turn as the tap, and cleared before anybody waiting is let go.
  Future<T> _signIn<T>(Future<T> Function() step) async {
    final done = Completer<void>();
    _signingIn = done.future;
    try {
      return await step();
    } finally {
      if (identical(_signingIn, done.future)) _signingIn = null;
      done.complete();
    }
  }

  /// Whether whoever this phone is has been through 02: anybody it is not
  /// still owed to. Nobody at all has not. Nor has a kept token the splash
  /// could not check, unless what was kept beside it says so — the key is
  /// written for the token's account and removed when nothing is owed.
  Future<bool> _throughThePicker() async {
    if (me != null) return !interestsPending;
    if (api.token == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_pickerKey) == null;
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
    final parked = _adminToken;
    final session = await api.adminSession(accountId);
    _adminToken ??= mine;
    await _switch(session.token, undo: () {
      api.token = mine;
      _adminToken = parked;
    });
  }

  /// Back to your own account. The test account's session is left standing —
  /// it is not a credential anybody else holds, and dropping it would only
  /// cost the next switch a round trip.
  ///
  /// A parked token the server no longer knows — signed out from another
  /// phone, or expired — is no way back any more, and is let go of: the floor
  /// then offers «Logg ut» instead of a door that is always refused.
  Future<void> returnToAdmin() async {
    final parked = _adminToken;
    if (parked == null) return logout();
    final acting = api.token;
    _adminToken = null;
    await _switch(parked, undo: () {
      api.token = acting;
      _adminToken = parked;
    }, deadToken: () => api.token = acting);
  }

  /// The account switcher's move, both ways: [token] is who this phone is
  /// from now on. Asked who that is before anything is kept, so the phone
  /// keeps the token and whether 02 is owed together — the picker first, as
  /// [_persist] writes them — and never a token whose 02 was lost on the way.
  /// [undo] puts everything back when there is no answer, since nothing has
  /// been kept yet; [deadToken] instead, when the server said [token] opens
  /// nothing.
  Future<void> _switch(String token,
      {required void Function() undo, void Function()? deadToken}) async {
    // Somebody else from here on, as after a sign-in: a `/me` still on its
    // way for the account being left would put it back when it landed.
    _decided++;
    api.token = token;
    final Me found;
    try {
      found = await api.me();
    } catch (e) {
      if (deadToken != null && e is ApiException && e.statusCode == 401) {
        deadToken();
        await _persist();
        notifyListeners();
      } else {
        undo();
      }
      rethrow;
    }
    // Their first run, not yours. «Nullstill interesser» is sold as bringing
    // screen 02 back, and emptying the column is only half of that — somebody
    // has to walk through the gate again for anybody to see the picker.
    interestsPending = found.interests.isEmpty;
    _become(found);
    await _persist();
  }

  /// Look around without making anything: the gate does this on its own, and
  /// the invitation page on «Se deg rundt» — which leaves «Jeg har konto fra
  /// før» and «Lag profil med en gang» under the thumb while it is on its way,
  /// so it is a start a sign-in waits for. A quiet one: the page says what was
  /// wrong itself, and the gate deciding again on a refusal took the page
  /// away with the reason on it.
  ///
  /// Given up on after [patience], as the gate's own start is: a host that
  /// drops packets held the sign-in waiting behind this, and the page's own
  /// button, until the phone gave up on the connection. An answer that was
  /// only late still lands, unless somebody has signed in meanwhile.
  Future<void> lookAround() => _once(() => _lookAround().timeout(patience), quiet: true);

  Future<void> _lookAround() async {
    final asked = _decided;
    final prefs = await SharedPreferences.getInstance();
    Future<({String token, Me me})> start(String? invite) async =>
        api.startAnonymously(deviceId: await _deviceId(prefs), invite: invite);
    final started = await _withInvite((invite) async {
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
    // Somebody signed in while this was on its way — past the splash's
    // patience, on 16c opened over it — and a stranger is not who they are.
    // What it was made with, device id and all, is still there for the next
    // start to find.
    if (asked != _decided) return;
    api.token = started.token;
    me = started.me;
    // Nobody was signed in, so whoever last was is gone from this phone:
    // signed out, or turned away by the server — deleted, folded, or a
    // stranger left unused for too long. What they were writing is theirs,
    // and nobody can open it now. Not while an admin's own account is parked
    // behind a switch: that one is coming back. Not waited for — the store
    // takes one step at a time, so no draft of this stranger's can be kept
    // before it.
    if (_adminToken == null) unawaited(drafts.forgetAllBut(me!.id));
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
  Future<T> _withInvite<T>(Future<T> Function(String? invite) ask) async {
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
  }) =>
      _signIn(() async {
        // A stranger on its way is this device's account, and the profile is
        // made on it, with the bearer that says which — and so are the hearts
        // it has on their way.
        await _settle();
        await _wishesLanded();
        // A device claiming its own account keeps its 02 with the rest. One
        // that has been through it, at the gate or behind a link, is not
        // asked again here, between 10c and the listing it was made for — and
        // the gate, seeing it pending, would take the app down from under the
        // half-filled form to show it. One that has not — made while this form
        // was open over the invitation, and under it since — still is. Read
        // after the wait, so it is about the stranger that is claimed.
        final claiming = anonymous;
        final stranger = claiming ? me?.id : null;
        final through = await _throughThePicker();
        // Claiming is what an unclaimed test account is for, and the session
        // the switcher minted survives it on the server — the way back to the
        // admin with it. Any other profile is somebody, and not a test.
        final acting = claiming && actingAs;
        final made = await _withInvite((invite) => api.register(
              displayName: displayName,
              email: email,
              phone: phone,
              password: password,
              postalCode: postalCode,
              town: town,
              // Spent here unless this device already spent it looking around.
              invite: invite,
            ));
        _decided++;
        me = made;
        letGoOfInvite();
        if (!acting) _adminToken = null;
        interestsPending = made.interests.isEmpty && !(claiming && through);
        // A claim keeps the id, and the draft with it. Should the server
        // ever make a new account instead, the draft still goes with them.
        await _carryDraft(stranger);
        await _persist();
        notifyListeners();
        if (acting) {
          try {
            // The answer is the account and not the session, so it does not
            // say who is acting, and the floor is drawn from that: without
            // this it went until the next refresh, and «Tilbake til …» with it.
            await refresh();
          } catch (_) {
            // The next refresh says it; the profile is made either way.
          }
        }
      });

  /// Signing in, from wherever. Comes back with how many things this device
  /// had liked that are now the account's — the server folds a device that
  /// was looking around into the account it signs in to.
  Future<int> login(String email, String password) => _signIn(() async {
        // The stranger's token is what tells the server which device to fold
        // in. Sent before the stranger exists, nothing came along, and the
        // stranger then replaced the account signed in to. Sent before its
        // hearts had landed, they landed on a stranger already folded away —
        // and a heart taken back had already been carried along.
        await _settle();
        await _wishesLanded();
        // 02 is this phone's first run, not the account's. A stranger folded
        // in has walked through it at the gate: what it picked there has come
        // along if the account had none, and a skip is a skip on this phone as
        // well. Asking again showed the picker twice in a row, with the toast
        // about the likes lying across its «Fortsett». Read after the wait, so
        // it is about the stranger that is folded in — one restored from a
        // kept token has been through it unless it is still owed, and one made
        // while 16c waited has not. Where nothing is folded in — 16c at an
        // invite-only gate or from the invitation page, or from a test
        // account, whose picks stay in the ring — nobody's walk through it
        // comes along, and an account with no interests gets it once.
        final through = await _throughThePicker();
        final stranger = anonymous ? me?.id : null;
        final signed = await api.login(email, password);
        _decided++;
        me = signed.me;
        // A sign-in is a session of its own, never one the switcher minted:
        // the way back to the admin's account went on being parked after it,
        // for whoever this is, and the next switch went back to it.
        _adminToken = null;
        interestsPending = me!.interests.isEmpty && !(signed.folded && through);
        await _carryDraft(stranger);
        await _persist();
        // Signed in from here on, whatever happens next. The server has said
        // so and the token is kept, and the stranger this phone was is gone: a
        // second try would sign in with nothing left to fold in, and nothing
        // to tell.
        notifyListeners();
        try {
          // For the bar's badges, which the sign-in's answer does not carry.
          await refresh();
        } catch (_) {
          // They come with the next refresh; failing the sign-in over them
          // told somebody who was signed in that they were not.
        }
        return signed.carriedLikes;
      });

  /// The stranger's half-written 10b goes where the stranger went: a sign-in
  /// folds it into another account, and the draft kept by its id would be
  /// left with an account that no longer exists. Before the token is kept, so
  /// a phone that dies in between never holds the account without the draft.
  /// Handed over as one to finish when 10c was on its way to listing it.
  Future<void> _carryDraft(String? stranger) async {
    final now = me?.id;
    if (stranger == null || now == null || stranger == now) return;
    await drafts.handOver(stranger, now, finish: listingToFinish != null);
  }

  Future<void> logout() async {
    try {
      await api.logout();
    } catch (_) {
      // Signing out locally must work even if the server cannot be reached —
      // refused or not answering at all.
    }
    _decided++;
    me = null;
    api.token = null;
    _adminToken = null;
    listingToFinish = null;
    unreadChats = 0;
    tradesNeedingYou = 0;
    // The gate makes the next person on this phone a stranger straight away,
    // and it has to be a new one: with the old id they would be let into the
    // last person's device account, or refused as a claimed one.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('deviceId');
    // And a draft is somebody's pictures of their own things, often of their
    // own home: every one on the phone goes, not only the account's.
    await drafts.forgetAll();
    await _persist();
    notifyListeners();
  }

  Future<void> refresh() async {
    final asked = _decided;
    final found = await api.me();
    _lastHeard = now();
    // A screen of the stranger's asking as the sign-in lands: it would put
    // the stranger back, over the account the likes were just folded into.
    if (asked == _decided) _become(found);
  }

  /// When the server last answered this phone about who it is — a cold
  /// start, or any [refresh]. Only an answer: an asking that got none may
  /// never have reached it, and counting it kept the next return to the app
  /// quiet — a lift with no signal, the app put away and brought back forty
  /// seconds later with one, and that opening was never heard. For [wake].
  DateTime? _lastHeard;

  /// The asking [wake] has out, so a second return while it is on its way
  /// does not send another.
  Future<void>? _waking;

  /// How often coming back to the app asks the server again, at most.
  static const wakeEvery = Duration(minutes: 1);

  /// The app came back from the background, or a browser tab came back into
  /// view: ask the server who this is, quietly.
  ///
  /// A device account is deleted after twelve months in which its own token
  /// asked the server nothing, and the product owner's rule about what counts
  /// is strict: opening the app does. A cold start asks, restoring the token;
  /// an app brought back from the background asked nothing until somebody
  /// pressed something, so a phone opened every week to look at the grid it
  /// already held was, to the server, a phone nobody used. The answer also
  /// brings the bar's counts up to date, which is worth having on the way
  /// back.
  ///
  /// At most once a [wakeEvery] after an answer, counting any since: flicking
  /// between apps, or a browser tab losing and taking focus, is not a request
  /// each time. After no answer the next return asks again — once for each
  /// time the person comes back, and never on its own. Never says anything:
  /// no answer, or a refusal, is for the next thing the person does to find
  /// out.
  ///
  /// On the splash that is saying there was no answer, coming back is
  /// «Prøv igjen», pressed by opening the app: whoever this phone is — the
  /// token kept from last time, or the stranger it was being made — has just
  /// opened it. The splash's button spins meanwhile, as it does when pressed.
  Future<void> wake() async {
    if (loading || starting || _waking != null) return;
    if (!signedIn && !stalled) return;
    final last = _lastHeard;
    if (last != null && now().difference(last) < wakeEvery) return;
    final asking = _waking = signedIn ? refresh() : retry();
    try {
      await asking;
    } catch (_) {
      // See above: quiet.
    } finally {
      if (identical(_waking, asking)) _waking = null;
    }
  }

  void _become(Me found) {
    me = found;
    stalled = false;
    unreadChats = found.unreadMessages;
    tradesNeedingYou = found.tradesNeedingYou;
    notifyListeners();
  }

  /// Whether 10a goes up for the heart that brought this account to
  /// [likedCount] wishes. Never unless the server said [promptToList], and then
  /// only above the highest count it has been shown at. A yes is remembered
  /// before the sheet is up, so liking, taking it back and liking again at
  /// five asks once, and the next time is fifteen. The card's heart and the
  /// item page's both ask here, so neither repeats what the other has said.
  Future<bool> listingPromptDue({required bool promptToList, required int likedCount}) async {
    final id = me?.id;
    if (!promptToList || id == null) return false;
    final prefs = await SharedPreferences.getInstance();
    final key = '$_listingPromptKey$id';
    if (likedCount <= (prefs.getInt(key) ?? 0)) return false;
    await prefs.setInt(key, likedCount);
    return true;
  }

  /// Forgets that 10a has been shown to [accountId] on this phone. For the
  /// test tooling's «Nullstill likes»: the server counts from nothing again,
  /// and the count remembered here would keep the sheet down until the old
  /// one was passed — the one way to walk 10a again was the way it could not
  /// be walked. Never from a count going down on its own: somebody taking
  /// hearts back below five has been asked, and is not asked again at five.
  Future<void> forgetListingPrompt(String accountId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_listingPromptKey$accountId');
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
