import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'export_fixtures.dart';

/// A stand-in for the API, shaped exactly like the real responses. The screens
/// are driven through the real `SwaplyApi`, so a change to the wire format
/// breaks these tests rather than passing quietly.
class FakeServer {
  FakeServer({this.export = false});

  /// Serve the people and things the round-5 export draws, so a golden can
  /// be laid over the frame it came from. The flow tests keep the small set.
  final bool export;
  int uploads = 0;

  final requests = <String>[];

  /// What was sent, by request. JSON only — a multipart upload is bytes, and
  /// nothing here needs to read them back.
  final bodies = <String, Map<String, dynamic>>{};

  /// The bearer each request carried, by request, and null for none. The
  /// last one wins, as in [bodies].
  final bearers = <String, String?>{};

  /// Answers that replace the canned ones. Besides a body or a status there is
  /// a [Refusal], [unreachable], and a function of the request — which may hand
  /// back any of those, or a future of one — for an answer that changes
  /// between calls.
  final Map<String, Object?> overrides = {};

  http.Client get client => MockClient((request) async {
        final key = '${request.method} ${request.url.path}';
        requests.add(key);
        bearers[key] = request.headers['authorization'];
        // A multipart upload is bytes that are not text; reading `body` on
        // one throws before the request is even answered.
        final json = (request.headers['content-type'] ?? '').startsWith('application/json');
        if (json && request.body.startsWith('{')) {
          bodies[key] = jsonDecode(request.body) as Map<String, dynamic>;
        }

        var body = overrides.containsKey(key) ? overrides[key] : _canned(key, request);
        if (body is Object? Function(http.Request)) body = body(request);
        if (body is Future) body = await body;
        if (identical(body, unreachable)) {
          // What the http client throws when there is no network or no
          // server: not an answer at all.
          throw http.ClientException('Connection refused', request.url);
        }
        if (body is Refusal) {
          return http.Response(jsonEncode({'code': body.code, 'message': body.message}),
              body.status,
              headers: {'content-type': 'application/json; charset=utf-8'});
        }
        if (body == null) {
          return http.Response(
              jsonEncode({'code': 'not_found', 'message': 'Fant ikke det du ba om.'}), 404,
              headers: {'content-type': 'application/json'});
        }
        if (body is int) {
          // The shapes the real API answers with, so a screen's error handling
          // is tested against the message a person would actually read.
          final error = switch (body) {
            401 => {'code': 'unauthorized', 'message': 'Feil e-post eller passord.'},
            409 => {'code': 'not_completed', 'message': 'Du kan vurdere når byttet er gjennomført.'},
            413 => {'code': 'file_too_large', 'message': 'Bildet er for stort. Grensen er 10 MB.'},
            _ => {'code': 'error', 'message': 'Noe gikk galt hos oss.'},
          };
          return http.Response(jsonEncode(error), body,
              headers: {'content-type': 'application/json'});
        }
        return http.Response(jsonEncode(body), 200,
            headers: {'content-type': 'application/json; charset=utf-8'});
      });

