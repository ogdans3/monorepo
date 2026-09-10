// The people and things the round-5 export draws.
//
// A golden is only worth comparing with the frame it was drawn from if the two
// show the same things, so this is Ola's world as the export has it: his four
// things, Kari with six, a trade waiting on him and one waiting on Anne, three
// chats, the people who liked his drill. The photographs are the export's own.
import 'fake_server.dart';

const photos = 'http://test/photos/';

/// Everything with a picture in the export, by the file the fake serves.
const photoFiles = [
  'drill.jpg',
  'console.jpg',
  'bike-white.jpg',
  'bike-black.jpg',
  'skateboard.jpg',
  'tshirts.jpg',
  'kayak.jpg',
];

/// «14:12» today, «i går», «tirsdag»: times relative to when the test runs.
String _at(int daysAgo, int hour, int minute) {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day - daysAgo, hour, minute).toUtc().toIso8601String();
}

Map<String, Object?> _item(
  String id,
  String owner,
  String title,
  int value,
  String category, {
  String? photo,
  String subcategory = '',
  String status = 'available',
  String town = 'Trondheim',
  int likes = 0,
  String? description,
}) =>
    {
      'id': id,
      'ownerId': owner,
      'kind': 'item',
      'title': title,
      'description': description,
      'category': category,
      'subcategory': subcategory,
      'condition': 'good',
      'estimatedValueNok': value,
      'town': town,
      'status': status,
      'reserved': status == 'reserved',
      'cover': photo == null ? null : '$photos$photo',
      'media': photo == null ? <String>[] : ['$photos$photo'],
      'likedByMe': false,
      'likeCount': likes,
      'createdAt': '2026-09-01T10:00:00Z',
    };

// Ola's things, in the order and states 13 shows them.
final drill = _item('item-drill', 'me-1', 'Bosch drill 18V', 600, 'verktoy',
    photo: 'drill.jpg',
    subcategory: 'Elektroverktøy',
    likes: 3,
    description: 'Lite brukt, lader følger med.');
final helmet = _item('item-helmet', 'me-1', 'Sykkelhjelm', 250, 'sykling',
    photo: 'bike-black.jpg', status: 'reserved', likes: 1);
final skateboard =
    _item('item-skate', 'me-1', 'Skateboard', 450, 'sport', photo: 'skateboard.jpg', status: 'traded');
final sweater = _item('item-sweater', 'me-1', 'Ullgenser M', 300, 'klaer', photo: 'tshirts.jpg');

// Kari's six.
final console = _item('item-console', 'kari-1', 'Retro spillkonsoll', 1200, 'gaming',
    photo: 'console.jpg',
    town: 'Bergen',
    description: 'Fungerer som den skal, to kontrollere og alle kabler. Litt riper på lokket.');
final rod = _item('item-rod', 'kari-1', 'Fiskestang med snelle', 850, 'friluft',
    subcategory: 'Fiske',
    town: 'Bergen',
    description: 'Shimano-stang, 2,7 m, brukt to somre. Snelle følger med. '
        'Litt kosmetisk slitasje på håndtaket.');
final kayak = _item('item-kayak', 'kari-1', 'Kajakk med åre', 2400, 'bat',
    photo: 'kayak.jpg', town: 'Bergen');
final kariSweater =
    _item('item-ksweater', 'kari-1', 'Ullgenser M', 300, 'klaer', photo: 'tshirts.jpg', town: 'Bergen');
final roadbike = _item('item-roadbike', 'kari-1', 'Landeveissykkel', 4200, 'sykling',
    photo: 'bike-black.jpg', town: 'Bergen');
final mtb = _item('item-mtb', 'kari-1', 'Terrengsykkel 26"', 2500, 'sykling',
    photo: 'bike-white.jpg', town: 'Bergen');

// What a search for «sykkel» finds, in the order 05 lays it out.
final trailer = _item('item-trailer', 'anne-1', 'Sykkelvogn', 900, 'sykling',
    photo: 'bike-black.jpg', town: 'Melhus');
final citybike = _item('item-citybike', 'per-1', 'Bysykkel, dame', 1100, 'sykling',
    photo: 'bike-white.jpg', town: 'Stjørdal');
final anneHelmet = _item('item-ahelmet', 'anne-1', 'Sykkelhjelm', 250, 'sykling',
    photo: 'bike-black.jpg', town: 'Melhus');
final kidsbike = _item('item-kidsbike', 'per-1', 'Barnesykkel 20"', 600, 'sykling', town: 'Stjørdal');
final anneSweater =
    _item('item-asweater', 'anne-1', 'Ullgenser M', 300, 'klaer', photo: 'tshirts.jpg', town: 'Melhus');

final me = {
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
  'items': [drill, helmet, skateboard, sweater],
  'likedByCount': 4,
  'unreadMessages': 2,
  'tradesNeedingYou': 1,
};

