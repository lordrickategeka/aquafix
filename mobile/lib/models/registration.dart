/// A zone the office has defined, as offered in the registration form. The
/// list comes from the server on every visit rather than being cached: a zone
/// added at the office this morning should be pickable this afternoon, and
/// registration is online-only anyway, so there is no offline case to serve.
class ZoneOption {
  const ZoneOption({required this.id, required this.name, required this.code});

  final int id;
  final String name;
  final String code;

  factory ZoneOption.fromJson(Map<String, dynamic> json) => ZoneOption(
        id: json['id'] as int,
        name: json['name'] as String,
        code: json['code'] as String? ?? '',
      );
}

/// The zones and tariff categories the server will accept. Both come down
/// together so the handset never holds a list of its own that could disagree
/// with what the server validates against.
class RegistrationOptions {
  const RegistrationOptions({required this.zones, required this.categories});

  final List<ZoneOption> zones;
  final List<String> categories;

  bool get isEmpty => zones.isEmpty;
}

/// What the office has on file once a registration goes through. The account
/// number is the point of it — it is assigned by the server, and it is what the
/// new customer is told.
class RegisteredConsumer {
  const RegisteredConsumer({
    required this.id,
    required this.accountNo,
    required this.name,
    required this.category,
    required this.isMetered,
    this.phone,
    this.address,
    this.meterNo,
    this.openingReading = 0,
    this.status = 'new',
    this.zoneName,
  });

  final int id;
  final String accountNo;
  final String name;
  final String category;
  final bool isMetered;
  final String? phone;
  final String? address;
  final String? meterNo;
  final int openingReading;
  final String status;
  final String? zoneName;

  factory RegisteredConsumer.fromJson(Map<String, dynamic> json, {String? zoneName}) =>
      RegisteredConsumer(
        id: json['id'] as int,
        accountNo: json['account_no'] as String,
        name: json['name'] as String,
        category: json['category'] as String? ?? 'domestic',
        isMetered: json['is_metered'] as bool? ?? true,
        phone: json['phone'] as String?,
        address: json['address'] as String?,
        meterNo: json['meter_no'] as String?,
        openingReading: (json['opening_reading'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'new',
        zoneName: zoneName,
      );
}

/// Title case for the category names the server sends as bare words.
String categoryLabel(String category) =>
    category.isEmpty ? category : category[0].toUpperCase() + category.substring(1);
