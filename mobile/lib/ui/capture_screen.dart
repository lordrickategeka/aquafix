import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/capture_lock.dart';
import '../logic/reading_rules.dart';
import '../logic/round_controller.dart';
import '../models/round.dart';
import '../theme.dart';
import 'format.dart';
import 'widgets/keypad.dart';
import 'widgets/meter_profile.dart';

/// One meter. Deliberately a full screen rather than an inline field: the
/// person using it is standing outdoors, holding a torch, and the number they
/// type here becomes somebody's bill.
///
/// Reachable whether or not readings can still be captured. When they cannot —
/// the office has locked the cycle, or this meter has been billed — the keypad
/// is not shown at all and the screen becomes the account's profile. Offering a
/// keypad that cannot save is what left handsets holding numbers the office had
/// refused.
class CaptureScreen extends StatefulWidget {
  const CaptureScreen({super.key, required this.consumerId});

  final int consumerId;

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  String _typed = '';
  bool _started = false;

  RoundEntry? _entryOf(RoundController round) {
    for (final entry in round.entries) {
      if (entry.consumerId == widget.consumerId) return entry;
    }
    return null;
  }

  void _press(String digit) {
    // A meter dial is five or six digits; more than seven is a mis-key that
    // would otherwise sail through as an enormous, plausible-looking usage.
    if (_typed.length >= 7) return;
    setState(() {
      _typed = (_typed + digit).replaceFirst(RegExp(r'^0+(?=\d)'), '');
      _started = true;
    });
  }

  void _backspace() {
    if (_typed.isEmpty) return;
    setState(() => _typed = _typed.substring(0, _typed.length - 1));
  }

  Future<void> _save(RoundEntry entry) async {
    final value = int.tryParse(_typed);
    if (value == null) return;

    final round = context.read<RoundController>();
    try {
      await round.capture(entry, value);
      if (!mounted) return;
      Navigator.pop(context);
    } on ArgumentError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${e.message}'), backgroundColor: Kuwe.badFg),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final round = context.watch<RoundController>();
    final entry = _entryOf(round);

    if (entry == null) {
      return const Scaffold(body: Center(child: Text('This meter is no longer in the round.')));
    }

    // One question, asked in one place: may this reading still change? The
    // controller refuses the same cases, so the two cannot disagree.
    final lock = captureBlockReason(entry: entry, cycle: round.cycle);
    if (lock != null) return _ReadOnlyMeter(entry: entry, reason: lock);

    // Before the first keypress the screen shows whatever was captured earlier,
    // so re-opening a done meter reads as a review rather than a blank form.
    final effective = _started ? int.tryParse(_typed) : entry.currentValue;
    final display = _started ? (_typed.isEmpty ? '—' : _typed) : (entry.currentValue?.toString() ?? '—');

    final verdict = evaluateReading(
      previous: entry.previousValue,
      current: effective,
      history: entry.usageHistory,
    );
    final canSave = effective != null && !verdict.blocking && _started;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(entry.name,
                style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            Text(
              '${entry.accountNo}${entry.meterNo == null ? '' : ' · ${entry.meterNo}'}',
              style: const TextStyle(fontSize: 11.5, color: Kuwe.muted),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Account details',
            icon: const Icon(Icons.badge_outlined),
            onPressed: () => showMeterProfile(context, entry),
          ),
        ],
      ),
      body: Column(
        children: [
          _Head(entry: entry),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  display,
                  style: TextStyle(
                    fontSize: 54,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                    color: verdict.blocking ? Kuwe.badFg : Kuwe.ink,
                  ),
                ),
                const SizedBox(height: 10),
                _Verdict(verdict: verdict, entry: entry),
              ],
            ),
          ),
          Keypad(
            onDigit: _press,
            onBackspace: _backspace,
            onClear: () => setState(() {
              _typed = '';
              _started = true;
            }),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
              child: FilledButton(
                onPressed: canSave ? () => _save(entry) : null,
                child: Text(entry.isRead && !_started ? 'Change reading' : 'Save reading'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The meter as a record rather than a form. Everything the reader might be
/// asked at the gate is here; the number itself is shown but cannot be touched.
class _ReadOnlyMeter extends StatelessWidget {
  const _ReadOnlyMeter({required this.entry, required this.reason});

  final RoundEntry entry;
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(entry.name,
                style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            Text(
              '${entry.accountNo}${entry.meterNo == null ? '' : ' · ${entry.meterNo}'}',
              style: const TextStyle(fontSize: 11.5, color: Kuwe.muted),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(top: 12),
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 12),
            decoration: BoxDecoration(
              color: Kuwe.infoBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.lock_outline, size: 18, color: Kuwe.infoFg),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    reason,
                    style: const TextStyle(fontSize: 12.5, color: Kuwe.infoFg, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          if (entry.isMetered)
            Container(
              margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Kuwe.line),
              ),
              child: Column(
                children: [
                  const Text(
                    'THIS CYCLE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Kuwe.muted,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    entry.currentValue?.toString() ?? 'not read',
                    style: const TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: Kuwe.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    entry.usage == null
                        ? 'previous ${entry.previousValue}'
                        : '${entry.usage} m³ used · previous ${entry.previousValue}',
                    style: const TextStyle(fontSize: 12.5, color: Kuwe.mutedDeep),
                  ),
                ],
              ),
            ),
          MeterProfile(entry: entry),
        ],
      ),
    );
  }
}

class _Head extends StatelessWidget {
  const _Head({required this.entry});

  final RoundEntry entry;

  @override
  Widget build(BuildContext context) {
    final average = entry.usageHistory.isEmpty
        ? null
        : entry.usageHistory.reduce((a, b) => a + b) / entry.usageHistory.length;

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Row(
        children: [
          _Fact(label: 'Previous', value: '${entry.previousValue}'),
          _Fact(
            label: 'Usual use',
            value: average == null ? '—' : '${average.round()} m³',
          ),
          _Fact(label: 'Balance', value: ugx(entry.balance)),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: Kuwe.muted,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Kuwe.ink),
            ),
          ],
        ),
      );
}

class _Verdict extends StatelessWidget {
  const _Verdict({required this.verdict, required this.entry});

  final ReadingVerdict verdict;
  final RoundEntry entry;

  @override
  Widget build(BuildContext context) {
    if (verdict.usage == null && verdict.flag == ReadingFlag.missed) {
      return const Text(
        'Type the number on the dial',
        style: TextStyle(fontSize: 13, color: Kuwe.muted),
      );
    }

    final (bg, fg, text) = switch (verdict.flag) {
      ReadingFlag.negative => (Kuwe.badBg, Kuwe.badFg, verdict.note!),
      ReadingFlag.zero => (Kuwe.warnBg, Kuwe.warnFg, 'No water used since last time'),
      ReadingFlag.high => (Kuwe.warnBg, Kuwe.warnFg, '${verdict.usage} m³ — ${verdict.note}'),
      _ => (Kuwe.okBg, Kuwe.okFg, '${verdict.usage} m³ used'),
    };

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(9)),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}
