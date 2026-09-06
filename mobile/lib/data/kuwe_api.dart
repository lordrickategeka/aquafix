import '../models/account.dart';
import '../models/registration.dart';
import '../models/round.dart';
import 'api_client.dart';

class Session {
  const Session({
    required this.userId,
    required this.email,
    required this.roles,
    required this.permissions,
    this.organisationName = 'Kuwe Foundation',
  });

  final int userId;
  final String email;
  final List<String> roles;
  final List<String> permissions;
  final String organisationName;

  bool can(String permission) => permissions.contains(permission);
  bool get canCaptureReadings => can('capture-readings');
  bool get canRecordPayments => can('record-payments');
  bool get canRegisterConsumers => can('register-consumers');

  /// Whether this account has any business in the field app at all. Checked at
  /// sign-in so somebody is refused at the door rather than shown an app with
  /// no tabs in it.
  bool get hasFieldAccess => canCaptureReadings || canRecordPayments || canRegisterConsumers;

  factory Session.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>;
    final organisation = json['organisation'] as Map<String, dynamic>?;
    return Session(
      userId: user['id'] as int,
      email: user['email'] as String,
      roles: ((json['roles'] as List?) ?? const []).map((r) => r as String).toList(),
      permissions:
          ((json['permissions'] as List?) ?? const []).map((p) => p as String).toList(),
      organisationName: organisation?['name'] as String? ?? 'Kuwe Foundation',
    );
  }
}

class RoundPayload {
  const RoundPayload({required this.cycle, required this.entries, required this.syncedAt});

  final Cycle? cycle;
  final List<RoundEntry> entries;
  final String syncedAt;
}

/// One rejected reading, in the server's own words. The messages are written
/// for the person holding the meter key, so they are shown verbatim.
class SyncFailure {
  const SyncFailure({
    required this.consumerId,
    required this.accountNo,
    required this.message,
    this.code,
  });

  final int consumerId;
  final String? accountNo;
  final String message;

  /// Why, in a word the app can branch on — see SETTLED_CODES in the server's
  /// src/lib/readings.js.
  final String? code;

  /// Nothing the reader types will ever be accepted for this meter in this
  /// cycle. The value goes back to what the office holds instead of sitting in
  /// the outbox forever.
  bool get isSettled =>
      code == 'cycle-closed' || code == 'billed' || code == 'unmetered';
}

class SyncResult {
  const SyncResult({required this.saved, required this.failures, this.cycleStatus});

  /// The cycle's status as the server sees it right now. A handset that has
  /// been out of signal learns here that the office has locked the cycle.
  final String? cycleStatus;

  /// Keyed by consumer id. The flag comes back from the server rather than
  /// being assumed from the local verdict, so a reading the office will have to
  /// review is labelled as such on the handset too.
  final Map<int, ({int? usage, String? flag})> saved;
  final List<SyncFailure> failures;
}

class KuweApi {
  KuweApi(this.client);

  final ApiClient client;

  Future<({Session session, String token})> login(String email, String password) async {
    final data = await client.post('/api/auth/login', {
      'email': email,
      'password': password,
      // Asks the server for the raw JWT instead of only the cookie.
      'client': 'mobile',
    });

    final token = data['token'] as String?;
    if (token == null) {
      throw ApiException('The server did not issue a token for this app.');
    }
    return (session: Session.fromJson(data), token: token);
  }

  Future<Session> session() async {
    final data = await client.get('/api/mobile/session');
    return Session.fromJson(data);
  }

