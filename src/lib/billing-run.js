import { Op } from 'sequelize';
import sequelize from '@/lib/db';
import {
  Consumer,
  BillingCycle,
  Reading,
  Bill,
  BillLine,
  Tariff,
  TariffBand,
  TariffSchedule,
  LedgerEntry,
} from '@/models';
import { buildBill, formatInvoiceNo } from '@/lib/billing';
import { postBill } from '@/lib/ledger';

/* The prices a cycle bills on. A cycle points at a tariff schedule, so what it
   was billed with stays findable no matter how prices change later. Cycles
   predating schedules fall back to the newest schedule effective by then. */
export async function tariffsForCycle(cycle) {
  let scheduleId = cycle.tariff_schedule_id;

  if (!scheduleId) {
    const fallback = await TariffSchedule.findOne({
      where: {
        [Op.or]: [
          { effective_from: null },
          { effective_from: { [Op.lte]: `${cycle.period}-01` } },
        ],
      },
      order: [['effective_from', 'DESC']],
    });
    scheduleId = fallback?.id ?? null;
  }

  const rows = scheduleId
    ? await Tariff.findAll({
        where: { schedule_id: scheduleId },
        include: [{ model: TariffBand, as: 'bands' }],
      })
    : [];

  const byCategory = new Map();
  for (const tariff of rows) byCategory.set(tariff.category, tariff);
  return byCategory;
}

/* What stands between the cycle and a billing run. Returns the accounts that
   would be skipped so the UI can show them before anything is written. */
export async function billingPreflight(cycle) {
  const consumers = await Consumer.findAll({
    where: { status: { [Op.in]: ['active', 'new'] } },
    include: [{ model: Reading, as: 'readings', where: { billing_cycle_id: cycle.id }, required: false }],
  });

  const tariffs = await tariffsForCycle(cycle);
  const billable = [];
  const blocked = [];

  for (const consumer of consumers) {
    const reading = consumer.readings?.[0] ?? null;
    const tariff = tariffs.get(consumer.category);

    if (!tariff) {
      blocked.push({ consumer, reason: `No tariff for ${consumer.category}` });
      continue;
    }
    if (!consumer.is_metered) {
      if (tariff.flat_rate === null) {
        blocked.push({ consumer, reason: 'Unmetered, but the tariff has no flat rate' });
        continue;
      }
      billable.push({ consumer, reading: null, tariff, usage: null });
      continue;
    }
    if (!reading) {
      blocked.push({ consumer, reason: 'No reading captured' });
      continue;
    }
    if (reading.status !== 'approved') {
      blocked.push({ consumer, reason: `Reading still ${reading.status}` });
      continue;
    }
    if (reading.usage_m3 === null) {
      blocked.push({ consumer, reason: 'Reading has no usage' });
      continue;
    }

    billable.push({ consumer, reading, tariff, usage: reading.usage_m3 });
  }

  const alreadyBilled = await Bill.count({ where: { billing_cycle_id: cycle.id } });
  return { billable, blocked, alreadyBilled };
}

/* Issues one bill, in its own transaction. Shared by the whole-cycle run and
   by billing a single consumer at the counter, so both produce identical
   arithmetic, ledger postings and stored reconciliation figures.

   Returns null when a bill already exists for this consumer and cycle — the
   unique index makes that the safe outcome rather than a duplicate. */
