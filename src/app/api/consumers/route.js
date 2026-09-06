import { Op } from 'sequelize';
import { Consumer, Zone } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { CATEGORIES } from '@/lib/billing';
import { createConsumer, ConsumerInputError } from '@/lib/consumers';

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

  try {
    const consumer = await createConsumer(body);
    return success({ consumer }, 201);
  } catch (err) {
    if (err instanceof ConsumerInputError) return fail('Validation failed', 422, err.errors);

    console.error('Create consumer error:', err);
    return fail('Could not create the consumer', 500);
  }
}
