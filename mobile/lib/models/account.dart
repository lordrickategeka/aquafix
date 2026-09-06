/// A consumer as the payments side of the app sees them: who they are and what
/// they owe. Deliberately thinner than RoundEntry — a cashier has no business
/// with meter readings, and the server will not send them any.
class Account {
  const Account({
    required this.id,
    required this.accountNo,
    required this.name,
    required this.balance,
    this.phone,
    this.address,
    this.meterNo,
    this.zoneName,
    this.status,
  });

  final int id;
  final String accountNo;
  final String name;
  final int balance;
  final String? phone;
  final String? address;
  final String? meterNo;
  final String? zoneName;
  final String? status;

  bool get owes => balance > 0;

  /// A credit balance is stored negative, which reads badly on a receipt.
  int get inCredit => balance < 0 ? -balance : 0;

  factory Account.fromJson(Map<String, dynamic> json) => Account(
        id: json['id'] as int,
        accountNo: json['account_no'] as String,
        name: json['name'] as String,
        balance: (json['balance'] as num?)?.toInt() ?? 0,
        phone: json['phone'] as String?,
        address: json['address'] as String?,
        meterNo: json['meter_no'] as String?,
        zoneName: (json['zone'] as Map<String, dynamic>?)?['name'] as String?,
        status: json['status'] as String?,
      );
}

/// The ways money actually arrives, matching the CHANNELS list the server
/// validates against in src/app/api/payments/route.js.
enum PaymentChannel { cash, mtn, airtel, bank }

extension PaymentChannelInfo on PaymentChannel {
  String get wire => name;

  String get label => switch (this) {
        PaymentChannel.cash => 'Cash',
        PaymentChannel.mtn => 'MTN',
        PaymentChannel.airtel => 'Airtel',
        PaymentChannel.bank => 'Bank',
      };

  /// Mobile money and bank transfers carry a transaction id worth keeping;
  /// cash has nothing to reference.
  bool get wantsReference => this != PaymentChannel.cash;
}

class PaymentReceipt {
  const PaymentReceipt({
    required this.account,
    required this.amount,
    required this.channel,
    required this.balanceAfter,
    required this.receivedAt,
    this.reference,
  });

  final Account account;
  final int amount;
  final PaymentChannel channel;
  final int balanceAfter;
  final DateTime receivedAt;
  final String? reference;
}
