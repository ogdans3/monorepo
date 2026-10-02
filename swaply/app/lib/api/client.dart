import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// What the app says when the server does not answer — on the splash, and in
/// every screen that asked for something and heard nothing. Not «Ingen
/// nettverk»: the phone may be online and the server not, and this cannot tell
/// which.
const noContact = 'Vi får ikke kontakt med Swaply akkurat nå.';

/// What a heart that landed says: the trade it closed a loop into, if any,
/// whether the heart opened it or found it already going on over the ring,
/// and whether this count is one 10a is offered at.
typedef LikeAnswer = ({String? tradeId, bool tradeIsNew, bool promptToList, int likedCount});

/// What `POST /me/hidden` says: what was hidden, and how much is hidden now.
typedef HideAnswer = ({HiddenKind kind, int? count});

/// Thrown for anything the server refused, and for no answer at all. `code` is
/// what the UI switches on; `message` is already Norwegian and safe to show.
class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);

  /// No answer, or none that could be read: no network, no server behind the
  /// address, a request that took longer than [SwaplyApi.patience], or a page
  /// that is not JSON — a proxy's error page, a hotel wifi's sign-in. Nothing
  /// was said about what was asked, so nothing is known about it: a heart may
  /// or may not have landed, and so may anything else that changes something.
  /// A screen that changed itself on the tap asks the server again behind
  /// it, quietly, rather than trust either guess. [statusCode] is 0 even where
  /// a proxy sent one: it is not Swaply's, and a screen that reads a 413 as
  /// «this picture is too big» must not read it off a page the server never
  /// wrote.
  ApiException.noContact()
      : statusCode = 0,
        code = noContactCode,
        message = noContact;

  static const noContactCode = 'no_contact';

  /// A postcode that belongs to no town, from wherever one is typed.
  static const unknownPostalCode = 'unknown_postal_code';

  /// An accept or a counter-offer made on an offer that is no longer the
  /// newest: somebody proposed something else while it was being read.
  static const offerChanged = 'offer_changed';

  final int statusCode;
  final String code, message;

  /// Whether this is [ApiException.noContact] rather than a refusal. A refusal
  /// is the server's answer about what was asked; this is not an answer.
  bool get isNoContact => code == noContactCode;

  @override
  String toString() => message;
}

class SwaplyApi {
  SwaplyApi({required this.baseUrl, http.Client? client})
      : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? token;

  /// How long a request is given before it counts as no answer. A host that
  /// drops packets refuses nothing, and a phone waits a minute or two before
  /// it gives up on the connection — the heart stayed on, and the button
  /// stayed spinning, for all of it. Long enough for a slow line to answer
  /// anything but a photograph.
  static const patience = Duration(seconds: 20);

  /// A photograph is a few hundred kilobytes going up a phone's slowest
  /// direction, and one the phone could not shrink — HEIC outside Safari —
  /// can be several megabytes.
  static const uploadPatience = Duration(seconds: 90);

  Map<String, String> _headers({required bool hasBody}) => {
        // Only when there is one. A request that says it carries JSON and
        // carries nothing is rejected before it reaches a route — which is what
        // broke every action without a payload: the heart, sharing, declining,
        // marking read, and signing out.
        if (hasBody) 'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path,
          [Object? body,
          Map<String, String> headers = const {},
          void Function(int status)? heard]) async =>
      _exchange((giveUp) {
        final request = http.AbortableRequest(method, Uri.parse('$baseUrl$path'),
            abortTrigger: giveUp)
          ..headers.addAll(_headers(hasBody: body != null))
          ..headers.addAll(headers);
        if (body != null) request.body = jsonEncode(body);
        return request;
      }, refused: 'Noe gikk galt. Prøv igjen.', patience: patience, heard: heard);

