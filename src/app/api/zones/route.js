import { Zone } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';

export async function POST(request) {
  const { response } = await requirePermission('manage-consumers');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, { name: 'required', code: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const name = body.name.trim();
  const code = body.code.trim().toUpperCase();

  if (await Zone.findOne({ where: { name } })) {
    return fail('Validation failed', 422, { name: 'A zone with that name already exists' });
  }
  if (await Zone.findOne({ where: { code } })) {
    return fail('Validation failed', 422, { code: 'That code is already in use' });
  }

  const zone = await Zone.create({
    name,
    code,
    supply_window: body.supply_window?.trim() || null,
  });

  return success({ zone }, 201);
}