final kari = {
  'id': 'kari-1',
  'displayName': 'Kari N.',
  'town': 'Bergen',
  'bankidVerified': true,
  'ratingAvg': 4.8,
  'ratingCount': 23,
  'itemCount': 6,
  'tradeCount': 23,
  'memberSince': '2026-02-01T10:00:00Z',
  'interests': ['friluft', 'bat', 'klaer', 'sykling'],
};

final anne = {
  'id': 'anne-1',
  'displayName': 'Anne B.',
  'town': 'Melhus',
  'bankidVerified': true,
  'ratingAvg': 4.7,
  'ratingCount': 9,
  'itemCount': 4,
  'tradeCount': 9,
  'memberSince': '2026-03-12T10:00:00Z',
};

final per = {
  'id': 'per-1',
  'displayName': 'Per H.',
  'town': 'Stjørdal',
  'bankidVerified': false,
  'ratingAvg': 4.5,
  'ratingCount': 4,
  'itemCount': 7,
  'tradeCount': 4,
  'memberSince': '2026-06-20T10:00:00Z',
};

int _sum(List<Map<String, Object?>> items) =>
    items.fold(0, (a, i) => a + (i['estimatedValueNok'] as int));

Map<String, Object?> _trade({
  required String id,
  required String state,
  required Map<String, Object?> other,
  required List<Map<String, Object?>> give,
  required List<Map<String, Object?>> get,
  String kind = 'direct',
  bool youAccepted = false,
  bool otherAccepted = true,
  Map<String, Object?>? cash,
  Map<String, Object?>? lastMessage,
  String? threadId,
  Map<String, Object?>? givingTo,
  List<Map<String, Object?>> otherLegs = const [],
  List<Map<String, Object?>> extraParticipants = const [],
  String? closedAt,
}) =>
    {
      'id': id,
      'state': state,
      'kind': kind,
      'closedAt': closedAt,
      'closeReason': null,
      'offerId': 'offer-$id',
      'offerSeq': 1,
      'counterOfferBy': null,
      'you': {
        'userId': 'me-1',
        'position': 0,
        'accepted': youAccepted,
        'sentAt': null,
        'receivedAt': null,
        'paidAt': null,
      },
      'givingTo': {...(givingTo ?? other), 'position': givingTo == null ? 1 : 2},
      'receivingFrom': {...other, 'position': 1},
      'youGive': give,
      'youGet': get,
      'otherLegs': otherLegs,
      'youGiveValue': _sum(give),
      'youGetValue': _sum(get),
      'difference': (_sum(get) - _sum(give)).abs(),
      'cash': cash,
      'participants': [
        {...me, 'position': 0, 'accepted': youAccepted, 'gives': give},
        {...other, 'position': 1, 'accepted': otherAccepted, 'gives': get},
        ...extraParticipants,
      ],
      'threadId': threadId,
      'lastMessage': lastMessage,
      'withdrawal': null,
      'snapshots': <Map<String, Object?>>[],
      'yourReview': null,
    };

/// 06b: your drill and helmet for Kari's console, 350 kr on top, Kari has
/// said yes and it is your turn.
Map<String, Object?> exportTrade1() => _trade(
      id: 'trade-1',
      state: 'pending',
      other: kari,
      give: [drill, helmet],
      get: [console],
      cash: {
        'amountNok': 350,
        'youPay': true,
        'payer': me,
        'payee': kari,
        'payeePhone': '911 22 333',
      },
      lastMessage: {
        'body': 'Legg til hjelmen, så er vi skuls?',
        'senderName': 'Kari N.',
        'mine': false,
        'createdAt': _at(0, 8, 0),
      },
      threadId: 'thread-1',
    );

/// 11, first card: the chain — Kari gives you the rod, you give Per the drill.
Map<String, Object?> exportChain() => _trade(
      id: 'trade-chain',
      state: 'pending',
      kind: 'chain',
      other: kari,
      givingTo: per,
      give: [drill],
      get: [rod],
      otherLegs: [
        {'giver': per, 'receiver': kari, 'items': [citybike]},
      ],
      extraParticipants: [
        {...per, 'position': 2, 'accepted': false, 'gives': [citybike]},
      ],
      threadId: 'thread-per',
    );

/// 11, second card: you said yes, Anne has not.
Map<String, Object?> exportAnneTrade() => _trade(
      id: 'trade-anne',
      state: 'pending',
      other: anne,
      give: [skateboard],
      get: [anneSweater],
      youAccepted: true,
      otherAccepted: false,
      threadId: 'thread-anne',
    );

Map<String, Object?> _done(String id, Map<String, Object?> other, List<Map<String, Object?>> give,
        List<Map<String, Object?>> get) =>
    _trade(
        id: id,
        state: 'completed',
        other: other,
        give: give,
        get: get,
        youAccepted: true,
        closedAt: _at(9, 12, 0));

