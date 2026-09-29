/// JavaScript's `String.prototype.toLowerCase`, which is what the server folds
/// tag names with.
///
/// Two clients that fold names differently disagree about which names are the
/// same tag, and about the order the chips and the groups go in, so [tagKey]
/// cannot use Dart's own `toLowerCase` as it stands. It agrees with JavaScript
/// on everything a person is likely to type: ASCII, and the Latin-1 letters in
/// "Ølstue" and "Épicerie". Past that the VM carries older Unicode tables than
/// V8 and only the simple mappings. It leaves Cherokee, Georgian Mtavruli,
/// Osage and a run of newer Latin letters alone, turns `İ` into a bare `i`
/// where JavaScript gives `i` and a combining dot, and has no final sigma.
///
/// Those three are patched here. The table is the measured difference between
/// Node 22 and Dart 3.11 over every code point, not a hand-picked list, and
/// `test/tag_order_test.dart` holds the whole of JavaScript's table to check
/// the result against, so an SDK that changes its own tables fails a test
/// rather than quietly splitting the two clients.
String jsLowerCase(String input) {
  if (_isAscii(input)) return input.toLowerCase();
  final runes = input.runes.toList(growable: false);
  final out = StringBuffer();
  for (var i = 0; i < runes.length; i++) {
    final rune = runes[i];
    if (rune == _capitalSigma) {
      out.writeCharCode(_isFinalSigma(runes, i) ? _finalSigma : _smallSigma);
    } else if (rune == _capitalIWithDot) {
      // The one full mapping that lengthens a string: i, then U+0307.
      out
        ..writeCharCode(0x69)
        ..writeCharCode(0x0307);
    } else {
      final patched = _patch(rune);
      if (patched != null) {
        out.writeCharCode(patched);
      } else {
        out.write(String.fromCharCode(rune).toLowerCase());
      }
    }
  }
  return out.toString();
}

bool _isAscii(String input) {
  for (var i = 0; i < input.length; i++) {
    if (input.codeUnitAt(i) > 0x7F) return false;
  }
  return true;
}

const _capitalSigma = 0x03A3;
const _smallSigma = 0x03C3;
const _finalSigma = 0x03C2;
const _capitalIWithDot = 0x0130;

final _cased = RegExp(r'^\p{Cased}$', unicode: true);
final _caseIgnorable = RegExp(r'^\p{Case_Ignorable}$', unicode: true);

bool _isCased(int rune) => _cased.hasMatch(String.fromCharCode(rune));
bool _isCaseIgnorable(int rune) =>
    _caseIgnorable.hasMatch(String.fromCharCode(rune));

/// Unicode's Final_Sigma condition, which is what V8 applies: a cased letter
/// before it and none after it, looking past case-ignorable characters such as
/// apostrophes and combining marks either way. "ΟΔΟΣ" ends in ς, "ΣΑ" starts
/// with σ, and a Σ on its own stays σ.
bool _isFinalSigma(List<int> runes, int at) {
  var before = false;
  for (var i = at - 1; i >= 0; i--) {
    if (_isCaseIgnorable(runes[i])) continue;
    before = _isCased(runes[i]);
    break;
  }
  if (!before) return false;
  for (var i = at + 1; i < runes.length; i++) {
    if (_isCaseIgnorable(runes[i])) continue;
    return !_isCased(runes[i]);
  }
  return true;
}

/// The lowercase JavaScript gives where Dart gives something else, or null.
int? _patch(int rune) {
  // Binary search over the range starts. The spans do not overlap.
  var low = 0;
  var high = _patches.length ~/ 4 - 1;
  while (low <= high) {
    final mid = (low + high) >> 1;
    final start = _patches[mid * 4];
    final end = _patches[mid * 4 + 1];
    if (rune < start) {
      high = mid - 1;
    } else if (rune > end) {
      low = mid + 1;
    } else {
      final step = _patches[mid * 4 + 3];
      return (rune - start) % step == 0 ? rune + _patches[mid * 4 + 2] : null;
    }
  }
  return null;
}

/// Four numbers a range: first, last, the offset to its lowercase, and the
/// step, which is 2 where upper and lower case alternate code point by code
/// point. Measured by lowercasing every code point in Node 22.23 and in Dart
/// 3.11.5 and keeping the ones that differ, apart from U+0130 and U+03A3,
/// which are handled above.
const _patches = <int>[
  0x037F,
  0x037F,
  116,
  1,
  0x0524,
  0x052E,
  1,
  2,
  0x10C7,
  0x10C7,
  7264,
  1,
  0x10CD,
  0x10CD,
  7264,
  1,
  0x13A0,
  0x13EF,
  38864,
  1,
  0x13F0,
  0x13F5,
  8,
  1,
  0x1C89,
  0x1C89,
  1,
  1,
  0x1C90,
  0x1CBA,
  -3008,
  1,
  0x1CBD,
  0x1CBF,
  -3008,
  1,
  0x2C2F,
  0x2C2F,
  48,
  1,
  0x2C70,
  0x2C70,
  -10782,
  1,
  0x2C7E,
  0x2C7F,
  -10815,
  1,
  0x2CEB,
  0x2CED,
  1,
  2,
  0x2CF2,
  0x2CF2,
  1,
  1,
  0xA660,
  0xA660,
  1,
  1,
  0xA698,
  0xA69A,
  1,
  2,
  0xA78D,
  0xA78D,
  -42280,
  1,
  0xA790,
  0xA792,
  1,
  2,
  0xA796,
  0xA7A8,
  1,
  2,
  0xA7AA,
  0xA7AA,
  -42308,
  1,
  0xA7AB,
  0xA7AB,
  -42319,
  1,
  0xA7AC,
  0xA7AC,
  -42315,
  1,
  0xA7AD,
  0xA7AD,
  -42305,
  1,
  0xA7AE,
  0xA7AE,
  -42308,
  1,
  0xA7B0,
  0xA7B0,
  -42258,
  1,
  0xA7B1,
  0xA7B1,
  -42282,
  1,
  0xA7B2,
  0xA7B2,
  -42261,
  1,
  0xA7B3,
  0xA7B3,
  928,
  1,
  0xA7B4,
  0xA7C2,
  1,
  2,
  0xA7C4,
  0xA7C4,
  -48,
  1,
  0xA7C5,
  0xA7C5,
  -42307,
  1,
  0xA7C6,
  0xA7C6,
  -35384,
  1,
  0xA7C7,
  0xA7C9,
  1,
  2,
  0xA7CB,
  0xA7CB,
  -42343,
  1,
  0xA7CC,
  0xA7DA,
  1,
  2,
  0xA7DC,
  0xA7DC,
  -42561,
  1,
  0xA7F5,
  0xA7F5,
  1,
  1,
  0x104B0,
  0x104D3,
  40,
  1,
  0x10570,
  0x1057A,
  39,
  1,
  0x1057C,
  0x1058A,
  39,
  1,
  0x1058C,
  0x10592,
  39,
  1,
  0x10594,
  0x10595,
  39,
  1,
  0x10C80,
  0x10CB2,
  64,
  1,
  0x10D50,
  0x10D65,
  32,
  1,
  0x118A0,
  0x118BF,
  32,
  1,
  0x16E40,
  0x16E5F,
  32,
  1,
  0x16EA0,
  0x16EB8,
  27,
  1,
  0x1E900,
  0x1E921,
  34,
  1,
];
