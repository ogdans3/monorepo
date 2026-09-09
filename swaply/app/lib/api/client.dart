import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// Thrown for anything the server refused. `code` is what the UI switches on;
/// `message` is already Norwegian and safe to show.
class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);
  final int statusCode;
  final String code, message;

  @override
  String toString() => message;
}

class SwaplyApi {
  SwaplyApi({required this.baseUrl, http.Client? client})
      : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? token;

  Map<String, String> _headers({required bool hasBody}) => {
        // Only when there is one. A request that says it carries JSON and
        // carries nothing is rejected before it reaches a route — which is what
        // broke every action without a payload: the heart, sharing, declining,
        // marking read, and signing out.
        if (hasBody) 'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll(_headers(hasBody: body != null));
    if (body != null) request.body = jsonEncode(body);

    final response = await http.Response.fromStream(await _client.send(request));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);

    if (response.statusCode >= 400) {
      final map = decoded is Map ? decoded : const {};
      throw ApiException(
        response.statusCode,
        map['code'] as String? ?? 'error',
        map['message'] as String? ?? 'Noe gikk galt. Prøv igjen.',
      );
    }
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
  Future<Me> startAnonymously({required String deviceId, String? invite}) async {
    final json = await _post('/auth/anonymous', {
      'deviceId': deviceId,
      if (invite != null && invite.isNotEmpty) 'invite': invite,
    });
    token = json['token'] as String;
    return Me.fromJson(json['user'] as Map<String, dynamic>);
  }

  Future<Me> login(String email, String password) async {
    final json = await _post('/auth/login', {'email': email, 'password': password});
    token = json['token'] as String;
    return Me.fromJson(json['user'] as Map<String, dynamic>);
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

  // --- photographs ----------------------------------------------------------

  /// 10b — one picture, from the phone to our own disk.
  ///
  /// Multipart, so the bytes are not base64'd into a third more of them, and
  /// without the JSON content type the rest of the client sends by default.
  Future<UploadedImage> uploadImage(List<int> bytes, {required String filename}) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/media'))
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    if (token != null) request.headers['authorization'] = 'Bearer $token';

    final response = await http.Response.fromStream(await _client.send(request));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);

    if (response.statusCode >= 400) {
      final map = decoded is Map ? decoded : const {};
      throw ApiException(
        response.statusCode,
        map['code'] as String? ?? 'error',
        map['message'] as String? ?? 'Bildet ble ikke lastet opp.',
      );
    }
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

  Future<Item> createItem(Map<String, dynamic> body) async =>
      Item.fromJson(await _post('/items', body));

  Future<Item> item(String id) async => Item.fromJson(await _get('/items/$id'));

  Future<void> deleteItem(String id) async => _send('DELETE', '/items/$id');

  // --- discovery ------------------------------------------------------------

  Future<({int total, List<Item> items})> discover({
    String? q,
    String? category,
    String? subcategory,
    int? minValue,
    int? maxValue,
    String? condition,
    String sort = 'newest',
  }) async {
    final query = <String, String>{
      if (q != null && q.isNotEmpty) 'q': q,
      'category': ?category,
      'subcategory': ?subcategory,
      if (minValue != null) 'minValue': '$minValue',
      if (maxValue != null) 'maxValue': '$maxValue',
      'condition': ?condition,
      'sort': sort,
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

  Future<List<String>> subcategories(String category) async {
    final json = await _get('/discover/subcategories?category=$category');
    return (json['subcategories'] as List).cast<String>();
  }

  // --- likes ----------------------------------------------------------------

  Future<({String? tradeId, bool promptToList, int likedCount})> like(String itemId) async {
    final json = await _post('/items/$itemId/like');
    return (
      tradeId: json['tradeId'] as String?,
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

  Future<({String tradeId, String threadId})> messageAboutItem(String itemId, String body) async {
    final json = await _post('/items/$itemId/message', {'body': body});
    return (tradeId: json['tradeId'] as String, threadId: json['threadId'] as String);
  }

  Future<Trade> accept(String tradeId, {String termsVersion = '2026-09-06'}) async {
    final json = await _post('/trades/$tradeId/accept', {'termsVersion': termsVersion});
    return Trade.fromJson(json['trade'] as Map<String, dynamic>);
  }

  Future<Trade> counter(
    String tradeId,
    List<Map<String, dynamic>> items,
    Map<String, dynamic>? cash,
  ) async =>
      Trade.fromJson(await _post('/trades/$tradeId/counter', {'items': items, 'cash': cash}));

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

  Future<void> markThreadRead(String threadId) async => _post('/threads/$threadId/read');

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
}
