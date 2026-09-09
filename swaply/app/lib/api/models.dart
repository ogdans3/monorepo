// Wire models. Every field the round 5 screens read, and nothing they do not.

int? _int(dynamic v) => v == null ? null : (v as num).round();
double? _double(dynamic v) => v == null ? null : (v as num).toDouble();
DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String).toLocal();

class Me {
  Me.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        displayName = j['displayName'] as String?,
        email = j['email'] as String?,
        phone = j['phone'] as String?,
        town = j['town'] as String?,
        interests = (j['interests'] as List?)?.cast<String>() ?? const [],
        bankidVerified = j['bankidVerified'] as bool? ?? false,
        ratingAvg = _double(j['ratingAvg']),
        ratingCount = _int(j['ratingCount']) ?? 0,
        memberSince = _date(j['memberSince']),
        items = ((j['items'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList(),
        likedByCount = _int(j['likedByCount']) ?? 0,
        unreadMessages = _int(j['unreadMessages']) ?? 0,
        tradesNeedingYou = _int(j['tradesNeedingYou']) ?? 0,
        anonymous = j['anonymous'] as bool? ?? false;

  final String id;
  final String? displayName, email, phone, town;
  final List<String> interests;
  final bool bankidVerified;
  final double? ratingAvg;
  final int ratingCount, likedByCount, unreadMessages, tradesNeedingYou;
  final DateTime? memberSince;
  final List<Item> items;

  /// Looking around on this device, with no profile yet. Everything that puts
  /// you in front of another person — listing, writing, accepting — waits for
  /// 10c.
  final bool anonymous;
}

/// A photograph the server has taken in. The listing is created with [path];
/// the strip on 10b draws [url]. The two are different on purpose — a row holds
/// where the bytes are, never which hostname is in front of them.
class UploadedImage {
  UploadedImage.fromJson(Map<String, dynamic> j)
      : path = j['path'] as String,
        url = j['url'] as String,
        bytes = _int(j['bytes']) ?? 0;

  final String path, url;
  final int bytes;
}

/// A link to hand somebody, and the line that travels with it. The server
/// writes the text: it is the same sentence on every client, and it has a
/// «verdi 600 kr» in it that has to be formatted exactly once.
class ShareLink {
  ShareLink.fromJson(Map<String, dynamic> j)
      : token = j['token'] as String,
        url = j['url'] as String,
        text = j['text'] as String;

  final String token, url, text;
}

/// What is behind an invitation before it is spent — read by the screen that
/// greets somebody arriving from a link.
class InvitePreview {
  InvitePreview.fromJson(Map<String, dynamic> j)
      : token = j['token'] as String,
        used = j['used'] as bool? ?? false,
        inviterName = (j['inviter'] as Map<String, dynamic>?)?['displayName'] as String?,
        itemTitle = (j['item'] as Map<String, dynamic>?)?['title'] as String?;

  final String token;
  final bool used;
  final String? inviterName, itemTitle;
}

class UserRef {
  UserRef.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String? ?? '',
        displayName = j['displayName'] as String? ?? 'Slettet bruker',
        town = j['town'] as String?,
        bankidVerified = j['bankidVerified'] as bool? ?? false,
        ratingAvg = _double(j['ratingAvg']),
        ratingCount = _int(j['ratingCount']) ?? 0,
        itemCount = _int(j['itemCount']),
        tradeCount = _int(j['tradeCount']),
        position = _int(j['position']),
        memberSince = _date(j['memberSince']),
        interests = (j['interests'] as List?)?.cast<String>() ?? const [],
        items = ((j['items'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList(),
        blockedByYou = j['blockedByYou'] as bool? ?? false,
        accepted = j['accepted'] as bool?,
        sentAt = _date(j['sentAt']),
        receivedAt = _date(j['receivedAt']),
        paidAt = _date(j['paidAt']),
        gives = ((j['gives'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList();

  final String id, displayName;
  final String? town;
  final bool bankidVerified, blockedByYou;
  final double? ratingAvg;
  final int ratingCount;
  final int? itemCount, tradeCount, position;
  final DateTime? memberSince, sentAt, receivedAt, paidAt;
  final List<String> interests;
  final List<Item> items, gives;
  final bool? accepted;

  /// «O» in a circle, the way every avatar in the export is drawn.
  String get initial => displayName.isEmpty ? '?' : displayName.substring(0, 1).toUpperCase();
}

class Item {
  Item.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        ownerId = j['ownerId'] as String?,
        kind = j['kind'] as String? ?? 'item',
        title = j['title'] as String? ?? '',
        description = j['description'] as String?,
        category = j['category'] as String? ?? 'diverse',
        subcategory = j['subcategory'] as String?,
        condition = j['condition'] as String?,
        estimatedValueNok = _int(j['estimatedValueNok']),
        town = j['town'] as String?,
        status = j['status'] as String? ?? 'available',
        reserved = j['reserved'] as bool? ?? false,
        cover = j['cover'] as String?,
        media = (j['media'] as List?)?.cast<String>() ?? const [],
        likedByMe = j['likedByMe'] as bool? ?? false,
        likeCount = _int(j['likeCount']),
        inOffer = j['inOffer'] as bool? ?? false,
        lockedByOtherTrade = j['lockedByOtherTrade'] as bool? ?? false,
        owner = j['owner'] == null ? null : UserRef.fromJson(j['owner']);

  final String id, kind, title, category, status;
  final String? ownerId, description, subcategory, condition, town, cover;
  final int? estimatedValueNok, likeCount;
  final List<String> media;
  final bool likedByMe, reserved, inOffer, lockedByOtherTrade;
  final UserRef? owner;
}

class TradeCash {
  TradeCash.fromJson(Map<String, dynamic> j)
      : amountNok = _int(j['amountNok']) ?? 0,
        youPay = j['youPay'] as bool? ?? false,
        payer = UserRef.fromJson(j['payer']),
        payee = UserRef.fromJson(j['payee']),
        payeePhone = j['payeePhone'] as String?;

  final int amountNok;
  final bool youPay;
  final UserRef payer, payee;
  final String? payeePhone;
}

class TradeLeg {
  TradeLeg.fromJson(Map<String, dynamic> j)
      : giver = UserRef.fromJson(j['giver']),
        receiver = UserRef.fromJson(j['receiver']),
        items = ((j['items'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList();

  final UserRef giver, receiver;
  final List<Item> items;
}

class Withdrawal {
  Withdrawal.fromJson(Map<String, dynamic> j)
      : byYou = j['byYou'] as bool? ?? false,
        state = j['state'] as String? ?? 'waiting',
        respondsBy = _date(j['respondsBy']),
        blockedBySent = j['blockedBySent'] as bool? ?? false;

  final bool byYou, blockedBySent;
  final String state;
  final DateTime? respondsBy;
}

class TradeSnapshot {
  TradeSnapshot.fromJson(Map<String, dynamic> j)
      : title = j['title'] as String? ?? '',
        giverPosition = _int(j['giverPosition']) ?? 0,
        estimatedValueNok = _int(j['estimatedValueNok']),
        cover = j['cover'] as String?;

  final String title;
  final int giverPosition;
  final int? estimatedValueNok;
  final String? cover;
}

class MessagePreview {
  MessagePreview.fromJson(Map<String, dynamic> j)
      : body = j['body'] as String? ?? '',
        senderName = j['senderName'] as String?,
        mine = j['mine'] as bool? ?? false,
        createdAt = _date(j['createdAt']);

  final String body;
  final String? senderName;
  final bool mine;
  final DateTime? createdAt;
}

class Trade {
  Trade.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        state = j['state'] as String,
        kind = j['kind'] as String? ?? 'direct',
        closedAt = _date(j['closedAt']),
        closeReason = j['closeReason'] as String?,
        offerId = j['offerId'] as String?,
        offerSeq = _int(j['offerSeq']),
        counterOfferBy = j['counterOfferBy'] as String?,
        youPosition = _int(j['you']?['position']) ?? 0,
        youAccepted = j['you']?['accepted'] as bool? ?? false,
        youSentAt = _date(j['you']?['sentAt']),
        youReceivedAt = _date(j['you']?['receivedAt']),
        youPaidAt = _date(j['you']?['paidAt']),
        givingTo = UserRef.fromJson(j['givingTo']),
        receivingFrom = UserRef.fromJson(j['receivingFrom']),
        youGive = ((j['youGive'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList(),
        youGet = ((j['youGet'] as List?) ?? const []).map((e) => Item.fromJson(e)).toList(),
        otherLegs = ((j['otherLegs'] as List?) ?? const []).map((e) => TradeLeg.fromJson(e)).toList(),
        youGiveValue = _int(j['youGiveValue']) ?? 0,
        youGetValue = _int(j['youGetValue']) ?? 0,
        difference = _int(j['difference']) ?? 0,
        cash = j['cash'] == null ? null : TradeCash.fromJson(j['cash']),
        participants =
            ((j['participants'] as List?) ?? const []).map((e) => UserRef.fromJson(e)).toList(),
        threadId = j['threadId'] as String?,
        lastMessage =
            j['lastMessage'] == null ? null : MessagePreview.fromJson(j['lastMessage']),
        withdrawal = j['withdrawal'] == null ? null : Withdrawal.fromJson(j['withdrawal']),
        snapshots =
            ((j['snapshots'] as List?) ?? const []).map((e) => TradeSnapshot.fromJson(e)).toList(),
        yourReviewScore = _int(j['yourReview']?['score']),
        yourReviewComment = j['yourReview']?['comment'] as String?;

  final String id, state, kind;
  final DateTime? closedAt, youSentAt, youReceivedAt, youPaidAt;
  final String? closeReason, offerId, counterOfferBy, threadId, yourReviewComment;
  final int? offerSeq, yourReviewScore;
  final int youPosition, youGiveValue, youGetValue, difference;
  final bool youAccepted;
  final UserRef givingTo, receivingFrom;
  final List<Item> youGive, youGet;
  final List<TradeLeg> otherLegs;
  final TradeCash? cash;
  final List<UserRef> participants;
  final MessagePreview? lastMessage;
  final Withdrawal? withdrawal;
  final List<TradeSnapshot> snapshots;

  bool get isChain => kind == 'chain';
  bool get everyoneAccepted => participants.every((p) => p.accepted == true);
  UserRef? get counterparty => participants.where((p) => p.position != youPosition).firstOrNull;
}

extension FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class ChatSummary {
  ChatSummary.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        tradeId = j['tradeId'] as String,
        state = j['state'] as String,
        kind = j['kind'] as String? ?? 'direct',
        others = ((j['others'] as List?) ?? const [])
            .map((e) => (e as Map<String, dynamic>)['displayName'] as String? ?? 'Slettet bruker')
            .toList(),
        subject = j['subject'] as String?,
        unread = _int(j['unread']) ?? 0,
        lastMessage = j['lastMessage'] == null ? null : MessagePreview.fromJson(j['lastMessage']);

  final String id, tradeId, state, kind;
  final List<String> others;
  final String? subject;
  final int unread;
  final MessagePreview? lastMessage;
}

class ChatMessage {
  ChatMessage.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        senderId = j['senderId'] as String,
        senderName = j['senderName'] as String?,
        body = j['body'] as String? ?? '',
        mine = j['mine'] as bool? ?? false,
        createdAt = _date(j['createdAt']);

  final String id, senderId, body;
  final String? senderName;
  final bool mine;
  final DateTime? createdAt;
}

class Thread {
  Thread.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        tradeId = j['tradeId'] as String,
        state = j['state'] as String,
        kind = j['kind'] as String? ?? 'direct',
        banner = j['banner'] as String?,
        participants =
            ((j['participants'] as List?) ?? const []).map((e) => UserRef.fromJson(e)).toList(),
        messages =
            ((j['messages'] as List?) ?? const []).map((e) => ChatMessage.fromJson(e)).toList();

  final String id, tradeId, state, kind;
  final String? banner;
  final List<UserRef> participants;
  final List<ChatMessage> messages;
}

class AppNotification {
  AppNotification.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        type = j['type'] as String,
        payload = (j['payload'] as Map?)?.cast<String, dynamic>() ?? const {},
        actorName = j['actorName'] as String?,
        itemTitle = j['itemTitle'] as String?,
        readAt = _date(j['readAt']),
        createdAt = _date(j['createdAt']);

  final String id, type;
  final Map<String, dynamic> payload;
  final String? actorName, itemTitle;
  final DateTime? readAt, createdAt;
}

class LikedByRow {
  LikedByRow.fromJson(Map<String, dynamic> j)
      : item = Item.fromJson(j['item']),
        likers = ((j['likers'] as List?) ?? const []).map((e) => UserRef.fromJson(e)).toList();

  final Item item;
  final List<UserRef> likers;
}
