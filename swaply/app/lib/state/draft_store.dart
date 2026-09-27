import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/models.dart';
import '../util/clock.dart';
import 'listing_draft.dart';

/// A half-written 10b, kept on the phone: closing the app, or the phone
/// killing it — 10c open over the form or not — used to throw away what had
/// been typed and every picture picked for it.
///
/// The form goes in the preferences as one record per account, and each
/// picture held for a stranger in a file of its own, in `drafts/` under the
/// app's support directory. Not Documents: iOS shows that folder in Files and
/// backs it up where the person can see it, and a draft is not a document
/// anybody saved. A picture the server already has is kept as its path too,
/// with when it got there: the server sweeps an upload no listing took up
/// after a day, and a path older than [ListingPhoto.serverKeeps] is not read
/// back — the picture goes up again from the bytes, and one with no bytes
/// kept is gone with the path.
///
/// **By account id.** A draft is the account's: two people on one phone never
/// see each other's, and a test account keeps its own apart from the admin's.
/// The id survives a claim — making a profile on 10c keeps the stranger's row
/// — and a sign-in, which folds the stranger into another account on the
/// server, [handOver]s the draft to the account signed in to, so it follows
/// the person rather than staying with an account that no longer exists.
///
/// **A phone that dies half-way leaves something that loads.** A picture is
/// written under a temporary name and renamed into place before the record
/// that names it is written, and the record is one value, which the platform
/// replaces whole. A record that does not read is dropped, pictures and all;
/// a picture whose file is missing, or not the size it was written at, is
/// dropped from the draft and the rest is kept; a file no record names — a
/// phone that died between the two writes, a picture taken out — is swept.
///
/// **On the web there is no folder.** The record goes in the browser's
/// storage, with the pictures in it as base64 while they come to less than
/// [webPhotoLimit], and without them beyond that: the text comes back, the
/// pictures are picked again, and nothing else is any different.
///
/// **Nothing here throws.** A draft that could not be kept is a draft lost on
/// the next start, never a form that stops working now.
class DraftStore {
  DraftStore({Future<Directory> Function()? directory, bool? web})
      : _directory = directory ?? supportDirectory,
        _web = web ?? kIsWeb;

  /// Where a store finds the app's support directory unless it is handed one.
  /// `test/flutter_test_config.dart` points it at a temporary folder, so no
  /// test asks the platform.
  static Future<Directory> Function() supportDirectory = getApplicationSupportDirectory;

  /// How much picture a draft may carry in a browser's storage, in base64
  /// characters. Browsers give a site about five million, and the session
  /// and everything else the app keeps are in the same place.
  static const webPhotoLimit = 3000000;

  static const _prefix = 'listingDraft:';

  /// The shape of the record. A record of another shape is not read.
  static const _version = 1;

  final Future<Directory> Function() _directory;
  final bool _web;

  /// Pictures already encoded for the web, by the bytes they were encoded
  /// from: the record is written again as the form is typed into, and the
  /// pictures in it do not change.
  final _encoded = Expando<String>();

  /// One step at a time, in the order asked for: a save asked for before
  /// «Logg ut» forgets everything must not land after it. Null until the
  /// first step, which starts the line in the zone it is asked from: a
  /// finished future made with the store — in a test's `setUp`, outside the
  /// test's clock — carried every step after it out of that clock's reach.
  Future<void>? _tail;

  /// The form as it stood when [account] last had it, or null.
  Future<ListingDraft?> load(String account) => _step(() async {
        final prefs = await SharedPreferences.getInstance();
        final folder = await _folder();
        final raw = prefs.get(_key(account));
        if (raw == null) return null;
        final Map<String, dynamic> record;
        final ListingDraft draft;
        try {
          record = jsonDecode(raw as String) as Map<String, dynamic>;
          draft = _decode(record, folder);
        } catch (_) {
          // Not a record this app wrote whole, or not one of this shape: the
          // form opens empty rather than not at all.
          await prefs.remove(_key(account));
          _sweep(prefs, folder);
          return null;
        }
        if (record['finish'] == true && !draft.finish) {
          // Too old to act on, and let go of for good: a phone whose clock
          // is later set back must not find it fresh again.
          record
            ..remove('finish')
            ..remove('finishAt');
          await prefs.setString(_key(account), jsonEncode(record));
        }
        return draft;
      }, null);

