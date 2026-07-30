import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { validate } from '@/lib/validate';
import { Role, Permission } from '@/models';

export async function GET() {
  const { response } = await requireRole('admin');
  if (response) return response;

  const roles = await Role.findAll({
    include: { model: Permission, as: 'permissions', attributes: ['id', 'name'] },
    order: [['id', 'ASC']],
  });

  return success({
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions.map((permission) => ({
        id: permission.id,
        name: permission.name,
      })),
    })),
  });
}

export async function POST(request) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, { name: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const existing = await Role.findOne({ where: { name: body.name } });
  if (existing) return fail('Role already exists', 400);

  const role = await Role.create({ name: body.name });
  return success({ role: { id: role.id, name: role.name, permissions: [] } }, 201);
}
