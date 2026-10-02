import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/draft_store.dart';
import '../state/listing_draft.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/photo_viewer.dart';
import '../widgets/shell.dart';
import 'onboarding.dart';

/// A picture kept only by a path the server may have swept. The server's own
/// words for the same refusal (`image_gone`, `backend/src/routes/items.ts`),
/// so a form that finds out first says what the server would have.
const _imageGone = 'Et av bildene er ikke lagret lenger. Legg det til på nytt.';

/// «Legg ut» answered with the listing an earlier press made, which a trade
/// has reserved since: it is out, and it stands as that press wrote it. Says
/// so rather than «Lagt ut», which would claim the form's words went with it.
const _heldByTrade =
    'Den var allerede lagt ut, og er reservert i et bytte nå. Den kan ikke endres før byttet er over.';

/// What a picker gives back: the bytes and a name to send them under. Named so
/// the screen does not have to know whether they came from a camera roll, a
/// file input in a browser, or a test.
class PickedPhoto {
  const PickedPhoto(this.bytes, this.name);
  final List<int> bytes;
  final String name;
}

/// «Legg ut» from somewhere else — an empty Oppdag, 10a, the button on 13 —
/// opens the Legg ut tab as it was left, rather than stacking a second form on
/// top of the screen it was pressed on. A screen on its own, with no tabs to
/// open, pushes the form.
void openListingForm(BuildContext context) {
  if (showTab(context, 1)) return;
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PostItemScreen()));
}

/// 10b Legg ut gjenstand. Step one of two: if there is no profile yet, step two
/// is screen 10c, which is why the header counts.
///
/// The same form edits a listing that already exists. Round 5 drew posting and
/// nothing else, but a thing you can put on the market and then never correct
/// or take down is not a listing, it is a commitment.
class PostItemScreen extends StatefulWidget {
  const PostItemScreen({super.key, this.pickImage, this.editing});

  /// Injected by the widget tests, which have no camera roll. Null everywhere
  /// else, and then the system picker is used.
  final Future<PickedPhoto?> Function()? pickImage;

  /// The listing being corrected, or null when this is a new one.
  final Item? editing;

  @override
  State<PostItemScreen> createState() => _PostItemScreenState();
}