  /// How long a draft stays on its way out after the app last had it so. A
  /// phone killed while the pictures went up is opened again in a moment,
  /// and finishing then is what the person asked for. Swiping the app away
  /// is also the one way to stop a «Legg ut» once pressed — the form is held
  /// still while it sends — and the listing going out on its own when the
  /// app is next opened, a week on, is not what that person asked for.
  static const finishWithin = Duration(minutes: 5);

  /// A draft of [account]'s that was on its way out when the app last
  /// closed, to be finished now; see [ListingDraft.finish]. Null for any other.
  Future<ListingDraft?> unfinished(String account) async {
    final draft = await load(account);
    return draft != null && draft.finish ? draft : null;
  }

  /// Keeps [draft] as [account]'s, in place of what was kept before. An
  /// empty one is not kept, and takes the one before it away.
  Future<void> save(String account, ListingDraft draft) => _step(() async {
        final prefs = await SharedPreferences.getInstance();
        if (draft.isEmpty) return _forget(prefs, account);
        if (_web) return _saveInBrowser(prefs, account, draft);
        final folder = await _folder();
        final record = _record(draft, [
          for (final photo in draft.photos) ?_filed(photo, folder),
        ]);
        await prefs.setString(_key(account), jsonEncode(record));
        _sweep(prefs, folder);
      }, null);

  /// Moves [from]'s draft to [to]: a sign-in folded the stranger [from] into
  /// [to], and what the person was writing goes with them. [finish] says
  /// whether it was waiting on 10c to go out; the new app then finishes it.
  Future<void> handOver(String from, String to, {required bool finish}) => _step(() async {
        if (from == to) return;
        final prefs = await SharedPreferences.getInstance();
        final raw = prefs.get(_key(from));
        if (raw == null) return;
        final Map<String, dynamic> record;
        try {
          record = jsonDecode(raw as String) as Map<String, dynamic>;
        } catch (_) {
          return _forget(prefs, from);
        }
        if (finish) {
          record['finish'] = true;
          record['finishAt'] = _stamp(now());
        } else {
          record
            ..remove('finish')
            ..remove('finishAt');
        }
        // The new one first: a phone that dies in between has the draft
        // twice, and the stranger's copy is swept with the stranger.
        await prefs.setString(_key(to), jsonEncode(record));
        await prefs.remove(_key(from));
      }, null);

  /// [account]'s draft, gone: listed, or the account deleted.
  Future<void> forget(String account) => _step(() async {
        await _forget(await SharedPreferences.getInstance(), account);
      }, null);

  /// Every draft on the phone, gone: «Logg ut». A draft is somebody's
  /// pictures of their own things, often of their own home, and the next
  /// person to hold the phone is not them.
  Future<void> forgetAll() => forgetAllBut(null);

  /// Every draft but [account]'s. For a phone that has just been made a new
  /// stranger: whoever was signed in before is gone from it — signed out, or
  /// the server no longer knows their token — and nobody can open what they
  /// left.
  Future<void> forgetAllBut(String? account) => _step(() async {
        final prefs = await SharedPreferences.getInstance();
        // The preferences answer from the copy they read when the app
        // started. In a browser another tab of the site shares the storage,
        // and a draft it kept since is not in this tab's copy — it outlived
        // «Logg ut» until the page was loaded again. So the copy is read
        // again first, and only there: on a phone this app is the only
        // writer, and a read that went to the platform and back could land
        // over a write made meanwhile. A browser's storage is read the moment
        // it is asked, so all a write in the microtasks after can lose is
        // this tab's copy of it — the session keeping its token as a stranger
        // is made — and the session reads its token from the storage itself
        // wherever another tab could have changed it; see `Session`.
        if (_web) await prefs.reload();
        final kept = account == null ? null : _key(account);
        for (final key in prefs.getKeys().toList()) {
          if (key.startsWith(_prefix) && key != kept) await prefs.remove(key);
        }
        final folder = await _folder();
        if (account == null) {
          if (folder != null && folder.existsSync()) folder.deleteSync(recursive: true);
        } else {
          _sweep(prefs, folder);
        }
      }, null);

  static String _key(String account) => '$_prefix$account';

