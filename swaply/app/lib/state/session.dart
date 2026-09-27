import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../util/clock.dart';
import '../util/other_tabs.dart';
import 'draft_store.dart';
import 'listing_draft.dart';

/// Who is signed in, plus the two counters the bottom bar draws: unread chats
/// and trades waiting on you.
class Session extends ChangeNotifier {
  /// [otherTabs] rings when another tab of the site has changed who is signed
  /// in; see [tokenChangedElsewhere], which is what it is everywhere but in a
  /// test. Given, the session also takes the storage it keeps its token in to
  /// be shared with those tabs.
  Session(this.api, {DraftStore? drafts, Stream<void>? otherTabs})
      : drafts = drafts ?? DraftStore() {
    final elsewhere = otherTabs ?? tokenChangedElsewhere();
    _shared = elsewhere != null;
    _otherTabs = elsewhere?.listen((_) => unawaited(_followOtherTab()));
  }

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
    final saved = _known = prefs.getString('token');
    if (saved != null) {
      api.token = saved;
      await _check();
    }
    loading = false;
    notifyListeners();
  }

  /// Who the saved token belongs to, if the server can say. [takeUp] is
  /// [_recognise]'s.
  Future<void> _check({bool takeUp = true}) async {
    final token = api.token;
    try {
      await _recognise(takeUp: takeUp).timeout(patience);
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
      await _letGo(token);
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
  ///
  /// Not [takeUp] when following another tab of the site: the listing that
  /// tab was finishing is that tab's to send, and two tabs sending it would be
  /// two «Legg ut» for one thing.
  Future<void> _recognise({bool takeUp = true}) async {
    final asked = _decided;
    final found = await api.me();
    _lastHeard = now();
    final prefs = await SharedPreferences.getInstance();
    // A listing that was on its way out when the app was closed or killed —
    // signed in on 10c, pictures still going up — is finished now, as it
    // would have been: the gate opens on Legg ut, and the form sends it.
    final unfinished =
        found.anonymous || !takeUp ? null : await drafts.unfinished(found.id);
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

  /// Until no sign-in or new profile is on its way, however many follow one
  /// another. One that fails still ends here.
  Future<void> _signInsLanded() async {
    for (var signing = _signingIn; signing != null; signing = _signingIn) {
      await signing;
    }
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

  /// Keeps the token, and [deviceId] with it when given: the id the stranger
  /// behind the token was made with, or the one the next stranger will have
  /// once the kept one is no way back in. See [_freshDeviceId].
  Future<void> _persist({String? deviceId}) async {
    // The picker first: a phone that dies between the two writes then comes
    // back to 02 or to no token at all, never to a token without its 02.
    await _keepPicker();
    final prefs = await SharedPreferences.getInstance();
    // Nothing new of this tab's own, over a storage another tab has written
    // since: what this tab holds is the token that tab replaced — signed out
    // of, and revoked — and writing it back signed every tab in again as
    // somebody who had left, or put a person back over the one who had just
    // signed in. The storage wins, and this tab follows it.
    if (api.token == _known && await _overtaken(prefs)) {
      unawaited(_followOtherTab());
      return;
    }
    // Before the token, so a tab that hears the token change finds the id
    // that goes with it already there.
    if (deviceId != null) await prefs.setString('deviceId', deviceId);
    if (api.token == null) {
      await prefs.remove('token');
    } else {
      await prefs.setString('token', api.token!);
    }
    _known = api.token;
    if (_adminToken == null) {
      await prefs.remove('adminToken');
    } else {
      await prefs.setString('adminToken', _adminToken!);
    }
  }

  // --- other tabs --------------------------------------------------------------
  //
  // On the web every tab of the site keeps its token in one storage, and each
  // tab reads it once, when it starts. A tab still open went on as whoever it
  // had started as after another tab signed out — holding the token that
  // tab had revoked, writing it back on its next change, keeping drafts for
  // somebody no longer there — or signed in as somebody else. So each tab
  // listens for the others, and the storage is what says who this is.

  /// Whether the storage the token is kept in is shared with other tabs: the
  /// web, or a test that says there are some. Nowhere else can anything but
  /// this app change it.
  late final bool _shared;
  StreamSubscription<void>? _otherTabs;

  /// The token this tab last read from the storage, or wrote to it.
  String? _known;

  /// Each time this tab starts following another; see [_followOtherTab].
  int _follows = 0;

  /// Whether another tab has written a token to the shared storage since this
  /// tab last read or wrote one, which makes whatever this tab holds out of
  /// date. Reads the storage again to know: this tab's copy of it is from
  /// when this tab last looked. Never, where nothing is shared.
  Future<bool> _overtaken(SharedPreferences prefs) async {
    if (!_shared) return false;
    await prefs.reload();
    return prefs.getString('token') != _known;
  }

  /// [token] opens nothing any more, and this phone lets go of it — and the
  /// storage does, unless another tab has put somebody else there since, who
  /// is followed instead.
  Future<void> _letGo(String? token) async {
    api.token = null;
    final prefs = await SharedPreferences.getInstance();
    if (_shared) await prefs.reload();
    final stored = prefs.getString('token');
    if (!_shared || stored == token) {
      await prefs.remove('token');
      _known = null;
    } else {
      unawaited(_followOtherTab());
    }
  }

  /// Another tab of the site changed who is signed in, and this one follows,
  /// by what is in the storage now rather than by what the change said: two
  /// changes can be heard in the wrong order, and only the storage knows
  /// which came last. Nothing, when it holds the token this tab has.
  ///
  /// Signed out there: nobody is signed in here either. What was on screen
  /// was that person's, and goes, and the gate makes this tab a stranger —
  /// the same one as that tab's, by the device id it has kept. Not signed out
  /// again here, which that tab did; nor is anything forgotten again.
  ///
  /// Signed in there, or switched: this tab becomes whoever that is, the way
  /// a cold start with that token would, behind the splash. Everything on
  /// screen goes with the person it was about — a sign-in on another tab is
  /// usually somebody else.
  Future<void> _followOtherTab() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final stored = prefs.getString('token');
    _known = stored;
    if (stored == api.token) return;
    final follow = ++_follows;
    _decided++;
    _adminToken = prefs.getString('adminToken');
    _forgetWhoThisWas();
    api.token = stored;
    if (stored == null) {
      // Over a sign-in this tab was still following, which is over too.
      loading = false;
      notifyListeners();
      _sendBack();
      return;
    }
    loading = true;
    notifyListeners();
    _sendBack();
    // After whatever start this tab had on its way, which is about somebody
    // this tab no longer is and is dropped as it lands.
    await _settle();
    if (follow != _follows) return;
    await _once(() => _check(takeUp: false));
    if (follow != _follows) return;
    loading = false;
    notifyListeners();
  }

  // --- sent back through the gate ------------------------------------------------

  final _gate = StreamController<void>.broadcast();

  /// Rings when this phone has stopped being whoever its screens are about
  /// without anybody here pressing anything: the server said the session is
  /// gone ([wake]), or another tab of the site signed out or in
  /// ([_followOtherTab]). The app takes down every screen over the gate on it,
  /// as «Logg ut» does — they were the last person's.
  Stream<void> get sentBack => _gate.stream;

  void _sendBack() {
    if (!_gate.isClosed) _gate.add(null);
  }

  /// Nobody is signed in any more, as far as this phone's memory goes. The
  /// token is not touched, nor is anything kept.
  void _forgetWhoThisWas() {
    me = null;
    listingToFinish = null;
    unreadChats = 0;
    tradesNeedingYou = 0;
    unreadNotifications = 0;
    interestsPending = false;
    stalled = false;
  }

  @override
  void dispose() {
    unawaited(_otherTabs?.cancel());
    unawaited(_gate.close());
    super.dispose();
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
    // Another tab of the site signing out, or letting go of a token the
    // server refused, makes this one a stranger too, in the same moment as
    // that tab makes its own. Read again here: the id both will send is
    // already kept by then (see [_freshDeviceId]), so the two are one device
    // account rather than two.
    if (_shared) await prefs.reload();
    late String sent;
    Future<({String token, Me me})> start(String? invite) async =>
        api.startAnonymously(deviceId: sent = await _deviceId(prefs), invite: invite);
    final started = await _withInvite((invite) async {
      try {
        return await start(invite);
      } on ApiException catch (e) {
        if (e.code != 'device_claimed') rethrow;
        // This device's account has been given a name since and its token is
        // gone, so the device id is no longer a way into it: the password is,
        // and the account is still there to sign in to. A new id is a new
        // stranger — unless another tab was refused the same id a moment ago
        // and has already kept the next one, which is then this tab's too.
        // Once — the server would have to refuse an id nobody has ever sent
        // for this to fail twice.
        if (_shared) await prefs.reload();
        if (prefs.getString('deviceId') == sent) {
          await prefs.setString('deviceId', _freshDeviceId());
        }
        return start(invite);
      }
    });
    // Somebody signed in while this was on its way — past the splash's
    // patience, on 16c opened over it — and a stranger is not who they are.
    // What it was made with, device id and all, is still there for the next
    // start to find.
    if (asked != _decided) return;
    // Nor while another tab of the site has put somebody in the storage since
    // this tab last looked: a stranger made here without anybody asking must
    // not sign that tab's person out of every tab. This tab becomes them.
    if (await _overtaken(prefs)) {
      unawaited(_followOtherTab());
      return;
    }
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
    // With the id it was made with. Two tabs that each had to make an id —
    // the site's storage cleared under both — made two strangers, and the id
    // kept last was often the one whose token was not: a token refused later
    // then came back with that id, into the account nobody had been using.
    await _persist(deviceId: sent);
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
    final fresh = _freshDeviceId();
    await prefs.setString('deviceId', fresh);
    return fresh;
  }

  /// A new device id, for the next stranger this phone makes.
  ///
  /// The id is replaced, never only forgotten, wherever it is known to be no
  /// way back in, and the next one is kept just before the token changes
  /// (see [_persist]) — the change every other tab of the site hears, and
  /// hears after the id. Forgotten, it was made again by whichever tab looked
  /// first after that, and on the web every tab looks at once: the one that
  /// let go, and each one that heard it. Each found none and made its own,
  /// and they were two device accounts, one left behind with a session
  /// nobody held, and often the id kept was that one's rather than the
  /// account every tab went on as. Kept already, it is the one id all of them
  /// send, and the server lets them all into the one account it makes.
  ///
  /// «Logg ut» replaces it: see [logout]. A profile made on the device's own
  /// account spends it — the server never lets a claimed account in by its
  /// device id — so it is replaced there too: see [register]. Without that, a
  /// token refused later sent every tab to the server with the spent id, and
  /// each, refused, made a new one of its own.
  static String _freshDeviceId() {
    final random = Random.secure();
    return List.generate(32, (_) => random.nextInt(16).toRadixString(16)).join();
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
        // The device's own account has a profile now, and its device id is
        // no way back into it, so the next stranger's is kept already; see
        // [_freshDeviceId]. Not for a test account claimed through the
        // switcher: the id kept here is this phone's, not that account's.
        await _persist(deviceId: claiming && !acting ? _freshDeviceId() : null);
        notifyListeners();
        try {
          // The answer is `publicMe`: the profile, without the things, the
          // likes and the unread counts only `GET /me` lists, so 13 and the
          // bar's badges went on showing none until something asked again.
          // Nor does it say who is acting, which is the account and not the
          // session, and the floor is drawn from that: «Tilbake til …» went
          // until the next refresh too. As a sign-in does, quietly.
          await refresh();
        } catch (_) {
          // The next refresh says it; the profile is made either way, and
          // failing it over this told somebody with a profile they had none.
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
    _forgetWhoThisWas();
    api.token = null;
    _adminToken = null;
    // A draft is somebody's pictures of their own things, often of their own
    // home: every one on the phone goes, not only the account's.
    await drafts.forgetAll();
    // The gate makes the next person on this phone a stranger straight away,
    // and it has to be a new one: with the old id they would be let into the
    // last person's device account, or refused as a claimed one. Kept with
    // the token going rather than made by the gate, so every other tab of the
    // site, which hears it go and makes its stranger at the same moment, sends
    // the same id; see [_freshDeviceId].
    await _persist(deviceId: _freshDeviceId());
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
  ///
  /// Except a refusal of the token itself. The account was deleted while the
  /// app sat in the background — from another phone, or by the twelve-month
  /// sweep — or its session was ended, and the app went on showing somebody
  /// signed in until its next cold start, with every tap refused. That is
  /// what a cold start with a dead token does, so it is done now: the token
  /// goes, the screens go with the person they were about, and the gate
  /// makes the next start — a new stranger, for a device and for an erased
  /// account alike. Only for the token that was asked about: a sign-in that
  /// landed meanwhile is somebody else.
  ///
  /// Nor while a sign-in or a profile is on its way. The server retires the
  /// token this would ask on as it lets the person in — a claim reissues the
  /// device's session, and a sign-in deletes the device it folds in — before
  /// its answer has told the phone who they are now. A refusal heard in that
  /// gap is the sign-in's own doing, and taking it for a dead token closed
  /// 10c or 16c under the person and made a stranger whose start threw away
  /// the draft the sign-in was about to carry over. The sign-in asks the
  /// server itself once it lands.
  Future<void> wake() async {
    if (loading || starting || _waking != null || _signingIn != null) return;
    if (!signedIn && !stalled) return;
    final last = _lastHeard;
    if (last != null && now().difference(last) < wakeEvery) return;
    final token = api.token;
    final asked = _decided;
    final signedInAsked = signedIn;
    final asking = _waking = signedIn ? refresh() : retry();
    try {
      await asking;
    } on ApiException catch (e) {
      if (signedInAsked && e.statusCode == 401) {
        // Sent before a sign-in was pressed, and refused while it is on its
        // way: see above. Decided once it has landed — somebody else then,
        // or, if it failed, still the token that was asked about.
        await _signInsLanded();
        if (asked == _decided && api.token == token) await _turnedAway(token);
      }
      // Anything else: see above, quiet.
    } catch (_) {
      // See above: quiet.
    } finally {
      if (identical(_waking, asking)) _waking = null;
    }
  }

  /// The server said [token] opens nothing; see [wake].
  Future<void> _turnedAway(String? token) async {
    _decided++;
    _forgetWhoThisWas();
    await _letGo(token);
    notifyListeners();
    _sendBack();
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