  Object? _canned(String key, http.Request request) {
    if (export) {
      final hit = exportCanned(key, this);
      if (hit != null) return hit;
    }
    return switch (key) {
        'POST /auth/login' => {'token': 'tok', 'user': me},
        'POST /auth/register' => {'token': 'tok', 'user': me},
        'POST /auth/logout' => {},
        'POST /auth/anonymous' => {'token': deviceToken, 'user': lookingAround},
        'POST /media' => {
            'path': '/media/$storedPhoto',
            'url': 'http://test/media/$storedPhoto',
            'bytes': 3,
          },
        'POST /items/item-drill/share' => {
            'token': shareToken,
            'url': 'http://web/i/$shareToken',
            'text': 'Se denne på Swaply: Bosch drill 18V, verdi 600 kr. '
                'http://web/i/$shareToken',
          },
        'POST /invites' => {
            'token': shareToken,
            'url': 'http://web/i/$shareToken',
            'text': 'Ola N. inviterer deg til Swaply. Si hva du vil ha — når ønskene '
                'lukker en sirkel, bytter dere. http://web/i/$shareToken',
          },
        'GET /invites/$shareToken' => {
            'token': shareToken,
            'url': 'http://web/i/$shareToken',
            'used': false,
            'itemId': 'item-drill',
            'inviter': {'displayName': 'Ola N.', 'town': 'Trondheim'},
            'item': {'title': 'Bosch drill 18V', 'media': <String>[]},
            'shareText': 'Se denne på Swaply: Bosch drill 18V, verdi 600 kr.',
          },
        'GET /me' => me,
        'PUT /me/interests' => me,
        'PATCH /me' => me,
        'GET /discover' => {'total': 2, 'items': [drill, console]},
        'GET /discover/rows' => {
            'rows': [
              {'category': 'verktoy', 'items': [drill]},
              {'category': 'gaming', 'items': [console]},
            ]
          },
        'GET /discover/subcategories' => {'subcategories': ['Elektroverktøy']},
        'GET /items/item-drill' => {...drill, 'owner': kari},
        'GET /items/item-mine' => {
            ...drill,
            'id': 'item-mine',
            'ownerId': me['id'],
            'owner': {'id': me['id'], 'displayName': 'Ola N.'},
          },
        'GET /items/item-console' => {...console, 'owner': kari},
        'POST /items/item-console/like' =>
          {'liked': true, 'tradeId': trade['id'], 'promptToList': false, 'likedCount': 3},
        'POST /items/item-console/message' =>
          {'tradeId': trade['id'], 'threadId': 'thread-1'},
        'GET /me/likes' => {'items': [console]},
        'GET /me/liked-by' => {
            'items': [
              {'item': drill, 'likers': [kari]},
            ]
          },
        'GET /trades' => {
            'waiting': [trade],
            'active': const [],
            'done': const [],
            'yourTurn': 1,
          },
        'GET /trades/trade-1' => trade,
        'GET /trades/trade-1/candidates' =>
          {'yours': [drill, lockedItem], 'theirs': [console], 'counterparty': kari},
        'POST /trades/trade-1/accept' => {'trade': trade, 'everyoneAccepted': false},
        'POST /trades/trade-1/counter' => trade,
        'POST /trades/trade-1/reviews' => {'ok': true},
        'POST /feedback' => {'ok': true},
        'POST /reports' => {'ok': true, 'blocked': true},
        'GET /threads' => {
            'threads': [
              {
                'id': 'thread-1',
                'tradeId': trade['id'],
                'state': 'pending',
                'kind': 'direct',
                'others': [
                  {'id': kari['id'], 'displayName': 'Kari N.'}
                ],
                'subject': 'Bosch drill 18V ⇄ Retro spillkonsoll',
                'unread': 2,
                'lastMessage': {
                  'body': 'Jeg kan sende fiskestangen med PostNord i morgen.',
                  'mine': false,
                  'createdAt': '2026-09-08T14:12:00Z',
                },
              }
            ],
            'unreadTotal': 2,
          },
        'GET /threads/thread-1' => thread,
        'POST /threads/thread-1/read' => {},
        'POST /threads/thread-1/messages' => {
            'id': 'm3',
            'senderId': me['id'],
            'body': 'Passer bra!',
            'mine': true,
            'createdAt': '2026-09-09T09:00:00Z',
          },
        'GET /notifications' => {
            'notifications': [
              {
                'id': 'n1',
                'type': 'item_liked',
                'payload': {'itemId': drill['id'], 'byUserId': kari['id']},
                'actorName': 'Kari',
                'itemTitle': 'Bosch drill 18V',
                'readAt': null,
                'createdAt': '2026-09-09T08:50:00Z',
              },
              {
                'id': 'n2',
                'type': 'trade_partly_accepted',
                'payload': {'tradeId': trade['id']},
                'actorName': null,
                'itemTitle': null,
                'readAt': null,
                'createdAt': '2026-09-09T08:40:00Z',
              },
            ],
            'unread': 2,
          },
        'POST /notifications/read' => {},
        'GET /users/kari-1' => {...kari, 'items': [console], 'interests': ['friluft', 'bat']},
        // The test tooling. The real API answers 404 on every one of these for
        // an account without the flag, which is why the widget tests drive the
        // flag and not these.
        'GET /admin/overview' => {
            'you': {'id': me['id'], 'displayName': 'Ola N.', 'email': 'ola@epost.no'},
            'accounts': [testAccount],
            'diagnostics': {'nodeEnv': 'test', 'inviteOnly': false, 'yourId': me['id']},
            'recent': const [],
          },
        'POST /admin/accounts' => {
            'id': 'test-2',
            'displayName': 'Testbruker To',
            'email': 'testkonto-abc@swaply.test',
          },
        'POST /admin/accounts/test-1/session' =>
          {'token': 'tok-test-1', 'displayName': 'Testbruker Én', 'id': 'test-1'},
        'POST /admin/accounts/test-1/reset' => {'done': ['interesser tømt'], 'freed': const []},
        'POST /admin/scenarios' => {
            'tradeId': trade['id'],
            'steps': ['Kari likte en ting', 'Sirkelen lukket seg — toveis'],
            'participants': const [],
          },
        'POST /admin/trades/trade-1/act' => {'ok': true},
        'POST /admin/items/item-mine/want' =>
          {'tradeId': null, 'promptToList': false, 'likedCount': 1},
        'POST /admin/jobs/sweep-cycles/run' => {'opened': 0, 'tradeIds': const []},
        'GET /admin/state' => {'items': const [], 'trades': const []},
        _ => null,
      };
  }

