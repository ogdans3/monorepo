/// Fractional indexing — the Dart twin of
/// `apps/api/src/lib/fractional-index.ts`.
///
/// The client needs this so an optimistically-inserted row lands in the right
/// place before the server has answered. Both implementations must produce
/// byte-identical keys; the API's tests and this file's tests cover the same
/// cases on purpose.
library;

const _digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const _zero = '0';
const _last = 'z';

/// The key of the first item in an empty list.
const firstKey = 'a0';

class OrderKeyError implements Exception {
  OrderKeyError(this.message);
  final String message;
  @override
  String toString() => 'OrderKeyError: $message';
}

int _integerLength(String head) {
  if (head.compareTo('a') >= 0 && head.compareTo('z') <= 0) {
    return head.codeUnitAt(0) - 'a'.codeUnitAt(0) + 2;
  }
  if (head.compareTo('A') >= 0 && head.compareTo('Z') <= 0) {
    return 'Z'.codeUnitAt(0) - head.codeUnitAt(0) + 2;
  }
  throw OrderKeyError('invalid order key head: $head');
}

String _integerPart(String key) {
  final length = _integerLength(key[0]);
  if (length > key.length) throw OrderKeyError('invalid order key: $key');
  return key.substring(0, length);
}

void _assertValidInteger(String int_) {
  if (int_.length != _integerLength(int_[0])) {
    throw OrderKeyError('invalid integer part of order key: $int_');
  }
}

/// Throws unless [key] is something this module could have produced.
void assertValidKey(String key) {
  if (key.isEmpty) throw OrderKeyError('empty order key');
  if (key == 'A${_zero * 26}') throw OrderKeyError('invalid order key: $key');
  final int_ = _integerPart(key);
  final frac = key.substring(int_.length);
  // A trailing zero would give two spellings of the same position.
  if (frac.endsWith(_zero)) throw OrderKeyError('invalid order key: $key');
}

bool isValidKey(String key) {
  try {
    assertValidKey(key);
    return true;
  } on OrderKeyError {
    return false;
  }
}

String? _incrementInteger(String x) {
  _assertValidInteger(x);
  final head = x[0];
  final digs = x.substring(1).split('');
  var carry = true;
  for (var i = digs.length - 1; carry && i >= 0; i--) {
    final d = _digits.indexOf(digs[i]) + 1;
    if (d == _digits.length) {
      digs[i] = _zero;
    } else {
      digs[i] = _digits[d];
      carry = false;
    }
  }
  if (!carry) return head + digs.join();
  if (head == 'Z') return 'a$_zero';
  if (head == 'z') return null;
  final next = String.fromCharCode(head.codeUnitAt(0) + 1);
  if (next.compareTo('a') > 0) {
    digs.add(_zero);
  } else if (digs.isNotEmpty) {
    digs.removeLast();
  }
  return next + digs.join();
}

String? _decrementInteger(String x) {
  _assertValidInteger(x);
  final head = x[0];
  final digs = x.substring(1).split('');
  var borrow = true;
  for (var i = digs.length - 1; borrow && i >= 0; i--) {
    final d = _digits.indexOf(digs[i]) - 1;
    if (d == -1) {
      digs[i] = _last;
    } else {
      digs[i] = _digits[d];
      borrow = false;
    }
  }
  if (!borrow) return head + digs.join();
  if (head == 'a') return 'Z$_last';
  if (head == 'A') return null;
  final prev = String.fromCharCode(head.codeUnitAt(0) - 1);
  if (prev.compareTo('Z') < 0) {
    digs.add(_last);
  } else if (digs.isNotEmpty) {
    digs.removeLast();
  }
  return prev + digs.join();
}

String _midpoint(String a, String? b) {
  if (b != null && a.compareTo(b) >= 0) throw OrderKeyError('$a >= $b');
  if (a.endsWith(_zero) || (b != null && b.endsWith(_zero))) {
    throw OrderKeyError('trailing zero in fractional part');
  }
  if (b != null) {
    var n = 0;
    while (n < b.length && (n < a.length ? a[n] : _zero) == b[n]) {
      n++;
    }
    if (n > 0) {
      return b.substring(0, n) +
          _midpoint(a.length > n ? a.substring(n) : '', b.substring(n));
    }
  }
  final digitA = a.isEmpty ? 0 : _digits.indexOf(a[0]);
  final digitB = b == null ? _digits.length : _digits.indexOf(b[0]);
  if (digitB - digitA > 1) {
    return _digits[(0.5 * (digitA + digitB)).round()];
  }
  if (b != null && b.length > 1) return b.substring(0, 1);
  return _digits[digitA] + _midpoint(a.isEmpty ? '' : a.substring(1), null);
}

/// A key that sorts strictly after [a] and strictly before [b].
/// Pass null for either bound to mean "the start" or "the end" of the list.
String keyBetween(String? a, String? b) {
  if (a != null) assertValidKey(a);
  if (b != null) assertValidKey(b);
  if (a != null && b != null && a.compareTo(b) >= 0) {
    throw OrderKeyError('$a >= $b');
  }

  if (a == null) {
    if (b == null) return firstKey;
    final intB = _integerPart(b);
    final fracB = b.substring(intB.length);
    if (intB == 'A${_zero * 26}') return intB + _midpoint('', fracB);
    if (intB.compareTo(b) < 0) return intB;
    final dec = _decrementInteger(intB);
    if (dec == null) throw OrderKeyError('cannot decrement any further');
    return dec;
  }

  if (b == null) {
    final intA = _integerPart(a);
    final fracA = a.substring(intA.length);
    final inc = _incrementInteger(intA);
    return inc ?? intA + _midpoint(fracA, null);
  }

  final intA = _integerPart(a);
  final fracA = a.substring(intA.length);
  final intB = _integerPart(b);
  final fracB = b.substring(intB.length);
  if (intA == intB) return intA + _midpoint(fracA, fracB);
  final inc = _incrementInteger(intA);
  if (inc == null) throw OrderKeyError('cannot increment any further');
  if (inc.compareTo(b) < 0) return inc;
  return intA + _midpoint(fracA, null);
}
