import { BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { runBilling, billingPreflight } from '@/lib/billing-run';
import { emit, EVENTS } from '@/lib/events';

/* GET reports what the run would do; POST does it. Both read the same
   preflight, so the confirmation screen cannot disagree with the outcome. */
export async function GET(request) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const cycle = await BillingCycle.findByPk(searchParams.get('cycle_id'));
  if (!cycle) return fail('Billing cycle not found', 404);

  const { billable, blocked, alreadyBilled } = await billingPreflight(cycle);

  return success({
    cycle: { id: cycle.id, period: cycle.period, status: cycle.status },
    billable: billable.length,
    alreadyBilled,
    blocked: blocked.slice(0, 50).map(({ consumer, reason }) => ({
      account_no: consumer.account_no,
      name: consumer.name,
      reason,
    })),
    blockedTotal: blocked.length,
  });
}

export async function POST(request) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const body = await request.json();
  const cycle = await BillingCycle.findByPk(body.cycle_id);
  if (!cycle) return fail('Billing cycle not found', 404);

  try {
    const result = await runBilling({ cycleId: cycle.id, dueDate: body.due_date });
    await emit(EVENTS.BILLING_RUN_COMPLETED, {
      period: cycle.period,
      created: result.created,
      total: result.total,
    });
    return success(result);
  } catch (err) {
    console.error('Billing run error:', err);
    return fail(err.message || 'The billing run failed', 409);
  }
}
