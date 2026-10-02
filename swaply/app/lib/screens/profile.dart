import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/admin_chrome.dart';
import '../widgets/common.dart';
import '../widgets/share_sheet.dart';
import '../widgets/shell.dart';
import 'item_detail.dart';
import 'admin.dart';
import 'liked.dart';
import 'notifications.dart';
import 'onboarding.dart';
import 'post_item.dart';

/// 13 Profil, and 17c before anything has been listed.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with RefetchOnTabReturn {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _askAgain());
  }

  // Everything on 13 is the session's — the things, the likes, the rating —
  // so asking again is asking who you are.
  @override
  void onTabReturn() => _askAgain();

  /// Quietly: 13 goes on showing what the session last heard, and the next
  /// asking brings it up to date. Unheld, no answer here was an error nobody
  /// caught — landing on 13 as a listing goes out with the line gone included.
  void _askAgain() {
    if (!mounted) return;
    unawaited(context.read<Session>().refresh().then((_) {}, onError: (Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<Session>().me;

    if (me == null) {
      return const SwaplyScaffold(
        currentTab: 4,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    // Looking around has no profile to show, and an empty one drawn as if it
    // were a person's is worse than saying what is going on.
    //
    // Where the likes are, and how long: the server holds them, on an account
    // for this device — not the phone, which is what this said until the
    // server began deleting a device nobody opens for twelve months. This is
    // the one screen of its own a device has, so the rule is said here, to
    // the only people it applies to.
    if (me.anonymous) {
      return SwaplyScaffold(
        currentTab: 4,
        child: EmptyState(
          icon: Icons.person_outline,
          title: 'Du ser deg rundt',
          body: 'Det du liker, er lagret på en konto for denne enheten. Lag en profil når '
              'du vil legge ut noe eller snakke med noen — du beholder alt du har likt. '
              'Åpner du ikke appen på tolv måneder, slettes kontoen, og det du har likt '
              'med den.',
          actionLabel: 'Lag profil',
          onAction: () => pushOverBar<bool>(context, const CreateProfileScreen()),
          footer: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The app starts without asking, so somebody with an account
              // from another phone is a stranger here first, and this is
              // where they look for the way in. 16c is drawn without the bar,
              // so it covers it.
              SignInRow(
                  room: EmptyState.footerRoom,
                  onTap: () => pushOverBar<void>(context, const LoginScreen())),
              // A device has no 16b, which is where the terms are otherwise
              // reached from — and it reads town names from the postcode
              // register on 10b like anybody, whose credit is on that screen.
              // Quieter than the way in above it, and a finger's height of
              // its own under it.
              Center(
                child: TapArea(
                  room: const EdgeInsets.only(top: 16, bottom: 14),
                  onTap: () => pushOverBar<void>(context, const LegalScreen()),
                  child: const Text('Juridisk og personvern', style: Type.small),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Read out here: inside the scaffold's SafeArea the status bar is taken off.
    final safe = MediaQuery.paddingOf(context);

    return SwaplyScaffold(
      currentTab: 4,
      // «+ Legg ut» floats at the bottom right, 20 in from the edge and 44
      // above the tab bar, exactly where the export leaves it.
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(right: 4, bottom: 28),
        child: GestureDetector(
          onTap: () => openListingForm(context),
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: SwaplyColors.greenPressed,
              borderRadius: BorderRadius.circular(Radii.pill),
            ),
            child: const Center(
              widthFactor: 1,
              child: Text('+ Legg ut',
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ),
      ),
      child: RefreshIndicator(
        onRefresh: () => context.read<Session>().refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 0, 22, Insets.xl),
          children: [
            // «Innstillinger» is one line of words in the top corner, and it
            // answers across the corner: down into the empty space beside the
            // name, which it shares the room with, and — from above, since
            // the list ends at the status bar and at its own padding — up to
            // the top of the screen and out to its edge, where a thumb aimed
            // at a corner lands. The owner named this one as hard to hit.
            TapRoom(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      // Only «Innstillinger» up here; the list of notifications is
                      // reached from the settings, since the export draws no bell.
                      TapArea(
                        above: true,
                        reach: EdgeInsets.fromLTRB(0, safe.top, 22 + safe.right, 0),
                        // 16b is drawn without the bar, so it covers it.
                        onTap: () => pushOverBar<void>(context, const SettingsScreen()),
                        child: const Text('Innstillinger',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: SwaplyColors.greenText)),
                      ),
                    ],
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 84 across, the initial at 32/800.
                      Avatar(me.displayName ?? '?', size: 84, mine: true),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 12),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Flexible(
                                  child: Text(me.displayName ?? 'Uten navn',
                                      style: Type.title, overflow: TextOverflow.ellipsis),
                                ),
                                if (me.bankidVerified) ...[
                                  const SizedBox(width: 8),
                                  // Green words on the name's line, not a badge.
                                  const Text('BankID-verifisert',
                                      style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          color: SwaplyColors.greenText)),
                                ],
                                // Whoever holds the key should never be able to
                                // forget they are holding it.
                                if (me.isAdmin) ...[
                                  const SizedBox(width: 8),
                                  const AdminBadge('admin'),
                                ],
                                if (me.testAccount) ...[
                                  const SizedBox(width: 8),
                                  const AdminBadge('testkonto'),
                                ],
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text.rich(
                              TextSpan(children: [
                                if (me.ratingCount == 0)
                                  const TextSpan(text: 'Ingen vurderinger ennå')
                                else ...[
                                  TextSpan(text: '${_stars(me.ratingAvg)} '),
                                  TextSpan(
                                      text: me.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                                      style: const TextStyle(fontWeight: FontWeight.w700)),
                                  TextSpan(text: ' · ${me.ratingCount} vurderinger'),
                                ],
                              ]),
                              style: const TextStyle(fontSize: 13, color: SwaplyColors.inkBody),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(_whereAndSince(me.town, me.memberSince), style: Type.secondary),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // 40 tall, and 2 of the 11 on either side answer too.
            const SizedBox(height: 11 - 2),
            TapArea(
              room: const EdgeInsets.symmetric(vertical: 2),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const LikedScreen())),
                child: SectionCard(
                  radius: 16,
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          me.likedByCount == 0
                              ? '♥ Ingen har likt tingene dine ennå'
                              : '♥ ${me.likedByCount} har likt tingene dine',
                          style: const TextStyle(
                              fontSize: 13.5, fontWeight: FontWeight.w700, color: SwaplyColors.ink),
                        ),
                      ),
                      const Text('Se hvem ›', style: Type.link),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 11 - 2),
            const Text('Interesser', style: Type.section),
            const SizedBox(height: 7),
            // «Rediger profil» is a line of words between the interests and
            // the grid, 11 from each: it answers across the 11 under it and
            // up over the gap and the interests, which answer nothing.
            TapRoom(
              room: const EdgeInsets.only(bottom: 11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      ...me.interests.map((c) => Pill(categoryLabels[c] ?? c, small: true)),
                      // While any of the twelve is left. Five was round 5's
                      // ceiling, and there is none now.
                      if (me.interests.length < categoryLabels.length)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(Radii.pill),
                            border: Border.all(color: SwaplyColors.chevron),
                          ),
                          child: const Text('+ fylles ut mens du bruker appen',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: SwaplyColors.grey)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 11),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text('Mine gjenstander · ${me.items.length}',
                            style: Type.section, overflow: TextOverflow.ellipsis),
                      ),
                      TapArea(
                        onTap: () => pushOverBar<void>(context, const EditProfileScreen()),
                        child: const Text('Rediger profil',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: SwaplyColors.greenText)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (me.items.isEmpty)
              EmptyState(
                icon: Icons.inventory_2_outlined,
                title: 'Du har ingen ting ute',
                body: 'Legg ut den første tingen din. Det tar under et minutt.',
                actionLabel: 'Legg ut',
                onAction: () => openListingForm(context),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  // 166 across, 110 of picture and 36 of caption.
                  childAspectRatio: 166 / 146,
                ),
                itemCount: me.items.length,
                itemBuilder: (context, i) => _ownItem(me.items[i]),
              ),
            const SizedBox(height: 70),
          ],
        ),
      ),
    );
  }

  Widget _ownItem(Item item) {
    final (label, colour) = switch (item.status) {
      'reserved' => ('Reservert', SwaplyColors.amberText),
      'traded' => ('Byttet', SwaplyColors.inkMuted),
      'withdrawn' => ('Trukket', SwaplyColors.inkMuted),
      _ => ('Tilgjengelig', SwaplyColors.greenText),
    };

    // The whole cell, to the foot of the caption row. 13 asks again as the
    // page closes: corrected or taken down there, the listing stood here as
    // it was until the tab was left and come back to.
    return TapArea(
      onTap: () async {
        await Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: item.id)));
        _askAgain();
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(child: ItemThumb(item, size: 400, radius: 16)),
                Positioned(left: 8, top: 8, child: StatePill(label, color: colour)),
              ],
            ),
          ),
          _caption(item),
        ],
      ),
    );
  }
}

