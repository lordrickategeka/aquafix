import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/kuwe_api.dart';
import '../models/registration.dart';

/// Enrolling a connection from the field.
///
/// Online-only, and for the same family of reasons payments are. The KW-
/// account number is handed out by the server inside a transaction that reads
/// the highest one already issued; a handset cannot invent one without risking
/// two households holding the same number. Worse, a queued registration would
/// leave somebody told they are signed up while the office has never heard of
/// them. So this either reaches the office and returns a real account number,
/// or it plainly says it did not.
class RegistrationController extends ChangeNotifier {
  RegistrationController({required this.api});

  final KuweApi api;

  RegistrationOptions? options;
  bool loadingOptions = false;
  bool submitting = false;

  /// The banner at the top of the form.
  String? error;

  /// Messages the server put against particular fields, so each one can be
  /// shown under the box that caused it.
  Map<String, String> fieldErrors = const {};

  /// Kept so the confirmation screen can show the account number after the
  /// form behind it has been reset.
  RegisteredConsumer? lastRegistered;

  /// Called when the tab is opened. Cheap, and it doubles as a permission
  /// check: if the office has withdrawn register-consumers since sign-in, the
  /// server says so here rather than after somebody has filled in a form.
  Future<void> loadOptions({bool force = false}) async {
    if (loadingOptions) return;
    if (options != null && !force) return;

    loadingOptions = true;
    error = null;
    notifyListeners();

    try {
      options = await api.registrationOptions();
      if (options!.isEmpty) {
        error = 'The office has not set up any zones yet. A connection has to '
            'belong to one, so registration cannot go ahead until they do.';
      }
    } on ApiException catch (e) {
      error = switch (true) {
        _ when e.isOffline =>
          'No connection. A connection can only be registered while online.',
        _ when e.isForbidden =>
          'This account is no longer allowed to register connections.',
        _ => e.message,
      };
    } finally {
      loadingOptions = false;
      notifyListeners();
    }
  }

  /// Returns the registered consumer on success, null on failure with [error]
  /// and [fieldErrors] set.
  Future<RegisteredConsumer?> register({
    required String name,
    required int zoneId,
    required String category,
    required bool isMetered,
    String? phone,
    String? address,
    String? meterNo,
    int openingReading = 0,
    String? zoneName,
  }) async {
    submitting = true;
    error = null;
    fieldErrors = const {};
    notifyListeners();

    try {
      final consumer = await api.registerConsumer(
        name: name,
        zoneId: zoneId,
        category: category,
        isMetered: isMetered,
        phone: phone,
        address: address,
        meterNo: meterNo,
        openingReading: openingReading,
        zoneName: zoneName,
      );
      lastRegistered = consumer;
      return consumer;
    } on ApiException catch (e) {
      fieldErrors = e.fieldErrors;
      error = switch (true) {
        // Said in the same terms as a refused payment: nothing was saved, and
        // the person in front of you has not been signed up.
        _ when e.isOffline =>
          'No connection — nothing was registered. Do not give out an account number.',
        _ when e.isForbidden =>
          'This account is no longer allowed to register connections.',
        // A 422 names the fields; the banner would only repeat them.
        _ when e.fieldErrors.isNotEmpty => null,
        _ => e.message,
      };
      return null;
    } finally {
      submitting = false;
      notifyListeners();
    }
  }

  void clearError() {
    error = null;
    fieldErrors = const {};
    notifyListeners();
  }
}