  Future<T> _step<T>(Future<T> Function() step, T otherwise) {
    final result = (_tail ?? Future<void>.value())
        .then((_) => step())
        .then<T>((value) => value, onError: (Object _) {
      // See the class: a draft that could not be kept or read is a draft
      // lost, and never an error in the form.
      return otherwise;
    });
    _tail = result.then<void>((_) {});
    return result;
  }

  Future<void> _forget(SharedPreferences prefs, String account) async {
    await prefs.remove(_key(account));
    _sweep(prefs, await _folder());
  }

  /// The drafts folder, or null where there is none: the web, or a platform
  /// with no support directory. Asked for once.
  Future<Directory?> _folder() => _web
      ? Future.value()
      : _drafts ??= _directory()
          .then<Directory?>((dir) => Directory('${dir.path}/drafts'), onError: (Object _) => null);
  Future<Directory?>? _drafts;

  // --- the record -------------------------------------------------------------

  Map<String, Object?> _record(ListingDraft draft, List<Map<String, Object?>> photos) => {
        'v': _version,
        'kind': draft.kind,
        'category': draft.category,
        'condition': draft.condition,
        'title': draft.title,
        'description': draft.description,
        'subcategory': draft.subcategory,
        'value': draft.value,
        'postalCode': draft.postalCode,
        'photos': photos,
        'key': ?draft.key,
        // With when, kept again after each picture lands: [finishWithin]
        // counts from the last moment the app was seen sending it.
        if (draft.finish) ...{'finish': true, 'finishAt': _stamp(now())},
      };

  static String _stamp(DateTime at) => at.toUtc().toIso8601String();

  /// A moment the record says, or null for none that reads.
  static DateTime? _when(Object? value) => value is String ? DateTime.tryParse(value) : null;

  /// Whether [at] is less than [within] ago.
  static bool _within(DateTime? at, Duration within) =>
      at != null && now().difference(at) < within;

  ListingDraft _decode(Map<String, dynamic> record, Directory? folder) {
    if (record['v'] != _version) throw const FormatException('Another shape');
    String text(String key) => record[key] as String? ?? '';
    return ListingDraft(
      kind: record['kind'] as String,
      category: record['category'] as String,
      condition: record['condition'] as String?,
      title: text('title'),
      description: text('description'),
      subcategory: text('subcategory'),
      value: text('value'),
      postalCode: text('postalCode'),
      photos: [
        for (final entry in record['photos'] as List) ?_photo(entry as Map<String, dynamic>, folder),
      ],
      finish: record['finish'] == true && _within(_when(record['finishAt']), finishWithin),
      // A record from before drafts had one has none, and the form names one.
      key: record['key'] is String ? record['key'] as String : null,
    );
  }

  /// A picture as the record has it: the bytes, the server's path, or both.
  /// Null when neither is there any more, and the draft goes on without it.
  ///
  /// A path is only read back while the server can still be counting on
  /// having it — sent less than [ListingPhoto.serverKeeps] ago. Older, or
  /// kept with no word of when, it may have been swept: the bytes are sent
  /// again, and a picture with none is left out rather than drawn blank and
  /// listed broken.
  ListingPhoto? _photo(Map<String, dynamic> entry, Directory? folder) {
    final path = entry['path'], url = entry['url'];
    final at = _when(entry['storedAt']);
    final stored = path is String && url is String && _within(at, ListingPhoto.serverKeeps)
        ? UploadedImage.fromJson({'path': path, 'url': url, 'bytes': 0})
        : null;
    final name = entry['name'];
    final bytes = name is String ? _bytes(entry, folder) : null;
    if (bytes != null) {
      return ListingPhoto.held(bytes, name as String)
        ..file = entry['file'] as String?
        ..stored = stored
        ..storedAt = stored == null ? null : at;
    }
    return stored == null ? null : (ListingPhoto.stored(stored)..storedAt = at);
  }

  Uint8List? _bytes(Map<String, dynamic> entry, Directory? folder) {
    try {
      final data = entry['data'];
      if (data is String) return base64Decode(data);
      final file = entry['file'];
      if (file is! String || folder == null || !_fileName.hasMatch(file)) return null;
      final bytes = File('${folder.path}/$file').readAsBytesSync();
      // Written whole and renamed into place, so this only fails for a file
      // somebody else has been at. It is the one picture that goes.
      return bytes.length == entry['size'] ? bytes : null;
    } catch (_) {
      return null;
    }
  }