/// 13b Annen profil. Their things are the point of the screen: it is where a
/// loop gets closed from the other side.
/// Title and value on one line under a 166-wide picture, as 13 and 13b draw it.
Widget _caption(Item item) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 7, 2, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Text(item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13, height: 1.15, fontWeight: FontWeight.w700, color: SwaplyColors.ink)),
          ),
          if (item.estimatedValueNok != null) ...[
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text('Verdi ${kr(item.estimatedValueNok)}',
                  style: const TextStyle(
                      fontSize: 10.5, fontWeight: FontWeight.w600, color: SwaplyColors.grey)),
            ),
          ],
        ],
      ),
    );

/// «★★★★★» for 4,6 and up, «★★★★☆» below: the export writes the stars as
/// text and puts the number beside them.
String _stars(double? rating) {
  if (rating == null) return '☆☆☆☆☆';
  final full = rating.round().clamp(0, 5);
  return '★' * full + '☆' * (5 - full);
}

class OtherProfileScreen extends StatefulWidget {
  const OtherProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  State<OtherProfileScreen> createState() => _OtherProfileScreenState();
}

class _OtherProfileScreenState extends State<OtherProfileScreen> {
  UserRef? _user;
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Asked for when the page opens, and again after an unblock or on coming
  /// back from one of their things. Only the first asking can fail into [LoadFailure]: after that the
  /// profile stays and the failure is a toast over it — or nothing, when
  /// [quiet]: after a block, whose own toast is up and is the news.
  Future<void> _load({bool quiet = false}) async {
    try {
      final user = await context.read<SwaplyApi>().user(widget.userId);
      if (mounted) {
        setState(() {
          _user = user;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_user == null) {
        setState(() => _error = e);
      } else if (!quiet) {
        showError(context, e);
      }
    }
  }

  void _retry() {
    setState(() => _error = null);
    _load();
  }

  /// One of their listings, from the grid or from «Send melding», and this
  /// page asked for again on the way back: a block made on the listing's
  /// «⋯» takes the listing away (see `ItemDetailScreen`) and lands here,
  /// where their things and «Send melding» stood on as if nothing had
  /// happened — «Send melding» opened the listing without asking again after
  /// it at all. Quietly when the page came back saying the listing is gone:
  /// the block's own toast is up, and is the news.
  Future<void> _openListing(String itemId) async {
    final gone = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: itemId)));
    if (mounted) await _load(quiet: gone == true);
  }

  /// «⋯» on 13b. Reporting is what the export draws behind it; unblocking has
  /// to live here too, because blocking was a tick inside a report and there
  /// was no way back from it anywhere in the app.
  ///
  /// A report that blocked, once the server has it, asks for the profile
  /// again: it went on showing their things and «Send melding» as if nothing
  /// had happened. The page stays rather than going — the server keeps a
  /// profile readable across a block because this is where a block is taken
  /// back — and what comes back is the page for somebody blocked: none of
  /// their things, the line that says so, and «Opphev blokkeringen» behind
  /// «⋯». A listing of theirs this was opened from goes when it is come back
  /// to; see `ItemDetailScreen`.
  Future<void> _menu(UserRef user) async {
    if (!user.blockedByYou) {
      final blocked =
          await showReportSheet(context, userId: user.id, personName: user.displayName);
      if (blocked && mounted) await _load(quiet: true);
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.lock_open_outlined),
              title: const Text('Opphev blokkeringen'),
              subtitle: Text('${user.displayName.split(' ').first} kan se tingene dine igjen, '
                  'og dere kan matche.'),
              onTap: () async {
                Navigator.of(sheet).pop();
                try {
                  await context.read<SwaplyApi>().unblock(user.id);
                  await _load();
                } on ApiException catch (e) {
                  if (mounted) showError(context, e);
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined, color: SwaplyColors.red),
              title: const Text('Rapporter', style: TextStyle(color: SwaplyColors.red)),
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(context,
                    userId: user.id, personName: user.displayName, alreadyBlocked: true);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;

    if (_error != null) {
      return Scaffold(
        appBar: swaplyAppBar(context, 'Profil'),
        body: LoadFailure(_error!, missing: 'Fant ikke profilen', onRetry: _retry),
      );
    }
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return SwaplyScaffold(
      currentTab: 0,
      // «‹» and «⋯» and nothing between them: the name is in the body.
      appBar: swaplyAppBar(context, '', actions: [
        headerAction(Icons.more_horiz, () => _menu(user), label: 'Flere valg'),
      ]),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 6, 22, Insets.xl),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Avatar(user.displayName, size: 76),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(user.displayName,
                              style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.4,
                                  color: SwaplyColors.ink),
                              overflow: TextOverflow.ellipsis),
                        ),
                        if (user.bankidVerified) ...[
                          const SizedBox(width: 8),
                          const Text('BankID-verifisert',
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: SwaplyColors.greenText)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(children: [
                        // Five empty stars would say «rated badly»; no rating
                        // yet says so in words.
                        if (user.ratingAvg != null) ...[
                          TextSpan(text: '${_stars(user.ratingAvg)} '),
                          TextSpan(
                              text: user.ratingAvg!.toStringAsFixed(1).replaceAll('.', ','),
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                        ] else
                          const TextSpan(text: 'Ingen vurderinger ennå'),
                        if (user.tradeCount != null)
                          TextSpan(text: ' · ${user.tradeCount} bytter'),
                      ]),
                      style: const TextStyle(fontSize: 13, color: SwaplyColors.inkBody),
                    ),
                    const SizedBox(height: 2),
                    Text(_whereAndSince(user.town, user.memberSince), style: Type.secondary),
                  ],
                ),
              ),
            ],
          ),
          if (user.blockedByYou) ...[
            const SizedBox(height: 12),
            SectionCard(
              child: Text(
                'Du har blokkert ${user.displayName.split(' ').first}. Tingene deres er '
                'skjult for deg, og dere kan ikke matche.',
                style: Type.secondary,
              ),
            ),
          ],
          if (user.interests.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: user.interests
                  .map((c) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: SwaplyColors.chip,
                          borderRadius: BorderRadius.circular(Radii.pill),
                        ),
                        child: Text(categoryLabels[c] ?? c,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: SwaplyColors.chipInk)),
                      ))
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          // A 44-tall «Send melding» between the chips and the things.
          SizedBox(
            height: 44,
            // Every conversation belongs to a trade and every trade starts on a
            // listing, so this opens one of theirs rather than a chat window
            // there is nothing to put in. A grey button that explains nothing
            // is worse than the sentence.
            child: PrimaryButton('Send melding', onPressed: () {
              if (user.items.isEmpty) {
                showNote(
                    context,
                    '${user.displayName.split(' ').first} har ingenting ute '
                    'akkurat nå. En samtale starter alltid på en gjenstand.');
                return;
              }
              _openListing(user.items.first.id);
            }),
          ),
          const SizedBox(height: 12),
          Text('${user.displayName.split(' ').first} sine gjenstander · ${user.items.length}',
              style: Type.section),
          const SizedBox(height: 12),
          if (user.items.isEmpty)
            const Text('Ingen ting ute akkurat nå.', style: Type.secondary)
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 166 / 146,
              ),
              itemCount: user.items.length,
              itemBuilder: (context, i) {
                final item = user.items[i];
                // The whole cell, to the foot of the caption row.
                return TapArea(
                  onTap: () => _openListing(item.id),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: ItemThumb(item, size: 400, radius: 16)),
                      _caption(item),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: Insets.xl),
        ],
      ),
    );
  }
}