  /// Sends the request [build] makes and reads the answer, and says every way
  /// of not getting one as [ApiException.noContact]. Every screen catches
  /// [ApiException] and nothing else: a dropped connection used to throw past
  /// all of them, so a heart the server never heard stayed on and a form said
  /// nothing at all.
  ///
  /// When [patience] runs out the request is called off: [build] hands it the
  /// future that does it, and the connection is closed rather than left to
  /// deliver the request late — a «Ikke vis meg slike» the app had already
  /// said failed used to be applied a minute after, with nothing on screen
  /// to show it. Calling off cannot take back what already reached the
  /// server, though, and a request that has been sent whole is carried out
  /// whether or not anybody is still waiting for the answer. So for anything
  /// that changes something, «Vi får ikke kontakt» still means that nothing
  /// is known either way, and the next asking shows what is true.
  ///
  /// [heard] is told the status of an answer that is not a refusal, for the
  /// one caller whose answer means something different at 200 and at 201.
  Future<dynamic> _exchange(http.BaseRequest Function(Future<void> giveUp) build,
      {required String refused,
      required Duration patience,
      void Function(int status)? heard}) async {
    final giveUp = Completer<void>();
    final http.Response response;
    try {
      response = await _client
          .send(build(giveUp.future))
          .then(http.Response.fromStream)
          .timeout(patience, onTimeout: () {
        giveUp.complete();
        throw TimeoutException('No answer', patience);
      });
    } on Exception {
      // `ClientException`, the socket's and the handshake's own, and the
      // timeout: all of them the connection, none of them the server. An
      // `Error` is a fault in this app and goes on up.
      throw ApiException.noContact();
    }

    final Object? decoded;
    try {
      decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    } on FormatException {
      // Somebody answered, and it was not Swaply: every answer the API gives
      // is JSON, a refusal included.
      throw ApiException.noContact();
    }

    if (response.statusCode >= 400) {
      final map = decoded is Map ? decoded : const {};
      throw ApiException(
        response.statusCode,
        map['code'] as String? ?? 'error',
        map['message'] as String? ?? refused,
      );
    }
    heard?.call(response.statusCode);
    return decoded;
  }

  Future<Map<String, dynamic>> _get(String path) async =>
      (await _send('GET', path)) as Map<String, dynamic>;
  Future<Map<String, dynamic>> _post(String path, [Object? body]) async =>
      ((await _send('POST', path, body)) ?? <String, dynamic>{}) as Map<String, dynamic>;

  // --- auth -----------------------------------------------------------------

  Future<Me> register({
    required String displayName,
    required String email,
    String? phone,
    required String password,
    String? postalCode,
    String? town,
    String? invite,
  }) async {
    // The bearer token goes along if there is one: an account made while a
    // device was looking around claims that device's row rather than starting a
    // second one, and every wish it made comes with it.
    final json = await _post('/auth/register', {
      'displayName': displayName,
      'email': email,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'password': password,
      if (postalCode != null && postalCode.isNotEmpty) 'postalCode': postalCode,
      if (town != null && town.isNotEmpty) 'town': town,
      if (invite != null && invite.isNotEmpty) 'invite': invite,
    });
    token = json['token'] as String;
    return Me.fromJson(json['user'] as Map<String, dynamic>);
  }

