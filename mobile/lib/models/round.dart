import '../logic/reading_rules.dart';

/// The billing period a round belongs to. Readings can only be captured while
/// it is open, so the app carries the status and refuses to start work on a
/// locked one rather than letting a reader fill a form the server will reject.
class Cycle {
  const Cycle({
    required this.id,
    required this.period,
    required this.status,
    this.readingStart,
    this.readingEnd,
  });

  final int id;
  final String period;
  final String status;
  final String? readingStart;
  final String? readingEnd;

  bool get isOpen => status == 'open';

  factory Cycle.fromJson(Map<String, dynamic> json) => Cycle(
        id: json['id'] as int,
        period: json['period'] as String,
        status: json['status'] as String,
        readingStart: json['reading_start'] as String?,
        readingEnd: json['reading_end'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'period': period,
        'status': status,
        'reading_start': readingStart,
        'reading_end': readingEnd,
      };
}

/// One earlier cycle's consumption, for the history on a meter's profile.
/// Carries the period so a reader can answer "what did I use in July?" rather
/// than reading three unlabelled numbers.
class ConsumptionRow {
  const ConsumptionRow({required this.period, this.usageM3, this.currentValue});

  final String period;
  final int? usageM3;
  final int? currentValue;

  factory ConsumptionRow.fromJson(Map<String, dynamic> json) => ConsumptionRow(
        period: json['period'] as String? ?? '',
        usageM3: (json['usage_m3'] as num?)?.toInt(),
        currentValue: (json['current_value'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'period': period,
        'usage_m3': usageM3,
        'current_value': currentValue,
      };
}

/// One meter on the walk: who it belongs to, what the dial said last time, and
/// whatever has been captured for it so far — whether that came down from the
/// server or was typed on this handset an hour ago.
class RoundEntry {
  const RoundEntry({
    required this.consumerId,
    required this.accountNo,
    required this.name,
    required this.previousValue,
    required this.isMetered,
    this.phone,
    this.address,
    this.meterNo,
    this.zoneName,
    this.category,
    this.balance = 0,
    this.usageHistory = const [],
    this.consumption = const [],
    this.currentValue,
    this.syncedValue,
    this.flag,
    this.billedInvoiceNo,
    this.pending = false,
    this.failure,
  });

  final int consumerId;
  final String accountNo;
  final String name;
  final String? phone;
  final String? address;
  final String? meterNo;
  final String? zoneName;
  final String? category;

  /// What the account owes across every unpaid bill — the arrears figure the
  /// office shows. Positive means owing; negative is credit.
  final int balance;
  final bool isMetered;

  final int previousValue;

  /// Bare figures, newest first, as the flag rules want them.
  final List<int> usageHistory;

  /// The same history with periods attached, for display only.
  final List<ConsumptionRow> consumption;

  /// What this handset holds, synced or not.
  final int? currentValue;

  /// What the server last confirmed. Differs from [currentValue] exactly while
  /// an edit is waiting in the outbox.
  final int? syncedValue;

  final String? flag;

  /// Set once a bill has been issued for this meter in this cycle: the reading
  /// is settled and the server will refuse to change it.
  final String? billedInvoiceNo;

  /// Captured on the handset and not yet accepted by the server.
  final bool pending;

  /// Why the last sync attempt rejected this reading, in the server's words.
  final String? failure;

  bool get isLocked => billedInvoiceNo != null || !isMetered;
  bool get isRead => currentValue != null;
  int? get usage => currentValue == null ? null : currentValue! - previousValue;

  ReadingVerdict get verdict => evaluateReading(
        previous: previousValue,
        current: currentValue,
        history: usageHistory,
      );

  RoundEntry copyWith({
    int? currentValue,
    int? syncedValue,
    String? flag,
    bool? pending,
    String? failure,
    bool clearFailure = false,
  }) =>
      RoundEntry(
        consumerId: consumerId,
        accountNo: accountNo,
        name: name,
        phone: phone,
        address: address,
        meterNo: meterNo,
        zoneName: zoneName,
        category: category,
        balance: balance,
        isMetered: isMetered,
        previousValue: previousValue,
        usageHistory: usageHistory,
        consumption: consumption,
        currentValue: currentValue ?? this.currentValue,
        syncedValue: syncedValue ?? this.syncedValue,
        flag: flag ?? this.flag,
        billedInvoiceNo: billedInvoiceNo,
        pending: pending ?? this.pending,
        failure: clearFailure ? null : (failure ?? this.failure),
      );

  factory RoundEntry.fromJson(Map<String, dynamic> json) {
    final reading = json['reading'] as Map<String, dynamic>?;
    return RoundEntry(
      consumerId: json['id'] as int,
      accountNo: json['account_no'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String?,
      address: json['address'] as String?,
      meterNo: json['meter_no'] as String?,
      zoneName: (json['zone'] as Map<String, dynamic>?)?['name'] as String?,
      category: json['category'] as String?,
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      isMetered: json['is_metered'] as bool? ?? true,
      previousValue: (json['previous_value'] as num?)?.toInt() ?? 0,
      usageHistory: ((json['usage_history'] as List?) ?? const [])
          .map((value) => (value as num).toInt())
          .toList(),
      consumption: ((json['consumption'] as List?) ?? const [])
          .map((row) => ConsumptionRow.fromJson(row as Map<String, dynamic>))
          .toList(),
      currentValue: (reading?['current_value'] as num?)?.toInt(),
      syncedValue: (reading?['current_value'] as num?)?.toInt(),
      flag: reading?['flag'] as String?,
      billedInvoiceNo: json['billed_invoice_no'] as String?,
    );
  }
}