/// 16b Innstillinger.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final me = session.me;

    return Scaffold(
      appBar: swaplyAppBar(context, 'Innstillinger', big: true),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: Insets.screen),
        children: [
          const SizedBox(height: 2),
          const Kicker('Konto'),
          const SizedBox(height: 7),
          _group([
          _tile('Profil', null,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile('E-post og telefon', null,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const EditProfileScreen()))),
          _tile(
            'BankID-verifisering',
            me?.bankidVerified == true ? 'Verifisert' : 'Ikke verifisert',
            good: me?.bankidVerified == true,
            onTap: me?.bankidVerified == true ? null : () => promptBankid(context),
          ),
          // Round 5 took the colour off this row: an invitation is an ordinary
          // thing you do, not a promotion.
          _tile('Inviter en venn', null,
              onTap: () => showShareSheet(context,
                  title: 'Inviter en venn', mint: (api) => api.createInvite())),
          ]),
          const SizedBox(height: 16),
          const Kicker('Varsler'),
          const SizedBox(height: 7),
          _group([
            // Round 5 draws this group as three switches, because 12a is a
            // lock screen: it never drew a way into the list of them inside
            // the app. The screen exists and was built, and until now nothing
            // in the app could open it.
            _tile('Se alle varsler', null,
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
            const _NotificationToggle(label: 'Swaps og bytter'),
            const _NotificationToggle(label: 'Meldinger'),
            const _NotificationToggle(label: 'Likes på tingene mine'),
          ]),
          // «Ikke vis meg slike» is a choice somebody can forget having made,
          // and the way back from it is here — only while there is something
          // to bring back, which is also why round 5, whose Ola has hidden
          // nothing, does not draw it.
          if ((me?.hiddenCount ?? 0) > 0) ...[
            const SizedBox(height: 16),
            const Kicker('Oppdag'),
            const SizedBox(height: 7),
            _group([_ShowEverythingRow(hidden: me!.hiddenCount!)]),
          ],
          if (session.isAdmin) ...[
            const SizedBox(height: 16),
            const Row(
              children: [
                Kicker('Admin'),
                SizedBox(width: 8),
                AdminBadge('kun for deg'),
              ],
            ),
            const SizedBox(height: 7),
            // The one card in the settings that is not the product: dark, so it
            // cannot be mistaken for one of the rows above it even at a glance.
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AdminColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AdminColors.accent),
              ),
              child: Column(
                children: [
                  // Its own node: the card around it holds a line that answers
                  // nothing.
                  TapArea(
                    child: InkWell(
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => const AdminScreen())),
                      child: SizedBox(
                        // Two lines of type rather than the product rows' one,
                        // which is four pixels more than 48 and the reason this
                        // is not `_tile`.
                        height: 58,
                        child: Row(
                          children: [
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('Testverktøy',
                                      style: TextStyle(
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.w700,
                                          color: AdminColors.ink)),
                                  Text('Kontoer · bygg et bytte · tilstand',
                                      style: TextStyle(fontSize: 11.5, color: AdminColors.muted)),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, size: 20, color: AdminColors.accent),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const Divider(height: 1, color: AdminColors.hairline),
                  SizedBox(
                    height: 44,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            session.actingAs
                                ? 'Du er ${me?.displayName ?? 'en testkonto'} — ikke deg selv'
                                : 'Du er ${me?.displayName ?? 'deg selv'}',
                            style: const TextStyle(fontSize: 12.5, color: AdminColors.muted),
                          ),
                        ),
                        if (session.actingAs)
                          // Words in a row 44 tall: the row is its height.
                          TapArea(
                            onTap: () async {
                              await context.read<Session>().returnToAdmin();
                              if (context.mounted) {
                                Navigator.of(context)
                                    .pushNamedAndRemoveUntil('/', (route) => false);
                              }
                            },
                            child: const SizedBox(
                              height: 44,
                              child: Center(
                                widthFactor: 1,
                                child: Text('Tilbake ↩',
                                    style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w800,
                                        color: AdminColors.accent)),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          _group([
            // A screen of its own rather than a dialog: it holds the way to
            // delete the account as well as the words about what that keeps.
            _tile('Juridisk og personvern', null,
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const LegalScreen()))),
            // A red row in the last card, not a button of its own: that is
            // where the export puts it, and it is not something to advertise.
            // Still the screen's last action, and a toast goes up over it
            // when it is at the foot.
            KeepClear(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('Logg ut',
                    style: TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w700, color: SwaplyColors.redText)),
                onTap: () async {
                  await context.read<Session>().logout();
                  // Not to the sign-in: the gate makes whoever holds the phone
                  // next a new stranger, and 02 is the first thing they see.
                  if (context.mounted) backThroughGate(context);
                },
              ),
            ),
          ]),
          const SizedBox(height: Insets.xl),
        ],
      ),
    );
  }
}

