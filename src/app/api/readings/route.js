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
    /* The handset downloaded this round while the cycle was open and has been
       out of signal since. Sending the status back with the refusal is what
       lets it lock itself now rather than at the next download — until it
       knows, it will keep offering to capture readings nobody can save. */
    return fail(`Cycle ${cycle.period} is ${cycle.status} — readings are closed`, 409, {
      cycle_status: cycle.status,
      cycle_period: cycle.period,
    });
  }

  const saved = [];
  const failures = [];

  for (const entry of entries) {
    const consumer = await Consumer.findByPk(entry.consumer_id);
    if (!consumer) {
      failures.push({
        consumer_id: entry.consumer_id,
        message: 'Consumer not found',
        code: 'not-found',
      });
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
        failures.push({
          consumer_id: consumer.id,
          account_no: consumer.account_no,
          message: err.message,
          // Tells the app whether this is the reader's to fix or settled for
          // good; see SETTLED_CODES in @/lib/readings.
          code: err.code,
        });
      } else {
        console.error('Save reading error:', err);
        failures.push({
          consumer_id: consumer.id,
          account_no: consumer.account_no,
          message: 'Could not save',
          code: 'error',
        });
      }
    }
  }

  // The full cycle, not just its period: a handset that has been offline needs
  // to learn the status, and this is the call it always makes.
  return success({
    saved,
    failures,
    cycle: { id: cycle.id, period: cycle.period, status: cycle.status },
  });
}
