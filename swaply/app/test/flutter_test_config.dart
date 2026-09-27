// Run by `flutter test` around every test file in this folder.
//
// 10b keeps its draft on the phone, pictures in a folder under the app's
// support directory, and asks the platform where that is. A test has no
// platform to ask, and must not reach for one: every store that is not handed
// a folder of its own gets this file's, a temporary one that goes with it.
import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:swaply_app/state/draft_store.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final support = Directory.systemTemp.createTempSync('swaply-support-');
  DraftStore.supportDirectory = () async => support;
  tearDownAll(() {
    if (support.existsSync()) support.deleteSync(recursive: true);
  });
  await testMain();
}
