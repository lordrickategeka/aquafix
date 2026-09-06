import { Reading, BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';

/* Exception review: a human either accepts the flagged reading as it stands or
   rejects it, which keeps it out of the billing run. */
export async function PATCH(request, { params }) {
  const { response } = await requirePermission('capture-readings');
  if (response) return response;

  const { id } = await params;
  const reading = await Reading.findByPk(id);
  if (!reading) return fail('Reading not found', 404);

  const body = await request.json();
  const { valid, errors } = validate(body, { status: 'required|in:approved,rejected,pending' });
  if (!valid) return fail('Validation failed', 422, errors);

  const cycle = await BillingCycle.findByPk(reading.billing_cycle_id);
  if (cycle && ['billed', 'closed'].includes(cycle.status)) {
    return fail(`Cycle ${cycle.period} is already ${cycle.status}`, 409);
  }
  if (body.status === 'approved' && reading.usage_m3 === null) {
    return fail('This reading has no usage to bill — capture a value first', 422);
  }

  await reading.update({
    status: body.status,
    note: body.note !== undefined ? body.note : reading.note,
  });

  return success({ reading });
}
