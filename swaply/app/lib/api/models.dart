// Wire models. Every field the round 5 screens read, and nothing they do not.

int? _int(dynamic v) => v == null ? null : (v as num).round();
double? _double(dynamic v) => v == null ? null : (v as num).toDouble();
DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String).toLocal();

class Me {
  Me.fromJson(Map<String, dynamic> j)
      : _json = j,
        id = j['id'] as String,
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
        hiddenCount = _int(j['hiddenCount']),
        anonymous = j['anonymous'] as bool? ?? false,
        isAdmin = j['isAdmin'] as bool? ?? false,
        testAccount = j['testAccount'] as bool? ?? false,
        actingAsAdminId = (j['actingAs'] as Map<String, dynamic>?)?['adminId'] as String?,
        actingAsAdminName = (j['actingAs'] as Map<String, dynamic>?)?['adminName'] as String?;

  final String id;
  final String? displayName, email, phone, town;
  final List<String> interests;
  final bool bankidVerified;
  final double? ratingAvg;
  final int ratingCount, likedByCount, unreadMessages, tradesNeedingYou;
  final DateTime? memberSince;
  final List<Item> items;

  /// How many kinds «Ikke vis meg slike» has taken off Oppdag for this
  /// account. Counted rather than listed: hiding is a choice somebody can
  /// forget having made, and `DELETE /me/hidden` undoes all of it at once.
  /// Null when the answer did not say — not zero: read as zero, a sign-in
  /// from a server that left it out offered to undo one kind by showing
  /// every kind again.
  final int? hiddenCount;

  /// Looking around on this device, with no profile yet. Everything that puts
  /// you in front of another person — listing, writing, accepting — waits for
  /// 10c.
  final bool anonymous;

  /// The test tooling's key. False for everybody, and the server answers 404 on
  /// every admin route regardless — this only decides whether the app draws the
  /// section at all.
  final bool isAdmin;

  /// «This account exists so an admin can test.» Drawn, never hidden.
  final bool testAccount;

  /// Who minted this session through the account switcher, when somebody did.
  /// Server truth, so a refresh cannot lose it — this is what the floor above
  /// the bottom nav draws itself from.
  final String? actingAsAdminId, actingAsAdminName;

  bool get actingAs => actingAsAdminId != null;

  /// What this was read from, for [withInterests].
  final Map<String, dynamic> _json;

  /// This account with [interests] in place of its own, and the rest as it
  /// was. For the answer to `PUT /me/interests`, which is the profile alone:
  /// taken whole, it had none of the things, the counts or who is acting
  /// that only `GET /me` lists.
  Me withInterests(List<String> interests) => Me.fromJson({..._json, 'interests': interests});
}

/// An account the test tooling made, as the switcher lists it.
class TestAccount {
  TestAccount.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        displayName = j['displayName'] as String? ?? 'Uten navn',
        email = j['email'] as String?,
        town = j['town'] as String?,
        claimed = j['claimed'] as bool? ?? true,
        bankid = j['bankid'] as bool? ?? false,
        itemCount = _int(j['itemCount']) ?? 0,
        likeCount = _int(j['likeCount']) ?? 0,
        openTrades = _int(j['openTrades']) ?? 0;

  final String id, displayName;
  final String? email, town;
  final bool claimed, bankid;
  final int itemCount, likeCount, openTrades;
}

class AdminOverview {
  AdminOverview.fromJson(Map<String, dynamic> j)
      : youId = (j['you'] as Map<String, dynamic>)['id'] as String,
        youName = (j['you'] as Map<String, dynamic>)['displayName'] as String? ?? 'Deg',
        accounts =
            ((j['accounts'] as List?) ?? const []).map((e) => TestAccount.fromJson(e)).toList(),
        diagnostics = ((j['diagnostics'] as Map?) ?? const {}).cast<String, dynamic>(),
        recent = ((j['recent'] as List?) ?? const [])
            .map((e) => (
                  method: e['method'] as String? ?? '',
                  path: e['path'] as String? ?? '',
                  at: _date(e['at']),
                ))
            .toList();

