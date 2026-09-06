import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/reading_rules.dart';
import '../logic/round_controller.dart';
import '../models/round.dart';
import '../theme.dart';
import 'format.dart';
import 'widgets/keypad.dart';

/// One meter. Deliberately a full screen rather than an inline field: the
/// person using it is standing outdoors, holding a torch, and the number they
/// type here becomes somebody's bill.
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