/// The export keeps a group of rows inside one card rather than letting them
/// float on the background with dividers between.
///
/// A card of one row puts it in a node of its own: alone, its tap was folded
/// into the list's node for the card, and a screen reader, and a finger on
/// the card's padding, were offered a button the size of the card that
/// answered only in its middle.
Widget _group(List<Widget> rows) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SwaplyColors.cardLine),
      ),
      child: rows.length == 1
          ? Semantics(container: true, child: rows.single)
          : Column(children: rows),
    );

/// A 48-tall row: the label, a word at the right if there is one
/// («Verifisert», green), and the chevron.
Widget _tile(String title, String? value, {VoidCallback? onTap, bool good = false}) => InkWell(
      onTap: onTap,
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 14.5, fontWeight: FontWeight.w600, color: SwaplyColors.ink)),
            ),
            if (value != null && value.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(value,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: good ? SwaplyColors.greenText : SwaplyColors.grey)),
              ),
            const Icon(Icons.chevron_right, size: 20, color: SwaplyColors.chevron),
          ],
        ),
      ),
    );

/// «Vis alt på Oppdag igjen» on 16b, with how many kinds are hidden beside
/// it. The server keeps no way to name one kind back, so it is all of them.
class _ShowEverythingRow extends StatefulWidget {
  const _ShowEverythingRow({required this.hidden});
  final int hidden;

