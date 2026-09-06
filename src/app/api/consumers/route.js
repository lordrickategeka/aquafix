import { Op, QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { Consumer, Zone } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { formatAccountNo, CATEGORIES } from '@/lib/billing';

export async function GET(request) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const zoneId = searchParams.get('zone');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const where = {};
  if (zoneId) where.zone_id = zoneId;
  if (q) {
    where[Op.or] = [
      { account_no: { [Op.like]: `%${q}%` } },
      { name: { [Op.like]: `%${q}%` } },
      { meter_no: { [Op.like]: `%${q}%` } },
    ];
  }

  const consumers = await Consumer.findAll({
    where,
    include: [{ model: Zone, as: 'zone', attributes: ['id', 'name'] }],
    order: [['account_no', 'ASC']],
    limit,
  });

  return success({ consumers });
}

export async function POST(request) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, {
    name: 'required',
    zone_id: 'required|integer',
    category: `required|in:${CATEGORIES.join(',')}`,
  });
  if (!valid) return fail('Validation failed', 422, errors);

  const zone = await Zone.findByPk(body.zone_id);
  if (!zone) return fail('Zone not found', 422, { zone_id: 'Unknown zone' });

  const isMetered = body.is_metered !== false && body.category !== 'kiosk';
  const meterNo = isMetered ? body.meter_no?.trim() || null : null;

  if (isMetered && !meterNo) {
    return fail('Validation failed', 422, {
      meter_no: 'A metered connection needs a meter number',
    });
  }
  if (meterNo && (await Consumer.findOne({ where: { meter_no: meterNo } }))) {
    return fail('Validation failed', 422, { meter_no: 'That meter is already on another account' });
  }

  try {
    // The account number is derived from the highest existing one, so the
    // read and the insert have to be in one transaction or two concurrent
    // creates would both claim the same KW- number.
    const consumer = await sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(account_no, 4) AS UNSIGNED)), 100) AS last
         FROM consumers FOR UPDATE`,
        { transaction, type: QueryTypes.SELECT },
      );

      return Consumer.create(
        {
          account_no: formatAccountNo(Number(row.last) + 1),
          name: body.name.trim(),
          phone: body.phone?.trim() || null,
          address: body.address?.trim() || null,
          zone_id: zone.id,
          category: body.category,
          is_metered: isMetered,
          meter_no: meterNo,
          status: body.status || 'new',
          connected_at: body.connected_at || null,
          // The dial reading at registration; the first cycle measures from it.
          opening_reading: isMetered ? Math.max(0, Number(body.opening_reading) || 0) : 0,
          balance: 0,
        },
        { transaction },
      );
    });

    return success({ consumer }, 201);
  } catch (err) {
    console.error('Create consumer error:', err);
    return fail('Could not create the consumer', 500);
  }
}
