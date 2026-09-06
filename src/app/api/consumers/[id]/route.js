import { Op } from 'sequelize';
import { Consumer, Zone } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { CATEGORIES } from '@/lib/billing';

export async function PATCH(request, { params }) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const { id } = await params;
  const consumer = await Consumer.findByPk(id);
  if (!consumer) return fail('Consumer not found', 404);

  const body = await request.json();
  const { valid, errors } = validate(body, {
    name: 'required',
    zone_id: 'required|integer',
    category: `required|in:${CATEGORIES.join(',')}`,
    status: 'required|in:new,active,disconnected,closed',
  });
  if (!valid) return fail('Validation failed', 422, errors);

  if (!(await Zone.findByPk(body.zone_id))) {
    return fail('Validation failed', 422, { zone_id: 'Unknown zone' });
  }

  const isMetered = body.is_metered !== false && body.category !== 'kiosk';
  const meterNo = isMetered ? body.meter_no?.trim() || null : null;

  if (isMetered && !meterNo) {
    return fail('Validation failed', 422, {
      meter_no: 'A metered connection needs a meter number',
    });
  }
  if (meterNo) {
    const clash = await Consumer.findOne({
      where: { meter_no: meterNo, id: { [Op.ne]: consumer.id } },
    });
    if (clash) {
      return fail('Validation failed', 422, {
        meter_no: `That meter is on account ${clash.account_no}`,
      });
    }
  }

  try {
    await consumer.update({
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      zone_id: body.zone_id,
      category: body.category,
      is_metered: isMetered,
      meter_no: meterNo,
      status: body.status,
      connected_at: body.connected_at || null,
      opening_reading: isMetered ? Math.max(0, Number(body.opening_reading) || 0) : 0,
    });
    return success({ consumer });
  } catch (err) {
    console.error('Update consumer error:', err);
    return fail('Could not update the consumer', 500);
  }
}