  @override
  State<_ShowEverythingRow> createState() => _ShowEverythingRowState();
}

class _ShowEverythingRowState extends State<_ShowEverythingRow> {
  bool _busy = false;

  Future<void> _showEverything() async {
    // Read now: once the session says nothing is hidden, this row is gone
    // from the screen, and the toast is said on the screen's behalf.
    final api = context.read<SwaplyApi>();
    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await api.showEverything();
    } on ApiException catch (e) {
      if (mounted) setState(() => _busy = false);
      showErrorOn(messenger, e);
      return;
    }
    try {
      // The count this row is drawn from, which takes the row away.
      await session.refresh();
    } on ApiException {
      // Shown again either way; the next refresh brings the count.
    }
    if (mounted) setState(() => _busy = false);
    showDoneOn(messenger, 'Alt vises på Oppdag igjen.');
  }

  @override
  Widget build(BuildContext context) => _tile('Vis alt på Oppdag igjen', '${widget.hidden} skjult',
      onTap: _busy ? null : _showEverything);
}

/// Juridisk og personvern, opened from the last card on 16b — and from the
/// foot of a device's 13, which has no 16b. Round 5 draws the row and nothing
/// behind it; what is here is what the product already says about itself,
/// and the way to delete the account, which the export left no other room
/// for. Drawn without the bar, as 16b is.
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      appBar: swaplyAppBar(context, 'Juridisk og personvern'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Insets.screen, 14, Insets.screen, Insets.xl),
        children: [
          for (final paragraph in const [
            'Swaply er ikke part i byttene og fasiliterer verken frakt eller betaling. '
                'Avtalen er mellom deg og den du bytter med.',
            'Vi lagrer aldri fødselsnummer. BankID gir oss en pseudonym referanse og et '
                'tidspunkt.',
            'Sletter du kontoen, tømmes profilen din med en gang. En minimal '
                'identitetspost beholdes adskilt i tre år etter siste gjennomførte bytte, '
                'eller etter slettingen om du aldri har byttet, slik at et krav kan '
                'fremmes eller forsvares.',
            // The product owner's rule for a device nobody uses, which the
            // server keeps strictly: no request from its own token for twelve
            // months, and opening the app sends one. Said here because it is
            // the other way an account ends, and the only one nobody asks for.
            'Har du bare sett deg rundt, uten å lage en profil, slettes kontoen når '
                'appen ikke har vært åpnet på tolv måneder. Det du har likt, forsvinner '
                'med den.',
          ]) ...[
            Text(paragraph, style: Type.body),
            const SizedBox(height: 12),
          ],
          // A device looking around reaches this from its 13, and has no
          // profile to delete: its way on is to make one.
          if (session.signedIn && !session.anonymous) ...[
            const SizedBox(height: 8),
            _group([
              // A row in a card, the way «Logg ut» is on 16b and in its
              // colour: something you can do, not something offered. Kept
              // clear of by a toast, as «Logg ut» is.
              KeepClear(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: const Text('Slett kontoen',
                      style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: SwaplyColors.redText)),
                  onTap: () => _delete(context),
                ),
              ),
            ]),
          ],
          // What NLOD 2.0 asks of anybody who uses the postcode register: the
          // licensor, the licence and where to find both, and that we changed
          // it — in words a person can find, not only in the header of the
          // generated file (`backend/src/lib/postcode-register.ts`). Quiet,
          // under everything else: a source, not a term.
          const SizedBox(height: 28),
          const Kicker('Postnummer'),
          const SizedBox(height: 6),
          const Text(
            'Inneholder data under norsk lisens for offentlige data (NLOD) 2.0 '
            'tilgjengeliggjort av Posten Bring AS. Vi bruker bare postnummeret og stedet, '
            'og skriver stedsnavnet med vanlig stor forbokstav.\n'
            'Lisens: data.norge.no/nlod/no/2.0 · Kilde: bring.no/postnummerregister-ansi.txt',
            style: TextStyle(fontSize: 12, height: 1.45, color: SwaplyColors.grey),
          ),
        ],
      ),
    );
  }

  /// The sheet asks, and deletes; what the phone does after is decided here,
  /// and run even if the sheet was pulled down while the answer was on its
  /// way — the account is gone by then, and a phone left holding its token
  /// would be signed in as nobody.
  Future<void> _delete(BuildContext context) async {
    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    final acting = session.actingAs;
    await showModalBottomSheet<void>(
      context: context,
      // Over the bar, not inside the tab under it; see `pushOverBar`.
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (_) => _DeleteAccountSheet(
        acting: acting,
        onDeleted: () async {
          if (acting) {
            final gone = session.me?.id;
            // «Slett kontoen» while acting as a test account is the test
            // tool retiring it, and the admin is still who is holding the
            // phone: back to their own account. The server ended the session
            // with the account, so there is nothing to stay on.
            try {
              await session.returnToAdmin();
            } on ApiException {
              await session.logout();
            }
            // A half-written listing of the account's goes with it — once
            // the phone is somebody else, so its form keeps nothing after.
            // The other way, «Logg ut» forgets every draft on the phone.
            if (gone != null) await session.drafts.forget(gone);
          } else {
            // The server has ended every session already, so the sign-out
            // it is sent here is refused, and that is fine: what matters is
            // the phone forgetting the token and the device id, so the gate
            // makes whoever holds it next a new stranger.
            await session.logout();
          }
          if (context.mounted) backThroughGate(context);
          // Over what the gate shows next, not what it is leaving. A toast
          // is placed once, as it goes up; put up here at once, it was
          // measured against the splash, which has nothing at its foot, and
          // then lay across 02's «Fortsett» for as long as it was up.
          await _gateDecided(session);
          showDoneOn(messenger, acting ? 'Testkontoen er slettet.' : 'Kontoen er slettet.');
        },
      ),
    );
  }
}

