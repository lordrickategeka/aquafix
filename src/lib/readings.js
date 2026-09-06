import { Op } from 'sequelize';
import { Consumer, Reading, BillingCycle, Bill } from '@/models';
import { flagReading } from '@/lib/billing';

/* Shared by manual entry and CSV import so both reach identical conclusions
   about usage, flags and what needs review. */

/* The meter value this cycle measures from: the last reading captured, or —
   for a meter never read here — the figure recorded when the account was
   registered. Assuming zero would bill the meter's entire history. */
export async function previousValueFor(consumerId, cycleId) {
  const last = await Reading.findOne({
    where: {
      consumer_id: consumerId,
      billing_cycle_id: { [Op.ne]: cycleId },
      current_value: { [Op.ne]: null },
    },
    order: [['billing_cycle_id', 'DESC']],
  });
  if (last) return last.current_value;

  const consumer = await Consumer.findByPk(consumerId);
  return consumer?.opening_reading ?? 0;
}

export async function usageHistoryFor(consumerId, cycleId, limit = 3) {
  const rows = await Reading.findAll({
    where: {
      consumer_id: consumerId,
      billing_cycle_id: { [Op.ne]: cycleId },
      usage_m3: { [Op.ne]: null },
    },
    order: [['billing_cycle_id', 'DESC']],
    limit,
  });
  return rows.map((row) => row.usage_m3);
}

export class ReadingError extends Error {}

/* Writes one reading. A clean reading is approved on the spot; anything the
   flag rules doubt is left pending for a human, and only approved readings
   reach the billing run. */
export async function saveReading({ cycle, consumer, currentValue, source = 'web', userId, note }) {
  if (cycle.status !== 'open') {
    throw new ReadingError(`Cycle ${cycle.period} is ${cycle.status} — readings are closed`);
  }
  if (!consumer.is_metered) {
    throw new ReadingError(`${consumer.account_no} is unmetered and bills at a flat rate`);
  }

  const value =
    currentValue === '' || currentValue === null || currentValue === undefined
      ? null
      : Number(currentValue);

  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new ReadingError(`${consumer.account_no}: reading must be a whole number`);
  }

  /* A cycle being open normally means readings can still change. Once this
     consumer has been billed for it — which single-account billing allows
     before the cycle closes — their reading is settled: the bill in their
     hands was calculated from it. */
  const billed = await Bill.findOne({
    where: { consumer_id: consumer.id, billing_cycle_id: cycle.id },
  });
  if (billed) {
    throw new ReadingError(
      `${consumer.account_no} has already been billed for ${cycle.period} (${billed.invoice_no}) — its reading can no longer change`,
    );
  }

  const existing = await Reading.findOne({
    where: { consumer_id: consumer.id, billing_cycle_id: cycle.id },
  });
  const previous = existing ? existing.previous_value : await previousValueFor(consumer.id, cycle.id);
  const history = await usageHistoryFor(consumer.id, cycle.id);

  // A meter counts up and never down, so a lower figure is a mis-key, not a
  // reading. Rejected outright rather than stored as an exception — anything
  // saved here is something the billing run may eventually charge for.
  if (value !== null && value < previous) {
    throw new ReadingError(
      `${consumer.account_no}: ${value} is below the previous reading of ${previous}. A meter cannot count backwards — check the digits.`,
    );
  }

  const { flag, note: autoNote } = flagReading({ previous, current: value, history });
  const usage = value === null || flag === 'negative' ? null : value - previous;

  const payload = {
    consumer_id: consumer.id,
    billing_cycle_id: cycle.id,
    previous_value: previous,
    current_value: value,
    usage_m3: usage,
    flag,
    // A clean reading needs no ceremony; everything else waits for review.
    status: flag === 'ok' ? 'approved' : 'pending',
    note: note ?? autoNote,
    source,
    read_at: value === null ? null : new Date(),
    read_by: userId ?? null,
  };

  if (existing) {
    await existing.update(payload);
    return { reading: existing, created: false };
  }
  return { reading: await Reading.create(payload), created: true };
}

/* account_no,current_value — with or without a header row. */
export function parseReadingCsv(text) {
  const rows = [];
  const errors = [];

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    if (index === 0 && /account/i.test(cells[0])) return; // header

    const [account, value] = cells;
    if (!account) return;

    if (value === undefined || value === '') {
      errors.push({ line: index + 1, account, message: 'No reading value' });
      return;
    }
    if (!/^\d+$/.test(value)) {
      errors.push({ line: index + 1, account, message: `"${value}" is not a whole number` });
      return;
    }

    rows.push({ account_no: account.toUpperCase(), current_value: Number(value) });
  });

  return { rows, errors };
}

export async function openCycleOr(cycleId) {
  if (cycleId) return BillingCycle.findByPk(cycleId);
  return BillingCycle.findOne({ where: { status: 'open' }, order: [['period', 'DESC']] });
}

export async function consumerByAccount(accountNo) {
  return Consumer.findOne({ where: { account_no: accountNo } });
}
