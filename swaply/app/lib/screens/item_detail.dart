import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../widgets/admin_chrome.dart';
import '../widgets/common.dart';
import '../widgets/photo_viewer.dart';
import '../widgets/share_sheet.dart';
import '../widgets/shell.dart';
import '../state/session.dart';
import 'chat.dart';
import 'discover.dart';
import 'onboarding.dart';
import 'post_item.dart';
import 'profile.dart';

/// 04 opened into [tab] by something that is not the screen it lands on: a
/// notification on 12a, which is taken down as it opens, or a shared link at
/// the gate. A block made on it takes the page away, saying so with `true`
/// (see [ItemDetailScreen]), and what is under it then is that tab's stack —
/// which did not open it, did not ask again after it, and went on showing the
/// blocked person's things. So the tab's first screen is told to ask again,
/// quietly, the way it is when a finished flow lands on it.
Future<void> openListingInTab(BuildContext context, String itemId, {int tab = 0}) async {
  final shell = TabShell.maybeOf(context);
  final gone = await pushInTab<bool>(context, ItemDetailScreen(itemId: itemId), tab: tab);
  if (gone == true) shell?.askAgain(tab);
}

/// 04 Gjenstand detalj. The gallery, the owner strip, the conversation box that
/// opens a negotiation, and the two big buttons at the bottom.
///
/// Its route comes back `true` when the page went because the listing is no
/// longer there for you — a block, made here or on the owner's profile — so
/// that what opened it asks again for what it shows. Every other way out
/// comes back with nothing.
class ItemDetailScreen extends StatefulWidget {
  const ItemDetailScreen({super.key, required this.itemId, this.onHeart, this.onSeen});

  final String itemId;

  /// Told as the heart here is pressed, and again once the server has said
  /// what it is — the same as [ItemCard.onHeart]. The card this page was
  /// opened from is under it, and without this it went on showing the heart
  /// from before until the collage asked for on the way back had landed:
  /// empty as the page slid away, then filled.
  final void Function(bool liked, {required bool answered})? onHeart;

  /// Told once, with whether the heart is on as the server said when this
  /// page asked — which is later than the collage the card was drawn from, so
  /// the card can take it and not go on disagreeing with the page it opened.
  final ValueChanged<bool>? onSeen;

  @override
  State<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends State<ItemDetailScreen> {
  Item? _item;
  ApiException? _error;

  /// The heart as this phone has it, which runs ahead of [_item]: it turns on
  /// the tap, the way the card's does, and goes back only if the server says
  /// no. [_liking] is a heart on its way, and a second tap waits for it.
  bool _liked = false;
  bool _liking = false;

  /// Presses that turned the heart on, for [HeartPop].
  int _pops = 0;

  /// Whether [ItemDetailScreen.onSeen] has been told.
  bool _seen = false;
  int _photo = 0;

  /// The gallery's pages, so it can be left on the picture last looked at big.
  final _photos = PageController();
  final _message = TextEditingController();
  bool _sending = false;

  /// The conversation the box is: the one the page opened on, or the one the
  /// first message here made. Null until there is one.
  ItemConversation? _conversation;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _message.dispose();
    _photos.dispose();
    super.dispose();
  }