/// Until the gate has decided what comes after a sign-out, and drawn it: a
/// new stranger's 02, the admin's own app, or the splash saying why neither
/// came. The same states `RootGate` reads, and none of them is waited on
/// for long — a start gives up after [Session.patience].
Future<void> _gateDecided(Session session) async {
  bool decided() =>
      !session.loading &&
      !session.starting &&
      (session.signedIn ||
          session.stalled ||
          session.inviteRequired ||
          session.pendingInvite != null);
  if (!decided()) {
    final done = Completer<void>();
    void heard() {
      if (decided() && !done.isCompleted) done.complete();
    }

    session.addListener(heard);
    try {
      await done.future;
    } finally {
      session.removeListener(heard);
    }
  }
  // The gate builds it in the next frame, and what a toast keeps clear of is
  // only measured once it is laid out and painted.
  await WidgetsBinding.instance.endOfFrame;
}

/// «Slett kontoen», asked for once more with the password. The sheet owns its
/// controller; see [_ReportSheet].
class _DeleteAccountSheet extends StatefulWidget {
  const _DeleteAccountSheet({required this.acting, required this.onDeleted});

  /// A session the account switcher minted. The server takes the admin's key
  /// behind it instead of the test account's password, which the admin does
  /// not know.
  final bool acting;

  final Future<void> Function() onDeleted;

  @override
  State<_DeleteAccountSheet> createState() => _DeleteAccountSheetState();
}

class _DeleteAccountSheetState extends State<_DeleteAccountSheet> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    if (_busy) return;
    final password = _password.text;
    if (!widget.acting && password.isEmpty) {
      setState(() => _error = 'Skriv inn passordet ditt.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<SwaplyApi>().deleteAccount(password: widget.acting ? null : password);
    } on ApiException catch (e) {
      // «Feil passord.», the key to the test tooling still on the account, a
      // real person in the test account's trade, or no contact: the server's
      // words, here in the sheet, over the button that was pressed.
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
      return;
    }
    await widget.onDeleted();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SafeArea(
          top: false,
          // It scrolls: a small phone with the keyboard up has no room for
          // the sentence, the field and two buttons.
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Insets.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(widget.acting ? 'Slette testkontoen?' : 'Slette kontoen?', style: Type.title),
                const SizedBox(height: Insets.sm),
                // One sentence, and what is true: `anonymiseUser` and
                // docs/DESIGN.md, «Erasure and retention».
                Text(
                  widget.acting
                      ? 'Testverktøyet sletter den som en ekte konto, og du er deg selv igjen '
                          'etterpå.'
                      : 'Profilen din tømmes og tingene dine tas ned med en gang, bytter du er '
                          'midt i avsluttes, og en minimal identitetspost holdes adskilt i tre '
                          'år etter siste gjennomførte bytte, eller etter slettingen om du '
                          'aldri har byttet.',
                  style: Type.secondary,
                ),
                if (!widget.acting) ...[
                  const SizedBox(height: Insets.lg),
                  const Text('Passord', style: Type.section),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    enabled: !_busy,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    decoration: const InputDecoration(hintText: '••••••••'),
                    onSubmitted: (_) => _delete(),
                  ),
                ],
                const SizedBox(height: Insets.lg),
                if (_error != null) ...[
                  // Coral, the «no» colour, as on 16c: a wrong password is
                  // not a report or a block.
                  Text(_error!, style: const TextStyle(color: SwaplyColors.coral, fontSize: 13)),
                  const SizedBox(height: Insets.sm),
                ],
                // The app's destructive button — «Avslå», «Trekk deg fra
                // byttet» — and not the green one: nothing here should look
                // like the way on.
                SecondaryButton(_busy ? 'Sletter kontoen …' : 'Slett kontoen',
                    destructive: true, onPressed: _busy ? null : _delete),
                const SizedBox(height: Insets.sm),
                SecondaryButton('Avbryt',
                    onPressed: _busy ? null : () => Navigator.of(context).pop()),
              ],
            ),
          ),
        ),
      );
}

