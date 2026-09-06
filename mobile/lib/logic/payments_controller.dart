import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/kuwe_api.dart';
import '../models/account.dart';

/// Payments are online-only, and that is a decision rather than a shortcut.
///
/// A reading is a fact about a dial: two handsets capturing the same meter
/// reach the same number, and the server can settle a conflict by rule. Money
/// is not like that. Two cashiers holding unsent receipts for one account are
/// each working from a balance the other has already moved, and the arithmetic
/// only resolves after both sync — by which point a customer has been told a
/// figure that was wrong when it was said. So nothing is queued: if the server
/// cannot be reached, no receipt is given.
class PaymentsController extends ChangeNotifier {
  PaymentsController({required this.api});

  final KuweApi api;

  List<Account> accounts = const [];
  bool loading = false;
  bool submitting = false;
  String? error;
  String search = '';

  /// Kept so the confirmation screen can show what just happened even after
  /// the list behind it has been refreshed.
  PaymentReceipt? lastReceipt;

  Future<void> load({String? query}) async {
    loading = true;
    error = null;
    notifyListeners();

    try {
      accounts = await api.accounts(query: query);
    } on ApiException catch (e) {
      error = e.isOffline
          ? 'No connection. Payments can only be taken online.'
          : e.message;
      accounts = const [];
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void setSearch(String value) {
    search = value;
    notifyListeners();
  }

  /// Returns the receipt on success, null on failure with [error] set.
  Future<PaymentReceipt?> record({
    required Account account,
    required int amount,
    required PaymentChannel channel,
    String? reference,
  }) async {
    submitting = true;
    error = null;
    notifyListeners();

    try {
      final receipt = await api.recordPayment(
        account: account,
        amount: amount,
        channel: channel,
        reference: reference,
      );
      lastReceipt = receipt;

      // Reflect the new balance in the list behind, without a round trip for
      // the whole register.
      accounts = [
        for (final row in accounts)
          if (row.id == account.id)
            Account(
              id: row.id,
              accountNo: row.accountNo,
              name: row.name,
              balance: receipt.balanceAfter,
              phone: row.phone,
              address: row.address,
              meterNo: row.meterNo,
              zoneName: row.zoneName,
              status: row.status,
            )
          else
            row,
      ];
      return receipt;
    } on ApiException catch (e) {
      error = e.isOffline
          ? 'No connection — the payment was NOT recorded. Do not give a receipt.'
          : e.message;
      return null;
    } finally {
      submitting = false;
      notifyListeners();
    }
  }

  void clearError() {
    error = null;
    notifyListeners();
  }
}
