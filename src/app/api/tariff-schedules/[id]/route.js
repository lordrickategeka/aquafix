import { Op } from 'sequelize';
import sequelize from '@/lib/db';
import { Tariff, TariffBand, TariffSchedule, BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { CATEGORIES } from '@/lib/billing';

/* True once a schedule has priced bills that exist. Editing then would rewrite
   history — the stored bill lines would no longer match the schedule they cite,
   so the caller has to clone instead. */
async function isInUse(scheduleId) {
  return (
    (await BillingCycle.count({
      where: {
        tariff_schedule_id: scheduleId,
        status: { [Op.in]: ['billed', 'closed'] },
      },
    })) > 0
  );
}

function validateSchedule(categories) {
  const errors = {};

  for (const row of categories) {
    if (!CATEGORIES.includes(row.category)) {
      errors.category = `Unknown category ${row.category}`;
      continue;
    }
    const label = row.category;

    if (!Number.isInteger(Number(row.fixed_charge)) || Number(row.fixed_charge) < 0) {
      errors[`${label}.fixed_charge`] = 'Service charge must be a whole number, zero or more';
    }
    const levy = Number(row.levy_pct);
    if (Number.isNaN(levy) || levy < 0 || levy > 100) {
      errors[`${label}.levy_pct`] = 'Tax must be between 0 and 100';
    }
    if (row.flat_rate !== null && row.flat_rate !== '' && Number(row.flat_rate) < 0) {
      errors[`${label}.flat_rate`] = 'Flat rate cannot be negative';
    }

    const bands = [...(row.bands || [])].sort((a, b) => Number(a.min_m3) - Number(b.min_m3));
    let previousMax = 0;
    bands.forEach((band, index) => {
      const min = Number(band.min_m3);
      const max = band.max_m3 === null || band.max_m3 === '' ? null : Number(band.max_m3);

      if (min !== previousMax) {
        // Bands are cumulative and must tile the range without a gap or an
        // overlap, or some volume would be priced twice or not at all.
        errors[`${label}.band${index}`] = `Band ${index + 1} should start at ${previousMax}`;
      }
      if (max !== null && max <= min) {
        errors[`${label}.band${index}`] = `Band ${index + 1} ends at or before it starts`;
      }
      if (!Number.isInteger(Number(band.rate_per_m3)) || Number(band.rate_per_m3) < 0) {
        errors[`${label}.band${index}rate`] = `Band ${index + 1} rate must be a whole number`;
      }
      if (max === null && index !== bands.length - 1) {
        errors[`${label}.band${index}`] = 'Only the last band may be open-ended';
      }
      previousMax = max === null ? Infinity : max;
    });
  }

  return Object.keys(errors).length ? errors : null;
}

export async function PATCH(request, { params }) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const { id } = await params;
  const schedule = await TariffSchedule.findByPk(id);
  if (!schedule) return fail('Tariff schedule not found', 404);

  if (await isInUse(schedule.id)) {
    return fail(
      `"${schedule.name}" has already priced bills. Clone it to change prices — editing it would no longer match the invoices it produced.`,
      409,
    );
  }

  const body = await request.json();
  const categories = Array.isArray(body.categories) ? body.categories : [];

  const errors = validateSchedule(categories);
  if (errors) return fail('Validation failed', 422, errors);

  try {
    await sequelize.transaction(async (transaction) => {
      await schedule.update(
        {
          name: body.name?.trim() || schedule.name,
          effective_from: body.effective_from || null,
          note: body.note?.trim() || null,
        },
        { transaction },
      );

      // Categories absent from the payload were removed in the editor. Their
      // bands go with them via the FK cascade.
      const keep = categories.map((row) => row.category);
      await Tariff.destroy({
        where: {
          schedule_id: schedule.id,
          ...(keep.length ? { category: { [Op.notIn]: keep } } : {}),
        },
        transaction,
      });

      for (const row of categories) {
        const [tariff] = await Tariff.findOrCreate({
          where: { schedule_id: schedule.id, category: row.category },
          defaults: {
            schedule_id: schedule.id,
            category: row.category,
            effective_from: body.effective_from || new Date(),
          },
          transaction,
        });

        await tariff.update(
          {
            fixed_charge: Number(row.fixed_charge) || 0,
            levy_pct: Number(row.levy_pct) || 0,
            flat_rate:
              row.flat_rate === null || row.flat_rate === '' ? null : Number(row.flat_rate),
            effective_from: body.effective_from || tariff.effective_from,
          },
          { transaction },
        );

        // Bands are replaced wholesale — simpler to reason about than diffing,
        // and the schedule is not in use, so nothing references them.
        await TariffBand.destroy({ where: { tariff_id: tariff.id }, transaction });
        const bands = (row.bands || []).filter((band) => band.rate_per_m3 !== '');
        if (bands.length) {
          await TariffBand.bulkCreate(
            bands.map((band) => ({
              tariff_id: tariff.id,
              min_m3: Number(band.min_m3),
              max_m3: band.max_m3 === null || band.max_m3 === '' ? null : Number(band.max_m3),
              rate_per_m3: Number(band.rate_per_m3),
            })),
            { transaction },
          );
        }
      }
    });

    return success({ schedule });
  } catch (err) {
    console.error('Update tariff schedule error:', err);
    return fail('Could not save the schedule', 500);
  }
}

export async function DELETE(request, { params }) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const { id } = await params;
  const schedule = await TariffSchedule.findByPk(id);
  if (!schedule) return fail('Tariff schedule not found', 404);

  const used = await BillingCycle.count({ where: { tariff_schedule_id: schedule.id } });
  if (used > 0) {
    return fail(`${used} cycle(s) are priced on this schedule — it cannot be deleted`, 409);
  }

  await schedule.destroy();
  return success({ message: 'Schedule deleted' });
}
