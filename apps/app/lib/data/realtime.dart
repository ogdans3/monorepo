import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'api_client.dart';
import 'config.dart';
import 'models.dart';

/// What arrives down the socket.
sealed class RealtimeFrame {
  const RealtimeFrame();
}

class RealtimeHello extends RealtimeFrame {
  const RealtimeHello(this.revision, this.presence);
  final int revision;
  final int presence;
}

class RealtimeChange extends RealtimeFrame {
  const RealtimeChange(this.event);
  final ChangeEvent event;
}

class RealtimePresence extends RealtimeFrame {
  const RealtimePresence(this.presence);
  final int presence;
}

/// The link this socket authenticated with no longer works.
class RealtimeRevoked extends RealtimeFrame {
  const RealtimeRevoked(this.reason);

  /// 'rotated' or 'deleted'.
  final String reason;
}

/// The socket dropped. Not an error the user needs to see. The client
/// reconnects and reconciles.
class RealtimeDisconnected extends RealtimeFrame {
  const RealtimeDisconnected();
}

class RealtimeConnected extends RealtimeFrame {
  const RealtimeConnected();
}

/// A self-healing connection to one list's change feed.
///
/// The socket is a *hint*, never the source of truth: every reconnect is
/// followed by the controller asking `GET /changes?since=` for whatever it
/// missed. That is what makes a dropped connection a non-event, and what lets
/// the server run more than one instance without a message bus.
class RealtimeClient {
  RealtimeClient({required this.token, this.connect});

  final String token;

  /// Injected in tests. In production this is null and [_open] dials for real.
  final WebSocketChannel Function(Uri url, String token)? connect;

  final _controller = StreamController<RealtimeFrame>.broadcast();
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _retry;
  Timer? _heartbeat;
  int _attempt = 0;
  bool _closed = false;
  bool _revoked = false;

  Stream<RealtimeFrame> get frames => _controller.stream;

  bool get isConnected => _channel != null;

  /// The token travels in a header, never in the URL: query strings end up in
  /// access logs and proxy caches, and this token is the entire credential.
  WebSocketChannel _dial(Uri url) => IOWebSocketChannel.connect(
    url,
    headers: {'authorization': 'Bearer $token'},
    protocols: const ['checkpost.bearer'],
    pingInterval: const Duration(seconds: 25),
  );

  void start() {
    if (_closed || _revoked) return;
    _open();
  }

  void _open() {
    _retry?.cancel();
    try {
      final url = AppConfig.socket();
      final channel = connect?.call(url, token) ?? _dial(url);
      _channel = channel;
      _subscription = channel.stream.listen(
        _onMessage,
        onDone: _onDone,
        onError: (Object _) => _onDone(),
        cancelOnError: true,
      );
      // `connect` returns a channel immediately and dials in the background, so
      // announcing "connected" here would tell the app it is online while the
      // handshake is still failing. Wait for the handshake.
      channel.ready
          .then((_) {
            if (_closed || _revoked) return;
            _controller.add(const RealtimeConnected());
            _heartbeat?.cancel();
            _heartbeat = Timer.periodic(const Duration(seconds: 45), (_) {
              _send({'type': 'ping'});
            });
          })
          .catchError((Object _) {
            _onDone();
            return null;
          });
    } catch (_) {
      _onDone();
    }
  }

  void _send(Map<String, dynamic> frame) {
    try {
      _channel?.sink.add(jsonEncode(frame));
    } catch (_) {
      // The done handler will schedule a reconnect.
    }
  }

  void _onMessage(dynamic raw) {
    _attempt = 0;
    final Map<String, dynamic> json;
    try {
      json = jsonDecode(raw as String) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    switch (json['type']) {
      case 'hello':
        _controller.add(
          RealtimeHello(
            (json['revision'] as num).toInt(),
            (json['presence'] as num).toInt(),
          ),
        );
      case 'change':
        _controller.add(
          RealtimeChange(
            ChangeEvent.fromJson(json['event'] as Map<String, dynamic>),
          ),
        );
      case 'presence':
        _controller.add(RealtimePresence((json['presence'] as num).toInt()));
      case 'revoked':
        // Do not reconnect: this token is dead, and hammering the server with
        // a credential it just retired helps nobody.
        _revoked = true;
        _controller.add(
          RealtimeRevoked(json['reason'] as String? ?? 'rotated'),
        );
        dispose();
      default:
        break;
    }
  }

  void _onDone() {
    _heartbeat?.cancel();
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
    if (_closed || _revoked) return;
    _controller.add(const RealtimeDisconnected());
    _retry?.cancel();
    _retry = Timer(backoff(_attempt++), _open);
  }

  void dispose() {
    _closed = true;
    _retry?.cancel();
    _heartbeat?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
    if (!_controller.isClosed) _controller.close();
  }
}
