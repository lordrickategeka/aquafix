import { Consumer, BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { saveReading, ReadingError } from '@/lib/readings';

/* Bulk entry from the capture screen: one request for the whole visible page
   of meters, so a reader is not waiting on a round trip per row. */
export async function POST(request) {
  const { user, response } = await requirePermission('capture-readings');
  if (response) return response;

  const body = await request.json();
  const entries = Array.isArray(body.readings) ? body.readings : [];
  if (!entries.length) return fail('No readings submitted', 422);

  const cycle = await BillingCycle.findByPk(body.cycle_id);
  if (!cycle) return fail('Billing cycle not found', 404);
  if (cycle.status !== 'open') {
    return fail(`Cycle ${cycle.period} is ${cycle.status} — readings are closed`, 409);
  }

  const saved = [];
  const failures = [];

  for (const entry of entries) {
    const consumer = await Consumer.findByPk(entry.consumer_id);
    if (!consumer) {
      failures.push({ consumer_id: entry.consumer_id, message: 'Consumer not found' });
      continue;
    }

    try {
      const { reading } = await saveReading({
        cycle,
        consumer,
        currentValue: entry.current_value,
        source: 'web',
        userId: user.id,
      });
      saved.push({
        consumer_id: consumer.id,
        account_no: consumer.account_no,
        usage_m3: reading.usage_m3,
        flag: reading.flag,
        status: reading.status,
      });
    } catch (err) {
      if (err instanceof ReadingError) {
        failures.push({ consumer_id: consumer.id, account_no: consumer.account_no, message: err.message });
      } else {
        console.error('Save reading error:', err);
        failures.push({ consumer_id: consumer.id, account_no: consumer.account_no, message: 'Could not save' });
      }
    }
  }

  return success({ saved, failures, cycle: cycle.period });
}
