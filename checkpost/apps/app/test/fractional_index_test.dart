import 'dart:math';

import 'package:checkpost/data/fractional_index.dart';
import 'package:flutter_test/flutter_test.dart';

/// The Dart twin of `apps/api/test/fractional-index.test.ts`. Both
/// implementations must produce byte-identical keys, so both suites assert the
/// same properties. If they ever diverge, the client and the server would
/// silently disagree about the order of a list.
void main() {
  test('starts at a known key', () {
    expect(keyBetween(null, null), firstKey);
  });

  test('the first key matches the server', () {
    // Hard-coded on purpose: this exact string is what apps/api produces for an
    // empty list, and it is the anchor the two implementations share.
    expect(firstKey, 'a0');
  });

  test('appends without bound, in order', () {
    var last = keyBetween(null, null);
    final keys = [last];
    for (var i = 0; i < 200; i++) {
      last = keyBetween(last, null);
      keys.add(last);
    }
    expect(keys, _sorted(keys));
    expect(keys.toSet().length, keys.length);
  });

  test('prepends without bound, in order', () {
    var first = firstKey;
    final keys = [first];
    for (var i = 0; i < 200; i++) {
      first = keyBetween(null, first);
      keys.add(first);
    }
    expect(keys.reversed.toList(), _sorted(keys));
  });

  test('always finds room between two adjacent keys', () {
    var low = keyBetween(null, null);
    var high = keyBetween(low, null);
    for (var i = 0; i < 300; i++) {
      final mid = keyBetween(low, high);
      expect(mid.compareTo(low) > 0, isTrue);
      expect(mid.compareTo(high) < 0, isTrue);
      if (i.isEven) {
        high = mid;
      } else {
        low = mid;
      }
    }
  });

  test('rejects reversed bounds and malformed keys', () {
    final a = keyBetween(null, null);
    final b = keyBetween(a, null);
    expect(() => keyBetween(b, a), throwsA(isA<OrderKeyError>()));
    expect(() => keyBetween(a, a), throwsA(isA<OrderKeyError>()));
    expect(isValidKey(''), isFalse);
    expect(isValidKey('a'), isFalse);
    // A trailing zero would be a second spelling of the same position.
    expect(isValidKey('a00'), isFalse);
    expect(isValidKey('!!'), isFalse);
    expect(isValidKey('a0'), isTrue);
  });

  test('survives a randomised insert storm', () {
    final random = Random(0xC0FFEE);
    final keys = <String>[keyBetween(null, null)];
    for (var i = 0; i < 5000; i++) {
      final at = random.nextInt(keys.length + 1);
      final before = at > 0 ? keys[at - 1] : null;
      final after = at < keys.length ? keys[at] : null;
      keys.insert(at, keyBetween(before, after));
    }
    expect(keys, _sorted(keys));
    expect(keys.toSet().length, keys.length);
  });
}

List<String> _sorted(List<String> keys) =>
    List.of(keys)..sort((a, b) => a.compareTo(b));