  // --- the files --------------------------------------------------------------
  //
  // Read and written synchronously, on purpose. A picture here has been shrunk
  // to a few hundred kilobytes, there are ten at most, and each is written once
  // — and a widget test's clock runs no real I/O, so an asynchronous write
  // would never land in one.

  /// Sixteen random bytes in hex, which is also all a record may name: a
  /// record is not a way to reach a file outside the folder.
  static final _fileName = RegExp(r'^[0-9a-f]{32}$');
  static final _random = Random.secure();

  /// [photo] as the record keeps it, its bytes written to the folder if they
  /// are not there yet. Null when there is nothing to keep it by: no folder
  /// to write to, and not on the server either.
  Map<String, Object?>? _filed(ListingPhoto photo, Directory? folder) {
    final bytes = photo.bytes, stored = photo.stored;
    String? file;
    if (bytes != null && folder != null) {
      final kept = photo.file;
      file = photo.file = kept != null && File('${folder.path}/$kept').existsSync()
          ? kept
          : _write(folder, bytes);
    }
    if (file == null && stored == null) return null;
    return {
      if (file != null) ...{'file': file, 'size': bytes!.length, 'name': photo.name},
      ..._path(photo),
    };
  }

  /// Where the server has [photo], and since when; nothing for a picture
  /// the server does not have.
  Map<String, Object?> _path(ListingPhoto photo) {
    final stored = photo.stored, at = photo.storedAt;
    return {
      if (stored != null) ...{
        'path': stored.path,
        'url': stored.url,
        if (at != null) 'storedAt': _stamp(at),
      },
    };
  }

  String? _write(Directory folder, Uint8List bytes) {
    try {
      folder.createSync(recursive: true);
      final name = [for (var i = 0; i < 16; i++) _random.nextInt(256).toRadixString(16).padLeft(2, '0')]
          .join();
      final part = File('${folder.path}/$name.part')..writeAsBytesSync(bytes, flush: true);
      part.renameSync('${folder.path}/$name');
      return name;
    } catch (_) {
      return null;
    }
  }

  /// Deletes every file in the folder that no draft on the phone names.
  void _sweep(SharedPreferences prefs, Directory? folder) {
    if (folder == null || !folder.existsSync()) return;
    final named = <String>{};
    for (final key in prefs.getKeys()) {
      if (!key.startsWith(_prefix)) continue;
      try {
        final record = jsonDecode(prefs.get(key) as String) as Map<String, dynamic>;
        for (final entry in record['photos'] as List) {
          final file = (entry as Map)['file'];
          if (file is String) named.add(file);
        }
      } catch (_) {
        // A record that does not read names nothing, and is dropped the next
        // time it is asked for.
      }
    }
    for (final entity in folder.listSync()) {
      if (!named.contains(entity.path.substring(folder.path.length + 1))) {
        try {
          entity.deleteSync(recursive: true);
        } catch (_) {
          // Gone already, or not ours to delete. The next sweep tries again.
        }
      }
    }
  }

  // --- the web ----------------------------------------------------------------

  Future<void> _saveInBrowser(SharedPreferences prefs, String account, ListingDraft draft) async {
    final encoded = [
      for (final photo in draft.photos)
        if (photo.bytes case final bytes?) _encoded[bytes] ??= base64Encode(bytes) else null,
    ];
    final size = encoded.fold<int>(0, (sum, data) => sum + (data?.length ?? 0));
    Future<void> keep({required bool pictures}) => prefs.setString(
        _key(account),
        jsonEncode(_record(draft, [
          for (var i = 0; i < draft.photos.length; i++)
            ?_inBrowser(draft.photos[i], pictures ? encoded[i] : null),
        ])));
    if (size <= webPhotoLimit) {
      try {
        return await keep(pictures: true);
      } catch (_) {
        // The browser's storage is fuller than it looked. The words are
        // still worth keeping.
      }
    }
    await keep(pictures: false);
  }

  Map<String, Object?>? _inBrowser(ListingPhoto photo, String? data) {
    if (data == null && photo.stored == null) return null;
    return {
      if (data != null) ...{'data': data, 'name': photo.name},
      ..._path(photo),
    };
  }
}
