import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/kuwe_api.dart';
import '../data/local_db.dart';

enum SessionStatus { checking, signedOut, signedIn }

class SessionController extends ChangeNotifier {
  SessionController({required this.api, required this.db});

  final KuweApi api;
  final LocalDb db;

  SessionStatus status = SessionStatus.checking;
  Session? session;
  String? error;
  bool busy = false;

  ApiClient get _client => api.client;
  String get baseUrl => _client.baseUrl;

  /// Called once on launch. A stored token is trusted enough to open the app
  /// offline — a reader who cannot reach the server still has a round to walk,
  /// and the token is only rejected when the server is actually reachable and
  /// says so.
  Future<void> restore() async {
    if (!_client.hasToken) {
      status = SessionStatus.signedOut;
      notifyListeners();
      return;
    }

    try {
      session = await api.session();
      status = SessionStatus.signedIn;
    } on ApiException catch (e) {
      if (e.isAuthFailure) {
        await _client.setToken(null);
        await db.clear();
        status = SessionStatus.signedOut;
      } else {
        status = SessionStatus.signedIn;
      }
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    busy = true;
    error = null;
    notifyListeners();

    try {
      final result = await api.login(email, password);
      await _client.setToken(result.token);
      session = result.session;

      if (!result.session.hasFieldAccess) {
        await _client.setToken(null);
        session = null;
        error = 'This account has no field permissions. Ask the office to '
            'assign you the meter reader role.';
        return false;
      }

      status = SessionStatus.signedIn;
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> setBaseUrl(String url) async {
    await _client.setBaseUrl(url);
    notifyListeners();
  }

  /// Signing out wipes the cached round with the token. The handset is shared
  /// and a round carries names, phone numbers and balances.
  Future<void> logout() async {
    await _client.setToken(null);
    await db.clear();
    session = null;
    status = SessionStatus.signedOut;
    notifyListeners();
  }
}