  // --- fixtures -------------------------------------------------------------

  /// The token a device gets for looking around. Not the one a sign-in gets,
  /// so a test can tell which of the two a request carried.
  static const deviceToken = 'tok-device';

  static const me = {
    'id': 'me-1',
    'displayName': 'Ola N.',
    'email': 'ola@epost.no',
    'phone': '412 34 567',
    'town': 'Trondheim',
    'postalCode': '7030',
    'interests': ['verktoy', 'gaming', 'sykling'],
    'bankidVerified': true,
    'ratingAvg': 4.9,
    'ratingCount': 12,
    'memberSince': '2026-05-02T10:00:00Z',
    'items': [drill],
    'likedByCount': 4,
    'unreadMessages': 2,
    'tradesNeedingYou': 1,
  };

  /// An account the tooling made. Drawn with a badge, never hidden.
  static const testAccount = {
    'id': 'test-1',
    'displayName': 'Testbruker Én',
    'email': 'testkonto-abc@swaply.test',
    'town': 'Trondheim',
    'claimed': true,
    'bankid': false,
    'itemCount': 2,
    'likeCount': 0,
    'openTrades': 0,
  };

  /// The same person as [me], holding the key. `is_admin` is set by the CLI and
  /// by nothing the API can reach, so a test drives it by handing back a row
  /// that already has it.
  static const admin = {...me, 'isAdmin': true};

  /// Acting as somebody: what `GET /me` says once the switcher has minted a
  /// session. `actingAs` is server truth, drawn off the session row.
  static const actingAsTest = {
    ...testAccount,
    'interests': <String>[],
    'items': <Object>[],
    'unreadMessages': 0,
    'tradesNeedingYou': 0,
    'testAccount': true,
    'actingAs': {'adminId': 'me-1', 'adminName': 'Ola N.'},
  };

  /// Long enough to pass the client's own idea of a token.
  static const shareToken = 'inv-token-0123456789';

  /// What the server names a stored photograph: sixteen random bytes in hex.
  static const storedPhoto = '0123456789abcdef0123456789abcdef.jpg';

  /// A device that has been let in and has made nothing: no name, no address,
  /// and the wishes it has expressed are still its own.
  static const lookingAround = {
    'id': 'anon-1',
    'displayName': null,
    'email': null,
    'interests': <String>[],
    'anonymous': true,
    'items': <Object>[],
    'unreadMessages': 0,
    'tradesNeedingYou': 0,
  };

  static const kari = {
    'id': 'kari-1',
    'displayName': 'Kari N.',
    'town': 'Bergen',
    'bankidVerified': true,
    'ratingAvg': 4.8,
    'ratingCount': 23,
    'itemCount': 6,
    'tradeCount': 23,
    'memberSince': '2026-02-01T10:00:00Z',
  };

  static const drill = {
    'id': 'item-drill',
    'ownerId': 'me-1',
    'kind': 'item',
    'title': 'Bosch drill 18V',
    'description': 'Lite brukt, ladar følger med.',
    'category': 'verktoy',
    'subcategory': 'Elektroverktøy',
    'condition': 'good',
    'estimatedValueNok': 600,
    'town': 'Trondheim',
    'status': 'available',
    'reserved': false,
    'cover': null,
    'media': <String>[],
    'likedByMe': false,
    'likeCount': 3,
    'createdAt': '2026-09-01T10:00:00Z',
  };

  static const console = {
    'id': 'item-console',
    'ownerId': 'kari-1',
    'kind': 'item',
    'title': 'Retro spillkonsoll',
    'category': 'gaming',
    'condition': 'good',
    'estimatedValueNok': 1200,
    'town': 'Bergen',
    'status': 'available',
    'reserved': false,
    'media': <String>[],
    'likedByMe': false,
    'createdAt': '2026-09-02T10:00:00Z',
  };

