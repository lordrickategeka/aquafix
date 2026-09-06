import sequelize from '@/lib/db';
import { Tariff, TariffBand, TariffSchedule } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { CATEGORIES } from '@/lib/billing';

/* Creates a schedule, optionally as a copy of an existing one. Cloning is how
   a price change is made: the old schedule stays exactly as it was so the
   cycles billed on it can still be explained. */
export async function POST(request) {
  const { response } = await requirePermission('run-billing');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, { name: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  try {
    const schedule = await sequelize.transaction(async (transaction) => {
      const created = await TariffSchedule.create(
        {
          name: body.name.trim(),
          effective_from: body.effective_from || null,
          note: body.note?.trim() || null,
        },
        { transaction },
      );

      const source = body.copy_from
        ? await Tariff.findAll({
            where: { schedule_id: body.copy_from },
            include: [{ model: TariffBand, as: 'bands' }],
            transaction,
          })
        : [];

      // A fresh schedule still needs a row per category, otherwise a run
      // against it would block every account for a missing tariff.
      const rows = source.length
        ? source.map((tariff) => ({
            category: tariff.category,
            fixed_charge: tariff.fixed_charge,
            levy_pct: tariff.levy_pct,
            flat_rate: tariff.flat_rate,
            bands: (tariff.bands || []).map((band) => ({
              min_m3: band.min_m3,
              max_m3: band.max_m3,
              rate_per_m3: band.rate_per_m3,
            })),
          }))
        : CATEGORIES.map((category) => ({
            category,
            fixed_charge: 0,
            levy_pct: 0,
            flat_rate: null,
            bands: category === 'kiosk' ? [] : [{ min_m3: 0, max_m3: null, rate_per_m3: 0 }],
          }));

      for (const row of rows) {
        const tariff = await Tariff.create(
          {
            schedule_id: created.id,
            category: row.category,
            fixed_charge: row.fixed_charge,
            levy_pct: row.levy_pct,
            flat_rate: row.flat_rate,
            effective_from: body.effective_from || created.created_at || new Date(),
          },
          { transaction },
        );
        if (row.bands.length) {
          await TariffBand.bulkCreate(
            row.bands.map((band) => ({ ...band, tariff_id: tariff.id })),
            { transaction },
          );
        }
      }

      return created;
    });

    return success({ schedule }, 201);
  } catch (err) {
    console.error('Create tariff schedule error:', err);
    return fail('Could not create the schedule', 500);
  }
}
