import 'dart:typed_data';

import '../api/models.dart';

/// One picture in 10b's strip: bytes still on the phone, the server's copy,
/// or both.
///
/// The server stores a photograph only for somebody with a profile, and a
/// device looking around has none until 10c — which comes after the form, not
/// before it. So a stranger's pictures are held here and sent once the profile
/// exists, and a picture that has reached the server says so, which is what
/// keeps a second «Legg ut» from sending it again.
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
}

/// 10b as it stood when 10c went up over it, held by the session until 10c is
/// done with.
///
/// Somebody with an account from another phone arrives as a stranger, and on
/// 10c they sign in rather than make a profile. That makes the phone somebody
/// else, and the gate builds that somebody a new app: the form went with the
/// old one — the title, the pictures, all of it — and nothing was listed. So
/// the new app opens on Legg ut instead, and the form there takes this up and
/// finishes what was started, as it would have after 10c.
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
  });

  final String kind, category;
  final String? condition;

  /// As typed, not trimmed: the form trims when it sends.
  final String title, description, subcategory, value, postalCode;
  final List<ListingPhoto> photos;
}