  static const lockedItem = {
    'id': 'item-bike',
    'ownerId': 'me-1',
    'kind': 'item',
    'title': 'Bysykkel, dame',
    'category': 'sykling',
    'condition': 'good',
    'estimatedValueNok': 1100,
    'status': 'reserved',
    'reserved': true,
    'media': <String>[],
    'lockedByOtherTrade': true,
    'createdAt': '2026-09-02T10:00:00Z',
  };

  static const trade = {
    'id': 'trade-1',
    'state': 'pending',
    'kind': 'direct',
    'closedAt': null,
    'closeReason': null,
    'offerId': 'offer-1',
    'offerSeq': 1,
    'counterOfferBy': null,
    'you': {
      'userId': 'me-1',
      'position': 0,
      'accepted': false,
      'sentAt': null,
      'receivedAt': null,
      'paidAt': null,
    },
    'givingTo': {...kari, 'position': 1},
    'receivingFrom': {...kari, 'position': 1},
    'youGive': [drill],
    'youGet': [console],
    'otherLegs': <Map<String, Object?>>[],
    'youGiveValue': 600,
    'youGetValue': 1200,
    'difference': 600,
    'cash': {
      'amountNok': 350,
      'youPay': true,
      'payer': me,
      'payee': kari,
      'payeePhone': '911 22 333',
    },
    'participants': [
      {...me, 'position': 0, 'accepted': false, 'gives': [drill]},
      {...kari, 'position': 1, 'accepted': true, 'gives': [console]},
    ],
    'threadId': 'thread-1',
    'lastMessage': {
      'body': 'Legg til hjelmen, så er vi skuls?',
      'senderName': 'Kari N.',
      'mine': false,
      'createdAt': '2026-09-09T08:00:00Z',
    },
    'withdrawal': null,
    'snapshots': <Map<String, Object?>>[],
    'yourReview': null,
  };

  static const thread = {
    'id': 'thread-1',
    'tradeId': 'trade-1',
    'state': 'pending',
    'kind': 'direct',
    'banner': null,
    'participants': [
      {'id': 'me-1', 'displayName': 'Ola N.', 'position': 0},
      {'id': 'kari-1', 'displayName': 'Kari N.', 'position': 1},
    ],
    'messages': [
      {
        'id': 'm1',
        'senderId': 'kari-1',
        'senderName': 'Kari N.',
        'body': 'Heihei! Jeg kan møtes ved Nidarosdomen i morgen, passer det?',
        'mine': false,
        'createdAt': '2026-09-09T07:02:00Z',
      },
      {
        'id': 'm2',
        'senderId': 'me-1',
        'senderName': 'Ola N.',
        'body': 'Passer bra! Kl. 17?',
        'mine': true,
        'createdAt': '2026-09-09T07:10:00Z',
      },
    ],
  };
}

/// A refusal with a code of its own, for the ones the status shorthand has no
/// word for. The message is the server's own, as a person would read it.
class Refusal {
  const Refusal(this.status, this.code, this.message);
  final int status;
  final String code, message;

  /// `/auth/anonymous` on a server that lets nobody in without a key.
  static const inviteRequired = Refusal(403, 'invite_required',
      'Swaply er invitasjonsbasert. Du trenger en invitasjon fra noen som allerede er med.');

  /// `/auth/anonymous` for a device id whose account has since been claimed.
  static const deviceClaimed = Refusal(409, 'device_claimed',
      'Denne enheten hører allerede til en konto. Logg inn med e-post og passord.');
}

/// No answer: no network, or no server behind the address.
const unreachable = _Unreachable();

class _Unreachable {
  const _Unreachable();
}

/// The chain variant, which is the one screen that has to make a three-person
/// loop legible and carries the banner saying we do not facilitate it.
Map<String, Object?> chainTrade() => {
      ...FakeServer.trade,
      'id': 'trade-chain',
      'kind': 'chain',
      'cash': null,
      'otherLegs': [
        {
          'giver': FakeServer.kari,
          'receiver': FakeServer.me,
          'items': [FakeServer.console],
        }
      ],
      'participants': [
        {...FakeServer.me, 'position': 0, 'accepted': false, 'gives': [FakeServer.drill]},
        {...FakeServer.kari, 'position': 1, 'accepted': true, 'gives': [FakeServer.console]},
        {
          'id': 'per-1',
          'displayName': 'Per H.',
          'position': 2,
          'accepted': false,
          'gives': [FakeServer.lockedItem],
        },
      ],
    };
