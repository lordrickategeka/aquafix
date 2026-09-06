import { BillingCycle, Reading } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { checkCycleDates, checkCyclePricing, parseOverride } from '@/lib/cycles';

/* Two jobs: editing a cycle's settings, and moving it through
   open -> locked -> billed -> closed. Locking is the point of no return for
   readings, so it refuses while exceptions are unresolved. */
export async function PATCH(request, { params }) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const { id } = await params;
  const cycle = await BillingCycle.findByPk(id);
  if (!cycle) return fail('Billing cycle not found', 404);

  const body = await request.json();

  // A settings edit carries no status; a transition carries nothing else.
  if (body.status === undefined) {
    if (['billed', 'closed'].includes(cycle.status)) {
      return fail(`Cycle ${cycle.period} is ${cycle.status} — its settings are fixed`, 409);
    }

    const dateErrors = checkCycleDates({
      reading_start: body.reading_start ?? cycle.reading_start,
      reading_end: body.reading_end ?? cycle.reading_end,
      due_date: body.due_date ?? cycle.due_date,
    });
    if (dateErrors) return fail('Validation failed', 422, dateErrors);

    const pricing = {
      unit_cost: parseOverride(body.unit_cost),
      fixed_charge: parseOverride(body.fixed_charge),
      levy_pct: parseOverride(body.levy_pct),
    };
    const pricingErrors = checkCyclePricing(pricing);
    if (pricingErrors) return fail('Validation failed', 422, pricingErrors);

    await cycle.update({
      reading_start: body.reading_start || null,
      reading_end: body.reading_end || null,
      due_date: body.due_date || null,
      note: body.note?.trim() || null,
      ...pricing,
    });
    return success({ cycle });
  }

  const { valid, errors } = validate(body, { status: 'required|in:open,locked,closed' });
  if (!valid) return fail('Validation failed', 422, errors);

  if (body.status === 'locked') {
    if (cycle.status !== 'open') return fail(`Cycle ${cycle.period} is already ${cycle.status}`, 409);

    const pending = await Reading.count({
      where: { billing_cycle_id: cycle.id, status: 'pending' },
    });
    if (pending > 0 && !body.force) {
      return fail(
        `${pending} reading${pending === 1 ? '' : 's'} still need review. Resolve them, or lock anyway to leave those accounts unbilled.`,
        409,
        { pending },
      );
    }

    await cycle.update({ status: 'locked', locked_at: new Date() });
    return success({ cycle });
  }

  if (body.status === 'open') {
    if (cycle.status !== 'locked') {
      return fail('Only a locked cycle can be reopened', 409);
    }
    await cycle.update({ status: 'open', locked_at: null });
    return success({ cycle });
  }

  if (cycle.status !== 'billed') {
    return fail('Only a billed cycle can be closed', 409);
  }
  await cycle.update({ status: 'closed' });
  return success({ cycle });
}
