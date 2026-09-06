import { Op } from 'sequelize';
import { Consumer, BillingCycle, Bill } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { issueBill, prepareOne } from '@/lib/billing-run';
import { emit, EVENTS } from '@/lib/events';

/* Bills one consumer on their own — the customer standing at the counter who
   wants their bill now, without waiting for the cycle to be locked and run.

   Safe against the whole-cycle run that follows: the unique (consumer, cycle)
   index means the run skips anyone already billed. Once billed, their reading
   for that cycle is frozen (see saveReading), so the bill in their hand cannot
   be contradicted later. */
export async function POST(request) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const body = await request.json();

  const consumer = await Consumer.findByPk(body.consumer_id);
  if (!consumer) return fail('Consumer not found', 404);

  const cycle = body.cycle_id
    ? await BillingCycle.findByPk(body.cycle_id)
    : await BillingCycle.findOne({
        where: { status: { [Op.in]: ['open', 'locked'] } },
        order: [['period', 'DESC']],
      });

  if (!cycle) return fail('No cycle is open to bill against', 409);
  if (['billed', 'closed'].includes(cycle.status) && !body.cycle_id) {
    return fail(`Cycle ${cycle.period} is already ${cycle.status}`, 409);
  }
  if (cycle.status === 'closed') return fail(`Cycle ${cycle.period} is closed`, 409);

  const already = await Bill.findOne({
    where: { consumer_id: consumer.id, billing_cycle_id: cycle.id },
  });
  if (already) {
    return fail(`${consumer.account_no} already has ${already.invoice_no} for ${cycle.period}`, 409);
  }

  const { tariff, reading, usage, reason } = await prepareOne(cycle, consumer);
  if (reason) return fail(reason, 422);

  try {
    const bill = await issueBill({ cycle, consumer, reading, tariff, usage });
    if (!bill) return fail('That consumer is already billed for this cycle', 409);

    await emit(EVENTS.BILLING_RUN_COMPLETED, {
      period: cycle.period,
      created: 1,
      total: bill.total_due,
    });

    return success({ bill, cycle: { period: cycle.period, status: cycle.status } }, 201);
  } catch (err) {
    console.error('Bill consumer error:', err);
    return fail(err.message || 'Could not issue the bill', 500);
  }
}
