import '../models/round.dart';

/// Whether a reading may still be captured, and if not, why — in the words the
/// reader is shown.
///
/// One definition, used by the controller that enforces it and by the screen
/// that explains it. When those were separate, the screen offered a keypad in
/// cases the server would refuse, and a refused reading stayed on the handset
/// looking saved. The rules here mirror saveReading() in the server's
/// src/lib/readings.js; anything this allows, the server may still reject, but
/// nothing this allows is *known* to be refused.
///
/// Returns null when capture is allowed.
String? captureBlockReason({required RoundEntry entry, required Cycle? cycle}) {
  // Order matters: the most specific reason is the most useful one. "Already
  // billed" tells a reader something about this meter; "the cycle is locked"
  // only tells them about the office.
  if (entry.billedInvoiceNo != null) {
    return 'Billed as ${entry.billedInvoiceNo}. The bill in this customer’s '
        'hands was worked out from this reading, so it can no longer change.';
  }
  if (!entry.isMetered) {
    return 'This connection has no meter. It is billed at the flat rate for its '
        'category, so there is nothing to read here.';
  }
  return cycleBlockReason(cycle);
}

/// The cycle half of the rule on its own, for screens that have no particular
/// meter in hand — the round list's banner, say.
String? cycleBlockReason(Cycle? cycle) {
  if (cycle == null) return 'No round has been downloaded yet.';
  if (cycle.isOpen) return null;

  return switch (cycle.status) {
    'closed' || 'billed' =>
      'This round has been billed. Its readings are final and cannot be changed.',
    _ => 'The office has locked ${cycle.period} for billing. Readings can no '
        'longer be changed.',
  };
}