class _PostItemScreenState extends State<PostItemScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _value = TextEditingController();
  final _postal = TextEditingController();
  final _subcategory = TextEditingController();
  final _photos = <ListingPhoto>[];
  bool _uploading = false;

  String _kind = 'item';
  String _category = 'verktoy';
  String? _condition = 'good';

  /// The condition a service had as a thing, for when it is one again.
  String _conditionAsThing = 'good';
  bool _busy = false;
  String? _error;

  /// The held picture the server said no to after 10c, drawn with a coral
  /// edge. The message over the button says what was wrong and not which of
  /// up to ten it was, and without this every «Legg ut» failed the same way
  /// until the right ✕ was guessed.
  ListingPhoto? _refused;

  /// What the register said about each postcode typed here: its town, or the
  /// server's words for one that belongs to none. By code rather than for
  /// the field, so an answer that lands after the field has moved on is kept
  /// for what it was asked about and never drawn beside another number. A
  /// code in neither has not been answered — not yet, or no contact.
  final _towns = <String, String>{};
  final _unknown = <String, String>{};
  final _asking = <String, Future<void>>{};

  /// Held back while the digits are still changing: four digits are asked
  /// about, and an edit inside them is a new four.
  Timer? _lookupAfter;
  static const _lookupDelay = Duration(milliseconds: 300);

  Item? get _editing => widget.editing;

  /// Whose draft this form is, kept on the phone as it is filled in so that
  /// the app closed or killed opens on it again; see [DraftStore]. Null while
  /// correcting a listing, which is the server's already, and with nobody
  /// signed in, which only a test mounts.
  String? _owner;

  /// Read once: [dispose] keeps the last of the typing, and a disposed form
  /// can no longer look up the tree.
  late final Session _session;

  /// Kept once the typing has held still for a moment, rather than on every
  /// letter — on the web the record carries the pictures. Kept at once when
  /// the app goes to the background, which is the last moment a phone is
  /// sure to give it before it may kill the app. Running, it is also the
  /// only sign that something has not been kept yet.
  Timer? _keepAfter;
  static const _keepDelay = Duration(milliseconds: 400);
  AppLifecycleListener? _lifecycle;

  /// Something typed or picked before the kept draft had been read. What is
  /// on screen then wins, and is kept over it.
  bool _touched = false;

  /// Listed, and the draft forgotten: nothing here is kept again.
  bool _listed = false;

  /// On its way out; see [ListingDraft.finish].
  bool _finishing = false;

  /// What «Legg ut» names the listing it asks for; see [ListingDraft.key].
  /// Taken up from a kept draft, so a press after a kill is the same asking,
  /// and a new one once the form has been emptied: what is written into it
  /// next is another thing.
  String _key = newListingKey();

  @override
  void initState() {
    super.initState();
    _session = context.read<Session>();
    final item = _editing;
    if (item == null) {
      _owner = _session.me?.id;
      for (final c in [_title, _description, _value, _postal, _subcategory]) {
        c.addListener(_changed);
      }
      _lifecycle = AppLifecycleListener(onStateChange: (state) {
        if (state != AppLifecycleState.resumed) _keepWaiting();
      });
      _resume();
      return;
    }
    _title.text = item.title;
    _description.text = item.description ?? '';
    _value.text = item.estimatedValueNok?.toString() ?? '';
    _subcategory.text = item.subcategory ?? '';
    _kind = item.kind;
    _category = item.category;
    _condition = item.condition ?? (item.kind == 'item' ? 'good' : null);
    // The photographs are already the server's, and it takes the same paths
    // back. A URL it handed out is one it accepts.
    for (final url in item.media) {
      _photos.add(ListingPhoto.stored(UploadedImage.fromJson({'path': url, 'url': url, 'bytes': 0})));
    }
  }

  /// A form that was on its way out when the phone became somebody else —
  /// signed in on 10c rather than making a profile there — or when the app
  /// was closed, taken up by this Legg ut and sent on, as it would have been;
  /// see [ListingDraft]. Not for a device still looking around: that would
  /// only be 10c again. Otherwise the form as it was last left, if it was.
  void _resume() {
    final draft = _session.listingToFinish;
    if (draft == null || !_session.signedIn || _session.anonymous) {
      unawaited(_restore());
      return;
    }
    _session.listingToFinish = null;
    _takeUp(draft);
    // After the first frame: sending sets state, and lands in the tab it is in.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _submit();
    });
  }

  /// The form as its account last left it on this phone: the app closed or
  /// killed with it half filled, 10c open over it or not.
  Future<void> _restore() async {
    final owner = _owner;
    if (owner == null) return;
    final kept = await _session.drafts.load(owner);
    if (kept == null || !mounted || _touched || _session.me?.id != owner) return;
    setState(() => _takeUp(kept));
    // Back in the form, and no longer on its way out: only a start that
    // finds it so sends it on its own; see `Session`. Kept so at once, or the
    // next start would send what the person is now looking at.
    if (kept.finish) unawaited(_keepNow());
  }

  void _takeUp(ListingDraft draft) {
    // A draft kept by an older app can name a category this one no longer
    // has, and the dropdown will not draw a value that is not in it.
    _kind = draft.kind == 'service' ? 'service' : 'item';
    if (categoryLabels.containsKey(draft.category)) _category = draft.category;
    _condition = _kind == 'service'
        ? null
        : conditionLabels.containsKey(draft.condition)
            ? draft.condition
            : 'good';
    _title.text = draft.title;
    _description.text = draft.description;
    _subcategory.text = draft.subcategory;
    _value.text = draft.value;
    _postal.text = draft.postalCode;
    _photos
      ..clear()
      ..addAll(draft.photos.take(10));
    _key = draft.key ?? _key;
    // The town beside the digits, as it was drawn when the form was left.
    final code = _postal.text.trim();
    if (code.length == 4 && !_answered(code)) {
      _lookupAfter = Timer(_lookupDelay, () => _lookUp(code));
    }
  }

  ListingDraft _draft() => ListingDraft(
        kind: _kind,
        category: _category,
        condition: _condition,
        title: _title.text,
        description: _description.text,
        subcategory: _subcategory.text,
        value: _value.text,
        postalCode: _postal.text,
        photos: [..._photos],
        finish: _finishing,
        key: _key,
      );

  /// Something in the form changed. A picture picked or taken out is kept
  /// [now]; typing, once it holds still.
  void _changed({bool now = false}) {
    _touched = true;
    if (_owner == null || _listed) return;
    _keepAfter?.cancel();
    _keepAfter = now ? null : Timer(_keepDelay, _keepNow);
    if (now) unawaited(_keepNow());
  }

  /// Whatever is waiting to be kept, now. Only that: a form with nothing
  /// changed has nothing to write, and an empty one written before its kept
  /// draft had been read back would throw that draft away.
  void _keepWaiting() {
    if (_keepAfter?.isActive ?? false) unawaited(_keepNow());
  }

  /// The form as it is now, kept for its account. Only for the account it
  /// was started by: after «Logg ut» nobody is, and a sign-in on 10c has
  /// handed the draft on to the account signed in to, whose own Legg ut
  /// keeps it from there.
  Future<void> _keepNow() {
    _keepAfter?.cancel();
    _keepAfter = null;
    final owner = _owner;
    if (owner == null || _listed || !mounted || _session.me?.id != owner) return Future.value();
    final draft = _draft();
    // Emptied, which is how a draft is thrown away: the store lets go of it,
    // and so does the key. Kept, a listing written into the empty form after
    // a «Legg ut» that had no answer came back from the server as the one
    // before it.
    if (draft.isEmpty) _key = newListingKey();
    return _session.drafts.save(owner, draft);
  }

  @override
  void dispose() {
    _lookupAfter?.cancel();
    _lifecycle?.dispose();
    // What was typed in the moment before the form went — a tab started
    // over — is kept like the rest. Not once the phone is somebody else; see
    // [_keepNow].
    _keepWaiting();
    for (final c in [_title, _description, _value, _postal, _subcategory]) {
      c.dispose();
    }
    super.dispose();
  }

  /// The postcode as it is typed: the town beside it once there are four
  /// digits, as the export draws «7030 Trondheim», and the server's words
  /// over the button for four that belong to no town. Until now a typo was
  /// found out by «Legg ut», after 10c had made the profile for it.
  void _postalTyped(String text) {
    _lookupAfter?.cancel();
    final code = text.trim();
    if (code.length == 4 && !_answered(code)) {
      _lookupAfter = Timer(_lookupDelay, () => _lookUp(code));
    }
    // The town drawn is the one for what is there now, so it goes with the
    // digit that changed.
    setState(() {});
  }

  bool _answered(String code) => _towns.containsKey(code) || _unknown.containsKey(code);

  /// Asks once per code, and a second asking joins the first.
  Future<void> _lookUp(String code) => _asking[code] ??= () async {
        final api = context.read<SwaplyApi>();
        try {
          _towns[code] = await api.town(code);
        } on ApiException catch (e) {
          // No town, or not a postcode at all: the server's own words. Nothing
          // else — no contact, a server that has no lookup — says anything
          // about the code, and the listing is still checked when it is sent.
          if (e.code == ApiException.unknownPostalCode || e.statusCode == 400) {
            _unknown[code] = e.message;
          }
        } finally {
          _asking.remove(code);
          if (mounted) setState(() {});
        }
      }();

  /// Whether the postcode may go on to 10c and the listing: empty, or not
  /// refused. Asked now if it has not been answered — «Neste» pressed within
  /// the lookup's delay, or three digits — and asked again if the digits
  /// changed while it was out.
  Future<bool> _postcodeHolds() async {
    _lookupAfter?.cancel();
    for (var code = _postal.text.trim(); code.isNotEmpty; code = _postal.text.trim()) {
      if (!_answered(code)) {
        setState(() => _busy = true);
        await _lookUp(code);
        if (!mounted) return false;
        setState(() => _busy = false);
        if (_postal.text.trim() != code) continue;
      }
      if (_unknown.containsKey(code)) {
        // The words are drawn from [_unknown] over the button; an older
        // reason written there would stand in front of them.
        setState(() => _error = null);
        return false;
      }
      break;
    }
    return true;
  }

  /// The server's limits on a listing (`itemBody` in
  /// `backend/src/routes/items.ts`; the two change together).
  static const _mostTitle = 80, _mostDescription = 2000, _mostSubcategory = 60;
  static const _mostValue = 10000000;

  /// What the server would refuse in the form as it stands, in words that
  /// name the field, or null. Only the postcode used to be asked about before
  /// 10c, so a stranger made a profile for a listing the server then refused
  /// — a title of 81 letters, a thing with no condition — and was told so in
  /// words that name nothing: «Bruk høyst 80 tegn.»
  String? get _unfit {
    final title = _title.text.trim();
    if (title.isEmpty) return 'Gi gjenstanden en tittel.';
    if (title.length > _mostTitle) return 'Tittelen kan ha høyst $_mostTitle tegn.';
    if (_description.text.trim().length > _mostDescription) {
      return 'Beskrivelsen kan ha høyst $_mostDescription tegn.';
    }
    if (_subcategory.text.trim().length > _mostSubcategory) {
      return 'Underkategorien kan ha høyst $_mostSubcategory tegn.';
    }
    final value = _valueTyped;
    if (_value.text.trim().isNotEmpty && (value == null || value > _mostValue)) {
      return 'Anslått verdi kan være høyst ${kr(_mostValue)}.';
    }
    // The server's own words for it, which name the field.
    if (_kind == 'item' && _condition == null) return 'Velg tilstand for gjenstanden.';
    return null;
  }

  Future<void> _submit() async {
    // Before 10c, not after it, as the postcode is below.
    if (_unfit case final unfit?) {
      setState(() => _error = unfit);
      return;
    }
    // Before 10c, not after it: a stranger whose postcode was wrong used to
    // make a profile for a listing the server then refused.
    if (!await _postcodeHolds() || !mounted) return;
    final editing = _editing;
    if (editing != null) return _save(editing);

    final session = context.read<Session>();
    // Looking around on a device counts as no account here: a thing on the
    // market has to belong to somebody with a name, so 10c comes first and the
    // account this device already has is claimed rather than replaced.
    if (!session.signedIn || session.anonymous) {
      // Step 2/2: no profile yet, so the profile screen comes first.
      final who = session.me?.id;
      session.listingToFinish = _draft();
      // As it is, before 10c goes over it: the app closed or killed there
      // opens on this form again.
      unawaited(_keepNow());
      await pushOverBar<bool>(context, const CreateProfileScreen(continuingToListing: true));
      // Signed in on 10c rather than making a profile there: somebody else
      // now, whose new app has this form in it, and lists it from there. Not
      // nobody becoming somebody, which is 10c making a first account.
      if (who != null && session.me?.id != who) return;
      session.listingToFinish = null;
      if (!mounted || !session.signedIn || session.anonymous) return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _refused = null;
    });
    // On its way out while its pictures go up, and kept so: the app closed or
    // killed meanwhile finishes it on the next start instead of leaving half
    // of it on the server and the rest on the phone.
    if (_photos.any((photo) => !photo.onServer)) {
      _finishing = true;
      unawaited(_keepNow());
    }
    try {
      await _sendHeldPhotos();
      if (!mounted) return;
      // And no longer, kept so before the listing is asked for: one that
      // reaches the server while the app is killed before the answer does
      // must not go out a second time on the next start. The form comes back
      // instead, and 13 says whether it went.
      _finishing = false;
      await _keepNow();
      if (!mounted) return;
      final api = context.read<SwaplyApi>();
      final listed = await api.createItem({
        'kind': _kind,
        'title': _title.text.trim(),
        if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
        'category': _category,
        if (_subcategory.text.trim().isNotEmpty) 'subcategory': _subcategory.text.trim(),
        if (_kind == 'item') 'condition': _condition,
        if (_value.text.trim().isNotEmpty) 'estimatedValueNok': int.tryParse(_value.text.trim()),
        if (_postal.text.trim().isNotEmpty) 'postalCode': _postal.text.trim(),
        'media': [for (final photo in _photos) photo.stored!.path],
      }, key: _key);
      // Out, but held by a trade and not corrected to the form; see below.
      var held = false;
      if (listed.replayed) {
        // The key had made this listing already: an earlier press reached
        // the server and its answer was lost. What stands is what that press
        // carried, and the form may have been changed since — a title put
        // right, a picture added. Handed back as it was, «Lagt ut» went up
        // over the old listing and the draft with the changes was forgotten,
        // without a word. So the listing is corrected to the form, as
        // «Rediger annonsen» would, before anything is let go of. Changed or
        // not: after a kill the phone no longer knows what the first press
        // carried. No answer, or a refusal, leaves the form and the draft as
        // they are, and the next press asks for both again.
        //
        // Except the one refusal that no press can get past: a trade has
        // reserved the listing since — its owner accepted one with it, from
        // another phone or from 13 while this form waited — and a reserved
        // listing cannot be changed, here or through «Rediger annonsen». Kept
        // as a draft, every press after that was handed the same listing and
        // refused the same correction, and once the key stopped answering
        // (48 hours) the same press listed the thing a second time. So a
        // reservation, said in the listing handed back or by the correction's
        // refusal when it came in between, is the end of the draft as much as
        // a listing made is: the thing is out, as it was first listed.
        held = listed.item.reserved;
        if (!held) {
          try {
            await api.updateItem(listed.item.id, _correction());
          } on ApiException catch (e) {
            if (e.code != 'item_reserved') rethrow;
            held = true;
          }
        }
      }
      // Listed: the draft is done with, on the phone as well.
      _listed = true;
      _keepAfter?.cancel();
      if (_owner case final owner?) unawaited(_session.drafts.forget(owner));
      // The listing is made, and that is the whole answer. Who this is is
      // asked again for 13 and the bar's counts, and nothing hangs on it: it
      // used to be waited for inside this `try`, so no answer to it said
      // «Legg ut» had failed after the listing was made — and the form, still
      // full, listed the thing a second time when pressed again. Not waited
      // for either, since the listing is out whatever it says, and 13 asks
      // again itself as it is landed on.
      unawaited(_session.refresh().then((_) {}, onError: (Object _) {}));
      if (!mounted) return;
      if (held) {
        // A note, not «Lagt ut»: out, but not with what the form says now.
        showNote(context, _heldByTrade);
      } else {
        showDone(context, 'Lagt ut. Nå kan folk like den.');
      }
      // To 13, where it now is — and the tab this form is in starts over, so
      // the next «Legg ut» is an empty form and not this listing again.
      goToTab(context, 4, startOver: true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      // No answer. After 10c this is a person with a profile and a form still
      // full, so the form stays and says so; «Legg ut» sends what is missing.
      if (mounted) setState(() => _error = noContact);
    } finally {
      if (mounted) setState(() => _busy = false);
      // It did not go, and the person has been told: the next start does not
      // send it behind their back.
      if (_finishing) {
        _finishing = false;
        unawaited(_keepNow());
      }
    }
  }

  /// The pictures picked before there was a profile to hold them, sent now
  /// that there is one. In the strip's order, which is the listing's — the
  /// first is the cover — and one at a time, so that when one fails the ones
  /// before it are the server's and the rest are still on the phone. Each is
  /// marked the moment it lands: a second «Legg ut» sends only what is left.
  ///
  /// And any sent so long ago that the server may have swept it, since no
  /// listing took it up — a draft kept over a couple of days, or a form left
  /// open that long; see [ListingPhoto.serverKeeps]. Sent again from the
  /// bytes kept for it. One kept only by its path — a browser whose storage
  /// had no room for the bytes — has nothing to send it from, and is refused
  /// here, with its coral edge, rather than listed as a broken picture.
  Future<void> _sendHeldPhotos() async {
    final api = context.read<SwaplyApi>();
    for (final photo in [..._photos]) {
      if (photo.onServer) continue;
      final bytes = photo.bytes, name = photo.name;
      if (bytes == null || name == null) {
        _refused = photo;
        throw ApiException(400, 'image_gone', _imageGone);
      }
      try {
        photo.sent(await api.uploadImage(bytes, filename: name));
        // Kept with its path, so a start after a kill here does not send it
        // again.
        unawaited(_keepNow());
      } on ApiException catch (e) {
        // Too big, not a picture the server reads, or empty: this one, and
        // not the connection or the session. Marked, so the ✕ that fixes it
        // is the one on the tile with the coral edge.
        if (e.statusCode == 400 || e.statusCode == 413 || e.statusCode == 415) {
          _refused = photo;
        }
        rethrow;
      }
    }
  }

  /// The form, as a correction to a listing that already stands: «Rediger
  /// annonsen», and a «Legg ut» the server answered with the listing an
  /// earlier press made.
  ///
  /// A field emptied is sent as null, which a PATCH takes as «clear it». It
  /// used to send an emptied description or subcategory as '' and leave an
  /// emptied value out, and the server kept all three. A server from before
  /// it cleared on null keeps them still, which is no worse. A service has no
  /// condition, so a thing made a service has its own cleared.
  Map<String, dynamic> _correction() => {
        'kind': _kind,
        'title': _title.text.trim(),
        'description': _orNull(_description.text),
        'category': _category,
        'subcategory': _orNull(_subcategory.text),
        'condition': _kind == 'item' ? _condition : null,
        'estimatedValueNok': _valueTyped,
        // Only when one is typed. The server keeps the town a postcode
        // belongs to and not the postcode, so the field opens empty, and
        // empty leaves the listing where it is.
        if (_postal.text.trim().isNotEmpty) 'postalCode': _postal.text.trim(),
        'media': [for (final photo in _photos) photo.stored!.path],
      };

  /// What was typed, or null for nothing but spaces.
  static String? _orNull(String typed) => typed.trim().isEmpty ? null : typed.trim();

  /// The value as typed, in whole kroner, or null for none.
  int? get _valueTyped => int.tryParse(_value.text.trim());

  /// The same fields, sent as a correction. A listing a trade is holding is
  /// refused by the server, and that message is the one worth showing.
  Future<void> _save(Item item) async {
    setState(() {
      _busy = true;
      _error = null;
      _refused = null;
    });
    try {
      // A picture added while correcting is sent as it is picked, and one
      // that has waited in an open form long enough to be swept goes again.
      await _sendHeldPhotos();
      if (!mounted) return;
      await context.read<SwaplyApi>().updateItem(item.id, _correction());
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// 10b «Legg til bilder». The picture is shrunk on the phone before it is
  /// sent: a camera makes five megabytes and a listing needs a few hundred
  /// kilobytes, and the smaller of the two is also the one that loads on a bus.
  ///
  /// The picker is injectable because a widget test has no camera roll, and the
  /// half worth testing is everything after it.
  ///
  /// Without a profile the picture is only kept: the server refuses to store
  /// one for a device, and «Neste» sends it once 10c has made the profile.
  Future<void> _addPhoto() async {
    // Not while «Legg ut» is sending the strip: it goes through a copy, and a
    // picture added behind it would be listed without ever being sent.
    if (_uploading || _busy) return;

    final picked = widget.pickImage != null
        ? await widget.pickImage!()
        : await ImagePicker()
            .pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82)
            .then((file) async =>
                file == null ? null : PickedPhoto(await file.readAsBytes(), file.name));
    if (picked == null || !mounted) return;

    final session = context.read<Session>();
    if (!session.signedIn || session.anonymous) {
      setState(() {
        _photos.add(ListingPhoto.held(picked.bytes, picked.name));
        // The reason and the coral edge go together, and the next «Legg ut»
        // says again if it still holds.
        _error = null;
        _refused = null;
      });
      _changed(now: true);
      return;
    }

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final image =
          await context.read<SwaplyApi>().uploadImage(picked.bytes, filename: picked.name);
      if (mounted) {
        // The bytes are kept with the path: the draft keeps them on the
        // phone, and the server lets go of an upload no listing takes up
        // within a day — a draft finished later sends them again.
        setState(() => _photos.add(ListingPhoto.held(picked.bytes, picked.name)..sent(image)));
        _changed(now: true);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final watched = context.watch<Session>();
    final signedIn = watched.signedIn && !watched.anonymous;

    return SwaplyScaffold(
      currentTab: 1,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // «Legg ut en gjenstand» and «1/2» do not both fit on a narrow
                // phone, and the heading is the one that may give way.
                Flexible(
                    child: Text(_editing == null ? 'Legg ut en gjenstand' : 'Rediger annonsen',
                        style: Type.screen)),
                if (!signedIn && _editing == null)
                  const Text('1/2',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: SwaplyColors.grey)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 13, 22, 0),
              children: [
                _photoStrip(),
                const SizedBox(height: 14),
                _labelled(
                  'Tittel',
                  TapArea(
                    child: TextField(
                      controller: _title,
                      style: _fieldText,
                      decoration: _field('Bosch drill 18V'),
                    ),
                  ),
                  below: 12,
                ),
                _labelled(
                  'Beskrivelse',
                  TapArea(
                    child: TextField(
                      controller: _description,
                      minLines: 3,
                      maxLines: 6,
                      style: _fieldText,
                      decoration: _field('Hva bør folk vite?'),
                    ),
                  ),
                  below: 12,
                ),
                _labelled(
                  'Anslått verdi',
                  below: 12,
                  Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: TapArea(
                          child: TextField(
                            controller: _value,
                            keyboardType: TextInputType.number,
                            // A price typed with a space — «1 500» — parses to
                            // nothing, and a value the server is willing to
                            // ignore is a listing that quietly loses its price.
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            style: _fieldText,
                            // suffixText hides until the field has focus; the
                            // export shows «kr» from the start.
                            decoration: _field('600').copyWith(
                                suffixIcon: const Padding(
                                    padding: EdgeInsets.only(right: 14),
                                    child: Text('kr',
                                        style:
                                            TextStyle(fontSize: 14, color: SwaplyColors.grey))),
                                suffixIconConstraints:
                                    const BoxConstraints(minWidth: 0, minHeight: 0)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        flex: 4,
                        child: Text('Helt billige ting kan være gratis',
                            style: TextStyle(
                                fontSize: 11.5, height: 1.3, color: SwaplyColors.greyLight)),
                      ),
                    ],
                  ),
                ),
                _label('Type'),
                // The two pills share their row and the 12 under it.
                Align(
                  alignment: Alignment.centerLeft,
                  child: TapRoom(
                    room: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _pick('Gjenstand', _kind == 'item', () {
                          // With the condition it had as a thing. Made a
                          // service and back it had none, which nothing on
                          // the form showed, and the server refused the
                          // listing after 10c.
                          setState(() {
                            _kind = 'item';
                            _condition ??= _conditionAsThing;
                          });
                          _changed();
                        }),
                        const SizedBox(width: Insets.sm),
                        _pick('Tjeneste', _kind == 'service', () {
                          // A service has no condition, and it is never reserved.
                          setState(() {
                            if (_condition case final kept?) _conditionAsThing = kept;
                            _kind = 'service';
                            _condition = null;
                          });
                          _changed();
                        }),
                      ],
                    ),
                  ),
                ),
                // Two columns, as the export sets them: category beside
                // subcategory, condition beside postcode.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _labelled(
                        'Hovedkategori',
                        below: 12,
                        TapArea(
                          child: DropdownButtonFormField<String>(
                            initialValue: _category,
                            isDense: true,
                            // Not `_fieldText`: a dropdown swaps the ambient
                            // text style for its own, so the family has to
                            // come along explicitly.
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontSize: 14, color: SwaplyColors.ink),
                            icon: const Icon(Icons.keyboard_arrow_down,
                                size: 18, color: SwaplyColors.greySoft),
                            decoration: _field(''),
                            items: categoryLabels.entries
                                .map((e) => DropdownMenuItem(
                                    value: e.key,
                                    child: Text(e.value, overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (v) {
                              setState(() => _category = v ?? _category);
                              _changed();
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _labelled(
                        'Underkategori',
                        below: 12,
                        TapArea(
                          child: TextField(
                            controller: _subcategory,
                            style: _fieldText,
                            decoration: _field('Elektroverktøy'),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_kind == 'item') ...[
                      Expanded(child: _labelled('Tilstand', _segmented())),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _labelled('Postnummer', TapArea(child: _postcodeField())),
                          // Under the field it is about, three below it, as
                          // the export sets it: the town beside the digits is
                          // what the note means.
                          const Padding(
                            padding: EdgeInsets.only(top: 3),
                            child: Text('Kun by vises for andre',
                                style: TextStyle(fontSize: 10, color: SwaplyColors.grey)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
          Padding(
            // The export's 30 under «Neste» is room over the home indicator,
            // on a 10b drawn without the bar. With the bar under the form —
            // the Legg ut tab — the bar keeps that room itself, and the 30 on
            // top of it cut «Kun by vises for andre» off at the edge of the
            // form, which the export shows whole: 12 under, as over.
            padding: EdgeInsets.fromLTRB(22, 12, 22,
                TabShell.maybeOf(context) == null || TabShell.contains(context) ? 12 : 30),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Over the button, as on 10c and 16c, and not at the foot of
                // the form: on a phone the form runs past the screen, and a
                // reason written down there was never seen — after 10c the
                // spinner stopped, «Neste» became «Legg ut», and nothing said
                // why nothing had been listed.
                if (_said case final said?) ...[
                  // Coral, the «no» colour. Red is report and block, and an
                  // error here is neither.
                  Text(said, style: const TextStyle(color: SwaplyColors.coral, fontSize: 13)),
                  const SizedBox(height: Insets.sm),
                ],
                PrimaryButton(
                  _editing != null
                      ? 'Lagre endringene'
                      : signedIn
                          ? 'Legg ut'
                          : 'Neste',
                  busy: _busy,
                  // Held while a picture is on its way: listed now, the
                  // listing would go out without it. The spinner on the strip
                  // says what is being waited for.
                  enabled: !_uploading,
                  // Enabled otherwise: a disabled button explains nothing,
                  // and an empty title should be told, not silently refused;
                  // see [_unfit].
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static const _fieldText = TextStyle(fontSize: 14, color: SwaplyColors.ink);

  /// What goes over the button: the last thing that went wrong, or else the
  /// server's words for the postcode in the field. Those stand as long as the
  /// digits do, so they come and go with the typing and need no clearing.
  String? get _said => _error ?? _unknown[_postal.text.trim()];

  /// «7030» with «Trondheim» beside it, 11 and grey against the field's right
  /// edge, where the export draws the town. A code with no town gets the
  /// coral edge the refused photograph gets, and the reason over the button.
  Widget _postcodeField() {
    final code = _postal.text.trim();
    final town = _towns[code];
    final refused = _unknown.containsKey(code);
    // The export draws this one field its own way: 42 tall, corners of 12,
    // 12 at the sides — the town has to fit beside the digits.
    OutlineInputBorder edge(Color colour) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colour),
        );
    return LayoutBuilder(
      builder: (context, box) => TextField(
        controller: _postal,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        maxLength: 4,
        style: _fieldText,
        onChanged: _postalTyped,
        decoration: _field('7030').copyWith(
          counterText: '',
          // 14 of text at 1.2 is 16.8; the rest of 42 is the padding.
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12.6),
          border: edge(SwaplyColors.fieldLine),
          suffixIcon: town == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(left: 8, right: 12),
                  child: Text(town,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: SwaplyColors.grey)),
                ),
          // What the four digits leave of the field — the 12 in front of
          // them, their 32 and a hair — so «Mo i Rana» fits and a longer
          // name is cut rather than pushing the digits out.
          suffixIconConstraints: BoxConstraints(maxWidth: math.max(0, box.maxWidth - 46)),
          enabledBorder: edge(refused ? SwaplyColors.coral : SwaplyColors.fieldLine),
          focusedBorder: edge(refused ? SwaplyColors.coral : SwaplyColors.greenPressed),
        ),
      ),
    );
  }

  /// The export's fields on this screen are a size smaller than the sign-in
  /// ones: 14px in 11/14 padding on a 14 radius.
  InputDecoration _field(String hint) => InputDecoration(
        hintText: hint.isEmpty ? null : hint,
        hintStyle: const TextStyle(fontSize: 14, color: SwaplyColors.greyLight),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: Type.section),
      );

  /// A field with its label over it, answering as one: a finger on the label
  /// goes to the field, as a label's does on the web. The fields here are 39
  /// tall, and the label and [below], the gap under the field, make them a
  /// whole target.
  Widget _labelled(String label, Widget field, {double below = 0}) => TapRoom(
        room: EdgeInsets.only(bottom: below),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [_label(label), field],
        ),
      );

  /// Condition as a three-way segment, 31 tall in a chip-coloured track.
  Widget _segmented() => Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: SwaplyColors.chip,
          borderRadius: BorderRadius.circular(11),
        ),
        child: Row(
          children: conditionLabels.entries
              .map((e) => Expanded(
                    child: TapArea(
                      onTap: () {
                        setState(() => _condition = e.key);
                        _changed();
                      },
                      child: Container(
                        height: 31,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _condition == e.key ? Colors.white : null,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Text(e.value,
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight:
                                    _condition == e.key ? FontWeight.w700 : FontWeight.w600,
                                color: _condition == e.key
                                    ? SwaplyColors.ink
                                    : SwaplyColors.greySoft)),
                      ),
                    ),
                  ))
              .toList(),
        ),
      );

  Widget _photoStrip() => SizedBox(
        height: 106,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            GestureDetector(
              onTap: _photos.length >= 10 ? null : _addPhoto,
              child: Container(
                width: 106,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F7F3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFB9C4BC)),
                ),
                child: _uploading
                    ? const Center(
                        child: SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.2),
                        ),
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('+',
                              style: TextStyle(
                                  fontSize: 26, height: 1, color: SwaplyColors.greenText)),
                          SizedBox(height: 4),
                          Text('Legg til bilder',
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: SwaplyColors.greenText)),
                          Text('opptil 10',
                              style: TextStyle(fontSize: 9, color: SwaplyColors.grey)),
                        ],
                      ),
              ),
            ),
            ..._photos.asMap().entries.map((entry) => Padding(
                  padding: const EdgeInsets.only(left: Insets.sm),
                  child: Stack(
                    children: [
                      // Tapped, the strip's pictures open big, from this one.
                      // A convenience for eyes, and not a target to a screen
                      // reader: the ✕ is the tile's one, and a picture seen
                      // bigger says nothing more to somebody who hears it.
                      GestureDetector(
                        excludeFromSemantics: true,
                        onTap: () => showPhotos(
                            context, [for (final p in _photos) _picture(p)],
                            initial: entry.key),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(Radii.card),
                          child: _thumbnail(entry.value),
                        ),
                      ),
                      if (identical(entry.value, _refused))
                        Positioned.fill(
                          child: DecoratedBox(
                            key: const ValueKey('refused-photo'),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(Radii.card),
                              border: Border.all(color: SwaplyColors.coral, width: 2),
                            ),
                          ),
                        ),
                      // The cover says so in its top corner, 6 in, where the
                      // export puts it — across from the ✕.
                      if (entry.key == 0)
                        Positioned(
                          left: 6,
                          top: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: SwaplyColors.greenDeep,
                              borderRadius: BorderRadius.circular(Radii.pill),
                            ),
                            child: const Text('Forside',
                                style: TextStyle(
                                    color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      // 22 across, 2 in from the corner, and answering
                      // across the tile's corner: 44 square, in from its
                      // edges, and none of it over the next tile.
                      Positioned(
                        right: 0,
                        top: 0,
                        child: TapArea(
                          room: const EdgeInsets.fromLTRB(kTapTarget - 24, 2, 2, kTapTarget - 24),
                          label: 'Fjern bildet',
                          // Held still while «Legg ut» is sending the strip.
                          onTap: _busy
                              ? null
                              : () {
                                  setState(() {
                                    final gone = _photos.removeAt(entry.key);
                                    if (identical(gone, _refused)) _refused = null;
                                  });
                                  _changed(now: true);
                                },
                          child: const CircleAvatar(
                            radius: 11,
                            backgroundColor: Colors.white,
                            child: Icon(Icons.close, size: 13),
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      );

  /// A picture in the strip, from memory while the bytes are on the phone and
  /// from the server otherwise.
  ImageProvider _picture(ListingPhoto photo) {
    final bytes = photo.bytes;
    return bytes != null ? MemoryImage(bytes) : NetworkImage(photo.stored!.url);
  }

  /// From memory while the bytes are on the phone, from the server otherwise.
  Widget _thumbnail(ListingPhoto photo) {
    Widget blank(BuildContext _, Object _, StackTrace? _) =>
        Container(height: 106, width: 106, color: SwaplyColors.greenSoft);
    final bytes = photo.bytes;
    if (bytes != null) {
      return Image.memory(bytes,
          height: 106, width: 106, fit: BoxFit.cover, errorBuilder: blank);
    }
    return Image.network(photo.stored!.url,
        height: 106, width: 106, fit: BoxFit.cover, errorBuilder: blank);
  }

  Widget _pick(String label, bool selected, VoidCallback onTap) => TapArea(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? SwaplyColors.greenPressed : Colors.white,
            borderRadius: BorderRadius.circular(Radii.pill),
            border: Border.all(
                color: selected ? SwaplyColors.greenPressed : const Color(0x22064E3B)),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : SwaplyColors.ink)),
        ),
      );
}
