/// A port of flagReading() and the guards in saveReading() from the server's
/// src/lib/billing.js and src/lib/readings.js.
///
/// It exists because a reader standing at a meter with no signal still needs to
/// be told "that is below the last reading" *now*, not tomorrow when the sync
/// fails. The server remains the authority — nothing here relaxes a rule, it
/// only anticipates one. If the two ever disagree, this file is wrong.
library;

enum ReadingFlag { ok, zero, high, negative, missed }

extension ReadingFlagName on ReadingFlag {
  /// The strings the server stores, so a flag can round-trip unchanged.
  String get wire => switch (this) {
        ReadingFlag.ok => 'ok',
        ReadingFlag.zero => 'zero',
        ReadingFlag.high => 'high',
        ReadingFlag.negative => 'negative',
        ReadingFlag.missed => 'missed',
      };

  static ReadingFlag fromWire(String? value) => switch (value) {
        'zero' => ReadingFlag.zero,
        'high' => ReadingFlag.high,
        'negative' => ReadingFlag.negative,
        'missed' => ReadingFlag.missed,
        _ => ReadingFlag.ok,
      };
}

class ReadingVerdict {
  const ReadingVerdict({
    required this.flag,
    required this.note,
    required this.blocking,
    this.usage,
  });

  final ReadingFlag flag;
  final String? note;

  /// True when the server would refuse to store this value at all, as opposed
  /// to storing it as an exception for the office to review. The capture screen
  /// disables Save on a blocking verdict.
  final bool blocking;

  final int? usage;

  bool get needsReview => flag != ReadingFlag.ok && !blocking;
}

/// [history] is the consumer's recent usage figures, most recent first.
ReadingVerdict evaluateReading({
  required int previous,
  required int? current,
  List<int> history = const [],
}) {
  if (current == null) {
    return const ReadingVerdict(
      flag: ReadingFlag.missed,
      note: 'Not read',
      blocking: false,
    );
  }

  if (current < 0) {
    return const ReadingVerdict(
      flag: ReadingFlag.negative,
      note: 'A reading cannot be negative',
      blocking: true,
    );
  }

  final usage = current - previous;

  // The dial only ever counts up. A lower figure is a mis-key, so it is
  // refused outright rather than saved for review — the server does the same,
  // and anything stored here may eventually be charged for.
  if (usage < 0) {
    return ReadingVerdict(
      flag: ReadingFlag.negative,
      note: '$current is below the previous reading of $previous. '
          'A meter cannot count backwards — check the digits.',
      blocking: true,
      usage: usage,
    );
  }

  if (usage == 0) {
    return const ReadingVerdict(
      flag: ReadingFlag.zero,
      note: 'No consumption',
      blocking: false,
      usage: 0,
    );
  }

  final sample = history.where((value) => value > 0).toList();
  if (sample.length >= 2) {
    final average = sample.reduce((a, b) => a + b) / sample.length;
    if (average > 0 && usage > average * 3) {
      return ReadingVerdict(
        flag: ReadingFlag.high,
        note: '${(usage / average).round()}× average — verify',
        blocking: false,
        usage: usage,
      );
    }
  }

  return ReadingVerdict(flag: ReadingFlag.ok, note: null, blocking: false, usage: usage);
}