export async function issueBill({ cycle, consumer, reading, tariff, usage, dueDate }) {
  return sequelize.transaction(async (transaction) => {
    const existing = await Bill.findOne({
      where: { consumer_id: consumer.id, billing_cycle_id: cycle.id },
      transaction,
    });
    if (existing) return null;

    // Re-read the balance inside the transaction so a payment landing
    // mid-run cannot be lost from the brought-forward figure.
    const fresh = await Consumer.findByPk(consumer.id, { transaction });

    /* The printed bill explains its brought-forward figure as "previous
       balance less what was paid since". Both are captured now and stored, so
       a payment backdated later cannot alter a bill already issued. */
    const previousBill = await Bill.findOne({
      where: { consumer_id: fresh.id, billing_cycle_id: { [Op.ne]: cycle.id } },
      order: [['issued_at', 'DESC']],
      transaction,
    });

    const since = previousBill ? { [Op.gt]: previousBill.issued_at } : { [Op.ne]: null };
    const movements = await LedgerEntry.findAll({
      where: { consumer_id: fresh.id, occurred_at: since },
      transaction,
    });

    const paidSince = movements
      .filter((entry) => entry.type === 'payment')
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const adjustedSince = movements
      .filter((entry) => entry.type === 'adjustment' || entry.type === 'fee')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const draft = buildBill({
      consumer: fresh,
      tariff,
      usage,
      broughtForward: fresh.balance,
      cycle,
    });

    const record = await Bill.create(
      {
        invoice_no: formatInvoiceNo(cycle.period, fresh.account_no),
        consumer_id: fresh.id,
        billing_cycle_id: cycle.id,
        reading_id: reading?.id ?? null,
        usage_m3: draft.usage_m3,
        consumption_amount: draft.consumption_amount,
        fixed_charge: draft.fixed_charge,
        levy_amount: draft.levy_amount,
        brought_forward: draft.brought_forward,
        // prev − paid + adjustments = the brought-forward figure, so the
        // three printed numbers always reconcile.
        previous_balance: draft.brought_forward + paidSince - adjustedSince,
        payments_since: paidSince,
        total_due: draft.total_due,
        due_date: dueDate ?? cycle.due_date,
        issued_at: new Date(),
        status: 'unpaid',
      },
      { transaction },
    );

    await BillLine.bulkCreate(
      draft.lines.map((line) => ({ ...line, bill_id: record.id })),
      { transaction },
    );

    await postBill({ consumer: fresh, bill: record, transaction });
    return record;
  });
}

/* What one consumer needs before they can be billed on a cycle. Mirrors the
   whole-cycle preflight, for the single-account case. */
export async function prepareOne(cycle, consumer) {
  const tariffs = await tariffsForCycle(cycle);
  const tariff = tariffs.get(consumer.category);
  if (!tariff) return { reason: `No price for ${consumer.category} in this cycle's tariff` };

  if (!consumer.is_metered) {
    if (tariff.flat_rate === null) {
      return { reason: 'Unmetered, but the tariff has no flat rate' };
    }
    return { tariff, reading: null, usage: null };
  }

  const reading = await Reading.findOne({
    where: { consumer_id: consumer.id, billing_cycle_id: cycle.id },
  });
  if (!reading) return { reason: 'No reading captured for this cycle' };
  if (reading.status !== 'approved') return { reason: `Reading still ${reading.status}` };
  if (reading.usage_m3 === null) return { reason: 'Reading has no usage' };

  return { tariff, reading, usage: reading.usage_m3 };
}

/* Generates the bills for a whole cycle. Each consumer is its own transaction:
   one bad account cannot roll back a run of thousands, and the unique
   (consumer, cycle) index means a re-run skips what already exists rather than
   double-billing. */
export async function runBilling({ cycleId, dueDate }) {
  const cycle = await BillingCycle.findByPk(cycleId);
  if (!cycle) throw new Error('Billing cycle not found');
  if (cycle.status === 'open') throw new Error('Lock the cycle before running billing');
  if (cycle.status === 'closed') throw new Error('This cycle is closed');

  const { billable, blocked } = await billingPreflight(cycle);
  const due = dueDate || cycle.due_date;

  const created = [];
  const skipped = [];
  const failed = [];

  for (const { consumer, reading, tariff, usage } of billable) {
    try {
      const bill = await issueBill({ cycle, consumer, reading, tariff, usage, dueDate: due });
      if (bill) created.push(bill);
      else skipped.push({ consumer, reason: 'Already billed for this cycle' });
    } catch (err) {
      failed.push({ consumer, reason: err.message });
    }
  }

  if (created.length && cycle.status === 'locked') {
    await cycle.update({ status: 'billed', billed_at: new Date() });
  }

  return {
    created: created.length,
    skipped: skipped.length,
    blocked: blocked.length,
    failed,
    total: created.reduce((sum, bill) => sum + bill.total_due, 0),
  };
}