  final String youId, youName;
  final List<TestAccount> accounts;
  final Map<String, dynamic> diagnostics;
  final List<({String method, String path, DateTime? at})> recent;
}

/// What «Bygg et bytte» did, in order, so the screen can say it.
class BuiltScenario {
  BuiltScenario.fromJson(Map<String, dynamic> j)
      : tradeId = j['tradeId'] as String?,
        steps = ((j['steps'] as List?) ?? const []).cast<String>();

  final String? tradeId;
  final List<String> steps;
}

/// Tilstand — what the product screens deliberately hide.
class AdminState {
  AdminState.fromJson(Map<String, dynamic> j)
      : items = ((j['items'] as List?) ?? const [])
            .map((e) => (
                  title: e['title'] as String? ?? '',
                  ownerName: e['ownerName'] as String? ?? '',
                  status: e['status'] as String? ?? '',
                  activeTradeState: e['activeTradeState'] as String?,
                ))
            .toList(),
        trades = ((j['trades'] as List?) ?? const [])
            .map((e) => (
                  id: e['id'] as String,
                  state: e['state'] as String? ?? '',
                  kind: e['kind'] as String? ?? 'direct',
                  offerSeq: _int(e['offerSeq']),
                  participants: ((e['participants'] as List?) ?? const [])
                      .map((p) => (
                            displayName: p['displayName'] as String? ?? '',
                            position: _int(p['position']) ?? 0,
                            accepted: p['acceptedCurrentOffer'] as bool? ?? false,
                            sent: p['sent'] as bool? ?? false,
                            received: p['received'] as bool? ?? false,
                          ))
                      .toList(),
                ))
            .toList();

  final List<({String title, String ownerName, String status, String? activeTradeState})> items;
  final List<
      ({
        String id,
        String state,
        String kind,
        int? offerSeq,
        List<({String displayName, int position, bool accepted, bool sent, bool received})>
            participants
      })> trades;
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
        itemTitle = (j['item'] as Map<String, dynamic>?)?['title'] as String?,
        itemId = j['itemId'] as String?;

  final String token;
  final bool used;
  final String? inviterName, itemTitle;

  /// The listing behind the link, for somebody who is already signed in and can
  /// simply be shown it. Null for the page a stranger reads.
  final String? itemId;
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
        owner = j['owner'] == null ? null : UserRef.fromJson(j['owner']),
        conversation =
            j['conversation'] == null ? null : ItemConversation.fromJson(j['conversation']);

  final String id, kind, title, category, status;
  final String? ownerId, description, subcategory, condition, town, cover;
  final int? estimatedValueNok, likeCount;
  final List<String> media;
  final bool likedByMe, reserved, inOffer, lockedByOtherTrade;
  final UserRef? owner;

  /// Yours about somebody else's listing, still going; only on 04's answer.
  final ItemConversation? conversation;
}

/// The conversation about a listing that the box on 04 is: the trade it
/// belongs to, its thread, and what was said there last. What 04 is sent when
/// it opens, and what «Send» there answers with.
class ItemConversation {
  ItemConversation.fromJson(Map<String, dynamic> j)
      : tradeId = j['tradeId'] as String,
        threadId = j['threadId'] as String,
        lastMessage =
            j['lastMessage'] == null ? null : MessagePreview.fromJson(j['lastMessage']);

  const ItemConversation(
      {required this.tradeId, required this.threadId, required this.lastMessage});

  final String tradeId, threadId;
  final MessagePreview? lastMessage;
}

/// «Ikke vis meg slike» as the server wrote it down: a kind — the category
/// and the subcategory under it, compared without regard to case because
/// whoever listed the thing typed it — or, for a listing with no subcategory,
/// that listing alone, since a category on its own would hide far more than
/// was asked. `docs/DESIGN.md` has the rule; the server applies it, and this
/// is only so a screen can take the same listings away before it asks again.
class HiddenKind {
  HiddenKind.fromJson(Map<String, dynamic> j)
      : category = j['category'] as String? ?? 'diverse',
        subcategory = j['subcategory'] as String?,
        itemId = j['itemId'] as String?;