  /// Asked for when the page opens, and again after the listing is edited or
  /// the test tooling has made somebody want it. Only the first asking can fail into [LoadFailure]:
  /// after that the listing stays and the failure is a toast over it.
  ///
  /// [leaveIfGone] is for coming back from the owner's profile, where a block
  /// may have been made: across a block the server has no such listing for
  /// you, and a page of it left standing was the owner's things still on
  /// screen after the person had asked never to see them. So a listing that
  /// is gone takes the page with it, without a word — the block said its
  /// own — and no answer then keeps quiet, as a tab coming back does.
  Future<void> _load({bool leaveIfGone = false}) async {
    try {
      final item = await context.read<SwaplyApi>().item(widget.itemId);
      if (mounted) {
        setState(() {
          _item = item;
          _error = null;
          _conversation = item.conversation;
          if (!_liking) _liked = item.likedByMe;
        });
        if (!_seen && !_liking) widget.onSeen?.call(item.likedByMe);
        _seen = true;
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_item == null) {
        setState(() => _error = e);
      } else if (!leaveIfGone) {
        showError(context, e);
      } else if (e.statusCode == 404) {
        Navigator.of(context).maybePop(true);
      }
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load();
  }

  Future<void> _like() async {
    final item = _item;
    if (item == null || _liking) return;
    // Turned now, and nothing else on the page is touched. The heart used to
    // spin until the answer came and then fetch the whole listing again to
    // learn what it had just said: a flash on the one button that matters,
    // for nothing the page did not know.
    final wish = !_liked;
    setState(() {
      _liking = true;
      _liked = wish;
      if (wish) _pops++;
    });
    // Taken now: the answer can come after ‹, and the card still wants it.
    final heard = widget.onHeart;
    heard?.call(wish, answered: false);
    // Taken now, for what comes after: the match screen, or 10a, which go up
    // over wherever the person went if ‹ came before the answer; see
    // [followWish]. And the heart goes through the session, which holds a
    // sign-in back until it lands.
    final session = context.read<Session>();
    final by = session.me?.id;
    final root = Navigator.of(context, rootNavigator: true);

    // What comes after a wish — the match screen, or 10a — is a screen on top
    // of this one and not part of the heart, which is done with and free to
    // be pressed again before either goes up. So the call finishes first and
    // the follow-up comes after.
    LikeAnswer? wished;
    var landed = false;
    try {
      if (wish) {
        wished = await session.like(item.id);
      } else {
        await session.unlike(item.id);
      }
      landed = true;
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      // Back as it was if the server did not take it, whether it refused or
      // was never reached. A page left meanwhile has nothing to put back,
      // but the card it was opened from does.
      heard?.call(landed ? wish : !wish, answered: true);
      if (mounted) {
        setState(() {
          _liking = false;
          if (!landed) _liked = !wish;
        });
      }
    }

    if (wished != null) await followWish(mounted ? context : null, root, session, wished, by: by);
  }

  Future<void> _send() async {
    final text = _message.text.trim();
    if (text.isEmpty || _sending) return;

    // Writing the first message opens a trade, and a trade has two named people
    // in it. This is the moment a device becomes a person.
    if (context.read<Session>().anonymous) {
      await pushOverBar<bool>(context, const CreateProfileScreen());
      if (!mounted || context.read<Session>().anonymous) return;
    }
    setState(() => _sending = true);
    try {
      final said = await context.read<SwaplyApi>().messageAboutItem(widget.itemId, text);
      _message.clear();
      if (mounted) {
        // An API from before the answer carried the message still says where
        // it went, and the words are the ones just typed.
        final me = context.read<Session>().me;
        setState(() => _conversation = said.lastMessage != null
            ? said
            : ItemConversation(
                tradeId: said.tradeId,
                threadId: said.threadId,
                lastMessage: MessagePreview(body: text, senderName: me?.displayName, mine: true),
              ));
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Gjenstand'),
        body: LoadFailure(_error!, missing: 'Fant ikke gjenstanden', onRetry: _retry),
      );
    }
    if (item == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final owner = item.owner;
    // Your own listing is a real thing to land on — from your profile, or from
    // a link you sent yourself — and the two buttons at the bottom are both
    // things the server will refuse. So it says what it is instead.
    final mine = owner != null && owner.id == context.watch<Session>().me?.id;

    return SwaplyScaffold(
      currentTab: 0,
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _gallery(item),
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 14, 22, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name and price share a line, and the price is grey:
                      // this is a barter app, so the number is a fact about the
                      // thing and not the point of it.
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(item.title, style: Type.display)),
                          if (item.estimatedValueNok != null) ...[
                            const SizedBox(width: 10),
                            Padding(
                              padding: const EdgeInsets.only(top: 9),
                              child: Text('Verdi ${kr(item.estimatedValueNok)}',
                                  style: Type.value),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 11),
                      Wrap(
                        spacing: 7,
                        runSpacing: 7,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Pill([
                            categoryLabels[item.category] ?? item.category,
                            if ((item.subcategory ?? '').isNotEmpty) item.subcategory!,
                          ].join(' · '), small: true),
                          if (item.condition != null)
                            Pill(conditionLabels[item.condition] ?? item.condition!, small: true),
                          if (item.kind == 'service') const Pill('Tjeneste', small: true),
                          // The town is not a pill in the export: where a thing
                          // is, is a note, not a label on it.
                          if (item.town != null) Text(item.town!, style: Type.secondary),
                        ],
                      ),
                      if (item.likeCount != null) ...[
                        const SizedBox(height: 10),
                        _likedBy(item),
                      ],
                      if (item.description != null && item.description!.isNotEmpty) ...[
                        const SizedBox(height: 11),
                        Text(item.description!, style: Type.body),
                      ],
                      if (owner != null) ...[
                        const SizedBox(height: 11),
                        _ownerStrip(owner),
                      ],
                      if (mine) ...[
                        const SizedBox(height: 11),
                        const SectionCard(
                          child: Text(
                            'Dette er din egen ting. Slik ser andre den.',
                            style: Type.secondary,
                          ),
                        ),
                      ] else
                        _conversationBox(owner),
                      // The cheapest lever in the tooling: the heart is the
                      // whole product, and this presses it on your own real
                      // listing from somebody else's hand. If it closes a loop,
                      // a real trade opens and a real notification lands.
                      //
                      // Your own listing only. The server refuses the rest —
                      // a test account wanting a stranger's thing is exactly
                      // what hiding test listings exists to prevent, arriving
                      // from the other direction — and a button that is always
                      // refused is not a button.
                      if (mine &&
                          context.watch<Session>().isAdmin &&
                          !context.watch<Session>().actingAs) ...[
                        const SizedBox(height: 11),
                        _adminWant(item),
                      ],
                      const SizedBox(height: Insets.lg),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (!mine) _actionBar(item),
        ],
      ),
    );
  }

  // The card is the room its button shares, as on the tool's own screen.
  Widget _adminWant(Item item) => TapRoom(
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            color: AdminColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AdminColors.accent),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  AdminBadge('admin'),
                  SizedBox(width: 8),
                  // Norwegian runs long and this sits inside a card: the title
                  // wraps rather than running off the edge of it.
                  Expanded(
                    child: Text('Få noen til å ville ha denne',
                        style: TextStyle(
                            fontSize: 12.5, fontWeight: FontWeight.w800, color: AdminColors.ink)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text('Trykker hjertet som en av testkontoene dine, gjennom den ekte veien.',
                  style: TextStyle(fontSize: 11.5, height: 1.4, color: AdminColors.muted)),
              const SizedBox(height: 10),
              AdminButton('Velg konto', onPressed: () => _pickWanter(item)),
            ],
          ),
        ),
      );

  Future<void> _pickWanter(Item item) async {
    final api = context.read<SwaplyApi>();
    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    List<TestAccount> accounts;
    try {
      accounts = (await api.adminOverview()).accounts.where((a) => a.claimed).toList();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
      return;
    }
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: AdminColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 10),
              child: Text('Hvem vil ha den?',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800, color: AdminColors.ink)),
            ),
            if (accounts.isEmpty)
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Text('Du har ingen testkontoer ennå. Lag en i Testverktøy.',
                    style: TextStyle(fontSize: 13, color: AdminColors.muted)),
              ),
            for (final account in accounts)
              ListTile(
                dense: true,
                title: Text(account.displayName,
                    style: const TextStyle(fontSize: 14, color: AdminColors.ink)),
                subtitle: Text('${account.itemCount} ting · ${account.likeCount} likes',
                    style: const TextStyle(fontSize: 11.5, color: AdminColors.muted)),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  try {
                    final wanted = await api.adminWant(item.id, as: account.id);
                    if (wanted.tradeId == null) {
                      showNoteOn(messenger, '${account.displayName} vil ha den. Ingen sirkel ennå.');
                    } else if (!wanted.tradeIsNew) {
                      // Pressed again on something the account already
                      // wants: the server names the trade already open over
                      // that ring rather than opening a second, and saying
                      // the circle closed read as a new trade.
                      showNoteOn(
                          messenger,
                          '${account.displayName} vil ha den. Sirkelen har allerede '
                          'et åpent bytte.');
                    } else {
                      showDoneOn(messenger,
                          '${account.displayName} vil ha den, og sirkelen lukket seg.');
                      // A trade of yours opened, and the bar counts them.
                      unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
                    }
                    await _load();
                  } on ApiException catch (e) {
                    showErrorOn(messenger, e);
                  }
                },
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  /// The listing's pictures, big, from the one at [at]; see [showPhotos]. The
  /// gallery is then left on the one looked at last.
  Future<void> _openPhotos(List<String> photos, int at) async {
    final last = await showPhotos(context, [for (final p in photos) NetworkImage(p)], initial: at);
    if (last != null && mounted && last != _photo && _photos.hasClients) {
      _photos.jumpToPage(last);
    }
  }

  Widget _gallery(Item item) {
    final photos = item.media.isEmpty ? <String>[] : item.media;

    return SizedBox(
      // 330 in the export, and the picture runs up under the status bar.
      height: 330,
      child: Stack(
        children: [
          Positioned.fill(
            child: photos.isEmpty
                ? Container(
                    color: SwaplyColors.greenSoft,
                    child: Center(
                      child: Icon(categoryIcons[item.category] ?? Icons.category_outlined,
                          size: 64, color: SwaplyColors.greenDeep),
                    ),
                  )
                : PageView.builder(
                    controller: _photos,
                    onPageChanged: (i) => setState(() => _photo = i),
                    itemCount: photos.length,
                    // A picture opens them all, big, at the one tapped. Not
                    // to a screen reader, which has the button below, named:
                    // a whole picture that answers a tap is a target lying
                    // under the three round ones and the button.
                    itemBuilder: (_, i) => GestureDetector(
                      excludeFromSemantics: true,
                      onTap: () => _openPhotos(photos, i),
                      child: Image.network(photos[i],
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(color: SwaplyColors.greenSoft)),
                    ),
                  ),
          ),
          // And a button that says so, since a picture does not: the round
          // one the header's are, at the foot on the right, clear of the dots.
          if (photos.isNotEmpty)
            Positioned(
              right: 14 - _roundRoom,
              bottom: 10 - _roundRoom,
              child: _round(
                Icons.open_in_full,
                photos.length == 1 ? 'Vis bildet' : 'Vis alle bildene',
                () => _openPhotos(photos, _photo),
              ),
            ),
          // Three 38 circles, 10 under the status bar and 14 in from the
          // sides, 8 between the two at the right. Each answers across 44:
          // three of those on every side, which is why the row sits three
          // higher and further out, and two of the eight are left between.
          Positioned(
            top: MediaQuery.of(context).padding.top + 10 - _roundRoom,
            left: 14 - _roundRoom,
            right: 14 - _roundRoom,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _round(Icons.chevron_left, 'Tilbake', () => Navigator.of(context).maybePop()),
                Row(
                  children: [
                    _round(Icons.ios_share, 'Del', () {
                      final session = context.read<Session>();
                      showShareSheet(
                        context,
                        title: 'Del ${item.title}',
                        mint: (api) => api.shareItem(item.id),
                        // A link is an invitation from somebody, and a device
                        // has no profile to send it from: 10c, as writing a
                        // message here is.
                        makeProfile: () async {
                          if (!mounted) return false;
                          await pushOverBar<bool>(context, const CreateProfileScreen());
                          return mounted && session.signedIn && !session.anonymous;
                        },
                      );
                    }),
                    const SizedBox(width: 8 - 2 * _roundRoom),
                    _round(Icons.more_horiz, 'Flere valg', () {
                      // Your own listing is not something to report. It is the
                      // one thing you can change and take down, and until now
                      // the app could do neither.
                      final mine = item.owner?.id == context.read<Session>().me?.id;
                      if (mine) {
                        _ownItemMenu(item);
                      } else {
                        _report(item);
                      }
                    }),
                  ],
                ),
              ],
            ),
          ),
          if (photos.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  photos.length,
                  (i) => Container(
                    height: 5,
                    width: i == _photo ? 14 : 5,
                    margin: const EdgeInsets.symmetric(horizontal: 2.5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      color: i == _photo ? Colors.white : Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// «⋯» on somebody else's listing: 16a. A report that blocked, once the
  /// server has it, takes this page away: across a block the listing does not
  /// exist for you — the server answers «Fant ikke gjenstanden» for it from
  /// then on — and the page stood there with the owner's thing on it and the
  /// heart still under the thumb. What it was opened from asks again as it
  /// comes back, without the owner's things: the grid when a card's page
  /// closes, 13b when one of its listings does, and the tab's first screen
  /// when a notification or a link opened it; see [openListingInTab]. The
  /// toast the report put up says what happened, over whatever is under.
  Future<void> _report(Item item) async {
    final blocked =
        await showReportSheet(context, itemId: item.id, personName: item.owner?.displayName);
    if (blocked && mounted) Navigator.of(context).maybePop(true);
  }

  /// «⋯» on a listing of your own: the U and the D of the CRUD the API has
  /// always had and no screen reached.
  Future<void> _ownItemMenu(Item item) async {
    await showModalBottomSheet<void>(
      context: context,
      // Over the bar, like every sheet: inside the tab it would stop at the
      // bar and leave it tappable under the dimming.
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Rediger annonsen'),
              onTap: () async {
                Navigator.of(sheet).pop();
                // 10b is drawn without the bar, so the form covers it — here,
                // where it is a correction, as much as where it is a new
                // listing.
                final changed =
                    await pushOverBar<bool>(context, PostItemScreen(editing: item));
                if (changed == true) await _load();
              },
            ),
            // In the colour of «Slett kontoen» and «Logg ut»: something of
            // your own, taken away. Not [SwaplyColors.red], which is report
            // and block and nothing else — taking your own listing down is
            // neither.
            ListTile(
              leading: const Icon(Icons.delete_outline, color: SwaplyColors.redText),
              title: const Text('Fjern annonsen', style: TextStyle(color: SwaplyColors.redText)),
              onTap: () {
                Navigator.of(sheet).pop();
                _confirmRemove(item);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRemove(Item item) async {
    final yes = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Insets.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Fjerne ${item.title}?', style: Type.title),
              const SizedBox(height: Insets.sm),
              const Text(
                'Den forsvinner fra Oppdag og fra søk. Bytter den allerede har vært '
                'med i beholder sin egen historikk.',
                style: Type.secondary,
              ),
              const SizedBox(height: Insets.lg),
              // The app's destructive button, as «Slett kontoen» asks with
              // it: coral's edge, and nothing that looks like the way on. A
              // red slab here was the report-and-block red on something that
              // is neither.
              SecondaryButton('Fjern annonsen',
                  destructive: true, onPressed: () => Navigator.of(sheet).pop(true)),
              const SizedBox(height: Insets.sm),
              SecondaryButton('Avbryt', onPressed: () => Navigator.of(sheet).pop(false)),
            ],
          ),
        ),
      ),
    );
    if (yes != true || !mounted) return;

    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<SwaplyApi>().deleteItem(item.id);
    } on ApiException catch (e) {
      // «Gjenstanden er reservert i et bytte» is the one refusal worth reading.
      if (mounted) showError(context, e);
      return;
    }
    // Gone, and said so over whatever the page goes back to. The session is
    // asked again for 13's list of things and its count, which went on
    // showing the listing after it was taken down — quietly: it is gone
    // whatever that says.
    unawaited(session.refresh().then((_) {}, onError: (Object _) {}));
    if (mounted) Navigator.of(context).maybePop();
    showDoneOn(messenger, 'Annonsen er fjernet.');
  }

  /// Round, 38 across, over the photograph. The ripple stays the circle; the
  /// area around it is [_roundRoom] wider on every side.
  Widget _round(IconData icon, String label, VoidCallback onTap) => TapArea(
        room: const EdgeInsets.all(_roundRoom),
        label: label,
        child: Material(
          color: SwaplyColors.bg.withValues(alpha: 0.92),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
                height: 38, width: 38, child: Icon(icon, size: 20, color: SwaplyColors.ink)),
          ),
        ),
      );

  static const _roundRoom = (kTapTarget - 38) / 2;

  // Its own node: without one, the whole page of words around it told a
  // screen reader it was the button.
  Widget _ownerStrip(UserRef owner) => TapArea(
        child: InkWell(
          // Asked for again on the way back: the owner may have been blocked
          // there, and then this listing is gone as well; see [_load].
          onTap: () async {
            await Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => OtherProfileScreen(userId: owner.id)));
            if (mounted) await _load(leaveIfGone: true);
          },
          borderRadius: BorderRadius.circular(Radii.card),
          child: SectionCard(
            child: Row(
              children: [
                Avatar(owner.displayName, size: 42),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(owner.displayName, style: Type.heading),
                      const SizedBox(height: 2),
                      // «★ 4,8 · 23 bytter · BankID-verifisert», one grey line.
                      Text(
                        [
                          if (owner.ratingAvg != null)
                            '★ ${owner.ratingAvg!.toStringAsFixed(1).replaceAll('.', ',')}',
                          if (owner.tradeCount != null) '${owner.tradeCount} bytter',
                          if (owner.bankidVerified) 'BankID-verifisert',
                        ].join(' · '),
                        style: const TextStyle(
                            fontSize: 12, height: 1.35, color: SwaplyColors.grey),
                      ),
                    ],
                  ),
                ),
                const Text('Se profil ›', style: Type.link),
              ],
            ),
          ),
        ),
      );

  /// How many people have liked this, in the words 12 and the profile use:
  /// «3 har likt denne». Once the heart here is pressed it says «Du og 3
  /// andre …», green like the heart, which is the state in words as well as
  /// in colour. It follows the heart as the phone has it, so it turns with the
  /// tap and turns back if the server says no. The server's count is from when
  /// the page opened, with this account's own like in it or not, so the others
  /// are counted apart from it.
  Widget _likedBy(Item item) {
    final others = item.likeCount! - (item.likedByMe ? 1 : 0);
    final words = switch ((_liked, others)) {
      (false, <= 0) => 'Ingen har likt denne ennå',
      (false, _) => '$others har likt denne',
      (true, <= 0) => 'Du har likt denne',
      (true, 1) => 'Du og 1 annen har likt denne',
      (true, _) => 'Du og $others andre har likt denne',
    };
    // The heart the buttons draw, not «♥»: a phone is free to draw that one
    // as a red emoji, and the words are what a screen reader needs.
    return Row(
      children: [
        Icon(Icons.favorite,
            size: 14, color: _liked ? SwaplyColors.greenPressed : SwaplyColors.greyLight),
        const SizedBox(width: 6),
        Expanded(
          child: Text(words,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _liked ? SwaplyColors.greenText : SwaplyColors.inkBody,
              )),
        ),
      ],
    );
  }

  /// The box that opens a negotiation. Writing here is what creates the trade,
  /// which is why the chips are trade actions and not emoji.
  ///
  /// Once there is a conversation it is that conversation, drawn as 06b's card
  /// draws one: what was said last, and «Åpne ›» to the rest of it. The page
  /// opens on it, so a message sent here is still there when the listing is
  /// opened again, and one sent now is there as soon as the server has it. It
  /// used to say «Meldingen er sendt» and show nothing of what was sent, and
  /// on the next visit not even that.
  ///
  /// «Åpne ›», the field and «Send» share the box and the 11 over it: «Åpne ›»
  /// the top, the field and «Send» the foot.
  Widget _conversationBox(UserRef? owner) {
    final name = owner?.displayName.split(' ').first ?? 'eieren';
    final talk = _conversation;

    return TapRoom(
      room: const EdgeInsets.only(top: 11),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Kicker('Samtale med $name'),
                if (talk != null)
                  TapArea(
                    onTap: () => pushOverBar<void>(context, ThreadScreen(threadId: talk.threadId)),
                    child: const Text('Åpne ›', style: Type.link),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (talk?.lastMessage != null) ...[
              LastMessage(talk!.lastMessage!),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                Expanded(
                  child: TapArea(
                    child: TextField(
                      controller: _message,
                      minLines: 1,
                      maxLines: 3,
                      style: const TextStyle(fontSize: 13, color: SwaplyColors.ink),
                      decoration: InputDecoration(
                        hintText: 'Skriv en melding til $name…',
                        hintStyle: const TextStyle(fontSize: 13, color: SwaplyColors.greyLight),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(Radii.pill),
                            borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                        enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(Radii.pill),
                            borderSide: const BorderSide(color: SwaplyColors.fieldLine)),
                        focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(Radii.pill),
                            borderSide: const BorderSide(color: SwaplyColors.greenPressed)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: Insets.md),
                // A word, not a filled button: the box already invites you to
                // write, and a green slab beside it competes with the heart.
                TapArea(
                  onTap: _sending ? null : _send,
                  keepsKeyboard: true,
                  child: Text(
                    'Send',
                    style: Type.link.copyWith(
                      fontSize: 13,
                      color: _sending ? SwaplyColors.greyLight : SwaplyColors.greenText,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Two circles, centred. The heart is the biggest thing on the screen because
  /// it is the only action that means anything — the ✕ beside it just goes back.
  /// A toast goes up over it rather than on it: the refusal of a heart used to
  /// lie across the heart.
  Widget _actionBar(Item item) => KeepClear(
        child: Container(
          padding: const EdgeInsets.fromLTRB(0, 8, 0, 10),
          decoration: const BoxDecoration(
            color: SwaplyColors.surface,
            border: Border(top: BorderSide(color: Color(0xFFF0F2EE))),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CircleAction(
                icon: Icons.close,
                size: 58,
                iconSize: 22,
                color: SwaplyColors.badge,
                borderColor: SwaplyColors.declineLine,
                semanticLabel: 'Ikke interessert',
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: 26),
              // Never busy: the heart has already turned by the time the call
              // goes, so a spinner in it would only hide that it had.
              //
              // Open until it is pressed, and green all through once it is:
              // more colour is on, as with any toggle, the card's heart says
              // it the same way, and green is the app's yes beside the ✕'s red.
              // The export draws only the one heart, filled, and never the
              // state after it; the product owner chose this over a heart
              // that turns coral, which is the app's no, on 30.09.2026.
              HeartPop(
                pops: _pops,
                child: CircleAction(
                  icon: _liked ? Icons.favorite : Icons.favorite_border,
                  size: 62,
                  iconSize: 26,
                  filled: _liked,
                  color: SwaplyColors.greenPressed,
                  borderColor: SwaplyColors.greenPressed,
                  borderWidth: 1.5,
                  semanticLabel: _liked ? 'Du vil ha denne' : 'Jeg vil ha',
                  onPressed: _like,
                ),
              ),
            ],
          ),
        ),
      );
}
