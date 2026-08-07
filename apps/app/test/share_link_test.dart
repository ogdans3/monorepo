import 'package:checkpost/data/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const token = 'ObWVf6kPcePDbI5XEY0jmbSPqKmzEqKCPP8cxIRGR7g';

  group('parseShareToken', () {
    test('accepts every shape a person might paste', () {
      // Whatever arrives — the bare token, the link from a chat, the deep link
      // the OS hands us — has to land on the same list.
      expect(parseShareToken(token), token);
      expect(parseShareToken('https://checkpost.app/l/$token'), token);
      expect(parseShareToken('http://localhost:5173/l/$token'), token);
      expect(parseShareToken('checkpost://l/$token'), token);
      expect(parseShareToken('  https://checkpost.app/l/$token  '), token);
      expect(parseShareToken('https://checkpost.app/l/$token?utm=chat'), token);
    });

    test('rejects anything that is not a link', () {
      expect(parseShareToken(''), isNull);
      expect(parseShareToken('https://checkpost.app'), isNull);
      expect(parseShareToken('https://checkpost.app/l/tooshort'), isNull);
      expect(parseShareToken('just some text'), isNull);
      // 42 characters — one short. Silently accepting a truncated paste would
      // send someone to a confusing 401 instead of "check the whole link".
      expect(parseShareToken(token.substring(1)), isNull);
    });
  });
}