  /// What the server will write down for [item], worked out the same way.
  HiddenKind.of(Item item)
      : category = item.category,
        subcategory = (item.subcategory ?? '').isEmpty ? null : item.subcategory,
        itemId = (item.subcategory ?? '').isEmpty ? item.id : null;

  final String category;
  final String? subcategory, itemId;

  bool covers(Item item) {
    final id = itemId;
    if (id != null) return item.id == id;
    return item.category == category &&
        (item.subcategory ?? '').toLowerCase() == (subcategory ?? '').toLowerCase();
  }
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
        requestedBy = j['requestedBy'] as String?,
        state = j['state'] as String? ?? 'waiting',
        respondsBy = _date(j['respondsBy']),
        blockedBySent = j['blockedBySent'] as bool? ?? false;

  final bool byYou, blockedBySent;

  /// Who asked to be let out: in a ring of three not always the one you
  /// receive from, which is who the banner used to name.
  final String? requestedBy;
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

  const MessagePreview(
      {required this.body, required this.senderName, required this.mine, this.createdAt});

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
        closeCode = j['closeCode'] as String?,
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

  /// Why a cancelled trade ended, as a code the app can choose its words by:
  /// [closedByErasure] and the server's others, or null — a trade that has
  /// not ended, or one ended for a reason with no code, whose [closeReason]
  /// is the words. [closeReason] stays the server's sentence, which is what
  /// history keeps; a code is what lets the words fit whoever reads them.
  final String? closeCode;

  /// Somebody in the trade deleted their account, and every trade they were
  /// in ended with it.
  static const closedByErasure = 'account_deleted';

  /// One of the people in it blocked another.
  static const closedByBlock = 'blocked';

  /// An owner took down a listing that was on the table.
  static const closedByListingRemoved = 'listing_removed';

  /// Ended in a way that leaves nobody to write to: somebody in it deleted
  /// their account, or blocked another. A trade that ended any other way
  /// keeps its conversation, since how long an ordinary conversation lives
  /// is an open question.
  bool get conversationClosed =>
      state == 'cancelled' && (closeCode == closedByErasure || closeCode == closedByBlock);

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
            ((j['messages'] as List?) ?? const []).map((e) => ChatMessage.fromJson(e)).toList(),
        readBy = {
          for (final r in (j['readBy'] as List?) ?? const [])
            if ((r as Map)['userId'] is String)
              r['userId'] as String: r['lastReadMessageId'] as String?,
        };

  final String id, tradeId, state, kind;
  final String? banner;
  final List<UserRef> participants;
  final List<ChatMessage> messages;

  /// How far each person in the conversation has read: the last message
  /// they have seen, by their id, or null for nothing yet. Empty from a
  /// server that did not say.
  final Map<String, String?> readBy;

  /// Whether everybody but [me] has read as far as [message].
  bool readByOthers(ChatMessage message, String? me) {
    final at = messages.indexWhere((m) => m.id == message.id);
    final others = participants.where((p) => p.id != me).toList();
    if (at < 0 || others.isEmpty) return false;
    return others.every((p) {
      final upTo = readBy[p.id];
      return upTo != null && messages.indexWhere((m) => m.id == upTo) >= at;
    });
  }
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
        likers = ((j['likers'] as List?) ?? const []).map((e) => Liker.fromJson(e)).toList();

  final Item item;
  final List<Liker> likers;
}

/// Somebody who liked one of your things, as 12 lists them.
class Liker {
  Liker.fromJson(Map<String, dynamic> j)
      : user = UserRef.fromJson(j),
        anonymous = j['anonymous'] as bool? ?? false;

  final UserRef user;

  /// A device looking around, which has no profile: no name to show and no
  /// things to see. It has no name to send either, and read as a person it
  /// was «Slettet bruker», somebody who had left. A server from before it
  /// said so says nothing, and that is not one.
  final bool anonymous;
}
