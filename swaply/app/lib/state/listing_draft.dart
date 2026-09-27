import 'dart:math';
import 'dart:typed_data';

import '../api/models.dart';
import '../util/clock.dart';

/// One picture in 10b's strip: bytes still on the phone, the server's copy,
/// or both.
///
/// The server stores a photograph only for somebody with a profile, and a
/// device looking around has none until 10c — which comes after the form, not
/// before it. So a stranger's pictures are held here and sent once the profile
/// exists, and a picture that has reached the server says so, which is what
/// keeps a second «Legg ut» from sending it again. Somebody with a profile
/// sends each as it is picked, and the bytes are kept all the same: the
/// server lets go of a picture no listing took up, and the phone is where it
/// is sent again from.
class ListingPhoto {
  ListingPhoto.held(List<int> bytes, String this.name)
      : bytes = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);

  ListingPhoto.stored(UploadedImage this.stored)
      : bytes = null,
        name = null;

  /// Drawn from while it is here, even once the photo is sent: the strip
  /// would otherwise go blank for the moment it takes to fetch the same
  /// picture back from the server. One list for the photo's lifetime, because
  /// the image cache knows a picture in memory by the list it was drawn from.
  final Uint8List? bytes;
  final String? name;

  /// The path the listing is made with. Null until the server has the bytes.
  UploadedImage? stored;

  /// When [stored] came back, by this phone's clock, for a picture sent from
  /// the form. Null for one already on a listing, which the server keeps as
  /// long as the listing.
  DateTime? storedAt;

  /// How long a picture sent from the form is taken to be the server's. An
  /// upload no listing has taken up is swept after a day (`GRACE_HOURS` in
  /// `backend/src/lib/media-sweep.ts`; the two change together), and a draft
  /// kept on the phone outlives that easily: Monday's pictures, listed on
  /// Wednesday by their paths, went on the market as broken ones. Short of
  /// the day by enough to finish a «Legg ut» in. Measured on the phone's
  /// clock at both ends, so a phone set wrong does not move it.
  static const serverKeeps = Duration(hours: 20);

  /// The server's answer to sending this picture, and when it came.
  void sent(UploadedImage image) {
    stored = image;
    storedAt = now();
  }

  /// Whether the listing can be made with [stored]: there is one, and it is
  /// not old enough to have been swept. One that is goes up again, from the
  /// bytes the phone kept; see `_sendHeldPhotos` on 10b.
  bool get onServer {
    final at = storedAt;
    return stored != null && (at == null || now().difference(at) < serverKeeps);
  }

  /// The file in the drafts folder that holds [bytes] on this phone, once
  /// the draft store has written it; see `DraftStore`. A picture is written
  /// once, under a name of its own, so keeping the form again as it is typed
  /// into does not write the picture again. Null on the web, which has no
  /// folder, and for a picture that is only the server's.
  String? file;
}

/// 10b as it stands: what was typed, what was chosen, and the pictures.
///
/// Kept on the phone as the form is filled in, by `DraftStore`, so that the
/// app closed or killed — 10c open over the form or not — opens again on the
/// same form rather than an empty one.
///
/// And handed to the session as 10c goes up over the form, until 10c is done
/// with. Somebody with an account from another phone arrives as a stranger,
/// and on 10c they sign in rather than make a profile. That makes the phone
/// somebody else, and the gate builds that somebody a new app: the form went
/// with the old one — the title, the pictures, all of it — and nothing was
/// listed. So the new app opens on Legg ut instead, and the form there takes
/// this up and finishes what was started, as it would have after 10c.
class ListingDraft {
  const ListingDraft({
    required this.kind,
    required this.category,
    required this.condition,
    required this.title,
    required this.description,
    required this.subcategory,
    required this.value,
    required this.postalCode,
    required this.photos,
    this.finish = false,
    this.key,
  });

  final String kind, category;
  final String? condition;

  /// As typed, not trimmed: the form trims when it sends.
  final String title, description, subcategory, value, postalCode;
  final List<ListingPhoto> photos;

  /// On its way out: «Legg ut» was pressed, or «Logg inn» on 10c, and the
  /// listing itself has not been asked for yet — its pictures are still
  /// going up. A draft kept like this when the app is closed or killed is
  /// finished on the next start, as it would have been, if that start comes
  /// within `DraftStore.finishWithin`; later, the form comes back instead.
  /// Never true once the listing has been sent for: one that reached the
  /// server with the answer lost on the way must not go out a second time on
  /// its own.
  final bool finish;

  /// The listing this draft becomes, named before it is asked for: sent with
  /// «Legg ut» as `Idempotency-Key`, and the server makes one listing per key
  /// and account, handing the first back to a second asking. An answer lost
  /// on the way — no contact, or the app killed while it was out — says
  /// nothing about whether the listing was made, and «Legg ut» pressed again
  /// made it twice whenever it had been. Kept with the draft, so a press after
  /// a kill is the same asking. One per draft: a new one once a draft is
  /// listed or emptied, since the next is another thing. Null only in a draft
  /// kept by an app from before there was one; the form names it then.
  final String? key;

  /// Nothing typed and nothing picked. There is no «Forkast» on 10b — the
  /// export draws none — so emptying the form is how a draft is thrown away:
  /// a form in this state is not kept, and the one kept before it goes. The
  /// type, the category and the condition are choices on a form and not
  /// something written, so on their own they keep nothing.
  bool get isEmpty =>
      photos.isEmpty &&
      [title, description, subcategory, value, postalCode].every((text) => text.trim().isEmpty);
}

/// A fresh [ListingDraft.key]: a version 4 UUID, which is what the server
/// takes. Random rather than counted, and secure rather than quick, since it
/// names a request on the server for two days.
String newListingKey() {
  final random = Random.secure();
  final bytes = [for (var i = 0; i < 16; i++) random.nextInt(256)];
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // the RFC 4122 variant
  final hex = [for (final b in bytes) b.toRadixString(16).padLeft(2, '0')].join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}
