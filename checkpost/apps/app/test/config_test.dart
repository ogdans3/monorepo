import 'package:checkpost/data/config.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shipping a production default meant every simulator failed with "can't
/// reach Checkpost" until you happened to know about a `--dart-define`. These
/// pin the fix, because it is invisible from the code alone and easy to undo.
void main() {
  group('AppConfig', () {
    test('a debug build points at a local API, not production', () {
      // Tests run in debug, which is the same mode a simulator runs in.
      expect(AppConfig.apiOrigin, isNot(AppConfig.productionApiOrigin));
      expect(AppConfig.apiOrigin, startsWith('http://'));
      expect(AppConfig.apiOrigin, endsWith(':4000'));
      expect(AppConfig.webOrigin, endsWith(':5173'));
    });

    test('builds versioned API paths without doubling slashes', () {
      final url = AppConfig.api('/list/items');
      expect(url.path, '/v1/list/items');
      expect(AppConfig.api('/list', {'since': '4'}).query, 'since=4');
    });

    test('the socket rides the same scheme as the API', () {
      // ws for http, wss for https. Getting this wrong fails only at runtime,
      // and only on the deployed build.
      expect(AppConfig.socket().scheme, 'ws');
      expect(AppConfig.socket().path, '/v1/list/socket');
    });
  });
}
