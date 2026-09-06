import 'package:flutter_test/flutter_test.dart';
import 'package:kuwe_meter/logic/reading_rules.dart';

/// Parity with the server's flagReading() and saveReading() guards. If one of
/// these fails, the handset and the office disagree about what a reading means
/// — which shows up as a reader being rejected at a meter with no explanation.
void main() {
  group('evaluateReading', () {
    test('a normal reading is clean', () {
      final verdict = evaluateReading(previous: 100, current: 108, history: [7, 8, 9]);
      expect(verdict.flag, ReadingFlag.ok);
      expect(verdict.usage, 8);
      expect(verdict.blocking, isFalse);
      expect(verdict.needsReview, isFalse);
    });

    test('below the previous reading is refused outright', () {
      final verdict = evaluateReading(previous: 100, current: 92);
      expect(verdict.flag, ReadingFlag.negative);
      expect(verdict.blocking, isTrue);
      expect(verdict.note, contains('cannot count backwards'));
    });

    test('the same reading is zero consumption, held for review', () {
      final verdict = evaluateReading(previous: 100, current: 100);
      expect(verdict.flag, ReadingFlag.zero);
      expect(verdict.usage, 0);
      expect(verdict.blocking, isFalse);
      expect(verdict.needsReview, isTrue);
    });

    test('more than three times the average is flagged high', () {
      // average 5, so anything over 15 trips it
      final verdict = evaluateReading(previous: 100, current: 116, history: [4, 5, 6]);
      expect(verdict.flag, ReadingFlag.high);
      expect(verdict.usage, 16);
      expect(verdict.needsReview, isTrue);
    });

    test('exactly three times the average is not high', () {
      final verdict = evaluateReading(previous: 100, current: 115, history: [4, 5, 6]);
      expect(verdict.flag, ReadingFlag.ok);
    });

    test('one prior figure is too thin a sample to call anything high', () {
      // Mirrors the server: it needs at least two usages before judging.
      final verdict = evaluateReading(previous: 100, current: 190, history: [5]);
      expect(verdict.flag, ReadingFlag.ok);
    });

    test('zeroes in the history are ignored when averaging', () {
      // sample becomes [4, 6], average 5
      final verdict = evaluateReading(previous: 100, current: 116, history: [4, 0, 0, 6]);
      expect(verdict.flag, ReadingFlag.high);
    });

    test('no value at all is a missed read', () {
      final verdict = evaluateReading(previous: 100, current: null);
      expect(verdict.flag, ReadingFlag.missed);
      expect(verdict.blocking, isFalse);
    });

    test('a new meter measures from its opening reading, not from zero', () {
      // The server hands down previous_value already resolved to the opening
      // reading, so a first read behaves like any other.
      final verdict = evaluateReading(previous: 69, current: 73, history: []);
      expect(verdict.usage, 4);
      expect(verdict.flag, ReadingFlag.ok);
    });

    test('flags round-trip through their wire names', () {
      for (final flag in ReadingFlag.values) {
        expect(ReadingFlagName.fromWire(flag.wire), flag);
      }
    });
  });
}
