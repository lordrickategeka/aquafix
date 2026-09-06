/* Pricing rules. Pure functions — no database, no request context — so the
   billing run and the "what would this cost" previews share one source of
   truth, and this file can be reasoned about on its own.

   Band boundaries are cumulative: min_m3 is the volume already covered by
   lower bands (exclusive), max_m3 the volume this band covers up to
   (inclusive), NULL meaning "and everything above". So domestic 0–5 / 6–20 /
   above 20 is stored as (0,5), (5,20), (20,null). */

export const CATEGORIES = ['domestic', 'institutional', 'commercial', 'kiosk'];

export const CATEGORY_LABELS = {
  domestic: 'Domestic',
  institutional: 'Institutional',
  commercial: 'Commercial / industrial',
  kiosk: 'Public standpipe / kiosk',
};

// Labels the volume actually consumed in this band ("6–13 m³"), not the band's
// ceiling — that is what the consumer can check against their own meter.
function bandLabel(band, index, consumedTo) {
  const unbounded = band.max_m3 === null || band.max_m3 === undefined;
  // A single band covering everything is not a "band" to the consumer — it is
  // just what they used.
  if (unbounded && band.min_m3 === 0) return `${consumedTo} m³`;
  if (unbounded) return `above ${band.min_m3} m³`;
  const from = index === 0 ? 0 : band.min_m3 + 1;
  return `${from}–${consumedTo} m³`;
}

const ugx = (n) => Number(n).toLocaleString('en-US');

/* Splits usage across the progressive bands. Returns the total plus one line
   per band that actually consumed volume. */
export function chargeForUsage(usage, bands) {
  const ordered = [...bands].sort((a, b) => a.min_m3 - b.min_m3);
  const lines = [];
  let total = 0;

  ordered.forEach((band, index) => {
    const upper = band.max_m3 === null || band.max_m3 === undefined ? Infinity : band.max_m3;
    const volume = Math.max(0, Math.min(usage, upper) - band.min_m3);
    if (volume <= 0) return;

    const amount = volume * Number(band.rate_per_m3);
    total += amount;
    lines.push({
      description: `Water consumed ${bandLabel(band, index, Math.min(usage, upper))}`,
      detail: `${volume} × ${ugx(band.rate_per_m3)}`,
      amount,
    });
  });

  return { total, lines };
}

/* Builds the full bill for one consumer in one cycle.

   `usage` is null for unmetered consumers, who pay the category's flat rate.
   `broughtForward` is the consumer's balance at the moment of the run — the
   tax deliberately does not apply to it, only to this cycle's charges.

   `cycle` may carry pricing overrides. A unit_cost bills every m³ at one rate
   for that cycle instead of walking the category's bands; fixed_charge and
   levy_pct replace the tariff's when set. Anything left null falls back to the
   tariff, so an override never silently zeroes a charge it did not mention. */
export function buildBill({ consumer, tariff, usage, broughtForward = 0, cycle = null }) {
  const lines = [];
  let consumptionAmount = 0;

  const unitCost =
    cycle?.unit_cost === null || cycle?.unit_cost === undefined ? null : Number(cycle.unit_cost);

  if (consumer.is_metered && usage !== null && usage !== undefined) {
    if (unitCost !== null) {
      consumptionAmount = usage * unitCost;
      lines.push({
        description: `Water consumed ${usage} m³`,
        detail: `${usage} × ${ugx(unitCost)}`,
        amount: consumptionAmount,
      });
    } else {
      const charge = chargeForUsage(usage, tariff.bands || []);
      consumptionAmount = charge.total;
      lines.push(...charge.lines);
    }
  } else {
    // Unmetered connections have no usage to price, so a per-m³ rate cannot
    // apply to them — they stay on the category's flat rate.
    consumptionAmount = Number(tariff.flat_rate || 0);
    lines.push({
      description: 'Flat rate — unmetered connection',
      detail: 'monthly',
      amount: consumptionAmount,
    });
  }

  const fixedCharge = Number(
    cycle?.fixed_charge === null || cycle?.fixed_charge === undefined
      ? tariff.fixed_charge || 0
      : cycle.fixed_charge,
  );
  if (fixedCharge > 0) {
    lines.push({
      description: 'Monthly service charge',
      detail: `1 × ${ugx(fixedCharge)}`,
      amount: fixedCharge,
    });
  }

  const levyPct = Number(
    cycle?.levy_pct === null || cycle?.levy_pct === undefined ? tariff.levy_pct || 0 : cycle.levy_pct,
  );
  const levyAmount = Math.round(((consumptionAmount + fixedCharge) * levyPct) / 100);
  if (levyAmount > 0) {
    lines.push({
      description: 'Tax',
      detail: `${levyPct}%`,
      amount: levyAmount,
    });
  }

  const carried = Number(broughtForward || 0);
  if (carried !== 0) {
    lines.push({
      description: carried > 0 ? 'Brought forward' : 'Credit brought forward',
      detail: carried > 0 ? 'unpaid' : 'in credit',
      amount: carried,
    });
  }

  return {
    usage_m3: consumer.is_metered ? (usage ?? null) : null,
    consumption_amount: consumptionAmount,
    fixed_charge: fixedCharge,
    levy_amount: levyAmount,
    brought_forward: carried,
    total_due: consumptionAmount + fixedCharge + levyAmount + carried,
    lines: lines.map((line, position) => ({ ...line, position })),
  };
}

/* Meter readings are only trustworthy within limits — these flags decide what
   a human has to look at before the run. `history` is recent usage figures for
   the same consumer, most recent first. */
export function flagReading({ previous, current, history = [] }) {
  if (current === null || current === undefined) return { flag: 'missed', note: 'Not read' };

  // Not a storable state: saveReading refuses these. The flag exists so the
  // capture screens can warn while the operator is still typing.
  const usage = current - previous;
  if (usage < 0) return { flag: 'negative', note: 'Below the previous reading' };
  if (usage === 0) return { flag: 'zero', note: 'No consumption' };

  const sample = history.filter((value) => Number.isFinite(value) && value > 0);
  if (sample.length >= 2) {
    const average = sample.reduce((sum, value) => sum + value, 0) / sample.length;
    if (average > 0 && usage > average * 3) {
      return { flag: 'high', note: `${Math.round(usage / average)}× average — verify` };
    }
  }

  return { flag: 'ok', note: null };
}

export function usageFor({ previous, current }) {
  if (current === null || current === undefined) return null;
  return current - previous;
}

/* KW-0148 / INV-2609-0148 */
export function formatAccountNo(sequence) {
  return `KW-${String(sequence).padStart(4, '0')}`;
}

export function formatInvoiceNo(period, accountNo) {
  const [year, month] = period.split('-');
  return `INV-${year.slice(2)}${month}-${accountNo.replace(/^KW-/, '')}`;
}
