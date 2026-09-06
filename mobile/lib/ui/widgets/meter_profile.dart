import 'package:flutter/material.dart';

import '../../models/round.dart';
import '../../theme.dart';
import '../format.dart';

/// Everything the office holds about one connection, as a reader standing at
/// the gate needs it: who this is, which meter, and — the question they
/// actually get asked — what is owed and what has been used.
///
/// Read-only on purpose. Nothing here can be edited from a handset; the
/// register is the console's to change.
class MeterProfile extends StatelessWidget {
  const MeterProfile({super.key, required this.entry, this.padding});

  final RoundEntry entry;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(14, 4, 14, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Card(
            children: [
              _Row(label: 'Account', value: entry.accountNo),
              _Row(label: 'Name', value: entry.name),
              _Row(label: 'Phone', value: entry.phone ?? '—'),
              _Row(label: 'Zone', value: entry.zoneName ?? '—'),
              _Row(
                label: 'Category',
                value: entry.category == null ? '—' : _titled(entry.category!),
              ),
              _Row(
                label: 'Meter',
                value: entry.isMetered
                    ? (entry.meterNo ?? '—')
                    // Not an error state: a connection with no meter is billed
                    // at its category's flat rate, and is not on this walk.
                    : 'Unmetered · flat rate',
              ),
              if (entry.address != null) _Row(label: 'Address', value: entry.address!),
            ],
          ),
          const SizedBox(height: 14),
          _Balance(balance: entry.balance),
          const SizedBox(height: 14),
          _Consumption(entry: entry),
        ],
      ),
    );
  }

  static String _titled(String value) =>
      value.isEmpty ? value : value[0].toUpperCase() + value.substring(1);
}

/// What the account owes, in the terms it gets asked about. A negative balance
/// is money already paid ahead, which reads badly as "owes -4,000".
class _Balance extends StatelessWidget {
  const _Balance({required this.balance});

  final int balance;

  @override
  Widget build(BuildContext context) {
    final owes = balance > 0;
    final credit = balance < 0;

    final (bg, fg, label, value) = switch ((owes, credit)) {
      (true, _) => (Kuwe.warnBg, Kuwe.warnFg, 'ARREARS', ugx(balance)),
      (_, true) => (Kuwe.okBg, Kuwe.okFg, 'IN CREDIT', ugx(-balance)),
      _ => (Kuwe.okBg, Kuwe.okFg, 'BALANCE', 'Nothing owing'),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: fg,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: fg),
          ),
          if (owes) ...[
            const SizedBox(height: 4),
            Text(
              // Said explicitly: a reader is not a cashier, and on a handset
              // that holds both tabs the money is taken on the other one.
              'Unpaid bills from earlier cycles. Readers do not collect money.',
              style: TextStyle(fontSize: 11.5, color: fg.withValues(alpha: 0.85)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Consumption extends StatelessWidget {
  const _Consumption({required this.entry});

  final RoundEntry entry;

  @override
  Widget build(BuildContext context) {
    final rows = entry.consumption;
    final average = entry.usageHistory.isEmpty
        ? null
        : entry.usageHistory.reduce((a, b) => a + b) / entry.usageHistory.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'CONSUMPTION',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Kuwe.muted,
                ),
              ),
              if (average != null)
                Text(
                  'usually ${average.round()} m³',
                  style: const TextStyle(fontSize: 11.5, color: Kuwe.mutedDeep),
                ),
            ],
          ),
        ),
        _Card(
          children: rows.isEmpty
              ? const [
                  Padding(
                    padding: EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      'No earlier readings. This meter has not been billed here yet.',
                      style: TextStyle(fontSize: 12.5, color: Kuwe.muted),
                    ),
                  ),
                ]
              : [
                  for (final row in rows)
                    _Row(
                      label: periodLabel(row.period),
                      value: row.usageM3 == null
                          ? 'not measured'
                          : '${row.usageM3} m³'
                              '${row.currentValue == null ? '' : '  ·  dial ${row.currentValue}'}',
                    ),
                ],
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Kuwe.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: const TextStyle(fontSize: 12.5, color: Kuwe.muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Kuwe.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The profile as a sheet, for when the keypad owns the screen.
Future<void> showMeterProfile(BuildContext context, RoundEntry entry) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Kuwe.canvas,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.92,
      builder: (context, controller) => ListView(
        controller: controller,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: Text(
              entry.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Kuwe.ink),
            ),
          ),
          MeterProfile(entry: entry),
        ],
      ),
    ),
  );
}
