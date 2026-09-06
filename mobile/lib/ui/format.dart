import 'package:intl/intl.dart';

final _ugx = NumberFormat.decimalPattern('en');

/// Whole shillings, the way the console prints them. There are no cents in
/// this system — money is stored as whole UGX all the way down.
String ugx(num amount) => 'UGX ${_ugx.format(amount.round())}';

String units(num value) => '${_ugx.format(value)} m³';

String shortTime(DateTime? at) {
  if (at == null) return 'never';
  final local = at.toLocal();
  final now = DateTime.now();
  final sameDay = local.year == now.year && local.month == now.month && local.day == now.day;
  return sameDay
      ? DateFormat('HH:mm').format(local)
      : DateFormat('d MMM, HH:mm').format(local);
}

String periodLabel(String period) {
  final parts = period.split('-');
  if (parts.length != 2) return period;
  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  if (year == null || month == null || month < 1 || month > 12) return period;
  return DateFormat('MMMM yyyy').format(DateTime(year, month));
}