class _NotificationToggle extends StatefulWidget {
  const _NotificationToggle({required this.label});
  final String label;

  @override
  State<_NotificationToggle> createState() => _NotificationToggleState();
}

class _NotificationToggleState extends State<_NotificationToggle> {
  bool _on = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  // On the phone, not the server: there is no push yet — FCM and APNs both
  // need accounts we do not have — so these are a preference this device
  // holds until there is something to tell. Forgetting them the moment the
  // screen closed made three switches that did nothing at all.
  String get _key => 'notify:${widget.label}';

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _on = prefs.getBool(_key) ?? true);
  }

  Future<void> _toggle() async {
    setState(() => _on = !_on);
    (await SharedPreferences.getInstance()).setBool(_key, _on);
  }

  @override
  // A 58-tall row with the export's own switch: 50×31, green when on, the
  // field-line grey when off, a 23px white thumb.
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _toggle,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              Expanded(
                child: Text(widget.label,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w600, color: SwaplyColors.ink)),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 50,
                height: 31,
                padding: const EdgeInsets.all(4),
                alignment: _on ? Alignment.centerRight : Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: _on ? SwaplyColors.greenPressed : SwaplyColors.fieldLine,
                  borderRadius: BorderRadius.circular(Radii.pill),
                ),
                child: Container(
                  width: 23,
                  height: 23,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                ),
              ),
            ],
          ),
        ),
      );
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final _name = TextEditingController(text: context.read<Session>().me?.displayName);
  late final _email = TextEditingController(text: context.read<Session>().me?.email);
  late final _phone = TextEditingController(text: context.read<Session>().me?.phone);
  late final _town = TextEditingController(text: context.read<Session>().me?.town);
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _town]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final api = context.read<SwaplyApi>();
    final had = context.read<Session>().me?.town;
    final town = _town.text.trim();
    final patch = <String, dynamic>{
      'displayName': _name.text.trim(),
      'email': _email.text.trim(),
      'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      // Emptied, it is null, which clears it: it was sent as '', which was
      // kept, and 13 said « · medlem siden mai» with nothing in front. Left
      // out when there is none to clear, since a server from before it took
      // null refuses one.
      if (town.isNotEmpty) 'town': town else if (had != null) 'town': null,
    };
    try {
      try {
        await api.updateMe(patch);
      } on ApiException catch (e) {
        // That server, asked to clear the town: the rest is saved without
        // it, and the town stays, which is all such a server can do.
        if (e.code != 'invalid_request' || !patch.containsKey('town') || patch['town'] != null) {
          rethrow;
        }
        await api.updateMe({...patch}..remove('town'));
      }
      if (!mounted) return;
      await context.read<Session>().refresh();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: swaplyAppBar(context, 'Rediger profil'),
        body: ListView(
          padding: const EdgeInsets.all(Insets.screen),
          children: [
            const Text('Visningsnavn', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _name),
            const SizedBox(height: Insets.md),
            const Text('E-post', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _email, keyboardType: TextInputType.emailAddress),
            const SizedBox(height: Insets.md),
            const Text('Telefonnummer', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _phone, keyboardType: TextInputType.phone),
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Brukes til Vipps-mellomlegg. Vises bare i bytter du er med i.',
                  style: Type.small),
            ),
            const SizedBox(height: Insets.md),
            const Text('Sted', style: Type.small),
            const SizedBox(height: 6),
            TextField(controller: _town),
            const SizedBox(height: Insets.lg),
            PrimaryButton('Lagre', busy: _busy, onPressed: _save),
          ],
        ),
      );
}

/// 16a Rapporter. Reporting and blocking are one gesture here, as in the export.
///
/// Whether a block went with a report the server has taken — true only once
/// it has answered. The sheet closes as «Send rapport» is pressed, before the
/// report is sent, and a caller that asked for its things again as soon as
/// the sheet had closed was asking before the block was written: the owner's
/// listings stayed in the grid it meant to take them out of.
Future<bool> showReportSheet(
  BuildContext context, {
  String? itemId,
  String? userId,
  String? personName,
  bool alreadyBlocked = false,
}) async {
  final landed = Completer<bool>();
  final sent = await showModalBottomSheet<bool>(
    context: context,
    // Over the bar, not inside the tab under it; see `pushOverBar`.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (_) => _ReportSheet(
      itemId: itemId,
      userId: userId,
      personName: personName,
      alreadyBlocked: alreadyBlocked,
      api: context.read<SwaplyApi>(),
      messenger: ScaffoldMessenger.of(context),
      landed: landed,
    ),
  );
  // Pulled down, or closed some other way: nothing was sent.
  if (sent != true) return false;
  return landed.future;
}

