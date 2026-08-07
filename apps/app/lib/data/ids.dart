import 'dart:math';

final _random = Random.secure();

/// A RFC 4122 version 4 UUID.
///
/// Written by hand rather than pulled in as a dependency: the app needs
/// exactly this one function, so that an optimistically-added row and the row
/// the server stores are the same row — which is what makes a retry safe.
String newUuidV4() {
  final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// An opaque per-install id for the `X-Checkpost-Client` header. Matches the
/// API's `[A-Za-z0-9_-]{4,64}` and says nothing about the device or its owner.
String newClientId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return List.generate(
    24,
    (_) => alphabet[_random.nextInt(alphabet.length)],
  ).join();
}