  Future<RoundPayload> round({int? zoneId}) async {
    final data = await client.get(
      '/api/mobile/round',
      query: {'zone': ?zoneId},
    );

    final cycle = data['cycle'] as Map<String, dynamic>?;
    return RoundPayload(
      cycle: cycle == null ? null : Cycle.fromJson(cycle),
      entries: ((data['consumers'] as List?) ?? const [])
          .map((json) => RoundEntry.fromJson(json as Map<String, dynamic>))
          .toList(),
      syncedAt: data['synced_at'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  /// Sends the outbox in one request. The server saves what it can and reports
  /// the rest — a partial success is the normal outcome, not an error.
  Future<SyncResult> submitReadings(int cycleId, List<RoundEntry> entries) async {
    final data = await client.post('/api/readings', {
      'cycle_id': cycleId,
      'readings': [
        for (final entry in entries)
          {'consumer_id': entry.consumerId, 'current_value': entry.currentValue},
      ],
    });

    final saved = <int, ({int? usage, String? flag})>{};
    for (final row in (data['saved'] as List?) ?? const []) {
      final map = row as Map<String, dynamic>;
      saved[map['consumer_id'] as int] = (
        usage: (map['usage_m3'] as num?)?.toInt(),
        flag: map['flag'] as String?,
      );
    }

    final failures = <SyncFailure>[];
    for (final row in (data['failures'] as List?) ?? const []) {
      final map = row as Map<String, dynamic>;
      failures.add(SyncFailure(
        consumerId: map['consumer_id'] as int,
        accountNo: map['account_no'] as String?,
        message: map['message'] as String? ?? 'Rejected',
        code: map['code'] as String?,
      ));
    }

    return SyncResult(
      saved: saved,
      failures: failures,
      cycleStatus: (data['cycle'] as Map<String, dynamic>?)?['status'] as String?,
    );
  }

  Future<List<Account>> accounts({String? query}) async {
    final data = await client.get('/api/mobile/accounts', query: {'q': ?query});
    return ((data['accounts'] as List?) ?? const [])
        .map((json) => Account.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Account> account(int consumerId) async {
    final data = await client.post('/api/mobile/accounts', {'consumer_id': consumerId});
    return Account.fromJson(data['account'] as Map<String, dynamic>);
  }

  /// The zones and categories the registration form offers. Also the cheapest
  /// way to find out whether the server still grants register-consumers — a 403
  /// here is the office having taken the permission away.
  Future<RegistrationOptions> registrationOptions() async {
    final data = await client.get('/api/mobile/consumers');
    return RegistrationOptions(
      zones: ((data['zones'] as List?) ?? const [])
          .map((json) => ZoneOption.fromJson(json as Map<String, dynamic>))
          .toList(),
      categories:
          ((data['categories'] as List?) ?? const []).map((c) => c as String).toList(),
    );
  }

  /// Registers a connection. Online-only, like a payment and for a related
  /// reason: the account number is handed out by the server inside a
  /// transaction, so there is no honest way to give somebody their number on a
  /// handset that cannot reach the office.
  Future<RegisteredConsumer> registerConsumer({
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
    final data = await client.post('/api/mobile/consumers', {
      'name': name,
      'zone_id': zoneId,
      'category': category,
      'is_metered': isMetered,
      'phone': ?phone,
      'address': ?address,
      'meter_no': ?meterNo,
      'opening_reading': openingReading,
    });

    return RegisteredConsumer.fromJson(
      data['consumer'] as Map<String, dynamic>,
      zoneName: zoneName,
    );
  }

  /// Records money taken. Unlike a reading this is never queued offline: two
  /// handsets holding unsent receipts for the same account would each be
  /// working from a balance the other has already changed. The server settles
  /// bills oldest-first and hands back the balance it arrived at.
  Future<PaymentReceipt> recordPayment({
    required Account account,
    required int amount,
    required PaymentChannel channel,
    String? reference,
  }) async {
    final data = await client.post('/api/payments', {
      'consumer_id': account.id,
      'amount': amount,
      'channel': channel.wire,
      'reference': ?reference,
    });

    final payment = data['payment'] as Map<String, dynamic>?;
    return PaymentReceipt(
      account: account,
      amount: amount,
      channel: channel,
      balanceAfter: (data['balance'] as num?)?.toInt() ?? account.balance - amount,
      receivedAt: DateTime.tryParse(payment?['received_at'] as String? ?? '') ?? DateTime.now(),
      reference: reference,
    );
  }
}
