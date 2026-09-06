import { Op } from 'sequelize';
import { Zone, Consumer } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';

export async function PATCH(request, { params }) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const { id } = await params;
  const zone = await Zone.findByPk(id);
  if (!zone) return fail('Zone not found', 404);

  const body = await request.json();
  const { valid, errors } = validate(body, { name: 'required', code: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const name = body.name.trim();
  const code = body.code.trim().toUpperCase();

  const clash = await Zone.findOne({
    where: { id: { [Op.ne]: zone.id }, [Op.or]: [{ name }, { code }] },
  });
  if (clash) {
    return fail('Validation failed', 422, {
      [clash.name === name ? 'name' : 'code']: 'Already used by another zone',
    });
  }

  await zone.update({ name, code, supply_window: body.supply_window?.trim() || null });
  return success({ zone });
}

export async function DELETE(request, { params }) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const { id } = await params;
  const zone = await Zone.findByPk(id);
  if (!zone) return fail('Zone not found', 404);

  // Consumers reference a zone, so one still in use cannot go.
  const consumers = await Consumer.count({ where: { zone_id: zone.id } });
  if (consumers > 0) {
    return fail(`${consumers} consumer(s) are in this zone — move them first`, 409);
  }

  await zone.destroy();
  return success({ message: 'Zone deleted' });
}