/// The sheet owns its text controller. Disposing one from the caller after
/// `showModalBottomSheet` returns tears it down while the exit animation is
/// still building the field, which throws.
class _ReportSheet extends StatefulWidget {
  const _ReportSheet({
    required this.api,
    required this.messenger,
    this.itemId,
    this.userId,
    this.personName,
    this.alreadyBlocked = false,
    required this.landed,
  });

  final SwaplyApi api;
  final ScaffoldMessengerState messenger;
  final String? itemId, userId, personName;
  final bool alreadyBlocked;

  /// Completed once the server has answered: whether a block went with it.
  final Completer<bool> landed;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  final _detail = TextEditingController();
  String _reason = 'spam';
  bool _block = false;
  bool _busy = false;

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => _busy = true);
    // Popped with «sent», so [showReportSheet] waits for the answer.
    Navigator.of(context).pop(true);
    final block = _block;
    try {
      await widget.api.report(
        targetItem: widget.itemId,
        targetUser: widget.userId,
        reason: _reason,
        detail: _detail.text.trim().isEmpty ? null : _detail.text.trim(),
        block: block,
      );
      // The block is said with the thanks: the screen it was made on goes,
      // or loses their things, in the same moment, and this is the one
      // sentence that says why.
      showDoneOn(
          widget.messenger,
          block
              ? 'Takk. Vi ser på rapporten. ${widget.personName!.split(' ').first} er blokkert.'
              : 'Takk. Vi ser på rapporten.');
      widget.landed.complete(block);
    } on ApiException catch (e) {
      showErrorOn(widget.messenger, e);
      widget.landed.complete(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: Insets.lg,
        right: Insets.lg,
        top: Insets.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + Insets.lg,
      ),
      // The sheet scrolls: on a small phone with the keyboard up there is not
      // room for four reasons, a note field and a block checkbox.
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.itemId != null
                  ? 'Rapporter denne gjenstanden'
                  : 'Rapporter ${widget.personName ?? 'brukeren'}',
              style: Type.title,
            ),
            const SizedBox(height: Insets.md),
            RadioGroup<String>(
              groupValue: _reason,
              onChanged: (v) => setState(() => _reason = v ?? _reason),
              child: Column(
                children: {
                  'spam': 'Spam',
                  'inappropriate': 'Upassende innhold',
                  'fraud': 'Svindel',
                  'other': 'Annet',
                }
                    .entries
                    .map((e) => RadioListTile<String>(
                          contentPadding: EdgeInsets.zero,
                          value: e.key,
                          activeColor: SwaplyColors.red,
                          title: Text(e.value, style: Type.body),
                        ))
                    .toList(),
              ),
            ),
            TextField(
              controller: _detail,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(hintText: 'Fortell mer (valgfritt)…'),
            ),
            if (widget.personName != null && !widget.alreadyBlocked) ...[
              const SizedBox(height: Insets.sm),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _block,
                activeColor: SwaplyColors.red,
                title: Text('Blokkér ${widget.personName}', style: Type.body),
                subtitle: const Text('Skjuler tingene deres og hindrer fremtidige swaps',
                    style: Type.small),
                onChanged: (v) => setState(() => _block = v ?? false),
              ),
            ],
            const SizedBox(height: Insets.md),
            SizedBox(
              height: 54,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: SwaplyColors.red,
                  shape:
                      RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
                ),
                onPressed: _busy ? null : _send,
                child: const Text('Send rapport',
                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: Insets.sm),
            SecondaryButton('Avbryt', onPressed: () => Navigator.of(context).pop()),
          ],
        ),
      ),
    );
  }
}

const _months = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

String _month(DateTime date) => _months[date.month - 1];

/// «Trondheim · medlem siden mai», the line under a name on 13 and 13b, with
/// what is not known left out rather than joined in empty. A town saved as ''
/// — what «Rediger profil» sent for an emptied field, and what real testers
/// may have stored — drew « · medlem siden mai».
String _whereAndSince(String? town, DateTime? memberSince) => [
      if (town != null && town.trim().isNotEmpty) town.trim(),
      if (memberSince != null) 'medlem siden ${_month(memberSince)}',
    ].join(' · ');

/// BankID, which `docs/DESIGN.md` asks for at the first accept and again from
/// the settings. A trust marker, never a login method: what we store is a
/// pseudonymous subject and a timestamp, and never a fødselsnummer.
///
/// Returns true when the account came back verified.
Future<bool> promptBankid(BuildContext context, {String? because}) async {
  final session = context.read<Session>();
  if (session.me?.bankidVerified == true) return true;

  // A real check goes through a provider we have no contract with yet, so the
  // screen says so rather than pretending.
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: const Text('BankID-verifisering', style: Type.heading),
      content: Text(
        '${because ?? ''}Vi har ikke avtale med en BankID-leverandør ennå. Denne '
        'knappen markerer kontoen som verifisert med en pseudonym referanse, slik '
        'flyten vil fungere når avtalen er på plass. Vi lagrer aldri '
        'fødselsnummer.',
        style: Type.body,
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(dialog).pop(false),
            child: const Text('Senere')),
        TextButton(
            onPressed: () => Navigator.of(dialog).pop(true),
            child: const Text('Verifiser')),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return false;

  try {
    await context.read<SwaplyApi>().verifyBankid('dev-${session.me!.id}');
    await session.refresh();
    return true;
  } on ApiException catch (e) {
    if (context.mounted) showError(context, e);
    return false;
  }
}
