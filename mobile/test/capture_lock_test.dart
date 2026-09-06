import 'package:flutter_test/flutter_test.dart';
import 'package:kuwe_meter/data/kuwe_api.dart';
import 'package:kuwe_meter/logic/capture_lock.dart';
import 'package:kuwe_meter/models/round.dart';

/// These two rules are what stop a handset holding a reading the office
/// refused. They mirror saveReading() and SETTLED_CODES in the server's
/// src/lib/readings.js — if a code or a status is ever renamed there, this is
/// where it should fail.

Cycle cycleWith(String status) =>
    Cycle(id: 7, period: '2026-08', status: status);

RoundEntry entryWith({
  bool isMetered = true,
  String? billedInvoiceNo,
  int? currentValue,
  int? syncedValue,
}) =>
    RoundEntry(
      consumerId: 1,
      accountNo: 'KW-000101',
      name: 'A Household',
      previousValue: 100,
      isMetered: isMetered,
      billedInvoiceNo: billedInvoiceNo,
      currentValue: currentValue,
      syncedValue: syncedValue,
    );

void main() {
  group('captureBlockReason', () {
    test('an open cycle and an ordinary meter can be captured', () {
      expect(
        captureBlockReason(entry: entryWith(), cycle: cycleWith('open')),
        isNull,
      );
    });

    test('a locked cycle blocks capture and names the period', () {
      final reason = captureBlockReason(entry: entryWith(), cycle: cycleWith('locked'));

      expect(reason, isNotNull);
      expect(reason, contains('2026-08'));
    });

    test('a closed cycle blocks capture', () {
      expect(captureBlockReason(entry: entryWith(), cycle: cycleWith('closed')), isNotNull);
    });

    test('a billed meter blocks capture even while the cycle is open', () {
      // Single-account billing settles one meter before the cycle closes.
      final reason = captureBlockReason(
        entry: entryWith(billedInvoiceNo: 'INV-2026-08-0007'),
        cycle: cycleWith('open'),
      );

      expect(reason, contains('INV-2026-08-0007'));
    });

    test('the invoice is the reason given, not the cycle', () {
      // Most specific reason wins: this tells the reader about this meter.
      final reason = captureBlockReason(
        entry: entryWith(billedInvoiceNo: 'INV-1'),
        cycle: cycleWith('locked'),
      );

      expect(reason, contains('INV-1'));
      expect(reason, isNot(contains('2026-08')));
    });

    test('an unmetered connection has nothing to read', () {
      final reason = captureBlockReason(
        entry: entryWith(isMetered: false),
        cycle: cycleWith('open'),
      );

      expect(reason, contains('no meter'));
    });

    test('no downloaded round blocks capture rather than crashing', () {
      expect(captureBlockReason(entry: entryWith(), cycle: null), isNotNull);
    });
  });

  group('SyncFailure.isSettled', () {
    // Settled means: nothing the reader types will ever be accepted, so the
    // handset puts the value back instead of holding it in the outbox.
    for (final code in ['cycle-closed', 'billed', 'unmetered']) {
      test('$code is settled', () {
        expect(
          SyncFailure(consumerId: 1, accountNo: 'KW-1', message: 'no', code: code).isSettled,
          isTrue,
        );
      });
    }

    // These the reader can correct at the meter, so the reading stays pending
    // with the server's message on it.
    for (final code in ['below-previous', 'not-a-number', 'not-found', 'error']) {
      test('$code is the reader\'s to fix', () {
        expect(
          SyncFailure(consumerId: 1, accountNo: 'KW-1', message: 'no', code: code).isSettled,
          isFalse,
        );
      });
    }

    test('an older server sending no code is treated as fixable', () {
      // Safer default: keeping a reading is recoverable, discarding one is not.
      expect(
        const SyncFailure(consumerId: 1, accountNo: 'KW-1', message: 'no').isSettled,
        isFalse,
      );
    });
  });
}
