/* Cycle rules shared by the create and update routes. A cycle is the window
   meter readers collect in, so its dates have to make sense in order:
   readings open, readings close, then the bills fall due. */

export function checkCycleDates({ reading_start, reading_end, due_date }) {
  if (reading_start && reading_end && reading_end < reading_start) {
    return { reading_end: 'Reading window ends before it starts' };
  }
  if (due_date && reading_end && due_date < reading_end) {
    return { due_date: 'Bills cannot fall due before readings are collected' };
  }
  return null;
}

/* Pricing overrides are optional, so "" and undefined mean "leave it to the
   tariff" — but a deliberate 0 is a real value and must survive. */
export function parseOverride(value) {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}

export function checkCyclePricing({ unit_cost, fixed_charge, levy_pct }) {
  const errors = {};

  for (const [field, value] of [
    ['unit_cost', unit_cost],
    ['fixed_charge', fixed_charge],
  ]) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 0) {
      errors[field] = 'Must be a whole number of UGX, zero or more';
    }
  }

  if (levy_pct !== null) {
    if (Number.isNaN(levy_pct) || levy_pct < 0 || levy_pct > 100) {
      errors.levy_pct = 'Must be between 0 and 100';
    }
  }

  return Object.keys(errors).length ? errors : null;
}

export const CYCLE_STATUS_LABELS = {
  open: 'Open for readings',
  locked: 'Locked, ready to bill',
  billed: 'Billed',
  closed: 'Closed',
};

export const CYCLE_STATUS_PILL = {
  open: 'bg-ok-bg text-ok-fg',
  locked: 'bg-warn-bg text-warn-fg',
  billed: 'bg-info-bg text-info-fg',
  closed: 'bg-[#F1F5F4] text-muted-deep',
};
