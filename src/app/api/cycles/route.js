import { Op } from 'sequelize';
import { BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { checkCycleDates, checkCyclePricing, parseOverride } from '@/lib/cycles';

export async function POST(request) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, { period: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period)) {
    return fail('Validation failed', 422, { period: 'Use the form 2026-10' });
  }
  if (await BillingCycle.findOne({ where: { period: body.period } })) {
    return fail(`Cycle ${body.period} already exists`, 409);
  }

  // Only one cycle collects readings at a time, otherwise a reading has no
  // unambiguous home.
  const alreadyOpen = await BillingCycle.findOne({ where: { status: 'open' } });
  if (alreadyOpen) {
    return fail(`Cycle ${alreadyOpen.period} is still open — lock it first`, 409);
  }

  const dateErrors = checkCycleDates(body);
  if (dateErrors) return fail('Validation failed', 422, dateErrors);

  /* "Carry forward": take the previous cycle's pricing wholesale. The tariff
     schedule is shared by reference, not copied — nothing changed, so there is
     nothing to duplicate. */
  const previous = body.carry_forward
    ? await BillingCycle.findOne({
        where: { period: { [Op.lt]: body.period } },
        order: [['period', 'DESC']],
      })
    : null;

  if (body.carry_forward && !previous) {
    return fail('There is no earlier cycle to carry settings from', 409);
  }

  const pricing = {
    unit_cost: parseOverride(body.unit_cost),
    fixed_charge: parseOverride(body.fixed_charge),
    levy_pct: parseOverride(body.levy_pct),
  };
  const pricingErrors = checkCyclePricing(pricing);
  if (pricingErrors) return fail('Validation failed', 422, pricingErrors);

  const [year, month] = body.period.split('-');
  const cycle = await BillingCycle.create({
    period: body.period,
    status: 'open',
    reading_start: body.reading_start || `${year}-${month}-01`,
    reading_end: body.reading_end || null,
    due_date: body.due_date || `${year}-${month}-20`,
    note: body.note?.trim() || null,
    tariff_schedule_id: body.tariff_schedule_id || previous?.tariff_schedule_id || null,
    ...(previous
      ? {
          unit_cost: pricing.unit_cost ?? previous.unit_cost,
          fixed_charge: pricing.fixed_charge ?? previous.fixed_charge,
          levy_pct: pricing.levy_pct ?? previous.levy_pct,
        }
      : pricing),
  });

  return success({ cycle }, 201);
}