final _threads = [
  {
    'id': 'thread-1',
    'tradeId': 'trade-1',
    'state': 'pending',
    'kind': 'direct',
    'others': [
      {'id': 'kari-1', 'displayName': 'Kari N.'}
    ],
    'subject': 'Bytte · drill ⇄ konsoll',
    'unread': 1,
    'lastMessage': {'body': 'Perfekt, sees da!', 'mine': false, 'createdAt': _at(0, 14, 12)},
  },
  {
    'id': 'thread-per',
    'tradeId': 'trade-chain',
    'state': 'pending',
    'kind': 'chain',
    'others': [
      {'id': 'per-1', 'displayName': 'Per H.'},
      {'id': 'kari-1', 'displayName': 'Kari N.'},
    ],
    'subject': 'Treveis-swap · avtales i chat',
    'unread': 1,
    'lastMessage': {
      'body': 'Jeg kan sende fiskestangen med PostNord i morgen.',
      'mine': false,
      'createdAt': _at(1, 18, 5),
    },
  },
  {
    'id': 'thread-anne',
    'tradeId': 'trade-done-1',
    'state': 'completed',
    'kind': 'direct',
    'others': [
      {'id': 'anne-1', 'displayName': 'Anne B.'}
    ],
    'subject': 'Fullført bytte',
    'unread': 0,
    'lastMessage': {'body': 'Takk for byttet!', 'mine': false, 'createdAt': _at(3, 9, 30)},
  },
];

/// 06g, word for word.
final _thread1 = {
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
      'createdAt': _at(0, 14, 2),
    },
    {
      'id': 'm2',
      'senderId': 'me-1',
      'senderName': 'Ola N.',
      'body': 'Passer bra! Kl. 17? Jeg tar med drillen og hjelmen.',
      'mine': true,
      'createdAt': _at(0, 14, 10),
    },
    {
      'id': 'm3',
      'senderId': 'kari-1',
      'senderName': 'Kari N.',
      'body': 'Perfekt, sees da!',
      'mine': false,
      'createdAt': _at(0, 14, 12),
    },
  ],
};

/// What the export's screens ask for; null falls through to the small set.
Object? exportCanned(String key, FakeServer server) => switch (key) {
      'POST /auth/login' || 'POST /auth/register' => {'token': 'tok', 'user': me},
      'GET /me' || 'PUT /me/interests' || 'PATCH /me' => me,
      // Two uploads, two different pictures, so 10b shows «foto 1» and «foto 2».
      'POST /media' => () {
          final file = ['bike-white.jpg', 'drill.jpg'][server.uploads++ % 2];
          return {'path': '/media/$file', 'url': '$photos$file', 'bytes': 3};
        }(),
      'GET /discover' => {
          'total': 24,
          'items': [mtb, trailer, citybike, anneHelmet, kidsbike, roadbike],
        },
      'GET /discover/subcategories' => {
          'subcategories': ['Sykler', 'Elsykler', 'Barnesykler', 'Deler', 'Utstyr'],
        },
      'GET /items/item-console' => {...console, 'owner': kari},
      'GET /items/item-rod' => {...rod, 'owner': kari},
      'GET /items/item-drill' => {...drill, 'owner': me},
      'GET /trades' => {
          'waiting': [exportChain(), exportAnneTrade()],
          'active': [
            _trade(
                id: 'trade-active',
                state: 'accepted',
                other: per,
                give: [sweater],
                get: [kidsbike],
                youAccepted: true),
          ],
          'done': [
            _done('trade-done-1', anne, [skateboard], [anneSweater]),
            _done('trade-done-2', per, [helmet], [citybike]),
            _done('trade-done-3', kari, [sweater], [kariSweater]),
          ],
          'yourTurn': 1,
        },
      'GET /trades/trade-1' => exportTrade1(),
      'GET /trades/trade-chain' => exportChain(),
      'GET /trades/trade-anne' => exportAnneTrade(),
      'GET /trades/trade-1/candidates' => {
          'yours': [drill, helmet, sweater, skateboard],
          'theirs': [console, rod, kayak],
          'counterparty': kari,
        },
      'GET /me/liked-by' => {
          'items': [
            {
              'item': drill,
              'likers': [kari, anne, per],
            },
            {
              'item': helmet,
              'likers': [anne],
            },
            {'item': sweater, 'likers': <Object>[]},
          ]
        },
      'GET /threads' => {'threads': _threads, 'unreadTotal': 2},
      'GET /threads/thread-1' => _thread1,
      'GET /users/kari-1' => {
          ...kari,
          'items': [rod, kayak, kariSweater, roadbike, trailer, mtb],
        },
      _ => null,
    };