  /// Looking around without an account. The device id is the only credential
  /// this identity has, which is why it is a secret and not the phone's own.
  ///
  /// Hands the token back rather than taking it, unlike a sign-in: an answer
  /// the splash gave up waiting for can still arrive, after the person has
  /// signed in, and taking its token then would make them a stranger again.
  /// The session decides whether the answer still stands.
  Future<({String token, Me me})> startAnonymously({
    required String deviceId,
    String? invite,
  }) async {
    final json = await _post('/auth/anonymous', {
      'deviceId': deviceId,
      if (invite != null && invite.isNotEmpty) 'invite': invite,
    });
    return (
      token: json['token'] as String,
      me: Me.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  /// Signing in, with the bearer token along when there is one — the same as
  /// [register]. The app starts as a device without asking, so somebody signing
  /// in to the account they already have has usually been looking around
  /// first, and the server folds that device's account into theirs. The
  /// session's sign-in waits out a start still on its way, so there is a
  /// bearer whenever this phone is, or is about to be, a stranger.
  /// `carriedLikes` is how many of its wishes came along: zero when nothing
  /// moved, and when the server says nothing at all. `folded` is whether a
  /// device was folded in at all — the server says `carried` only then, and
  /// never for a claimed account or a session the account switcher minted.
  Future<({Me me, int carriedLikes, bool folded})> login(String email, String password) async {
    final json = await _post('/auth/login', {'email': email, 'password': password});
    token = json['token'] as String;
    final carried = json['carried'] as Map<String, dynamic>?;
    return (
      me: Me.fromJson(json['user'] as Map<String, dynamic>),
      carriedLikes: (carried?['likes'] as num?)?.toInt() ?? 0,
      folded: carried != null,
    );
  }

  Future<void> logout() async {
    await _post('/auth/logout');
    token = null;
  }

  Future<Me> verifyBankid(String subject) async =>
      Me.fromJson(await _post('/me/bankid', {'subject': subject}));

  // --- profile --------------------------------------------------------------

  Future<Me> me() async => Me.fromJson(await _get('/me'));

  Future<Me> updateMe(Map<String, dynamic> patch) async =>
      Me.fromJson((await _send('PATCH', '/me', patch)) as Map<String, dynamic>);

  Future<Me> setInterests(List<String> interests) async =>
      Me.fromJson((await _send('PUT', '/me/interests', {'interests': interests}))
          as Map<String, dynamic>);

  Future<UserRef> user(String id) async => UserRef.fromJson(await _get('/users/$id'));

  /// «Slett kontoen». An account with a password gives it — a phone left
  /// unlocked on a table is not the person — and a session the account
  /// switcher minted gives none, since the admin's key is behind it. Every
  /// session the account had dies with it, this one included, so the phone
  /// has nobody signed in once this has answered.
  Future<void> deleteAccount({String? password}) async =>
      _send('DELETE', '/me', password == null ? null : {'password': password});

  /// The town [code] belongs to, from the register the server carries. Needs
  /// no session: it is reference data and says nothing about anybody. A code
  /// that belongs to no town is refused as `unknown_postal_code`, in the
  /// words 10b shows.
  Future<String> town(String code) async =>
      (await _get('/postcodes/${Uri.encodeComponent(code)}'))['town'] as String;

  // --- photographs ----------------------------------------------------------

  /// 10b — one picture, from the phone to our own disk.
  ///
  /// Multipart, so the bytes are not base64'd into a third more of them, and
  /// without the JSON content type the rest of the client sends by default.
  Future<UploadedImage> uploadImage(List<int> bytes, {required String filename}) async {
    final decoded = await _exchange((giveUp) {
      final request =
          http.AbortableMultipartRequest('POST', Uri.parse('$baseUrl/media'), abortTrigger: giveUp)
            ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
      if (token != null) request.headers['authorization'] = 'Bearer $token';
      return request;
    }, refused: 'Bildet ble ikke lastet opp.', patience: uploadPatience);
    return UploadedImage.fromJson(decoded as Map<String, dynamic>);
  }

  // --- invitations ----------------------------------------------------------

  /// 04 — the share button. The link is an invitation, because a listing sent
  /// to somebody without the app would otherwise be a wall.
  Future<ShareLink> shareItem(String itemId) async =>
      ShareLink.fromJson(await _post('/items/$itemId/share'));

  /// 16b — an invitation with no listing on it.
  Future<ShareLink> createInvite() async => ShareLink.fromJson(await _post('/invites'));

  /// The one call that needs no session: who invited you, and what they sent.
  Future<InvitePreview> invite(String token) async =>
      InvitePreview.fromJson(await _get('/invites/$token'));

  // --- listings -------------------------------------------------------------

  /// «Legg ut». [key] is the draft's own (`ListingDraft.key`), and the same
  /// key from the same account is one listing: the server hands back the
  /// first instead of making a second. A «Legg ut» whose answer was lost — no
  /// contact, or the app killed while it was on its way — has reached the
  /// server or not, and nothing on the phone can tell which; pressed again,
  /// it made the thing twice whenever it had.
  ///
  /// [replayed] is the server saying the key had already made the listing:
  /// 200 for one handed back, where a new one is 201. What comes back is then
  /// the listing as that earlier press wrote it, which is not always what the
  /// form says now — see `PostItemScreen`, which corrects it.
  Future<({Item item, bool replayed})> createItem(Map<String, dynamic> body,
      {String? key}) async {
    var status = 0;
    final json = await _send(
        'POST', '/items', body, {'Idempotency-Key': ?key}, (heard) => status = heard);
    return (
      item: Item.fromJson(json as Map<String, dynamic>),
      replayed: key != null && status == 200,
    );
  }

  Future<Item> item(String id) async => Item.fromJson(await _get('/items/$id'));

  /// 10b again, on a listing that already exists. The server refuses it while
  /// a trade is holding the thing, which is the one case worth a message.
  Future<Item> updateItem(String id, Map<String, dynamic> body) async =>
      Item.fromJson((await _send('PATCH', '/items/$id', body)) as Map<String, dynamic>);

  Future<void> deleteItem(String id) async => _send('DELETE', '/items/$id');

  // --- discovery ------------------------------------------------------------

  /// 05's grid, [limit] listings from [offset] on, in an order the server
  /// keeps the same from one page to the next. Left out, they are the
  /// server's own first page. `total` is every listing the search finds, not
  /// how many came.
  Future<({int total, List<Item> items})> discover({
    String? q,
    String? category,
    String? subcategory,
    int? minValue,
    int? maxValue,
    String? condition,
    String sort = 'newest',
    int? limit,
    int? offset,
  }) async {
    final query = <String, String>{
      if (q != null && q.isNotEmpty) 'q': q,
      'category': ?category,
      'subcategory': ?subcategory,
      if (minValue != null) 'minValue': '$minValue',
      if (maxValue != null) 'maxValue': '$maxValue',
      'condition': ?condition,
      'sort': sort,
      if (limit != null) 'limit': '$limit',
      if (offset != null) 'offset': '$offset',
    };
    final json = await _get('/discover?${Uri(queryParameters: query).query}');
    return (
      total: (json['total'] as num).toInt(),
      items: (json['items'] as List).map((e) => Item.fromJson(e)).toList(),
    );
  }

  Future<List<({String category, List<Item> items})>> discoverRows() async {
    final json = await _get('/discover/rows');
    return (json['rows'] as List)
        .map((r) => (
              category: r['category'] as String,
              items: (r['items'] as List).map((e) => Item.fromJson(e)).toList(),
            ))
        .toList();
  }

  /// «Ikke vis meg slike» on [itemId]: its kind is left out of Oppdag, its
  /// rows and its search from now on, for this account. Open to a device with
  /// no profile, because it is about looking.
  ///
  /// With how much the account has hidden now that it is, counting this —
  /// null if the server did not say. That is what tells whether showing
  /// everything again would bring back this and nothing else: the count the
  /// session holds can be from before a sign-in brought other kinds along.
  Future<HideAnswer> hide(String itemId) async {
    final json = await _post('/me/hidden', {'itemId': itemId});
    return (
      kind: HiddenKind.fromJson(json['hidden'] as Map<String, dynamic>),
      count: (json['hiddenCount'] as num?)?.round(),
    );
  }

  /// Everything hidden, shown again — all of it, since the server keeps no
  /// way to name one kind back.
  Future<void> showEverything() async => _send('DELETE', '/me/hidden');

  Future<List<String>> subcategories(String category) async {
    final json = await _get('/discover/subcategories?category=$category');
    return (json['subcategories'] as List).cast<String>();
  }

  // --- likes ----------------------------------------------------------------
  //
  // A heart is sent through `Session.like` and `Session.unlike`, not from
  // here: a sign-in folds the stranger away on the server, and a heart still
  // on its way on the stranger's token then lands on nobody. The session
  // holds a sign-in back until the hearts before it have landed.

  Future<LikeAnswer> like(String itemId) async {
    final json = await _post('/items/$itemId/like');
    return (
      tradeId: json['tradeId'] as String?,
      // A server from before it said so opened a new trade every time a loop
      // closed, a second one over the same ring included.
      tradeIsNew: json['tradeIsNew'] as bool? ?? true,
      promptToList: json['promptToList'] as bool? ?? false,
      likedCount: (json['likedCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> unlike(String itemId) async => _send('DELETE', '/items/$itemId/like');

  Future<List<Item>> myLikes() async =>
      ((await _get('/me/likes'))['items'] as List).map((e) => Item.fromJson(e)).toList();

  Future<List<LikedByRow>> likedBy() async =>
      ((await _get('/me/liked-by'))['items'] as List).map((e) => LikedByRow.fromJson(e)).toList();

  // --- trades ---------------------------------------------------------------

  Future<({List<Trade> waiting, List<Trade> active, List<Trade> done, int yourTurn})>
      trades() async {
    final json = await _get('/trades');
    List<Trade> list(String key) =>
        (json[key] as List).map((e) => Trade.fromJson(e)).toList();
    return (
      waiting: list('waiting'),
      active: list('active'),
      done: list('done'),
      yourTurn: (json['yourTurn'] as num?)?.toInt() ?? 0,
    );
  }

  Future<Trade> trade(String id) async => Trade.fromJson(await _get('/trades/$id'));

  /// The conversation the message went into, with it as the last thing said.
  /// An API from before `lastMessage` was in the answer leaves it null.
  Future<ItemConversation> messageAboutItem(String itemId, String body) async =>
      ItemConversation.fromJson(await _post('/items/$itemId/message', {'body': body}));

  /// The swipe on 06c. [offerId] is the offer 06c showed, so a yes is never
  /// given to an offer the person did not read: if another has been
  /// proposed since, the server refuses with [ApiException.offerChanged]. A
  /// server from before the field leaves it out unread, as zod does with any
  /// key it does not know, and takes the newest offer as it always has.
  Future<Trade> accept(String tradeId,
      {String termsVersion = '2026-09-06', String? offerId}) async {
    final json = await _post(
        '/trades/$tradeId/accept', {'termsVersion': termsVersion, 'offerId': ?offerId});
    return Trade.fromJson(json['trade'] as Map<String, dynamic>);
  }

  /// De-accept — the lifecycle in `docs/DESIGN.md` reverses an acceptance
  /// rather than only moving forward. Your yes is what reserved your things, so
  /// taking it back is also what frees them.
  Future<Trade> revokeAcceptance(String tradeId) async =>
      Trade.fromJson((await _send('DELETE', '/trades/$tradeId/accept'))
          as Map<String, dynamic>);

  /// A new version of the deal. [baseOfferId] is the offer it was composed
  /// on, refused as [ApiException.offerChanged] when that is no longer the
  /// newest — the same rule, and the same old server, as [accept].
  Future<Trade> counter(
    String tradeId,
    List<Map<String, dynamic>> items,
    Map<String, dynamic>? cash, {
    String? baseOfferId,
    // The terms the person agreed to by sending: a proposal is its proposer's
    // yes (`screens/terms.dart`). A server from before that ignores it.
    String? termsVersion,
  }) async =>
      Trade.fromJson(await _post('/trades/$tradeId/counter', {
        'items': items,
        'cash': cash,
        'baseOfferId': ?baseOfferId,
        'termsVersion': ?termsVersion,
      }));

  Future<Trade> decline(String tradeId) async =>
      Trade.fromJson(await _post('/trades/$tradeId/decline'));

  Future<Trade> withdrawEarly(String tradeId) async =>
      Trade.fromJson(await _post('/trades/$tradeId/withdraw-early'));

  Future<({bool blocked, Trade trade})> requestWithdrawal(String tradeId) async {
    final json = await _post('/trades/$tradeId/withdrawal');
    return (
      blocked: json['blocked'] as bool? ?? false,
      trade: Trade.fromJson(json['trade'] as Map<String, dynamic>),
    );
  }

  Future<Trade> respondToWithdrawal(String tradeId, bool approve) async {
    final json = await _post('/trades/$tradeId/withdrawal/respond', {'approve': approve});
    return Trade.fromJson(json['trade'] as Map<String, dynamic>);
  }

  Future<Trade> cancelWithdrawal(String tradeId) async =>
      Trade.fromJson((await _send('DELETE', '/trades/$tradeId/withdrawal')) as Map<String, dynamic>);

  Future<({bool complete, Trade trade})> mark(String tradeId, String marker,
      {bool value = true}) async {
    final json = await _post('/trades/$tradeId/mark', {'marker': marker, 'value': value});
    return (
      complete: json['complete'] as bool? ?? false,
      trade: Trade.fromJson(json['trade'] as Map<String, dynamic>),
    );
  }

  Future<Trade> completeChainTrade(String tradeId) async =>
      Trade.fromJson(await _post('/trades/$tradeId/complete'));

  Future<({List<Item> yours, List<Item> theirs, UserRef counterparty})> candidates(
      String tradeId) async {
    final json = await _get('/trades/$tradeId/candidates');
    return (
      yours: (json['yours'] as List).map((e) => Item.fromJson(e)).toList(),
      theirs: (json['theirs'] as List).map((e) => Item.fromJson(e)).toList(),
      counterparty: UserRef.fromJson(json['counterparty'] as Map<String, dynamic>),
    );
  }

  // --- chat -----------------------------------------------------------------

  Future<({List<ChatSummary> threads, int unreadTotal})> threads() async {
    final json = await _get('/threads');
    return (
      threads: (json['threads'] as List).map((e) => ChatSummary.fromJson(e)).toList(),
      unreadTotal: (json['unreadTotal'] as num?)?.toInt() ?? 0,
    );
  }

  Future<Thread> thread(String id) async => Thread.fromJson(await _get('/threads/$id'));

  Future<ChatMessage> sendMessage(String threadId, String body) async =>
      ChatMessage.fromJson(await _post('/threads/$threadId/messages', {'body': body}));

  /// Read up to and including [upTo], the last message the screen has drawn,
  /// and no further: one that arrived after the screen asked is not read
  /// until it is on screen. A server from before the field reads the body
  /// not at all, and marks everything read, as it always has.
  Future<void> markThreadRead(String threadId, {String? upTo}) async =>
      _post('/threads/$threadId/read', upTo == null ? null : {'upTo': upTo});

  // --- the rest -------------------------------------------------------------

  Future<({List<AppNotification> notifications, int unread})> notifications() async {
    final json = await _get('/notifications');
    return (
      notifications:
          (json['notifications'] as List).map((e) => AppNotification.fromJson(e)).toList(),
      unread: (json['unread'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> markNotificationsRead() async => _post('/notifications/read');

  Future<void> review(String tradeId,
          {required String ratee, required int score, String? comment, List<String> chips = const []}) async =>
      _post('/trades/$tradeId/reviews',
          {'ratee': ratee, 'score': score, 'comment': comment, 'chips': chips});

  Future<void> feedback(int score, List<String> chips, String? comment) async =>
      _post('/feedback', {'score': score, 'chips': chips, 'comment': comment});

  Future<void> report({
    String? targetUser,
    String? targetItem,
    required String reason,
    String? detail,
    bool block = false,
  }) async =>
      _post('/reports', {
        'targetUser': ?targetUser,
        'targetItem': ?targetItem,
        'reason': reason,
        'detail': detail,
        'block': block,
      });

  Future<void> block(String userId) async => _post('/blocks/$userId');
  Future<void> unblock(String userId) async => _send('DELETE', '/blocks/$userId');

  // --- the test tooling -----------------------------------------------------
  //
  // Everything below answers 404 for an account without the flag, and for a
  // session the switcher minted — so none of it is a door that being somebody
  // else opens. The flag is set by `pnpm admin` and by nothing reachable from
  // here; see backend/drizzle/0004_admin.sql.

  Future<AdminOverview> adminOverview() async =>
      AdminOverview.fromJson(await _get('/admin/overview'));

  Future<TestAccount> createTestAccount({
    String? displayName,
    String? town,
    int withItems = 2,
    bool bankid = false,
    bool claimed = true,
  }) async =>
      TestAccount.fromJson(await _post('/admin/accounts', {
        if (displayName != null && displayName.isNotEmpty) 'displayName': displayName,
        if (town != null && town.isNotEmpty) 'town': town,
        'withItems': withItems,
        'bankid': bankid,
        'claimed': claimed,
      }));

  /// The switch. Comes back with a session for them, stamped with who asked.
  Future<({String token, String displayName})> adminSession(String accountId) async {
    final json = await _post('/admin/accounts/$accountId/session');
    return (
      token: json['token'] as String,
      displayName: json['displayName'] as String? ?? 'Testkonto',
    );
  }

  Future<List<String>> adminReset(String accountId, List<String> parts) async {
    final json = await _post('/admin/accounts/$accountId/reset', {'parts': parts});
    return ((json['done'] as List?) ?? const []).cast<String>();
  }

  Future<void> adminDeleteAccount(String accountId) async =>
      _send('DELETE', '/admin/accounts/$accountId');

  Future<BuiltScenario> adminScenario(String state, {String shape = 'two-way'}) async =>
      BuiltScenario.fromJson(await _post('/admin/scenarios', {'state': state, 'shape': shape}));

  /// «Som motparten» — the other side's move, from your own trade screen.
  Future<void> adminAct(String tradeId, {required String as, required String action}) async =>
      _post('/admin/trades/$tradeId/act', {'as': as, 'action': action});

  /// «Få noen til å ville ha denne» — one directed edge, through the real heart.
  /// The trade it names may be one already open over the ring, which the
  /// server says with `tradeIsNew: false`, as it does for a heart.
  Future<({String? tradeId, bool tradeIsNew})> adminWant(String itemId,
      {required String as}) async {
    final json = await _post('/admin/items/$itemId/want', {'as': as});
    return (
      tradeId: json['tradeId'] as String?,
      tradeIsNew: json['tradeIsNew'] as bool? ?? true,
    );
  }

  Future<void> adminExpireWithdrawal(String tradeId) async =>
      _post('/admin/trades/$tradeId/expire-withdrawal');

  Future<int> adminRunSweep() async {
    final json = await _post('/admin/jobs/sweep-cycles/run');
    return (json['opened'] as num?)?.toInt() ?? 0;
  }

  Future<AdminState> adminState() async => AdminState.fromJson(await _get('/admin/state'));
}
